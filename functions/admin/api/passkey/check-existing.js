/**
 * Cloudflare Pages Function for checking if any passkeys are registered
 * 
 * @param {Request} request
 * @param {Object} env - Contains environment bindings
 * @param {Object} ctx - Contains execution context
 * @returns {Response}
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  
  try {
    // 检查是否有已注册的Passkey
    const passkeysPrefix = 'passkey:';
    const listResult = await env.blog_data.list({ prefix: passkeysPrefix, limit: 1 });
    const hasPasskeys = listResult.keys.length > 0;
    
    return new Response(JSON.stringify({ 
      hasPasskeys: hasPasskeys
    }), {
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
    
  } catch (error) {
    console.error('检查Passkey状态出错:', error);
    return new Response(JSON.stringify({ 
      error: '检查Passkey状态失败',
      hasPasskeys: false // 出错时假设没有
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  }
} 