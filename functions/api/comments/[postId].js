/**
 * 获取特定文章的评论
 * 
 * 路由: /api/comments/:postId
 * 方法: GET
 * 查询参数:
 *   - page: 页码，默认1
 *   - limit: 每页评论数，默认5
 * 
 * @param {Request} request
 * @param {Object} env 环境变量，包含KV绑定
 * @returns {Response} 包含评论列表的Response对象
 */
export async function onRequest(context) {
  try {
    const { request, params, env } = context;
    const { postId } = params;
    
    // 验证postId是否有效
    if (!postId || isNaN(parseInt(postId))) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: '无效的文章ID' 
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 解析查询参数
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '5');
    
    // 验证分页参数
    if (page < 1 || limit < 1 || limit > 20) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: '无效的分页参数' 
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 从KV获取评论
    const commentsKey = `comments:${postId}`;
    const commentsJson = await env.blog_data.get(commentsKey);
    let allComments = commentsJson ? JSON.parse(commentsJson) : [];
    
    // 按时间倒序排序
    allComments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // 计算分页
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const comments = allComments.slice(startIndex, endIndex);

    return new Response(
      JSON.stringify({
        success: true,
        comments,
        page,
        limit,
        total: allComments.length,
        totalPages: Math.ceil(allComments.length / limit)
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('获取评论失败:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: '服务器内部错误' 
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
} 