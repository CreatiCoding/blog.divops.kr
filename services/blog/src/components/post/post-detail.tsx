'use client';

import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';

type PostDetailProps = {
  title: string;
  category: string | null;
  content: string;
  coverImage: string | null;
  publishedAt: string | null;
  author: { name: string | null; image: string | null } | null;
};

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
      <header className="mb-12 pt-4">
        {category && (
          <span className="inline-block text-[14px] font-semibold text-blue-500 mb-4">
            {category}
          </span>
        )}
        <h1 className="text-[36px] md:text-[42px] font-bold leading-tight tracking-tight text-gray-900 break-keep">
          {title}
        </h1>
        <div className="flex items-center gap-3 mt-6 text-[14px] text-gray-400">
          {author?.image && (
            <Image
              src={author.image}
              alt={author.name ?? ''}
              width={28}
              height={28}
              className="rounded-full"
            />
          )}
          {author?.name && (
            <span className="font-medium text-gray-600">{author.name}</span>
          )}
          {author?.name && publishedAt && (
            <span className="text-gray-300">{'·'}</span>
          )}
          {publishedAt && (
            <time dateTime={publishedAt}>
              {new Date(publishedAt).toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </time>
          )}
        </div>
      </header>
      {coverImage && (
        <Image
          src={coverImage}
          alt={title}
          width={800}
          height={400}
          className="w-full rounded-2xl mb-12 object-cover"
          priority
        />
      )}
      <div className="prose prose-lg max-w-none">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw, rehypeHighlight]}
          components={{
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
