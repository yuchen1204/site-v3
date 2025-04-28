/**
 * Cloudflare Pages Function for getting passkey status
 * 
 * @param {Request} request
 * @param {Object} env - Contains environment bindings
 * @param {Object} ctx - Contains execution context
 * @returns {Response}
 */

export async function onRequestGet(context) {
  const { request, env } = context;
  
  try {
    // 获取当前已登录的用户名
    const sessionToken = getCookieValue(request, 'admin_session');
    if (!sessionToken) {
      return new Response(JSON.stringify({ error: '未登录，无法获取Passkey状态' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    const sessionKey = `session:${sessionToken}`;
    const sessionData = await env.blog_data.get(sessionKey, { type: 'json' });
    if (!sessionData || !sessionData.username) {
      return new Response(JSON.stringify({ error: '无效的会话，请重新登录' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    const username = sessionData.username;
    
    // 检查用户是否有Passkey
    const passkeyInfo = await env.blog_data.get(`passkey:${username}`, { type: 'json' });
    
    if (passkeyInfo) {
      // 用户已注册Passkey
      return new Response(JSON.stringify({
        hasPasskey: true,
        registeredAt: passkeyInfo.createdAt || null
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    } else {
      // 用户未注册Passkey
      return new Response(JSON.stringify({
        hasPasskey: false
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
  } catch (error) {
    console.error('获取Passkey状态出错:', error);
    return new Response(JSON.stringify({ error: '获取Passkey状态失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  }
}

function getCookieValue(request, name) {
  const cookieHeader = request.headers.get('Cookie') || '';
  const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    if (key) acc[key] = value;
    return acc;
  }, {});
  return cookies[name];
} 