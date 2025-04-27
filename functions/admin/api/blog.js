/**
 * Cloudflare Pages Function for handling Blog Post CRUD operations
 * 
 * GET /admin/api/blog - List all blog posts
 * POST /admin/api/blog - Create a new blog post
 * GET /admin/api/blog/[id] - Get a single blog post by ID
 * PUT /admin/api/blog/[id] - Update a blog post by ID
 * DELETE /admin/api/blog/[id] - Delete a blog post by ID
 *
 * All operations require authentication (handled by _middleware.js)
 */

// Helper function to get blog posts from KV
async function getBlogPosts(env) {
    const jsonString = await env.blog_data.get('blog');
    try {
        return jsonString ? JSON.parse(jsonString) : [];
    } catch (e) {
        console.error("Error parsing blog data from KV:", e);
        return []; // Return empty array on parsing error
    }
}

// Helper function to save blog posts to KV
async function saveBlogPosts(env, posts) {
    // Ensure posts is always an array
    const postsToSave = Array.isArray(posts) ? posts : [];
    await env.blog_data.put('blog', JSON.stringify(postsToSave, null, 2)); // Pretty print JSON
}

// Helper function to generate a unique ID (simple approach)
// In a real-world scenario, use a more robust method like UUIDs or DB sequences
function generateUniqueId(existingPosts) {
    const existingIds = new Set(existingPosts.map(p => p.id));
    let newId = Date.now(); // Start with timestamp
    while (existingIds.has(newId)) {
        newId++; // Increment if collision happens (unlikely with timestamp but possible)
    }
    return newId;
}

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

// --- Request Handlers --- 

// Handle GET /admin/api/blog (List all)
async function handleList(context) {
    const { env } = context;
    try {
        const posts = await getBlogPosts(env);
        return jsonResponse(posts);
    } catch (error) {
        console.error('Error listing blog posts:', error);
        return jsonResponse({ error: '无法获取文章列表' }, 500);
    }
}

// Handle POST /admin/api/blog (Create)
async function handleCreate(context) {
    const { request, env } = context;
    try {
        const posts = await getBlogPosts(env);
        const newPostData = await request.json();

        // Basic validation (can be expanded)
        if (!newPostData.title || !newPostData.content || !newPostData.category || !newPostData.date) {
            return jsonResponse({ error: '缺少必要字段 (标题, 内容, 分类, 日期)' }, 400);
        }

        const newPost = {
            ...newPostData,
            id: generateUniqueId(posts), // Generate a new ID
            // Ensure date is stored consistently (e.g., ISO string)
            date: new Date(newPostData.date).toISOString(), 
            // Ensure attachments and references are arrays if not provided
            attachments: newPostData.attachments || [],
            references: newPostData.references || [],
            // Set comment settings, defaulting to true if not provided
            commentsEnabled: newPostData.commentsEnabled !== false,
            moderationEnabled: newPostData.moderationEnabled !== false
        };

        posts.push(newPost);
        await saveBlogPosts(env, posts);

        return jsonResponse(newPost, 201); // 201 Created

    } catch (error) {
        console.error('Error creating blog post:', error);
         if (error instanceof SyntaxError) { // JSON parsing error
             return jsonResponse({ error: '无效的请求数据格式' }, 400);
         }
        return jsonResponse({ error: '创建文章失败' }, 500);
    }
}

// Main onRequest handler to route requests based on method and path
export async function onRequest(context) {
    const { request } = context;
    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/').filter(Boolean);

    // This file now ONLY handles /admin/api/blog (path length 3)
    if (pathSegments.length === 3 && pathSegments[0] === 'admin' && pathSegments[1] === 'api' && pathSegments[2] === 'blog') {
        if (request.method === 'GET') {
            return handleList(context);
        } else if (request.method === 'POST') {
            return handleCreate(context);
        }
    }

    // If method or path doesn't match, return 404 or 405
    // Returning 404 is simpler here, as the specific item routes are handled elsewhere.
    return jsonResponse({ error: '无效的 API 路由或方法' }, 404); 
} 