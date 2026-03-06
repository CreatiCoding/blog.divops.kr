const MARKDOWN_IMAGE_RE = /!\[[^\]]*\]\(([^)]+)\)/;

export function extractFirstImageUrl(markdown: string): string | null {
  const match = markdown.match(MARKDOWN_IMAGE_RE);
  return match?.[1] ?? null;
}
