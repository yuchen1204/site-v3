/**
 * 管理员评论管理API
 * 
 * 支持以下操作:
 * - GET: 获取所有评论（包括未审核的）
 * - PUT: 批量更新评论状态（批准或拒绝）
 * - DELETE: 删除评论
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
  
  // 验证管理员权限
  const isAdmin = await validateAdminAuth(request, env);
  if (!isAdmin) {
    return new Response(JSON.stringify({
      success: false,
      error: '未授权的访问'
    }), {
      status: 401,
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
        'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400'
      }
    });
  }
  
  // 根据请求方法处理不同操作
  try {
    if (request.method === 'GET') {
      return await handleGetAllComments(request, kv);
    } else if (request.method === 'PUT') {
      return await handleUpdateCommentStatus(request, kv);
    } else if (request.method === 'DELETE') {
      return await handleDeleteComments(request, kv);
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
    console.error('处理管理员评论请求失败:', error);
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
 * 验证管理员权限
 * @param {Request} request - 请求对象
 * @param {Object} env - 环境变量
 * @returns {boolean} 是否为管理员
 */
async function validateAdminAuth(request, env) {
  try {
    // 从请求头获取认证Token
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return false;
    }
    
    const token = authHeader.replace('Bearer ', '').trim();
    
    // 检查Token是否有效（实际项目中应使用更安全的方法）
    // 例如，可以检查令牌是否存在于KV存储中的有效管理员令牌列表中
    // 或者使用JWT进行验证
    
    // 简单示例：比对环境变量中设置的管理员令牌
    const adminToken = env.ADMIN_API_TOKEN;
    if (!adminToken) {
      console.error('未配置管理员API令牌');
      return false;
    }
    
    return token === adminToken;
  } catch (error) {
    console.error('验证管理员权限失败:', error);
    return false;
  }
}

/**
 * 处理获取所有评论请求
 * @param {Request} request - 请求对象
 * @param {KVNamespace} kv - KV存储
 */
