'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MarkdownEditor } from '@/components/editor/markdown-editor';

export default function WritePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [category, setCategory] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!editId);
  const [categories, setCategories] = useState<string[]>([]);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const categoryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/categories')
      .then((res) => res.json())
      .then(setCategories)
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (categoryRef.current && !categoryRef.current.contains(e.target as Node)) {
        setShowCategoryDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
        setCategory(post.category ?? '');
        setExcerpt(post.excerpt ?? '');
        setContent(post.content);
      })
      .catch(() => {
        router.push('/admin/posts');
      })
      .finally(() => setLoading(false));
  }, [editId, router]);

  const handleSlugGenerate = () => {
    if (slug) return;
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
      body: JSON.stringify({ title, slug, category: category || null, content, excerpt, published }),
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
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-sm text-gray-400 dark:text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          {editId ? 'Edit Post' : 'New Post'}
        </h1>
        <div className="flex items-center gap-2">
          {editId && (
            <button
              onClick={handleDelete}
              className="px-3 py-1.5 text-sm text-red-500 rounded-lg cursor-pointer hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
            >
              Delete
            </button>
          )}
          <button
            onClick={() => handleSubmit(false)}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save Draft
          </button>
          <button
            onClick={() => handleSubmit(true)}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-gray-900 dark:bg-gray-100 dark:text-gray-900 rounded-lg cursor-pointer hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Publish
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200/60 dark:border-gray-800/60 shadow-sm p-6 space-y-5">
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleSlugGenerate}
            className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-gray-100/10 focus:border-gray-300 dark:focus:border-gray-600 transition-shadow placeholder:text-gray-300 dark:placeholder:text-gray-600"
            placeholder="Post title"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
              Slug
            </label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-gray-100/10 focus:border-gray-300 dark:focus:border-gray-600 transition-shadow placeholder:text-gray-300 dark:placeholder:text-gray-600 font-mono"
              placeholder="post-slug"
            />
          </div>

          <div ref={categoryRef} className="relative">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
              Category
            </label>
            <input
              type="text"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setShowCategoryDropdown(true);
              }}
              onFocus={() => setShowCategoryDropdown(true)}
              className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-gray-100/10 focus:border-gray-300 dark:focus:border-gray-600 transition-shadow placeholder:text-gray-300 dark:placeholder:text-gray-600"
              placeholder="Select or type a category"
            />
            {showCategoryDropdown && (() => {
              const filtered = categories.filter(
                (c) => c.toLowerCase().includes(category.toLowerCase()) && c !== category
              );
              if (filtered.length === 0) return null;
              return (
                <ul className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filtered.map((c) => (
                    <li key={c}>
                      <button
                        type="button"
                        className="w-full text-left px-3.5 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 transition-colors"
                        onClick={() => {
                          setCategory(c);
                          setShowCategoryDropdown(false);
                        }}
                      >
                        {c}
                      </button>
                    </li>
                  ))}
                </ul>
              );
            })()}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
            Excerpt
          </label>
          <textarea
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-gray-100/10 focus:border-gray-300 dark:focus:border-gray-600 transition-shadow resize-none placeholder:text-gray-300 dark:placeholder:text-gray-600"
            rows={2}
            placeholder="Short description"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200/60 dark:border-gray-800/60 shadow-sm overflow-hidden">
        <MarkdownEditor key={editId ?? 'new'} content={content} onChange={setContent} />
      </div>
    </div>
  );
}
