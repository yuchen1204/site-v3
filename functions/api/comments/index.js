/**
 * 获取所有文章的评论（管理员接口）
 * 
 * 路由: /api/comments
 * 方法: GET
 * 查询参数:
 *   - page: 页码，默认1
 *   - limit: 每页评论数，默认10
 * 
 * @param {Request} request
 * @param {Object} env 环境变量，包含KV绑定
 * @returns {Response} 包含所有评论的Response对象
 */
export async function onRequest(context) {
  try {
    const { request, env } = context;
    
    // TODO: 实现管理员身份验证
    // 这是一个管理员接口，正式环境应添加身份验证
    
    // 解析查询参数
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    
    // 验证分页参数
    if (page < 1 || limit < 1 || limit > 50) {
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

    // 列出所有KV键（以comments:开头的）
    const commentsKeys = [];
    let listComplete = false;
    let cursor = null;
    
    // 使用分页方式列出所有键
    while (!listComplete) {
      const listOptions = { prefix: 'comments:', cursor };
      const result = await env.blog_data.list(listOptions);
      
      for (const key of result.keys) {
        commentsKeys.push(key.name);
      }
      
      cursor = result.cursor;
      listComplete = result.list_complete;
    }
    
    // 获取所有评论
    const allCommentsPromises = commentsKeys.map(async (key) => {
      const commentsJson = await env.blog_data.get(key);
      const comments = commentsJson ? JSON.parse(commentsJson) : [];
      const postId = key.split(':')[1]; // 从键名中提取文章ID
      
      // 为每条评论添加文章ID
      return comments.map(comment => ({
        ...comment,
        postId: parseInt(postId)
      }));
    });
    
    // 等待所有Promise完成
    const allCommentsArrays = await Promise.all(allCommentsPromises);
    
    // 合并所有评论并按时间倒序排序
    let allComments = [].concat(...allCommentsArrays);
    allComments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // 计算分页
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedComments = allComments.slice(startIndex, endIndex);
    
    return new Response(
      JSON.stringify({
        success: true,
        comments: paginatedComments,
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
    console.error('获取所有评论失败:', error);
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