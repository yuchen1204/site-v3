/**
 * 验证WebAuthn/Passkey认证响应
 * 
 * @param {Object} context - 包含请求、环境变量等信息的上下文对象
 * @returns {Response} JSON响应，包含验证结果
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    // 1. 获取验证响应数据
    const authenticationResponse = await request.json();
    
    // 2. 获取会话cookie，用于检索之前的挑战
    const cookies = parseCookies(request.headers.get('Cookie') || '');
    const passkey_session = cookies.passkey_session;
    
    if (!passkey_session) {
      return new Response(JSON.stringify({ 
        error: '会话已过期或无效', 
        verified: false 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    // 3. 从KV获取挑战数据
    const challengeKey = `passkey:challenge:${passkey_session}`;
    const challengeData = await env.blog_data.get(challengeKey, { type: 'json' });
    
    if (!challengeData || !challengeData.challenge) {
      return new Response(JSON.stringify({ 
        error: '挑战数据无效或已过期', 
        verified: false 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    // 4. 获取所有注册的Passkey
    const passkeys = await env.blog_data.get('admin:passkeys', { type: 'json' }) || [];
    
    // 5. 查找匹配的Passkey记录
    const credentialId = authenticationResponse.id;
    const matchingPasskey = passkeys.find(pk => pk.credentialID === credentialId);
    
    if (!matchingPasskey) {
      return new Response(JSON.stringify({ 
        error: '找不到匹配的Passkey', 
        verified: false 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    // 6. 验证响应（在实际场景中需要更复杂的验证逻辑，例如使用SimpleWebAuthn库）
    // 简化示例：检查基本必需字段，实际生产环境需要更严格的验证
    const clientDataJSON = JSON.parse(
      atob(authenticationResponse.response.clientDataJSON)
    );
    
    // 检查挑战是否匹配
    const challengeMatches = clientDataJSON.challenge === challengeData.challenge;
    
    if (!challengeMatches) {
      return new Response(JSON.stringify({ 
        error: '验证失败：挑战不匹配', 
        verified: false 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    // 7. 验证通过，可以更新Passkey的最后使用时间或其他属性
    // 标记Passkey已使用，更新信息
    matchingPasskey.lastUsed = new Date().toISOString();
    await env.blog_data.put('admin:passkeys', JSON.stringify(passkeys));
    
    // 8. 验证通过后处理会话
    // 清理挑战数据
    await env.blog_data.delete(challengeKey);
    
    // 9. 创建管理员会话
    const sessionToken = generateSessionToken();
    const sessionKey = `session:${sessionToken}`;
    
    // 将 session token 存储在 KV 中
    await env.blog_data.put(sessionKey, JSON.stringify({ 
      username: 'admin', // 这里可以从Passkey中获取用户名
      authenticationType: 'passkey',
      loggedInAt: Date.now() 
    }), {
      expirationTtl: 3600 // 1小时会话
    });
    
    // 设置 HttpOnly cookie
    const headers = new Headers({
      'Content-Type': 'application/json;charset=UTF-8',
      'Set-Cookie': `admin_session=${sessionToken}; HttpOnly; Path=/admin; Max-Age=3600; SameSite=Strict`
    });
    
    return new Response(JSON.stringify({ 
      verified: true,
      message: 'Passkey验证成功'
    }), {
      status: 200,
      headers: headers
    });
    
  } catch (error) {
    console.error('验证Passkey出错:', error);
    return new Response(JSON.stringify({ 
      error: '验证Passkey出错: ' + error.message,
      verified: false
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  }
}

/**
 * 解析Cookie字符串
 * @param {string} cookieStr - Cookie字符串
 * @returns {Object} 解析后的Cookie对象
 */
function parseCookies(cookieStr) {
  const cookies = {};
  cookieStr.split(';').forEach(cookie => {
    const [name, value] = cookie.trim().split('=');
    if (name && value) cookies[name] = value;
  });
  return cookies;
}

/**
 * 生成随机会话令牌
 * @returns {string} 随机会话令牌
 */
function generateSessionToken() {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
} 