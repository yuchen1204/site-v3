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
            references: newPostData.references || []
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

// Handle GET /admin/api/blog/[id] (Get one)
async function handleGetOne(context) {
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
        return jsonResponse(post);

    } catch (error) {
        console.error(`Error getting blog post ${postId}:`, error);
        return jsonResponse({ error: '获取文章详情失败' }, 500);
    }
}

// Handle PUT /admin/api/blog/[id] (Update)
async function handleUpdate(context) {
    const { request, env, params } = context;
    const postId = parseInt(params.id, 10);

    if (isNaN(postId)) {
        return jsonResponse({ error: '无效的文章 ID' }, 400);
    }

    try {
        let posts = await getBlogPosts(env);
        const postIndex = posts.findIndex(p => p.id === postId);

        if (postIndex === -1) {
            return jsonResponse({ error: '找不到要更新的文章' }, 404);
        }

        const updatedData = await request.json();

        // Basic validation
        if (!updatedData.title || !updatedData.content || !updatedData.category || !updatedData.date) {
             return jsonResponse({ error: '缺少必要字段 (标题, 内容, 分类, 日期)' }, 400);
        }

        // Merge updated data, keeping the original ID
        posts[postIndex] = {
            ...posts[postIndex], // Keep original fields if not provided in update
            ...updatedData,
            id: postId, // Ensure ID remains the same
            date: new Date(updatedData.date).toISOString(), // Ensure date format
            attachments: updatedData.attachments || [],
            references: updatedData.references || []
        };

        await saveBlogPosts(env, posts);
        return jsonResponse(posts[postIndex]);

    } catch (error) {
        console.error(`Error updating blog post ${postId}:`, error);
        if (error instanceof SyntaxError) {
            return jsonResponse({ error: '无效的请求数据格式' }, 400);
        }
        return jsonResponse({ error: '更新文章失败' }, 500);
    }
}

// Handle DELETE /admin/api/blog/[id] (Delete)
async function handleDelete(context) {
    const { env, params } = context;
    const postId = parseInt(params.id, 10);

    if (isNaN(postId)) {
        return jsonResponse({ error: '无效的文章 ID' }, 400);
    }

    try {
        let posts = await getBlogPosts(env);
        const initialLength = posts.length;
        posts = posts.filter(p => p.id !== postId);

        if (posts.length === initialLength) {
            return jsonResponse({ error: '找不到要删除的文章' }, 404);
        }

        await saveBlogPosts(env, posts);
        return jsonResponse({ message: '文章删除成功' }); // 200 OK is fine, 204 No Content is also an option

    } catch (error) {
        console.error(`Error deleting blog post ${postId}:`, error);
        return jsonResponse({ error: '删除文章失败' }, 500);
    }
}

// Main onRequest handler to route requests based on method and path
export async function onRequest(context) {
    const { request, params } = context;
    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/').filter(Boolean);
    const hasId = pathSegments.length === 4 && pathSegments[2] === 'blog' && params.id;

    // Authentication should be handled by _middleware.js before this function is called

    if (request.method === 'GET') {
        if (hasId) {
            return handleGetOne(context);
        } else if (pathSegments.length === 3 && pathSegments[2] === 'blog') {
            return handleList(context);
        }
    } else if (request.method === 'POST') {
        if (pathSegments.length === 3 && pathSegments[2] === 'blog') {
             return handleCreate(context);
        }
    } else if (request.method === 'PUT') {
        if (hasId) {
            return handleUpdate(context);
        }
    } else if (request.method === 'DELETE') {
        if (hasId) {
            return handleDelete(context);
        }
    }

    // If no route matches
    return jsonResponse({ error: '无效的 API 路由' }, 404);
} 