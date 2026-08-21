/**
 * Salary detection for scraped LinkedIn posts.
 *
 * Hiring posts state pay in wildly inconsistent ways ("96k€", "$128,470 -
 * $208,770", "up to £830 umbrella", "Up to $100/hour"), and the same posts also
 * quote figures that are not salaries at all - referral bonuses, funding
 * rounds, revenue. So each currency figure is classified by pay period and kept
 * only when its magnitude is plausible for that period.
 *
 * The result is a normalised, human-readable string such
 * as "$128,470-208,770/yr" or "£830/day", or an empty string when the post
 * quotes no usable figure.
 */

type Period = 'yr' | 'month' | 'day' | 'hour';

interface MoneyToken {
  value: number;
  currency: string;
  start: number;
  end: number;
}

/**
 * Plausible bounds per pay period. A figure outside its band is discarded -
 * this is what separates a "$2,000 welcome bonus" from a real annual salary,
 * and keeps "$100/hour" while rejecting "$100" on its own.
 */
const PLAUSIBLE: Record<Period, { min: number; max: number }> = {
  yr: { min: 15_000, max: 2_000_000 },
  month: { min: 1_000, max: 100_000 },
  day: { min: 100, max: 5_000 },
  hour: { min: 10, max: 500 },
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  '$': '$', '€': '€', '£': '£',
  USD: '$', EUR: '€', GBP: '£',
};

/** Currency before the amount ("$150,000") or after it ("96k€", "110000USD"). */
const MONEY = /(?:([$€£]|\b(?:EUR|USD|GBP)\b)\s?(\d[\d.,  ]*\d|\d)\s?([kKmM])?)|(?:(\d[\d.,  ]*\d|\d)\s?([kKmM])?\s?([$€£]|(?:EUR|USD|GBP)\b))/g;

const PERIOD_PATTERNS: Array<{ period: Period; pattern: RegExp }> = [
  { period: 'hour', pattern: /^\s*(?:\/|per\s+|an?\s+)?\s*(?:h\b|hr\b|hour|heure|horaire)/i },
  { period: 'day', pattern: /^\s*(?:\/|per\s+|a\s+)?\s*(?:d\b|day|jour|jhomme)/i },
  { period: 'month', pattern: /^\s*(?:\/|per\s+|a\s+)?\s*(?:mo\b|month|mois|mensuel)/i },
  { period: 'yr', pattern: /^\s*(?:\/|per\s+|a\s+)?\s*(?:yr\b|y\b|year|annum|annual|an\b|ans\b|année|annee|annuel)/i },
];

/** A "day rate" or "TJM" label can also precede the figure. */
const PERIOD_BEFORE: Array<{ period: Period; pattern: RegExp }> = [
  { period: 'hour', pattern: /(?:per\s+hour|hourly|taux\s+horaire)[^\d]{0,20}$/i },
  { period: 'day', pattern: /(?:day\s*rate|daily\s+rate|\bTJM\b|tarif\s+journalier)[^\d]{0,20}$/i },
  { period: 'month', pattern: /(?:per\s+month|monthly|par\s+mois|mensuel)[^\d]{0,20}$/i },
  { period: 'yr', pattern: /(?:per\s+annum|annual(?:ly)?|par\s+an|brut\s+annuel|base\s+salary)[^\d]{0,20}$/i },
];

/**
 * Figures introduced by these words are never salaries, however plausible their
 * magnitude ("Welcome bonus: $2,000", "raised $50M", "ARR of €3M").
 */
