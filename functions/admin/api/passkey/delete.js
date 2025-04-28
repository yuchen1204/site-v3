/**
 * Cloudflare Pages Function for deleting passkey
 * 
 * @param {Request} request
 * @param {Object} env - Contains environment bindings
 * @param {Object} ctx - Contains execution context
 * @returns {Response}
 */

export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    // 获取当前已登录的用户名
    const sessionToken = getCookieValue(request, 'admin_session');
    if (!sessionToken) {
      return new Response(JSON.stringify({ error: '未登录，无法删除Passkey' }), {
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
    if (!passkeyInfo) {
      return new Response(JSON.stringify({ error: '没有找到可删除的Passkey' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    // 删除Passkey
    await env.blog_data.delete(`passkey:${username}`);
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Passkey已成功删除'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  } catch (error) {
    console.error('删除Passkey出错:', error);
    return new Response(JSON.stringify({ error: '删除Passkey失败' }), {
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