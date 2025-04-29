/**
 * Cloudflare Pages Function for listing user's passkeys
 * 
 * @param {Request} request
 * @param {Object} env - Contains environment bindings
 * @param {Object} ctx - Contains execution context
 * @returns {Response}
 */

export async function onRequestGet(context) {
  const { request, env } = context;
  
  try {
    // 仅已登录用户可访问
    const userInfo = await validateAdminSession(request, env);
    if (!userInfo) {
      return new Response(JSON.stringify({ error: '未授权，请先登录' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }

    // 确定用户 ID (这里用用户名)
    const userId = userInfo.username;
    
    // 获取用户的凭据列表
    const credentialsKey = `passkey:credentials:${userId}`;
    let credentials = await env.blog_data.get(credentialsKey, { type: 'json' }) || [];

    // 返回安全版本的凭据列表（不包含敏感数据）
    const safeCredentials = credentials.map(cred => ({
      id: cred.credentialID,
      name: cred.name,
      createdAt: cred.createdAt,
      lastUsed: cred.lastUsed,
    }));

    return new Response(JSON.stringify({
      username: userId,
      credentials: safeCredentials
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  } catch (error) {
    console.error('获取Passkey列表出错:', error);
    return new Response(JSON.stringify({ error: '获取Passkey列表失败: ' + error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  }
}

/**
 * 从请求中提取并验证管理员会话
 */
async function validateAdminSession(request, env) {
  // 获取 Cookie
  const cookieHeader = request.headers.get('Cookie') || '';
  const cookies = parseCookies(cookieHeader);
  const sessionToken = cookies['admin_session'];

  if (!sessionToken) {
    return null; // 没有会话令牌
  }

  // 从 KV 获取会话数据
  const sessionKey = `session:${sessionToken}`;
  const sessionData = await env.blog_data.get(sessionKey, { type: 'json' });

  if (!sessionData) {
    return null; // 无效会话
  }

  return sessionData; // 包含用户信息的会话
}

/**
 * 从 Cookie 头解析 Cookie
 */
function parseCookies(cookieHeader) {
  const cookies = {};
  if (cookieHeader) {
    cookieHeader.split(';').forEach(cookie => {
      const [name, value] = cookie.trim().split('=');
      cookies[name] = value;
    });
  }
  return cookies;
} 