const NOT_PAY = /\b(?:bonus|prime\s+de|referral|refer\s+a\s+friend|rais(?:ed|ing)|funding|fundrais|valuation|revenue|\bARR\b|\bMRR\b|turnover|chiffre\s+d'affaires|series\s+[a-e]\b|budget|investment|invested|grant|prize|reward|cashback|discount|meal\s+voucher|meal\s+allowance|tickets?\s+restaurant|swile|luncheon|followers|abonn[eé]s|downloads|utilisateurs)\b/i;

const RANGE_SEPARATOR = /^\s*(?:\/\s*[A-Za-z]{1,6}\.?)?\s*(?:-|–|—|to\b|and\b|[àa]\b|~|\.\.)\s*(?:[$€£]|\b(?:EUR|USD|GBP)\b)?\s*$/i;

/** Bare upper bound of a range whose currency sits on the lower bound ("USD 121125-163875"). */
const BARE_HIGH = /^\s*(?:-|–|—|to\b|[àa]\b)\s*(\d[\d.,\u00a0\u202f ]*\d|\d)\s?([kKmM])?/i;

/** Bare lower bound of a range whose currency sits on the upper bound ("70-90k€"). */
const BARE_LOW = /(\d[\d.,  ]*\d|\d)\s?([kKmM])?\s*(?:-|–|—|to\b|[àa]\b)\s*$/i;

/** "1 234,56" / "1,234.56" / "1.234" all mean the same magnitude here. */
function parseAmount(digits: string, multiplier?: string): number {
  const m = (multiplier || '').toLowerCase();
  const compact = digits.replace(/[\s\u00a0\u202f]/g, '');

  // "60,4K GBP" is 60.4 thousand, not 604 thousand: alongside a k/m multiplier,
  // a lone separator trailed by one or two digits is a decimal point.
  const isDecimal = /^\d{1,3}[.,]\d{1,2}$/.test(compact) && (Boolean(m) || compact.includes('.'));
  const cleaned = isDecimal
    ? compact.replace(',', '.')
    : compact.replace(/[.,]/g, '');

  let value = Number(cleaned);
  if (!Number.isFinite(value)) return NaN;
  if (m === 'k') value *= 1_000;
  if (m === 'm') value *= 1_000_000;
  return value;
}

function formatAmount(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

/** Explicit period marker after or before the figure; defaults to yearly. */
function detectPeriod(text: string, token: MoneyToken): { period: Period; explicit: boolean } {
  const after = text.slice(token.end, token.end + 24);
  for (const { period, pattern } of PERIOD_PATTERNS) {
    if (pattern.test(after)) return { period, explicit: true };
  }

  const before = text.slice(Math.max(0, token.start - 40), token.start);
  for (const { period, pattern } of PERIOD_BEFORE) {
    if (pattern.test(before)) return { period, explicit: true };
  }

  return { period: 'yr', explicit: false };
}

function collectTokens(text: string): MoneyToken[] {
  const tokens: MoneyToken[] = [];

  for (const match of text.matchAll(MONEY)) {
    const [raw, curBefore, numBefore, multBefore, numAfter, multAfter, curAfter] = match;
    const symbol = CURRENCY_SYMBOLS[(curBefore || curAfter || '').toUpperCase()]
      ?? CURRENCY_SYMBOLS[curBefore || curAfter || ''];
    if (!symbol) continue;

    const value = parseAmount(numBefore ?? numAfter, multBefore ?? multAfter);
    if (!Number.isFinite(value) || value <= 0) continue;

    tokens.push({
      value,
      currency: symbol,
      start: match.index ?? 0,
      end: (match.index ?? 0) + raw.length,
    });
  }

  return tokens;
}

/**
 * Extract the pay quoted in a post.
 *
 * Returns a normalised string, several entries separated by "; " when a post
 * advertises more than one distinct figure, or "" when nothing plausible is
 * found.
 */
export function detectSalary(text: string): string {
  if (!text) return '';

  const tokens = collectTokens(text);
  if (tokens.length === 0) return '';

  const found: Array<{ currency: string; period: Period; low: number; high: number | null }> = [];
  let index = 0;

  while (index < tokens.length) {
    const token = tokens[index];

    // Anything introduced as a bonus, raise, or revenue figure is not pay.
    if (NOT_PAY.test(text.slice(Math.max(0, token.start - 70), token.start))) {
      index++;
      continue;
    }

    const { period, explicit } = detectPeriod(text, token);

    // Pair with the next figure when only a range separator sits between them.
    let low = token.value;
    let high: number | null = null;
    let consumed = 1;

    const next = tokens[index + 1];
    if (next && next.currency === token.currency && RANGE_SEPARATOR.test(text.slice(token.end, next.start))) {
      const nextPeriod = detectPeriod(text, next);
      if (next.value > token.value && (nextPeriod.period === period || !nextPeriod.explicit || !explicit)) {
        high = next.value;
        consumed = 2;
      }
    }

    // "USD 121125-163875": the upper bound carries no currency of its own.
    if (high === null) {
      const bareHigh = BARE_HIGH.exec(text.slice(token.end, token.end + 32));
      if (bareHigh) {
        const candidate = parseAmount(bareHigh[1], bareHigh[2] || undefined);
        if (Number.isFinite(candidate) && candidate > token.value) {
          high = candidate;
        }
      }
    }

    // "70-90k€": the lower bound carries no currency of its own.
    if (high === null) {
      const bareLow = BARE_LOW.exec(text.slice(Math.max(0, token.start - 30), token.start));
      if (bareLow) {
        const candidate = parseAmount(bareLow[1], bareLow[2] || undefined);
        // Reuse the upper bound's multiplier when the low side omits it ("70-90k").
        const scaled = candidate < token.value ? candidate : parseAmount(bareLow[1], undefined);
        if (Number.isFinite(scaled) && scaled > 0 && scaled < token.value) {
          high = token.value;
          low = scaled;
        }
      }
    }

    const bounds = PLAUSIBLE[period];
    const inRange = (v: number) => v >= bounds.min && v <= bounds.max;

    if (inRange(low) && (high === null || inRange(high))) {
      found.push({ currency: token.currency, period, low, high });
    }

    index += consumed;
  }

  // A post often repeats a range and then its bounds separately; keep the range.
  const rangeBounds = new Set(
    found
      .filter(f => f.high !== null)
      .flatMap(f => [`${f.currency}|${f.period}|${f.low}`, `${f.currency}|${f.period}|${f.high}`])
  );

  const entries: string[] = [];
  const seen = new Set<string>();

  for (const f of found) {
    if (f.high === null && rangeBounds.has(`${f.currency}|${f.period}|${f.low}`)) {
      continue;
    }
    const amount = f.high === null
      ? formatAmount(f.low)
      : `${formatAmount(f.low)}-${formatAmount(f.high)}`;
    const entry = f.currency === '€'
      ? `${amount}€/${f.period}`
      : `${f.currency}${amount}/${f.period}`;
    if (!seen.has(entry)) {
      seen.add(entry);
      entries.push(entry);
    }
  }

  return entries.slice(0, 3).join('; ');
}
