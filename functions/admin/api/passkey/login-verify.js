/**
 * 验证Passkey登录响应的API
 * 
 * 基于WebAuthn标准，验证认证响应并创建会话
 */

export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    // 获取验证请求数据
    const { credential, temp_token } = await request.json();
    
    if (!credential || !temp_token) {
      return new Response(JSON.stringify({ error: '无效的请求数据' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    // 检索临时会话
    const tempSessionKey = `temp_session:${temp_token}`;
    const tempSession = await env.blog_data.get(tempSessionKey, { type: 'json' });
    
    if (!tempSession) {
      return new Response(JSON.stringify({ error: '认证会话已过期或无效' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    const { username, challenge } = tempSession;
    
    // 获取用户的passkey
    const userPasskey = await env.blog_data.get(`passkey:${username}`, { type: 'json' });
    
    if (!userPasskey) {
      return new Response(JSON.stringify({ error: '未找到用户Passkey' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    // 验证凭据
    // 注意：在实际生产环境中，需要更全面的WebAuthn验证
    // 这里简化实现，仅验证凭据ID匹配
    if (credential.id !== userPasskey.credential.id) {
      return new Response(JSON.stringify({ error: '无效的凭据' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    // 验证成功后，删除临时会话
    await env.blog_data.delete(tempSessionKey);
    
    // 创建实际登录会话
    const sessionToken = generateSessionToken();
    const sessionKey = `session:${sessionToken}`;
    
    await env.blog_data.put(sessionKey, JSON.stringify({
      username: username,
      loginMethod: 'passkey',
      loggedInAt: Date.now()
    }), { expirationTtl: 3600 }); // 1小时过期
    
    // 设置会话cookie
    const headers = new Headers({
      'Content-Type': 'application/json;charset=UTF-8',
      'Set-Cookie': `admin_session=${sessionToken}; HttpOnly; Path=/admin; Max-Age=3600; SameSite=Strict`
    });
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Passkey登录成功'
    }), {
      status: 200,
      headers: headers
    });
  } catch (error) {
    console.error('验证登录响应出错:', error);
    return new Response(JSON.stringify({ error: '验证登录响应失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  }
}

// 生成会话令牌
function generateSessionToken() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
} 