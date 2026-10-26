import LegacyGame from './lib/LegacyGame.jsx';
import './App.css';

export default function App() {
  return (
    <main className="app-shell">
      <LegacyGame />
      <button
        className="reload"
        type="button"
        onClick={() => location.reload()}
        aria-label="ゲームを再読み込み"
      >
        ↻
      </button>
    </main>
  );
}
