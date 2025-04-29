/**
 * 生成Passkey登录选项的API
 * 
 * 基于WebAuthn标准，生成用于认证的选项
 */

export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    // 从请求中获取用户名称
    const { username } = await request.json();
    
    if (!username) {
      return new Response(JSON.stringify({ error: '缺少用户名' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    // 检查用户是否已注册passkey
    const userPasskey = await env.blog_data.get(`passkey:${username}`, { type: 'json' });
    
    if (!userPasskey) {
      return new Response(JSON.stringify({ error: '未找到Passkey，请先注册' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    // 生成认证选项
    const authenticationOptions = {
      challenge: generateRandomBuffer(32),
      timeout: 60000, // 1分钟
      rpId: new URL(request.url).hostname,
      userVerification: 'preferred',
      allowCredentials: [{
        id: userPasskey.credential.id,
        type: 'public-key',
        transports: ['internal']
      }]
    };
    
    // 创建临时会话保存挑战值
    const tempSessionToken = generateSessionToken();
    const tempSessionKey = `temp_session:${tempSessionToken}`;
    
    await env.blog_data.put(tempSessionKey, JSON.stringify({
      username,
      challenge: bufferToBase64url(authenticationOptions.challenge),
      createdAt: Date.now()
    }), { expirationTtl: 300 }); // 5分钟过期
    
    // 转换挑战为Base64URL编码
    authenticationOptions.challenge = bufferToBase64url(authenticationOptions.challenge);
    
    return new Response(JSON.stringify({
      options: authenticationOptions,
      temp_token: tempSessionToken
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  } catch (error) {
    console.error('生成登录选项出错:', error);
    return new Response(JSON.stringify({ error: '生成登录选项失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  }
}

// 工具函数：生成随机缓冲区
function generateRandomBuffer(size) {
  return crypto.getRandomValues(new Uint8Array(size));
}

// 工具函数：缓冲区转Base64URL
function bufferToBase64url(buffer) {
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// 生成会话令牌
function generateSessionToken() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
} 