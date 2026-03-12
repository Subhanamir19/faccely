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

export async function restoreWithCode(code: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/recovery-codes/restore`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });

    if (!res.ok) return false;

    const json = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      user_id?: string;
    };

    if (!json.access_token || !json.refresh_token || !json.user_id) return false;

    // Restore Supabase session — AuthProvider listener will fire and update store
    const { error } = await supabase.auth.setSession({
      access_token: json.access_token,
      refresh_token: json.refresh_token,
    });

    if (error) return false;

    // Re-link RevenueCat to the recovered user
    await identifyUser(json.user_id).catch(() => {});

    return true;
  } catch {
    return false;
  }
}
