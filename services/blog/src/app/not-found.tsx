import Link from 'next/link';

export default function NotFound() {
  return (
    <section className="max-w-[720px] mx-auto px-6 flex flex-col items-center justify-center min-h-[60vh] text-center">
      <p className="text-[120px] font-bold leading-none tracking-tighter text-gray-100 dark:text-gray-800 select-none">
        404
      </p>
      <h1 className="mt-4 text-[22px] font-semibold tracking-tight text-gray-900 dark:text-gray-100">
        페이지를 찾을 수 없어요
      </h1>
      <p className="mt-2 text-[15px] text-gray-400 dark:text-gray-500">
        요청하신 페이지가 존재하지 않거나, 이동되었을 수 있어요.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex items-center gap-1.5 text-[14px] font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          className="translate-y-[0.5px]"
        >
          <path
            d="M10 12L6 8L10 4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        홈으로 돌아가기
      </Link>
    </section>
  );
}
