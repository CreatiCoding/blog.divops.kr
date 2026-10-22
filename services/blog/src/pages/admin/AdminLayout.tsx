import { useEffect, useState } from 'react';
import { Link, Navigate, Outlet, useLocation } from 'react-router';

type Session = { user: { name: string | null; id: string } } | null;

export function AdminLayout() {
  const { pathname } = useLocation();
  const [session, setSession] = useState<Session | undefined>(undefined);

  useEffect(() => {
    fetch('/api/auth/session')
      .then((res) => res.json())
      .then((data: Session) => {
        if (!data?.user) {
          window.location.href = '/api/auth/signin';
          return;
        }
        setSession(data);
      })
      .catch(() => setSession(null));
  }, []);

  if (pathname === '/admin' || pathname === '/admin/') return <Navigate to="/admin/posts" replace />;
  if (!session) return null;

  return (
    <div className="min-h-screen bg-[#f8f9fb] dark:bg-gray-950">
      <nav className="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200/60 dark:border-gray-800/60">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Link
              to="/admin/posts"
              className="px-3 py-1.5 text-[15px] font-semibold text-gray-900 dark:text-gray-100 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              Admin
            </Link>
            <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-2" />
            <Link
              to="/admin/write"
              className="px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
            >
              Write
            </Link>
            <Link
              to="/admin/posts"
              className="px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
            >
              Posts
            </Link>
            <Link
              to="/admin/stats"
              className="px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
            >
              Stats
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 dark:text-gray-500 px-2.5 py-1 rounded-full">
              {session.user.name}
            </span>
            <a
              href="/"
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              View Blog &rarr;
            </a>
          </div>
        </div>
      </nav>
      <main className="max-w-6xl mx-auto px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
