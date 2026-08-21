/**
 * One-off backfill: infers the `country` and `salary` columns for posts that
 * predate them.
 *
 * Safe to re-run — by default it only fills values that are still empty. Pass
 * --all to re-infer every row (useful after editing either detector).
 */
import { getDatabase, saveDatabase } from '../build/store/connection.js';
import { resolveCountry } from '../build/intake/location.js';
import { detectSalary } from '../build/intake/compensation.js';

const reinferAll = process.argv.includes('--all');

const db = await getDatabase();
const result = db.exec('SELECT id, description, country, salary FROM posts');

if (result.length === 0) {
  console.log('no posts in database');
  process.exit(0);
}

const rows = result[0].values.map(([id, description, country, salary]) => ({
  id,
  description: description || '',
  country: country || '',
  salary: salary || '',
}));

let countryUpdated = 0;
let salaryUpdated = 0;
const tally = new Map();

for (const row of rows) {
  if (reinferAll || !row.country) {
    const country = resolveCountry(row.description);
    if (country !== row.country) {
      db.run('UPDATE posts SET country = ? WHERE id = ?', [country, row.id]);
      countryUpdated++;
    }
  }

  if (reinferAll || !row.salary) {
    const salary = detectSalary(row.description);
    if (salary !== row.salary) {
      db.run('UPDATE posts SET salary = ? WHERE id = ?', [salary, row.id]);
      salaryUpdated++;
    }
  }
}

saveDatabase();

// Report the distribution so the result is inspectable without opening the UI.
for (const row of db.exec('SELECT country FROM posts')[0].values) {
  for (const c of (row[0] || '').split(',')) {
    const name = c.trim() || '(none)';
    tally.set(name, (tally.get(name) || 0) + 1);
  }
}

const withSalary = db.exec("SELECT COUNT(*) FROM posts WHERE salary != ''")[0].values[0][0];

console.log(`rows: ${rows.length} | country set: ${countryUpdated} | salary set: ${salaryUpdated}`);
console.log(`posts quoting pay: ${withSalary}\n`);
console.log('country distribution (posts may count in several):');
for (const [name, count] of [...tally].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(count).padStart(4)}  ${name}`);
}
