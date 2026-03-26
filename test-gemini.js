
const fs = require('fs');
const path = require('path');

async function test() {
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
        console.error('No API key'); return;
    }

    const styleGuidePath = path.join(process.cwd(), 'prompts', 'style_guide.json');
    const styleGuideData = JSON.parse(fs.readFileSync(styleGuidePath, 'utf-8'));

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
    }
  ]
}`;

    // Mock trendData
    const userPrompt = `Generate 8 LinkedIn posts using this context. CRITICAL: Reference the specific startup names and products listed below, and wrap them in a personal observation or hard-earned lesson. Don't generalize—name them explicitly.

WEEK FOCUS & VERTICAL:
{ "week": 1, "focus_topic": "AI-Native CRM Platforms" }

TRENDING STARTUPS & PRODUCTS:
- Attio CRM (100 points)

EXECUTION REMINDERS:
- Tone: Practitioner-to-practitioner.
- Format: 150-300 words per post. Short paragraphs.
- Storytelling: Every post MUST convey a core message or personal story.
- Output: Strict JSON format.

NOW GENERATE 8 POSTS.`;

    const model = 'gemini-2.5-pro';

    console.log(`Trying ${model}...`);
    const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: systemPrompt }, { text: userPrompt }] }],
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 2048,
                },
            }),
        }
    );
    if (!res.ok) {
        console.error('Failed', res.status, await res.text());
        return;
    }
    const data = await res.json();
    console.log('Success!', JSON.stringify(data, null, 2));
}

test();
