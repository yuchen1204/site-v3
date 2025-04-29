/**
 * Cloudflare Pages Function for deleting a passkey
 * 
 * @param {Request} request
 * @param {Object} env - Contains environment bindings
 * @param {Object} ctx - Contains execution context
 * @returns {Response}
 */

export async function onRequestDelete(context) {
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
    
    // 从请求获取要删除的凭据ID
    const data = await request.json();
    const { credentialId } = data;

    if (!credentialId) {
      return new Response(JSON.stringify({ error: '请求缺少必要数据' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }

    // 获取用户的凭据列表
    const credentialsKey = `passkey:credentials:${userId}`;
    let credentials = await env.blog_data.get(credentialsKey, { type: 'json' }) || [];
    
    // 检查凭据是否存在
    const index = credentials.findIndex(cred => cred.credentialID === credentialId);
    if (index === -1) {
      return new Response(JSON.stringify({ error: '未找到指定的Passkey凭据' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }

    // 确保用户至少保留一个凭据（如果这是唯一的凭据，则可以考虑放宽此限制）
    if (credentials.length <= 1) {
      return new Response(JSON.stringify({ error: '不能删除最后一个Passkey凭据' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }

    // 从列表中移除该凭据
    const deletedCredential = credentials.splice(index, 1)[0];
    
    // 更新凭据列表
    await env.blog_data.put(credentialsKey, JSON.stringify(credentials));

    return new Response(JSON.stringify({
      success: true,
      message: `成功删除Passkey: ${deletedCredential.name || '未命名设备'}`
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  } catch (error) {
    console.error('删除Passkey出错:', error);
    return new Response(JSON.stringify({ error: '删除Passkey失败: ' + error.message }), {
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