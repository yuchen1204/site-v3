/**
 * Cloudflare Pages Function for handling profile data in admin
 * GET: Retrieves current profile data
 * PUT: Updates profile data
 */

const PROFILE_KEY = 'profile';

/**
 * 处理 GET 请求 - 获取个人资料
 */
export async function onRequestGet(context) {
  const { env } = context;
  
  try {
    const profileData = await env.blog_data.get(PROFILE_KEY, { type: 'json' });
    
    if (profileData === null) {
      // 如果 KV 中还没有数据，返回一个默认的空结构
      const defaultProfile = { name: '', avatar: '', motto: '', socialLinks: [] };
      return new Response(JSON.stringify(defaultProfile), {
        status: 200, // 即使是默认值也返回 200
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    return new Response(JSON.stringify(profileData), {
      status: 200,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  } catch (error) {
    console.error('获取个人资料数据出错 (admin):', error);
    return new Response(JSON.stringify({ error: '获取个人资料数据失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  }
}

/**
 * 处理 PUT 请求 - 更新个人资料
 */
export async function onRequestPut(context) {
  const { request, env } = context;
  
  try {
    const updatedProfileData = await request.json();

    // (可选) 在这里添加数据验证逻辑
    if (!updatedProfileData || typeof updatedProfileData.name === 'undefined') {
        return new Response(JSON.stringify({ error: '无效的个人资料数据' }), {
            status: 400, // Bad Request
            headers: { 'Content-Type': 'application/json;charset=UTF-8' }
        });
    }

    // 将更新后的数据写入 KV
    await env.blog_data.put(PROFILE_KEY, JSON.stringify(updatedProfileData));
    
    return new Response(JSON.stringify({ success: true, message: '个人资料已更新' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });

  } catch (error) {
    console.error('更新个人资料数据出错 (admin):', error);
    if (error instanceof SyntaxError) { // 处理 JSON 解析错误
         return new Response(JSON.stringify({ error: '请求体格式错误' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json;charset=UTF-8' }
        });
    }
    return new Response(JSON.stringify({ error: '更新个人资料失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  }
}

// 定义允许的请求方法
export const onRequest = [onRequestGet, onRequestPut];