'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TiptapEditor } from '@/components/editor/tiptap-editor';

export default function WritePage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSlugGenerate = () => {
    setSlug(
      title
        .toLowerCase()
        .replace(/[^a-z0-9가-힣\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim()
    );
  };

  const handleSubmit = async (published: boolean) => {
    if (!title || !content || !slug) return;
    setSaving(true);

    const res = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, slug, content, excerpt, published }),
    });

    if (res.ok) {
      router.push('/admin/posts');
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">New Post</h1>
      <div>
        <label className="block text-sm font-medium mb-1">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleSlugGenerate}
          className="w-full border rounded-lg px-3 py-2"
          placeholder="Post title"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Slug</label>
        <input
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          className="w-full border rounded-lg px-3 py-2"
          placeholder="post-slug"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Excerpt</label>
        <textarea
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
          className="w-full border rounded-lg px-3 py-2"
          rows={2}
          placeholder="Short description"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Content</label>
        <TiptapEditor content={content} onChange={setContent} />
      </div>
      <div className="flex gap-3">
        <button
          onClick={() => handleSubmit(false)}
          disabled={saving}
          className="px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          Save Draft
        </button>
        <button
          onClick={() => handleSubmit(true)}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          Publish
        </button>
      </div>
    </div>
  );
}
