/**
 * WebSocket handler for real-time poll updates.
 * Uses Bun's built-in WebSocket server with pub/sub topics.
 */
import type { ServerWebSocket } from "bun";
import { getSession } from "../db/schema";

export interface WsData {
  timeSlot: string;
  userName: string | null;
}

/**
 * WebSocket handlers for Bun server.
 */
export const websocketHandlers = {
  open(ws: ServerWebSocket<WsData>) {
    const topic = `poll:${ws.data.timeSlot}`;
    ws.subscribe(topic);
    console.log(`[WS] Client connected: timeSlot=${ws.data.timeSlot} user=${ws.data.userName}`);
  },

  message(_ws: ServerWebSocket<WsData>, _message: string | Buffer) {
    // Client → Server messages not used (read-only real-time push)
  },

  close(ws: ServerWebSocket<WsData>) {
    ws.unsubscribe(`poll:${ws.data.timeSlot}`);
    console.log(`[WS] Client disconnected: timeSlot=${ws.data.timeSlot}`);
  },
};

// Store the server reference for broadcasting
let serverRef: { publish: (topic: string, message: string) => number } | null = null;

export function setServerRef(server: { publish: (topic: string, message: string) => number }): void {
  serverRef = server;
}

/**
 * Broadcast a poll update to all clients subscribed to the given time slot.
 * The client will receive this and call htmx.ajax() to refresh the card grid.
 */
export function broadcastPollUpdate(timeSlot: string): void {
  if (!serverRef) {
    console.warn("[WS] No server ref, cannot broadcast");
    return;
  }

  const topic = `poll:${timeSlot}`;
  const message = JSON.stringify({
    type: "poll_update",
    timeSlot,
    timestamp: Date.now(),
  });

  const sent = serverRef.publish(topic, message);
  console.log(`[WS] Broadcast to ${topic}: ${sent} client(s) received`);
}

/**
 * Parse the WebSocket upgrade request.
 * Returns WsData (timeSlot + userName) or null if invalid.
 * NOTE: timeSlot is required – client MUST send ?time=<slot> in the WS URL.
 */
export function validateWsUpgrade(req: Request): WsData | null {
  const url = new URL(req.url);
  const timeSlot = url.searchParams.get("time");

  // Require a non-empty timeSlot
  if (!timeSlot || timeSlot.trim() === "") {
    console.warn("[WS] Upgrade rejected: missing ?time= param");
    return null;
  }

  // Extract session from cookie header (optional – guests can still connect)
  const cookieHeader = req.headers.get("cookie") ?? "";
  const sessionMatch = cookieHeader.match(/(?:^|;\s*)session=([^;]*)/);
  const sessionId = sessionMatch?.[1];

  let userName: string | null = null;
  if (sessionId) {
    const session = getSession(sessionId);
    userName = session?.user_name ?? null;
  }

  return { timeSlot: timeSlot.trim(), userName };
}
