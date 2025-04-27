/**
 * Cloudflare Pages Function for retrieving a single blog post data
 * 
 * GET /api/blog/post/[id] - Get a single blog post by ID
 */

// Helper function to get blog posts from KV
async function getBlogPosts(env) {
    const jsonString = await env.blog_data.get('blog');
    try {
        return jsonString ? JSON.parse(jsonString) : [];
    } catch (e) {
        console.error("Error parsing blog data from KV:", e);
        return [];
    }
}

// Helper function for consistent JSON responses
function jsonResponse(data, status = 200, headers = {}) {
    return new Response(JSON.stringify(data), {
        status: status,
        headers: {
            'Content-Type': 'application/json;charset=UTF-8',
             // Add cache control for public API
            'Cache-Control': 'public, max-age=60',
            ...headers
        }
    });
}

// Handle GET /api/blog/post/[id]
async function handleGetPost(context) {
    const { env, params } = context;
    const postId = parseInt(params.id, 10);

    if (isNaN(postId)) {
        return jsonResponse({ error: '无效的文章 ID' }, 400);
    }

    try {
        const posts = await getBlogPosts(env);
        const post = posts.find(p => p.id === postId);

        if (!post) {
            return jsonResponse({ error: '找不到指定 ID 的文章' }, 404);
        }
        
        // 只返回需要的数据给前端，避免暴露不必要信息
        const { email, ...postForPublic } = post;
        return jsonResponse(postForPublic);

    } catch (error) {
        console.error(`Error getting blog post ${postId}:`, error);
        return jsonResponse({ error: '获取文章详情失败' }, 500);
    }
}

// Main onRequest handler for routes like /api/blog/post/[id]
export async function onRequest(context) {
    const { request } = context;

    if (request.method === 'GET') {
        return handleGetPost(context);
    }

    // Method Not Allowed for this specific resource path
    return jsonResponse({ error: `方法 ${request.method} 不被允许` }, 405, {
        'Allow': 'GET'
    });
} 