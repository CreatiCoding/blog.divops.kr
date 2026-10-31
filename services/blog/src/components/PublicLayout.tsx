import { Outlet } from 'react-router';
import { ThemeToggle } from './ThemeToggle';
import { PageTracker } from './PageTracker';
import { VisitorCounter } from './VisitorCounter';

export function PublicLayout() {
  return (
    <>
      <header className="sticky top-0 z-50 bg-white/70 dark:bg-gray-950/70 backdrop-blur-xl border-b border-gray-100/80 dark:border-gray-800/80">
        <nav className="max-w-[720px] mx-auto px-6 h-14 flex items-center justify-between">
          <a
            href="/"
            className="text-[15px] font-semibold text-gray-900 dark:text-gray-100 hover:text-gray-500 dark:hover:text-gray-400 transition-colors"
          >
            blog.divops.kr
          </a>
          <div className="flex items-center gap-3">
            <VisitorCounter />
            <ThemeToggle />
          </div>
        </nav>
      </header>
      <PageTracker />
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-gray-100/80 dark:border-gray-800/80">
        <div className="max-w-[720px] mx-auto px-6 py-10">
          <p className="text-[13px] text-gray-500 dark:text-gray-400">
            &copy; {new Date().getFullYear()} divops.kr
          </p>
        </div>
      </footer>
    </>
  );
}
