import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'blog.divops.kr',
    template: '%s | blog.divops.kr',
  },
  description: 'DevOps와 프론트엔드 기술 블로그',
  metadataBase: new URL('https://blog.divops.kr'),
  verification: {
    google: 'zpZHz5nGuK9g_3uNl7twb-q5OZXdG5mpt-g094vneb4',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="min-h-screen flex flex-col">
        <header className="sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b border-gray-100/80">
          <nav className="max-w-[720px] mx-auto px-6 h-14 flex items-center justify-between">
            <Link
              href="/"
              className="text-[15px] font-semibold tracking-tight text-gray-900 hover:text-gray-500 transition-colors"
            >
              divops.kr
            </Link>
          </nav>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-gray-100/80">
          <div className="max-w-[720px] mx-auto px-6 py-10">
            <p className="text-[13px] text-gray-300">
              &copy; {new Date().getFullYear()} divops.kr
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
