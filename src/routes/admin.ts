import { Hono } from "hono";
import { getAllTotalVotes, clearAllVotes, getTimeSlotFiles } from "../db/schema";
import { renderAdminPage } from "../views/admin";
import { broadcastPollUpdate } from "../ws/websocket";
import { AVAILABLE_TIMES } from "../utils/time";
import { readFileSync, existsSync } from "fs";

// Simple in-memory store for admin form CSRF (pre-session, single-use)
const adminCsrfTokens = new Map<string, number>();
const ADMIN_CSRF_TTL = 10 * 60 * 1000;

function genAdminCsrf(): string {
  const token = crypto.randomUUID();
  adminCsrfTokens.set(token, Date.now());
  // cleanup
  const now = Date.now();
  for (const [t, ts] of adminCsrfTokens) if (now - ts > ADMIN_CSRF_TTL) adminCsrfTokens.delete(t);
  return token;
}

function validateAdminCsrf(token: string | undefined): boolean {
  if (!token) return false;
  const ts = adminCsrfTokens.get(token);
  if (!ts) return false;
  adminCsrfTokens.delete(token);
  return Date.now() - ts < ADMIN_CSRF_TTL;
}

// TODO(security): In production, use a proper secret management solution (KMS).
// This multi-tiered fallback generates an ephemeral random password if env is not set.
function getAdminPassword(): string {
  const envPass = process.env["ADMIN_PASSWORD"];
  if (envPass) return envPass;

  const secretFile = "./admin_password.txt";
  if (existsSync(secretFile)) {
    return readFileSync(secretFile, "utf-8").trim();
  }

  console.warn(
    "⚠️  ADMIN_PASSWORD not set. Generating ephemeral password. Instance-isolated!"
  );
  const ephemeral = crypto.randomUUID().slice(0, 12);
  console.warn(`⚠️  Ephemeral admin password: ${ephemeral}`);
  return ephemeral;
}

const ADMIN_PASSWORD = getAdminPassword();

/**
 * Admin routes: view stats, clear votes.
 */
export const adminRoutes = new Hono();

/**
 * GET /admin – admin page
 */
adminRoutes.get("/", (c) => {
  const token = genAdminCsrf();

  return c.html(
    renderAdminPage({
      totalVotes: getAllTotalVotes(),
      timeSlots: getTimeSlotFiles().length > 0 ? getTimeSlotFiles() : [...AVAILABLE_TIMES],
      csrfToken: token,
    })
  );
});

/**
 * POST /admin/clear – clear all votes (requires password)
 */
adminRoutes.post("/clear", async (c) => {
  const body = await c.req.parseBody();
  const csrfToken = body["_csrf"] as string | undefined;

  if (!validateAdminCsrf(csrfToken)) {
    return c.text("Invalid CSRF token", 403);
  }

  const password = body["password"] as string;
  const token = genAdminCsrf();

  if (password !== ADMIN_PASSWORD) {
    return c.html(
      renderAdminPage({
        totalVotes: getAllTotalVotes(),
        timeSlots: getTimeSlotFiles().length > 0 ? getTimeSlotFiles() : [...AVAILABLE_TIMES],
        error: "Mật khẩu không đúng!",
        csrfToken: token,
      })
    );
  }

  const cleared = clearAllVotes();

  // Broadcast update to all time slots
  for (const ts of AVAILABLE_TIMES) {
    broadcastPollUpdate(ts);
  }

  return c.html(
    renderAdminPage({
      totalVotes: getAllTotalVotes(),
      timeSlots: getTimeSlotFiles().length > 0 ? getTimeSlotFiles() : [...AVAILABLE_TIMES],
      message: `Đã xóa toàn bộ ${cleared} lượt vote thành công!`,
      csrfToken: token,
    })
  );
});
