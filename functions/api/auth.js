export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { action, password, currentPassword, newPassword } = body;

    // 1. Check if an Emergency Override Password is set in Cloudflare Environment Variables
    const overridePass = env.ADMIN_OVERRIDE_PASSWORD;
    
    // 2. Fetch the active password from Cloudflare KV (or fallback to Cloudflare Environment Variable)
    let activePassword = await env.MASJID_KV.get('admin_password');
    if (!activePassword) {
      activePassword = env.ADMIN_PASSWORD || 'admin';
    }

    // ACTION: LOGIN
    if (action === 'login') {
      const isOverride = overridePass && password === overridePass;
      const isMatch = password === activePassword;

      if (isMatch || isOverride) {
        // Generate a secure session token
        const token = btoa(`${Date.now()}_${Math.random().toString(36).substring(2)}`);
        await env.MASJID_KV.put('active_token', token, { expirationTtl: 86400 * 7 }); // 7-day session

        return new Response(JSON.stringify({ success: true, token, isOverride: Boolean(isOverride) }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ success: false, error: 'Invalid password credentials.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // ACTION: CHANGE PASSWORD
    if (action === 'change_password') {
      const isOverride = overridePass && currentPassword === overridePass;
      const isCurrentMatch = currentPassword === activePassword;

      if (!isCurrentMatch && !isOverride) {
        return new Response(JSON.stringify({ success: false, error: 'Current password verification failed.' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (!newPassword || newPassword.trim().length < 6) {
        return new Response(JSON.stringify({ success: false, error: 'New password must be at least 6 characters.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Save new password to Cloudflare KV
      await env.MASJID_KV.put('admin_password', newPassword.trim());

      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Password successfully updated in Cloudflare KV storage.' 
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: false, error: 'Invalid action requested.' }), { status: 400 });

  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500 });
  }
}
