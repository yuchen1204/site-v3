/**
 * 删除指定的Passkey
 * 
 * @param {Object} context - 包含请求、环境变量等信息的上下文对象
 * @returns {Response} JSON响应，包含删除结果
 */
export async function onRequestDelete(context) {
  const { request, env } = context;
  
  try {
    // 1. 获取要删除的Passkey ID
    const url = new URL(request.url);
    const credentialID = url.searchParams.get('id');
    
    if (!credentialID) {
      return new Response(JSON.stringify({ error: '缺少必需的Passkey ID参数' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    // 2. 从KV获取Passkey列表
    const passkeys = await env.blog_data.get('admin:passkeys', { type: 'json' }) || [];
    
    // 3. 查找要删除的Passkey
    const passkeyIndex = passkeys.findIndex(pk => pk.credentialID === credentialID);
    
    if (passkeyIndex === -1) {
      return new Response(JSON.stringify({ error: '找不到指定的Passkey' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    // 4. 从列表中移除Passkey
    const removedPasskey = passkeys.splice(passkeyIndex, 1)[0];
    
    // 5. 保存更新后的列表
    await env.blog_data.put('admin:passkeys', JSON.stringify(passkeys));
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Passkey已成功删除',
      removedDevice: {
        id: removedPasskey.credentialID,
        name: removedPasskey.name || '未命名设备'
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
    
  } catch (error) {
    console.error('删除Passkey出错:', error);
    return new Response(JSON.stringify({ error: '删除Passkey出错' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  }
} 