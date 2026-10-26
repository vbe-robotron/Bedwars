# BedWars Ultimate

Vite + React を入口にした BedWars です。UIはReactコンポーネント、ゲームエンジンは旧HTMLから抽出したスクリプトをReactのライフサイクルから読み込む構成です。

## 必要環境

- Node.js 20.19+ または 22.12+（Vite 8 の要件）
- npm

## 起動

```bash
npm install
npm run dev
```

`npm run build` で `dist/index.html` を作成します。JavaScript と CSS は HTML へインライン化されるため、この1ファイルだけを配布できます。

```bash
npm run verify
```

`verify` はビルド後に `scripts/check-build.mjs` で次を検査します。

- インライン script / style が正しい閉じタグで終わっている
- インライン script が構文エラーを含まない
- ゲームエンジンに外部URLが残っていない

## Supabase（オンライン対戦）

1. Supabase プロジェクトを作成します。
2. `supabase/migrations/20261026000000_bedwars_schema.sql` を Supabase CLI で適用するか、SQL Editor に貼り付けて実行します。
3. Authentication > Providers で **Anonymous Sign-Ins** を有効にします。オンライン対戦は匿名認証を前提にしています。
4. `.env.example` を `.env.local` にコピーし、Project URL と publishable/anon key を設定します。
5. `npm run build` または `npm run dev` で起動します。

```bash
cp .env.example .env.local
# VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY を編集
```

未設定でもオフラインモード（ソロ・練習・設定）で起動します。オフライン時は Supabase のエラーバナーを表示しません。

### セキュリティと制約

- オンライン時は Supabase の匿名認証で得た `auth.uid()` をプレイヤーIDとして使います。認証に失敗した場合はローカルIDへフォールバックしますが、RLS によりオンライン操作は拒否されます。
- テーブルへの直接書き込みは RLS で制限し、ロビー操作・試合開始・試合データ削除は Security Definer RPC 経由にしています。
- ゲームロジック自体は依然としてクライアント権威です。完全なチート対策には、当たり判定・ダメージ・勝敗をサーバー側で検証する仕組みが別途必要です。

## 構成

- `src/App.jsx`: アプリシェル
- `src/main.jsx`: React のエントリポイント
- `src/lib/LegacyGame.jsx`: ゲームエンジンの起動・停止
- `src/lib/legacy-loader.js`: エンジンスクリプトの読み込みと破棄
- `src/lib/legacy-guards.js`: タイマー・イベントリスナー・DOM の後始末、`load` 競合対策
- `src/game/LegacyUI.jsx`: ロビー・HUD・設定・ショップ・インベントリなど全UI
- `src/game/legacy.css`: ゲームUIのCSS
- `src/game/scripts/`: 旧HTMLから抽出したゲームエンジン（順番に実行）
- `src/lib/persistence/`: 設定・ローカル保存・Supabase 設定
- `supabase/migrations/`: テーブル、RLS、RPC

旧HTMLは削除済みです。UIはReact、ゲームエンジンは `src/game/scripts` のクラシックスクリプトとしてReactから起動します。次の段階でゲームロジックをReact状態/フックへ移行できます。

1. Supabase設定とローカル保存を `src/lib/persistence` へ分離（完了）
2. 全UIマークアップをReactコンポーネントへ移行（完了）
3. ゲームエンジンを `src/game/scripts` へ抽出（完了）
4. チャット・ショップ・設定・HUDをReact状態へ移行（次の段階）
5. ゲームエンジンのクラシックスクリプトを削除（次の段階）

ゲームエンジンのトップレベル `let` / `const` は同じ JavaScript レルムで再実行できないため、HMR や再マウント時はページを完全リロードします。
