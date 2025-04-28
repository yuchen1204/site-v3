/**
 * Cloudflare Pages Function for managing a specific Passkey
 * 
 * @param {Request} request
 * @param {Object} env - Contains environment bindings
 * @param {Object} ctx - Contains execution context
 * @returns {Response}
 */
export async function onRequestDelete(context) {
  const { request, env, params } = context;
  
  try {
    const passkeyId = params.id;
    
    if (!passkeyId) {
      return new Response(JSON.stringify({ error: '缺少Passkey ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    // 查找对应ID的Passkey
    const passkeysPrefix = 'passkey:';
    let foundPasskey = null;
    let foundKey = null;
    let cursor;
    
    do {
      const listResult = await env.blog_data.list({ prefix: passkeysPrefix, cursor });
      for (const key of listResult.keys) {
        const passkeyData = await env.blog_data.get(key.name, { type: 'json' });
        if (passkeyData && passkeyData.id === passkeyId) {
          foundPasskey = passkeyData;
          foundKey = key.name;
          break;
        }
      }
      
      if (foundPasskey) break;
      cursor = listResult.cursor;
    } while (cursor);
    
    if (!foundPasskey || !foundKey) {
      return new Response(JSON.stringify({ error: '未找到指定的Passkey' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    // 删除Passkey
    await env.blog_data.delete(foundKey);
    
    return new Response(JSON.stringify({ 
      success: true,
      message: 'Passkey已成功删除',
      id: passkeyId
    }), {
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
    
  } catch (error) {
    console.error('删除Passkey出错:', error);
    return new Response(JSON.stringify({ error: '删除Passkey失败: ' + error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  }
} 