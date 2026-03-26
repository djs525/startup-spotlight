'use client';

import { useState } from 'react';

interface Post {
  post: string;
  hook_type: string;
  credibility_moves: string[];
  word_count: number;
}

interface GeneratedResponse {
  success: boolean;
  week: number;
  focus_topic: string;
  posts: Post[];
  generated_at: string;
  error?: string;
}

export default function Home() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusTopic, setFocusTopic] = useState<string>('');
  const [week, setWeek] = useState<number>(0);

  const generatePosts = async () => {
    setLoading(true);
    setError(null);
    setPosts([]);

    try {
      const response = await fetch('/api/generate');
      const data: GeneratedResponse = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || 'Failed to generate posts');
        return;
      }

      setPosts(data.posts || []);
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
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-3">
            Startup Spotlight
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Generate high-engagement LinkedIn posts powered by AI trends
          </p>
        </div>

        {/* Generate Button */}
        <div className="mb-12 text-center">
          <button
            onClick={generatePosts}
            disabled={loading}
            className="inline-flex items-center justify-center px-8 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Generating...' : 'Generate Posts'}
          </button>
          {loading && <p className="text-sm text-gray-500 mt-2">This may take 15-30 seconds...</p>}
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 font-medium">Error: {error}</p>
          </div>
        )}

        {/* Focus Topic */}
        {focusTopic && (
          <div className="mb-8 p-6 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-gray-600 dark:text-gray-400">Week {week}</p>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{focusTopic}</h2>
          </div>
        )}

        {/* Posts Grid */}
        {posts.length > 0 && (
          <div className="space-y-6">
            {posts.map((post, idx) => (
              <div key={idx} className="p-6 bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-700 hover:shadow-lg transition-shadow">
                {/* Post Text */}
                <p className="text-gray-900 dark:text-gray-100 leading-relaxed whitespace-pre-wrap mb-4">
                  {post.post}
                </p>

                {/* Metadata */}
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="px-2 py-1 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 rounded">
                    Hook: {post.hook_type}
                  </span>
                  <span className="px-2 py-1 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 rounded">
                    {post.word_count} words
                  </span>
                  {post.credibility_moves?.length > 0 && (
                    <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded">
                      {post.credibility_moves.join(', ')}
                    </span>
                  )}
                </div>

                {/* Copy Button */}
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(post.post);
                    alert('Post copied to clipboard!');
                  }}
                  className="mt-4 w-full py-2 px-4 text-sm font-medium text-blue-600 dark:text-blue-400 border border-blue-600 dark:border-blue-400 rounded hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors"
                >
                  Copy Post
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && posts.length === 0 && !error && (
          <div className="text-center text-gray-500">
            <p>Click "Generate Posts" to get started</p>
          </div>
        )}
      </main>
    </div>
  );
}
