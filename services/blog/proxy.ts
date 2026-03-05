import { auth } from '@/lib/auth';

export default async function proxy(request: Request) {
  const url = new URL(request.url);

  if (url.pathname.startsWith('/admin')) {
    const session = await auth();
    if (!session?.user) {
      return Response.redirect(new URL('/api/auth/signin', request.url));
    }
  }

  return undefined;
}
