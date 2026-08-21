/**
 * Location allowlist for incoming posts.
 *
 * The scraper returns whatever LinkedIn's search surfaces, which in practice is
 * dominated by roles in markets the search is not aimed at - India and US
 * staffing reposts especially. Rather than deleting those by hand after every
 * run, posts are screened on the way into the database.
 *
 * Edit ALLOWED_COUNTRIES to change which markets are accepted. Values must
 * match the names produced by detectCountries() in ./country.ts.
 */

export const ALLOWED_COUNTRIES = [
  'France',
  'United Kingdom',
  'Remote (Europe)',
  'Remote (Worldwide)',
];

export interface LocationVerdict {
  allowed: boolean;
  reason: string;
}

/**
 * Decide whether a post's inferred location is wanted.
 *
 * A post is accepted when it names at least one allowed country, and rejected
 * when it names countries but none of them is allowed. Posts whose location
 * could not be inferred at all are accepted: many legitimate posts state no
 * location, so treating "unknown" as "unwanted" would discard real matches.
 *
 * Naming an unwanted country does not on its own reject a post - a Paris role
 * that mentions visa requirements for applicants from India is still a Paris
 * role, so an allowed country anywhere in the list wins.
 */
export function screenLocation(country: string): LocationVerdict {
  const countries = (country || '')
    .split(',')
    .map(c => c.trim())
    .filter(Boolean)
    .filter(c => c !== 'Remote (unspecified)');

  if (countries.length === 0) {
    return { allowed: true, reason: 'no location detected' };
  }

  const wanted = countries.filter(c => ALLOWED_COUNTRIES.includes(c));
  if (wanted.length > 0) {
    return { allowed: true, reason: `matches ${wanted.join(', ')}` };
  }

  return { allowed: false, reason: `outside allowed markets (${countries.join(', ')})` };
}
