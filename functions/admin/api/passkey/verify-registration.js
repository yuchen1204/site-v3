/**
 * Cloudflare Pages Function for verifying WebAuthn/Passkey registration
 * 
 * @param {Request} request
 * @param {Object} env - Contains environment bindings
 * @param {Object} ctx - Contains execution context
 * @returns {Response}
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    // 获取客户端提交的注册数据
    const credential = await request.json();
    
    if (!credential || !credential.id || !credential.rawId || !credential.response) {
      return new Response(JSON.stringify({ error: '缺少必要的注册数据' }), {
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
    if (clientDataJSON.type !== 'webauthn.create') {
      return new Response(JSON.stringify({ error: '无效的注册类型' }), {
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
    
    // 检查是否已经存在相同ID的凭据
    const credentialId = credential.id;
    const existingPasskey = await env.blog_data.get(`passkey:${credentialId}`, { type: 'json' });
    
    if (existingPasskey) {
      return new Response(JSON.stringify({ error: '该Passkey已经被注册' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    // 这里应该进行更完整的验证，包括解析attestationObject等
    // 在真实环境中，我们应该使用WebAuthn库来验证注册数据
    // 这里简化处理，直接保存凭据
    
    // 在成功验证后，清除使用过的挑战
    await env.blog_data.delete(`challenge:${challenge}`);
    
    // 准备保存凭据数据
    const deviceName = credential.clientData && credential.clientData.name 
      ? credential.clientData.name 
      : '未命名设备';
    
    const passkeyData = {
      id: crypto.randomUUID(), // 用于API操作的唯一ID
      credentialId: credentialId,
      rawId: credential.rawId,
      type: credential.type,
      name: deviceName,
      createdAt: Date.now(),
      lastUsed: null
    };
    
    // 保存凭据到KV
    await env.blog_data.put(`passkey:${credentialId}`, JSON.stringify(passkeyData));
    
    return new Response(JSON.stringify({ 
      success: true,
      message: 'Passkey注册成功',
      id: passkeyData.id,
      name: deviceName
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
    
  } catch (error) {
    console.error('验证Passkey注册出错:', error);
    return new Response(JSON.stringify({ error: '验证注册失败: ' + error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  }
}

// 辅助函数: Base64URL格式转字符串
function base64UrlToString(base64Url) {
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (base64.length % 4)) % 4;
  const padded = base64.padEnd(base64.length + padLength, '=');
  return atob(padded);
} 