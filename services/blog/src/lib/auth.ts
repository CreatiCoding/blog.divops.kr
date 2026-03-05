import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { db } from './db';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db),
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
      allowDangerousEmailAccountLinking: true,
      profile(profile) {
        return {
          id: String(profile.id),
          name: profile.login,
          email: profile.email,
          image: profile.avatar_url,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ profile }) {
      const allowedUsers = (process.env.AUTH_ALLOWED_USERS ?? '').split(',').map(u => u.trim()).filter(Boolean);
      if (allowedUsers.length === 0) return true;
      return allowedUsers.includes(profile?.login as string);
    },
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        // @ts-expect-error -- role is added by drizzle adapter
        session.user.role = user.role;
      }
      return session;
    },
  },
});
