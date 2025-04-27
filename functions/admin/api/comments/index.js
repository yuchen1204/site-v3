/**
 * GET /admin/api/comments
 * 获取所有文章的评论，按文章ID分组
 */
async function handleGet(context) {
  const { env } = context;
  const allComments = {};

  try {
    // 1. 获取有评论的文章ID列表
    const listKey = 'commented_post_ids';
    let commentedPostIds = [];
    const listJson = await env.blog_data.get(listKey);
    if (listJson) {
      try {
        commentedPostIds = JSON.parse(listJson);
      } catch (e) {
        console.error('Error parsing commented_post_ids:', e);
        return new Response('Failed to parse commented post IDs', { status: 500 });
      }
    }

    if (commentedPostIds.length === 0) {
        return new Response(JSON.stringify({}), { // 返回空对象
          headers: { 'Content-Type': 'application/json' },
        });
    }

    // 2. 并发获取所有相关文章的评论
    const commentPromises = commentedPostIds.map(async (postId) => {
      const kvKey = `comments:${postId}`;
      const commentsJson = await env.blog_data.get(kvKey);
      if (commentsJson) {
        try {
          const comments = JSON.parse(commentsJson);
          // 按时间戳降序排序
          comments.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
          return { postId, comments };
        } catch (e) {
          console.error(`Error parsing comments for post ${postId}:`, e);
          return { postId, comments: [] }; // 出错时返回空数组
        }
      }
      return { postId, comments: [] }; // KV中无数据时返回空数组
    });

    const results = await Promise.all(commentPromises);

    // 3. 构建最终的按 postId 分组的对象
    results.forEach(({ postId, comments }) => {
      if (comments.length > 0) { // 只添加有评论的文章
          allComments[postId] = comments;
      }
    });

    return new Response(JSON.stringify(allComments), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error fetching all comments:', error);
    return new Response('Failed to fetch comments', { status: 500 });
  }
}

/**
 * DELETE /admin/api/comments
 * 删除指定文章的指定评论
 * 需要 postId 和 commentId 参数 (可以通过查询参数或请求体传递)
 */
async function handleDelete(context) {
  const { request, env } = context;
  let postId, commentId;

  try {
    // 尝试从查询参数获取
    const url = new URL(request.url);
    postId = url.searchParams.get('postId');
    commentId = url.searchParams.get('commentId');

    // 如果查询参数没有，尝试从请求体获取 (适用于某些前端实现)
    if (!postId || !commentId) {
        try {
            const data = await request.json();
            postId = postId || data.postId;
            commentId = commentId || data.commentId;
        } catch (e) {
            // 不是 JSON 请求体，忽略错误，继续检查参数
        }
    }

    if (!postId || !commentId) {
      return new Response('Missing postId or commentId parameter', { status: 400 });
    }

    const kvKey = `comments:${postId}`;

    // 1. 获取当前文章的评论列表
    const existingCommentsJson = await env.blog_data.get(kvKey);
    if (!existingCommentsJson) {
      return new Response('No comments found for this post', { status: 404 });
    }

    let comments = [];
    try {
      comments = JSON.parse(existingCommentsJson);
    } catch (e) {
      console.error(`Error parsing comments for post ${postId} during delete:`, e);
      return new Response('Failed to parse existing comments', { status: 500 });
    }

    // 2. 过滤掉要删除的评论
    const initialLength = comments.length;
    const updatedComments = comments.filter(comment => comment.id !== commentId);

    if (updatedComments.length === initialLength) {
      return new Response('Comment not found', { status: 404 });
    }

    // 3. 将更新后的列表写回 KV
    if (updatedComments.length > 0) {
        await env.blog_data.put(kvKey, JSON.stringify(updatedComments));
    } else {
        // 如果删除后列表为空，则删除该文章的评论键，并从 commented_post_ids 中移除
        await env.blog_data.delete(kvKey);

        const listKey = 'commented_post_ids';
        const listJson = await env.blog_data.get(listKey);
        if (listJson) {
            try {
                let commentedPostIds = JSON.parse(listJson);
                commentedPostIds = commentedPostIds.filter(id => id !== parseInt(postId, 10)); // 确保比较的是数字
                await env.blog_data.put(listKey, JSON.stringify(commentedPostIds));
            } catch (e) {
                console.error('Error updating commented_post_ids after delete:', e);
                // 即使更新列表失败，也继续返回成功，因为评论已删除
            }
        }
    }

    return new Response(JSON.stringify({ success: true, message: 'Comment deleted successfully' }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error deleting comment:', error);
    return new Response('Failed to delete comment', { status: 500 });
  }
}

export async function onRequest(context) {
  switch (context.request.method) {
    case 'GET':
      return handleGet(context);
    case 'DELETE':
      return handleDelete(context);
    case 'OPTIONS': // 处理 CORS 预检请求
      return new Response(null, {
          status: 204,
          headers: {
              'Access-Control-Allow-Origin': '*', // 生产环境应设为你的后台域名
              'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type, Authorization', // 如果你的后台需要认证，加上 Authorization
              'Access-Control-Max-Age': '86400',
          },
      });
    default:
      return new Response('Method Not Allowed', { status: 405 });
  }
} 