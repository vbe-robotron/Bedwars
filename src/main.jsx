import { createRoot } from 'react-dom/client';
import App from './App.jsx';

function start() {
  const target = document.getElementById('app');
  if (!target) throw new Error('#app が見つかりません');
  createRoot(target).render(<App />);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}
