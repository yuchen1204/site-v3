/**
 * Cloudflare Pages Function for handling Comments API
 * - GET /api/comments/[postId] - Fetches comments for a post
 * - POST /api/comments/[postId] - Submits a new comment for a post
 */

// Helper function for consistent JSON responses
function jsonResponse(data, status = 200, headers = {}) {
    return new Response(JSON.stringify(data), {
        status: status,
        headers: {
            'Content-Type': 'application/json;charset=UTF-8',
            ...headers
        }
    });
}

// Helper function to get comments from KV
async function getComments(env, postId) {
    const key = `comments:${postId}`;
    const jsonString = await env.blog_data.get(key);
    try {
        return jsonString ? JSON.parse(jsonString) : [];
    } catch (e) {
        console.error(`Error parsing comments for post ${postId} from KV:`, e);
        return []; // Return empty array on parsing error
    }
}

// Handle GET requests - Fetch comments
async function handleGet(context) {
    const { env, params } = context;
    const postId = parseInt(params.id, 10);

    if (isNaN(postId)) {
        return jsonResponse({ error: '无效的文章ID' }, 400);
    }

    try {
        const comments = await getComments(env, postId);
        // Sort comments by timestamp, newest first
        comments.sort((a, b) => b.timestamp - a.timestamp);
        return jsonResponse(comments);
    } catch (error) {
        console.error(`Error fetching comments for post ${postId}:`, error);
        return jsonResponse({ error: '无法获取评论' }, 500);
    }
}

// Handle POST requests - Submit a new comment
async function handlePost(context) {
    const { request, env, params } = context;
    const postId = parseInt(params.id, 10);

    if (isNaN(postId)) {
        return jsonResponse({ error: '无效的文章ID' }, 400);
    }

    try {
        const { name, text } = await request.json();

        // Basic validation
        if (!name || !text || name.trim() === '' || text.trim() === '') {
            return jsonResponse({ error: '昵称和评论内容不能为空' }, 400);
        }

        // Simple sanitization (more robust needed for production)
        const sanitizedName = name.replace(/</g, "&lt;").replace(/>/g, "&gt;").trim();
        const sanitizedText = text.replace(/</g, "&lt;").replace(/>/g, "&gt;").trim();
        
        if (sanitizedName.length > 50 || sanitizedText.length > 1000) {
             return jsonResponse({ error: '昵称或评论内容过长' }, 400);
        }

        const newComment = {
            id: Date.now(), // Use timestamp as a simple unique ID for the comment
            name: sanitizedName,
            text: sanitizedText,
            timestamp: Date.now()
        };

        const comments = await getComments(env, postId);
        comments.push(newComment);

        // Store comments back to KV
        const key = `comments:${postId}`;
        // Consider TTL if needed, e.g., expirationTtl: 2592000 (30 days)
        await env.blog_data.put(key, JSON.stringify(comments)); 

        // Return the newly created comment
        return jsonResponse(newComment, 201); // 201 Created

    } catch (error) {
        console.error(`Error submitting comment for post ${postId}:`, error);
        if (error instanceof SyntaxError) { // JSON parsing error
            return jsonResponse({ error: '无效的请求数据格式' }, 400);
        }
        return jsonResponse({ error: '提交评论失败' }, 500);
    }
}


// Main onRequest handler to route requests based on method
export async function onRequest(context) {
    switch (context.request.method) {
        case 'GET':
            return handleGet(context);
        case 'POST':
            return handlePost(context);
        default:
            return jsonResponse({ error: `方法 ${context.request.method} 不被允许` }, 405);
    }
} 