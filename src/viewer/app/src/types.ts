// Type definitions matching database schema

/** Triage rating a reviewer gives a post. */
export type PostVerdict = '' | 'yes' | 'maybe' | 'no'
export interface Post {
  id: number
  search_keywords: string
  post_link: string
  description: string
  search_date: string
  applied: number // 0 or 1 (SQLite boolean)
  verdict: PostVerdict // Triage rating, '' until rated
  profile_image: string
  author_name: string
  author_occupation: string
  post_date: string
  like_count: string
  comment_count: string
  country: string // Comma-separated list inferred from post text
  salary: string // Normalised pay inferred from post text, empty when absent
}


