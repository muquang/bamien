/**
 * Poll routes: main page, vote, unvote, sold-out.
 */
import { Hono } from "hono";
import {
  getOptionsWithVotes,
  getTotalVotes,
  getUnvotedCount,
  getUserVotedPorts,
  addVote,
  removeVote,
  toggleSoldOut,
} from "../db/schema";
import { renderPollPage, renderPollCards } from "../views/poll";
import { renderLoginPage } from "../views/login";
import { resolveTimeSlot } from "../utils/time";
import { broadcastPollUpdate } from "../ws/websocket";
import { storeLoginToken } from "./auth";

export const pollRoutes = new Hono();

/**
 * Helper: build poll page data for a given user and time slot.
 * csrfToken comes from the session (stable per session, no expiry issues with HTMX).
 */
function buildPollData(userName: string, timeSlot: string, csrfToken: string) {
  const resolved = resolveTimeSlot(timeSlot);

  const options = getOptionsWithVotes(resolved, userName);
  const totalVotes = getTotalVotes(resolved);
  const unvotedCount = getUnvotedCount(resolved);
  const userVotedPorts = getUserVotedPorts(resolved, userName);

  return {
    userName,
    selectedTime: resolved,
    options,
    totalVotes,
    unvotedCount,
    userVotedPorts,
    csrfToken,
  };
}

/**
 * GET / – main poll page
 */
pollRoutes.get("/", (c) => {
  const userName = c.get("userName");
  if (!userName) {
    // Show login form with a proper stored token so POST /auth/login validates it
    const token = crypto.randomUUID();
    storeLoginToken(token);
    return c.html(renderLoginPage(token));
  }

  const csrfToken = c.get("csrfToken") ?? "";
  const timeSlot = c.req.query("time");
  const data = buildPollData(userName, timeSlot ?? "", csrfToken);
  return c.html(renderPollPage(data));
});

/**
 * GET /poll/cards – HTMX partial + WebSocket-triggered refresh.
 * Returns only the inner HTML for #poll-grid.
 * No CSRF needed (GET is safe + session cookie provides auth).
 */
pollRoutes.get("/poll/cards", (c) => {
  const userName = c.get("userName");
  if (!userName) return c.text("Unauthorized", 401);

  const csrfToken = c.get("csrfToken") ?? "";
  const timeSlot = c.req.query("time");
  const data = buildPollData(userName, timeSlot ?? "", csrfToken);
  return c.html(renderPollCards(data));
});

/**
 * POST /vote – add a vote
 */
pollRoutes.post("/vote", async (c) => {
  const userName = c.get("userName");
  if (!userName) return c.text("Unauthorized", 401);

  const body = await c.req.parseBody();
  const formCsrf = body["_csrf"] as string | undefined;
  const sessionCsrf = c.get("csrfToken");

  // Validate CSRF: form token must match session token
  if (!formCsrf || !sessionCsrf || formCsrf !== sessionCsrf) {
    return c.text("Invalid CSRF token", 403);
  }

  const optionId = parseInt(body["option_id"] as string, 10);
  const timeParam = body["time"] as string;
  const timeSlot = resolveTimeSlot(timeParam);

  if (!isNaN(optionId)) {
    addVote(optionId, userName);
    broadcastPollUpdate(timeSlot);
  }

  // For HTMX requests, return just the cards HTML
  if (c.req.header("HX-Request")) {
    const data = buildPollData(userName, timeSlot, sessionCsrf);
    return c.html(renderPollCards(data));
  }

  return c.redirect(`/?time=${encodeURIComponent(timeSlot)}`);
});

/**
 * POST /unvote – remove a vote
 */
pollRoutes.post("/unvote", async (c) => {
  const userName = c.get("userName");
  if (!userName) return c.text("Unauthorized", 401);

  const body = await c.req.parseBody();
  const formCsrf = body["_csrf"] as string | undefined;
  const sessionCsrf = c.get("csrfToken");

  if (!formCsrf || !sessionCsrf || formCsrf !== sessionCsrf) {
    return c.text("Invalid CSRF token", 403);
  }

  const optionId = parseInt(body["option_id"] as string, 10);
  const timeParam = body["time"] as string;
  const timeSlot = resolveTimeSlot(timeParam);

  if (!isNaN(optionId)) {
    removeVote(optionId, userName);
    broadcastPollUpdate(timeSlot);
  }

  if (c.req.header("HX-Request")) {
    const data = buildPollData(userName, timeSlot, sessionCsrf);
    return c.html(renderPollCards(data));
  }

  return c.redirect(`/?time=${encodeURIComponent(timeSlot)}`);
});

/**
 * POST /sold-out – toggle sold out status
 */
pollRoutes.post("/sold-out", async (c) => {
  const userName = c.get("userName");
  if (!userName) return c.text("Unauthorized", 401);

  const body = await c.req.parseBody();
  const formCsrf = body["_csrf"] as string | undefined;
  const sessionCsrf = c.get("csrfToken");

  if (!formCsrf || !sessionCsrf || formCsrf !== sessionCsrf) {
    return c.text("Invalid CSRF token", 403);
  }

  const optionId = parseInt(body["option_id"] as string, 10);
  const soldOut = body["sold_out"] === "1";
  const timeParam = body["time"] as string;
  const timeSlot = resolveTimeSlot(timeParam);

  if (!isNaN(optionId)) {
    toggleSoldOut(optionId, soldOut);
    broadcastPollUpdate(timeSlot);
  }

  if (c.req.header("HX-Request")) {
    const data = buildPollData(userName, timeSlot, sessionCsrf);
    return c.html(renderPollCards(data));
  }

  return c.redirect(`/?time=${encodeURIComponent(timeSlot)}`);
});
