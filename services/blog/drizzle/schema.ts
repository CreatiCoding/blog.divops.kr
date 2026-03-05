import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  boolean,
  integer,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { createId } from './utils';

// ─── Enums ───

export const roleEnum = pgEnum('role', ['USER', 'ADMIN']);

// ─── Auth.js 호환 테이블 ───

export const users = pgTable('user', {
  id: text('id').primaryKey().$defaultFn(createId),
  name: text('name'),
  email: text('email').unique(),
  emailVerified: timestamp('emailVerified', { mode: 'date' }),
  image: text('image'),
  role: roleEnum('role').default('USER').notNull(),
  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
});

export const accounts = pgTable(
  'account',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    userId: text('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('providerAccountId').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (table) => [
    uniqueIndex('account_provider_providerAccountId_key').on(
      table.provider,
      table.providerAccountId
    ),
  ]
);

export const sessions = pgTable('session', {
  id: text('id').primaryKey().$defaultFn(createId),
  sessionToken: text('sessionToken').notNull().unique(),
  userId: text('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
});

export const verificationTokens = pgTable(
  'verificationToken',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull().unique(),
    expires: timestamp('expires', { mode: 'date' }).notNull(),
  },
  (table) => [
    uniqueIndex('verificationToken_identifier_token_key').on(
      table.identifier,
      table.token
    ),
  ]
);

// ─── 블로그 테이블 ───

export const posts = pgTable(
  'post',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    title: text('title').notNull(),
    slug: text('slug').notNull().unique(),
    content: text('content').notNull(),
    excerpt: text('excerpt'),
    coverImage: text('coverImage'),
    published: boolean('published').default(false).notNull(),
    publishedAt: timestamp('publishedAt', { mode: 'date' }),
    authorId: text('authorId')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('post_slug_idx').on(table.slug),
    index('post_published_publishedAt_idx').on(
      table.published,
      table.publishedAt
    ),
  ]
);
