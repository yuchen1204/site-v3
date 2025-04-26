/**
 * 处理 /blog/:id 路由，重定向到 post.html 页面并传递文章ID
 */
export async function onRequest(context) {
  const { request, params } = context;
  const postId = params.id;
  
  // 重定向到post.html，保留URL为/blog/:id的形式
  return new Response(null, {
    status: 200,
    headers: { 'Content-Type': 'text/html' },
    // 获取post.html的内容
    body: await fetch(new URL('/post.html', request.url)).then(res => res.text())
  });
} 