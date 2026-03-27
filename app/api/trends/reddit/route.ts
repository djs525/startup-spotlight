import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

interface RedditPost {
  title: string;
  upvotes: number;
  num_comments: number;
  url: string;
  subreddit: string;
}

async function fetchSubreddit(subreddit: string): Promise<RedditPost[]> {
  const url = `https://www.reddit.com/r/${subreddit}/top.json?limit=5&t=week`;

  const response = await fetch(url, {
    cache: 'no-store',
    headers: {
      'User-Agent': 'Startup-Spotlight/1.0 (built with Node.js)',
    },
  });

  if (!response.ok) {
    console.warn(`Reddit API returned ${response.status} for r/${subreddit}`);
    return [];
  }

  const data = await response.json();

  // Parse Reddit's nested response structure
  const posts: RedditPost[] = (data.data?.children || [])
    .map((child: any) => {
      const post = child.data;
      return {
        title: post.title || 'Untitled',
        upvotes: post.ups || 0,
        num_comments: post.num_comments || 0,
        url: post.url || `https://reddit.com${post.permalink}`,
        subreddit: subreddit,
      };
    })
    .slice(0, 5);

  return posts;
}

export async function GET() {
  try {
    // Fetch from both subreddits in parallel
    const [salesPosts, startupsPosts] = await Promise.all([
      fetchSubreddit('sales'),
      fetchSubreddit('startups'),
    ]);

    const allPosts = [...salesPosts, ...startupsPosts];

    return NextResponse.json({
      source: 'reddit',
      subreddits: ['r/sales', 'r/startups'],
      count: allPosts.length,
      posts: allPosts,
      fetched_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Reddit Fetcher Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Reddit trends', details: String(error) },
      { status: 500 }
    );
  }
}
