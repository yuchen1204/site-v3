/**
 * API 端点: /api/blog/post/:id
 * 获取单篇博客文章数据
 */

// 从 KV 获取博客数据
async function getBlogPosts(env) {
  const jsonString = await env.blog_data.get('blog');
  try {
    return jsonString ? JSON.parse(jsonString) : [];
  } catch (e) {
    console.error("Error parsing blog data from KV:", e);
    return [];
  }
}

export async function onRequest(context) {
  const { request, env, params } = context;
  const postId = parseInt(params.id, 10);

  try {
    // 从 KV 获取所有博客文章
    const posts = await getBlogPosts(env);
    
    // 查找指定ID的文章
    const post = posts.find(p => p.id === postId);
    
    if (!post) {
      return new Response(JSON.stringify({ error: "文章不存在" }), {
        status: 404,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    // 返回找到的文章
    return new Response(JSON.stringify(post), {
      status: 200,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
    
  } catch (error) {
    console.error(`获取文章 ${postId} 失败:`, error);
    return new Response(JSON.stringify({ error: "获取文章失败" }), {
      status: 500,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  }
} 