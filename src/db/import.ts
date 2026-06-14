/**
 * Import data from bamien-old/datav2/*.json into SQLite
 * Run: bun run src/db/import.ts
 */
import { getDb } from "./schema";
import { readdir, readFile } from "fs/promises";
import { join } from "path";

const DATA_DIR = join(import.meta.dir, "../../bamien-old/datav2");

interface JsonOption {
  id: number;
  text: string;
  sold_out?: boolean;
}

interface JsonVote {
  id: number;
  user_id: string;
  option_id: number;
  created_at: string;
}

interface JsonData {
  options: JsonOption[];
  votes: JsonVote[];
}

async function importData(): Promise<void> {
  const db = getDb();

  // Read all JSON files
  const files = await readdir(DATA_DIR);
  const jsonFiles = files.filter((f) => f.endsWith(".json")).sort();

  console.log(`Found ${jsonFiles.length} JSON files to import`);

  let totalOptions = 0;
  let totalVotes = 0;

  const insertOption = db.prepare(
    "INSERT OR IGNORE INTO options (time_slot, text, sold_out) VALUES (?, ?, ?)"
  );
  const insertVote = db.prepare(
    "INSERT OR IGNORE INTO votes (user_name, option_id, created_at) VALUES (?, ?, ?)"
  );
  const findOption = db.prepare(
    "SELECT id FROM options WHERE time_slot = ? AND text = ?"
  );

  for (const file of jsonFiles) {
    // Extract time_slot from filename: "10h.json" -> "10h"
    const timeSlot = file.replace(".json", "");
    const filePath = join(DATA_DIR, file);

    console.log(`\nImporting ${file} (time_slot: ${timeSlot})...`);

    const raw = await readFile(filePath, "utf-8");
    const data: JsonData = JSON.parse(raw);

    // Build a map from old option ID -> text for vote mapping
    const oldIdToText = new Map<number, string>();

    // Import options
    const importOptions = db.transaction(() => {
      for (const opt of data.options) {
        oldIdToText.set(opt.id, opt.text);
        insertOption.run(timeSlot, opt.text, opt.sold_out ? 1 : 0);
        totalOptions++;
      }
    });
    importOptions();

    // Import votes
    const importVotes = db.transaction(() => {
      for (const vote of data.votes) {
        const optText = oldIdToText.get(vote.option_id);
        if (!optText) {
          console.warn(`  Warning: vote references unknown option_id ${vote.option_id}, skipping`);
          continue;
        }

        // Find the new option ID by time_slot + text
        const newOpt = findOption.get(timeSlot, optText) as { id: number } | null;
        if (!newOpt) {
          console.warn(`  Warning: option "${optText}" not found in DB, skipping vote`);
          continue;
        }

        insertVote.run(vote.user_id, newOpt.id, vote.created_at);
        totalVotes++;
      }
    });
    importVotes();

    console.log(`  ✓ ${data.options.length} options, ${data.votes.length} votes`);
  }

  console.log(`\n✅ Import complete: ${totalOptions} options, ${totalVotes} votes`);
}

importData().catch(console.error);
