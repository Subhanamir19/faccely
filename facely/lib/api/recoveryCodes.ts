import { API_BASE } from "@/lib/api/config";
import { buildAuthHeadersAsync } from "@/lib/api/authHeaders";
import { supabase } from "@/lib/supabase/client";
import { identifyUser } from "@/lib/revenuecat";

export async function generateRecoveryCode(): Promise<string | null> {
  try {
    const authHeaders = await buildAuthHeadersAsync({ includeLegacy: true });
    const res = await fetch(`${API_BASE}/recovery-codes/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { code?: string };
    return json.code ?? null;
  } catch {
    return null;
  }
}

export type RestoreResult = "ok" | "invalid_code" | "server_error" | "network_error";

export async function restoreWithCode(code: string): Promise<RestoreResult> {
  try {
    const res = await fetch(`${API_BASE}/recovery-codes/restore`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });

    if (res.status === 401) return "invalid_code";
    if (!res.ok) return "server_error";

    const json = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      user_id?: string;
    };

    if (!json.token_hash || !json.user_id) return "server_error";

    // Exchange the magic-link token hash for a real session
    const { error } = await supabase.auth.verifyOtp({
      token_hash: json.token_hash,
      type: "magiclink",
    });

    if (error) return "server_error";

    // Re-link RevenueCat to the recovered user
    await identifyUser(json.user_id).catch(() => {});

    return "ok";
  } catch {
    return "network_error";
  }
}
