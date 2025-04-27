/**
 * 管理所有评论的后台API
 * GET /admin/api/comments - 获取所有评论
 */

export async function onRequestGet(context) {
  try {
    const { env } = context;
    
    // 获取所有文章ID
    const allBlogKeys = await env.blog_data.list({ prefix: 'blog:' });
    const allPostIds = allBlogKeys.keys.map(key => {
      const match = key.name.match(/blog:(\d+)/);
      return match ? match[1] : null;
    }).filter(Boolean);
    
    // 获取所有评论
    const allComments = [];
    const commentKeys = await env.blog_data.list({ prefix: 'comments:' });

    // 对每个文章ID，获取其评论
    for (const key of commentKeys.keys) {
      const commentsJson = await env.blog_data.get(key.name);
      
      if (commentsJson) {
        try {
          const comments = JSON.parse(commentsJson);
          
          // 将文章ID添加到每个评论对象
          const postIdMatch = key.name.match(/comments:(\d+)/);
          const postId = postIdMatch ? postIdMatch[1] : null;
          
          if (postId && Array.isArray(comments)) {
            comments.forEach(comment => {
              comment.postId = postId;
              allComments.push(comment);
            });
          }
        } catch (e) {
          console.error(`解析评论JSON出错 (${key.name}):`, e);
        }
      }
    }
    
    // 按时间戳降序排序
    allComments.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    return new Response(JSON.stringify(allComments), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('获取所有评论失败:', error);
    return new Response(JSON.stringify({ error: '获取评论失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
} 