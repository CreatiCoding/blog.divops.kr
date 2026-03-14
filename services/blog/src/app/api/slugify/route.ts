import { NextResponse } from 'next/server';

function toKoreanSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .trim();
}

function toEnglishSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .trim();
}

async function translateToEnglish(text: string): Promise<string> {
  if (!/[가-힣]/.test(text)) {
    return text;
  }

  const readable = text.replace(/-/g, ' ');
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ko&tl=en&dt=t&q=${encodeURIComponent(readable)}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Translation failed: ${res.status}`);
  }

  const data = await res.json();
  const translated: string = data[0]
    .map((segment: [string]) => segment[0])
    .join('');

  return translated;
}

export async function POST(request: Request) {
  try {
    const { title } = await request.json();

    if (!title || typeof title !== 'string') {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }

    const slug = toKoreanSlug(title);
    const translated = await translateToEnglish(slug);
    const urlSlug = toEnglishSlug(translated);

    return NextResponse.json({ slug, urlSlug });
  } catch {
    return NextResponse.json({ error: 'Failed to generate slug' }, { status: 500 });
  }
}
