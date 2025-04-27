/**
 * Cloudflare Pages Function for handling blog post comments
 * 
 * GET /api/blog/comments/[id] - Get comments for a blog post
 * POST /api/blog/comments/[id] - Add a new comment to a blog post
 */

// Helper function to get comments for a post
async function getComments(env, postId) {
    const key = `comments:${postId}`;
    const comments = await env.blog_data.get(key, { type: 'json' });
    return comments || [];
}

// Helper function to save comments
async function saveComments(env, postId, comments) {
    const key = `comments:${postId}`;
    await env.blog_data.put(key, JSON.stringify(comments));
}

// Helper function for consistent JSON responses
function jsonResponse(data, status = 200, headers = {}) {
    return new Response(JSON.stringify(data), {
        status: status,
        headers: {
            'Content-Type': 'application/json;charset=UTF-8',
            'Cache-Control': 'no-cache',
            ...headers
        }
    });
}

// Helper function to get a single post's data
async function getPostData(env, postId) {
    const key = `post:${postId}`; // Assuming posts might be stored individually or use a function to fetch from the main 'blog' key
    // This needs to be adapted based on how you actually fetch *single* post data efficiently
    // For now, let's fetch all posts and find the specific one. Not ideal for performance.
    const blogKey = 'blog';
    const postsJson = await env.blog_data.get(blogKey);
    if (!postsJson) return null;
    try {
        const posts = JSON.parse(postsJson);
        return posts.find(p => p.id === postId);
    } catch (e) {
        console.error("Error parsing blog data for getPostData:", e);
        return null;
    }
}

// Handle GET request - Fetch comments for a post
async function handleGetComments(context) {
    const { env, params } = context;
    const postId = parseInt(params.id, 10);

    if (isNaN(postId)) {
        return jsonResponse({ error: '无效的文章ID' }, 400);
    }

    try {
        const comments = await getComments(env, postId);
        return jsonResponse(comments);
    } catch (error) {
        console.error('获取评论失败:', error);
        return jsonResponse({ error: '获取评论失败' }, 500);
    }
}

// Handle POST request - Add a new comment
async function handleAddComment(context) {
    const { request, env, params } = context;
    const postId = parseInt(params.id, 10);

    if (isNaN(postId)) {
        return jsonResponse({ error: '无效的文章ID' }, 400);
    }

    try {
        // --- 检查文章评论设置 ---
        const post = await getPostData(env, postId);
        if (!post) {
            return jsonResponse({ error: '找不到关联的文章' }, 404);
        }
        // 检查评论是否启用 (使用 ?? true 处理旧数据)
        if (!(post.commentsEnabled ?? true)) { 
            return jsonResponse({ error: '此文章已关闭评论' }, 403); // 403 Forbidden
        }
        // 确定是否需要审核 (使用 ?? true 处理旧数据)
        const needsModeration = post.moderationEnabled ?? true;
        // ------

        const { name, email, content } = await request.json();

        // 基本验证
        if (!name || !email || !content) {
            return jsonResponse({ error: '缺少必要字段' }, 400);
        }

        if (name.length > 50) {
            return jsonResponse({ error: '昵称过长' }, 400);
        }

        if (content.length > 1000) {
            return jsonResponse({ error: '评论内容过长' }, 400);
        }

        // 验证邮箱格式
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return jsonResponse({ error: '邮箱格式不正确' }, 400);
        }

        // 获取现有评论
        const comments = await getComments(env, postId);

        // 创建新评论
        const newComment = {
            id: Date.now(), // 使用时间戳作为评论ID
            name,
            email, // 邮箱将被保存但不会返回给前端
            content,
            createdAt: new Date().toISOString(),
            // 根据文章设置决定初始状态
            status: needsModeration ? 'pending' : 'approved' 
        };

        // 添加新评论
        comments.push(newComment);
        await saveComments(env, postId, comments);

        // 返回评论时排除邮箱字段
        const { email: _, ...commentWithoutEmail } = newComment;
        return jsonResponse(commentWithoutEmail, 201);

    } catch (error) {
        console.error('添加评论失败:', error);
        if (error instanceof SyntaxError) {
            return jsonResponse({ error: '无效的请求数据格式' }, 400);
        }
        return jsonResponse({ error: '添加评论失败' }, 500);
    }
}

// Main request handler
export async function onRequest(context) {
    const { request } = context;

    switch (request.method) {
        case 'GET':
            return handleGetComments(context);
        case 'POST':
            return handleAddComment(context);
        default:
            return jsonResponse({ error: '不支持的请求方法' }, 405);
    }
} 