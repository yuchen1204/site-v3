/**
 * Cloudflare Pages Function for generating WebAuthn/Passkey authentication options
 * 
 * @param {Request} request
 * @param {Object} env - Contains environment bindings
 * @param {Object} ctx - Contains execution context
 * @returns {Response}
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  
  try {
    // 获取当前用户的所有注册过的凭据
    const passkeysPrefix = 'passkey:';
    const passkeys = [];
    let cursor;
    
    // 获取所有凭据 ID（可能需要多次查询）
    do {
      const listResult = await env.blog_data.list({ prefix: passkeysPrefix, cursor });
      for (const key of listResult.keys) {
        const passkeyData = await env.blog_data.get(key.name, { type: 'json' });
        if (passkeyData && passkeyData.credentialId) {
          passkeys.push(passkeyData);
        }
      }
      cursor = listResult.cursor;
    } while (cursor);

    // 如果没有已注册的凭据，返回错误
    if (passkeys.length === 0) {
      return new Response(JSON.stringify({ 
        error: '未找到已注册的Passkey' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }

    // 生成随机挑战
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const challengeBase64 = arrayBufferToBase64Url(challenge);
    
    // 保存挑战到KV，用于后续验证（设置短暂的过期时间）
    await env.blog_data.put(`challenge:${challengeBase64}`, JSON.stringify({
      timestamp: Date.now()
    }), { expirationTtl: 300 }); // 5分钟过期
    
    // 构建验证选项
    const authenticationOptions = {
      challenge: challengeBase64,
      timeout: 60000, // 60秒超时
      rpId: new URL(request.url).hostname,
      allowCredentials: passkeys.map(passkey => ({
        id: passkey.credentialId,
        type: 'public-key',
        transports: passkey.transports || ['internal']
      })),
      userVerification: 'preferred'
    };
    
    return new Response(JSON.stringify(authenticationOptions), {
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
    
  } catch (error) {
    console.error('生成验证选项出错:', error);
    return new Response(JSON.stringify({ error: '生成验证选项失败' }), {
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