/**
 * 管理单个评论的后台API
 * DELETE /admin/api/comments/[id] - 删除指定ID的评论
 */

export async function onRequestDelete(context) {
  try {
    const { params, env } = context;
    const commentId = params.id;
    
    if (!commentId) {
      return new Response(JSON.stringify({ error: '缺少评论ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 获取所有评论键值对
    const commentKeysResult = await env.blog_data.list({ prefix: 'comments:' });
    const commentKeys = commentKeysResult.keys;
    
    let deletionSuccess = false;
    // 对每个文章的评论集合进行检查
    for (const key of commentKeys) {
      const commentsJson = await env.blog_data.get(key.name);
      
      if (commentsJson) {
        try {
          let comments = JSON.parse(commentsJson);
          
          // 查找并移除指定ID的评论
          const originalLength = comments.length;
          comments = comments.filter(comment => comment.id !== commentId);
          
          // 如果长度减少，说明找到并删除了评论
          if (comments.length < originalLength) {
            // 更新KV存储
            await env.blog_data.put(key.name, JSON.stringify(comments));
            deletionSuccess = true;
            break; // 已找到并删除评论，退出循环
          }
        } catch (e) {
          console.error(`解析评论JSON出错 (${key.name}):`, e);
        }
      }
    }
    
    if (deletionSuccess) {
      return new Response(JSON.stringify({ success: true, message: '评论已成功删除' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      return new Response(JSON.stringify({ error: '找不到指定ID的评论' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('删除评论失败:', error);
    return new Response(JSON.stringify({ error: '删除评论失败，服务器错误' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
} 