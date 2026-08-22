export async function onRequestGet(context) {
  const { env } = context;

  try {
    const data = await env.MASJID_KV.get('masjid_data', 'json');
    return new Response(JSON.stringify({ success: true, data: data || null }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=15, stale-while-revalidate=45'
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500 });
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();
    const storedToken = await env.MASJID_KV.get('active_token');

    // Verify admin session token
    if (!token || token !== storedToken) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized session. Please log in again.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const payload = await request.json();
    if (!payload || !payload.data) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid payload data.' }), { status: 400 });
    }

    // Save master mosque data to Cloudflare KV (Broadcast to all visitors globally)
    await env.MASJID_KV.put('masjid_data', JSON.stringify(payload.data));

    return new Response(JSON.stringify({ success: true, message: 'Data synced to Cloudflare KV globally.' }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500 });
  }
}
