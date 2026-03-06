'use client';

import type { ReactNode } from 'react';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';
import { generateSlug } from '@/lib/heading-utils';

type PostDetailProps = {
  title: string;
  category: string | null;
  content: string;
  coverImage: string | null;
  publishedAt: string | null;
  author: { name: string | null; image: string | null } | null;
};

function getTextContent(node: ReactNode): string {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (!node) return '';
  if (Array.isArray(node)) return node.map(getTextContent).join('');
  if (typeof node === 'object' && 'props' in node) {
    return getTextContent((node as { props: { children?: ReactNode } }).props.children);
  }
  return '';
}

export function PostDetail({
  title,
  category,
  content,
  coverImage,
  publishedAt,
  author,
}: PostDetailProps) {
  return (
    <article>
      <header className="mb-12 pt-8">
        <div className="flex items-center gap-2.5 mb-5">
          {category && (
            <span className="text-[12px] font-semibold uppercase tracking-wider text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
              {category}
            </span>
          )}
          {publishedAt && (
            <time dateTime={publishedAt} className="text-[13px] text-gray-300 dark:text-gray-600">
              {new Date(publishedAt).toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </time>
          )}
        </div>
        <h1 className="text-[32px] md:text-[38px] font-extrabold leading-[1.25] tracking-tight text-gray-900 dark:text-gray-100 break-keep">
          {title}
        </h1>
        {author?.name && (
          <div className="flex items-center gap-2.5 mt-6">
            {author.image && (
              <Image
                src={author.image}
                alt={author.name}
                width={24}
                height={24}
                className="rounded-full"
              />
            )}
            <span className="text-[13px] text-gray-400 dark:text-gray-500">{author.name}</span>
          </div>
        )}
      </header>
      {coverImage && (
        <Image
          src={coverImage}
          alt={title}
          width={800}
          height={400}
          className="w-full rounded-xl mb-12 object-cover"
          priority
        />
      )}
      <div className="prose prose-lg max-w-none">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw, rehypeHighlight]}
          components={{
            h1: ({ children, ...props }) => {
              const id = generateSlug(getTextContent(children));
              return <h1 id={id} {...props}>{children}</h1>;
            },
            h2: ({ children, ...props }) => {
              const id = generateSlug(getTextContent(children));
              return <h2 id={id} {...props}>{children}</h2>;
            },
            h3: ({ children, ...props }) => {
              const id = generateSlug(getTextContent(children));
              return <h3 id={id} {...props}>{children}</h3>;
            },
            img: ({ src, alt, ...props }) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt={alt ?? ''} loading="lazy" {...props} />
            ),
            a: ({ href, children, ...props }) => (
              <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
                {children}
              </a>
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </article>
  );
}
