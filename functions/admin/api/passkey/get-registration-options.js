/**
 * Cloudflare Pages Function for generating WebAuthn/Passkey registration options
 * 
 * @param {Request} request
 * @param {Object} env - Contains environment bindings
 * @param {Object} ctx - Contains execution context
 * @returns {Response}
 */
export async function onRequestGet(context) {
  const { request, env, data } = context;
  
  try {
    // 由于这是在管理面板内部，确保用户已经登录
    const cookieHeader = request.headers.get('Cookie') || '';
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      if (key) {
        acc[key] = value;
      }
      return acc;
    }, {});
    const sessionToken = cookies['admin_session'];

    if (!sessionToken) {
      return new Response(JSON.stringify({ error: '需要先登录才能注册Passkey' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }

    // 验证session是否有效
    const sessionKey = `session:${sessionToken}`;
    const sessionData = await env.blog_data.get(sessionKey, { type: 'json' });
    if (!sessionData || !sessionData.username) {
      return new Response(JSON.stringify({ error: '无效的会话，请重新登录' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    // 生成随机挑战
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const challengeBase64 = arrayBufferToBase64Url(challenge);
    
    // 保存挑战到KV，用于后续验证
    await env.blog_data.put(`challenge:${challengeBase64}`, JSON.stringify({
      timestamp: Date.now()
    }), { expirationTtl: 300 }); // 5分钟过期
    
    // 获取已注册的凭据，以便排除
    const passkeysPrefix = 'passkey:';
    const existingPasskeys = [];
    let cursor;
    
    do {
      const listResult = await env.blog_data.list({ prefix: passkeysPrefix, cursor });
      for (const key of listResult.keys) {
        const passkeyData = await env.blog_data.get(key.name, { type: 'json' });
        if (passkeyData && passkeyData.credentialId) {
          existingPasskeys.push({
            id: passkeyData.credentialId,
            type: 'public-key'
          });
        }
      }
      cursor = listResult.cursor;
    } while (cursor);
    
    // 构建注册选项
    const registrationOptions = {
      challenge: challengeBase64,
      rp: {
        name: new URL(request.url).hostname,
        id: new URL(request.url).hostname
      },
      user: {
        id: stringToBase64Url(sessionData.username),
        name: sessionData.username,
        displayName: sessionData.username
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 }, // ES256
        { type: 'public-key', alg: -257 } // RS256
      ],
      timeout: 60000, // 60秒超时
      authenticatorSelection: {
        authenticatorAttachment: 'platform', // 可以是 'platform' 或 'cross-platform' 或不指定
        requireResidentKey: false,
        userVerification: 'preferred'
      },
      attestation: 'none', // 不需要认证证明
      excludeCredentials: existingPasskeys // 排除已注册的凭据
    };
    
    return new Response(JSON.stringify(registrationOptions), {
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
    
  } catch (error) {
    console.error('生成注册选项出错:', error);
    return new Response(JSON.stringify({ error: '生成注册选项失败: ' + error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  }
}

// 辅助函数: ArrayBuffer转Base64URL格式
function arrayBufferToBase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// 辅助函数: 字符串转Base64URL格式
function stringToBase64Url(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
} 