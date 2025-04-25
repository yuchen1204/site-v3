/**
 * Cloudflare Function: /api/profile
 * Fetches profile data from Supabase.
 */
import { createClient } from '@supabase/supabase-js';

/**
 * @typedef {Object} SocialLink
 * @property {string} platform
 * @property {string} url
 * @property {string} icon
 */

/**
 * @typedef {Object} ProfileData
 * @property {string} name
 * @property {string} avatar
 * @property {string} motto
 * @property {SocialLink[]} socialLinks
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
  // 1. Check for Supabase credentials in environment variables
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
    // 3. Fetch profile data
    //    -> Assumes a table named 'profiles' with a single row (e.g., id = 1)
    //    -> Assumes columns 'name', 'avatar', 'motto'
    //    -> Assumes a related table 'social_links' linked by 'profile_id'
    //       OR a JSONB column named 'social_links' in the 'profiles' table.
    //    *** Adjust the table and column names according to your Supabase schema ***

    // Example Query (adjust as needed): Fetch the first profile and its related social links
    const { data: profile, error: profileError } = await supabase
      .from('profiles') // Adjust table name if different
      .select(`
        name,
        avatar,
        motto,
        social_links ( platform, url, icon ) 
      `) // Adjust columns and related table query if needed
      .eq('id', 1) // Assuming you fetch a specific profile, e.g., by ID=1
      .maybeSingle(); // Use maybeSingle() if only one row is expected

    if (profileError) {
      throw profileError;
    }

    if (!profile) {
      return new Response(JSON.stringify({ error: 'Profile not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // If social_links is a JSONB column instead of a related table, the query might look like:
    // const { data: profile, error: profileError } = await supabase
    //   .from('profiles')
    //   .select('name, avatar, motto, social_links') // Select the JSONB column directly
    //   .eq('id', 1)
    //   .maybeSingle();

    // 4. Format data (ensure it matches the expected structure)
    /** @type {ProfileData} */
    const formattedData = {
      name: profile.name,
      avatar: profile.avatar,
      motto: profile.motto,
      // Ensure social_links is an array, even if null/undefined from DB
      socialLinks: profile.social_links || [], 
    };

    // 5. Return successful response
    return new Response(JSON.stringify(formattedData), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        // Optional: Add caching headers if desired
        // 'Cache-Control': 'public, max-age=600' // Cache for 10 minutes
       },
    });

  } catch (error) {
    console.error('Error fetching profile data from Supabase:', error.message);
    return new Response(JSON.stringify({ error: 'Failed to fetch profile data' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}; 