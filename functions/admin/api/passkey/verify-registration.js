/**
 * 验证WebAuthn/Passkey注册响应
 * 
 * @param {Object} context - 包含请求、环境变量等信息的上下文对象
 * @returns {Response} JSON响应，包含验证结果
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    // 1. 获取注册响应数据
    const registrationResponse = await request.json();
    
    // 2. 获取会话cookie
    const cookies = parseCookies(request.headers.get('Cookie') || '');
    const passkey_reg_session = cookies.passkey_reg_session;
    
    if (!passkey_reg_session) {
      return new Response(JSON.stringify({ 
        error: '注册会话已过期或无效', 
        verified: false 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    // 3. 从KV获取注册会话数据
    const regSessionKey = `passkey:reg:${passkey_reg_session}`;
    const regSessionData = await env.blog_data.get(regSessionKey, { type: 'json' });
    
    if (!regSessionData || !regSessionData.challenge) {
      return new Response(JSON.stringify({ 
        error: '注册会话数据无效或已过期', 
        verified: false 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    // 4. 验证响应（简化版，实际生产环境应使用完整的WebAuthn验证）
    // 解析客户端数据
    const clientDataJSON = JSON.parse(
      atob(registrationResponse.response.clientDataJSON)
    );
    
    // 检查挑战是否匹配
    const challengeMatches = clientDataJSON.challenge === regSessionData.challenge;
    
    if (!challengeMatches) {
      return new Response(JSON.stringify({ 
        error: '验证失败：挑战不匹配', 
        verified: false 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    // 5. 获取现有Passkey列表
    const passkeys = await env.blog_data.get('admin:passkeys', { type: 'json' }) || [];
    
    // 6. 创建新的Passkey记录
    const newPasskey = {
      credentialID: registrationResponse.id,
      publicKey: registrationResponse.response.publicKey || registrationResponse.response.attestationObject,
      createdAt: new Date().toISOString(),
      lastUsed: new Date().toISOString(),
      transports: registrationResponse.response.transports || [],
      name: registrationResponse.name || '未命名设备', // 可选的设备名称
      username: regSessionData.username
    };
    
    // 7. 添加新Passkey到列表
    passkeys.push(newPasskey);
    
    // 8. 保存更新后的Passkey列表
    await env.blog_data.put('admin:passkeys', JSON.stringify(passkeys));
    
    // 9. 清理注册会话数据
    await env.blog_data.delete(regSessionKey);
    
    return new Response(JSON.stringify({ 
      verified: true,
      message: 'Passkey注册成功',
      device: {
        id: newPasskey.credentialID,
        name: newPasskey.name,
        createdAt: newPasskey.createdAt
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
    
  } catch (error) {
    console.error('验证Passkey注册出错:', error);
    return new Response(JSON.stringify({ 
      error: '验证Passkey注册出错: ' + error.message,
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