async function handleGetAllComments(request, kv) {
  try {
    const url = new URL(request.url);
    const postId = url.searchParams.get('postId');
    const status = url.searchParams.get('status'); // approved, pending, rejected
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);
    
    let allComments = [];
    
    // 如果指定了文章ID，只获取该文章的评论
    if (postId) {
      const commentsKey = `post:${postId}:comments`;
      const postComments = await kv.get(commentsKey, { type: 'json' }) || [];
      allComments = postComments;
    } else {
      // 列出所有评论
      // 获取所有以"post:"开头的键
      const { keys } = await kv.list({ prefix: 'post:' });
      
      // 获取每个键的评论
      for (const key of keys) {
        if (key.name.includes(':comments')) {
          const comments = await kv.get(key.name, { type: 'json' }) || [];
          allComments = allComments.concat(comments);
        }
      }
    }
    
    // 根据状态过滤
    if (status) {
      if (status === 'approved') {
        allComments = allComments.filter(comment => comment.approved === true);
      } else if (status === 'pending') {
        allComments = allComments.filter(comment => !comment.approved && !comment.rejected);
      } else if (status === 'rejected') {
        allComments = allComments.filter(comment => comment.rejected === true);
      }
    }
    
    // 按日期降序排序
    allComments.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // 分页
    const totalComments = allComments.length;
    const totalPages = Math.ceil(totalComments / limit);
    const startIndex = (page - 1) * limit;
    const pagedComments = allComments.slice(startIndex, startIndex + limit);
    
    return new Response(JSON.stringify({
      success: true,
      comments: pagedComments,
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
    console.error('获取所有评论失败:', error);
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
 * 处理更新评论状态请求
 * @param {Request} request - 请求对象
 * @param {KVNamespace} kv - KV存储
 */
async function handleUpdateCommentStatus(request, kv) {
  try {
    const requestData = await request.json();
    
    // 验证必要字段
    if (!requestData.commentIds || !Array.isArray(requestData.commentIds) || !requestData.action) {
      return new Response(JSON.stringify({
        success: false,
        error: '缺少必要参数：commentIds（数组）和action（approve或reject）'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
      });
    }
    
    // 验证操作类型
    if (requestData.action !== 'approve' && requestData.action !== 'reject') {
      return new Response(JSON.stringify({
        success: false,
        error: 'action参数必须是approve或reject'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
      });
    }
    
    const { commentIds, action } = requestData;
    const postId = requestData.postId; // 可选参数
    
    // 更新评论状态
    let updatedCount = 0;
    
    if (postId) {
      // 如果指定了文章ID，只在该文章的评论中查找
      const commentsKey = `post:${postId}:comments`;
      let comments = await kv.get(commentsKey, { type: 'json' }) || [];
      
      // 更新符合条件的评论
      let hasChanges = false;
      comments = comments.map(comment => {
        if (commentIds.includes(comment.id)) {
          hasChanges = true;
          updatedCount++;
          
          if (action === 'approve') {
            return { ...comment, approved: true, rejected: false };
          } else if (action === 'reject') {
            return { ...comment, approved: false, rejected: true };
          }
        }
        return comment;
      });
      
      // 保存更新后的评论
      if (hasChanges) {
        await kv.put(commentsKey, JSON.stringify(comments));
      }
    } else {
      // 如果没有指定文章ID，需要在所有评论中查找
      const { keys } = await kv.list({ prefix: 'post:' });
      
      for (const key of keys) {
        if (key.name.includes(':comments')) {
          let comments = await kv.get(key.name, { type: 'json' }) || [];
          
          // 检查这个文章的评论是否包含目标ID
          const targetComments = comments.filter(comment => commentIds.includes(comment.id));
          
          if (targetComments.length > 0) {
            // 更新评论状态
            comments = comments.map(comment => {
              if (commentIds.includes(comment.id)) {
                updatedCount++;
                
                if (action === 'approve') {
                  return { ...comment, approved: true, rejected: false };
                } else if (action === 'reject') {
                  return { ...comment, approved: false, rejected: true };
                }
              }
              return comment;
            });
            
            // 保存更新后的评论
            await kv.put(key.name, JSON.stringify(comments));
          }
        }
      }
    }
    
    return new Response(JSON.stringify({
      success: true,
      message: action === 'approve' ? '评论批准成功' : '评论拒绝成功',
      updatedCount
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
    });
  } catch (error) {
    console.error('更新评论状态失败:', error);
    return new Response(JSON.stringify({
      success: false,
      error: '更新评论状态失败'
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
 * 处理删除评论请求
 * @param {Request} request - 请求对象
 * @param {KVNamespace} kv - KV存储
 */
async function handleDeleteComments(request, kv) {
  try {
    const url = new URL(request.url);
    const commentIds = url.searchParams.get('commentIds')?.split(',') || [];
    const postId = url.searchParams.get('postId'); // 可选参数
    
    // 验证必要参数
    if (commentIds.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: '缺少必要参数：commentIds'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
      });
    }
    
    // 删除评论
    let deletedCount = 0;
    
    if (postId) {
      // 如果指定了文章ID，只在该文章的评论中删除
      const commentsKey = `post:${postId}:comments`;
      let comments = await kv.get(commentsKey, { type: 'json' }) || [];
      
      // 过滤出不需要删除的评论
      const originalCount = comments.length;
      comments = comments.filter(comment => !commentIds.includes(comment.id));
      deletedCount = originalCount - comments.length;
      
      // 保存更新后的评论
      await kv.put(commentsKey, JSON.stringify(comments));
    } else {
      // 如果没有指定文章ID，需要在所有评论中查找并删除
      const { keys } = await kv.list({ prefix: 'post:' });
      
      for (const key of keys) {
        if (key.name.includes(':comments')) {
          let comments = await kv.get(key.name, { type: 'json' }) || [];
          
          // 检查这个文章的评论是否包含目标ID
          const hasTargetComment = comments.some(comment => commentIds.includes(comment.id));
          
          if (hasTargetComment) {
            // 过滤出不需要删除的评论
            const originalCount = comments.length;
            comments = comments.filter(comment => !commentIds.includes(comment.id));
            deletedCount += (originalCount - comments.length);
            
            // 保存更新后的评论
            await kv.put(key.name, JSON.stringify(comments));
          }
        }
      }
    }
    
    return new Response(JSON.stringify({
      success: true,
      message: '评论删除成功',
      deletedCount
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
    });
  } catch (error) {
    console.error('删除评论失败:', error);
    return new Response(JSON.stringify({
      success: false,
      error: '删除评论失败'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
    });
  }
} 