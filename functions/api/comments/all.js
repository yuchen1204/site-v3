/**
 * GET /api/comments/all
 * 获取所有评论列表 (需要权限验证)
 * 支持分页查询参数 page 和 limit
 */
export async function onRequestGet(context) {
  try {
    const { request, env } = context;
    
    // 这里应该有权限验证逻辑
    // 简单起见，这个示例不包含详细的权限验证
    
    // 获取URL参数
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = parseInt(url.searchParams.get('limit') || '10', 10);
    
    // 参数验证
    if (page < 1 || limit < 1 || limit > 50) {
      return new Response('无效的分页参数', { status: 400 });
    }
    
    // 先从KV中获取所有文章列表，为了获取标题信息
    const articlesJson = await env.blog_data.get('articles');
    let articlesMap = {};
    
    if (articlesJson) {
      const articles = JSON.parse(articlesJson);
      // 创建ID到标题的映射
      articlesMap = articles.reduce((map, article) => {
        map[article.id] = article.title;
        return map;
      }, {});
    }
    
    // 使用KV的列表功能获取所有评论键
    // 注意：如果评论数量很多，这种方法可能不是最佳选择
    // 为简化示例，假设评论数量在合理范围内
    const keys = await env.blog_data.list({ prefix: 'comments:' });
    
    // 用于存储所有评论的数组
    let allComments = [];
    
    // 遍历所有键，获取评论数据
    for (const key of keys.keys) {
      const postId = key.name.split(':')[1]; // 从键中提取文章ID
      const commentsJson = await env.blog_data.get(key.name);
      
      if (commentsJson) {
        try {
          const comments = JSON.parse(commentsJson);
          // 为每个评论添加文章信息
          comments.forEach(comment => {
            allComments.push({
              ...comment,
              postId: postId,
              postTitle: articlesMap[postId] || `文章 #${postId}`
            });
          });
        } catch (e) {
          console.error(`解析评论 ${key.name} 时出错:`, e);
        }
      }
    }
    
    // 按时间戳降序排序，最新的评论在前
    allComments.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // 计算分页
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedComments = allComments.slice(startIndex, endIndex);
    
    // 准备分页元数据
    const pagination = {
      total: allComments.length,
      page: page,
      limit: limit,
      totalPages: Math.ceil(allComments.length / limit)
    };
    
    return new Response(JSON.stringify({
      comments: paginatedComments,
      pagination: pagination
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('获取所有评论时出错:', error);
    return new Response('内部服务器错误', { status: 500 });
  }
} 