/**
 * Cloudflare Pages Function for handling Single Blog Post CRUD operations
 * 
 * GET /admin/api/blog/[id] - Get a single blog post by ID
 * PUT /admin/api/blog/[id] - Update a blog post by ID
 * DELETE /admin/api/blog/[id] - Delete a blog post by ID
 *
 * All operations require authentication (handled by _middleware.js)
 */

// --- Helper Functions (Copied from blog.js) ---

async function getBlogPosts(env) {
    const jsonString = await env.blog_data.get('blog');
    try {
        return jsonString ? JSON.parse(jsonString) : [];
    } catch (e) {
        console.error("Error parsing blog data from KV:", e);
        return [];
    }
}

async function saveBlogPosts(env, posts) {
    const postsToSave = Array.isArray(posts) ? posts : [];
    await env.blog_data.put('blog', JSON.stringify(postsToSave, null, 2));
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

// Helper to make sure blog post links are unique (复制自blog.js)
function ensureUniqueLink(link, existingPosts, currentId = null) {
    // 如果链接为空，不处理
    if (!link) return link;

    let finalLink = link;
    let counter = 1;
    let isUnique = false;
    
    // 检查链接是否唯一
    while (!isUnique) {
        isUnique = true;
        for (const post of existingPosts) {
            // 跳过当前文章（适用于编辑现有文章时）
            if (currentId && post.id === currentId) continue;
            
            if (post.link === finalLink) {
                isUnique = false;
                finalLink = `${link}-${counter}`;
                counter++;
                break;
            }
        }
    }
    
    return finalLink;
}

// --- Request Handlers for Single Item ---

// Handle GET /admin/api/blog/[id] (Get one)
async function handleGetOne(context) {
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
        
        // 确保链接唯一
        const link = ensureUniqueLink(updatedData.link, posts, postId);

        // Merge updated data, keeping the original ID
        posts[postIndex] = {
            ...posts[postIndex],
            ...updatedData,
            id: postId, // Ensure ID remains the same
            date: new Date(updatedData.date).toISOString(),
            attachments: updatedData.attachments || [],
            references: updatedData.references || [],
            link: link // 使用确保唯一的链接
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
        // Return 204 No Content for successful DELETE is common
        return new Response(null, { status: 204 }); 

    } catch (error) {
        console.error(`Error deleting blog post ${postId}:`, error);
        return jsonResponse({ error: '删除文章失败' }, 500);
    }
}

// Main onRequest handler for routes like /admin/api/blog/[id]
export async function onRequest(context) {
    const { request } = context;

    // Authentication is handled by _middleware.js in ../../admin/

    switch (request.method) {
        case 'GET':
            return handleGetOne(context);
        case 'PUT':
            return handleUpdate(context);
        case 'DELETE':
            return handleDelete(context);
        default:
            // Method Not Allowed for this specific resource path
            return jsonResponse({ error: `方法 ${request.method} 不被允许` }, 405);
    }
} 