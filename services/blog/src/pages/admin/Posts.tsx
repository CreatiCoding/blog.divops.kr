import { useEffect, useState } from 'react';
import { Link } from 'react-router';

type AdminPost = {
  id: string;
  title: string;
  category: string | null;
  published: boolean;
  createdAt: string;
};

export function AdminPostsPage() {
  const [allPosts, setAllPosts] = useState<AdminPost[] | null>(null);

  useEffect(() => {
    fetch('/api/admin/posts')
      .then((res) => (res.ok ? res.json() : []))
      .then(setAllPosts)
      .catch(() => setAllPosts([]));
  }, []);

  if (!allPosts) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-sm text-gray-400 dark:text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Posts</h1>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">{allPosts.length} posts total</p>
        </div>
        <Link
          to="/admin/write"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-medium rounded-lg cursor-pointer hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors shadow-sm"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="8" y1="3" x2="8" y2="13"/><line x1="3" y1="8" x2="13" y2="8"/></svg>
          New Post
        </Link>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200/60 dark:border-gray-800/60 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Title</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Category</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Status</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Date</th>
            </tr>
          </thead>
          <tbody>
            {allPosts.map((post, i) => (
              <tr
                key={post.id}
                className={`group hover:bg-gray-50/80 dark:hover:bg-gray-800/50 transition-colors ${
                  i < allPosts.length - 1 ? 'border-b border-gray-50 dark:border-gray-800/50' : ''
                }`}
              >
                <td className="px-5 py-3.5">
                  <Link
                    to={`/admin/write?edit=${post.id}`}
                    className="text-sm font-medium text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors"
                  >
                    {post.title}
                  </Link>
                </td>
                <td className="px-5 py-3.5">
                  {post.category ? (
                    <span className="inline-flex items-center text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded-md">
                      {post.category}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-300 dark:text-gray-600">&mdash;</span>
                  )}
                </td>
                <td className="px-5 py-3.5">
                  {post.published ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-md">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                      Published
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded-md">
                      <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                      Draft
                    </span>
                  )}
                </td>
                <td className="px-5 py-3.5 text-xs text-gray-400 dark:text-gray-500">
                  {new Date(post.createdAt).toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </td>
              </tr>
            ))}
            {allPosts.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-16 text-center">
                  <p className="text-sm text-gray-400 dark:text-gray-500">No posts yet</p>
                  <Link
                    to="/admin/write"
                    className="inline-block mt-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                  >
                    Create your first post &rarr;
                  </Link>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
