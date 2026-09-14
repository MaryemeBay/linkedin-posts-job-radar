/**
 * Parsing for LinkedIn's content-search results page.
 *
 * Result cards are read through `role="listitem"` and `data-testid`, not through
 * label text: LinkedIn renders its chrome in the account's own language
 * ("Post du fil d'actualite", "Suivre"), so anything keyed on English finds
 * nothing on a non-English account.
 *
 * A post's permalink is the one thing absent from the DOM; crawler.ts recovers
 * it from the page's payloads and pairs it back up by `authorHandle`.
 */

import { Page } from 'playwright';

export const CARD_SELECTOR = '[role="listitem"]';

export interface ParsedPost {
  description: string;
  /** Vanity handle ("jane-doe-1a2b3c") or company slug, used to find the link. */
  authorHandle?: string;
  authorName?: string;
  authorOccupation?: string;
  profileImage?: string;
  postDate?: string;
  likeCount?: string;
  commentCount?: string;
}

/**
 * Read every result card currently rendered.
 *
 * The callback below deliberately declares no named helper functions. Playwright
 * ships its source into the browser, and tsx's esbuild transform wraps named
 * functions in a `__name()` call that does not exist in page context.
 */
export const extractCards = async (page: Page): Promise<ParsedPost[]> =>
  page.$$eval(CARD_SELECTOR, (nodes) => {
    /** A relative timestamp, in any language: "3w •", "1 sem •", "17 min •". */
    const DATE = /(\d+\s*\p{L}{1,4})\s*[•·]/u;
    /** The connection-degree badge: "• 2nd", "• 3e et +". */
    const DEGREE = /^[•·]/;
    /** A reaction or comment tally: "32", "1,024", "2K". */
    const TALLY = /^\d[\d.,]*\s*[KMB]?$/;

    return nodes.map((node) => {
      const card = node as HTMLElement;

      // The author is linked twice over, around the avatar and around the name;
      // only the second carries text.
      const authorLinks = Array.from(
        card.querySelectorAll('a[href*="/in/"], a[href*="/company/"]')
      ) as HTMLAnchorElement[];
      const named = authorLinks.filter((a) => ((a as HTMLElement).innerText ?? '').trim().length > 0);
      const authorLink = named[0] ?? authorLinks[0];
      const href = authorLink?.getAttribute('href') ?? '';
      const handle = (href.split('/in/')[1] ?? href.split('/company/')[1] ?? '')
        .split(/[/?#]/)[0];

      // That anchor reads "Jane Doe • 2nd", and the bullet is the same character
      // in every language.
      const linkedName = ((authorLink as HTMLElement | undefined)?.innerText ?? '')
        .split(/[•·]/)[0]
        .replace(/\s+/g, ' ')
        .trim();

      // Line 0 is the card-type label, line 1 the author name.
      const lines = card.innerText.split('\n').map((line) => line.trim()).filter(Boolean);
      const authorName = linkedName || lines[1];

      // The header runs author -> degree badge -> headline -> timestamp, so the
      // timestamp bounds the headline. Company cards have no headline at all.
      const dateIdx = lines.findIndex((line) => DATE.test(line));
      const headline = lines
        .slice(2, dateIdx >= 0 ? dateIdx : 2)
        .find((line) => !DEGREE.test(line));

      const avatar = (authorLink?.querySelector('img[src*="licdn"]') ??
        card.querySelector('img[src*="licdn"]')) as HTMLImageElement | null;

      // Found by icon name, since the aria-label is translated.
      const commentButton = card
        .querySelector('svg[id="comment-small"]')
        ?.closest('button') as HTMLElement | null;
      const commentText = (commentButton?.innerText ?? '').trim();
      const commentCount = TALLY.test(commentText) ? commentText : undefined;

      // The reaction tally is the card's other bare number. Its icon varies with
      // which reactions were used, so it is found by elimination instead.
      const tallies = (Array.from(card.querySelectorAll('*')) as HTMLElement[])
        .filter((el) => el.children.length === 0 && TALLY.test((el.innerText ?? '').trim()))
        .filter((el) => !commentButton || !commentButton.contains(el))
        .map((el) => (el.innerText ?? '').trim());

      const body = card.querySelector('[data-testid="expandable-text-box"]') as HTMLElement | null;

      return {
        description: (body?.innerText ?? '').replace(/[ \t]+/g, ' ').trim(),
        authorHandle: handle || undefined,
        authorName: authorName || undefined,
        authorOccupation: headline || undefined,
        profileImage: avatar?.getAttribute('src') ?? undefined,
        postDate: dateIdx >= 0 ? lines[dateIdx].match(DATE)?.[1].replace(/\s+/g, ' ') : undefined,
        likeCount: tallies[0],
        commentCount,
      };
    });
  });
