/**
 * POST /api/comments/delete
 * 删除指定的评论 (需要权限验证)
 * 需要postId和commentId
 */
export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    
    // 这里应该有权限验证逻辑
    // 例如检查 cookie 或 Authorization 头
    // 简单起见，这个示例不包含详细的权限验证
    
    const data = await request.json();
    
    // 验证必要的参数
    if (!data.postId || !data.commentId) {
      return new Response('Missing required fields (postId, commentId)', { status: 400 });
    }
    
    const postId = data.postId;
    const commentId = data.commentId;
    const kvKey = `comments:${postId}`;
    
    // 从KV获取评论列表
    const commentsJson = await env.blog_data.get(kvKey);
    if (!commentsJson) {
      return new Response('评论不存在', { status: 404 });
    }
    
    // 解析并过滤掉要删除的评论
    let comments = JSON.parse(commentsJson);
    const initialCount = comments.length;
    comments = comments.filter(comment => comment.id !== commentId);
    
    // 如果评论数量没变，说明没找到要删除的评论
    if (comments.length === initialCount) {
      return new Response('未找到指定的评论', { status: 404 });
    }
    
    // 如果已找到并移除评论，更新KV中的数据
    await env.blog_data.put(kvKey, JSON.stringify(comments));
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: '评论已成功删除',
      remainingComments: comments.length
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('删除评论时出错:', error);
    return new Response('内部服务器错误', { status: 500 });
  }
} 