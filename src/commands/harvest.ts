/**
 * MCP handler for LinkedIn search posts tool
 * Orchestrates search and database operations
 */

import path from 'path';
import os from 'os';
import { searchLinkedInPosts } from '../linkedin/harvest/crawler.js';
import { saveSearchResourceToDb } from '../intake/ingest.js';
import type { SearchPostsParams, PostResult } from '../linkedin/harvest/contracts.js';

/**
 * Format post results for MCP response
 */
const formatPostsResponse = (results: PostResult[], keywords: string): string => {
  let responseText = `Found ${results.length} LinkedIn posts for "${keywords}":\n\n`;
  
  results.forEach((post, index) => {
    const preview = post.description.length > 200 
      ? post.description.substring(0, 200) + '...' 
      : post.description;
    
    responseText += `${index + 1}. ${post.link}\n`;
    responseText += `   ${preview}\n\n`;
  });
  
  return responseText;
};

/**
 * Format database save results
 */
const formatDatabaseInfo = (saveResult: {
  totalPosts: number;
  newPostsAdded: number;
  duplicatesSkipped: number;
  outsideAllowedMarkets: number;
  notEmployerVacancy: number;
}): string => {
  const dbPath = path.join(
    process.env.APPDATA || os.homedir(),
    'linkedin-mcp',
    'resources',
    'linkedin.db'
  );
  
  const parts = [`${saveResult.newPostsAdded} new posts added`];
  if (saveResult.duplicatesSkipped > 0) {
    parts.push(`${saveResult.duplicatesSkipped} duplicates skipped`);
  }
  if (saveResult.outsideAllowedMarkets > 0) {
    parts.push(`${saveResult.outsideAllowedMarkets} rejected as outside allowed markets`);
  }
  if (saveResult.notEmployerVacancy > 0) {
    parts.push(`${saveResult.notEmployerVacancy} rejected as non-vacancy or agency posts`);
  }
  const statsInfo = parts.join(', ');
  
  return `\n\n💾 Results saved to database\n` +
         `   ${statsInfo}\n` +
         `   Total posts in database: ${saveResult.totalPosts}\n` +
         `   Database: ${dbPath}`;
};

/**
 * Handle LinkedIn search posts MCP tool
 * This is the MCP-specific handler that:
 * 1. Calls the core search function
 * 2. Saves results to database
 * 3. Formats MCP response
 */
export const handleHarvest = async (params: SearchPostsParams) => {
  const { keywords, pagination = 3, headless = false } = params;
  
  // Validate input
  if (!keywords?.trim()) {
    return {
      content: [{
        type: "text",
        text: "Keywords parameter is required for searching LinkedIn posts."
      }]
    };
  }
  
  try {
    // Call core search function (no database operations)
    const results = await searchLinkedInPosts(keywords, pagination, { headless });
    
    // Handle empty results
    if (results.length === 0) {
      return {
        content: [{
          type: "text",
          text: `No LinkedIn posts found for keywords: "${keywords}"`
        }]
      };
    }
    
    // Save results to database
    let databaseInfo = '';
    try {
      const saveResult = await saveSearchResourceToDb(results, keywords);
      databaseInfo = formatDatabaseInfo(saveResult);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      databaseInfo = `\n\n⚠️ Failed to save to database: ${errorMsg}`;
    }
    
    // Format and return MCP response
    const responseText = formatPostsResponse(results, keywords) + databaseInfo;
    
    return {
      content: [{
        type: "text",
        text: responseText
      }]
    };
    
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error searching LinkedIn posts: ${error instanceof Error ? error.message : 'Unknown error occurred'}`
      }]
    };
  }
};

