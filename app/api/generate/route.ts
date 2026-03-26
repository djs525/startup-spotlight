import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export async function GET() {
  try {
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Missing NEXT_PUBLIC_GEMINI_API_KEY environment variable' },
        { status: 400 }
      );
    }

    // Fetch trends
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';

    const trendsResponse = await fetch(`${baseUrl}/api/trends`);
    if (!trendsResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch trends' },
        { status: 500 }
      );
    }
    const trendsData = await trendsResponse.json();

    // Read style guide
    const styleGuidePath = path.join(process.cwd(), 'prompts', 'style_guide.json');
    const styleGuideData = JSON.parse(fs.readFileSync(styleGuidePath, 'utf-8'));

    // Build prompt for Gemini
    const systemPrompt = `You are an elite B2B SaaS LinkedIn ghostwriter specializing in Vertical AI & CRM Automation for an audience of founders, sales operators, and RevOps professionals.

Your task is to generate 8 unique, high-engagement LinkedIn posts based on the latest trends and our brand style guide.

Here is your strictly enforced STYLE GUIDE outlining the formatting, tone, and hooks that yield top 1% engagement:
${JSON.stringify(styleGuideData, null, 2)}

CRITICAL INSTRUCTIONS:
- You MUST convey a core message or share a relatable personal story/observation in every single post to capture the reader's attention. Frame insights as hard-earned lessons or first-hand observations, NOT as news reports.
- DIRECTLY cite specific startups, products, and companies from the provided HN/Reddit trends. Do not invent details.
- Use real numbers and insights from the trends.
- NO fluff: strictly avoid words like "synergy", "leverage", "disruptive", "unlock", "empower", "seamless", "delve", and "landscape".
- SHORT paragraphs: 1-2 sentences max. Use line breaks strategically.
- The tone should read like a direct Slack message from a practitioner who knows what they are talking about.

THE TRENDS CONTAIN REAL STARTUP NAMES: Use them. Reference Klipy, Dex, OpenClaw, Rownd, BasaltCRM, or whatever is in the active trends payload by name when relevant.

RETURN FORMAT:
Return ONLY valid JSON (no markdown, no code blocks):
{
  "posts": [
    {
      "post": "full post text here",
      "hook_type": "contrarian_claim|number_or_stat|short_punchy_sentence|question|bold_statement",
      "credibility_moves": ["named_company", "specific_numbers", "named_tool"],
      "word_count": 142
    },
    ...
  ]
}`;

    const userPrompt = `Generate 8 LinkedIn posts using this context. CRITICAL: Reference the specific startup names and products listed below, and wrap them in a personal observation or hard-earned lesson. Don't generalize—name them explicitly.

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
- Format: 150-300 words per post. Short paragraphs (1-2 sentences).
- Storytelling: Every single post MUST convey a compelling core message anchored in a relatable personal story or observation. Make it feel authentic, not like AI slop.
- Output: Strict JSON format matching the schema requested.

NOW GENERATE 8 POSTS. Make each one distinct. Ground them in the trends above, not in invented scenarios.`;

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
                maxOutputTokens: 2048,
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
      // Strip markdown code blocks
      let cleanContent = generatedContent;

      // Remove ``` markers and the word "json"
      cleanContent = cleanContent.replace(/```json\s*/g, '').replace(/```\s*/g, '');

      // Find the first { and last }
      const firstBrace = cleanContent.indexOf('{');
      const lastBrace = cleanContent.lastIndexOf('}');

      if (firstBrace === -1 || lastBrace === -1) {
        throw new Error('No JSON braces found');
      }

      let jsonString = cleanContent.substring(firstBrace, lastBrace + 1);

      // Try to parse
      try {
        const parsed = JSON.parse(jsonString);
        posts = parsed.posts || parsed;
      } catch (initialError) {
        // If parsing fails, try to salvage what we can
        // Count open vs close braces to find incomplete nesting
        let braceCount = 0;
        let safeEnd = jsonString.length;

        for (let i = jsonString.length - 1; i >= 0; i--) {
          if (jsonString[i] === '}') braceCount++;
          else if (jsonString[i] === '{') braceCount--;

          // When we've balanced braces going backwards, we found a good spot
          if (braceCount === 0 && (jsonString[i] === '}' || jsonString[i] === ']')) {
            // Make sure we're after a complete value
            let truncated = jsonString.substring(0, i + 1);

            // Ensure the JSON ends properly
            if (truncated.endsWith(']')) {
              truncated = truncated + '\n}';
            } else if (truncated.endsWith('}')) {
              // Check if this is the last post in posts array
              if (truncated.includes('"posts"')) {
                truncated = truncated + '\n}';
              }
            }

            try {
              posts = JSON.parse(truncated);
              posts = posts.posts || posts;
              console.log('✓ Recovered partial JSON response');
              break;
            } catch {
              // Continue trying
            }
          }
        }

        if (!posts) {
          // Last resort: try to parse just the complete posts we have
          const postsMatch = jsonString.match(/"posts":\s*\[([\s\S]*)\]/);
          if (postsMatch) {
            // Extract the array content
            let arrayContent = '[' + postsMatch[1];
            // Try to find the last complete object
            const lastCompletePost = arrayContent.lastIndexOf('}');
            if (lastCompletePost !== -1) {
              const truncatedArray = arrayContent.substring(0, lastCompletePost + 1) + ']';
              posts = { posts: JSON.parse(truncatedArray) };
              posts = posts.posts;
            }
          }
        }

        if (!posts) {
          throw initialError;
        }
      }

      // Ensure posts is an array
      if (!Array.isArray(posts)) {
        posts = [posts];
      }

    } catch (parseError) {
      console.error('JSON Parse Error:', parseError);
      return NextResponse.json(
        { error: 'Failed to parse generated posts', raw: generatedContent.substring(0, 2000) },
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
