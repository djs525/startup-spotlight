import { NextResponse } from 'next/server';
import { GET as getTrends } from '../trends/route';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
import path from 'path';
import fs from 'fs';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const selectedWeek = parseInt(searchParams.get('week') || '1', 10);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Missing GEMINI_API_KEY environment variable' },
        { status: 400 }
      );
    }

    // Fetch trends directly via the handler rather than a network request
    const trendsResponse = await getTrends(selectedWeek);
    if (trendsResponse.status !== 200) {
      return NextResponse.json(
        { error: 'Failed to fetch trends internally' },
        { status: 500 }
      );
    }
    const trendsData = await trendsResponse.json();

    // Read style guide
    const styleGuidePath = path.join(process.cwd(), 'prompts', 'style_guide.json');
    const styleGuideData = JSON.parse(fs.readFileSync(styleGuidePath, 'utf-8'));

    // Build prompt for Gemini
    const systemPrompt = `You are an elite B2B SaaS LinkedIn ghostwriter specializing in Vertical AI & CRM Automation for an audience of founders, sales operators, and RevOps professionals.

Your task is to generate 5 unique, high-engagement LinkedIn posts based on the latest trends and our brand style guide.

Here is your strictly enforced STYLE GUIDE outlining the formatting, tone, and hooks that yield top 1% engagement:
${JSON.stringify(styleGuideData, null, 2)}

CRITICAL INSTRUCTIONS:
- You MUST convey a core message or share a relatable personal story/observation in every single post to capture the reader's attention. Frame insights as hard-earned lessons or first-hand observations, NOT as news reports.
- DIRECTLY cite specific startups, products, and companies from the provided HN/Reddit trends. Do not invent details.
- Use real numbers and insights from the trends.
- NO fluff: strictly avoid words like "synergy", "leverage", "disruptive", "unlock", "empower", "seamless", "delve", and "landscape".
- LENGTH & FORMATTING: Each post MUST be fully fleshed out between 150 and 300 words. Do NOT generate single-sentence posts. Write 4-6 short paragraphs (1-2 sentences each), utilizing strategic line breaks.
- The tone should read like a direct Slack message from a practitioner who knows what they are talking about.

THE TRENDS CONTAIN REAL STARTUP NAMES: Use them. Reference Klipy, Dex, OpenClaw, Rownd, BasaltCRM, or whatever is in the active trends payload by name when relevant.

RETURN FORMAT:
Return ONLY valid JSON (no markdown, no code blocks):
{
  "posts": [
    {
      "post": "Paragraph one goes here.\\n\\nParagraph two goes here (150+ words total)...",
      "hook_type": "contrarian_claim|number_or_stat|short_punchy_sentence|question|bold_statement",
      "credibility_moves": ["named_company", "specific_numbers", "named_tool"],
      "word_count": 185
    }
  ]
}`;

    const userPrompt = `Generate 5 LinkedIn posts using this context. CRITICAL: Reference the specific startup names and products listed below, and wrap them in a personal observation or hard-earned lesson. Don't generalize—name them explicitly.

WEEK FOCUS & VERTICAL:
${JSON.stringify(trendsData.startup, null, 2)}

TRENDING STARTUPS & PRODUCTS (from Hacker News):
${trendsData.trends.hacker_news
        .map((story: any) => `- ${story.title} (${story.points} points, ${story.num_comments} comments)`)
        .join('\n')}

TRENDING DISCUSSIONS (from Reddit r/sales & r/startups):
${trendsData.trends.reddit
        .map((post: any) => `- r/${post.subreddit}: "${post.title}" (${post.upvotes} upvotes)`)
        .join('\n')}

EXECUTION REMINDERS:
- Tone: Practitioner-to-practitioner. Hook the reader immediately.
- Format: ABSOLUTE MINIMUM 150 words per post. Write 4-6 distinct short paragraphs.
- JSON STRICTNESS: Use "\\n\\n" for paragraph breaks inside strings! NEVER use raw unescaped physical line breaks inside the "post" string or JSON.parse will crash.
- Storytelling: Every single post MUST convey a compelling core message anchored in a relatable personal story or observation. Make it feel authentic, not like AI slop.
- Output: Strict JSON format matching the schema requested.

NOW GENERATE 5 POSTS. Make each one distinct. Ground them in the trends above, not in invented scenarios.`;

    // Call Gemini API with fallback models
    const models = [
      'gemini-2.5-pro',
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
    ];

    let geminiResponse;
    let lastError;

    for (const model of models) {
      try {
        geminiResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    { text: systemPrompt },
                    { text: userPrompt },
                  ],
                },
              ],
              generationConfig: {
                temperature: 0.7,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 8192,
                responseMimeType: "application/json",
              },
            }),
          }
        );

        // If successful, break out of loop
        if (geminiResponse.ok) {
          console.log(`✓ Generated with ${model}`);
          break;
        }

        // If 404 or unavailable, try next model
        lastError = await geminiResponse.text();
        console.warn(`✗ ${model} failed, trying next...`);
      } catch (error) {
        lastError = String(error);
        console.warn(`✗ ${model} error, trying next...`);
      }
    }

    if (!geminiResponse?.ok) {
      console.error('All models failed:', lastError);
      return NextResponse.json(
        { error: 'Failed to generate posts (all models unavailable)', details: lastError },
        { status: 503 }
      );
    }

    const geminiData = await geminiResponse.json();
    const generatedContent = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedContent) {
      return NextResponse.json(
        { error: 'No content generated from Gemini' },
        { status: 500 }
      );
    }

    // Parse JSON from response
    let posts: any;
    try {
      let cleanContent = generatedContent.replace(/```json\s*/ig, '').replace(/```\s*/g, '').trim();

      // Find the outermost JSON container (could be array or object)
      const firstCurly = cleanContent.indexOf('{');
      const firstSquare = cleanContent.indexOf('[');
      const lastCurly = cleanContent.lastIndexOf('}');
      const lastSquare = cleanContent.lastIndexOf(']');

      // Identify the first occurrence that's valid
      const startIdx = Math.min(
        firstCurly === -1 ? Infinity : firstCurly,
        firstSquare === -1 ? Infinity : firstSquare
      );

      const endIdx = Math.max(lastCurly, lastSquare);

      if (startIdx === Infinity || endIdx === -1) {
        throw new Error('No JSON objects or arrays found. Raw text: ' + generatedContent);
      }

      let jsonString = cleanContent.substring(startIdx, endIdx + 1);

      const parsed = JSON.parse(jsonString);
      posts = parsed.posts || parsed;
      if (!Array.isArray(posts)) {
        posts = [posts];
      }

    } catch (parseError) {
      console.error('JSON Parse Error:', parseError);
      return NextResponse.json(
        { error: 'Failed to parse generated posts', raw: generatedContent.substring(0, 500) },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      week: trendsData.startup.week,
      focus_topic: trendsData.startup.focus_topic,
      posts: Array.isArray(posts) ? posts : (posts?.posts || posts),
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Generate Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate posts', details: String(error) },
      { status: 500 }
    );
  }
}
