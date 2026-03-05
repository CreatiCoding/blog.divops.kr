'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeHighlight from 'rehype-highlight';

type MarkdownEditorProps = {
  content: string;
  onChange: (markdown: string) => void;
};

type EditorMode = 'markdown' | 'preview';

export function MarkdownEditor({ content, onChange }: MarkdownEditorProps) {
  const [mode, setMode] = useState<EditorMode>('markdown');

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="flex border-b bg-gray-50">
        <button
          type="button"
          onClick={() => setMode('markdown')}
          className={`px-4 py-2 text-sm font-medium cursor-pointer transition-colors ${
            mode === 'markdown'
              ? 'bg-white border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          Markdown
        </button>
        <button
          type="button"
          onClick={() => setMode('preview')}
          className={`px-4 py-2 text-sm font-medium cursor-pointer transition-colors ${
            mode === 'preview'
              ? 'bg-white border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          Preview
        </button>
      </div>

      {mode === 'markdown' ? (
        <textarea
          value={content}
          onChange={(e) => onChange(e.target.value)}
          className="w-full p-4 min-h-[500px] font-mono text-sm resize-y outline-none"
          placeholder="Write your markdown here..."
          spellCheck={false}
        />
      ) : (
        <div className="prose max-w-none p-4 min-h-[500px]">
          {content ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw, rehypeHighlight]}
            >
              {content}
            </ReactMarkdown>
          ) : (
            <p className="text-gray-400 italic">No content to preview</p>
          )}
        </div>
      )}
    </div>
  );
}
