/**
 * Test runner for LinkedIn search posts
 * Run directly with: npx tsx src/tools/search-posts/test-runner.ts
 */

import { searchLinkedInPosts } from './crawler.js';

console.log('🧪 Testing LinkedIn post search...\n');
console.log('📝 Note: This test uses the core function without database writes\n');

// Test using the core function directly (no database operations)
searchLinkedInPosts(
  '"ai engineering" AND "junior" AND "remote"',
  2,
  { concurrency: 8 }
)
  .then(results => {
    console.log('\n✅ Test completed!');
    console.log(`\n📊 Results: Found ${results.length} posts`);
    
    // Show first few results
    results.slice(0, 3).forEach((post, index) => {
      const preview = post.description.length > 100 
        ? post.description.substring(0, 100) + '...' 
        : post.description;
      console.log(`\n${index + 1}. ${post.link}`);
      console.log(`   ${preview}`);
      if (post.authorName) console.log(`   Author: ${post.authorName}`);
      if (post.postDate) console.log(`   Date: ${post.postDate}`);
    });
    
    console.log('\n💡 Results were NOT saved to database (test mode)');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });



