# 整理方針

## 現在の状態

- 旧HTMLは削除済み。UIは `src/game/LegacyUI.jsx` のReactコンポーネントが描画する
- ゲームエンジンは `src/game/scripts/` に抽出したクラシックスクリプトで、Reactの `useEffect` から順番に読み込む
- ゲームエンジンはDOM ID経由でUIを更新する（React状態への移行は次の段階）
- Three.js と Supabase は npm 依存としてバンドルし、エンジンからはグローバル経由で利用する
- ゲームUIのCSSは `src/game/legacy.css` に集約し、外部URLは使用しない
- エンジンの `let` / `const` は同一レルムで再実行できないため、HMR・再マウント時は完全リロードする

## ライフサイクル

1. `LegacyGame.jsx` が `LegacyUI` を描画する
2. `legacy-guards.js` がタイマー・イベントリスナー・DOM追加を追跡する
3. `legacy-bridge.js` が `THREE`、`__BW_CONFIG`、`__BW_STORAGE`、Supabase 名前空間をグローバルへ公開する
4. `legacy-loader.js` が `src/game/scripts` のスクリプトを順番に注入する
5. `legacy-guards.js` が `window.load` 済みでもエンジンの初期化コールバックを実行する
6. 破棄時はタイマー・RAF・リスナー・body直下の追加要素・WebGLリソース・グローバルを解放する

## オンライン構成

- クライアントは Supabase の匿名認証で `auth.uid()` を取得し、プレイヤーIDとして使う
- ロビー操作・試合開始・試合データ削除は Security Definer RPC 経由
- テーブルは RLS で保護し、`bw_history` / `bw_friends` / `bw_training_records` は本人の行のみ更新可能
- 試合中の共有状態（ブロック・ベッド・チャット・ダメージ・ドロップ）は同じ試合の参加者のみ読み書き可能

## 変更時のルール

- 新しいグローバル変数を追加しない
- ゲーム状態、表示状態、通信状態を別のモジュールに置く
- UIイベントはReactのイベントハンドラへ寄せる
- Three.jsの生成・更新・破棄を1つのライフサイクルに閉じ込める
- SupabaseのURLとanon keyは環境変数から読む
- 既存機能を移行したらエンジン側の対応処理を削除する
- 外部URLを追加しない（フォント・画像・スキンを含む）
- ユーザー由来の文字列を `innerHTML` / インラインイベントへ入れる場合は必ずエスケープする

## 残っている課題

- ゲームロジックはクラシックスクリプトのままで、React状態/フックへの移行が未完了
- ゲームロジックはクライアント権威のままで、完全なチート対策にはサーバー側検証が必要
- ゲームエンジンの関数宣言・トップレベル変数は破棄後もレルムに残るため、再マウントは完全リロードで行う
- HUD・チャット・ショップ・設定のDOM更新をReact状態へ置き換える
