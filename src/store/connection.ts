import initSqlJs, { Database } from 'sql.js';
import path from 'path';
import fs from 'fs';
import { getResourcesPath } from '../platform/workspace-paths.js';

let db: Database | null = null;
let dbPath: string;

/**
 * Fingerprint of the file contents currently held in memory. sql.js keeps the
 * whole database in memory and writes it back wholesale, so several processes
 * (the MCP server and the viewer) each hold their own copy of the same file.
 * Without this check a process would serve a stale snapshot indefinitely, and
 * its next save would overwrite every row another process had added.
 */
let loadedSignature = '';

/** Identity of the file on disk right now, or '' when it does not exist. */
function diskSignature(): string {
  try {
    const stats = fs.statSync(dbPath);
    return `${stats.size}:${stats.mtimeMs}`;
  } catch {
    return '';
  }
}

/**
 * Get or create database connection (singleton)
 * Automatically initializes schema on first access
 *
 * Reloads from disk when another process has written to the file since this
 * one last read or saved it.
 */
export async function getDatabase(): Promise<Database> {
  if (!dbPath) {
    dbPath = path.join(getResourcesPath(), 'linkedin.db');
  }

  // Drop the cached copy when the file changed underneath us. Every write path
  // saves immediately, so there is never an unsaved change to lose here.
  if (db && diskSignature() !== loadedSignature) {
    db.close();
    db = null;
  }

  if (!db) {
    // Initialize sql.js
    const SQL = await initSqlJs();
    
    // Load existing database or create new one
    if (fs.existsSync(dbPath)) {
      const buffer = fs.readFileSync(dbPath);
      db = new SQL.Database(buffer);
    } else {
      db = new SQL.Database();
    }
    
    loadedSignature = diskSignature();
    
    // Initialize schema
    initializeSchema();
  }
  return db;
}

/**
 * Save database to disk
 */
export function saveDatabase(): void {
  if (db && dbPath) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
    // Record what we just wrote, so this process does not treat its own save as
    // an external change on the next read.
    loadedSignature = diskSignature();
  }
}

/**
 * Create tables if they don't exist
 * Safe to run multiple times (IF NOT EXISTS)
 */
function initializeSchema(): void {
  if (!db) return;
  
  db.run(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      search_keywords TEXT NOT NULL,
      post_link TEXT UNIQUE NOT NULL,
      description TEXT NOT NULL,
      search_date TEXT NOT NULL,
      applied INTEGER DEFAULT 0,
      saved INTEGER DEFAULT 0,
      profile_image TEXT DEFAULT '',
      author_name TEXT DEFAULT '',
      author_occupation TEXT DEFAULT '',
      post_date TEXT DEFAULT '',
      like_count TEXT DEFAULT '',
      comment_count TEXT DEFAULT '',
      country TEXT DEFAULT '',
      salary TEXT DEFAULT '',
      verdict TEXT DEFAULT ''
    );
  `);
  
  // Migration: Add saved column if it doesn't exist (for existing databases)
  try {
    db.run(`ALTER TABLE posts ADD COLUMN saved INTEGER DEFAULT 0;`);
  } catch (error) {
    // Column already exists, ignore error
  }

  // Migration: Add country column if it doesn't exist (for existing databases)
  try {
    db.run(`ALTER TABLE posts ADD COLUMN country TEXT DEFAULT '';`);
  } catch (error) {
    // Column already exists, ignore error
  }

  // Migration: Add salary column if it doesn't exist (for existing databases)
  try {
    db.run(`ALTER TABLE posts ADD COLUMN salary TEXT DEFAULT '';`);
  } catch (error) {
    // Column already exists, ignore error
  }

  // Migration: verdict replaces the old binary `saved` flag with a triage
  // rating ('' unrated, 'yes', 'maybe', 'no'). Previously saved posts carry over
  // as 'yes'. The `saved` column is left in place as the migration source but is
  // no longer read or written.
  try {
    db.run(`ALTER TABLE posts ADD COLUMN verdict TEXT DEFAULT '';`);
    db.run(`UPDATE posts SET verdict = 'yes' WHERE saved = 1 AND (verdict IS NULL OR verdict = '');`);
  } catch (error) {
    // Column already exists, ignore error
  }
  
  db.run(`CREATE INDEX IF NOT EXISTS idx_posts_link ON posts(post_link);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_posts_date ON posts(search_date);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_posts_applied ON posts(applied);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_posts_saved ON posts(saved);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_posts_country ON posts(country);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_posts_salary ON posts(salary);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_posts_verdict ON posts(verdict);`);
  
  // Save after schema creation
  saveDatabase();
}

/**
 * Close database connection (cleanup)
 */
export function closeDatabase(): void {
  if (db) {
    saveDatabase();
    db.close();
    db = null;
  }
}
