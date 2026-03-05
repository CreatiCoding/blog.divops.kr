'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TiptapImage from '@tiptap/extension-image';
import { useCallback } from 'react';

type TiptapEditorProps = {
  content: string;
  onChange: (html: string) => void;
};

export function TiptapEditor({ content, onChange }: TiptapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      TiptapImage.configure({ inline: false, allowBase64: false }),
    ],
    content,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  const addImage = useCallback(async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/gif,image/webp';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file || !editor) return;

      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      if (res.ok) {
        const { url } = await res.json();
        editor.chain().focus().setImage({ src: url }).run();
      }
    };
    input.click();
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="border dark:border-gray-700 rounded-lg overflow-hidden">
      <div className="flex gap-1 border-b dark:border-gray-700 p-2 bg-gray-50 dark:bg-gray-800 flex-wrap">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`px-2 py-1 rounded text-sm cursor-pointer ${editor.isActive('bold') ? 'bg-gray-300 dark:bg-gray-600' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}
        >
          B
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`px-2 py-1 rounded text-sm cursor-pointer ${editor.isActive('italic') ? 'bg-gray-300 dark:bg-gray-600' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}
        >
          I
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`px-2 py-1 rounded text-sm cursor-pointer ${editor.isActive('heading', { level: 2 }) ? 'bg-gray-300 dark:bg-gray-600' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}
        >
          H2
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`px-2 py-1 rounded text-sm cursor-pointer ${editor.isActive('heading', { level: 3 }) ? 'bg-gray-300 dark:bg-gray-600' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}
        >
          H3
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`px-2 py-1 rounded text-sm cursor-pointer ${editor.isActive('bulletList') ? 'bg-gray-300 dark:bg-gray-600' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}
        >
          List
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={`px-2 py-1 rounded text-sm cursor-pointer ${editor.isActive('codeBlock') ? 'bg-gray-300 dark:bg-gray-600' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}
        >
          Code
        </button>
        <button
          type="button"
          onClick={addImage}
          className="px-2 py-1 rounded text-sm cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700"
        >
          Image
        </button>
      </div>
      <EditorContent editor={editor} className="prose max-w-none p-4 min-h-[300px]" />
    </div>
  );
}
