import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router';
import { PublicLayout } from './components/PublicLayout';
import { HomePage } from './pages/Home';
import { PostPage } from './pages/Post';
import { NotFound } from './pages/NotFound';

// 관리 화면은 방문자에게 필요 없으니 따로 받는다.
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout').then((m) => ({ default: m.AdminLayout })));
const AdminPostsPage = lazy(() => import('./pages/admin/Posts').then((m) => ({ default: m.AdminPostsPage })));
const WritePage = lazy(() => import('./pages/admin/Write').then((m) => ({ default: m.WritePage })));
const StatsPage = lazy(() => import('./pages/admin/Stats').then((m) => ({ default: m.StatsPage })));

export function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route path="posts" element={<AdminPostsPage />} />
            <Route path="write" element={<WritePage />} />
            <Route path="stats" element={<StatsPage />} />
          </Route>
          <Route element={<PublicLayout />}>
            <Route index element={<HomePage />} />
            <Route path=":slug" element={<PostPage />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
