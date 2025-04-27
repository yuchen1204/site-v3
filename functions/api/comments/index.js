/**
 * POST /api/comments
 * 提交新的评论
 */
export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const commentData = await request.json();

    // 基本验证
    if (!commentData.postId || !commentData.author || !commentData.text) {
      return new Response('Missing required comment fields (postId, author, text)', { status: 400 });
    }

    const postId = commentData.postId;
    const kvKey = `comments:${postId}`;

    // 获取现有的评论列表
    let comments = [];
    const existingCommentsJson = await env.blog_data.get(kvKey);
    if (existingCommentsJson) {
      try {
        comments = JSON.parse(existingCommentsJson);
      } catch (e) {
        console.error(`Error parsing existing comments for post ${postId}:`, e);
        // 如果解析失败，我们可以选择覆盖或返回错误，这里选择继续并可能覆盖旧数据
        comments = [];
      }
    }

    // 创建新评论对象
    const newComment = {
      id: crypto.randomUUID(), // 添加唯一ID，便于未来管理
      author: commentData.author.trim(),
      text: commentData.text.trim(),
      timestamp: new Date().toISOString(),
    };

    // 添加新评论到列表
    comments.push(newComment);

    // 将更新后的评论列表存回KV
    // 注意：KV写入是最终一致性的
    await env.blog_data.put(kvKey, JSON.stringify(comments));

    // 返回成功响应，可以包含新评论的数据
    return new Response(JSON.stringify({ success: true, comment: newComment }), {
      headers: { 'Content-Type': 'application/json' },
      status: 201 // Created
    });

  } catch (error) {
    console.error('Error submitting comment:', error);
    // 避免在响应中暴露过多错误细节
    if (error instanceof SyntaxError) {
        return new Response('Invalid JSON format in request body', { status: 400 });
    }
    return new Response('Failed to submit comment', { status: 500 });
  }
}

// 处理 OPTIONS 请求 (CORS 预检请求)
export async function onRequestOptions(context) {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*', // 允许所有来源，生产环境应更严格
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400', // 24 hours
    },
  });
} 