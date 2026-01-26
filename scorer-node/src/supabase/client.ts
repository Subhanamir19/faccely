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

/**
 * Check database connectivity and measure latency.
 * Uses a lightweight query to minimize impact.
 */
export async function checkDbHealth(): Promise<{
  ok: boolean;
  latencyMs: number;
  error?: string;
}> {
  const start = Date.now();
  try {
    // Use a simple count query on a small table
    const { error } = await supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .limit(1);

    const latencyMs = Date.now() - start;

    if (error) {
      return { ok: false, latencyMs, error: error.message };
    }

    return { ok: true, latencyMs };
  } catch (err) {
    const latencyMs = Date.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, latencyMs, error: message };
  }
}
