import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect('/api/auth/signin');
  }

  return (
    <div className="min-h-screen bg-[#eef0f4]">
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-300/60">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Link
              href="/admin/posts"
              className="px-3 py-1.5 text-[15px] font-semibold text-gray-900 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Admin
            </Link>
            <div className="w-px h-4 bg-gray-200 mx-1" />
            <Link
              href="/admin/write"
              className="px-3 py-1.5 text-sm text-gray-500 rounded-lg hover:bg-gray-100 hover:text-gray-900 transition-colors"
            >
              Write
            </Link>
            <Link
              href="/admin/posts"
              className="px-3 py-1.5 text-sm text-gray-500 rounded-lg hover:bg-gray-100 hover:text-gray-900 transition-colors"
            >
              Posts
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
              {session.user.name}
            </span>
            <Link
              href="/"
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              View Blog &rarr;
            </Link>
          </div>
        </div>
      </nav>
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
