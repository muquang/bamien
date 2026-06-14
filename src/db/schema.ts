import { Database } from "bun:sqlite";
import { join } from "path";

const DB_PATH = join(import.meta.dir, "../../data/bamien.db");

let db: Database;

export function getDb(): Database {
  if (!db) {
    db = new Database(DB_PATH, { create: true });
    db.exec("PRAGMA journal_mode = WAL;");
    db.exec("PRAGMA foreign_keys = ON;");
    initSchema();
  }
  return db;
}

function initSchema(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS options (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      time_slot TEXT NOT NULL,
      text TEXT NOT NULL,
      sold_out INTEGER DEFAULT 0,
      UNIQUE(time_slot, text)
    );

    CREATE TABLE IF NOT EXISTS votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_name TEXT NOT NULL,
      option_id INTEGER NOT NULL REFERENCES options(id) ON DELETE CASCADE,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_name, option_id)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_name TEXT NOT NULL,
      csrf_token TEXT NOT NULL DEFAULT '',
      expires_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_options_time_slot ON options(time_slot);
    CREATE INDEX IF NOT EXISTS idx_votes_option_id ON votes(option_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
  `);
}

// --- Query helpers (all use parameterized queries) ---

export interface Option {
  id: number;
  time_slot: string;
  text: string;
  sold_out: number;
}

export interface Vote {
  id: number;
  user_name: string;
  option_id: number;
  created_at: string;
}

export interface OptionWithVotes extends Option {
  vote_count: number;
  voters: string[];
  user_vote_count: number;
}

export function getOptionsByTimeSlot(timeSlot: string): Option[] {
  const db = getDb();
  // Sort A-Z, treating Đ/đ as D/d for Vietnamese collation
  const options = db.prepare(
    "SELECT * FROM options WHERE time_slot = ? ORDER BY REPLACE(REPLACE(text, 'Đ', 'D'), 'đ', 'd') COLLATE NOCASE"
  ).all(timeSlot) as Option[];
  return options;
}

export function getOptionsWithVotes(timeSlot: string, userName: string | null): OptionWithVotes[] {
  const db = getDb();
  const options = getOptionsByTimeSlot(timeSlot);

  return options.map((opt) => {
    const votes = db.prepare(
      "SELECT user_name FROM votes WHERE option_id = ?"
    ).all(opt.id) as { user_name: string }[];

    const userVoteCount = userName
      ? (db.prepare(
          "SELECT COUNT(*) as cnt FROM votes WHERE option_id = ? AND user_name = ?"
        ).get(opt.id, userName) as { cnt: number }).cnt
      : 0;

    return {
      ...opt,
      vote_count: votes.length,
      voters: votes.map((v) => v.user_name),
      user_vote_count: userVoteCount,
    };
  });
}

export function getTotalVotes(timeSlot: string): number {
  const db = getDb();
  const result = db.prepare(
    "SELECT COUNT(*) as cnt FROM votes v JOIN options o ON v.option_id = o.id WHERE o.time_slot = ?"
  ).get(timeSlot) as { cnt: number };
  return result.cnt;
}

export function getAllTotalVotes(): number {
  const db = getDb();
  const result = db.prepare("SELECT COUNT(*) as cnt FROM votes").get() as { cnt: number };
  return result.cnt;
}

export function getUnvotedCount(timeSlot: string): number {
  const db = getDb();
  const result = db.prepare(`
    SELECT COUNT(*) as cnt FROM options o
    WHERE o.time_slot = ?
    AND NOT EXISTS (SELECT 1 FROM votes v WHERE v.option_id = o.id)
  `).get(timeSlot) as { cnt: number };
  return result.cnt;
}

export function getUserVotedPorts(timeSlot: string, userName: string): string[] {
  const db = getDb();
  const results = db.prepare(`
    SELECT DISTINCT o.text FROM votes v
    JOIN options o ON v.option_id = o.id
    WHERE v.user_name = ? AND o.time_slot = ?
  `).all(userName, timeSlot) as { text: string }[];
  return results.map((r) => r.text);
}

export function addVote(optionId: number, userName: string): boolean {
  const db = getDb();
  // Check max 2 votes per option
  const count = db.prepare(
    "SELECT COUNT(*) as cnt FROM votes WHERE option_id = ?"
  ).get(optionId) as { cnt: number };

  if (count.cnt >= 2) return false;

  try {
    db.prepare(
      "INSERT INTO votes (user_name, option_id) VALUES (?, ?)"
    ).run(userName, optionId);
    return true;
  } catch {
    // UNIQUE constraint violation – user already voted
    return false;
  }
}

export function removeVote(optionId: number, userName: string): boolean {
  const db = getDb();
  const result = db.prepare(
    "DELETE FROM votes WHERE option_id = ? AND user_name = ?"
  ).run(optionId, userName);
  return result.changes > 0;
}

export function toggleSoldOut(optionId: number, soldOut: boolean): void {
  const db = getDb();
  db.prepare(
    "UPDATE options SET sold_out = ? WHERE id = ?"
  ).run(soldOut ? 1 : 0, optionId);
}

export function getOptionTimeSlot(optionId: number): string | null {
  const db = getDb();
  const result = db.prepare(
    "SELECT time_slot FROM options WHERE id = ?"
  ).get(optionId) as { time_slot: string } | null;
  return result?.time_slot ?? null;
}

export function clearAllVotes(): number {
  const db = getDb();
  const result = db.prepare("DELETE FROM votes").run();
  return result.changes;
}

export function clearVotesByTimeSlot(timeSlot: string): number {
  const db = getDb();
  const result = db.prepare(`
    DELETE FROM votes WHERE option_id IN (
      SELECT id FROM options WHERE time_slot = ?
    )
  `).run(timeSlot);
  return result.changes;
}

// --- Session management ---

export function createSession(userName: string): { sessionId: string; csrfToken: string } {
  const db = getDb();
  const id = crypto.randomUUID();
  const csrfToken = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(); // 2 days
  db.prepare(
    "INSERT INTO sessions (id, user_name, csrf_token, expires_at) VALUES (?, ?, ?, ?)"
  ).run(id, userName, csrfToken, expiresAt);
  return { sessionId: id, csrfToken };
}

export function getSession(sessionId: string): { user_name: string; csrf_token: string } | null {
  const db = getDb();
  // Clean expired sessions periodically
  db.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run();

  const result = db.prepare(
    "SELECT user_name, csrf_token FROM sessions WHERE id = ? AND expires_at > datetime('now')"
  ).get(sessionId) as { user_name: string; csrf_token: string } | null;
  return result;
}

export function deleteSession(sessionId: string): void {
  const db = getDb();
  db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
}

export function getTimeSlotFiles(): string[] {
  const db = getDb();
  const results = db.prepare(
    "SELECT DISTINCT time_slot FROM options ORDER BY time_slot"
  ).all() as { time_slot: string }[];
  return results.map((r) => r.time_slot);
}
