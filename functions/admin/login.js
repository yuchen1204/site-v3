/**
 * Cloudflare Pages Function for handling admin login
 * 
 * @param {Request} request
 * @param {Object} env - Contains environment bindings
 * @param {Object} ctx - Contains execution context
 * @returns {Response}
 */

// 简单的 session token 生成 (仅示例，生产环境需要更安全的实现)
function generateSessionToken() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  
  // 从环境变量获取管理员凭据
  const ADMIN_USERNAME = env.ADMIN_USERNAME;
  const ADMIN_PASSWORD = env.ADMIN_PASSWORD;

  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
    console.error('管理员用户名或密码环境变量未设置');
    return new Response(JSON.stringify({ error: '服务器配置错误' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  }

  try {
    const { username, password } = await request.json();

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      // 凭据正确，生成 session token 并设置 cookie
      const sessionToken = generateSessionToken();
      const sessionKey = `session:${sessionToken}`;

      // 将 session token 存储在 KV 中 (设置过期时间，例如 1 小时)
      await env.blog_data.put(sessionKey, JSON.stringify({ username: username, loggedInAt: Date.now() }), {
        expirationTtl: 3600 // 1 hour
      });
      
      // 设置 HttpOnly cookie
      const headers = new Headers({
        'Content-Type': 'application/json;charset=UTF-8',
        'Set-Cookie': `admin_session=${sessionToken}; HttpOnly; Path=/admin; Max-Age=3600; SameSite=Strict`
      });

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: headers
      });
    } else {
      // 凭据错误
      return new Response(JSON.stringify({ error: '用户名或密码错误' }), {
        status: 401, // Unauthorized
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
  } catch (error) {
    console.error('登录处理出错:', error);
    return new Response(JSON.stringify({ error: '登录处理失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  }
} 