/**
 * Bà Miên Vote – Entry Point
 * Bun + Hono + HTMX + SQLite + WebSocket
 */
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { getDb } from "./db/schema";
import { authRoutes, authMiddleware } from "./routes/auth";
import { pollRoutes } from "./routes/poll";
import { adminRoutes } from "./routes/admin";
import { websocketHandlers, validateWsUpgrade, setServerRef } from "./ws/websocket";

// Initialize database
getDb();

const app = new Hono();

// --- Security headers middleware ---
app.use("*", async (c, next) => {
  await next();
  // Security headers
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  // TODO(security): Add strict CSP with nonces when template system supports it
  c.header(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self'; connect-src 'self' ws: wss:; frame-ancestors 'none'"
  );
});

// --- Static files ---
app.use("/public/*", serveStatic({ root: "./src/" }));

// --- Auth middleware (runs on all routes) ---
app.use("*", authMiddleware);

// --- Routes ---
app.route("/auth", authRoutes);
app.route("/admin", adminRoutes);
app.route("/", pollRoutes);

// --- Health check ---
app.get("/health", (c) =>
  c.json({ status: "ok", timestamp: new Date().toISOString() })
);

// --- Bun server config with WebSocket support ---
const PORT = parseInt(process.env["PORT"] ?? "3005", 10);

const server = Bun.serve({
  port: PORT,
  fetch(req, server) {
    // Handle WebSocket upgrade
    const url = new URL(req.url);
    if (url.pathname === "/ws") {
      const wsData = validateWsUpgrade(req);
      if (wsData) {
        const success = server.upgrade(req, { data: wsData });
        if (success) return undefined;
      }
      return new Response("WebSocket upgrade failed", { status: 400 });
    }

    // Handle regular HTTP requests via Hono
    return app.fetch(req, { ip: server.requestIP(req) });
  },
  websocket: websocketHandlers,
});

// Store server reference for broadcasting
setServerRef(server);

console.log(`🚀 Server running at http://localhost:${PORT}`);
console.log(`📡 WebSocket available at ws://localhost:${PORT}/ws`);
