/**
 * Cloudflare Pages Function for fetching a single public blog post
 * 
 * GET /api/blog/post/[id] - Returns a single blog post object
 * This endpoint is public and requires no authentication.
 */

// --- Helper Functions (Similar to admin API, but potentially simplified) ---

async function getBlogPosts(env) {
    // Assuming blog data is stored under the key 'blog' in the 'blog_data' KV namespace
    const jsonString = await env.blog_data.get('blog');
    try {
        return jsonString ? JSON.parse(jsonString) : [];
    } catch (e) {
        console.error("Error parsing blog data from KV:", e);
        return null; // Indicate error during fetch
    }
}

function jsonResponse(data, status = 200, headers = {}) {
    return new Response(JSON.stringify(data), {
        status: status,
        headers: {
            'Content-Type': 'application/json;charset=UTF-8',
            // Add CORS headers if calling from a different origin locally, 
            // though usually not needed when served from the same Pages domain.
            // 'Access-Control-Allow-Origin': '*', 
            ...headers
        }
    });
}

// --- Main Request Handler --- 

export async function onRequestGet(context) {
    const { env, params } = context;
    const postId = parseInt(params.id, 10);

    if (isNaN(postId)) {
        return jsonResponse({ error: '无效的文章 ID' }, 400);
    }

    try {
        const posts = await getBlogPosts(env);

        if (posts === null) {
            // Error reading from KV
            return jsonResponse({ error: '无法读取文章数据' }, 500);
        }

        const post = posts.find(p => p.id === postId);

        if (!post) {
            return jsonResponse({ error: '找不到指定的文章' }, 404);
        }
        
        // Return the found post
        return jsonResponse(post);

    } catch (error) {
        console.error(`获取公共博客文章 ${postId} 时出错:`, error);
        return jsonResponse({ error: '获取文章时服务器内部出错' }, 500);
    }
}

// Optional: Handle other methods if needed, otherwise they will 404 or be handled by default.
// export async function onRequest(context) {
//     if (context.request.method === 'GET') {
//         return onRequestGet(context);
//     } else {
//         return new Response('Method Not Allowed', { status: 405 });
//     }
// } 