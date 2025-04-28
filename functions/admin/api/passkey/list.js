/**
 * Cloudflare Pages Function for listing registered Passkeys
 * 
 * @param {Request} request
 * @param {Object} env - Contains environment bindings
 * @param {Object} ctx - Contains execution context
 * @returns {Response}
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  
  try {
    // 获取所有已注册的Passkey
    const passkeysPrefix = 'passkey:';
    const passkeys = [];
    let cursor;
    
    do {
      const listResult = await env.blog_data.list({ prefix: passkeysPrefix, cursor });
      for (const key of listResult.keys) {
        const passkeyData = await env.blog_data.get(key.name, { type: 'json' });
        if (passkeyData) {
          // 不返回原始数据，只返回必要信息
          passkeys.push({
            id: passkeyData.id,
            name: passkeyData.name,
            createdAt: passkeyData.createdAt,
            lastUsed: passkeyData.lastUsed
          });
        }
      }
      cursor = listResult.cursor;
    } while (cursor);
    
    return new Response(JSON.stringify(passkeys), {
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
    
  } catch (error) {
    console.error('获取Passkey列表出错:', error);
    return new Response(JSON.stringify({ error: '获取Passkey列表失败: ' + error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  }
} 