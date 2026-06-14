/**
 * Authentication routes: login/logout + session middleware.
 */
import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { createSession, getSession, deleteSession } from "../db/schema";
import { renderLoginPage } from "../views/login";
import type { Context, Next } from "hono";

// Extend Hono context with user info
declare module "hono" {
  interface ContextVariableMap {
    userName: string | null;
    sessionId: string | null;
    csrfToken: string | null;
  }
}

export const authRoutes = new Hono();

/**
 * Middleware: extract session from cookie and set userName + csrfToken on context.
 */
export async function authMiddleware(c: Context, next: Next): Promise<void | Response> {
  const sessionId = getCookie(c, "session");
  if (sessionId) {
    const session = getSession(sessionId);
    if (session) {
      c.set("userName", session.user_name);
      c.set("sessionId", sessionId);
      c.set("csrfToken", session.csrf_token);
    } else {
      // Session expired or invalid – clear cookie
      deleteCookie(c, "session", { path: "/" });
      c.set("userName", null);
      c.set("sessionId", null);
      c.set("csrfToken", null);
    }
  } else {
    c.set("userName", null);
    c.set("sessionId", null);
    c.set("csrfToken", null);
  }
  await next();
}

/**
 * GET /auth/login – show login form (or redirect if already logged in)
 */
authRoutes.get("/login", (c) => {
  const userName = c.get("userName");
  if (userName) {
    return c.redirect("/");
  }
  const token = crypto.randomUUID();
  storeLoginToken(token);
  return c.html(renderLoginPage(token));
});

/**
 * POST /auth/login – process login
 */
authRoutes.post("/login", async (c) => {
  const body = await c.req.parseBody();
  const csrfToken = body["_csrf"] as string | undefined;

  // Validate pre-session login token
  if (!csrfToken || !validateLoginToken(csrfToken)) {
    return c.text("Invalid CSRF token", 403);
  }

  const rawName = body["user_name"];
  if (typeof rawName !== "string") {
    return c.redirect("/auth/login");
  }

  const userName = rawName.trim().slice(0, 50); // Limit length
  if (!userName) {
    return c.redirect("/auth/login");
  }

  const { sessionId, csrfToken: sessionCsrf } = createSession(userName);

  setCookie(c, "session", sessionId, {
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
    maxAge: 2 * 24 * 60 * 60, // 2 days
    // TODO(security): Set secure: true when behind HTTPS in production
  });

  return c.redirect("/");
});

/**
 * GET /auth/logout – logout and clear session
 */
authRoutes.get("/logout", (c) => {
  const sessionId = c.get("sessionId");
  if (sessionId) {
    deleteSession(sessionId);
  }
  deleteCookie(c, "session", { path: "/" });
  return c.redirect("/");
});

// --- Pre-session login CSRF tokens (single-use, 10 min TTL) ---
const loginFormTokens = new Map<string, number>();
const LOGIN_TOKEN_TTL = 10 * 60 * 1000;

export function storeLoginToken(token: string): void {
  loginFormTokens.set(token, Date.now());
  cleanLoginTokens();
}

export function validateLoginToken(token: string): boolean {
  const ts = loginFormTokens.get(token);
  if (!ts) return false;
  loginFormTokens.delete(token); // Single-use
  return Date.now() - ts < LOGIN_TOKEN_TTL;
}

function cleanLoginTokens(): void {
  const now = Date.now();
  for (const [t, ts] of loginFormTokens) {
    if (now - ts > LOGIN_TOKEN_TTL) loginFormTokens.delete(t);
  }
}
