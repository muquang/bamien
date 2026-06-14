/**
 * HTML escaping utility to prevent XSS.
 * All user-provided data MUST be escaped before insertion into HTML templates.
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/**
 * Generate a CSRF token using crypto-secure random bytes.
 */
export function generateCsrfToken(): string {
  return crypto.randomUUID();
}

/**
 * CSRF token store with sliding-window TTL (5 minutes, reusable).
 *
 * Why not single-use:
 * HTMX swaps the DOM and re-uses the CSRF token rendered in the server
 * response across multiple rapid actions (vote → unvote → sold-out).
 * Single-use tokens would reject the 2nd action.
 *
 * Defense-in-depth: the primary CSRF protection is the session cookie
 * (HttpOnly + SameSite=Lax) which browsers refuse to send cross-origin.
 */
const csrfTokens = new Map<string, number>(); // token -> last-used timestamp

const CSRF_TTL = 5 * 60 * 1000; // 5 minutes sliding window

export function storeCsrfToken(token: string): void {
  csrfTokens.set(token, Date.now());
  // Cleanup expired tokens (keep store small)
  const now = Date.now();
  for (const [t, ts] of csrfTokens) {
    if (now - ts > CSRF_TTL) {
      csrfTokens.delete(t);
    }
  }
}

export function validateCsrfToken(token: string | undefined): boolean {
  if (!token) return false;
  const ts = csrfTokens.get(token);
  if (!ts) return false;
  if (Date.now() - ts > CSRF_TTL) {
    csrfTokens.delete(token);
    return false;
  }
  // Refresh timestamp (sliding window – token stays valid while actively used)
  csrfTokens.set(token, Date.now());
  return true;
}

/**
 * Generate a hidden CSRF input field for forms.
 */
export function csrfField(token: string): string {
  return `<input type="hidden" name="_csrf" value="${escapeHtml(token)}">`;
}
