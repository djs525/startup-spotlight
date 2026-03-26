import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export async function GET() {
  try {
    // Get the current week (for month1.json rotation)
    const now = new Date();
    const dayOfYear = Math.floor(
      (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000
    );
    const weekOfYear = Math.ceil((dayOfYear + new Date(new Date().getFullYear(), 0, 1).getDay() + 1) / 7);
    // Force Week 1 for the demo (previously calculated based on the current date, which fell into Week 4)
    const weekInMonth = 1;
    // Load month1.json to get the current week's topic
    const configPath = path.join(process.cwd(), 'config', 'month1.json');
    const configData = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const currentWeek = configData.weeks[weekInMonth - 1] || configData.weeks[0];

    // Fetch from both HN and Reddit in parallel
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';

    const [hnResponse, redditResponse] = await Promise.all([
      fetch(`${baseUrl}/api/trends/hn`),
      fetch(`${baseUrl}/api/trends/reddit`),
    ]);

    const hnData = hnResponse.ok ? await hnResponse.json() : { stories: [], error: 'Failed to fetch HN' };
    const redditData = redditResponse.ok ? await redditResponse.json() : { posts: [], error: 'Failed to fetch Reddit' };

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
