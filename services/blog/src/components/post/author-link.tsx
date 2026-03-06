import type { MouseEvent } from 'react';

type AuthorLinkProps = {
  name: string;
  className?: string;
  stopPropagation?: boolean;
};

export function AuthorLink({ name, className, stopPropagation }: AuthorLinkProps) {
  const handleClick = stopPropagation
    ? (e: MouseEvent) => e.stopPropagation()
    : undefined;

  return (
    <a
      href={`https://github.com/${name}`}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={handleClick}
    >
      {name}
    </a>
  );
}
