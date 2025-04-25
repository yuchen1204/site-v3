// 定义辅助函数，从 KV 获取博客文章数组
async function getBlogPosts(env) {
  const postsJson = await env.blog_data.get('blog');
  try {
    return postsJson ? JSON.parse(postsJson) : [];
  } catch (e) {
    console.error("解析 KV 中的博客数据失败:", e);
    // 如果解析失败，返回空数组或者抛出错误，这里选择返回空数组以避免完全阻塞
    return []; 
  }
}

// 定义辅助函数，将博客文章数组写入 KV
async function saveBlogPosts(env, posts) {
  // 在写入前简单验证一下 posts 是否是数组
  if (!Array.isArray(posts)) {
    console.error("尝试保存非数组类型的博客数据");
    throw new Error("无效的数据格式，无法保存。");
  }
  await env.blog_data.put('blog', JSON.stringify(posts, null, 2)); // 格式化 JSON 存储
}

// 处理 /admin/api/blog 请求 (GET, POST)
export async function onRequest(context) {
  const { request, env, next, params } = context;
  const method = request.method;

  console.log(`[${method}] /admin/api/blog - 开始处理请求`); // <-- 入口日志

  // _middleware.js 应该已经处理了认证，这里假设已认证

  try {
    if (method === 'GET') {
      console.log('[GET] /admin/api/blog - 准备从 KV 获取数据'); // <-- GET 开始日志
      let posts = [];
      try {
          posts = await getBlogPosts(env);
          console.log(`[GET] /admin/api/blog - 从 KV 获取数据成功，共 ${posts.length} 条记录`); // <-- 获取成功日志
      } catch (kvError) {
          console.error('[GET] /admin/api/blog - 调用 getBlogPosts 时出错:', kvError); // <-- KV 错误日志
          // 即使 getBlogPosts 内部有 catch，这里也捕获一下以防万一
          throw new Error('无法从 KV 获取博客数据'); // 抛出更具体的错误
      }
      
      console.log('[GET] /admin/api/blog - 准备返回数据'); // <-- 返回前日志
      return new Response(JSON.stringify(posts), {
        headers: { 'Content-Type': 'application/json;charset=UTF-8' },
      });
    } else if (method === 'POST') {
      // 创建新博客文章
      const newPostData = await request.json();

      // 基本验证
      if (!newPostData.title || !newPostData.category) {
        return new Response(JSON.stringify({ error: '标题和分类不能为空' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json;charset=UTF-8' },
        });
      }

      const posts = await getBlogPosts(env);
      
      const newPost = {
        id: crypto.randomUUID(), // 使用内置 API 生成 UUID
        date: new Date().toISOString(), // 使用服务器时间
        title: newPostData.title,
        category: newPostData.category,
        content: newPostData.content || '',
        attachments: newPostData.attachments || [], // 保留空数组
        references: newPostData.references || [],   // 保留空数组
      };

      posts.push(newPost);
      await saveBlogPosts(env, posts);

      return new Response(JSON.stringify(newPost), {
        status: 201, // Created
        headers: { 'Content-Type': 'application/json;charset=UTF-8' },
      });
    } else {
      console.warn(`[${method}] /admin/api/blog - 不支持的方法`); // <-- 不支持方法日志
      return new Response('Method Not Allowed', { status: 405 });
    }
  } catch (error) {
    // 这个 catch 块捕获上面 try 块中的所有错误，包括 GET 和 POST 逻辑中的
    console.error(`[${method}] /admin/api/blog - 处理请求时发生顶层错误:`, error);
    return new Response(JSON.stringify({ error: '服务器内部错误', details: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' },
    });
  }
}

// 处理 /admin/api/blog/[id] 请求 (GET, PUT, DELETE)
// Cloudflare Pages 使用文件系统路由，所以这个逻辑应该放在一个名为 `functions/admin/api/blog/[id].js` 的文件中
// 或者在一个能处理动态参数的函数中。
// 为了简化，我们将这个逻辑合并到这里，并假设 `params.id` 存在。
// 注意：在 Cloudflare Pages Functions 中，动态路由参数在 `context.params` 中。
// 一个更好的做法是创建 `functions/admin/api/blog/[id].js` 文件。
// 但这里暂时放在一个函数中，通过请求 URL 判断。

export async function onRequestGet(context) {
  return handleSinglePostRequest(context);
}
export async function onRequestPut(context) {
    return handleSinglePostRequest(context);
}
export async function onRequestDelete(context) {
    return handleSinglePostRequest(context);
}


async function handleSinglePostRequest(context) {
    const { request, env, params } = context;
    const method = request.method;
    const postId = params.id; // 从 context.params 获取动态路由参数

    if (!postId) {
         return new Response(JSON.stringify({ error: '缺少文章 ID' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json;charset=UTF-8' },
         });
    }

    try {
        const posts = await getBlogPosts(env);
        const postIndex = posts.findIndex(p => p.id === postId);

        if (postIndex === -1 && method !== 'PUT') { // PUT 可以用于创建（如果允许）
            return new Response(JSON.stringify({ error: '文章未找到' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json;charset=UTF-8' },
            });
        }

        if (method === 'GET') {
            // 获取单篇文章
             if (postIndex === -1) {
                 return new Response(JSON.stringify({ error: '文章未找到' }), { status: 404 });
             }
            return new Response(JSON.stringify(posts[postIndex]), {
                headers: { 'Content-Type': 'application/json;charset=UTF-8' },
            });
        } else if (method === 'PUT') {
            // 更新文章
             if (postIndex === -1) {
                 // 如果不允许 PUT 创建，返回 404
                  return new Response(JSON.stringify({ error: '文章未找到，无法更新' }), { status: 404 });
                 // 如果允许 PUT 创建，则走创建逻辑，但通常 PUT 用于替换
             }
            const updatedData = await request.json();

            // 基本验证
             if (!updatedData.title || !updatedData.category) {
                return new Response(JSON.stringify({ error: '标题和分类不能为空' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json;charset=UTF-8' },
                });
            }

            // 更新字段，保留 id 和原始 date (除非需要更新 date)
            const originalPost = posts[postIndex];
            posts[postIndex] = {
                ...originalPost, // 保留原始字段，如 id, date
                title: updatedData.title,
                category: updatedData.category,
                content: updatedData.content || '',
                attachments: updatedData.attachments || originalPost.attachments || [], // 保留或更新
                references: updatedData.references || originalPost.references || [],   // 保留或更新
                // date: new Date().toISOString(), // 如果需要更新修改时间
            };

            await saveBlogPosts(env, posts);
            return new Response(JSON.stringify(posts[postIndex]), {
                 headers: { 'Content-Type': 'application/json;charset=UTF-8' },
            });
        } else if (method === 'DELETE') {
            // 删除文章
             if (postIndex === -1) {
                 return new Response(JSON.stringify({ error: '文章未找到，无法删除' }), { status: 404 });
             }
            posts.splice(postIndex, 1); // 从数组中移除
            await saveBlogPosts(env, posts);
            return new Response(JSON.stringify({ success: true, message: '文章删除成功' }), {
                 headers: { 'Content-Type': 'application/json;charset=UTF-8' },
            });
        } else {
            return new Response('Method Not Allowed', { status: 405 });
        }

    } catch (error) {
        console.error(`处理 /admin/api/blog/${postId} [${method}] 失败:`, error);
        return new Response(JSON.stringify({ error: '服务器内部错误' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json;charset=UTF-8' },
        });
    }
}

// 适配 Cloudflare Pages 的单一文件处理多方法或特定方法导出
// export async function onRequest(context) {
//   const url = new URL(context.request.url);
//   const pathParts = url.pathname.split('/').filter(Boolean); // ['admin', 'api', 'blog', 'xxx']

//   if (pathParts.length === 4 && pathParts[3]) {
//     // 匹配 /admin/api/blog/[id]
//     context.params = { id: pathParts[3] }; // 手动设置 params
//     return handleSinglePostRequest(context);
//   } else if (pathParts.length === 3) {
//     // 匹配 /admin/api/blog
//     return handleBlogListRequest(context); // 需要将上面的 POST/GET 逻辑拆分出来
//   } else {
//     return new Response('Not Found', { status: 404 });
//   }
// }

// 使用命名导出 onRequestGet, onRequestPost, etc. 是 Cloudflare Pages Functions 的标准方式
// 上面的 handleSinglePostRequest 应该放到 functions/admin/api/blog/[id].js 中。
// 但为了在这个单一文件中演示，我们使用了onRequestGet/Put/Delete导出。
// 如果要在单一文件中处理所有方法和路径，需要更复杂的路由逻辑。 