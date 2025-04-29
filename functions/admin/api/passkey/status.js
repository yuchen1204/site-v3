/**
 * 检查用户Passkey状态的API
 * 
 * 用于前端检查用户是否已注册Passkey
 */

export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    // 获取用户请求数据
    const { username } = await request.json();
    
    if (!username) {
      return new Response(JSON.stringify({ error: '缺少用户名' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    // 检查用户是否已注册passkey
    const userPasskey = await env.blog_data.get(`passkey:${username}`, { type: 'json' });
    
    return new Response(JSON.stringify({ 
      hasPasskey: !!userPasskey,
      username: username
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  } catch (error) {
    console.error('检查Passkey状态出错:', error);
    return new Response(JSON.stringify({ error: '检查Passkey状态失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  }
} 