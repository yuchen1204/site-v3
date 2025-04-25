/**
 * Cloudflare Pages Function for handling blog post data in admin
 * GET /admin/api/blog -> Retrieves all blog posts
 * GET /admin/api/blog?id={postId} -> Retrieves a single blog post
 * POST /admin/api/blog -> Creates a new blog post
 * PUT /admin/api/blog?id={postId} -> Updates an existing blog post
 * DELETE /admin/api/blog?id={postId} -> Deletes a blog post
 */

const BLOG_KEY = 'blog';

// --- Helper Functions ---

/**
 * Reads all blog posts from KV.
 * @param {object} env - Environment bindings.
 * @returns {Promise<Array>} - Array of blog posts.
 */
async function getAllBlogPosts(env) {
  const blogData = await env.blog_data.get(BLOG_KEY, { type: 'json' });
  return blogData || []; // Return empty array if null
}

/**
 * Writes the entire blog post array back to KV.
 * @param {object} env - Environment bindings.
 * @param {Array} posts - The array of posts to write.
 */
async function writeAllBlogPosts(env, posts) {
  await env.blog_data.put(BLOG_KEY, JSON.stringify(posts));
}

/**
 * Generates a new unique ID for a blog post.
 * Finds the current maximum ID and increments it.
 * @param {Array} posts - Array of existing posts.
 * @returns {number} - A new unique ID.
 */
function generateNewPostId(posts) {
  if (!posts || posts.length === 0) {
    return 1;
  }
  const maxId = posts.reduce((max, post) => Math.max(max, post.id || 0), 0);
  return maxId + 1;
}

// --- Request Handlers ---

/**
 * Handle GET requests.
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const postId = url.searchParams.get('id');

  try {
    const allPosts = await getAllBlogPosts(env);

    if (postId) {
      // Get single post
      const numericPostId = parseInt(postId, 10);
      const post = allPosts.find(p => p.id === numericPostId);
      if (post) {
        return new Response(JSON.stringify(post), {
          status: 200,
          headers: { 'Content-Type': 'application/json;charset=UTF-8' }
        });
      } else {
        return new Response(JSON.stringify({ error: '找不到指定的博客文章' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json;charset=UTF-8' }
        });
      }
    } else {
      // Get all posts (sorted by date descending for admin view)
      const sortedPosts = allPosts.sort((a, b) => new Date(b.date) - new Date(a.date));
      return new Response(JSON.stringify(sortedPosts), {
        status: 200,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
  } catch (error) {
    console.error('获取博客数据出错 (admin):', error);
    return new Response(JSON.stringify({ error: '获取博客数据失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  }
}

/**
 * Handle POST requests - Create new post.
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    let newPostData = await request.json();
    const allPosts = await getAllBlogPosts(env);
    
    // Assign a new ID and current date
    newPostData.id = generateNewPostId(allPosts);
    newPostData.date = new Date().toISOString(); // Set current date/time

    // Basic validation (can be expanded)
    if (!newPostData.title || !newPostData.content) {
         return new Response(JSON.stringify({ error: '标题和内容不能为空' }), {
            status: 400, 
            headers: { 'Content-Type': 'application/json;charset=UTF-8' }
        });
    }

    allPosts.push(newPostData);
    await writeAllBlogPosts(env, allPosts);

    return new Response(JSON.stringify({ success: true, message: '博客文章已创建', post: newPostData }), {
      status: 201, // Created
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });

  } catch (error) {
    console.error('创建博客文章出错 (admin):', error);
     if (error instanceof SyntaxError) {
         return new Response(JSON.stringify({ error: '请求体格式错误' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json;charset=UTF-8' }
        });
    }
    return new Response(JSON.stringify({ error: '创建博客文章失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  }
}

/**
 * Handle PUT requests - Update existing post.
 */
export async function onRequestPut(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const postId = url.searchParams.get('id');

  if (!postId) {
    return new Response(JSON.stringify({ error: '缺少博客文章 ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  }

  try {
    const numericPostId = parseInt(postId, 10);
    let updatedPostData = await request.json();
    let allPosts = await getAllBlogPosts(env);

    const postIndex = allPosts.findIndex(p => p.id === numericPostId);

    if (postIndex === -1) {
      return new Response(JSON.stringify({ error: '找不到要更新的博客文章' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }
    
    // Basic validation
    if (!updatedPostData.title || !updatedPostData.content) {
         return new Response(JSON.stringify({ error: '标题和内容不能为空' }), {
            status: 400, 
            headers: { 'Content-Type': 'application/json;charset=UTF-8' }
        });
    }

    // Preserve original ID and potentially update date
    updatedPostData.id = numericPostId;
    // updatedPostData.date = new Date().toISOString(); // Uncomment if you want to update date on edit
    
    // Replace the old post with the updated one
    allPosts[postIndex] = updatedPostData;
    
    await writeAllBlogPosts(env, allPosts);

    return new Response(JSON.stringify({ success: true, message: '博客文章已更新', post: updatedPostData }), {
      status: 200,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });

  } catch (error) {
    console.error('更新博客文章出错 (admin):', error);
     if (error instanceof SyntaxError) {
         return new Response(JSON.stringify({ error: '请求体格式错误' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json;charset=UTF-8' }
        });
    }
    return new Response(JSON.stringify({ error: '更新博客文章失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  }
}

/**
 * Handle DELETE requests - Delete a post.
 */
export async function onRequestDelete(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const postId = url.searchParams.get('id');

    if (!postId) {
        return new Response(JSON.stringify({ error: '缺少博客文章 ID' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json;charset=UTF-8' }
        });
    }

    try {
        const numericPostId = parseInt(postId, 10);
        let allPosts = await getAllBlogPosts(env);

        const initialLength = allPosts.length;
        const updatedPosts = allPosts.filter(p => p.id !== numericPostId);

        if (updatedPosts.length === initialLength) {
            return new Response(JSON.stringify({ error: '找不到要删除的博客文章' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json;charset=UTF-8' }
            });
        }

        await writeAllBlogPosts(env, updatedPosts);

        return new Response(JSON.stringify({ success: true, message: '博客文章已删除' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json;charset=UTF-8' }
        });

    } catch (error) {
        console.error('删除博客文章出错 (admin):', error);
        return new Response(JSON.stringify({ error: '删除博客文章失败' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json;charset=UTF-8' }
        });
    }
}

// Define allowed request methods for this route
export const onRequest = [onRequestGet, onRequestPost, onRequestPut, onRequestDelete]; 