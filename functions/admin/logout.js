/**
 * Cloudflare Pages Function for handling admin logout
 * 
 * @param {Request} request
 * @param {Object} env - Contains environment bindings
 * @param {Object} ctx - Contains execution context
 * @returns {Response}
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    // 获取 cookie 中的 session token
    const cookieHeader = request.headers.get('Cookie') || '';
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      if (key) {
        acc[key] = value;
      }
      return acc;
    }, {});
    const sessionToken = cookies['admin_session'];

    // 如果存在 token，从 KV 中删除对应的 session
    if (sessionToken) {
      const sessionKey = `session:${sessionToken}`;
      await env.blog_data.delete(sessionKey);
    }

    // 清除 cookie
    const headers = new Headers({
      'Content-Type': 'application/json;charset=UTF-8',
      'Set-Cookie': 'admin_session=; HttpOnly; Path=/admin; Max-Age=0; SameSite=Strict' // 设置 Max-Age=0 使 cookie 过期
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: headers
    });

  } catch (error) {
    console.error('退出登录处理出错:', error);
    return new Response(JSON.stringify({ error: '退出登录处理失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  }
} 