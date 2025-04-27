/**
 * GET /api/comments/[id]
 * 获取指定文章ID的评论列表
 */
export async function onRequestGet(context) {
  try {
    const { params, env } = context;
    const postId = params.id;

    if (!postId) {
      return new Response('Missing post ID', { status: 400 });
    }

    // 从KV获取评论列表
    // 键名格式: comments:{postId}
    const kvKey = `comments:${postId}`;
    const commentsJson = await env.blog_data.get(kvKey);

    let comments = [];
    if (commentsJson) {
      try {
        comments = JSON.parse(commentsJson);
        // 按时间戳降序排序，最新的评论在前
        comments.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      } catch (e) {
        console.error(`Error parsing comments for post ${postId}:`, e);
        // 如果解析失败，返回空列表，而不是抛出错误
        comments = [];
      }
    }

    return new Response(JSON.stringify(comments), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error fetching comments:', error);
    return new Response('Failed to fetch comments', { status: 500 });
  }
} 