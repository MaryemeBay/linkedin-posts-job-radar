import { ensureResourceDirectories } from '../platform/workspace-paths.js';
import type { PostResult } from '../linkedin/harvest/contracts.js';
import { insertPost, countPosts } from '../store/posts-repository.js';
import { resolveCountry } from './location.js';
import { detectSalary } from './compensation.js';
import { screenLocation } from './market-policy.js';
import { screenPost } from './relevance.js';

/**
 * Database save result interface
 */
export interface DbSaveResult {
  totalPosts: number;
  newPostsAdded: number;
  duplicatesSkipped: number;
  outsideAllowedMarkets: number;
  notEmployerVacancy: number;
}

/**
 * Save search results to SQLite database
 * Returns statistics about new posts added and duplicates skipped
 */
export const saveSearchResourceToDb = async (
  results: PostResult[], 
  keywords: string
): Promise<DbSaveResult> => {
  // Ensure resource directories exist before database creation
  ensureResourceDirectories();
  
  const searchDate = new Date().toISOString();
  
  let newPostsAdded = 0;
  let duplicatesSkipped = 0;
  let outsideAllowedMarkets = 0;
  let notEmployerVacancy = 0;
  
  // Try to insert each post
  for (const post of results) {
    // Drop anything that is not an employer advertising an open role: commentary,
    // job-seeker posts, and staffing-agency reposts.
    if (!screenPost(post.description, post.authorOccupation || '').allowed) {
      notEmployerVacancy++;
      continue;
    }
    
    const country = resolveCountry(post.description);
    
    // Screen out roles in markets this search is not aimed at, so they never
    // reach the database instead of being deleted by hand after every run.
    if (!screenLocation(country).allowed) {
      outsideAllowedMarkets++;
      continue;
    }
    
    const id = await insertPost(
      keywords,
      post.link,
      post.description,
      searchDate,
      false, // applied status - default to false for new posts
      post.profileImage || '',
      post.authorName || '',
      post.authorOccupation || '',
      post.postDate || '',
      post.likeCount || '',
      post.commentCount || '',
      country,
      detectSalary(post.description)
    );
    
    if (id !== null) {
      newPostsAdded++;
    } else {
      // insertPost returns null for duplicates (UNIQUE constraint)
      duplicatesSkipped++;
    }
  }
  
  const totalPosts = await countPosts();
  
  return {
    totalPosts,
    newPostsAdded,
    duplicatesSkipped,
    outsideAllowedMarkets,
    notEmployerVacancy
  };
};
