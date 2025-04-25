/**
 * Cloudflare Function: /api/blog
 * Fetches blog post data from Supabase.
 */
import { createClient } from '@supabase/supabase-js';

/**
 * @typedef {Object} Attachment
 * @property {string} url
 * @property {string} type
 * @property {string} filename
 */

/**
 * @typedef {Object} BlogPost
 * @property {number} id
 * @property {string} title
 * @property {string} date - ISO 8601 date string
 * @property {string} category
 * @property {string} content
 * @property {Attachment[]} [attachments]
 * @property {number[]} [references]
 */

/**
 * @typedef {Object} Env
 * @property {string} SUPABASE_URL
 * @property {string} SUPABASE_ANON_KEY
 */

/**
 * @param {object} context
 * @param {Env} context.env
 * @returns {Promise<Response>}
 */
export const onRequestGet = async ({ env }) => {
  // 1. Check for Supabase credentials
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    console.error('Supabase URL or Anon Key not found in environment variables.');
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 2. Initialize Supabase client
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

  try {
    // 3. Fetch blog post data
    //    -> Assumes a table named 'posts'
    //    -> Assumes columns 'id', 'title', 'date', 'category', 'content'
    //    -> Assumes JSONB columns named 'attachments' and 'references' 
    //       (Alternatively, these could be related tables)
    //    *** Adjust table and column names according to your Supabase schema ***

    // Example Query (adjust as needed):
    const { data: posts, error: postsError } = await supabase
      .from('posts') // Adjust table name if different
      .select(`
        id,
        title,
        date,
        category,
        content,
        attachments,
        references 
      `)
      // Optionally, add sorting:
      // .order('date', { ascending: false })

    if (postsError) {
      throw postsError;
    }
    
    // 4. Format data (ensure it matches the BlogPost structure)
    // Supabase might return null instead of empty arrays for JSONB columns
    const formattedPosts = (posts || []).map(post => ({
      ...post,
      attachments: post.attachments || [], // Default to empty array if null
      references: post.references || [],   // Default to empty array if null
    }));

    // 5. Return successful response
    return new Response(JSON.stringify(formattedPosts), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
         // Optional: Add caching headers if desired
        // 'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
      },
    });

  } catch (error) {
    console.error('Error fetching blog posts from Supabase:', error.message);
    return new Response(JSON.stringify({ error: 'Failed to fetch blog posts' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}; 