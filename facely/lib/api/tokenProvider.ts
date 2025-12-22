// facely/lib/api/tokenProvider.ts
// Production-grade token provider that fetches fresh tokens from Clerk session.
// Clerk tokens expire in ~60 seconds, so we must fetch a fresh token for each API call.

type TokenGetter = () => Promise<string | null>;

let _getToken: TokenGetter | null = null;

/**
 * Register the Clerk session's getToken function.
 * Called once from AuthProvider when the session is available.
 */
export function registerTokenProvider(getToken: TokenGetter | null): void {
  _getToken = getToken;
}

/**
 * Get a fresh JWT token from Clerk.
 * This should be called before each API request to ensure the token is not expired.
 * @throws Error if no token provider is registered or token fetch fails
 */
export async function getFreshToken(): Promise<string> {
  if (!_getToken) {
    throw new Error("Token provider not registered. User may not be authenticated.");
  }

  const token = await _getToken();

  if (!token || typeof token !== "string" || token.trim().length === 0) {
    throw new Error("Failed to get fresh token from Clerk session.");
  }

  const trimmed = token.trim();
  if (trimmed.split(".").length !== 3) {
    throw new Error("Invalid JWT token format from Clerk.");
  }

  return trimmed;
}

/**
 * Check if a token provider is registered (user is authenticated).
 */
export function hasTokenProvider(): boolean {
  return _getToken !== null;
}
