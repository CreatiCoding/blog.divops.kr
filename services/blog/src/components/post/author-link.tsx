import type { MouseEvent } from 'react';

type AuthorLinkProps = {
  name: string;
  className?: string;
  stopPropagation?: boolean;
};

export function AuthorLink({ name, className, stopPropagation }: AuthorLinkProps) {
  if (stopPropagation) {
    return (
      <button
        type="button"
        className={className}
        onClick={(e: MouseEvent) => {
          e.stopPropagation();
          e.preventDefault();
          window.open(`https://github.com/${name}`, '_blank', 'noopener,noreferrer');
        }}
      >
        {name}
      </button>
    );
  }

  return (
    <a
      href={`https://github.com/${name}`}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {name}
    </a>
  );
}
