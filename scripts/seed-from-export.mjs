/**
 * Imports scraped posts from JSON exports into the local database, applying the
 * same relevance, agency and market screening the harvester applies.
 *
 * Usage: npm run seed -- <file.json> [more.json ...]
 */
import fs from 'fs';
import { insertPost } from '../build/store/posts-repository.js';
import { ensureResourceDirectories } from '../build/platform/workspace-paths.js';
import { resolveCountry } from '../build/intake/location.js';
import { detectSalary } from '../build/intake/compensation.js';
import { getAllPosts } from '../build/store/posts-repository.js';
import { screenLocation } from '../build/intake/market-policy.js';
import { screenPost } from '../build/intake/relevance.js';

import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Resolve the database and JSON paths relative to the repo, so the script works
// from any working directory.
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('Usage: npm run seed -- <file.json> [more.json ...]');
  process.exit(1);
}

// getDatabase() writes straight to resources/linkedin.db without creating the
// directory, so make sure it exists before the first insert.
ensureResourceDirectories();

const today = new Date().toISOString().split('T')[0];

// Seed from what the database already holds, so the ?p=N suffixes continue past
// existing rows instead of colliding with them and being skipped as duplicates.
const usedLinks = new Set((await getAllPosts()).map(p => p.post_link));

/**
 * The scraper stores the visible post text, whose second line is the author
 * name; the `author` field itself holds a localized UI label ("Post du fil
 * d'actualité"), so prefer the text line when it looks like a name.
 */
const resolveAuthor = (post) => {
  const lines = (post.text || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const candidate = lines[1];
  if (candidate && candidate.length < 60 && !candidate.startsWith('•')) return candidate;
  return post.author || '';
};

/**
 * post_link carries a UNIQUE constraint. Permalinks are absent from the new
 * LinkedIn DOM, so the author profile stands in — suffixed when one author
 * posted more than once.
 */
const resolveLink = (post) => {
  const base = post.profile || `linkedin-post://${post.postId}`;
  if (!usedLinks.has(base)) {
    usedLinks.add(base);
    return base;
  }
  let n = 2;
  while (usedLinks.has(`${base}?p=${n}`)) n++;
  const link = `${base}?p=${n}`;
  usedLinks.add(link);
  return link;
};

let inserted = 0;
let skipped = 0;
let rejected = 0;
let notVacancy = 0;

for (const file of files) {
  const posts = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const post of posts) {
    const description = post.text || '';
    if (!description) {
      skipped++;
      continue;
    }
    // Same content screen the scraper applies.
    if (!screenPost(description, post.authorHeadline || '').allowed) {
      notVacancy++;
      continue;
    }

    const country = resolveCountry(description);

    // Same screening the scraper applies, so an import cannot reintroduce
    // roles from markets that are filtered out on the way in.
    if (!screenLocation(country).allowed) {
      rejected++;
      continue;
    }

    const id = await insertPost(
      post.query || 'imported',
      resolveLink(post),
      description,
      today,
      false,
      '',
      resolveAuthor(post),
      post.authorHeadline || '',
      '',
      '',
      '',
      false,
      country,
      detectSalary(description)
    );
    if (id === null) skipped++;
    else inserted++;
  }
  console.log(`${file}: ${posts.length} posts read`);
}

console.log(`\ninserted ${inserted}, skipped ${skipped}, outside allowed markets ${rejected}, non-vacancy or agency ${notVacancy}`);
