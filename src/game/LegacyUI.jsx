import { memo } from 'react';

function LegacyUI() {
  return (
    <>
<div id="damage-flash" /><div id="damage-hit-vignette" />
  {/* ===== LOBBY ===== */}
  <div id="lobby">
    <div className="lobby-panel">
      <div style={{textAlign: 'center', marginBottom: 18, position: 'relative'}}>
        <div style={{fontFamily: '"VT323",monospace', fontSize: 62, color: '#ffcc00', textShadow: '4px 4px 0 #b8860b,2px 2px 0 #000', letterSpacing: 2, lineHeight: 1}}>⚔ BedWars</div>
        <div style={{fontFamily: '"VT323",monospace', fontSize: 22, color: '#c0c0c0', letterSpacing: 6, textTransform: 'uppercase', marginTop: '-4px'}}>Ultimate Edition</div>
        <button onClick={(event) => { toggleBgSelector() }} style={{position: 'absolute', top: 0, right: 0, background: 'rgba(0,0,0,0.5)', border: '1px solid #666', color: '#ccc', fontSize: 11, padding: '4px 8px', borderRadius: 4, cursor: 'pointer'}}>🖼️ 背景を変更</button>
        <div id="bg-selector" style={{display: 'none', position: 'absolute', top: 24, right: 0, background: 'rgba(10,10,15,0.95)', border: '1px solid #555', borderRadius: 6, padding: 10, zIndex: 50, width: 220}}>
          <div style={{color: '#aaa', fontSize: 11, marginBottom: 6}}>タイトル背景を選択</div>
          <div id="bg-thumb-grid" style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8}} />
          <label style={{display: 'block', color: '#aaa', fontSize: 11, marginBottom: 4}}>📁 画像アップロード</label>
          <input type="file" id="bg-file-input" accept="image/*" style={{fontSize: 11, width: '100%'}} />
        </div>
      </div>
      <div className="lobby-layout">
        {/* Skin viewer */}
        <div className="skin-viewer-wrap">
          <div className="skin-box" id="lobby-skin-box">
            <div className="stage-3d">
              <div className="char-model-3d skin-walk" id="lobby-model">
                <div className="box-3d head-3d"><div className="face hd-f" /><div className="face hd-b" /><div className="face hd-l" /><div className="face hd-r" /><div className="face hd-u" /><div className="face hd-d" /></div>
                <div className="box-3d body-3d"><div className="face bd-f" /><div className="face bd-b" /><div className="face bd-l" /><div className="face bd-r" /><div className="face bd-u" /><div className="face bd-d" /></div>
                <div className="box-3d r-arm-3d"><div className="face ra-f" /><div className="face ra-b" /><div className="face ra-l" /><div className="face ra-r" /><div className="face ra-u" /><div className="face ra-d" /></div>
                <div className="box-3d l-arm-3d"><div className="face la-f" /><div className="face la-b" /><div className="face la-l" /><div className="face la-r" /><div className="face la-u" /><div className="face la-d" /></div>
                <div className="box-3d r-leg-3d"><div className="face rl-f" /><div className="face rl-b" /><div className="face rl-l" /><div className="face rl-r" /><div className="face rl-u" /><div className="face rl-d" /></div>
                <div className="box-3d l-leg-3d"><div className="face ll-f" /><div className="face ll-b" /><div className="face ll-l" /><div className="face ll-r" /><div className="face ll-u" /><div className="face ll-d" /></div>
              </div>
            </div>
          </div>
          <label className="skin-upload-btn">📁 スキン<input type="file" id="skin-file" accept="image/png" style={{display: 'none'}} /></label>
        </div>
        {/* Info + player list */}
        <div className="lobby-info">
          <input type="text" id="player-name" className="mc-input" placeholder="プレイヤー名..." defaultValue="Player1" maxLength={16} />
          <div id="supabase-connection-status" style={{fontSize: 12, color: '#888', textAlign: 'center', marginTop: 4}}>Supabase: 接続準備中...</div>
          <label style={{display: 'flex', alignItems: 'center', gap: 6, color: '#aaa', fontSize: 12, marginTop: 6, cursor: 'pointer'}}>
            <input type="checkbox" id="join-as-spectator-check" style={{width: 15, height: 15}} />
            👁️ 観戦のみで参加（対戦には参加せず見るだけ）
          </label>
          <div className="player-list" id="player-list"><div style={{color: '#666', fontSize: 18}}>ここに参加者が表示されます</div></div>
          <div className="lobby-status" id="lobby-status">モードを選んでください</div>
          <div id="host-controls" style={{display: 'none'}}>
            <div className="team-mode-row">
              <label>チーム数:</label>
              <button className="mc-btn btn-blue" id="btn-2team" onClick={(event) => { setTeamMode(2) }} style={{fontSize: 19, padding: '5px 14px'}}>2チーム</button>
              <button className="mc-btn" id="btn-4team" onClick={(event) => { setTeamMode(4) }} style={{fontSize: 19, padding: '5px 14px'}}>4チーム</button>
            </div>
            <button className="mc-btn btn-gold" onClick={(event) => { hostStartGame() }} style={{marginTop: 6, width: '100%', fontSize: 24}}>▶ スタート！</button>
          </div>
          <div id="guest-controls" style={{display: 'none'}}>
            <div style={{color: '#ffaa00', fontSize: 16, textAlign: 'center', padding: '8px 0'}}>
              ⏳ ホストの開始を待っています...
            </div>
            <button className="mc-btn" onClick={(event) => { leaveLobbyToTitle() }} style={{width: '100%', fontSize: 16, background: '#555'}}>✕ 退出してタイトルへ戻る</button>
          </div>
          <div className="lobby-stats">Lv.<span className="stat-v" id="lobby-level">1</span> Kill:<span className="stat-v" id="lobby-kills">0</span> Win:<span className="stat-v" id="lobby-wins">0</span></div>
        </div>
      </div>
      <div style={{borderTop: '2px solid #444', paddingTop: 14, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8}}>
        {/* マップ選択（手動 or ランダム） */}
        <div style={{display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.05)', padding: '6px 10px', borderRadius: 4}}>
          <span style={{color: '#aaa', fontSize: 12, whiteSpace: 'nowrap'}}>🗺️ マップ:</span>
          <select id="map-theme-select" onChange={(event) => { setMapTheme(event.currentTarget.value) }} style={{flex: 1, background: '#222', color: '#fff', border: '1px solid #555', borderRadius: 3, padding: 4, fontSize: 12}}>
            <option value="random">🎲 ランダム</option>
          </select>
        </div>
        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8}}>
          <button className="mc-btn" onClick={(event) => { startGame('solo') }} style={{fontSize: 20, padding: 10, background: 'linear-gradient(180deg,#5a7a3a,#3a5a1a)', borderColor: '#8aaa6a #1a3a0a #1a3a0a #8aaa6a'}}>
            🤖 ソロ (VS AI)
          </button>
          <button className="mc-btn btn-blue" onClick={(event) => { joinLobby() }} style={{fontSize: 20, padding: 10, background: 'linear-gradient(180deg,#3a5aaa,#1a3a8a)', borderColor: '#6a8ada #0a1a5a #0a1a5a #6a8ada'}}>
            🌐 オンライン対戦
          </button>
        </div>
        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8}}>
          <button className="mc-btn btn-gold" onClick={(event) => { startTraining('bridge') }} style={{fontSize: 18, padding: 8}}>🧱 ブリッジ練習</button>
          <button className="mc-btn btn-gold" onClick={(event) => { startTraining('parkour') }} style={{fontSize: 18, padding: 8}}>🏃 パルクール練習</button>
        </div>
        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8}}>
          <button className="mc-btn btn-gold" onClick={(event) => { openFriendUI() }} style={{fontSize: 18, padding: 8, background: 'linear-gradient(180deg,#aa8800,#886600)', borderColor: '#ddaa00 #553300 #553300 #ddaa00'}}>
            👥 フレンド &amp; ランキング
          </button>
          <button className="mc-btn" onClick={(event) => { openSettings() }} style={{fontSize: 18, padding: 8, background: 'linear-gradient(180deg,#555,#333)', borderColor: '#888 #222 #222 #888'}}>
            ⚙️ 設定
          </button>
        </div>
      </div>
      {/* ロビーチャット */}
      <div style={{marginTop: 14, borderTop: '2px solid #333', paddingTop: 10}}>
        <div style={{color: '#ffaa00', fontSize: 13, marginBottom: 6}}>💬 ロビーチャット</div>
        <div id="lobby-chat-log" style={{height: 100, overflowY: 'auto', background: '#0a0a0a', border: '1px solid #333', borderRadius: 4, padding: 6, marginBottom: 6, fontSize: 12, color: '#ccc'}} />
        <div style={{display: 'flex', gap: 6}}>
          <input type="text" id="lobby-chat-input" placeholder="チャットを打ってEnter..." style={{flex: 1, padding: 6, background: '#222', color: '#fff', border: '1px solid #444', borderRadius: 3, fontSize: 12, outline: 'none'}} />
          <button onClick={(event) => { sendLobbyChat() }} style={{padding: '6px 12px', background: '#444', color: '#fff', border: '1px solid #555', borderRadius: 3, cursor: 'pointer'}}>送信</button>
        </div>
      </div>
    </div>
  </div>
  {/* ===== HUD ===== */}
  <div id="crosshair" />
  <div id="break-progress"><div id="break-bar" /></div>
  <div id="bow-charge-v2"><div className="bow-title">🏹 弓を引いています</div><div className="bow-track"><div className="bow-fill" id="bow-fill-v2" /></div><div className="bow-info"><span id="bow-percent-v2">0%</span><span id="bow-power-v2">威力 0%</span></div></div>
  <div id="announcement" />
  {/* v8: チャットUI（スコープラベル付き） */}
  <div id="chat-overlay" style={{position: 'fixed', bottom: 100, left: 20, width: 320, maxHeight: 200, background: 'rgba(0,0,0,0.65)', borderRadius: 6, overflowY: 'auto', display: 'none', zIndex: 90, padding: 8}} />
  <div id="chat-input-box" style={{position: 'fixed', bottom: 10, left: 20, width: 340, display: 'none', zIndex: 100, background: 'rgba(0,0,0,0.95)', border: '2px solid #555', borderRadius: 4, overflow: 'hidden'}}>
    <div id="chat-scope-label" style={{background: '#333', color: '#ffaa00', fontSize: 11, padding: '3px 8px', borderBottom: '1px solid #555'}}>全体へ</div>
    <input type="text" id="chat-input" placeholder="メッセージ (Enter送信 / Esc閉じる)" style={{width: '100%', padding: 7, background: '#1a1a1a', color: '#fff', border: 'none', fontSize: 12, outline: 'none', boxSizing: 'border-box'}} />
  </div>
  {/* v8: 設定画面 */}
  {/* v11: 設定画面 (35項目完全版) */}
  <div id="settings-panel" style={{display: 'none', position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.92)', zIndex: 3000, overflowY: 'auto'}}>
    <div style={{maxWidth: 820, margin: '24px auto', background: '#1a1a1a', border: '3px solid #444', borderRadius: 6, padding: 28}}>
      <h2 style={{color: '#ffaa00', margin: '0 0 18px', fontSize: 26, textAlign: 'center'}}>⚙️ 設定</h2>
      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20}}>
        {/* 左列: ゲームプレイ・グラフィック */}
        <div>
          <div className="set-section">🎮 ゲームプレイ</div>
          <label className="set-label">オートスプリント <input type="checkbox" id="set-autoSprint" onChange={(event) => { setToggle('autoSprint',event.currentTarget.checked) }} /></label>
          <label className="set-label">スニーク切替 <input type="checkbox" id="set-toggleSneak" onChange={(event) => { setToggle('toggleSneak',event.currentTarget.checked) }} /></label>
          <label className="set-label">オートブリッジアシスト <input type="checkbox" id="set-autoBridge" onChange={(event) => { setToggle('autoBridge',event.currentTarget.checked) }} /></label>
          <label className="set-label">ブロックプレビュー <input type="checkbox" id="set-blockPreview" onChange={(event) => { setToggle('blockPreview',event.currentTarget.checked) }} /></label>
          <label className="set-label">スロット固定 <input type="checkbox" id="set-hotbarLock" onChange={(event) => { setToggle('hotbarLock',event.currentTarget.checked) }} /></label>
          <label className="set-label">スマートリスポーン <input type="checkbox" id="set-smartRespawn" onChange={(event) => { setToggle('smartRespawn',event.currentTarget.checked) }} /></label>
          <label className="set-label">スロットホイール切替 <input type="checkbox" id="set-scrollSlot" onChange={(event) => { setToggle('scrollSlot',event.currentTarget.checked) }} /></label>
          <label className="set-label">ブロック面ハイライト <input type="checkbox" id="set-faceHighlight" onChange={(event) => { setToggle('faceHighlight',event.currentTarget.checked) }} defaultChecked /></label>
          <div className="set-section" style={{marginTop: 12, color: '#ff5555'}}>😈 鬼畜モード</div>
          <label className="set-label">鬼畜モード(色彩反転+RTA) <input type="checkbox" id="set-kishiku" onChange={(event) => { toggleKishikuMode(event.currentTarget.checked) }} /></label>
          <label className="set-label">画質を荒くする <input type="checkbox" id="set-kishikuUgly" onChange={(event) => { setToggle('kishikuUgly',event.currentTarget.checked) }} /></label>
          <div className="set-section" style={{marginTop: 12}}>🎨 グラフィック</div>
          <label className="set-label">FOV: <span id="lbl-fov">70</span>°
            <input type="range" id="set-fov" min={50} max={120} defaultValue={70} onInput={(event) => { applySettings() }} /></label>
          <label className="set-label">ダイナミックFOV <input type="checkbox" id="set-dynamicFOV" onChange={(event) => { setToggle('dynamicFOV',event.currentTarget.checked) }} defaultChecked /></label>
          <label className="set-label">描画距離: <span id="lbl-draw">150</span>
            <input type="range" id="set-draw" min={40} max={400} defaultValue={150} onInput={(event) => { applySettings() }} /></label>
          <label className="set-label">テクスチャ品質:
            <select id="set-tex" onChange={(event) => { applySettings() }}>
              <option value={2}>高</option><option value={1}>標準</option><option value="0.5">低</option>
            </select></label>
          <label className="set-label">ビューボビング <input type="checkbox" id="set-viewBobbing" onChange={(event) => { setToggle('viewBobbing',event.currentTarget.checked) }} defaultChecked /></label>
          <label className="set-label">被弾シェイク <input type="checkbox" id="set-screenShake" onChange={(event) => { setToggle('screenShake',event.currentTarget.checked) }} defaultChecked /></label>
          <label className="set-label">パーティクル <input type="checkbox" id="set-particles" onChange={(event) => { setToggle('particles',event.currentTarget.checked) }} defaultChecked /></label>
          <label className="set-label">明るさ: <span id="lbl-gamma">1.0</span>
            <input type="range" id="set-gamma" min={10} max={20} defaultValue={10} step={1} onInput={(event) => { applySettings() }} /></label>
          <label className="set-label">空のタイプ:
            <select id="set-sky" onChange={(event) => { applySettings() }}>
              <option value="day">昼</option><option value="evening">夕方</option>
              <option value="night">夜</option><option value="cycle">サイクル</option>
            </select></label>
          <label className="set-label">影:
            <select id="set-shadow" onChange={(event) => { applySettings() }}>
              <option value="off">OFF</option><option value="low">LOW</option><option value="high">HIGH</option>
            </select></label>
          <label className="set-label">描画強化:
            <select id="set-visualQuality" onChange={(event) => { window._bwSetVisualQuality(event.currentTarget.value) }}>
              <option value="standard">標準</option><option value="enhanced">高精細</option><option value="cinematic">シネマ</option>
            </select></label>
          <label className="set-label">流体シミュレーション <input type="checkbox" id="set-fluid" defaultChecked onChange={(event) => { window._bwFluidEnabled=event.currentTarget.checked }} /></label>
          <div className="set-section" style={{marginTop: 12, color: '#ffcc55'}}>🧪 実験的機能</div>
          <label className="set-label">実験的シェーダーを有効化 <input type="checkbox" id="set-expGraphics" onChange={(event) => { window._bwSetExperimentalGraphics(event.currentTarget.checked) }} /></label>
          <label className="set-label">ポストエフェクト(実験的):
            <select id="bw-shader-mode" onChange={(event) => { window._bwSetShaderMode(event.currentTarget.value) }}>
              <option value="vanilla">なし(標準)</option>
              <option value="vivid">ビビッド</option>
              <option value="cinematic">シネマティック</option>
              <option value="toon">トゥーン</option>
              <option value="night">ナイト</option>
            </select></label>
          <label className="set-label">スキン描画精度(実験的・3段階):
            <select id="set-skinRealism" onChange={(event) => { window._bwSetSkinRealism(event.currentTarget.value) }}>
              <option value="low">低(軽量・荒い)</option>
              <option value="mid">中(標準)</option>
              <option value="high">高(なめらか・重い)</option>
            </select></label>
        </div>
        {/* 右列: HUD・操作・サウンド */}
        <div>
          <div className="set-section">📊 HUD</div>
          <label className="set-label">クロスヘア:
            <select id="set-crosshair" onChange={(event) => { applySettings() }}>
              <option value="cross">＋</option><option value="dot">・</option>
              <option value="circle">○</option><option value="none">非表示</option>
            </select></label>
          <label className="set-label">UIスケール:
            <select id="set-uiscale" onChange={(event) => { applySettings() }}>
              <option value="0.8">小</option><option value={1}>中</option><option value="1.2">大</option>
            </select></label>
          <label className="set-label">CPS表示 <input type="checkbox" id="set-showCps" onChange={(event) => { setToggle('showCps',event.currentTarget.checked) }} /></label>
          <label className="set-label">FPS/座標表示 <input type="checkbox" id="set-showDebug" onChange={(event) => { setToggle('showDebug',event.currentTarget.checked) }} defaultChecked /></label>
          <label className="set-label">防具表示 <input type="checkbox" id="set-showArmor" onChange={(event) => { setToggle('showArmor',event.currentTarget.checked) }} defaultChecked /></label>
          <label className="set-label">敵HPバー <input type="checkbox" id="set-showEnemyHp" onChange={(event) => { setToggle('showEnemyHp',event.currentTarget.checked) }} defaultChecked /></label>
          <label className="set-label">ボスバー/タイマー <input type="checkbox" id="set-showTimer" onChange={(event) => { setToggle('showTimer',event.currentTarget.checked) }} defaultChecked /></label>
          <label className="set-label">ダメージ数値 <input type="checkbox" id="set-dmgIndicator" onChange={(event) => { setToggle('dmgIndicator',event.currentTarget.checked) }} defaultChecked /></label>
          <div className="set-section" style={{marginTop: 12}}>🖱️ 操作</div>
          <label className="set-label">感度: <span id="lbl-sens">0.15</span>
            <input type="range" id="set-sens" min={1} max={50} defaultValue={15} onInput={(event) => { applySettings() }} /></label>
          <label className="set-label">Y軸反転 <input type="checkbox" id="set-invertY" onChange={(event) => { setToggle('invertY',event.currentTarget.checked) }} /></label>
          <div className="set-section" style={{marginTop: 12}}>🔊 サウンド</div>
          <label className="set-label">主音量: <span id="lbl-vol">80</span>%
            <input type="range" id="set-vol" min={0} max={100} defaultValue={80} onInput={(event) => { applySettings() }} /></label>
          <label className="set-label">BGM音量: <span id="lbl-bgm">60</span>%
            <input type="range" id="set-bgm" min={0} max={100} defaultValue={60} onInput={(event) => { applySettings() }} /></label>
          <label className="set-label">効果音: <span id="lbl-sfx">80</span>%
            <input type="range" id="set-sfx" min={0} max={100} defaultValue={80} onInput={(event) => { applySettings() }} /></label>
          <label className="set-label">空間オーディオ <input type="checkbox" id="set-spatialAudio" onChange={(event) => { setToggle('spatialAudio',event.currentTarget.checked) }} defaultChecked /></label>
          <label className="set-label">ベッド破壊アラート <input type="checkbox" id="set-bedAlert" onChange={(event) => { setToggle('bedAlert',event.currentTarget.checked) }} defaultChecked /></label>
          <div className="set-section" style={{marginTop: 12}}>⌨️ キー設定</div>
          <div id="keybind-list" style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 12}} />
        </div>
      </div>
      <div style={{textAlign: 'center', marginTop: 20, display: 'flex', gap: 12, justifyContent: 'center'}}>
        <button className="mc-btn" onClick={(event) => { saveSettings() }} style={{fontSize: 17}}>💾 保存</button>
        <button className="mc-btn btn-red" onClick={(event) => { closeSettings() }} style={{fontSize: 17}}>✕ 閉じる</button>
        <button className="mc-btn" onClick={(event) => { resetSettings() }} style={{fontSize: 15, background: '#555'}}>↩ リセット</button>
      </div>
    </div>
  </div>
  {/* v8: 終了画面 */}
  {/* v9: ソロ一時停止メニュー */}
  <div id="pause-menu" style={{display: 'none', position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.72)', zIndex: 5000}}>
    <div style={{position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: '#1a1a1a', border: '3px solid #555', borderRadius: 8, padding: '32px 40px', textAlign: 'center', minWidth: 280}}>
      <div style={{fontSize: 28, color: '#fff', fontWeight: 'bold', marginBottom: 24}}>⏸ 一時停止</div>
      <div style={{display: 'flex', flexDirection: 'column', gap: 10}}>
        <button className="mc-btn" onClick={(event) => { resumeGame() }} style={{fontSize: 18}}>▶ ゲームに戻る</button>
        <button className="mc-btn" onClick={(event) => { closeIngameMenu();openSettings(); }} style={{fontSize: 18}}>⚙️ 設定</button>
        <button className="mc-btn btn-red" onClick={(event) => { location.reload() }} style={{fontSize: 18}}>🚪 タイトルに戻る</button>
      </div>
    </div>
  </div>
  {/* v9: マルチ中ゲーム内メニュー */}
  <div id="ingame-menu" style={{display: 'none', position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.72)', zIndex: 5000}}>
    <div style={{position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: '#1a1a1a', border: '3px solid #555', borderRadius: 8, padding: '32px 40px', textAlign: 'center', minWidth: 300}}>
      <div style={{fontSize: 28, color: '#fff', fontWeight: 'bold', marginBottom: 24}}>🌐 メニュー</div>
      <div style={{display: 'flex', flexDirection: 'column', gap: 10}}>
        <button className="mc-btn" onClick={(event) => { closeIngameMenu() }} style={{fontSize: 18}}>▶ ゲームに戻る</button>
        <button className="mc-btn" onClick={(event) => { closeIngameMenu();openSettings(); }} style={{fontSize: 18}}>⚙️ 設定</button>
        <button className="mc-btn btn-gold" onClick={(event) => { closeIngameMenu();openFriendUI(); }} style={{fontSize: 16}}>👥 フレンド &amp; ランキング</button>
        <button className="mc-btn btn-red" onClick={(event) => { typeof leaveToLobby==='function'?leaveToLobby():location.reload() }} style={{fontSize: 18}}>🚪 ロビーに戻る</button>
      </div>
    </div>
  </div>
  <div id="end-screen" style={{display: 'none', position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 4000, overflow: 'hidden'}}>
    {/* 背景: 島がくるくる */}
    <canvas id="end-bg-canvas" style={{position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0}} />
    {/* 成績パネル */}
    <div id="end-panel" style={{position: 'relative', zIndex: 10, maxWidth: 600, margin: '40px auto', background: 'rgba(0,0,0,0.88)', border: '3px solid #ffaa00', borderRadius: 10, padding: 30}}>
      <h2 id="end-title" style={{textAlign: 'center', fontSize: 42, margin: '0 0 16px', color: '#ffaa00'}}>🏆 試合終了</h2>
      <div id="end-result" style={{textAlign: 'center', fontSize: 22, color: '#fff', marginBottom: 20}} />
      <div id="end-stats" style={{display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, textAlign: 'center', marginBottom: 20}} />
      <div id="end-ranking" style={{marginBottom: 16}} />
      {/* 終了画面チャット */}
      <div id="end-chat-area" style={{border: '2px solid #444', borderRadius: 4, overflow: 'hidden', marginBottom: 16}}>
        <div style={{background: '#222', padding: '4px 8px', fontSize: 11, color: '#888'}}>試合後チャット (全員に届きます)</div>
        <div id="end-chat-log" style={{maxHeight: 120, overflowY: 'auto', padding: 6, background: '#111', fontSize: 12}} />
        <div style={{display: 'flex', borderTop: '1px solid #333'}}>
          <input type="text" id="end-chat-input" placeholder="メッセージを入力..." style={{flex: 1, padding: 6, background: '#1a1a1a', color: '#fff', border: 'none', outline: 'none', fontSize: 12}} />
          <button onClick={(event) => { sendEndChat() }} style={{padding: '6px 12px', background: '#444', color: '#fff', border: 'none', cursor: 'pointer', borderLeft: '1px solid #333'}}>送信</button>
        </div>
      </div>
      <div style={{textAlign: 'center'}}>
        <button className="mc-btn btn-green" onClick={(event) => { leaveToLobby() }} style={{fontSize: 20, width: '100%'}}>🚪 ロビーに戻る</button>
      </div>
    </div>
  </div>
  <div id="view-badge-overlay">👁 三人称視点</div>
  <div id="mp-overlay">
    <span id="mp-status">🌐 接続中...</span>
    <div id="mp-players" />
  </div>
  <div id="scoreboard">
    <h3>🛏 BedWars</h3>
    <div id="sb-entries" />
    <div className="sb-line" style={{marginTop: 6, borderTop: '1px solid #555', paddingTop: 4, color: '#ccc'}}>
      <span>Kills</span><span id="hud-kills">0</span>
    </div>
  </div>
  <div id="hud">
    <div style={{fontSize: 18, color: '#ffff88', marginBottom: 4, textShadow: '2px 2px 0 #000'}}><span id="hud-player-name">Player1</span></div>
    <div className="hud-bar" style={{color: '#ff5555'}}>❤ <span id="hp">20</span>/<span id="hp-max">20</span></div>
    <div className="hud-bar" style={{color: '#FFAA00'}}>🍗 <span id="hunger">20</span>/20</div>
    <div className="hud-bar" style={{color: '#55ffff'}}>💎 <span id="res-dia">0</span></div>
    <div className="hud-bar" style={{color: '#55ff55'}}>💚 <span id="res-em">0</span></div>
    <span id="status-msg" />
    <span id="view-badge" />
  </div>
  {/* ホットバー上 HP/防御力バー */}
  <div id="hotbar-status" style={{position: 'absolute', bottom: 72, left: '50%', transform: 'translateX(-50%)', display: 'flex', zIndex: 98, background: 'rgba(0,0,0,0.6)', padding: '3px 10px', borderRadius: 4, fontSize: 13, color: '#fff', textShadow: '1px 1px 0 #000', gap: 12, alignItems: 'center', whiteSpace: 'nowrap'}}>
    <span>❤ <span id="hb-hp">20</span>/<span id="hb-hp-max">20</span></span>
    <span>🛡 <span id="hb-armor">0</span></span>
    <span>⚡ <span id="hb-level">1</span>Lv</span>
  </div>
  <button id="btn-view-toggle" style={{position: 'absolute', top: 10, right: 10, fontFamily: '"VT323",monospace', fontSize: 16, padding: '6px 12px', background: '#444', color: '#ffff55', border: '2px solid #666', cursor: 'pointer', zIndex: 99, display: 'none'}}>👁 1st</button>
  <div id="hotbar-wrap" />
  {/* ===== SHOP / UPGRADE ===== */}
  <div id="win-shop" className="window">
    <h2>🛒 ITEM SHOP</h2>
    <div className="tabs" id="shop-tabs">
      <div className="tab active" data-cat="Blocks">Blocks</div>
      <div className="tab" data-cat="Weapons">Weapons</div>
      <div className="tab" data-cat="Tools">Tools</div>
      <div className="tab" data-cat="Special">Special</div>
    </div>
    <div className="shop-grid" id="shop-content" />
    <button className="mc-btn btn-red" onClick={(event) => { toggleMenu(null) }} style={{width: '100%', marginTop: 10, fontSize: 22}}>閉じる [E]</button>
  </div>
  <div id="win-upgrade" className="window">
    <h2 style={{color: '#55FFFF'}}>⬆ TEAM UPGRADES</h2>
    <p style={{margin: '0 0 8px', color: '#555', fontSize: 15}}>ダイヤモンドでチーム強化</p>
    <div className="shop-grid" id="upgrade-content" />
    <button className="mc-btn btn-red" onClick={(event) => { toggleMenu(null) }} style={{width: '100%', marginTop: 10, fontSize: 22}}>閉じる [E]</button>
  </div>
  {/* ===== INVENTORY OVERLAY ===== */}
  <div id="win-inventory">
    <div className="inv-title">📦 インベントリ [I]</div>
    <div className="inv-top">
      <div className="inv-armor-col" id="inv-armor-col" />
      <div>
        <div className="inv-skin-box" id="inv-skin-box">
          <div className="inv-skin-stage">
            <div className="inv-skin-model" id="inv-model">
              <div className="box-3d head-3d"><div className="face hd-f" /><div className="face hd-b" /><div className="face hd-l" /><div className="face hd-r" /><div className="face hd-u" /><div className="face hd-d" /></div>
              <div className="box-3d body-3d"><div className="face bd-f" /><div className="face bd-b" /><div className="face bd-l" /><div className="face bd-r" /><div className="face bd-u" /><div className="face bd-d" /></div>
              <div className="box-3d r-arm-3d"><div className="face ra-f" /><div className="face ra-b" /><div className="face ra-l" /><div className="face ra-r" /><div className="face ra-u" /><div className="face ra-d" /></div>
              <div className="box-3d l-arm-3d"><div className="face la-f" /><div className="face la-b" /><div className="face la-l" /><div className="face la-r" /><div className="face la-u" /><div className="face la-d" /></div>
              <div className="box-3d r-leg-3d"><div className="face rl-f" /><div className="face rl-b" /><div className="face rl-l" /><div className="face rl-r" /><div className="face rl-u" /><div className="face rl-d" /></div>
              <div className="box-3d l-leg-3d"><div className="face ll-f" /><div className="face ll-b" /><div className="face ll-l" /><div className="face ll-r" /><div className="face ll-u" /><div className="face ll-d" /></div>
            </div>
          </div>
        </div>
      </div>
      <div className="inv-info">
        チーム: <span id="inv-team">-</span><br />
        HP: <span id="inv-hp">20</span>/20<br />
        空腹: <span id="inv-hunger">20</span>/20<br />
        床: <span id="inv-bed">✓</span>
      </div>
    </div>
    <div style={{fontSize: 13, color: '#555', marginBottom: 4}}>メインインベントリ</div>
    <div className="inv-grid" id="inv-main" style={{marginBottom: 6}} />
    <div style={{fontSize: 13, color: '#555', marginBottom: 4, borderTop: '2px solid #999', paddingTop: 6}}>ホットバー</div>
    <div className="inv-grid" id="inv-hotbar" />
    <button className="mc-btn btn-red" onClick={(event) => { toggleMenu(null) }} style={{width: '100%', marginTop: 10, fontSize: 21}}>閉じる [I]</button>
  </div>
    </>
  );
}

export default memo(LegacyUI);
