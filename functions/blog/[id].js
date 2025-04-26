/**
 * Cloudflare Pages Function to handle requests for /blog/[id]
 * It serves the post.html file, allowing client-side JavaScript 
 * in post.html to fetch and render the specific post data.
 */

export async function onRequestGet(context) {
    // Get the next function in the chain to fetch the static asset
    const { next } = context;
    
    try {
        // Fetch the contents of post.html from the deployed assets
        const asset = await next('/post.html');
        
        // Return the static HTML file
        // The browser will then execute the JS in post.html 
        // which fetches data based on the window.location.pathname
        return asset;
        
    } catch (error) {
        console.error("Error serving post.html for /blog/[id]:", error);
        // If post.html can't be found (e.g., build issue), return a 404
        // For other errors, return a 500
        if (error.message.includes('Unable to find asset')) {
             return new Response('Blog post page not found.', { status: 404 });
        } else {
             return new Response('Error loading blog post page.', { status: 500 });
        }
    }
}

// Optional: Handle other methods if necessary, though usually only GET is needed
export async function onRequest(context) {
    if (context.request.method === 'GET') {
        return onRequestGet(context);
    }
    return new Response('Method Not Allowed', { status: 405 });
} 