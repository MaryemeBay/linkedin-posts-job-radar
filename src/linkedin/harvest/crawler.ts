/**
 * Core LinkedIn search functionality (pure, no database operations)
 */

import { BrowserContext, Page } from 'playwright';
import { launchChromium } from '../chromium.js';
import { loadAuthData, isAuthDataValid } from '../session/credential-store.js';
import { buildSearchUrl } from './query-url.js';
import { CARD_SELECTOR, extractCards, type ParsedPost } from './post-parser.js';
import type { PostResult, SearchOptions } from './contracts.js';

/** Responses carrying search results: the search document, then each page of cards. */
const RESULT_PAYLOAD = /rsc-action\/actions\/pagination|\/search\/results\/content/;

/** Post permalinks, which appear only inside those payloads - never in the DOM. */
const PERMALINK = /https:\/\/www\.linkedin\.com\/posts\/[A-Za-z0-9%._-]+/g;

/** Scrolls with no new posts before the results are treated as exhausted. */
const SETTLE_SCROLLS = 3;

/**
 * Collect post permalinks from the payloads behind the results page. Bodies are
 * read asynchronously, so the pending reads are awaited before the links are used.
 */
const collectPermalinks = (page: Page) => {
  const links: string[] = [];
  const seen = new Set<string>();
  const pending: Promise<unknown>[] = [];

  page.on('response', (response) => {
    if (!RESULT_PAYLOAD.test(response.url())) return;

    pending.push(
      response.text().then(
        (body) => {
          for (const link of body.match(PERMALINK) ?? []) {
            if (seen.has(link)) continue;
            seen.add(link);
            links.push(link);
          }
        },
        () => {} // a response body that is gone by the time it is read
      )
    );
  });

  return {
    links,
    settled: async () => { await Promise.allSettled(pending); },
  };
};

/**
 * Scroll the results list until it stops producing posts. Results live in their
 * own scroll container now, so this takes wheel events - End no longer moves it.
 */
const loadMoreResults = async (page: Page, pagination: number, links: string[]): Promise<void> => {
  const maxScrolls = Math.max(1, pagination) * 6;
  let unchanged = 0;

  for (let i = 0; i < maxScrolls && unchanged < SETTLE_SCROLLS; i++) {
    const before = links.length;

    const viewport = page.viewportSize();
    await page.mouse.move((viewport?.width ?? 1280) / 2, (viewport?.height ?? 720) / 2);
    await page.mouse.wheel(0, 2500);
    await page.waitForTimeout(1500);

    unchanged = links.length === before ? unchanged + 1 : 0;
  }
};

const normalize = (value: string): string => value.replace(/[^a-z0-9]/gi, '').toLowerCase();

/**
 * The author a permalink names. A member's slug reads "<handle>_<words>-
 * <share|ugcPost>-<id>-<code>"; a company's opens with hashtags and names nobody.
 */
const slugAuthor = (link: string): string | null => {
  const slug = decodeURIComponent(link.split('/posts/')[1] ?? '');
  const [prefix] = slug.split('_');
  return prefix && prefix !== slug ? normalize(prefix) : null;
};

/** The slug's words, once the author handle and trailing ids are stripped off. */
const slugTokens = (link: string): string[] => {
  const slug = decodeURIComponent(link.split('/posts/')[1] ?? '')
    .replace(/-(?:share|ugcPost)-\d+-[^-]*$/i, '')
    .replace(/^[^_]*_/, '');

  return slug.split('-').map(normalize).filter(token => token.length >= 4);
};

/**
 * Everything a card says, separators removed, so a slug hashtag ("privateequity")
 * still matches the post's words ("private equity").
 */
const postHaystack = (post: ParsedPost): string =>
  normalize([post.authorName, post.authorOccupation, post.description].join(' '));

/** How much of a link's wording a post must share to be considered its post. */
const MATCH_THRESHOLD = 0.4;

