import { NextResponse } from 'next/server';
import { GET as getHnTrends } from './hn/route';
import { GET as getRedditTrends } from './reddit/route';
import path from 'path';
import fs from 'fs';

export const dynamic = 'force-dynamic';

export async function GET(requestOrWeek?: Request | number) {
  try {
    let weekInMonth = 1;

    if (typeof requestOrWeek === 'number') {
      weekInMonth = requestOrWeek;
    } else if (requestOrWeek && 'url' in requestOrWeek) {
      const url = new URL(requestOrWeek.url);
      weekInMonth = parseInt(url.searchParams.get('week') || '1', 10);
    }

    if (weekInMonth < 1 || weekInMonth > 4) weekInMonth = 1;

    const configPath = path.join(process.cwd(), 'config', 'month1.json');
    const configData = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const currentWeek = configData.weeks[weekInMonth - 1] || configData.weeks[0];

    const [hnResponse, redditResponse] = await Promise.all([
      getHnTrends(),
      getRedditTrends(),
    ]);

    const hnData = hnResponse.status === 200 ? await hnResponse.json() : { stories: [], error: 'Failed to fetch HN' };
    const redditData = redditResponse.status === 200 ? await redditResponse.json() : { posts: [], error: 'Failed to fetch Reddit' };

    return NextResponse.json({
      startup: {
        week: currentWeek.week,
        focus_topic: currentWeek.focus_topic,
        description: currentWeek.description,
      },
      trends: {
        hacker_news: hnData.stories || [],
        reddit: redditData.posts || [],
      },
      metadata: {
        industry: configData.industry,
        month: configData.month,
        generated_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Combined Trends Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch combined trends', details: String(error) },
      { status: 500 }
    );
  }
}
