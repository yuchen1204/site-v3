/**
 * Cloudflare Pages Function for handling public requests for a single Blog Post
 * 
 * GET /api/blog/[id] - Get a single blog post by ID (Public Access)
 */

// --- Helper Functions (Similar to admin API, consider refactoring to a shared module later) ---

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
            ...headers
        }
    });
}

// --- Request Handler for Single Public Item --- 

// Handle GET /api/blog/[id] (Get one, public)
async function handleGetOnePublic(context) {
    const { env, params } = context;
    // params.id is automatically populated by Cloudflare based on the [id].js filename
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
        
        // For public API, potentially filter out internal fields if any exist in the future
        const publicPostData = {
            id: post.id,
            title: post.title,
            date: post.date,
            category: post.category,
            content: post.content,
            attachments: post.attachments,
            references: post.references
            // Add other public fields as needed
        };
        
        return jsonResponse(publicPostData);

    } catch (error) {
        console.error(`Error getting public blog post ${postId}:`, error);
        return jsonResponse({ error: '获取文章详情失败' }, 500);
    }
}

// This file specifically handles requests matching its path structure (/api/blog/[id])
// We only need to handle GET for the public endpoint.
export async function onRequestGet(context) {
    return handleGetOnePublic(context);
}

// Optional: Handle other methods if needed, or return 405 Method Not Allowed
export async function onRequest(context) {
    if (context.request.method !== 'GET') {
        return jsonResponse({ error: `方法 ${context.request.method} 不被允许` }, 405);
    }
    // If it's GET, it should have been handled by onRequestGet
    // This fallback might not be strictly necessary depending on Cloudflare's exact routing behavior
    // but provides clarity.
    return jsonResponse({ error: '无效的请求' }, 400); 
} 