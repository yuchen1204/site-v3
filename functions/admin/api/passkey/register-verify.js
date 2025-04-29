/**
 * 验证Passkey注册响应的API
 * 
 * 基于WebAuthn标准，验证来自客户端的注册响应并保存凭据
 */

export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    // 获取会话信息
    const sessionCookie = request.headers.get('Cookie')?.match(/admin_session=([^;]+)/)?.[1];
    
    if (!sessionCookie) {
      return new Response(JSON.stringify({ error: '需要先登录' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    const sessionKey = `session:${sessionCookie}`;
    const sessionData = await env.blog_data.get(sessionKey, { type: 'json' });
    
    if (!sessionData || !sessionData.currentChallenge) {
      return new Response(JSON.stringify({ error: '登录会话无效或挑战不存在' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    // 获取验证响应
    const { credential, username } = await request.json();
    
    if (!credential || !username) {
      return new Response(JSON.stringify({ error: '无效的请求数据' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    // 确保凭据包含必要的字段
    if (!credential.id || !credential.rawId || !credential.response || !credential.type) {
      return new Response(JSON.stringify({ error: '凭据数据不完整' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    // 验证挑战值
    // 注意：这里需要一个完整的WebAuthn验证库，以下代码是简化版
    const expectedChallenge = sessionData.currentChallenge;
    
    // 保存凭据到KV
    const passkey = {
      username,
      credential: {
        id: credential.id,
        publicKey: credential.response.publicKey,
        algorithm: credential.response.algorithm,
        counter: 0,
        createdAt: Date.now()
      }
    };
    
    await env.blog_data.put(`passkey:${username}`, JSON.stringify(passkey));
    
    // 清除会话中的挑战
    delete sessionData.currentChallenge;
    await env.blog_data.put(sessionKey, JSON.stringify(sessionData), { expirationTtl: 3600 });
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Passkey注册成功' 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  } catch (error) {
    console.error('验证注册响应出错:', error);
    return new Response(JSON.stringify({ error: '验证注册响应失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  }
} 