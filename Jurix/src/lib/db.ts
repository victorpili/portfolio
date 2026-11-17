import Database from "@tauri-apps/plugin-sql";

let cached: Promise<Database> | null = null;

export function getDb(): Promise<Database> {
  if (!cached) {
    cached = Database.load("sqlite:jurix.db");
  }
  return cached;
}
