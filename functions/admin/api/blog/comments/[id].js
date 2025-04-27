/**
 * Cloudflare Pages Function for managing blog post comments (Admin)
 * 
 * GET /admin/api/blog/comments/[id] - Get all comments for a post (including pending)
 * PUT /admin/api/blog/comments/[id] - Update comment status
 * DELETE /admin/api/blog/comments/[id] - Delete a comment
 */

// 错误类型定义
const ErrorTypes = {
    INVALID_INPUT: 'INVALID_INPUT',
    NOT_FOUND: 'NOT_FOUND',
    UNAUTHORIZED: 'UNAUTHORIZED',
    SERVER_ERROR: 'SERVER_ERROR'
};

// 错误消息映射
const ErrorMessages = {
    [ErrorTypes.INVALID_INPUT]: {
        status: 400,
        message: '无效的输入参数'
    },
    [ErrorTypes.NOT_FOUND]: {
        status: 404,
        message: '找不到指定的资源'
    },
    [ErrorTypes.UNAUTHORIZED]: {
        status: 401,
        message: '未授权的操作'
    },
    [ErrorTypes.SERVER_ERROR]: {
        status: 500,
        message: '服务器内部错误'
    }
};

// 自定义错误类
class ApiError extends Error {
    constructor(type, message) {
        super(message || ErrorMessages[type].message);
        this.type = type;
        this.status = ErrorMessages[type].status;
    }
}

// Helper function to get comments for a post
async function getComments(env, postId) {
    try {
        const key = `comments:${postId}`;
        const comments = await env.blog_data.get(key, { type: 'json' });
        return comments || [];
    } catch (error) {
        console.error('获取评论失败:', error);
        throw new ApiError(ErrorTypes.SERVER_ERROR, '获取评论数据失败');
    }
}

// Helper function to save comments
async function saveComments(env, postId, comments) {
    try {
        const key = `comments:${postId}`;
        await env.blog_data.put(key, JSON.stringify(comments));
    } catch (error) {
        console.error('保存评论失败:', error);
        throw new ApiError(ErrorTypes.SERVER_ERROR, '保存评论数据失败');
    }
}

// Helper function for consistent JSON responses
function jsonResponse(data, status = 200, headers = {}) {
    return new Response(JSON.stringify(data), {
        status: status,
        headers: {
            'Content-Type': 'application/json;charset=UTF-8',
            'Cache-Control': 'no-cache',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            ...headers
        }
    });
}

// 验证评论ID
function validateCommentId(commentId) {
    if (!commentId || isNaN(parseInt(commentId))) {
        throw new ApiError(ErrorTypes.INVALID_INPUT, '无效的评论ID');
    }
}

// 验证文章ID
function validatePostId(postId) {
    if (!postId || isNaN(parseInt(postId))) {
        throw new ApiError(ErrorTypes.INVALID_INPUT, '无效的文章ID');
    }
    return parseInt(postId);
}

// 验证评论状态
function validateCommentStatus(status) {
    const validStatuses = ['approved', 'rejected', 'pending'];
    if (!status || !validStatuses.includes(status)) {
        throw new ApiError(ErrorTypes.INVALID_INPUT, '无效的评论状态');
    }
}

// Handle GET request - Get all comments including pending ones
async function handleGetComments(context) {
    const { env, params } = context;
    
    try {
        const postId = validatePostId(params.id);
        const comments = await getComments(env, postId);
        return jsonResponse(comments);
    } catch (error) {
        if (error instanceof ApiError) {
            return jsonResponse({ error: error.message }, error.status);
        }
        return jsonResponse({ error: '获取评论失败' }, 500);
    }
}

// Handle PUT request - Update comment status
async function handleUpdateComment(context) {
    const { request, env, params } = context;
    
    try {
        const postId = validatePostId(params.id);
        const { commentId, status } = await request.json();
        
        validateCommentId(commentId);
        validateCommentStatus(status);
        
        const comments = await getComments(env, postId);
        const commentIndex = comments.findIndex(c => c.id === commentId);
        
        if (commentIndex === -1) {
            throw new ApiError(ErrorTypes.NOT_FOUND, '找不到指定的评论');
        }
        
        // 更新评论状态
        comments[commentIndex].status = status;
        comments[commentIndex].updatedAt = new Date().toISOString();
        
        await saveComments(env, postId, comments);
        return jsonResponse(comments[commentIndex]);
    } catch (error) {
        if (error instanceof ApiError) {
            return jsonResponse({ error: error.message }, error.status);
        }
        if (error instanceof SyntaxError) {
            return jsonResponse({ error: '无效的请求数据格式' }, 400);
        }
        return jsonResponse({ error: '更新评论状态失败' }, 500);
    }
}

// Handle DELETE request - Delete a comment
async function handleDeleteComment(context) {
    const { request, env, params } = context;
    
    try {
        const postId = validatePostId(params.id);
        const url = new URL(request.url);
        const commentId = url.searchParams.get('commentId');
        
        validateCommentId(commentId);
        
        let comments = await getComments(env, postId);
        const initialLength = comments.length;
        
        comments = comments.filter(c => c.id !== parseInt(commentId));
        
        if (comments.length === initialLength) {
            throw new ApiError(ErrorTypes.NOT_FOUND, '找不到指定的评论');
        }
        
        await saveComments(env, postId, comments);
        return new Response(null, { 
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS'
            }
        });
    } catch (error) {
        if (error instanceof ApiError) {
            return jsonResponse({ error: error.message }, error.status);
        }
        return jsonResponse({ error: '删除评论失败' }, 500);
    }
}

// Handle OPTIONS request for CORS
function handleOptions() {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '86400'
        }
    });
}

// Main request handler
export async function onRequest(context) {
    const { request } = context;
    
    // 处理 CORS 预检请求
    if (request.method === 'OPTIONS') {
        return handleOptions();
    }
    
    try {
        switch (request.method) {
            case 'GET':
                return handleGetComments(context);
            case 'PUT':
                return handleUpdateComment(context);
            case 'DELETE':
                return handleDeleteComment(context);
            default:
                return jsonResponse({ error: '不支持的请求方法' }, 405);
        }
    } catch (error) {
        console.error('请求处理失败:', error);
        return jsonResponse({ error: '服务器内部错误' }, 500);
    }
} 