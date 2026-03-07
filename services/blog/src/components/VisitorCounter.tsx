'use client';

import { useEffect, useState } from 'react';

export function VisitorCounter() {
  const [stats, setStats] = useState<{ total: number; today: number } | null>(
    null
  );

  useEffect(() => {
    fetch('/api/stats/visitors')
      .then((res) => res.json())
      .then((data) => setStats(data))
      .catch(() => {});
  }, []);

  if (!stats) return null;

  return (
    <span className="text-[11px] text-gray-400 dark:text-gray-500">
      Total{' '}
      <span className="font-medium text-gray-500 dark:text-gray-400">
        {stats.total.toLocaleString()}
      </span>
      <span className="mx-1">|</span>
      Today{' '}
      <span className="font-medium text-gray-500 dark:text-gray-400">
        {stats.today.toLocaleString()}
      </span>
    </span>
  );
}
