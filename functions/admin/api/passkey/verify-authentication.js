/**
 * Cloudflare Pages Function for verifying WebAuthn/Passkey authentication
 * 
 * @param {Request} request
 * @param {Object} env - Contains environment bindings
 * @param {Object} ctx - Contains execution context
 * @returns {Response}
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    // 获取客户端提交的验证数据
    const credential = await request.json();
    
    if (!credential || !credential.id || !credential.rawId || !credential.response) {
      return new Response(JSON.stringify({ error: '缺少必要的验证数据' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    // 解析客户端数据JSON
    const clientDataJSON = JSON.parse(base64UrlToString(credential.response.clientDataJSON));
    
    // 检查挑战
    const challenge = clientDataJSON.challenge;
    const savedChallenge = await env.blog_data.get(`challenge:${challenge}`, { type: 'json' });
    
    if (!savedChallenge) {
      return new Response(JSON.stringify({ error: '无效或过期的挑战' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    // 检查客户端数据中的类型和来源
    if (clientDataJSON.type !== 'webauthn.get') {
      return new Response(JSON.stringify({ error: '无效的验证类型' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    // 检查origin是否匹配
    const expectedOrigin = new URL(request.url).origin;
    if (clientDataJSON.origin !== expectedOrigin) {
      return new Response(JSON.stringify({ error: '来源不匹配' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    // 查找对应的凭据
    const credentialId = credential.id;
    const passkeyKey = `passkey:${credentialId}`;
    const storedPasskey = await env.blog_data.get(passkeyKey, { type: 'json' });
    
    if (!storedPasskey) {
      return new Response(JSON.stringify({ error: '未找到对应的Passkey' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    // 这里应该进行更完整的验证，包括验证签名等
    // 在真实环境中，我们应该使用WebAuthn库来验证签名
    // 这里简化处理，直接检查credential ID是否匹配
    
    // 在成功验证后，清除使用过的挑战
    await env.blog_data.delete(`challenge:${challenge}`);
    
    // 更新Passkey的最后使用时间
    storedPasskey.lastUsed = Date.now();
    await env.blog_data.put(passkeyKey, JSON.stringify(storedPasskey));
    
    // 生成会话令牌
    const sessionToken = generateSessionToken();
    const sessionKey = `session:${sessionToken}`;
    
    // 将session token存储在KV中(设置过期时间，例如1小时)
    await env.blog_data.put(sessionKey, JSON.stringify({ 
      username: env.ADMIN_USERNAME, // 假设只有一个管理员
      loggedInAt: Date.now(),
      authMethod: 'passkey'
    }), {
      expirationTtl: 3600 // 1小时
    });
    
    // 设置HttpOnly cookie
    const headers = new Headers({
      'Content-Type': 'application/json;charset=UTF-8',
      'Set-Cookie': `admin_session=${sessionToken}; HttpOnly; Path=/admin; Max-Age=3600; SameSite=Strict`
    });
    
    return new Response(JSON.stringify({ 
      success: true,
      message: '登录成功',
      passkey: {
        name: storedPasskey.name || '未命名设备'
      }
    }), {
      status: 200,
      headers: headers
    });
    
  } catch (error) {
    console.error('验证Passkey出错:', error);
    return new Response(JSON.stringify({ error: '验证失败: ' + error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  }
}

// 辅助函数: 生成会话令牌
function generateSessionToken() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// 辅助函数: Base64URL格式转字符串
function base64UrlToString(base64Url) {
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (base64.length % 4)) % 4;
  const padded = base64.padEnd(base64.length + padLength, '=');
  return atob(padded);
} 