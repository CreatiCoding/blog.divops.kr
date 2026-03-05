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
    <div className="min-h-screen">
      <nav className="bg-gray-900 text-white px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/admin/posts" className="font-bold text-lg">
            Admin
          </Link>
          <Link href="/admin/write" className="text-gray-300 hover:text-white">
            Write
          </Link>
          <Link href="/admin/posts" className="text-gray-300 hover:text-white">
            Posts
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">{session.user.name}</span>
          <Link href="/" className="text-sm text-gray-400 hover:text-white">
            Blog
          </Link>
        </div>
      </nav>
      <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