/**
 * Attach each post to its permalink, on the author handle where the slug carries
 * one and on wording only for company posts, whose slugs name nobody.
 *
 * A post that matches nothing is dropped: without a link it can neither be
 * stored nor de-duplicated, and a guessed link would be worse than none.
 */
const matchLinks = (posts: ParsedPost[], links: string[]): PostResult[] => {
  const results = new Map<ParsedPost, PostResult>();
  const claimed = new Set<number>();

  // Pass one: link and card name the same person.
  const byHandle = new Map<string, number[]>();
  links.forEach((link, index) => {
    const author = slugAuthor(link);
    if (!author) return;
    byHandle.set(author, [...(byHandle.get(author) ?? []), index]);
  });

  for (const post of posts) {
    const handle = post.authorHandle ? normalize(post.authorHandle) : '';
    if (!handle) continue;

    const index = (byHandle.get(handle) ?? []).find(i => !claimed.has(i));
    if (index === undefined) continue;

    claimed.add(index);
    results.set(post, { ...post, link: links[index] });
  }

  // Pass two: company posts, where only the wording is left to go on.
  const candidates: { post: ParsedPost; link: number; score: number }[] = [];
  for (const post of posts) {
    if (results.has(post)) continue;

    const haystack = postHaystack(post);
    links.forEach((link, index) => {
      if (claimed.has(index) || slugAuthor(link)) return;

      const tokens = slugTokens(link);
      if (!tokens.length) return;

      const score = tokens.filter(token => haystack.includes(token)).length / tokens.length;
      if (score > MATCH_THRESHOLD) candidates.push({ post, link: index, score });
    });
  }

  // Strongest pairings settle first, so a weaker one cannot claim the link.
  candidates.sort((a, b) => b.score - a.score);

  for (const { post, link } of candidates) {
    if (results.has(post) || claimed.has(link)) continue;

    claimed.add(link);
    results.set(post, { ...post, link: links[link] });
  }

  // Restore the order the results were shown in.
  return posts.flatMap(post => {
    const result = results.get(post);
    return result ? [result] : [];
  });
};

/**
 * Perform LinkedIn post search
 * This is the core function that handles the entire search process
 * NO database operations - returns pure results
 */
const performSearch = async (
  context: BrowserContext,
  keywords: string,
  pagination: number
): Promise<PostResult[]> => {
  const page = await context.newPage();
  const permalinks = collectPermalinks(page);

  try {
    await page.goto(buildSearchUrl(keywords), { waitUntil: 'domcontentloaded' });

    // A search that matched nothing renders no cards either, so this is not an
    // error - but it is worth telling apart from a page that never loaded.
    const rendered = await page
      .waitForSelector(CARD_SELECTOR, { timeout: 30000 })
      .then(() => true)
      .catch(() => false);

    if (!rendered) {
      console.error(`No result cards rendered for "${keywords}" - LinkedIn returned no results, or the page did not finish loading.`);
      return [];
    }

    await loadMoreResults(page, pagination, permalinks.links);

    const posts = await extractCards(page);

    await permalinks.settled();
    return matchLinks(posts, permalinks.links);
  } finally {
    try { await page.close(); } catch (_) {}
  }
};

/**
 * Main search function - validates auth, launches browser, performs search
 * Returns post results without any database operations
 *
 * @param keywords - Search keywords
 * @param pagination - How hard to page through the results
 * @param options - Search options (headless mode)
 * @returns Array of post results
 * @throws Error if authentication is invalid or search fails
 */
export const searchLinkedInPosts = async (
  keywords: string,
  pagination: number = 3,
  options: SearchOptions = {}
): Promise<PostResult[]> => {
  const authData = await loadAuthData();
  if (!authData || !await isAuthDataValid(authData)) {
    throw new Error('No valid LinkedIn authentication found. Please authenticate first.');
  }

  const { headless = false } = options;
  const browser = await launchChromium({ headless });

  try {
    const context = await browser.newContext({ storageState: authData });
    return await performSearch(context, keywords, pagination);
  } finally {
    try { await browser.close(); } catch (_) {}
  }
};
