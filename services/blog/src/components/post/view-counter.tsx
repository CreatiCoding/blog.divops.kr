import { useEffect, useState } from 'react';

export function ViewCounter({ postId }: { postId: string }) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    fetch(`/api/posts/${postId}/view`, { method: 'POST' })
      .then((res) => res.json())
      .then((data) => {
        if (typeof data.viewCount === 'number') {
          setCount(data.viewCount);
        }
      })
      .catch(() => {});
  }, [postId]);

  if (count === null) return null;

  return (
    <span className="text-[13px] text-gray-500 dark:text-gray-400">
      조회 {count.toLocaleString()}
    </span>
  );
}
