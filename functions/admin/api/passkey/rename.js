/**
 * 重命名现有的Passkey
 * 
 * @param {Object} context - 包含请求、环境变量等信息的上下文对象
 * @returns {Response} JSON响应，包含重命名结果
 */
export async function onRequestPut(context) {
  const { request, env } = context;
  
  try {
    // 1. 获取请求数据
    const requestData = await request.json();
    const { id, name } = requestData;
    
    if (!id || !name) {
      return new Response(JSON.stringify({ error: '缺少必需的参数' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    // 验证名称长度
    if (name.length < 1 || name.length > 50) {
      return new Response(JSON.stringify({ error: '设备名称必须在1-50个字符之间' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    // 2. 从KV获取Passkey列表
    const passkeys = await env.blog_data.get('admin:passkeys', { type: 'json' }) || [];
    
    // 3. 查找要重命名的Passkey
    const passkey = passkeys.find(pk => pk.credentialID === id);
    
    if (!passkey) {
      return new Response(JSON.stringify({ error: '找不到指定的Passkey' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    // 4. 更新名称
    passkey.name = name;
    
    // 5. 保存更新后的列表
    await env.blog_data.put('admin:passkeys', JSON.stringify(passkeys));
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Passkey已成功重命名',
      device: {
        id: passkey.credentialID,
        name: passkey.name
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
    
  } catch (error) {
    console.error('重命名Passkey出错:', error);
    return new Response(JSON.stringify({ error: '重命名Passkey出错' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  }
} 