/**
 * 博客评论API
 * 
 * 支持以下操作:
 * - GET: 获取特定文章的已批准评论
 * - POST: 提交新评论（需要审核）
 */

// KV命名空间
const COMMENTS_NAMESPACE = 'BLOG_COMMENTS';

/**
 * 请求处理入口
 * @param {Object} context - 请求上下文
 */
export async function onRequest(context) {
  const { request, env } = context;
  
  // 获取KV实例
  const kv = env[COMMENTS_NAMESPACE];
  if (!kv) {
    return new Response(JSON.stringify({
      success: false,
      error: 'KV存储未配置'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
    });
  }
  
  // 处理CORS预检请求
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400'
      }
    });
  }
  
  // 根据请求方法处理不同操作
  try {
    if (request.method === 'GET') {
      return await handleGetComments(request, kv);
    } else if (request.method === 'POST') {
      return await handlePostComment(request, kv, env);
    } else {
      return new Response(JSON.stringify({
        success: false,
        error: '不支持的请求方法'
      }), {
        status: 405,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
      });
    }
  } catch (error) {
    console.error('处理评论请求失败:', error);
    return new Response(JSON.stringify({
      success: false,
      error: '处理请求时发生错误'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
    });
  }
}

/**
 * 处理获取评论请求
 * @param {Request} request - 请求对象
 * @param {KVNamespace} kv - KV存储
 */
async function handleGetComments(request, kv) {
  const url = new URL(request.url);
  const postId = url.searchParams.get('postId');
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const limit = parseInt(url.searchParams.get('limit') || '10', 10);
  
  // 验证必要参数
  if (!postId) {
    return new Response(JSON.stringify({
      success: false,
      error: '缺少必要参数：postId'
    }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
    });
  }
  
  try {
    // 获取文章评论
    const commentsKey = `post:${postId}:comments`;
    let comments = await kv.get(commentsKey, { type: 'json' }) || [];
    
    // 只返回已批准的评论
    comments = comments.filter(comment => comment.approved === true);
    
    // 按日期降序排序
    comments.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // 分页
    const totalComments = comments.length;
    const totalPages = Math.ceil(totalComments / limit);
    const startIndex = (page - 1) * limit;
    const pagedComments = comments.slice(startIndex, startIndex + limit);
    
    // 移除敏感信息（如邮箱）
    const sanitizedComments = pagedComments.map(comment => ({
      id: comment.id,
      name: comment.name,
      content: comment.content,
      date: comment.date,
      website: comment.website
    }));
    
    return new Response(JSON.stringify({
      success: true,
      comments: sanitizedComments,
      pagination: {
        page,
        limit,
        totalComments,
        totalPages
      }
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
    });
  } catch (error) {
    console.error('获取评论失败:', error);
    return new Response(JSON.stringify({
      success: false,
      error: '获取评论失败'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
    });
  }
}

/**
 * 处理提交评论请求
 * @param {Request} request - 请求对象
 * @param {KVNamespace} kv - KV存储
 * @param {Object} env - 环境变量
 */
async function handlePostComment(request, kv, env) {
  try {
    const commentData = await request.json();
    
    // 验证必要字段
    if (!commentData.postId || !commentData.name || !commentData.email || !commentData.content) {
      return new Response(JSON.stringify({
        success: false,
        error: '缺少必要字段：postId、name、email、content'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
      });
    }
    
    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(commentData.email)) {
      return new Response(JSON.stringify({
        success: false,
        error: '邮箱格式不正确'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
      });
    }
    
    // 限制评论内容长度
    if (commentData.content.length > 2000) {
      return new Response(JSON.stringify({
        success: false,
        error: '评论内容过长，请限制在2000字符以内'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
      });
    }
    
    // 构建评论对象
    const newComment = {
      id: generateCommentId(),
      postId: commentData.postId,
      name: commentData.name,
      email: commentData.email, // 用于通知，不会公开显示
      website: commentData.website || '',
      content: commentData.content,
      date: new Date().toISOString(),
      approved: false, // 默认需要审核
      rejected: false,
      ip: request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown'
    };
    
    // 添加到KV存储
    const commentsKey = `post:${commentData.postId}:comments`;
    let comments = await kv.get(commentsKey, { type: 'json' }) || [];
    comments.push(newComment);
    await kv.put(commentsKey, JSON.stringify(comments));
    
    // 可选：发送管理员通知（例如，使用邮件或webhook）
    // 在实际项目中，可以添加通知逻辑
    
    return new Response(JSON.stringify({
      success: true,
      message: '评论已提交，等待审核后显示',
      commentId: newComment.id
    }), {
      status: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
    });
  } catch (error) {
    console.error('提交评论失败:', error);
    return new Response(JSON.stringify({
      success: false,
      error: '提交评论失败'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
    });
  }
}

/**
 * 生成唯一评论ID
 * @returns {string} 评论ID
 */
function generateCommentId() {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${randomStr}`;
} 