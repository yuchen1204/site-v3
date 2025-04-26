/**
 * Cloudflare Pages Function for fetching a single public blog post by ID
 * 
 * GET /api/blog/[id]
 */

// --- Helper Functions (Similar to admin API, but could be shared) ---

async function getBlogPosts(env) {
    const jsonString = await env.blog_data.get('blog');
    try {
        return jsonString ? JSON.parse(jsonString) : [];
    } catch (e) {
        console.error("Error parsing blog data from KV:", e);
        return [];
    }
}

function jsonResponse(data, status = 200, headers = {}) {
    return new Response(JSON.stringify(data), {
        status: status,
        headers: {
            'Content-Type': 'application/json;charset=UTF-8',
            // Add CORS headers if needed for cross-origin requests, 
            // although same-origin requests from the Pages site itself shouldn't need it.
            // 'Access-Control-Allow-Origin': '*', 
            ...headers
        }
    });
}

// --- Request Handler for Public Single Item --- 

// Handle GET /api/blog/[id] (Get one public)
async function handleGetOnePublic(context) {
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
        
        // Optionally filter/transform data before sending to public
        // For now, send the full post data
        return jsonResponse(post);

    } catch (error) {
        console.error(`Error getting public blog post ${postId}:`, error);
        return jsonResponse({ error: '获取文章详情失败' }, 500);
    }
}

export async function onRequestGet(context) {
    // This function specifically handles GET requests due to the filename convention
    // or explicit onRequestGet export.
    return handleGetOnePublic(context);
}

// Fallback for other methods (optional, Cloudflare might handle this)
export async function onRequest(context) {
     if (context.request.method !== 'GET') {
         return jsonResponse({ error: `方法 ${context.request.method} 不被允许` }, 405);
     }
     // Should ideally not be reached if onRequestGet is defined and used
     return jsonResponse({ error: '无效请求' }, 400);
} 