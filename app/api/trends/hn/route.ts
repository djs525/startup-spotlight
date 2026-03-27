import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

interface HNStory {
  title: string;
  url: string;
  points: number;
  num_comments: number;
}

export async function GET() {
  try {
    const query = 'CRM+AI';
    const url = `https://hn.algolia.com/api/v1/search?query=${query}&tags=story&hitsPerPage=5`;

    const response = await fetch(url, {
      cache: 'no-store',
      headers: {
        'User-Agent': 'Startup-Spotlight/1.0',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `HN API returned ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    const stories: HNStory[] = (data.hits || [])
      .map((hit: any) => ({
        title: hit.title || 'Untitled',
        url: hit.url || '#',
        points: hit.points || 0,
        num_comments: hit.num_comments || 0,
      }))
      .slice(0, 5);

    return NextResponse.json({
      source: 'hacker_news',
      query: query,
      count: stories.length,
      stories,
      fetched_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('HN Fetcher Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch HN trends', details: String(error) },
      { status: 500 }
    );
  }
}
