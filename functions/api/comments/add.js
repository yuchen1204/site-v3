/**
 * 添加评论到指定文章
 * 
 * 路由: /api/comments/add
 * 方法: POST
 * 请求体:
 *   - postId: 文章ID
 *   - name: 评论者昵称
 *   - content: 评论内容
 * 
 * @param {Request} request
 * @param {Object} env 环境变量，包含KV绑定
 * @returns {Response} 添加结果的Response对象
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

    const { postId, name, content } = requestData;

    // 验证必填字段
    if (!postId || !name || !content) {
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

    // 验证昵称长度
    if (name.length < 2 || name.length > 20) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: '昵称长度必须在2-20个字符之间' 
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 验证评论内容长度
    if (content.length < 2 || content.length > 500) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: '评论内容长度必须在2-500个字符之间' 
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
    let comments = commentsJson ? JSON.parse(commentsJson) : [];

    // 创建新评论
    const newComment = {
      id: generateCommentId(),
      postId: parseInt(postId),
      name,
      content,
      createdAt: new Date().toISOString()
    };

    // 添加到评论列表
    comments.push(newComment);

    // 保存到KV
    await env.blog_data.put(commentsKey, JSON.stringify(comments));

    return new Response(
      JSON.stringify({
        success: true,
        message: '评论添加成功',
        comment: newComment
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('添加评论失败:', error);
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

/**
 * 生成唯一的评论ID
 * @returns {string} 唯一ID
 */
function generateCommentId() {
  // 使用时间戳和随机数组合生成ID
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${randomStr}`;
} 