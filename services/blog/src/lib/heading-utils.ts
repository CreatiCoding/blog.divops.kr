export type Heading = {
  id: string;
  text: string;
  level: number;
};

export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9가-힣ㄱ-ㅎㅏ-ㅣ\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function extractHeadings(content: string): Heading[] {
  const headingRegex = /^(#{1,3})\s+(.+)$/gm;
  const headings: Heading[] = [];
  let match;
  while ((match = headingRegex.exec(content)) !== null) {
    const level = match[1]!;
    const text = match[2]!;
    headings.push({
      id: generateSlug(text.trim()),
      text: text.trim(),
      level: level.length,
    });
  }
  return headings;
}
