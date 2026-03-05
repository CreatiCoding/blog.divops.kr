'use client';

import { useState, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeHighlight from 'rehype-highlight';

type MarkdownEditorProps = {
  content: string;
  onChange: (markdown: string) => void;
};

type EditorMode = 'markdown' | 'preview';

async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error ?? 'Upload failed');
  }

  const { url } = await res.json();
  return url;
}

function insertTextAtCursor(
  textarea: HTMLTextAreaElement,
  text: string,
  onChange: (value: string) => void,
) {
  const { selectionStart, selectionEnd, value } = textarea;
  const newValue = value.slice(0, selectionStart) + text + value.slice(selectionEnd);
  onChange(newValue);

  requestAnimationFrame(() => {
    const pos = selectionStart + text.length;
    textarea.selectionStart = pos;
    textarea.selectionEnd = pos;
    textarea.focus();
  });
}

export function MarkdownEditor({ content, onChange }: MarkdownEditorProps) {
  const [mode, setMode] = useState<EditorMode>('markdown');
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef(content);
  contentRef.current = content;

  const handleUpload = useCallback(
    async (file: File) => {
      if (!textareaRef.current) return;
      setUploading(true);

      const placeholder = `![Uploading ${file.name}...]()`;
      insertTextAtCursor(textareaRef.current, placeholder, onChange);

      try {
        const url = await uploadImage(file);
        const markdown = `![${file.name}](${url})`;
        onChange(contentRef.current.replace(placeholder, markdown));
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : 'Upload failed';
        onChange(contentRef.current.replace(placeholder, `<!-- Upload failed: ${errMsg} -->`));
      } finally {
        setUploading(false);
      }
    },
    [onChange],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file?.type.startsWith('image/')) {
        handleUpload(file);
      }
    },
    [handleUpload],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData.items;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) handleUpload(file);
          return;
        }
      }
    },
    [handleUpload],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleUpload(file);
      e.target.value = '';
    },
    [handleUpload],
  );

  return (
    <div>
      <div className="flex items-center border-b border-gray-100 dark:border-gray-800 px-2">
        <button
          type="button"
          onClick={() => setMode('markdown')}
          className={`px-3 py-2.5 text-xs font-medium cursor-pointer transition-colors relative ${
            mode === 'markdown'
              ? 'text-gray-900 dark:text-gray-100 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-gray-900 dark:after:bg-gray-100 after:rounded-full'
              : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
          }`}
        >
          Markdown
        </button>
        <button
          type="button"
          onClick={() => setMode('preview')}
          className={`px-3 py-2.5 text-xs font-medium cursor-pointer transition-colors relative ${
            mode === 'preview'
              ? 'text-gray-900 dark:text-gray-100 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-gray-900 dark:after:bg-gray-100 after:rounded-full'
              : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
          }`}
        >
          Preview
        </button>

        {mode === 'markdown' && (
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="px-2.5 py-1 text-xs text-gray-400 rounded-md cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? 'Uploading...' : '+ Image'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        )}
      </div>

      {mode === 'markdown' ? (
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => onChange(e.target.value)}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onPaste={handlePaste}
          className="w-full p-4 min-h-[500px] font-mono text-[15px] leading-relaxed text-gray-900 dark:text-gray-100 bg-transparent resize-y outline-none placeholder:text-gray-300 dark:placeholder:text-gray-600"
          placeholder="Write your markdown here... (drag & drop or paste images)"
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
