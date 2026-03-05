'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { TiptapEditor } from '@/components/editor/tiptap-editor';

export default function WritePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!editId);

  useEffect(() => {
    if (!editId) return;
    fetch(`/api/posts/${editId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Not found');
        return res.json();
      })
      .then((post) => {
        setTitle(post.title);
        setSlug(post.slug);
        setExcerpt(post.excerpt ?? '');
        setContent(post.content);
      })
      .catch(() => {
        router.push('/admin/posts');
      })
      .finally(() => setLoading(false));
  }, [editId, router]);

  const handleSlugGenerate = () => {
    if (slug) return; // don't overwrite manually set slug
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

    const url = editId ? `/api/posts/${editId}` : '/api/posts';
    const method = editId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, slug, content, excerpt, published }),
    });

    if (res.ok) {
      router.push('/admin/posts');
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!editId) return;
    if (!confirm('정말 삭제하시겠습니까?')) return;

    const res = await fetch(`/api/posts/${editId}`, { method: 'DELETE' });
    if (res.ok) {
      router.push('/admin/posts');
    }
  };

  if (loading) {
    return <div className="text-gray-500">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{editId ? 'Edit Post' : 'New Post'}</h1>
        {editId && (
          <button
            onClick={handleDelete}
            className="px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50"
          >
            Delete
          </button>
        )}
      </div>
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
        <TiptapEditor key={editId ?? 'new'} content={content} onChange={setContent} />
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
