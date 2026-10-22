import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './globals.css';

// Go 가 크롤러용으로 그려 둔 #root 안의 HTML 을 React 가 같은 모양으로 다시 그린다.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
