/**
 * Cloudflare Pages Middleware for protecting admin routes
 * 
 * @param {Request} request
 * @param {Object} env - Contains environment bindings
 * @param {Object} ctx - Contains execution context
 * @returns {Response | undefined}
 */

async function authenticate(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  // 允许访问登录页和登录 API 本身
  if (url.pathname === '/admin/' || url.pathname === '/admin/index.html' || url.pathname === '/admin/login') {
    return next(); // 继续处理请求
  }

  // 允许访问 CSS 和 JS 文件
  if (url.pathname.startsWith('/admin/css/') || url.pathname.startsWith('/admin/js/')) {
     // 如果是登录页的 JS/CSS，允许访问
     if (url.pathname === '/admin/css/login.css' || url.pathname === '/admin/js/login.js'){
        return next();
     } 
     // 对于其他 admin 目录下的 JS/CSS，仍需验证 cookie
  }

  // 获取 cookie 中的 session token
  const cookieHeader = request.headers.get('Cookie') || '';
  const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    if (key) {
      acc[key] = value;
    }
    return acc;
  }, {});
  const sessionToken = cookies['admin_session'];

  if (!sessionToken) {
    // 没有 token，重定向到登录页
    return Response.redirect(new URL('/admin/', url.origin).toString(), 302);
  }

  // 验证 KV 中的 session token
  const sessionKey = `session:${sessionToken}`;
  try {
    const sessionData = await env.blog_data.get(sessionKey, { type: 'json' });
    if (sessionData && sessionData.username) {
      // Session 有效，继续处理请求
      return next();
    } else {
      // Session 无效或已过期，重定向到登录页并清除无效 cookie
      const headers = new Headers();
      headers.append('Set-Cookie', 'admin_session=; HttpOnly; Path=/admin; Max-Age=0; SameSite=Strict');
      headers.append('Location', new URL('/admin/', url.origin).toString());
      return new Response(null, { status: 302, headers });
    }
  } catch (error) {
    console.error('验证 session 出错:', error);
    // 验证出错，重定向到登录页
    return Response.redirect(new URL('/admin/', url.origin).toString(), 302);
  }
}

export const onRequest = [authenticate]; 