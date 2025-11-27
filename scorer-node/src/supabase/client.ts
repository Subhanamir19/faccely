import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
if (!supabaseUrl) {
  throw new Error("Supabase client initialization failed: SUPABASE_URL is not set.");
}

const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseServiceRoleKey) {
  throw new Error("Supabase client initialization failed: SUPABASE_SERVICE_ROLE_KEY is not set.");
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey);

export { supabase };
