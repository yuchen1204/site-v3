/**
 * 获取已注册的Passkey列表
 * 
 * @param {Object} context - 包含请求、环境变量等信息的上下文对象
 * @returns {Response} JSON响应，包含Passkey列表
 */
export async function onRequestGet(context) {
  const { env } = context;
  
  try {
    // 从KV获取Passkey列表
    const passkeys = await env.blog_data.get('admin:passkeys', { type: 'json' }) || [];
    
    // 简化返回的数据，移除敏感字段
    const simplifiedPasskeys = passkeys.map(passkey => ({
      id: passkey.credentialID,
      name: passkey.name || '未命名设备',
      createdAt: passkey.createdAt,
      lastUsed: passkey.lastUsed,
      transports: passkey.transports || [],
      username: passkey.username
    }));
    
    return new Response(JSON.stringify(simplifiedPasskeys), {
      status: 200,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  } catch (error) {
    console.error('获取Passkey列表出错:', error);
    return new Response(JSON.stringify({ error: '获取Passkey列表出错' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  }
} 