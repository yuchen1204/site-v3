/**
 * Cloudflare Pages Function for retrieving a single blog post from KV
 * 
 * @param {Request} request
 * @param {Object} env - Contains environment bindings
 * @param {Object} ctx - Contains execution context
 * @returns {Response}
 */
export async function onRequest(context) {
  const { request, env, params } = context;
  const postId = parseInt(params.id, 10);

  if (isNaN(postId)) {
    return new Response(JSON.stringify({ error: '无效的文章ID' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        'Cache-Control': 'no-cache'
      }
    });
  }
  
  try {
    // 尝试从 KV 获取博客文章数据
    const allPosts = await env.blog_data.get('blog', { type: 'json' });
    
    // 如果数据不存在
    if (allPosts === null) {
      return new Response(JSON.stringify({ error: '找不到博客文章数据' }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json;charset=UTF-8',
          'Cache-Control': 'no-cache'
        }
      });
    }
    
    // 查找指定ID的文章
    const post = allPosts.find(post => post.id === postId);
    
    if (!post) {
      return new Response(JSON.stringify({ error: '找不到指定ID的文章' }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json;charset=UTF-8',
          'Cache-Control': 'no-cache'
        }
      });
    }
    
    // 返回成功响应
    return new Response(JSON.stringify(post), {
      status: 200,
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        'Cache-Control': 'public, max-age=60' // 缓存1分钟
      }
    });
  } catch (error) {
    // 出错时返回错误响应
    console.error('获取单篇文章数据出错:', error);
    return new Response(JSON.stringify({ error: '获取文章数据出错' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        'Cache-Control': 'no-cache'
      }
    });
  }
} 