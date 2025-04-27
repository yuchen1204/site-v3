/**
 * 删除指定评论（管理员接口）
 * 
 * 路由: /api/comments/delete
 * 方法: POST
 * 请求体:
 *   - postId: 文章ID
 *   - commentId: 评论ID
 * 
 * @param {Request} request
 * @param {Object} env 环境变量，包含KV绑定
 * @returns {Response} 删除结果的Response对象
 */
export async function onRequest(context) {
  try {
    const { request, env } = context;
    
    // 只接受POST请求
    if (request.method !== 'POST') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: '仅支持POST请求' 
        }),
        {
          status: 405,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    // TODO: 实现管理员身份验证
    // 这是一个管理员接口，正式环境应添加身份验证

    // 解析请求体
    let requestData;
    try {
      requestData = await request.json();
    } catch (error) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: '无效的请求体' 
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const { postId, commentId } = requestData;

    // 验证必填字段
    if (!postId || !commentId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: '缺少必填字段' 
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 验证postId是否为有效数字
    if (isNaN(parseInt(postId))) {
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

    // 从KV获取现有评论
    const commentsKey = `comments:${postId}`;
    const commentsJson = await env.blog_data.get(commentsKey);
    
    if (!commentsJson) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: '未找到该文章的评论' 
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    let comments = JSON.parse(commentsJson);
    
    // 查找并移除指定评论
    const commentIndex = comments.findIndex(c => c.id === commentId);
    
    if (commentIndex === -1) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: '未找到指定评论' 
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    // 移除评论
    comments.splice(commentIndex, 1);
    
    // 保存到KV
    await env.blog_data.put(commentsKey, JSON.stringify(comments));

    return new Response(
      JSON.stringify({
        success: true,
        message: '评论已成功删除'
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('删除评论失败:', error);
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