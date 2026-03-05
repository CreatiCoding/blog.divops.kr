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
    <article className="max-w-3xl mx-auto">
      <header className="mb-8">
        {category && (
          <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium mb-3">
            {category}
          </span>
        )}
        <h1 className="text-4xl font-bold mb-4">{title}</h1>
        <div className="flex items-center gap-3 text-gray-600">
          {author?.image && (
            <Image
              src={author.image}
              alt={author.name ?? ''}
              width={32}
              height={32}
              className="rounded-full"
            />
          )}
          {author?.name && <span>{author.name}</span>}
          {publishedAt && (
            <time dateTime={publishedAt}>
              {new Date(publishedAt).toLocaleDateString('ko-KR')}
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
          className="w-full rounded-lg mb-8 object-cover"
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
