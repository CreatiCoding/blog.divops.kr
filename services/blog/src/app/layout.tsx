import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'blog.divops.kr',
    template: '%s | blog.divops.kr',
  },
  description: 'DevOps와 프론트엔드 기술 블로그',
  metadataBase: new URL('https://blog.divops.kr'),
  verification: {
    google: 'zGIoA0ePFDiykqYdBi78RnsNMoQ-ru-AIYavfAmSZMc',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
