'use client';

import { useState } from 'react';

// Matches what Agent 5 actually returns:
// A flat list of FinalPost objects — two per draft (one Data hook, one Contrarian hook)
// e.g. 3 drafts → 6 posts: [Data1, Contrarian1, Data2, Contrarian2, Data3, Contrarian3]
interface Post {
  post: string;
  hook_type: string;        // "Data" or "Contrarian"
  credibility_moves: string[];
  word_count: number;
}

// Adjacent pairs from the flat list, grouped for display
interface PostPair {
  data: Post;
  contrarian: Post;
}

interface GeneratedResponse {
  success: boolean;
  week: number;
  focus_topic: string;
  posts: Post[];
  error?: string;
}

const AGENDA = [
  { week: 1, topic: "AI-Native CRM Platforms" },
  { week: 2, topic: "AI Agents for Sales Automation" },
  { week: 3, topic: "Data Intelligence & Enrichment" },
  { week: 4, topic: "Conversational AI & Sales Enablement" },
];

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Agent 5 returns pairs in order [Data, Contrarian, Data, Contrarian, ...]
// This groups them so each card shows both variants for the same draft.
function groupIntoPairs(posts: Post[]): PostPair[] {
  const pairs: PostPair[] = [];
  for (let i = 0; i + 1 < posts.length; i += 2) {
    const a = posts[i];
    const b = posts[i + 1];
    const data = a.hook_type === 'Data' ? a : b;
    const contrarian = a.hook_type === 'Contrarian' ? a : b;
    pairs.push({ data, contrarian });
  }
  // Odd post out — shouldn't happen, but handle gracefully
  if (posts.length % 2 !== 0) {
    const last = posts[posts.length - 1];
    pairs.push({ data: last, contrarian: last });
  }
  return pairs;
}

export default function Home() {
  const [pairs, setPairs] = useState<PostPair[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusTopic, setFocusTopic] = useState('');
  const [week, setWeek] = useState(0);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [activeVariant, setActiveVariant] = useState<Record<number, 'data' | 'contrarian'>>({});

  const generatePosts = async () => {
    setLoading(true);
    setError(null);
    setPairs([]);
    setActiveVariant({});

    try {
      const response = await fetch(`${API_BASE}/generate?week=${selectedWeek}`);
      const data: GeneratedResponse = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || 'Failed to generate posts');
        return;
      }

      setPairs(groupIntoPairs(data.posts || []));
      setFocusTopic(data.focus_topic);
      setWeek(data.week);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white dark:from-black dark:to-zinc-950">
      <main className="max-w-2xl mx-auto py-12 px-6">

        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-3">Startup Spotlight</h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Generate high-engagement LinkedIn posts powered by AI trends
          </p>
        </div>

        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">April Content Agenda</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {AGENDA.map((item) => (
              <button
                key={item.week}
                onClick={() => setSelectedWeek(item.week)}
                className={`p-4 rounded-lg border text-left transition-colors ${selectedWeek === item.week
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-500'
                    : 'border-gray-200 bg-white hover:border-blue-300 dark:bg-zinc-900 dark:border-zinc-700 dark:hover:border-zinc-500'
                  }`}
              >
                <span className="block text-sm font-semibold text-blue-600 dark:text-blue-400 mb-1">Week {item.week}</span>
                <span className="block text-gray-900 dark:text-gray-100 font-medium">{item.topic}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mb-12 text-center">
          <button
            onClick={generatePosts}
            disabled={loading}
            className="inline-flex items-center justify-center px-8 py-3 w-full sm:w-auto rounded-lg bg-blue-600 text-white font-semibold shadow hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all"
          >
            {loading ? 'Running agent pipeline...' : `Generate Posts for Week ${selectedWeek}`}
          </button>
          {loading && (
            <p className="text-sm text-gray-500 mt-3 animate-pulse">
              5 agents running: Research → Score → Memory → Write → Hook Variants
            </p>
          )}
        </div>

        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 font-medium">Error: {error}</p>
          </div>
        )}

        {focusTopic && (
          <div className="mb-8 p-6 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-gray-600 dark:text-gray-400">Week {week}</p>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{focusTopic}</h2>
          </div>
        )}

        {pairs.length > 0 && (
          <div className="space-y-6">
            {pairs.map((pair, idx) => {
              const variant = activeVariant[idx] ?? 'data';
              const activePost = variant === 'data' ? pair.data : pair.contrarian;
              return (
                <div key={idx} className="p-6 bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-700 hover:shadow-lg transition-shadow">
                  <div className="flex gap-2 mb-4">
                    {(['data', 'contrarian'] as const).map((v) => (
                      <button
                        key={v}
                        onClick={() => setActiveVariant(prev => ({ ...prev, [idx]: v }))}
                        className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${variant === v
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'text-gray-600 dark:text-gray-400 border-gray-300 dark:border-zinc-600 hover:border-blue-400'
                          }`}
                      >
                        {v === 'data' ? 'Hook A — Data' : 'Hook B — Contrarian'}
                      </button>
                    ))}
                  </div>
                  <p className="text-gray-900 dark:text-gray-100 leading-relaxed whitespace-pre-wrap mb-4">
                    {activePost.post}
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="px-2 py-1 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 rounded">
                      Hook: {activePost.hook_type}
                    </span>
                    <span className="px-2 py-1 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 rounded">
                      {activePost.word_count} words
                    </span>
                    {activePost.credibility_moves?.length > 0 && (
                      <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded">
                        {activePost.credibility_moves.join(', ')}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => { navigator.clipboard.writeText(activePost.post); alert('Post copied!'); }}
                    className="mt-4 w-full py-2 px-4 text-sm font-medium text-blue-600 dark:text-blue-400 border border-blue-600 dark:border-blue-400 rounded hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors"
                  >
                    Copy Post
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {!loading && pairs.length === 0 && !error && (
          <div className="text-center text-gray-500">
            <p>Click "Generate Posts" to run the agent pipeline</p>
          </div>
        )}
      </main>
    </div>
  );
}