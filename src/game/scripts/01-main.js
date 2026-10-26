
'use strict';
// ================================================================
//  BedWars Ultimate — Integrated Edition
//  Backend: Supabase (Realtime + REST fallback via supabase-js)
// ================================================================

// ================================================================
// Supabase 接続設定
// ※ ブラウザに置いてよいのは Project URL と publishable/anon key のみ。
//    service_role key は絶対にここへ入れない。
// ================================================================
const SUPABASE_URL = window.__BW_CONFIG?.supabaseUrl || '';
const SUPABASE_ANON_KEY = window.__BW_CONFIG?.supabaseAnonKey || '';
window.SUPABASE_URL = SUPABASE_URL;
window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;

if(!SUPABASE_URL || !SUPABASE_ANON_KEY){
  console.warn('Supabase設定がありません。オフラインモードで起動します。');
} else if(!window.supabase){
  console.error('Supabase JS が読み込まれていません。');
} else {
  window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

function _setSupabaseStatus(text,color){
  const el=document.getElementById('supabase-connection-status');
  if(el){el.textContent=text;el.style.color=color||'#888';}
}
if(window.supabaseClient){
  _setSupabaseStatus('Supabase: 接続準備完了','#55ffff');
}else{
  _setSupabaseStatus('Supabase: オフライン','#888');
}

// ---- Persistent data ----
// Persistence is supplied by the React runtime; the fallback keeps the
// extracted game engine usable during the migration.
const bwStorage = window.__BW_STORAGE || {
  get:(key,fallback=null)=>localStorage.getItem(key)??fallback,
  set:(key,value)=>localStorage.setItem(key,String(value)),
  remove:(key)=>localStorage.removeItem(key)
};
let playerData = _bwSafeJsonParse(bwStorage.get('bw_data'), {level:1,kills:0,wins:0,name:'Player',skin:null});
if(!playerData || typeof playerData!=='object') playerData={level:1,kills:0,wins:0,name:'Player',skin:null};
playerData.level=Math.max(1,Math.floor(Number(playerData.level)||1));
playerData.kills=Math.max(0,Math.floor(Number(playerData.kills)||0));
playerData.wins=Math.max(0,Math.floor(Number(playerData.wins)||0));
playerData.name=String(playerData.name||'Player').slice(0,64);
let playerName = String(bwStorage.get('bw_name') || 'Player').slice(0,16);
let playerSkin = _bwSafeImageSource(bwStorage.get('bw_skin') || '') || null;
document.getElementById('lobby-level').textContent = playerData.level;
document.getElementById('lobby-kills').textContent  = playerData.kills;
document.getElementById('lobby-wins').textContent   = playerData.wins;
document.getElementById('player-name').value = playerName;
setTimeout(()=>{ if(window.supabaseClient) sbRequest({action:'testPing'}); },0);

// ---- Safe rendering helpers ----
// Supabase由来の名前・チャット・UIDはすべて外部入力として扱う。
function _bwEscapeHtml(value){
  return String(value ?? '').replace(/[&<>"']/g, c => (
    {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]
  ));
}
function _bwSafeColor(value, fallback='#ffffff'){
  const s=String(value ?? '').trim();
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(s) ? s : fallback;
}
function _bwEncodeArg(value){
  return encodeURIComponent(String(value ?? '')).replace(/'/g,'%27');
}
function _bwSafeImageSource(value){
  const s=String(value ?? '').trim();
  return /^data:image\/(?:png|jpe?g|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(s) ? s : '';
}
function _bwSafeCssUrl(value){
  const s=String(value ?? '');
  return s ? `"${s.replace(/["\\\n\r]/g,'\\$&')}"` : '""';
}
function _bwSafeJsonParse(raw, fallback){
  if(raw == null || raw === '') return fallback;
  try{
    const parsed=JSON.parse(raw);
    return parsed == null ? fallback : parsed;
  }catch(e){
    console.warn('保存データのJSON解析に失敗したため既定値を使用します', e);
    return fallback;
  }
}

// ---- Team config ----
const TEAM_COLOR    = {Red:0xe05050, Blue:0x5555ee, Green:0x22aa22, Yellow:0xddaa00};
const TEAM_COLOR_HEX= {Red:'#e05555', Blue:'#5599ff', Green:'#55ff55', Yellow:'#FFAA00'};
const TEAM_WOOL_HEX = {Red:'#cc4444', Blue:'#4444cc', Green:'#228822', Yellow:'#ccaa00'};
const TEAM_ISLAND_POS={
  Red:   {x:0,  y:60, z:-70},
  Blue:  {x:0,  y:60, z:70},
  Green: {x:70, y:60, z:0},
  Yellow:{x:-70,y:60, z:0}
};
const TEAM_SPAWN={
  Red:   {x:0,  y:62, z:-70},
  Blue:  {x:0,  y:62, z:70},
  Green: {x:72, y:62, z:0},
  Yellow:{x:-72,y:62, z:0}
};

// ================================================================
//  マップテーマ定義 (ランダムで選択、ホストが決定)
// ================================================================
const MAP_THEMES={
  // 1: 草原島 (デフォルト)
  grassland:{
    name:'🌿 草原の島',
    baseTop:'grass', baseFill:'dirt', baseDeep:'stone',
    midTop:'end', midFill:'stone', midR:14,
    diaTop:'grass', diaFill:'dirt',
    treeType:'oak',
    skyColor:0x87CEEB,
    fogColor:0x87CEEB, fogDensity:0.005
  },
  // 2: 砂漠
  desert:{
    name:'🏜️ 砂漠の島',
    baseTop:'sand', baseFill:'sand', baseDeep:'sandstone',
    midTop:'sandstone', midFill:'sandstone', midR:13,
    diaTop:'sand', diaFill:'sandstone',
    treeType:'cactus',
    skyColor:0xf0d080,
    fogColor:0xf0d080, fogDensity:0.006
  },
  // 3: 雪原
  snow:{
    name:'❄️ 雪の島',
    baseTop:'snow', baseFill:'dirt', baseDeep:'stone',
    midTop:'packed_ice', midFill:'stone', midR:14,
    diaTop:'snow', diaFill:'stone',
    treeType:'pine',
    skyColor:0xc0e8ff,
    fogColor:0xc0e8ff, fogDensity:0.006
  },
  // 4: ネザー
  nether:{
    name:'🔥 ネザーの島',
    baseTop:'netherrack', baseFill:'netherrack', baseDeep:'soul_sand',
    midTop:'nether_brick', midFill:'netherrack', midR:13,
    diaTop:'netherrack', diaFill:'soul_sand',
    treeType:'mushroom',
    skyColor:0x2a0a00,
    fogColor:0x4a1500, fogDensity:0.008
  },
  // 5: エンド
  end:{
    name:'🌌 エンドの島',
    baseTop:'end', baseFill:'end', baseDeep:'end',
    midTop:'end', midFill:'end', midR:14,
    diaTop:'end', diaFill:'end',
    treeType:'chorus',
    skyColor:0x0a0020,
    fogColor:0x100030, fogDensity:0.007
  },
  // 6: きのこ島
  mushroom:{
    name:'🍄 きのこの島',
    baseTop:'mycelium', baseFill:'dirt', baseDeep:'stone',
    midTop:'mycelium', midFill:'stone', midR:14,
    diaTop:'mycelium', diaFill:'dirt',
    treeType:'mushroom_giant',
    skyColor:0xb090c0,
    fogColor:0xb090c0, fogDensity:0.006
  },
  // 7: メサ（荒野）
  mesa:{
    name:'🏔️ 荒野の島',
    baseTop:'red_sand', baseFill:'terracotta', baseDeep:'terracotta',
    midTop:'terracotta', midFill:'terracotta', midR:13,
    diaTop:'red_sand', diaFill:'terracotta',
    treeType:'dead',
    skyColor:0xffb060,
    fogColor:0xffb060, fogDensity:0.007
  }
};
const MAP_THEME_KEYS=Object.keys(MAP_THEMES);
let currentMapTheme='grassland'; // ホストが選択またはランダム
let currentMapSeed=0;
let currentMatchId=null;
let _supabaseRealtimeChannels=[];

function pickRandomMap(){
  const keys=MAP_THEME_KEYS;
  return keys[Math.floor(Math.random()*keys.length)];
}

// ---- Item emoji & label ----
const ITEM_EMOJI={
  'wool_red':'🟥','wool_blue':'🟦','wool_green':'🟩','wool_yellow':'🟨',
  wood:'🪵', end:'🟡', dirt:'🟫', grass:'🌿', stone:'🪨',
  stone_sword:'⚔️', iron_sword:'🗡️',
  bow:'🏹', arrow:'➶', shears:'✂️', pickaxe:'⛏️',
  g_apple:'🍎', golem:'🤖',
  iron:'⬜', gold:'🟡', dia:'💎', emerald:'💚'
};
const ITEM_LABEL={
  'wool_red':'Wool','wool_blue':'Wool','wool_green':'Wool','wool_yellow':'Wool',
  wood:'Wood', end:'End', dirt:'Dirt', grass:'Grass', stone:'Stone',
  stone_sword:'S.Sword', iron_sword:'I.Sword',
  bow:'Bow', arrow:'Arrow', shears:'Shears', pickaxe:'Pick',
  g_apple:'GApple', golem:'Golem',
  iron:'Iron', gold:'Gold', dia:'Diamond', emerald:'Emerald'
};
function woolKey(team){return 'wool_'+(team||'blue').toLowerCase();}
function itemEmoji(type){
  if(!type) return '';
  return ITEM_EMOJI[type]||'📦';
}

// ================================================================
//  アイテムアイコンデザイン v13
//  カテゴリ別グラデーション＋ベベル枠で「絵文字だけ」感を解消
// ================================================================
const ITEM_CATEGORY_COLOR={
  // ブロック系: 土色〜緑
  wool_red:['#e05555','#a02020'], wool_blue:['#5588e0','#1a3a90'],
  wool_green:['#55c060','#1a7020'], wool_yellow:['#e0c030','#a08000'],
  wood:['#c08850','#7a5020'], end:['#e8e0b0','#a8a060'],
  dirt:['#9a6b3c','#5a3d1e'], grass:['#7ec850','#3d7a20'], stone:['#a8a8a8','#606060'],
  cobblestone:['#909090','#4a4a4a'], log:['#a0764a','#5a3a1a'], leaves:['#4a9030','#1e5010'],
  // 武器: 鋼色〜赤
  stone_sword:['#b8b8c0','#606068'], iron_sword:['#e0e0e8','#909098'],
  dia_sword:['#70e0f0','#20a0c0'], bow:['#c09050','#7a5020'],
  // 防具: 青灰〜水色
  helmet_iron:['#d8d8e0','#888890'], chest_iron:['#d8d8e0','#888890'],
  legs_iron:['#d8d8e0','#888890'],  boots_iron:['#d8d8e0','#888890'],
  helmet_dia:['#80f0ff','#20b0d0'], chest_dia:['#80f0ff','#20b0d0'],
  legs_dia:['#80f0ff','#20b0d0'],   boots_dia:['#80f0ff','#20b0d0'],
  // ツール: 茶〜灰
  shears:['#c8c8c8','#707070'], pickaxe:['#b0b0b0','#606060'],
  iron_pickaxe:['#d8d8e0','#888890'], dia_pickaxe:['#80f0ff','#20b0d0'], axe:['#c09050','#7a5020'],
  // 特殊: 金〜緑
  g_apple:['#ffe060','#c09000'], golem:['#c0c0c8','#707078'],
  hp_pot:['#ff8080','#c02020'], bread:['#d8a860','#a06820'], steak:['#c07050','#803820'],
  // リソース: 各素材色
  iron:['#e8e8e8','#909090'], gold:['#ffe060','#c09800'],
  dia:['#80f0ff','#00c0e0'], emerald:['#70f090','#10a040']
};

// スロットのアイコンHTMLを生成（ベベル枠付きカード風デザイン）
function itemIconHTML(type){
  if(!type) return '';
  const colors=ITEM_CATEGORY_COLOR[type]||['#c8c8c8','#707070'];
  const emoji=itemEmoji(type);
  return `<div class="item-icon" style="background:linear-gradient(145deg,${colors[0]},${colors[1]});">`+
         `<span class="item-icon-glyph">${emoji}</span></div>`;
}

// ---- Shop & Upgrade Data ----
const shopItems=[
  // ブロック類（すべて設置可能・機能確認済み）
  {cat:'Blocks', type:'wool',  count:16, costType:'iron',    cost:4,   emoji:'🔲', name:'ウール x16'},
  {cat:'Blocks', type:'wood',  count:4,  costType:'iron',    cost:4,   emoji:'🪵', name:'木材 x4'},
  {cat:'Blocks', type:'end',   count:2,  costType:'iron',    cost:12,  emoji:'🟡', name:'End石 x2'},
  {cat:'Blocks', type:'dirt',  count:8,  costType:'iron',    cost:2,   emoji:'🟫', name:'土 x8'},
  {cat:'Blocks', type:'stone', count:4,  costType:'iron',    cost:3,   emoji:'🪨', name:'石 x4'},
  // 武器類（すべてダメージ計算に反映済み）
  {cat:'Weapons', type:'stone_sword',count:1,costType:'iron',cost:10,  emoji:'⚔️', name:'石の剣'},
  {cat:'Weapons', type:'iron_sword', count:1,costType:'gold',cost:7,   emoji:'🗡️', name:'鉄の剣'},
  {cat:'Weapons', type:'dia_sword',  count:1,costType:'emerald',cost:8,emoji:'🗡️', name:'ダイヤの剣'},
  {cat:'Weapons', type:'bow',       count:1,costType:'gold', cost:12,  emoji:'🏹', name:'弓'},
  // 防具（装備システムで機能確認済み）
  {cat:'Armor', type:'helmet_iron', count:1,costType:'iron', cost:20,  emoji:'🪖', name:'鉄ヘルメット'},
  {cat:'Armor', type:'chest_iron',  count:1,costType:'iron', cost:24,  emoji:'🦺', name:'鉄チェスト'},
  {cat:'Armor', type:'legs_iron',   count:1,costType:'iron', cost:22,  emoji:'👖', name:'鉄レギンス'},
  {cat:'Armor', type:'boots_iron',  count:1,costType:'iron', cost:16,  emoji:'👟', name:'鉄ブーツ'},
  {cat:'Armor', type:'helmet_dia',  count:1,costType:'gold', cost:6,   emoji:'🪖', name:'ダイヤヘルメット'},
  {cat:'Armor', type:'chest_dia',   count:1,costType:'gold', cost:8,   emoji:'🦺', name:'ダイヤチェスト'},
  {cat:'Armor', type:'legs_dia',    count:1,costType:'gold', cost:7,   emoji:'👖', name:'ダイヤレギンス'},
  {cat:'Armor', type:'boots_dia',   count:1,costType:'gold', cost:4,   emoji:'👟', name:'ダイヤブーツ'},
  // ツール（採掘速度に反映済み）
  {cat:'Tools',  type:'shears',  count:1,costType:'iron',    cost:20,  emoji:'✂️', name:'ハサミ(ウール即壊)'},
  {cat:'Tools',  type:'pickaxe', count:1,costType:'iron',    cost:12,  emoji:'⛏️', name:'ツルハシ'},
  {cat:'Tools',  type:'iron_pickaxe',count:1,costType:'gold',cost:8,   emoji:'⛏️', name:'鉄ツルハシ(高速)'},
  {cat:'Tools',  type:'dia_pickaxe', count:1,costType:'emerald',cost:6,emoji:'⛏️', name:'ダイヤツルハシ(最速)'},
  {cat:'Tools',  type:'axe',     count:1,costType:'iron',    cost:14,  emoji:'🪓', name:'斧(木材高速)'},
  // 特殊（回復・召喚が機能確認済み）
  {cat:'Special',type:'g_apple',count:1,costType:'gold',    cost:24,  emoji:'🍎', name:'黄金のリンゴ(+6HP)'},
  {cat:'Special',type:'golem',  count:1,costType:'emerald', cost:24,  emoji:'🤖', name:'アイアンゴーレム'},
  {cat:'Special',type:'hp_pot', count:1,costType:'gold',    cost:5,   emoji:'❤️', name:'回復ポーション(+4HP)'},
  {cat:'Special',type:'bread',  count:3,costType:'iron',    cost:2,   emoji:'🍞', name:'パン x3(空腹+3)'},
  {cat:'Special',type:'steak',  count:2,costType:'gold',    cost:3,   emoji:'🥩', name:'ステーキ x2(空腹+8)'},
];

// ================================================================
//  チームアップグレード（本家BedWars準拠 + 追加）
// ================================================================
const upgradeItems=[
  {name:'Sharp Sword',   emoji:'⚔️', key:'sharpness', cost:4,  desc:'剣の攻撃力+12%'},
  {name:'Protection',    emoji:'🛡️', key:'protection',cost:4,  desc:'被ダメージ-12%（重ねがけ可）'},
  {name:'Haste',         emoji:'⚡', key:'haste',     cost:2,  desc:'採掘速度+30%'},
  {name:'Heal Pool',     emoji:'💉', key:'healpool',  cost:5,  desc:'自陣で自然回復'},
  {name:'Alarm Trap',    emoji:'🪤', key:'trap',      cost:1,  desc:'敵侵入を検知して警告'},
  {name:'Counter Trap',  emoji:'🕸️', key:'countertrap',cost:2, desc:'敵に鈍化を付与するトラップ'},
  {name:'Miner Fatigue Trap',emoji:'⛏️',key:'minertrap',cost:4,desc:'敵の採掘速度を低下'},
  {name:'Forge Upgrade', emoji:'🏭', key:'forge',     cost:4,  desc:'資源生成速度アップ'},
  {name:'Dragon Buff',   emoji:'🐉', key:'dragon',    cost:6,  desc:'ベッド破壊後もチームHP微増'},
];

// ================================================================
//  TEXTURE SYSTEM — Minecraft Vanilla Style
// ================================================================
const TS=32;
function makeTex(fn){
  const cv=document.createElement('canvas');cv.width=TS;cv.height=TS;
  const c=cv.getContext('2d');fn(c,TS);
  const t=new THREE.CanvasTexture(cv);
  t.magFilter=THREE.NearestFilter;t.minFilter=THREE.NearestFilter;return t;
}
function addNoise(c,s,v=50){
  const d=c.getImageData(0,0,s,s);
  for(let i=0;i<d.data.length;i+=4){
    const n=(Math.random()-.5)*v;
    d.data[i]  =Math.max(0,Math.min(255,d.data[i]+n));
    d.data[i+1]=Math.max(0,Math.min(255,d.data[i+1]+n));
    d.data[i+2]=Math.max(0,Math.min(255,d.data[i+2]+n));
  }
  c.putImageData(d,0,0);
}

const TEX=(()=>{
  // Grass side
  const grass=makeTex((c,s)=>{
    c.fillStyle='#7a5c3a';c.fillRect(0,0,s,s);
    c.fillStyle='#6db83a';c.fillRect(0,0,s,Math.ceil(s*.12));
    c.fillStyle='rgba(80,50,20,.3)';
    for(let i=0;i<22;i++)c.fillRect(Math.random()*s,s*.12+Math.random()*s*.88,~~(Math.random()*4)+1,~~(Math.random()*3)+1);
    addNoise(c,s,40);
  });
  // Grass top
  const grassTop=makeTex((c,s)=>{
    c.fillStyle='#5d9b2a';c.fillRect(0,0,s,s);
    c.fillStyle='#4d8822';for(let i=0;i<18;i++)c.fillRect(Math.random()*s,Math.random()*s,2,2);
    c.fillStyle='#70b535';for(let i=0;i<10;i++)c.fillRect(Math.random()*s,Math.random()*s,1,1);
    addNoise(c,s,28);
  });
  // Dirt
  const dirt=makeTex((c,s)=>{
    c.fillStyle='#7a5c3a';c.fillRect(0,0,s,s);
    c.fillStyle='#5c4028';for(let i=0;i<28;i++)c.fillRect(Math.random()*s,Math.random()*s,~~(Math.random()*4)+1,~~(Math.random()*3)+1);
    c.fillStyle='#9a7050';for(let i=0;i<12;i++)c.fillRect(Math.random()*s,Math.random()*s,1,1);
    addNoise(c,s,35);
  });
  // Stone
  const stone=makeTex((c,s)=>{
    c.fillStyle='#888';c.fillRect(0,0,s,s);
    c.fillStyle='#666';for(let i=0;i<20;i++)c.fillRect(Math.random()*s,Math.random()*s,~~(Math.random()*5)+2,~~(Math.random()*5)+2);
    c.fillStyle='#aaa';for(let i=0;i<10;i++)c.fillRect(Math.random()*s,Math.random()*s,2,2);
    addNoise(c,s,30);
  });
  // Oak planks
  const wood=makeTex((c,s)=>{
    c.fillStyle='#c4a65a';c.fillRect(0,0,s,s);
    c.fillStyle='rgba(0,0,0,.2)';c.fillRect(0,s/2-1,s,2);c.fillRect(0,0,1,s);c.fillRect(s-1,0,1,s);
    for(let y=0;y<s;y+=3){c.fillStyle=`rgba(${Math.random()>.5?'80,50,10':'160,130,70'},.4)`;c.fillRect(0,y,s,1);}
    addNoise(c,s,25);
  });
  // End stone
  const endStone=makeTex((c,s)=>{
    c.fillStyle='#ddddaa';c.fillRect(0,0,s,s);
    c.fillStyle='#c8c870';for(let i=0;i<18;i++)c.fillRect(Math.random()*s,Math.random()*s,~~(Math.random()*5)+2,~~(Math.random()*4)+2);
    c.fillStyle='#eeeebb';for(let i=0;i<8;i++)c.fillRect(Math.random()*s,Math.random()*s,2,2);
    addNoise(c,s,20);
  });

  function makeWool(hex){
    return makeTex((c,s)=>{
      const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
      c.fillStyle=hex;c.fillRect(0,0,s,s);
      // Fiber texture
      for(let i=0;i<s;i+=2){
        c.fillStyle=`rgba(${Math.max(0,r-35)},${Math.max(0,g-35)},${Math.max(0,b-35)},.45)`;
        c.fillRect(i,0,1,s);
      }
      for(let j=0;j<s;j+=2){
        c.fillStyle=`rgba(${Math.min(255,r+20)},${Math.min(255,g+20)},${Math.min(255,b+20)},.2)`;
        c.fillRect(0,j,s,1);
      }
      c.globalAlpha=.3;
      for(let i=0;i<18;i++)c.fillRect(Math.random()*s,Math.random()*s,2,2);
      c.globalAlpha=1;
      addNoise(c,s,22);
    });
  }

  const iron=makeTex((c,s)=>{const g=c.createLinearGradient(0,0,s,s);g.addColorStop(0,'#e8e8e8');g.addColorStop(.5,'#c0c0c0');g.addColorStop(1,'#d8d8d8');c.fillStyle=g;c.fillRect(0,0,s,s);addNoise(c,s,15);});
  const gold=makeTex((c,s)=>{const g=c.createLinearGradient(0,0,s,s);g.addColorStop(0,'#ffe066');g.addColorStop(.5,'#ccaa00');g.addColorStop(1,'#ffcc33');c.fillStyle=g;c.fillRect(0,0,s,s);addNoise(c,s,18);});
  const dia =makeTex((c,s)=>{const g=c.createLinearGradient(0,0,s,s);g.addColorStop(0,'#80ffff');g.addColorStop(.5,'#00cccc');g.addColorStop(1,'#55ffff');c.fillStyle=g;c.fillRect(0,0,s,s);addNoise(c,s,12);});
  const em  =makeTex((c,s)=>{const g=c.createLinearGradient(0,0,s,s);g.addColorStop(0,'#80ff80');g.addColorStop(.5,'#00aa44');g.addColorStop(1,'#55ff55');c.fillStyle=g;c.fillRect(0,0,s,s);addNoise(c,s,14);});

  // 石畳 (cobblestone)
  const cobblestone=makeTex((c,s)=>{
    c.fillStyle='#777';c.fillRect(0,0,s,s);
    // 石ブロックのランダムパターン
    const patches=[[0,0,7,7],[8,0,7,7],[0,8,7,7],[8,8,7,7],
                   [3,3,10,4],[1,5,6,6],[9,4,6,7]];
    patches.forEach(([x,y,w,h])=>{
      const v=Math.floor(Math.random()*30);
      c.fillStyle=`rgb(${100+v},${100+v},${100+v})`;c.fillRect(x,y,w,h);
    });
    c.strokeStyle='#555';c.lineWidth=1;
    c.strokeRect(0,0,s/2,s/2);c.strokeRect(s/2,0,s/2,s/2);
    c.strokeRect(0,s/2,s/2,s/2);c.strokeRect(s/2,s/2,s/2,s/2);
    addNoise(c,s,25);
  });

  // 丸太 (oak log)
  const log=makeTex((c,s)=>{
    // 側面: 縦縞の樹皮
    c.fillStyle='#5a3a1a';c.fillRect(0,0,s,s);
    for(let x=0;x<s;x+=2){
      const v=Math.floor(Math.random()*30);
      c.fillStyle=`rgb(${70+v},${45+v},${15+v})`;c.fillRect(x,0,1,s);
    }
    c.fillStyle='rgba(0,0,0,0.3)';c.fillRect(0,0,1,s);c.fillRect(s-1,0,1,s);
    addNoise(c,s,20);
  });
  const logTop=makeTex((c,s)=>{
    // 上面: 年輪
    c.fillStyle='#7a5a2a';c.fillRect(0,0,s,s);
    for(let r2=s*0.9;r2>2;r2-=3){
      c.strokeStyle=`rgba(${Math.floor(60+r2)},${Math.floor(35+r2*0.5)},${Math.floor(10+r2*0.3)},0.5)`;
      c.lineWidth=1;c.beginPath();c.arc(s/2,s/2,r2/2,0,Math.PI*2);c.stroke();
    }
    addNoise(c,s,18);
  });

  // 葉っぱ (oak leaves)
  const leaves=makeTex((c,s)=>{
    c.fillStyle='#2d6e1a';c.fillRect(0,0,s,s);
    for(let i=0;i<30;i++){
      const lx=Math.random()*s,ly=Math.random()*s;
      c.fillStyle=Math.random()>0.5?'#3a8a22':'#1d5510';
      c.fillRect(lx,ly,~~(Math.random()*4)+2,~~(Math.random()*3)+1);
    }
    // 透明感
    c.fillStyle='rgba(255,255,255,0.04)';c.fillRect(0,0,s,s);
    addNoise(c,s,20);
  });

  return {
    grass, grassTop, dirt, stone, wood, end:endStone,
    cobblestone, log, logTop, leaves,
    // 砂漠
    sand:makeTex((c,s)=>{c.fillStyle='#e8d090';c.fillRect(0,0,s,s);for(let i=0;i<25;i++){c.fillStyle=`rgba(${180+~~(Math.random()*40)},${160+~~(Math.random()*30)},${80+~~(Math.random()*30)},0.5)`;c.fillRect(~~(Math.random()*s),~~(Math.random()*s),~~(Math.random()*4)+1,1);}addNoise(c,s,18);}),
    sandstone:makeTex((c,s)=>{c.fillStyle='#d4b060';c.fillRect(0,0,s,s);for(let y=0;y<s;y+=4){c.fillStyle='rgba(0,0,0,0.15)';c.fillRect(0,y,s,1);}for(let i=0;i<10;i++){c.fillStyle='rgba(200,170,80,0.4)';c.fillRect(~~(Math.random()*s),~~(Math.random()*s),4,2);}addNoise(c,s,15);}),
    // 雪
    snow:makeTex((c,s)=>{c.fillStyle='#f0f8ff';c.fillRect(0,0,s,s);for(let i=0;i<20;i++){c.fillStyle='rgba(200,220,255,0.5)';c.fillRect(~~(Math.random()*s),~~(Math.random()*s),~~(Math.random()*4)+1,1);}addNoise(c,s,10);}),
    packed_ice:makeTex((c,s)=>{c.fillStyle='#90c8e8';c.fillRect(0,0,s,s);for(let i=0;i<15;i++){c.fillStyle='rgba(150,200,230,0.6)';c.fillRect(~~(Math.random()*s),~~(Math.random()*s),~~(Math.random()*5)+2,~~(Math.random()*3)+1);}c.fillStyle='rgba(255,255,255,0.2)';c.fillRect(0,0,s,s);addNoise(c,s,12);}),
    // ネザー
    netherrack:makeTex((c,s)=>{c.fillStyle='#8b1a1a';c.fillRect(0,0,s,s);for(let i=0;i<30;i++){c.fillStyle=`rgba(${150+~~(Math.random()*60)},${20+~~(Math.random()*30)},${20},0.5)`;c.fillRect(~~(Math.random()*s),~~(Math.random()*s),~~(Math.random()*4)+1,~~(Math.random()*3)+1);}addNoise(c,s,35);}),
    soul_sand:makeTex((c,s)=>{c.fillStyle='#5a3a2a';c.fillRect(0,0,s,s);for(let i=0;i<20;i++){c.fillStyle='rgba(80,50,30,0.6)';c.fillRect(~~(Math.random()*s),~~(Math.random()*s),~~(Math.random()*5)+2,~~(Math.random()*4)+1);}for(let i=0;i<5;i++){const fx=~~(Math.random()*s),fy=~~(Math.random()*s);c.fillStyle='rgba(50,50,80,0.4)';c.fillRect(fx,fy,3,3);}addNoise(c,s,28);}),
    nether_brick:makeTex((c,s)=>{c.fillStyle='#3a1010';c.fillRect(0,0,s,s);c.fillStyle='#2a0a0a';for(let y=0;y<s;y+=4){for(let x=0;x<s;x+=8){c.fillRect(x+(y%8===0?0:4),y,7,3);}}c.fillStyle='rgba(80,0,0,0.5)';c.fillRect(0,0,s,s);addNoise(c,s,20);}),
    // 汎用フォールバック
    chorus:makeTex((c,s)=>{c.fillStyle='#7a5088';c.fillRect(0,0,s,s);for(let i=0;i<20;i++){c.fillStyle='rgba(120,70,140,0.5)';c.fillRect(~~(Math.random()*s),~~(Math.random()*s),3,3);}addNoise(c,s,25);}),
    mycelium:makeTex((c,s)=>{c.fillStyle='#7a6a8a';c.fillRect(0,0,s,s);for(let i=0;i<25;i++){c.fillStyle=`rgba(${140+~~(Math.random()*30)},${100+~~(Math.random()*30)},${160+~~(Math.random()*30)},0.5)`;c.fillRect(~~(Math.random()*s),~~(Math.random()*s),~~(Math.random()*3)+1,~~(Math.random()*3)+1);}addNoise(c,s,20);}),
    red_sand:makeTex((c,s)=>{c.fillStyle='#a85830';c.fillRect(0,0,s,s);for(let i=0;i<25;i++){c.fillStyle=`rgba(${170+~~(Math.random()*40)},${80+~~(Math.random()*30)},${40},0.5)`;c.fillRect(~~(Math.random()*s),~~(Math.random()*s),~~(Math.random()*4)+1,1);}addNoise(c,s,20);}),
    terracotta:makeTex((c,s)=>{c.fillStyle='#8a4530';c.fillRect(0,0,s,s);for(let y=0;y<s;y+=3){c.fillStyle=`rgba(${120+~~(Math.random()*50)},${60+~~(Math.random()*30)},${40},0.4)`;c.fillRect(0,y,s,2);}addNoise(c,s,22);}),
    wool_red:   makeWool(TEAM_WOOL_HEX.Red),
    wool_blue:  makeWool(TEAM_WOOL_HEX.Blue),
    wool_green: makeWool(TEAM_WOOL_HEX.Green),
    wool_yellow:makeWool(TEAM_WOOL_HEX.Yellow),
    iron, gold, dia, emerald:em
  };
})();

// ================================================================
//  GAME STATE
// ================================================================
let scene, camera, renderer;
const clock={
  _last:0,
  getDelta(){
    const now=performance.now();
    if(!this._last){ this._last=now; return 0; }
    const delta=(now-this._last)/1000;
    this._last=now;
    return Math.min(delta,0.05);
  }
};
let gameMode=null, teamMode=2;
function _bwGetStablePeerId(){
  const key='bw_uid';
  let id=bwStorage.get(key);
  if(typeof id!=='string' || !/^[A-Za-z0-9_-]{8,128}$/.test(id)){
    const rnd=(typeof crypto!=='undefined' && typeof crypto.randomUUID==='function')
      ? crypto.randomUUID().replace(/-/g,'')
      : Math.random().toString(36).slice(2)+Date.now().toString(36);
    id='pid_'+rnd.slice(0,40);
    bwStorage.set(key,id);
  }
  return id;
}
let myPeerId=_bwGetStablePeerId();
window.__BW_LOCAL_PEER_ID=myPeerId;
if(window.supabaseClient?.auth){
  window.__BW_AUTH_READY=(async()=>{
    try{
      const {data:{session}}=await window.supabaseClient.auth.getSession();
      let user=session?.user;
      if(!user){
        const {data,error}=await window.supabaseClient.auth.signInAnonymously();
        if(error) throw error;
        user=data.user;
      }
      if(user?.id){
        myPeerId=user.id;
        bwStorage.set('bw_uid',myPeerId);
        _setSupabaseStatus('Supabase: 匿名認証OK','#55ffff');
      }
    }catch(e){
      console.warn('Supabase匿名認証に失敗したためローカルIDを使用します', e);
      _setSupabaseStatus('Supabase: 認証なし（ローカルID）','#ffaa00');
    }
    return myPeerId;
  })();
}else{
  window.__BW_AUTH_READY=Promise.resolve(myPeerId);
}
let isHost=false, mpSyncInterval=null;
window._bwMultiplayerIntervals=[];
let mpPlayers={}, mpMeshes={};
let shakeIntensity=0, activeMenu=null;
let thirdPerson=false, playerMesh3p=null;
let breaks=0, lastPlaceTime=0, gameTime=0;
const TEAM_BED_STATUS={Red:true,Blue:true,Green:true,Yellow:true};
let skinUrl=null;
let floatingTexts=[], particles=[], drops=[], enemies=[], npcs=[];
let keys={}, controls={yaw:0,pitch:0};
let lastWTime=0; // for sprint double-tap

const player={
  name:'Player', team:'Blue',
  pos:new THREE.Vector3(0,66,42),
  vel:new THREE.Vector3(),
  hp:20, maxHp:20, hunger:20,
  inv:Array(9).fill(null).map(()=>({type:null,count:0})),
  selectedIdx:0, hasBed:true, isDead:false,
  isCrouching:false, isSprinting:false, mining:false, placing:false,
  bowCharge:false, bowChargeTime:0,
  respawnProtection:0, // Invulnerability after respawn
  spectatorMode:false, spectatorTime:0, // Spectator after death
  onGround:false, jumpWasUp:true,
  upgrades:{sharpness:0,protection:0,haste:0,healpool:false,trap:false}
};

// Physics constants — Minecraft tuned
const GRAVITY=-30;   // blocks/s²  (gives ~1.25 block jump with JUMP_VEL)
const JUMP_VEL=8.8;  // blocks/s
const WALK=4.4, SPRINT=5.8, CROUCH=1.8;

// Spatial hash
 const CELL=1;
 let blockMap=new Map();
 function blockKey(x,y,z){return Math.round(x)+','+Math.round(y)+','+Math.round(z);}
 function regBlock(b){const k=blockKey(b.position.x,b.position.y,b.position.z);if(!blockMap.has(k))blockMap.set(k,[]);blockMap.get(k).push(b);}
 function unregBlock(b){const k=blockKey(b.position.x,b.position.y,b.position.z);const a=blockMap.get(k);if(a){const i=a.indexOf(b);if(i!==-1)a.splice(i,1);}}
 function nearBlocks(x,y,z){const r=[];const rx=Math.round(x),ry=Math.round(y),rz=Math.round(z);for(let cx=-2;cx<=2;cx++)for(let cy=-3;cy<=2;cy++)for(let cz=-2;cz<=2;cz++){const a=blockMap.get((rx+cx)+','+(ry+cy)+','+(rz+cz));if(a)r.push(...a);}return r;}
 function allBlocks(){const a=[];blockMap.forEach(v=>a.push(...v));return a;}

// Block geo/mat cache
const _geo=new THREE.BoxGeometry(1,1,1);
const _mats={};
function getBlockMat(type){
  if(_mats[type])return _mats[type];
  // 特殊マッピング
  const texKey=type==='grass'?'grassTop':
               type==='log'?'log':
               type==='cobblestone'?'cobblestone':
               type==='leaves'?'leaves':type;
  const t=TEX[texKey]||TEX.stone;
  const m=new THREE.MeshLambertMaterial({
    map:t,
    transparent:type==='leaves',
    alphaTest:type==='leaves'?0.3:0
  });
  _mats[type]=m;return m;
}
function addBlock(x,y,z,type,isPlaced=true){
  const b=new THREE.Mesh(_geo,getBlockMat(type));
  b.position.set(Math.round(x),Math.round(y),Math.round(z));
  b.castShadow=true; b.receiveShadow=true; // v26追記: 本家Minecraft寄りにブロックへ影の投影/受影を有効化
  const HARD={
    end:8, stone:5, cobblestone:4, log:3, logTop:3,
    wood:3, leaves:0.3, grass:0.6, dirt:0.6,
    wool_red:1.5,wool_blue:1.5,wool_green:1.5,wool_yellow:1.5
  };
  const hard=HARD[type]||0.6;
  b.userData={type,isPlaced,hardness:hard};
  scene.add(b);regBlock(b);return b;
}
function removeBlock(b,syncToServer=true){
  const pos=b.position.clone();
  scene.remove(b);unregBlock(b);
  // マルチプレイヤー時はSupabaseにも破壊を通知（これがないと再出現するバグの原因だった）
  if(syncToServer&&gameMode==='multi'){
    const bx=Math.round(pos.x),by=Math.round(pos.y),bz=Math.round(pos.z);
    sbRequest({action:'destroyBlock',uid:myPeerId,x:bx,y:by,z:bz});
    if(window._blockSyncSeenKeys) window._blockSyncSeenKeys.delete(blockKey(bx,by,bz));
  }
}

// ================================================================
//  WORLD CREATION
// ================================================================
// ================================================================
//  WORLD GENERATION v10 — 本家BedWars風マップ生成
//  画像参考: 段々島・木・ベッド・石畳の小道・ショップ等
// ================================================================

function _seededRandom(seed){
  let t=(Number(seed)||1)>>>0;
  return function(){
    t+=0x6D2B79F5;
    let x=t;
    x=Math.imul(x^(x>>>15),x|1);
    x^=x+Math.imul(x^(x>>>7),x|61);
    return ((x^(x>>>14))>>>0)/4294967296;
  };
}

function _withMapSeed(seed,fn){
  if(!seed) return fn();
  const original=Math.random;
  Math.random=_seededRandom(seed);
  try{return fn();}finally{Math.random=original;}
}

function _buildBiomeComplexity(){
  // 既存の島生成を壊さず、中央〜中間帯にテーマ固有の地形を追加。
  const t=currentMapTheme;
  const add=(x,y,z,type)=>{ if(!blockMap.has(blockKey(x,y,z))) addBlock(x,y,z,type,false); };
  if(t==='grassland'){
    [[-14,61,-8],[14,61,8],[-8,61,14],[8,61,-14]].forEach(([x,y,z],i)=>{
      const h=2+(i%2); for(let k=0;k<h;k++) add(x, y+k, z, k===h-1?'leaves':'log');
    });
    for(let x=-18;x<=18;x+=3){ const z=11+Math.round(Math.sin(x*0.45)*2); add(x,60,z,'grass'); }
  } else if(t==='desert'){
    for(let i=0;i<5;i++){ const x=-18+i*9,z=Math.round(Math.sin(i*2.1)*8); for(let h=0;h<3+(i%3);h++) add(x,z*0+61+h,z,'sand'); }
    for(let i=0;i<3;i++){ const x=-12+i*12; for(let h=0;h<2+i;h++) add(x,61+h,10-i*7,'sandstone'); }
  } else if(t==='snow'){
    [[-16,10],[16,10],[-10,-14],[10,-14]].forEach(([x,z],i)=>{ for(let h=0;h<4+i%2;h++) add(x,61+h,z,'packed_ice'); });
    for(let i=-16;i<=16;i+=4) add(i,61,6+Math.round(Math.cos(i)*2),'snow');
  } else if(t==='nether'){
    [[-16,8],[16,-8],[-8,-16],[8,16]].forEach(([x,z],i)=>{ const h=3+(i%3); for(let k=0;k<h;k++) add(x,61+k,z,k===h-1?'nether_brick':'netherrack'); });
    for(let i=0;i<7;i++){ const x=-18+i*6; const z=Math.round(Math.sin(i*1.7)*10); add(x,61,z,'soul_sand'); }
  } else if(t==='end'){
    [[-15,-10],[15,10],[-10,15],[10,-15]].forEach(([x,z],i)=>{ for(let k=0;k<4+i%2;k++) add(x,61+k,z,'end'); });
    for(let i=0;i<9;i++){ const x=-18+i*4; const z=Math.round(Math.cos(i*1.3)*12); add(x,61,z,'end'); }
  } else if(t==='mushroom'){
    [[-15,-10],[15,10],[-10,15],[10,-15]].forEach(([x,z],i)=>{ add(x,61,z,'log'); add(x,62,z,'log'); for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++) add(x+dx,63,z+dz,'leaves'); });
  } else if(t==='mesa'){
    [[-15,-9],[15,9],[-9,15],[9,-15]].forEach(([x,z],i)=>{ const h=3+(i%3); for(let k=0;k<h;k++) add(x,61+k,z,k%2?'red_sand':'terracotta'); });
    for(let i=-18;i<=18;i+=3){ const z=-5+Math.round(Math.sin(i*.35)*3); add(i,61,z,'terracotta'); }
  }
}

function createWorld(){
  if(gameMode==='training_bridge' || gameMode==='training_parkour'){ createTrainingWorld(gameMode==='training_bridge'?'bridge':'parkour'); return; }
  const teams=teamMode===2?['Red','Blue']:['Red','Blue','Green','Yellow'];

  // チームベース島を生成
  teams.forEach(t=>{
    const p=TEAM_ISLAND_POS[t];
    buildBaseIsland(p.x,p.y,p.z,t);
  });

  // ダイヤモンド島 (2チーム:左右2個, 4チーム:4個)
  if(teamMode===2){
    buildResourceIsland(0,60,-30,'dia');
    buildResourceIsland(0,60, 30,'dia');
  }else{
    buildResourceIsland(-30,60,0,'dia');
    buildResourceIsland( 30,60,0,'dia');
    buildResourceIsland(0,60,-30,'dia');
    buildResourceIsland(0,60, 30,'dia');
  }

  // 中央島（エメラルド・大型）
  buildMiddleIsland(0,60,0);

  _buildBiomeComplexity();

  // スポーン位置設定
  const sp=TEAM_SPAWN[player.team];
  player.pos.set(sp.x,sp.y+0.1,sp.z);
  player.vel.set(0,0,0);
}

// ================================================================
//  ベース島 — 段々地形・木・ショップ・ベッド・石畳
// ================================================================
// ================================================================
//  テーマ別装飾建造物（地形をより豪華に）
// ================================================================
function buildThemeDecoration(ox,oy,oz,theme){
  if(theme==='grassland'){
    // 村の家（木材+石畳の小屋）
    const hx=ox+7,hz=oz-4;
    for(let x=0;x<4;x++)for(let z=0;z<3;z++){
      addBlock(hx+x,oy+1,hz+z,'cobblestone',false); // 床
    }
    for(let h=1;h<=3;h++){
      addBlock(hx,oy+1+h,hz,'wood',false);addBlock(hx+3,oy+1+h,hz,'wood',false);
      addBlock(hx,oy+1+h,hz+2,'wood',false);addBlock(hx+3,oy+1+h,hz+2,'wood',false);
    }
    // 壁
    for(let x=1;x<3;x++){addBlock(hx+x,oy+2,hz,'wood',false);addBlock(hx+x,oy+3,hz,'wood',false);}
    for(let x=1;x<3;x++){addBlock(hx+x,oy+2,hz+2,'wood',false);addBlock(hx+x,oy+3,hz+2,'wood',false);}
    // 屋根（log）
    for(let x=-1;x<=4;x++)for(let z=-1;z<=3;z++) addBlock(hx+x,oy+5,hz+z,'log',false);

    // 川（曲がりくねった水流、島の一辺を横断）
    const riverPath=[[-8,0],[-7,1],[-6,1],[-5,2],[-4,2],[-3,1],[-2,1],[-1,0]];
    riverPath.forEach(([dx,dz])=>{
      addBlock(ox+dx,oy,oz+7+dz,'packed_ice',false); // 水面代替(見た目の青)
    });
    // 滝（島の縁から下へ流れ落ちる）
    for(let y=0;y<5;y++) addBlock(ox-8,oy-y,oz+7,'packed_ice',false);

    // 花畑（既存の装飾維持）
    for(let i=0;i<6;i++){
      const fx=ox+Math.floor((Math.random()-0.5)*10);
      const fz=oz+Math.floor((Math.random()-0.5)*10);
      if(Math.abs(fx-ox)>1||Math.abs(fz-oz)>1) addBlock(fx,oy+2,fz,'leaves',false);
    }

  } else if(theme==='desert'){
    // ミニピラミッド
    const px=ox+6,pz=oz-4;
    for(let r=3;r>=0;r--){
      for(let x=-r;x<=r;x++)for(let z=-r;z<=r;z++){
        addBlock(px+x,oy+1+(3-r),pz+z,'sandstone',false);
      }
    }
    // サボテン群生
    [[8,3],[-8,-2],[7,6],[-6,5],[9,-5]].forEach(([dx,dz])=>{
      buildTree(ox+dx,oy+1,oz+dz);
    });

  } else if(theme==='snow'){
    // 樹氷とトウヒの混合林
    const savedTheme=currentMapTheme;
    [[5,-6,'pine'],[-6,-5,'ice_spike'],[7,4,'pine'],[-7,3,'ice_spike']].forEach(([dx,dz,tt])=>{
      const origTree=MAP_THEMES[currentMapTheme].treeType;
      MAP_THEMES[currentMapTheme].treeType=tt;
      buildTree(ox+dx,oy+1,oz+dz);
      MAP_THEMES[currentMapTheme].treeType=origTree;
    });
    // 氷の小池
    for(let x=-2;x<=2;x++)for(let z=-2;z<=2;z++){
      if(x*x+z*z<=4) addBlock(ox-6,oy+1+x,oz+5+z,'packed_ice',false);
    }

  } else if(theme==='nether'){
    // ネザー要塞（レンガの回廊）
    const fx=ox-6,fz=oz-5;
    for(let i=0;i<4;i++){
      for(let h=0;h<4;h++) addBlock(fx+i,oy+1+h,fz,'nether_brick',false);
    }
    for(let h=0;h<4;h++){addBlock(fx,oy+1+h,fz+1,'nether_brick',false);addBlock(fx+3,oy+1+h,fz+1,'nether_brick',false);}
    for(let i=0;i<4;i++) addBlock(fx+i,oy+5,fz,'nether_brick',false); // 天井アーチ

    // ソウルサンドの小島（自陣の隅）
    const ssx=ox+7,ssz=oz+6;
    for(let x=-1;x<=1;x++)for(let z=-1;z<=1;z++) addBlock(ssx+x,oy+1,ssz+z,'soul_sand',false);

    // 溶岩の滝（島の縁）
    for(let y=0;y<6;y++) addBlock(ox+8,oy-y,oz-2,'netherrack',false);

  } else if(theme==='end'){
    // エンドシティ風の塔（紫陶製っぽくend石を積層＋縮小）
    const cx=ox+6,cz=oz-4;
    for(let floor=0;floor<3;floor++){
      const r=3-floor;
      for(let x=-r;x<=r;x++)for(let z=-r;z<=r;z++){
        if(Math.abs(x)===r||Math.abs(z)===r) addBlock(cx+x,oy+1+floor*3,cz+z,'end',false);
      }
      for(let h=1;h<3;h++)for(let x=-r;x<=r;x++)for(let z=-r;z<=r;z++){
        if(Math.abs(x)===r||Math.abs(z)===r) addBlock(cx+x,oy+1+floor*3+h,cz+z,'end',false);
      }
    }
    // 尖塔
    addBlock(cx,oy+11,cz,'end',false);addBlock(cx,oy+12,cz,'end',false);

  } else if(theme==='mushroom'){
    // 茶・赤きのこの混合群生
    const spots=[[6,-3,'mushroom_brown'],[-5,4,'mushroom_red'],[4,5,'mushroom_brown'],[-6,-4,'mushroom_red']];
    spots.forEach(([dx,dz,tt])=>{
      const origTree=MAP_THEMES[currentMapTheme].treeType;
      MAP_THEMES[currentMapTheme].treeType=tt;
      buildTree(ox+dx,oy+1,oz+dz);
      MAP_THEMES[currentMapTheme].treeType=origTree;
    });

  } else if(theme==='mesa'){
    // 廃坑風のトンネル入口＋支柱
    const mx=ox-6,mz=oz+5;
    for(let i=0;i<3;i++){
      addBlock(mx,oy+1+i,mz,'log',false);addBlock(mx+3,oy+1+i,mz,'log',false);
    }
    addBlock(mx+1,oy+3,mz,'log',false);addBlock(mx+2,oy+3,mz,'log',false);
    // Valley（谷: 中央を掘り下げる）
    for(let x=-2;x<=2;x++)for(let z=-2;z<=2;z++){
      const key=blockKey(ox+3+x,oy+1,oz+2+z);
      if(x*x+z*z<=4&&blockMap.has(key)){
        blockMap.get(key).slice().forEach(b=>{scene.remove(b);unregBlock(b);});
      }
    }
    // 川（メサの谷底を流れる）
    for(let i=-2;i<=2;i++) addBlock(ox+3+i,oy,oz+2,'packed_ice',false);
    // サボテン点在
    [[7,3],[-7,-3]].forEach(([dx,dz])=>{
      const origTheme=MAP_THEMES.mesa.treeType;
      MAP_THEMES.mesa.treeType='cactus';
      buildTree(ox+dx,oy+1,oz+dz);
      MAP_THEMES.mesa.treeType=origTheme;
    });
  }
}

function createTrainingWorld(type){
  // 練習場は完全ローカル。Supabaseの対戦状態には書き込まない。
  const baseY=60;
  for(let x=-12;x<=12;x++) for(let z=-6;z<=6;z++) addBlock(x,baseY,z,'stone',false);
  if(type==='bridge'){
    for(let lane=0;lane<3;lane++){
      const z=-5+lane*5;
      for(let x=-10;x<=22;x++) addBlock(x,baseY+1,z,'wool_blue',false);
      for(let x=-4;x<=22;x+=6) for(let zz=z-1;zz<=z+1;zz++) { const key=blockKey(x,baseY+1,zz); const arr=blockMap.get(key); if(arr) arr.slice().forEach(b=>{scene.remove(b);unregBlock(b);}); }
    }
    for(let x=-10;x<=22;x++) addBlock(x,baseY+1,0,'stone',false);
    player.pos.set(-8,baseY+1.1,0);
  } else {
    const pads=[[-8,baseY+1,0],[-4,baseY+2,2],[0,baseY+3,-1],[4,baseY+4,2],[8,baseY+5,0],[12,baseY+6,-2],[16,baseY+7,1]];
    pads.forEach(([x,y,z],i)=>{ for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++) addBlock(x+dx,y,z+dz,i%2?'wool_green':'stone',false); });
    player.pos.set(-10,baseY+2,0);
  }
  player.vel.set(0,0,0);
  const title=type==='bridge'?'🧱 ブリッジ練習':'🏃 パルクール練習';
  let el=document.getElementById('training-hud');
  if(!el){ el=document.createElement('div'); el.id='training-hud'; el.style.cssText='position:fixed;top:18px;left:50%;transform:translateX(-50%);z-index:1000;background:rgba(0,0,0,.78);padding:8px 14px;border:2px solid #888;color:#fff;font-family:monospace;text-align:center'; document.body.appendChild(el); }
  el.innerHTML=`<b>${title}</b><br><small>対戦通信なし・練習専用</small><br><button class="mc-btn btn-red" onclick="exitTraining()">練習場を終了</button>`;
}
function exitTraining(){
  stopSupabaseRealtime();
  if(mpSyncInterval){clearInterval(mpSyncInterval);mpSyncInterval=null;}
  const el=document.getElementById('training-hud'); if(el) el.remove();
  if(renderer&&renderer.domElement) renderer.domElement.remove();
  scene=null; camera=null; renderer=null; window.scene=null; window.camera=null; window.renderer=null; gameMode=null;
  document.getElementById('lobby').style.display='flex';
  document.exitPointerLock?.();
}

function buildBaseIsland(ox,oy,oz,teamName){
  const theme=MAP_THEMES[currentMapTheme]||MAP_THEMES.grassland;
  const top=theme.baseTop, fill=theme.baseFill, deep=theme.baseDeep;

  // テーマ別の島形状（見た目が大きく異なる）
  if(currentMapTheme==='mesa'){
    // メサ: 本家準拠の帯状層(terracotta/red_sand交互)＋より高い岩柱
    const LAYERS=[
      {r:9,dy:0, t:top},
      {r:9,dy:-1,t:'red_sand'},
      {r:8,dy:-2,t:'terracotta'},
      {r:8,dy:-3,t:'red_sand'},
      {r:7,dy:-4,t:'terracotta'},
      {r:6,dy:-5,t:'terracotta'},
      {r:5,dy:-6,t:'red_sand'},
      {r:4,dy:-7,t:'terracotta'},
      {r:2,dy:-8,t:'terracotta'}
    ];
    LAYERS.forEach(({r,dy,t})=>{
      for(let x=-Math.ceil(r);x<=Math.ceil(r);x++)for(let z=-Math.ceil(r);z<=Math.ceil(r);z++){
        if(x*x+z*z<=r*r) addBlock(ox+x,oy+dy,oz+z,t,false);
      }
    });
    // 高くそびえる岩柱を島の四隅に（本家のビュート地形風、帯状に色分け）
    [[6,6],[-6,6],[6,-6],[-6,-6]].forEach(([dx,dz])=>{
      const ph=6+Math.floor(Math.random()*3);
      for(let h=0;h<ph;h++){
        addBlock(ox+dx,oy+1+h,oz+dz,h%2===0?'terracotta':'red_sand',false);
      }
    });
  } else if(currentMapTheme==='mushroom'){
    // きのこ島: 丸みを帯びた低め・凹凸のある地形
    const LAYERS=[{r:8,dy:0,t:top},{r:7,dy:-1,t:fill},{r:6,dy:-2,t:'stone'},{r:4,dy:-3,t:'stone'}];
    LAYERS.forEach(({r,dy,t})=>{
      for(let x=-Math.ceil(r);x<=Math.ceil(r);x++)for(let z=-Math.ceil(r);z<=Math.ceil(r);z++){
        const noise=Math.sin(x*1.3)*Math.cos(z*1.1)*0.6;
        if(x*x+z*z<=(r+noise)*(r+noise)) addBlock(ox+x,oy+dy,oz+z,t,false);
      }
    });
  } else if(currentMapTheme==='nether'){
    // ネザー: 浮遊する岩の塊・不規則形状
    const LAYERS=[{r:8,dy:0,t:top},{r:6,dy:-1,t:fill},{r:7,dy:-2,t:fill},{r:4,dy:-3,t:deep},{r:5,dy:-4,t:deep}];
    LAYERS.forEach(({r,dy,t})=>{
      for(let x=-Math.ceil(r);x<=Math.ceil(r);x++)for(let z=-Math.ceil(r);z<=Math.ceil(r);z++){
        if(x*x+z*z<=r*r&&Math.random()>0.05) addBlock(ox+x,oy+dy,oz+z,t,false);
      }
    });
  } else if(currentMapTheme==='snow'){
    // 雪原: なだらかな丘状
    const LAYERS=[{r:8,dy:0,t:top},{r:8,dy:-1,t:top},{r:7,dy:-2,t:fill},{r:6,dy:-3,t:deep},{r:4,dy:-4,t:deep},{r:2,dy:-5,t:deep}];
    LAYERS.forEach(({r,dy,t})=>{
      for(let x=-Math.ceil(r);x<=Math.ceil(r);x++)for(let z=-Math.ceil(r);z<=Math.ceil(r);z++){
        if(x*x+z*z<=r*r) addBlock(ox+x,oy+dy,oz+z,t,false);
      }
    });
  } else if(currentMapTheme==='desert'){
    // 砂漠: ピラミッド型の砂丘
    const LAYERS=[{r:9,dy:0,t:top},{r:8,dy:-1,t:fill},{r:6,dy:-2,t:deep},{r:4,dy:-3,t:deep},{r:2,dy:-4,t:deep}];
    LAYERS.forEach(({r,dy,t})=>{
      for(let x=-Math.ceil(r);x<=Math.ceil(r);x++)for(let z=-Math.ceil(r);z<=Math.ceil(r);z++){
        if(x*x+z*z<=r*r) addBlock(ox+x,oy+dy,oz+z,t,false);
      }
    });
  } else if(currentMapTheme==='end'){
    // エンド: 尖った不規則な塊
    const LAYERS=[{r:8,dy:0,t:top},{r:5,dy:-1,t:fill},{r:6,dy:-2,t:fill},{r:3,dy:-3,t:deep}];
    LAYERS.forEach(({r,dy,t})=>{
      for(let x=-Math.ceil(r);x<=Math.ceil(r);x++)for(let z=-Math.ceil(r);z<=Math.ceil(r);z++){
        const jitter=(Math.sin(x*2.1+z*1.7)*0.5);
        if(x*x+z*z<=(r+jitter)*(r+jitter)) addBlock(ox+x,oy+dy,oz+z,t,false);
      }
    });
  } else {
    // grassland（標準・段々島）
    const LAYERS=[{r:8,dy:0,t:top},{r:7,dy:-1,t:fill},{r:6,dy:-2,t:fill},
      {r:5,dy:-3,t:deep},{r:3.5,dy:-4,t:deep},{r:2,dy:-5,t:deep}];
    LAYERS.forEach(({r,dy,t})=>{
      for(let x=-Math.ceil(r);x<=Math.ceil(r);x++)for(let z=-Math.ceil(r);z<=Math.ceil(r);z++){
        if(x*x+z*z<=r*r) addBlock(ox+x,oy+dy,oz+z,t,false);
      }
    });
  }

  // 石畳の小道（十字型・共通）
  const pathBlock = currentMapTheme==='nether'?'nether_brick':currentMapTheme==='mesa'?'terracotta':'cobblestone';
  for(let i=-5;i<=5;i++){
    if(i===0) continue;
    addBlock(ox+i,oy+1,oz,pathBlock,false);
    addBlock(ox,oy+1,oz+i,pathBlock,false);
  }
  addBlock(ox,oy+1,oz,pathBlock,false);

  // テーマ別の装飾要素（豪華さを追加）
  buildThemeDecoration(ox,oy,oz,currentMapTheme);

  // テーマ別の装飾木（十字の小道を避けた斜め位置に配置）
  buildTree(ox-6,oy+1,oz-5);

  // ベッド設置前に周辺の空間を確保（埋もれ防止）
  for(let dx=-1;dx<=1;dx++)for(let dy=0;dy<=3;dy++)for(let dz=-2;dz<=2;dz++){
    const key=blockKey(ox+dx,oy+1+dy,oz+3+dz);
    if(blockMap.has(key)){
      const arr=blockMap.get(key);
      arr.slice().forEach(b=>{ if(!b.userData?.isBed){ scene.remove(b); unregBlock(b); } });
    }
  }

  // ベッド（島の前）
  createBed(ox,oy+1,oz+3,teamName);

  // NPC
  spawnNPC(ox-4,oy+1,oz-1,'Shop');
  spawnNPC(ox+4,oy+1,oz-1,'Upgrade');

  // 鉄・金スポナー
  spawnSpawner(ox,oy+1,oz,'iron_gold');

  // チームラベル
  addLabel(`[${teamName}] Base`,ox,oy+6,oz,TEAM_COLOR_HEX[teamName]||'#fff');

  if(gameMode==='solo'&&teamName!==player.team){
    spawnAI(ox,oy+2,oz,teamName);
  }
}

// ================================================================
//  木の生成（テーマ別: oak/pine/cactus/mushroom_giant/dead/chorus）
// ================================================================
function buildTree(ox,oy,oz){
  const theme=MAP_THEMES[currentMapTheme]||MAP_THEMES.grassland;
  const treeType=theme.treeType||'oak';

  if(treeType==='cactus'){
    // サボテン（砂漠）
    const h=3+Math.floor(Math.random()*2);
    for(let y=0;y<h;y++) addBlock(ox,oy+y,oz,'sandstone',false);
    return;
  }
  if(treeType==='dead'){
    // 枯れ木（メサ）: 葉なし、幹だけ曲がって伸びる
    let cx=ox,cz=oz;
    for(let y=0;y<5;y++){
      addBlock(cx,oy+y,cz,'log',false);
      if(y>2&&Math.random()>0.5) cx+=(Math.random()>0.5?1:-1);
    }
    return;
  }
  if(treeType==='mushroom_giant'){
    // 巨大きのこ（きのこ島）: 太い幹＋大きな傘
    for(let y=0;y<7;y++) addBlock(ox,oy+y,oz,'log',false);
    const capR=3;
    for(let x=-capR;x<=capR;x++)for(let z=-capR;z<=capR;z++){
      if(x*x+z*z<=capR*capR) addBlock(ox+x,oy+7,oz+z,'leaves',false);
    }
    return;
  }
  if(treeType==='chorus'){
    // コーラス植物（エンド）: 不規則な積み上げ
    let cx=ox,cy=oy,cz=oz;
    for(let i=0;i<6;i++){
      addBlock(cx,cy,cz,'chorus',false);
      cy++;
      if(Math.random()>0.6)cx+=(Math.random()>0.5?1:-1);
      if(Math.random()>0.6)cz+=(Math.random()>0.5?1:-1);
    }
    return;
  }
  if(treeType==='pine'){
    // トウヒの木（雪原）: 円錐形の松
    const H=7;
    for(let y=0;y<H;y++) addBlock(ox,oy+y,oz,'log',false);
    for(let y=2;y<H;y++){
      const r=Math.max(1,3-Math.floor((y-2)/2));
      for(let x=-r;x<=r;x++)for(let z=-r;z<=r;z++){
        if(x*x+z*z<=r*r&&!(x===0&&z===0)) addBlock(ox+x,oy+y,oz+z,'leaves',false);
      }
    }
    return;
  }
  if(treeType==='ice_spike'){
    // 樹氷（本家準拠：最大16ブロックの尖塔、細く鋭い形状）
    const H=10+Math.floor(Math.random()*7);
    for(let y=0;y<H;y++){
      const r=Math.max(0,Math.floor((H-y)/2.2));
      for(let x=-r;x<=r;x++)for(let z=-r;z<=r;z++){
        if(x*x+z*z<=r*r) addBlock(ox+x,oy+y,oz+z,'packed_ice',false);
      }
    }
    return;
  }
  if(treeType==='mushroom_brown'){
    // 茶色の巨大きのこ（本家準拠：太い幹＋大きな平たい傘、半径5）
    const H=8;
    for(let y=0;y<H;y++){
      addBlock(ox,oy+y,oz,'log',false);
      addBlock(ox+1,oy+y,oz,'log',false); // 幹を太く
    }
    const capR=5;
    for(let x=-capR;x<=capR;x++)for(let z=-capR;z<=capR;z++){
      if(x*x+z*z<=capR*capR) addBlock(ox+x,oy+H,oz+z,'mycelium',false);
    }
    return;
  }
  if(treeType==='mushroom_red'){
    // 赤色の巨大きのこ（本家準拠：太い幹＋大きな丸ドーム傘、半径5）
    const H=9;
    for(let y=0;y<H;y++){
      addBlock(ox,oy+y,oz,'log',false);
      addBlock(ox+1,oy+y,oz,'log',false);
    }
    const capR=5;
    for(let dy=0;dy<=3;dy++){
      const r=capR-dy;
      for(let x=-r;x<=r;x++)for(let z=-r;z<=r;z++){
        if(x*x+z*z<=r*r) addBlock(ox+x,oy+H+dy,oz+z,'wool_red',false);
      }
    }
    return;
  }

  // oak（デフォルト・草原/ネザー代替）
  const TRUNK_H=6;
  for(let y=0;y<TRUNK_H;y++) addBlock(ox,oy+y,oz,'log',false);
  const LR=3, ly=oy+TRUNK_H;
  for(let x=-LR;x<=LR;x++)for(let y=-2;y<=2;y++)for(let z=-LR;z<=LR;z++){
    const d2=x*x+y*y*2+z*z;
    if(d2<=LR*LR+1&&!(x===0&&z===0&&y<0)) addBlock(ox+x,ly+y,oz+z,'leaves',false);
  }
}

// ================================================================
//  ダイヤモンド島 — 小型・石畳中心・スポナー
// ================================================================
function buildResourceIsland(ox,oy,oz,type){
  const r=4;
  // 丸い島
  for(let dy=0;dy>=-3;dy--){
    const cr=r+dy*0.7;
    for(let x=-Math.ceil(cr);x<=Math.ceil(cr);x++){
      for(let z=-Math.ceil(cr);z<=Math.ceil(cr);z++){
        if(x*x+z*z<=cr*cr){
          const bt=dy===0?'grass':dy===-1?'dirt':'stone';
          addBlock(ox+x,oy+dy,oz+z,bt,false);
        }
      }
    }
  }
  // 中央に石畳1枚
  addBlock(ox,oy+1,oz,'cobblestone',false);

  // スポナー
  spawnSpawner(ox,oy+1,oz,type);
  addLabel('💎 Diamond',ox,oy+4,oz,'#55ffff');
}

// ================================================================
//  中央島 — 大型・エンドストーン・4本木・エメラルドスポナー
// ================================================================
function buildMiddleIsland(ox,oy,oz){
  const theme=currentMapTheme;

  if(theme==='nether'){
    // ネザー: デルタ地帯風（不規則な溶岩流と岩棚）
    const r=12;
    for(let dy=0;dy>=-5;dy--){
      const cr=r+dy*0.9;
      for(let x=-Math.ceil(cr);x<=Math.ceil(cr);x++)for(let z=-Math.ceil(cr);z<=Math.ceil(cr);z++){
        if(x*x+z*z<=cr*cr&&Math.random()>0.04) addBlock(ox+x,oy+dy,oz+z,dy===0?'netherrack':'netherrack',false);
      }
    }
    // 溶岩流の筋（放射状）
    for(let a=0;a<6;a++){
      const ang=a*Math.PI/3;
      for(let d=2;d<10;d++){
        const lx=Math.round(Math.cos(ang)*d),lz=Math.round(Math.sin(ang)*d);
        addBlock(ox+lx,oy+1,oz+lz,'soul_sand',false);
      }
    }
    spawnSpawner(ox,oy+1,oz,'emerald');
    addLabel('💚 Emerald & 💎 Diamond (Delta)',ox,oy+5,oz,'#55ff55');
    spawnSpawner(ox-7,oy+1,oz,'dia');addLabel('💎 Diamond',ox-7,oy+3,oz,'#55ffff');
    spawnSpawner(ox+7,oy+1,oz,'dia');addLabel('💎 Diamond',ox+7,oy+3,oz,'#55ffff');
    return;
  }

  if(theme==='end'){
    // エンド: 本島再現（中央の岩盤祭壇＋黒曜石の柱＋エンドクリスタル）
    const r=13;
    for(let dy=0;dy>=-4;dy--){
      const cr=r+dy*0.9;
      for(let x=-Math.ceil(cr);x<=Math.ceil(cr);x++)for(let z=-Math.ceil(cr);z<=Math.ceil(cr);z++){
        if(x*x+z*z<=cr*cr) addBlock(ox+x,oy+dy,oz+z,'end',false);
      }
    }
    // 中央の祭壇（岩盤風=stone、階段状）
    for(let r2=3;r2>=0;r2--){
      for(let x=-r2;x<=r2;x++)for(let z=-r2;z<=r2;z++){
        if(Math.abs(x)===r2||Math.abs(z)===r2) addBlock(ox+x,oy+1+(3-r2),oz+z,'stone',false);
      }
    }
    // 黒曜石の柱を環状に配置（本家エンド次元を再現：高さ大幅増加＋檻状装飾）
    const pillarR=10, pillarCount=10;
    for(let i=0;i<pillarCount;i++){
      const ang=i*(Math.PI*2/pillarCount);
      const px=Math.round(Math.cos(ang)*pillarR), pz=Math.round(Math.sin(ang)*pillarR);
      const ph=10+Math.floor(Math.random()*8); // 本家準拠: 大幅に高い柱(10〜17ブロック)
      // 柱の太さも1本→2x2の太い柱に（本家の見た目に近づける）
      for(let h=0;h<ph;h++){
        addBlock(ox+px,oy+1+h,oz+pz,'end',false);
        addBlock(ox+px+1,oy+1+h,oz+pz,'end',false);
      }
      // 頂上のエンドクリスタル（発光ブロック＋周囲に檻状の飾り）
      addBlock(ox+px,oy+1+ph,oz+pz,'emerald',false);
      addBlock(ox+px+1,oy+1+ph,oz+pz,'emerald',false);
      // 檻(cage)風の縁取り
      [[0,1],[1,1],[0,-1],[1,-1]].forEach(([cx,cz])=>{
        addBlock(ox+px+cx,oy+ph,oz+pz+cz,'end',false);
      });
      addLabel('✨',ox+px,oy+3+ph,oz+pz,'#ff88ff');
    }
    spawnSpawner(ox,oy+4,oz,'emerald');
    addLabel('💚 Emerald Altar & 💎 Diamond',ox,oy+8,oz,'#55ff55');
    spawnSpawner(ox-7,oy+1,oz,'dia');addLabel('💎 Diamond',ox-7,oy+3,oz,'#55ffff');
    spawnSpawner(ox+7,oy+1,oz,'dia');addLabel('💎 Diamond',ox+7,oy+3,oz,'#55ffff');
    return;
  }

  // その他テーマ: 標準の大型島（外観のみテーマブロックに変更）
  const theme_=MAP_THEMES[theme]||MAP_THEMES.grassland;
  const r=12;
  for(let dy=0;dy>=-5;dy--){
    const cr=r+dy*0.9;
    for(let x=-Math.ceil(cr);x<=Math.ceil(cr);x++){
      for(let z=-Math.ceil(cr);z<=Math.ceil(cr);z++){
        if(x*x+z*z<=cr*cr){
          const bt=dy===0?(theme_.midTop||'end'):(theme_.midFill||'stone');
          addBlock(ox+x,oy+dy,oz+z,bt,false);
        }
      }
    }
  }

  // 石畳の十字
  const pathBlock = theme==='mesa'?'terracotta':'cobblestone';
  for(let i=-8;i<=8;i++){
    addBlock(ox+i,oy+1,oz,pathBlock,false);
    addBlock(ox,oy+1,oz+i,pathBlock,false);
  }

  // 4隅に木
  [[-6,6],[6,6],[-6,-6],[6,-6]].forEach(([dx,dz])=>{
    buildTree(ox+dx,oy+1,oz+dz);
  });

  // 中央エメラルドスポナー
  spawnSpawner(ox,oy+1,oz,'emerald');
  addLabel('💚 Emerald & 💎 Diamond',ox,oy+5,oz,'#55ff55');

  // ミニダイヤスポナー（東西）
  spawnSpawner(ox-7,oy+1,oz,'dia');
  addLabel('💎 Diamond',ox-7,oy+3,oz,'#55ffff');
  spawnSpawner(ox+7,oy+1,oz,'dia');
  addLabel('💎 Diamond',ox+7,oy+3,oz,'#55ffff');
}


// ================================================================
//  BED
// ================================================================
function createBed(x,y,z,team){
  const g=new THREE.Group();
  const frame=new THREE.Mesh(new THREE.BoxGeometry(1,.4,2.2),new THREE.MeshLambertMaterial({color:0x6d4c41}));
  const head=new THREE.Mesh(new THREE.BoxGeometry(1,.6,.4),new THREE.MeshLambertMaterial({color:0xd4a06a}));
  head.position.set(0,.2,-.9);
  const mat=new THREE.Mesh(new THREE.BoxGeometry(.9,.2,1.6),new THREE.MeshLambertMaterial({color:TEAM_COLOR[team]||0xffffff}));
  mat.position.set(0,.25,.2);
  const pil=new THREE.Mesh(new THREE.BoxGeometry(.7,.15,.3),new THREE.MeshLambertMaterial({color:0xeeeeee}));
  pil.position.set(0,.4,-.7);
  g.add(frame,head,mat,pil);
  g.position.set(x,y-.2,z);
  g.userData={isBed:true,hardness:5,team};
  scene.add(g);regBlock(g);
}

// ================================================================
//  NPC / SPAWNER / AI
// ================================================================
function spawnNPC(x,y,z,role){
  const g=new THREE.Group();
  const color=role==='Shop'?0x00cc44:0x00cccc;
  const bodyMat=new THREE.MeshLambertMaterial({color});
  const body=new THREE.Mesh(new THREE.BoxGeometry(.7,1.2,.4),bodyMat);body.position.y=.6;
  const head=new THREE.Mesh(new THREE.BoxGeometry(.6,.6,.6),new THREE.MeshLambertMaterial({color:0xffd5a0}));head.position.y=1.5;
  const hat=new THREE.Mesh(new THREE.BoxGeometry(.65,.25,.65),new THREE.MeshLambertMaterial({color:role==='Shop'?0x005500:0x005555}));hat.position.y=1.85;
  g.add(body,head,hat);
  g.position.set(x,y,z);
  g.userData={isNPC:true,role};
  scene.add(g);npcs.push(g);
  addLabel(role==='Shop'?'🛒 SHOP [E]':'⬆ UPGRADE [E]',x,y+2.4,z,role==='Shop'?'#55ff55':'#55ffff');
}

function spawnSpawner(x,y,z,type){
  const colMap={emerald:0x00ff88,dia:0x00cccc,iron_gold:0xcccccc};
  const m=new THREE.Mesh(new THREE.BoxGeometry(.8,.8,.8),new THREE.MeshLambertMaterial({color:colMap[type]||0xaaaaaa,emissive:colMap[type]||0x333333,emissiveIntensity:.4}));
  m.position.set(x,y,z);
  m.userData={isSpawner:true,type,lastSpawn:0};
  scene.add(m);npcs.push(m);
}

// 外部URLに依存せず、ローカル生成スキンをボットのデフォルトに使用
let _dreamSkinImage=null;
function _loadDreamSkin(cb){
  if(_dreamSkinImage){cb&&cb();return;}
  const fallback=_getFallbackSkinImage();
  const img=new Image();
  img.onload=()=>{ _dreamSkinImage=img; cb&&cb(); };
  img.onerror=()=>{ _dreamSkinImage=fallback; cb&&cb(); };
  img.src=fallback.toDataURL('image/png');
}

function spawnAI(x,y,z,teamName){
  const col=TEAM_COLOR[teamName]||0xff2222;
  // プレイヤーと同一のリグ(頭/胴/腕/脚)を使用。まずはフォールバック外見で即座に生成
  const g=createSimplePlayerMesh(col);
  g.position.set(x,y,z);
  // userDataを上書きせずマージ（createSimplePlayerMeshが設定したrArm/lArm等を保持）
  Object.assign(g.userData,{isEnemy:true,team:teamName,hp:20,maxHp:20,vel:new THREE.Vector3(),onGround:false,atkTimer:0,walkPhase:0,state:'idle'});
  scene.add(g); if(window._bwApplyMeshShadows) window._bwApplyMeshShadows(g); enemies.push(g);
  addLabel(`🤖 AI [${teamName}]`,x,y+2.4,z,TEAM_COLOR_HEX[teamName]||'#ff5555');

  // Dreamスキンを読込後、メッシュ全体を正しいUVで再構築して差し替え
  _loadDreamSkin(()=>{
    if(!_dreamSkinImage||!g.parent) return;
    const parent=g.parent;
    const pos=g.position.clone();
    const ud=g.userData;
    parent.remove(g);
    const newMesh=createSimplePlayerMesh(col, _dreamSkinImage);
    newMesh.position.copy(pos);
    Object.assign(newMesh.userData, ud); // hp等のゲーム状態を引き継ぐ
    parent.add(newMesh);
    // enemies配列内の参照も差し替え
    const idx=enemies.indexOf(g);
    if(idx!==-1) enemies[idx]=newMesh;
  });
}

// ================================================================
//  DROPS
// ================================================================
const _dropGeo=new THREE.BoxGeometry(.38,.38,.38);
const _dropMat={};
function getDropMat(type){
  if(_dropMat[type])return _dropMat[type];
  const col=type==='dia'?0x55ffff:(type==='emerald'?0x55ff55:(type==='gold'?0xffcc33:(type==='iron'?0xdddddd:0xaaaaaa)));
  return (_dropMat[type]=new THREE.MeshLambertMaterial({color:col,emissive:col,emissiveIntensity:.25}));
}
function spawnDrop(type,pos){
  const m=new THREE.Mesh(_dropGeo,getDropMat(type));
  m.position.copy(pos);
  m.userData={type,baseY:pos.y,t:Math.random()*Math.PI*2};
  scene.add(m);drops.push(m);
}

// ================================================================
//  LABELS
// ================================================================
function addLabel(text,x,y,z,color='#fff'){
  const el=document.createElement('div');
  el.textContent=text;
  Object.assign(el.style,{position:'absolute',color,textShadow:'2px 2px 0 #000',
    fontFamily:"'VT323',monospace",fontSize:'19px',pointerEvents:'none',
    transform:'translateX(-50%)',whiteSpace:'nowrap',zIndex:'90',display:'none'});
  document.body.appendChild(el);
  floatingTexts.push({el,pos:new THREE.Vector3(x,y,z)});
}

// ================================================================
//  SCENE INIT
// ================================================================
function initScene(){
  scene=new THREE.Scene();
  scene.background=new THREE.Color(0x87CEEB);
  scene.fog=new THREE.FogExp2(0x87CEEB,.008);

  camera=new THREE.PerspectiveCamera(75,innerWidth/innerHeight,.1,400);

  renderer=new THREE.WebGLRenderer({antialias:false});
  renderer.setSize(innerWidth,innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFShadowMap;
  document.body.appendChild(renderer.domElement);
  renderer.domElement.style.position='absolute';
  renderer.domElement.style.top='0';

  // v25追記: window.scene/camera/rendererを実体と同期する。
  // (以前はここで同期しておらず、reset時にwindow.*へnullを代入する処理だけが
  //  存在したため、v25シェーダースクリプトのensure()が常にfalseを返し、
  //  window._bwRenderがwindow.renderer(未定義)を参照して描画が失敗 = 画面が真っ暗になっていた)
  window.scene=scene;
  window.camera=camera;
  window.renderer=renderer;

  scene.add(new THREE.AmbientLight(0xffffff,.42));
  // v26追記: 半球ライト(空色/地面色)を追加。影MOD相当の質感にするため、
  // 影で暗くなる部分にも空色/草色の環境光がほんのり回り込むようにする。
  const hemi=new THREE.HemisphereLight(0xbfe0ff,0x5a7a3a,0.35);
  scene.add(hemi);
  const sun=new THREE.DirectionalLight(0xfff6da,.85);
  sun.position.set(50,120,30);scene.add(sun);

  // v26追記: 影(シャドウマップ)を実際に機能させるための設定。
  // 以前はrenderer.shadowMap.enabledをtrueにするだけで、太陽光側に
  // castShadowや投影範囲・解像度が一切設定されておらず、何も映らなかった。
  // 本家Minecraft寄りの「輪郭のはっきりした」見た目にするため、
  // PCFSoftShadowMapは使いつつradius/bias等はシャープめに調整する。
  sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);
  const SHADOW_RANGE=48; // プレイヤー周辺のみをカバー(広すぎるとボケて解像度不足になる)
  sun.shadow.camera.left=-SHADOW_RANGE;
  sun.shadow.camera.right=SHADOW_RANGE;
  sun.shadow.camera.top=SHADOW_RANGE;
  sun.shadow.camera.bottom=-SHADOW_RANGE;
  sun.shadow.camera.near=1;
  sun.shadow.camera.far=260;
  sun.shadow.bias=-0.0009;
  sun.shadow.normalBias=0.035;
  sun.shadow.radius=2.5; // v26追記: 影の輪郭を軽くぼかし、硬すぎる/ジャギーな見た目を緩和
  sun.target.position.set(0,0,0);
  scene.add(sun.target);
  window._bwSunLight=sun;
  // 太陽の影を常にプレイヤー中心に追従させる(範囲を絞っているため必要)
  window._bwUpdateSunShadowTarget=function(px,pz){
    if(!window._bwSunLight) return;
    window._bwSunLight.position.set(px+50,120,pz+30);
    window._bwSunLight.target.position.set(px,0,pz);
    window._bwSunLight.target.updateMatrixWorld();
  };

  // 3rd person player mesh
  playerMesh3p=createSimplePlayerMesh(TEAM_COLOR[player.team]||0x5555ee);
  playerMesh3p.visible=false;
  scene.add(playerMesh3p);

  _withMapSeed(currentMatchId ? currentMapSeed : 0, createWorld);
  setupInput();
  populateShop('Blocks');
  populateUpgrades();
  buildInvUI();

  // Spawn with team wool + starter kit
  addItem(woolKey(player.team),64);
  addItem('stone_sword',1);
  addItem('pickaxe',1);
  addItem('iron',16);
  addItem('gold',8);

  document.getElementById('crosshair').style.display='block';
  document.getElementById('hud').style.display='block';
  document.getElementById('hotbar-wrap').style.display='flex';
  document.getElementById('scoreboard').style.display='none';
  document.getElementById('btn-view-toggle').style.display='block';
  document.getElementById('btn-view-toggle').addEventListener('click',toggleThirdPerson);
  // v7: ホットバー上バー表示
  const hbStatus=document.getElementById('hotbar-status');
  if(hbStatus) hbStatus.style.display='flex';
  updateScoreboard();

  if(gameMode==='multi'){
    document.getElementById('mp-overlay').style.display='block';
    startMultiplayer();
  }
  updateUI();
  animate();
}

// ================================================================
//  PLAYER MESH v9 (claudecraft.html 準拠スキン + skin.html 頭部テクスチャ)
// ================================================================
let _skinCanvas=null; // グローバルスキンキャンバス

function loadSkinFromDataURL(dataURL, cb){
  const safe=_bwSafeImageSource(dataURL);
  if(!safe){cb&&cb();return;}
  const img=new Image();
  img.crossOrigin='anonymous';
  img.onload=()=>{
    try{
      // Minecraft-like skin UVs in the renderer are 64x64. If the supplied
      // PNG has another size, resample it once (nearest-neighbour) and use
      // the normalized image for every 3D skin view.
      const c=document.createElement('canvas'); c.width=64; c.height=64;
      const ctx=c.getContext('2d');
      ctx.imageSmoothingEnabled=false;
      ctx.clearRect(0,0,64,64);
      ctx.drawImage(img,0,0,64,64);
      const normalized=new Image();
      normalized.onload=()=>{ _skinImage=normalized; if(cb)cb(); };
      normalized.onerror=()=>{ _skinImage=img; if(cb)cb(); };
      normalized.src=c.toDataURL('image/png');
    }catch(e){ _skinImage=img; if(cb)cb(); }
  };
  img.onerror=()=>{ if(cb)cb(); };
  img.src=safe;
}

// ================================================================
//  スキン描画システム v16 — skin_view.html のUVマッピング方式を移植
//  （歩行/しゃがみ/ジャンプ等の物理演算には一切影響しない見た目のみの変更）
//  Java Edition 64x64スキン形式、ベース層+オーバーレイ層(第2レイヤー)対応
// ================================================================
let _skinImage=null;
let _skinLayerVisible=true;

function _getFallbackSkinImage(){
  if(_getFallbackSkinImage._cached) return _getFallbackSkinImage._cached;
  const c=document.createElement('canvas'); c.width=64; c.height=64;
  const ctx=c.getContext('2d');
  ctx.fillStyle='#3a5fcc'; ctx.fillRect(0,0,64,64);
  ctx.fillStyle='#ffdbab'; ctx.fillRect(0,0,32,16);
  ctx.fillStyle='#224488'; ctx.fillRect(0,16,64,16);
  ctx.fillStyle='#cc9955'; ctx.fillRect(40,16,16,16);ctx.fillRect(32,48,16,16);
  // v26追記: 以前はここで toDataURL() → 新しい<img>のsrcに設定 → 即returnしていたが、
  // <img>の読み込みは非同期のため、生成直後に_createSkinBodyPartがdrawImageすると
  // 「まだ読み込まれていない画像」を描画してしまい、真っ黒/空白のテクスチャになる
  // 競合状態(レースコンディション)があった。<canvas>要素自体は読み込み待ちが不要で
  // そのままdrawImageのソースとして使えるため、canvasをそのままキャッシュして返す。
  _getFallbackSkinImage._cached=c;
  return c;
}

function _createSkinBodyPart(img, x, y, w, h, d, layerX, layerY, pivotY, outerLayerList){
  // skin_view.html の createBodyPart を完全忠実移植（ピクセル単位のまま、スケールはルートで一括適用）
  const group=new THREE.Group();
  const getMaterials=(ox, oy, isOverlay)=>{
    const uvData=[
      [ox, oy+d, d, h],
      [ox+d+w, oy+d, d, h],
      [ox+d, oy, w, d],
      [ox+d+w, oy, w, d],
      [ox+d, oy+d, w, h],
      [ox+d+w+d, oy+d, w, h]
    ];
    return uvData.map(uv=>{
      const canvas=document.createElement('canvas');
      canvas.width=Math.max(1,uv[2]); canvas.height=Math.max(1,uv[3]);
      const ctx=canvas.getContext('2d');
      ctx.imageSmoothingEnabled=false;
      try{ ctx.drawImage(img, uv[0], uv[1], uv[2], uv[3], 0, 0, uv[2], uv[3]); }catch(e){}
      const tex=new THREE.CanvasTexture(canvas);
      tex.magFilter=THREE.NearestFilter; tex.minFilter=THREE.NearestFilter;
      return new THREE.MeshLambertMaterial({
        map:tex, transparent:isOverlay, alphaTest:isOverlay?0.1:0,
        side:isOverlay?THREE.DoubleSide:THREE.FrontSide
      });
    });
  };

  // ★ピクセル単位そのまま（スケール変換はcreateSimplePlayerMeshのルートで一括実施）
  const geom=new THREE.BoxGeometry(w, h, d);
  const baseMesh=new THREE.Mesh(geom, getMaterials(x, y, false));
  baseMesh.position.y=pivotY;
  group.add(baseMesh);

  const layerMesh=new THREE.Mesh(geom, getMaterials(layerX, layerY, true));
  layerMesh.position.y=pivotY;
  layerMesh.scale.set(1.05,1.05,1.05);
  layerMesh.visible=_skinLayerVisible;
  group.add(layerMesh);
  if(outerLayerList) outerLayerList.push(layerMesh);
  return group;
}

// プレイヤー/AIメッシュ生成
// skin_view.html の buildMinecraftModel を完全忠実に移植した入れ子階層構造:
//   root
//    ├─ torso('body') ── head('head'), rightArm('ra'), leftArm('la')  ← torsoの子
//    ├─ rightLeg('rl')                                                  ← rootの子
//    └─ leftLeg('ll')                                                   ← rootの子
// ルート全体を SK=1/16 でスケールし、ピクセル座標系→ブロック座標系に変換。
// root原点(0,0,0) = 足元（脚の下端）となり、player.pos.y（足元基準）とそのまま一致する。
function createSimplePlayerMesh(color, imgOverride){
  const img=imgOverride||_skinImage||_getFallbackSkinImage();
  const SK=1/16;
  const outerLayers=[];

  // ★modelGroup: skin_view.html準拠のピクセル座標系モデル本体（+Z=前面という向こう側の規約のまま構築）
  const modelGroup=new THREE.Group();

  const torso=_createSkinBodyPart(img, 16,16, 8,12,4, 16,32, 6, outerLayers);
  torso.position.set(0,12,0);
  torso.name='body';
  modelGroup.add(torso);

  const head=_createSkinBodyPart(img, 0,0, 8,8,8, 32,0, 4, outerLayers);
  head.position.set(0,12,0);
  head.name='head';
  torso.add(head); // torsoの子（本家準拠：頭は胴体に追従する）

  const rightArm=_createSkinBodyPart(img, 40,16, 4,12,4, 40,32, -6, outerLayers);
  rightArm.position.set(-6,12,0);
  rightArm.name='ra';
  torso.add(rightArm);

  const leftArm=_createSkinBodyPart(img, 32,48, 4,12,4, 48,48, -6, outerLayers);
  leftArm.position.set(6,12,0);
  leftArm.name='la';
  torso.add(leftArm);

  const rightLeg=_createSkinBodyPart(img, 0,16, 4,12,4, 0,32, -6, outerLayers);
  rightLeg.position.set(-2,12,0);
  rightLeg.name='rl';
  modelGroup.add(rightLeg);

  const leftLeg=_createSkinBodyPart(img, 16,48, 4,12,4, 0,48, -6, outerLayers);
  leftLeg.position.set(2,12,0);
  leftLeg.name='ll';
  modelGroup.add(leftLeg);

  // チームカラー識別オーバーレイ
  if(color){
    const overlay=new THREE.Mesh(new THREE.BoxGeometry(9,25,5),
      new THREE.MeshLambertMaterial({color,transparent:true,opacity:0.22}));
    overlay.position.y=12;
    modelGroup.add(overlay);
  }

  modelGroup.scale.set(SK,SK,SK); // ピクセル座標系(32px=2.0)→ブロック座標系
  // ★向き補正: skin_view.htmlは+Z=前面規約だが本ゲームは-Z=前進方向のため180°反転して合わせる。
  //   外側rootの回転(controls.yaw等)で毎フレーム上書きされないよう、内側のmodelGroupに固定で焼き込む。
  modelGroup.rotation.y=Math.PI;

  const root=new THREE.Group();
  root.add(modelGroup);
  root.userData._outerLayers=outerLayers;
  root.userData.rArm=rightArm; root.userData.lArm=leftArm;
  root.userData.rLeg=rightLeg; root.userData.lLeg=leftLeg;
  root.userData.walkT=0;
  root.userData._teamColor=color;
  return root;
}

function refreshPlayerMeshSkin(){
  if(!playerMesh3p || !playerMesh3p.parent) return;
  const parent=playerMesh3p.parent;
  const oldPos=playerMesh3p.position.clone();
  const oldVisible=playerMesh3p.visible;
  const color=playerMesh3p.userData?._teamColor;
  parent.remove(playerMesh3p);
  playerMesh3p=createSimplePlayerMesh(color);
  playerMesh3p.position.copy(oldPos);
  playerMesh3p.visible=oldVisible;
  parent.add(playerMesh3p);
}

function toggleSkinOverlayLayer(visible){
  _skinLayerVisible=visible;
  [playerMesh3p, ...Object.values(mpMeshes||{}), ...enemies].forEach(mesh=>{
    if(mesh && mesh.userData && mesh.userData._outerLayers){
      mesh.userData._outerLayers.forEach(l=>l.visible=visible);
    }
  });
}

// ================================================================
//  INPUT
// ================================================================
function setupInput(){
  document.addEventListener('keydown',e=>{
    const wasDown=keys[e.code];
    keys[e.code]=true;

    // Double-tap W = sprint
    if(e.code==='KeyW'&&!wasDown){
      if(Date.now()-lastWTime<300){player.isSprinting=true;}
      lastWTime=Date.now();
    }
    if(e.code==='ControlLeft')player.isSprinting=true;
    if(e.code==='ShiftLeft'){player.isCrouching=true;player.isSprinting=false;}


    // v7.1: チャット中/メニュー中はWASD等のゲームキーをブロック
    const _chatBox=document.getElementById('chat-input-box');
    const _chatOpen=_chatBox&&_chatBox.style.display!=='none';
    if(_chatOpen) return; // チャット入力中はゲーム操作を完全ブロック

    if(e.code==='KeyE'){
      e.preventDefault();
      if(activeMenu)toggleMenu(null);
      else{
        const npcHit=raycastNPC();
        if(npcHit) toggleMenu(npcHit.userData.role==='Shop'?'shop':'upgrade');
        else toggleMenu('inventory');
      }
    }
    if(e.code==='KeyI'){
      if(activeMenu==='inventory')toggleMenu(null);
      else toggleMenu('inventory');
    }
    if(e.code==='KeyF')useItem();
    if(e.code==='KeyQ'){e.preventDefault();toggleThirdPerson();}
    if(e.code==='ArrowDown'){e.preventDefault();dropItem();}
    if(e.code.startsWith('Digit')){const n=parseInt(e.code.slice(-1))-1;if(n>=0&&n<9)switchSlot(n);}
    // v26追記: ESC優先順位を一本化(チャット→インベントリ/ショップ→ポーズ/インゲームメニュー)。
    // 以前は別の場所(captureフェーズ)にも「メニューを閉じる」ESCリスナーがあり、
    // 同じキー入力で「閉じる」と「開く」が二重発火することがあった。
    if(e.code==='Escape'){
      e.preventDefault();
      if(_chatBox&&_chatBox.style.display!=='none'){
        _chatBox.style.display='none';
      } else if(activeMenu){
        toggleMenu(null);
      } else if(gameMode!=='lobby'){
        if(gameMode==='solo') togglePauseMenu();
        else toggleInGameMenu();
      }
      return;
    }
    if(e.code==='F5'){e.preventDefault();toggleThirdPerson();}
    if(e.code==='Tab'){e.preventDefault();document.getElementById('scoreboard').style.display='block';}
    // (ESC処理は上でまとめて一本化済み)
    if(e.code==='Enter'&&!activeMenu){
      if(_chatBox&&_chatBox.style.display==='none'){
        e.preventDefault();
        if(gameMode==='multi') openChatInput('team');
        else if(gameMode==='lobby') openChatInput('lobby');
      }
    }
    if(e.code==='Backspace'&&gameMode==='multi'&&!activeMenu){
      if(_chatBox&&_chatBox.style.display==='none'){e.preventDefault();openChatInput('all');}
    }
  });
  // チャット入力 - 完全伝播ブロック
  const chatInputEl=document.getElementById('chat-input');
  if(chatInputEl){
    chatInputEl.addEventListener('keydown',e=>{
      e.stopPropagation();
      if(e.key==='Enter'){e.preventDefault();sendChat();}
      if(e.key==='Escape'){e.preventDefault();const b=document.getElementById('chat-input-box');if(b)b.style.display='none';}
    });
  }
  document.addEventListener('keyup',e=>{
    keys[e.code]=false;
    if(e.code==='ShiftLeft')player.isCrouching=false;
    if(e.code==='ControlLeft')player.isSprinting=false;
    if(e.code==='KeyW')player.isSprinting=false;
    if(e.code==='Tab')document.getElementById('scoreboard').style.display='none';
  });
  document.addEventListener('wheel',e=>{
    player.selectedIdx=(player.selectedIdx+(e.deltaY>0?1:-1)+9)%9;updateUI();
  });
  document.addEventListener('mousemove',e=>{
    if(document.pointerLockElement&&!activeMenu){
      const sens=(currentSettings.sens||0.15)*0.011;
      const invertY=currentSettings.invertY?-1:1;
      controls.yaw-=e.movementX*sens;
      controls.pitch=Math.max(-Math.PI/2+0.001,Math.min(Math.PI/2-0.001,
        controls.pitch-e.movementY*sens*invertY));
    }
  });
  document.addEventListener('mousedown',e=>{
    if(!document.pointerLockElement&&!activeMenu){document.body.requestPointerLock();return;}
    if(activeMenu)return;
    if(player.spectatorMode||player.isDead)return; // スペクテイター中は一切の攻撃/採掘/設置を禁止
    if(e.button===0){
      player.mining=true;
      doAttack();
      _swingHand(); // 左クリック: 手を振る
    }
    if(e.button===2){
      const s=player.inv[player.selectedIdx];
      if(s&&s.type==='bow'){
        startBowCharge(); // 右クリック長押し: 弓チャージ開始
      }else{
        player.placing=true;
        _swingHand();
      }
    }
  });
  document.addEventListener('mouseup',e=>{
    if(e.button===0)player.mining=false;
    if(e.button===2){
      releaseBow(); // 離したら矢を放つ
      player.placing=false;
    }
  });
  document.addEventListener('contextmenu',e=>e.preventDefault());
  window.addEventListener('resize',()=>{
    camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
    renderer.setSize(innerWidth,innerHeight);
  });
  document.querySelectorAll('.tab').forEach(t=>{
    t.addEventListener('click',e=>{
      document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
      e.target.classList.add('active');
      populateShop(e.target.dataset.cat);
    });
  });
  // pointer lock request on click when no menu
  document.body.addEventListener('click',()=>{
    if(!activeMenu&&!document.getElementById('lobby').style.display?.includes('none')===false
      &&document.getElementById('lobby').style.display==='none'
      &&!document.pointerLockElement) document.body.requestPointerLock();
  });
}

function raycastNPC(){
  const eyePos=new THREE.Vector3(player.pos.x,player.pos.y+1.6,player.pos.z);
  const dir=new THREE.Vector3(0,0,-1).applyEuler(new THREE.Euler(controls.pitch,controls.yaw,0,'YXZ'));
  const ray=new THREE.Raycaster();
  ray.set(eyePos,dir);
  ray.far=5;
  const npcList=npcs.filter(n=>n.userData?.isNPC);
  const hits=ray.intersectObjects(npcList,true);
  const hit=hits.find(h=>h.distance<=5);
  if(!hit)return null;
  let obj=hit.object;while(obj&&!obj.userData?.isNPC)obj=obj.parent;
  return obj||null;
}

// 視点モード: 0=1人称, 1=3人称(背後), 2=3人称(正面)
let thirdPersonMode=0;

function toggleThirdPerson(){
  thirdPersonMode=(thirdPersonMode+1)%3;
  thirdPerson=thirdPersonMode>0;
  if(playerMesh3p)playerMesh3p.visible=thirdPerson;
  const xhair=document.getElementById('crosshair');
  if(xhair)xhair.style.display=thirdPerson?'none':'block';
  const badge=document.getElementById('view-badge-overlay');
  if(badge)badge.style.display=thirdPerson?'block':'none';
  const labels=['','👁 3人称(背後)','👁 3人称(正面)'];
  const vbEl=document.getElementById('view-badge');
  if(vbEl)vbEl.textContent=labels[thirdPersonMode]||'';
  const btnEl=document.getElementById('btn-view-toggle');
  if(btnEl)btnEl.textContent=['👁 1st','👁 3rd','👁 Front'][thirdPersonMode];
}

// ================================================================
//  ATTACK
// ================================================================
// v26追記: レイキャストで当たった子オブジェクトから、
// enemy(userData.isEnemy)/MPプレイヤー(userData.isMPPlayer)の
// 「ルート」オブジェクトまで親を辿って正しく特定するヘルパー。
// (以前は eHit.object.parent を直接使っていたが、modelGroupの1階層下
//  にしか居ないと誤認しており、実際は torso/head/armなど何階層も
//  ネストしているため hp を持つルートに辿り着けず、ダメージが
//  全く入らないバグの原因になっていた)
function _bwResolveHitRoot(obj, flagKey){
  let o=obj;
  while(o){
    if(o.userData && o.userData[flagKey]) return o;
    o=o.parent;
  }
  return null;
}

function doAttack(){
  if(!scene||player.isDead||player.spectatorMode)return;
  window._attackAnimationUntil=Date.now()+180;
  const sel=player.inv[player.selectedIdx];
  if(sel?.type==='bow'){shootBow();return;}

  const ATTACK_REACH=4.5;
  const eyePos=new THREE.Vector3(player.pos.x,player.pos.y+1.6,player.pos.z);
  const dir=new THREE.Vector3(0,0,-1).applyEuler(new THREE.Euler(controls.pitch,controls.yaw,0,'YXZ')).normalize();
  const ray=new THREE.Raycaster(eyePos,dir,0,ATTACK_REACH);

  // AI: recursive hit test against the actual skinned meshes.
  const eHit=ray.intersectObjects(enemies,true).find(h=>h.distance<=ATTACK_REACH);
  if(eHit){
    const enemy=_bwResolveHitRoot(eHit.object,'isEnemy');
    if(enemy && enemy.userData.team!==player.team){
      const dmg=calcDmg()*(player.vel.y<-2?1.5:1);
      if(player.vel.y<-2)announce('⚡ Critical!','#ffff00');
      enemy.userData.hp=Math.max(0,(+enemy.userData.hp||20)-dmg);
      window._bwLastHitDebug=`melee→AI dmg=${dmg.toFixed(1)} hp残=${enemy.userData.hp.toFixed(1)} dist=${eHit.distance.toFixed(2)}`;
      spawnParticles(enemy.position.clone(),'#ff4444',5);
      if(typeof showDamageNumber==='function') showDamageNumber(dmg,enemy.position.clone().add(new THREE.Vector3(0,1.6,0)),'#ff5555');
      const kb=new THREE.Vector3().subVectors(enemy.position,player.pos).normalize();
      if(enemy.userData.vel)enemy.userData.vel.add(new THREE.Vector3(kb.x*3,.5,kb.z*3));
      shakeIntensity=.07;
      const ra=playerMesh3p?.getObjectByName('ra'); if(ra)ra.rotation.x=-1.1;
      if(enemy.userData.hp<=0)killEnemy(enemy);
      return;
    }
  }

  if(gameMode!=='multi')return;

  const mpRoots=Object.entries(mpMeshes).filter(([uid,m])=>m&&m.userData?.team!==player.team&&uid!==myPeerId);
  let hit=null;
  const hits=ray.intersectObjects(mpRoots.map(x=>x[1]),true);
  if(hits.length) hit=hits.find(h=>h.distance<=ATTACK_REACH)||null;

  // Small, explicit player hitbox fallback. This fixes misses caused by
  // animated body parts/skin pivots while keeping the reach and view cone.
  if(!hit){
    let best=null,bestDist=Infinity;
    for(const [uid,m] of mpRoots){
      const target=m.position.clone().add(new THREE.Vector3(0,0.9,0));
      const along=target.clone().sub(eyePos).dot(dir);
      if(along<0||along>ATTACK_REACH)continue;
      const closest=eyePos.clone().addScaledVector(dir,along);
      const lateral=closest.distanceTo(target);
      const vertical=Math.abs((m.position.y+0.9)-closest.y);
      if(lateral<=0.85 && vertical<=1.15 && along<bestDist){bestDist=along;best={uid,m};}
    }
    if(best){
      const target=best.m.position.clone().add(new THREE.Vector3(0,0.9,0));
      hit={distance:bestDist,object:best.m,userDataFallback:true};
    }
  }

  if(hit){
    const mesh=hit.object.userData?.isMPPlayer?hit.object:_bwResolveHitRoot(hit.object,'isMPPlayer');
    if(!mesh)return;
    const uid=Object.keys(mpMeshes).find(k=>mpMeshes[k]===mesh);
    if(!uid||mesh.userData.team===player.team)return;
    const dmg2=calcDmg()*(player.vel.y<-2?1.5:1);
    sendDamageSupabase(uid,dmg2,'sword');
    window._bwLastHitDebug=`melee→MP(${uid.slice(0,8)}) dmg=${dmg2.toFixed(1)} dist=${Number(hit.distance).toFixed(2)}`;
    sbRequest({action:'actionEvent',uid:myPeerId,actionType:'attack',itemType:sel?.type||'sword',x:player.pos.x,y:player.pos.y+1.2,z:player.pos.z,yaw:controls.yaw,pitch:controls.pitch});
    if(typeof showDamageNumber==='function') showDamageNumber(dmg2,mesh.position.clone().add(new THREE.Vector3(0,1.6,0)),'#ff5555');
  }
}

function killEnemy(enemy){
  announce('💀 KILL!','#FFAA00');
  playerData.kills++;
  document.getElementById('hud-kills').textContent=playerData.kills;
  // キルフィード表示
  const victimName = enemy.userData?.name || (enemy.userData?.team ? enemy.userData.team+' プレイヤー' : '敵');
  showKillFeed(player.name, victimName, enemy.userData?.isGolem);
  // Drop items
  spawnDrop('iron',enemy.position.clone());
  spawnDrop('gold',enemy.position.clone().add(new THREE.Vector3(.3,0,.3)));
  scene.remove(enemy);enemies=enemies.filter(e=>e!==enemy);
  // Respawn AI after 10s
  if(gameMode==='solo'){
    const t=enemy.userData.team;
    const ip=TEAM_ISLAND_POS[t];
    setTimeout(()=>{if(scene)spawnAI(ip.x,ip.y+2,ip.z,t);},10000);
  }
}

// ================================================================
//  キルフィード（画面右上に撃破通知を積み上げ表示）
// ================================================================
function _getKillFeedEl(){
  let el=document.getElementById('kill-feed');
  if(!el){
    el=document.createElement('div');
    el.id='kill-feed';
    el.style.cssText='position:fixed;top:70px;right:10px;z-index:120;display:flex;flex-direction:column;gap:3px;align-items:flex-end';
    document.body.appendChild(el);
  }
  return el;
}
function showKillFeed(killer, victim, isGolemKill){
  const feed=_getKillFeedEl();
  const row=document.createElement('div');
  row.style.cssText='background:rgba(0,0,0,0.65);padding:4px 10px;border-radius:3px;font-size:12px;color:#fff;white-space:nowrap;animation:killfeedIn 0.3s ease';
  const icon=isGolemKill?'🤖':'⚔️';
  row.innerHTML=`<span style="color:#ffaa00;font-weight:bold">${_bwEscapeHtml(killer)}</span> ${icon} <span style="color:#aaa">${_bwEscapeHtml(victim)}</span>`;
  feed.appendChild(row);
  while(feed.children.length>5) feed.removeChild(feed.firstChild);
  setTimeout(()=>{row.style.opacity='0';row.style.transition='opacity 0.5s';setTimeout(()=>row.remove(),500);},4500);
}

function calcDmg(){
  let d=2.5;
  const s=player.inv[player.selectedIdx];
  if(s){if(s.type==='stone_sword')d=5;if(s.type==='iron_sword')d=7;if(s.type==='dia_sword')d=9;}
  if(player.upgrades.sharpness>0)d*=1.12;
  return d;
}

function dropItem(){
  const s=player.inv[player.selectedIdx];
  if(!s||!s.type||s.count<=0)return;
  s.count--;
  if(s.count<=0){s.type=null;s.count=0;}
  spawnDrop(s.type,player.pos.clone().add(new THREE.Vector3(0,1,0)));
  updateUI();
}

// ================================================================
//  煽りエモートシステム v15
//  skin_view.html の実装を参考に、体パーツを実際に動かす本格ポーズ
// ================================================================
const EMOTES=[
  {key:'wave',    emoji:'👋', label:'手を振る'},
  {key:'cheer',   emoji:'🙌', label:'喜ぶ'},
  {key:'clap',    emoji:'👏', label:'拍手'},
  {key:'point',   emoji:'👉', label:'指差し'},
  {key:'facepalm',emoji:'🤦', label:'やれやれ'},
  {key:'zombie',  emoji:'🧟', label:'ゾンビ'},
];
let _emoteMenuOpen=false;
const EMOTE_DURATION=2.5; // 秒

// skin_view.html準拠のポーズターゲット計算（ra/la/rl/ll/head/bodyの回転を返す）
function _getEmotePose(key, et){
  const tgt={head:{x:0,y:0},body:{x:0,y:0},ra:{x:0,y:0,z:0},la:{x:0,y:0,z:0},rl:{x:0},ll:{x:0}};
  switch(key){
    case 'wave':
      tgt.ra.x = -(Math.PI-0.2);
      tgt.ra.z = -0.3 + Math.sin(et*6)*0.4;
      break;
    case 'cheer':
      tgt.ra.x = -(Math.PI-0.2); tgt.la.x = (Math.PI-0.2);
      tgt.ra.z = -0.2; tgt.la.z = 0.2;
      break;
    case 'clap':
      tgt.ra.x = Math.PI/2; tgt.la.x = -Math.PI/2;
      tgt.ra.y = -0.4 + Math.abs(Math.sin(et*8))*0.2;
      tgt.la.y =  0.4 - Math.abs(Math.sin(et*8))*0.2;
      break;
    case 'point':
      tgt.ra.x = Math.PI/2; tgt.ra.y = -0.2;
      break;
    case 'facepalm':
      tgt.ra.x = Math.PI*0.6; tgt.ra.z = -0.5;
      tgt.head.x = 0.3;
      break;
    case 'zombie':
      tgt.ra.x = Math.PI/2; tgt.la.x = -Math.PI/2;
      tgt.head.x = 0.1;
      break;
  }
  return tgt;
}

// 指定メッシュにエモートポーズを毎フレーム適用（lerpで滑らかに）
function _applyEmotePose(mesh, key, startTime){
  if(!mesh || !key) return false;
  const elapsed=(Date.now()-startTime)/1000;
  if(elapsed>EMOTE_DURATION) return false; // 終了

  const et=elapsed*5;
  const tgt=_getEmotePose(key, et);
  const s=0.25; // 補間速度
  const lerp=(a,b,t)=>a+(b-a)*t;

  const hd=mesh.getObjectByName('head');
  const bd=mesh.getObjectByName('body');
  const ra=mesh.getObjectByName('ra'), la=mesh.getObjectByName('la');
  const rl=mesh.getObjectByName('rl'), ll=mesh.getObjectByName('ll');

  if(hd) hd.rotation.x=lerp(hd.rotation.x, tgt.head.x, s);
  if(bd) bd.rotation.x=lerp(bd.rotation.x, tgt.body.x, s);
  if(ra){ra.rotation.x=lerp(ra.rotation.x,tgt.ra.x,s);ra.rotation.y=lerp(ra.rotation.y,tgt.ra.y,s);ra.rotation.z=lerp(ra.rotation.z,tgt.ra.z,s);}
  if(la){la.rotation.x=lerp(la.rotation.x,tgt.la.x,s);la.rotation.y=lerp(la.rotation.y,tgt.la.y,s);la.rotation.z=lerp(la.rotation.z,tgt.la.z,s);}
  if(rl)rl.rotation.x=lerp(rl.rotation.x,tgt.rl.x,s);
  if(ll)ll.rotation.x=lerp(ll.rotation.x,tgt.ll.x,s);
  return true;
}

function toggleEmoteMenu(){
  let el=document.getElementById('emote-menu');
  if(el){el.remove();_emoteMenuOpen=false;_captureCursor();return;}
  _emoteMenuOpen=true;
  _releaseCursor();
  el=document.createElement('div');
  el.id='emote-menu';
  el.style.cssText='position:fixed;bottom:140px;left:50%;transform:translateX(-50%);display:flex;gap:8px;background:rgba(0,0,0,0.7);padding:10px;border-radius:8px;z-index:200';
  EMOTES.forEach(em=>{
    const btn=document.createElement('div');
    btn.innerHTML=`<div style="font-size:28px">${em.emoji}</div><div style="font-size:10px;color:#ccc">${em.label}</div>`;
    btn.style.cssText='cursor:pointer;padding:4px 8px;border-radius:6px;transition:background 0.15s;text-align:center';
    btn.onmouseenter=()=>btn.style.background='rgba(255,255,255,0.2)';
    btn.onmouseleave=()=>btn.style.background='';
    btn.onclick=()=>{ playEmote(em.key,em.emoji); el.remove(); _emoteMenuOpen=false; _captureCursor(); };
    el.appendChild(btn);
  });
  document.body.appendChild(el);
}

function playEmote(key, emoji){
  // 自分のプレイヤーモデルに実際のポーズアニメーションを適用
  player._emoteKey=key;
  player._emoteStart=Date.now();
  // 頭上にエモートバブルも表示
  showEmoteBubble(player.name, emoji, true);
  // マルチプレイヤー時は他プレイヤーにも通知（ポーズキー+絵文字の両方を送信）
  if(gameMode==='multi'){
    sbRequest({action:'postMsg',name:player.name,msg:'__EMOTE__'+key+'|'+emoji,color:'#ffff00',pcId:myPeerId,matchId:currentMatchId,scope:'battle',team:player.team});
  }
}

function showEmoteBubble(name, emoji, isSelf){
  const el=document.createElement('div');
  el.style.cssText=`position:fixed;top:${isSelf?'40%':'35%'};left:50%;transform:translateX(-50%);font-size:48px;z-index:150;pointer-events:none;animation:emoteFloat 2s ease-out forwards`;
  el.textContent=emoji;
  document.body.appendChild(el);
  setTimeout(()=>el.remove(),2000);
}

// ================================================================
//  鬼畜モード: 色彩反転 + ボット討伐RTAタイマー + 低画質化
// ================================================================
let _rtaStartTime=0, _rtaElapsed=0, _rtaRunning=false, _rtaInterval=null;

function toggleKishikuMode(enabled){
  currentSettings.kishiku=enabled;
  document.body.classList.toggle('kishiku-mode',enabled);
  if(enabled){
    _startRTATimer();
    if(currentSettings.kishikuUgly&&renderer) renderer.setPixelRatio(0.4);
    announce('😈 鬼畜モード ON — 頑張れ！','#ff2222');
  } else {
    _stopRTATimer();
    if(renderer) renderer.setPixelRatio(window.devicePixelRatio*(currentSettings.texQuality===2?1.5:currentSettings.texQuality===0.5?0.5:1));
  }
}

function _startRTATimer(){
  let el=document.getElementById('rta-timer');
  if(!el){
    el=document.createElement('div');
    el.id='rta-timer';
    el.style.cssText='position:fixed;top:10px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.7);color:#ff4444;font-size:22px;padding:4px 16px;border-radius:6px;z-index:130;font-family:monospace;border:2px solid #ff4444';
    document.body.appendChild(el);
  }
  el.style.display='block';
  _rtaStartTime=Date.now()-_rtaElapsed;
  _rtaRunning=true;
  if(_rtaInterval) clearInterval(_rtaInterval);
  _rtaInterval=setInterval(_updateRTADisplay,50);
}
function _pauseRTATimer(){
  if(!_rtaRunning) return;
  _rtaRunning=false;
  _rtaElapsed=Date.now()-_rtaStartTime;
}
function _resumeRTATimer(){
  if(_rtaRunning||!currentSettings.kishiku) return;
  _rtaRunning=true;
  _rtaStartTime=Date.now()-_rtaElapsed;
}
function _stopRTATimer(){
  _rtaRunning=false;
  if(_rtaInterval){clearInterval(_rtaInterval);_rtaInterval=null;}
  const el=document.getElementById('rta-timer');
  if(el) el.style.display='none';
  _rtaElapsed=0;
}
function _updateRTADisplay(){
  if(!_rtaRunning) return;
  const ms=Date.now()-_rtaStartTime;
  const el=document.getElementById('rta-timer');
  if(el){
    const m=Math.floor(ms/60000), s=Math.floor((ms%60000)/1000), cs=Math.floor((ms%1000)/10);
    el.textContent=`⏱ ${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(cs).padStart(2,'0')}`;
  }
}
// メニュー/インベントリ/ショップが開いたらRTAを一時停止
function _syncRTAWithMenu(){
  if(!currentSettings.kishiku) return;
  if(activeMenu) _pauseRTATimer();
  else _resumeRTATimer();
}

const CONSUMABLE_TIME={ g_apple:1.6, hp_pot:1.6, bread:1.6, steak:1.6 };
let _isConsuming=false;

// ================================================================
//  バフ管理システム v14: HUDにアイコン＋残り時間を明示表示
// ================================================================
player.activeBuffs = player.activeBuffs || {}; // {key: {endTime, color, label}}

function activateBuff(key, durationSec, color, label){
  player.activeBuffs[key] = {
    endTime: Date.now() + durationSec*1000,
    color: color||'#ffffff',
    label: label||key
  };
  _renderBuffHUD();
}

function _renderBuffHUD(){
  let wrap=document.getElementById('buff-hud');
  if(!wrap){
    wrap=document.createElement('div');
    wrap.id='buff-hud';
    wrap.style.cssText='position:fixed;top:70px;left:10px;display:flex;flex-direction:column;gap:4px;z-index:110';
    document.body.appendChild(wrap);
  }
  wrap.innerHTML='';
  const now=Date.now();
  Object.entries(player.activeBuffs).forEach(([key,buff])=>{
    const remain=(buff.endTime-now)/1000;
    if(remain<=0){ delete player.activeBuffs[key]; return; }
    const row=document.createElement('div');
    row.style.cssText=`display:flex;align-items:center;gap:6px;background:rgba(0,0,0,0.65);border-left:3px solid ${buff.color};padding:4px 8px;border-radius:3px;font-size:12px;color:#fff;min-width:110px`;
    row.innerHTML=`<span style="color:${buff.color};font-weight:bold">${buff.label}</span><span style="margin-left:auto;color:#ccc">${remain.toFixed(1)}s</span>`;
    wrap.appendChild(row);
  });
}
// バフHUDは毎フレーム更新（animate内から呼ぶ）
setInterval(_renderBuffHUD, 200);

// アップグレード購入時にもバフとして明示（視覚的にわかりやすく）
function _labelUpgradeBuff(key){
  const map={
    sharpness:['⚔️ シャープソード','#ff8888'],
    protection:['🛡️ プロテクション','#88aaff'],
    haste:['⚡ ヘイスト','#ffee66'],
    healpool:['💉 ヒールプール','#88ffaa'],
    forge:['🏭 フォージ強化','#ffaa66'],
  };
  return map[key]||[key,'#ffffff'];
}
function useItem(){
  const s=player.inv[player.selectedIdx];if(!s||!s.type)return;
  if(CONSUMABLE_TIME[s.type]!==undefined){
    _startConsuming(s.type);
    return;
  }
  if(s.type==='golem'){useGolem();return;}
  if(s.type==='bow'){shootBow();return;}
}

function _startConsuming(type){
  if(_isConsuming) return; // 咀嚼中は連続使用不可
  _isConsuming=true;
  const duration=CONSUMABLE_TIME[type]||1.6;
  const startTime=Date.now();

  // 咀嚼中プログレスUI
  let bar=document.getElementById('eat-progress');
  if(!bar){
    bar=document.createElement('div');
    bar.id='eat-progress';
    bar.style.cssText='position:fixed;bottom:130px;left:50%;transform:translateX(-50%);width:160px;height:10px;background:rgba(0,0,0,0.6);border:1px solid #555;border-radius:5px;overflow:hidden;z-index:95';
    bar.innerHTML='<div id="eat-progress-fill" style="height:100%;background:#ffcc44;width:0%;transition:none"></div>';
    document.body.appendChild(bar);
  }
  bar.style.display='block';

  // 咀嚼アニメーション（腕を小刻みに動かす）
  const chewInterval=setInterval(()=>{
    if(_handGroup){
      const bob=Math.sin(Date.now()*0.02)*0.06;
      _handGroup.position.z=_DEFAULT_HAND_POS.z+0.1+bob;
      _handGroup.rotation.x=0.35+bob*0.5;
    }
  },40);

  const progressInterval=setInterval(()=>{
    const elapsed=(Date.now()-startTime)/1000;
    const pct=Math.min(100,(elapsed/duration)*100);
    const fill=document.getElementById('eat-progress-fill');
    if(fill) fill.style.width=pct+'%';
  },30);

  setTimeout(()=>{
    clearInterval(chewInterval);
    clearInterval(progressInterval);
    _isConsuming=false;
    if(_handGroup){_handGroup.position.z=_DEFAULT_HAND_POS.z;_handGroup.rotation.x=0.2;}
    const barEl=document.getElementById('eat-progress');
    if(barEl) barEl.style.display='none';

    // 実際に効果を適用（食べ終わった後）
    const s=player.inv[player.selectedIdx];
    if(!s||s.type!==type) return; // スロット切替済みなら無効化
    _applyConsumableEffect(type);
    s.count--;if(s.count<=0){s.type=null;s.count=0;}
    updateUI();
  }, duration*1000);
}

function _applyConsumableEffect(type){
  if(type==='g_apple'){
    player.hp=Math.min(player.maxHp,player.hp+6);
    activateBuff('regen',5,'#ff88cc','💗 再生');
    announce('🍎 +6 HP','#55ff55');
  } else if(type==='hp_pot'){
    player.hp=Math.min(player.maxHp,player.hp+4);
    announce('❤️ +4 HP','#ff5555');
  } else if(type==='bread'){
    player.hunger=Math.min(20,player.hunger+3);
    announce('🍞 空腹+3','#ccaa66');
  } else if(type==='steak'){
    player.hunger=Math.min(20,player.hunger+8);
    announce('🥩 空腹+8','#cc7744');
  }
}


// ================================================================
//  PHYSICS — Minecraft-accurate, dt-based
// ================================================================
function physicsStep(dt){
  // ================================================================
  //  v10移植版: 移動速度/ジャンプ/当たり判定を完全にv10準拠に統一
  //  順序: X軸 → Y軸 → Z軸（v10オリジナルと同一）
  // ================================================================
  const cs=currentSettings||{};
  const PW=0.3, PH=player.isCrouching?1.5:1.8;
  const EYE_H=player.isCrouching?1.27:1.62;

  if(player.spectatorMode){
    const basespd = keys['ShiftLeft'] ? 0.15 : (keys['ControlLeft'] ? 1.2 : 0.45);
    const spd = basespd * dt / 0.016;
    const smv = new THREE.Vector3();
    if(keys['KeyW'])smv.z-=1;if(keys['KeyS'])smv.z+=1;
    if(keys['KeyA'])smv.x-=1;if(keys['KeyD'])smv.x+=1;
    if(smv.lengthSq()>0){
      smv.normalize().multiplyScalar(spd);
      smv.applyAxisAngle(new THREE.Vector3(0,1,0),controls.yaw);
      const pitchFwd = -Math.sin(controls.pitch)*spd;
      player.pos.x+=smv.x;player.pos.z+=smv.z;player.pos.y+=pitchFwd;
    }
    if(keys['Space'])    player.pos.y+=spd*0.8;
    if(keys['ShiftLeft'])player.pos.y-=spd*0.8;
    camera.position.set(player.pos.x,player.pos.y+EYE_H,player.pos.z);
    camera.rotation.set(controls.pitch,controls.yaw,0,'YXZ');
    return;
  }

  if(cs.autoSprint&&keys['KeyW']&&player.onGround&&!player.isCrouching) player.isSprinting=true;

  // v10方式: GRAV/JUMP_F/TERMも完全一致、フレーム依存の軽快な操作感
  const GRAV=0.032, JUMP_F=0.42, TERM=-3.0;
  const spd2=(typeof _isConsuming!=='undefined'&&_isConsuming)?0.06:(player.isSprinting?0.19:player.isCrouching?0.06:0.125);
  const frameScale=Math.min(dt/0.016, 3);

  const mv=new THREE.Vector3();
  const hasInput=keys['KeyW']||keys['KeyS']||keys['KeyA']||keys['KeyD'];
  if(hasInput){
    if(keys['KeyW'])mv.z-=1;if(keys['KeyS'])mv.z+=1;
    if(keys['KeyA'])mv.x-=1;if(keys['KeyD'])mv.x+=1;
    mv.normalize().multiplyScalar(spd2*frameScale);
    mv.applyAxisAngle(new THREE.Vector3(0,1,0),controls.yaw);
  }

  // スニーク崖止め（v10と同一ロジック）
  if(player.isCrouching&&player.onGround){
    const np=player.pos.clone().add(mv);
    let hg=false;
    for(const b of nearBlocks(np.x,np.y-0.1,np.z)){
      const bp=b.position;
      if(Math.abs(np.x-bp.x)<PW+0.5&&Math.abs(np.z-bp.z)<PW+0.5&&np.y>=bp.y-0.5&&np.y<=bp.y+0.5){hg=true;break;}
    }
    if(!hg)mv.set(0,0,0);
  }

  // ジャンプ・重力（v10方式）
  player.vel.y=Math.max(player.vel.y-GRAV*frameScale,TERM);
  if(keys['Space']&&player.onGround){
    player.vel.y=JUMP_F;
    player.onGround=false;
    if(player.isSprinting){
      const fwd=new THREE.Vector3(0,0,-0.2).applyAxisAngle(new THREE.Vector3(0,1,0),controls.yaw);
      mv.x+=fwd.x;mv.z+=fwd.z;
    }
  }

  // ── X軸移動 + 衝突（v10準拠：&&両条件、方向別判定）──
  player.pos.x+=mv.x;
  if(mv.x!==0){
    for(const b of nearBlocks(player.pos.x,player.pos.y+PH/2,player.pos.z)){
      const bp=b.position;
      if(player.pos.y+PH<=bp.y-0.5||player.pos.y>=bp.y+0.5)continue;
      if(player.pos.z+PW<=bp.z-0.5||player.pos.z-PW>=bp.z+0.5)continue;
      if(mv.x>0&&player.pos.x+PW>bp.x-0.5&&player.pos.x-PW<bp.x-0.5)player.pos.x=bp.x-0.5-PW;
      if(mv.x<0&&player.pos.x-PW<bp.x+0.5&&player.pos.x+PW>bp.x+0.5)player.pos.x=bp.x+0.5+PW;
    }
  }

  // ── Y軸移動 + 衝突（v10準拠：落下ダメージ計算含む）──
  // すり抜け防止のため大きな速度は分割ステップで処理
  const ySteps=Math.max(1,Math.ceil(Math.abs(player.vel.y)/0.45));
  const yStep=player.vel.y/ySteps;
  player.onGround=false;
  for(let s=0;s<ySteps;s++){
    player.pos.y+=yStep;
    for(const b of nearBlocks(player.pos.x,player.pos.y+PH/2,player.pos.z)){
      const bp=b.position;
      if(player.pos.x+PW<=bp.x-0.5||player.pos.x-PW>=bp.x+0.5)continue;
      if(player.pos.z+PW<=bp.z-0.5||player.pos.z-PW>=bp.z+0.5)continue;
      if(player.vel.y<=0&&player.pos.y<bp.y+0.5&&player.pos.y>=bp.y-0.5){
        if(player.vel.y<-0.6){const fd=Math.floor(-player.vel.y*6-3);if(fd>0)applyDamage(fd);}
        player.pos.y=bp.y+0.5;player.vel.y=0;player.onGround=true;
      }else if(player.vel.y>0&&player.pos.y+PH>bp.y-0.5&&player.pos.y+PH<=bp.y+0.5){
        player.pos.y=bp.y-0.5-PH;player.vel.y=0;
      }
    }
  }

  // ── Z軸移動 + 衝突（v10準拠：&&両条件、方向別判定）──
  player.pos.z+=mv.z;
  if(mv.z!==0){
    for(const b of nearBlocks(player.pos.x,player.pos.y+PH/2,player.pos.z)){
      const bp=b.position;
      if(player.pos.y+PH<=bp.y-0.5||player.pos.y>=bp.y+0.5)continue;
      if(player.pos.x+PW<=bp.x-0.5||player.pos.x-PW>=bp.x+0.5)continue;
      if(mv.z>0&&player.pos.z+PW>bp.z-0.5&&player.pos.z-PW<bp.z-0.5)player.pos.z=bp.z-0.5-PW;
      if(mv.z<0&&player.pos.z-PW<bp.z+0.5&&player.pos.z+PW>bp.z+0.5)player.pos.z=bp.z+0.5+PW;
    }
  }

  // 奈落: respawn無敵を無視して確定死亡（v10は即死のみ、v12強化版で無敵バグも修正）
  if(player.pos.y<-10){
    applyVoidDeath();
    return;
  }

  // ヒール
  if(player.upgrades?.healpool&&player.hp<player.maxHp&&Math.random()<0.008){player.hp=Math.min(player.maxHp,player.hp+0.5);updateUI();}
  if(player.hunger>=18&&player.hp<player.maxHp&&Math.random()<0.015){player.hp=Math.min(player.maxHp,player.hp+0.5);updateUI();}

  // ビューボビング
  const bobbing=cs.viewBobbing!==false;
  let bobX=0,bobY=0;
  if(bobbing&&player.onGround&&hasInput){
    const bt=(player._bobT=(player._bobT||0)+dt*(player.isSprinting?16:12));
    bobX=Math.sin(bt)*0.015;bobY=Math.abs(Math.sin(bt*0.5))*0.02;
  }

  // カメラ
  const eyeY=player.pos.y+EYE_H;
  if(thirdPerson){
    const BD=5, pitchCos=Math.cos(controls.pitch);
    let bk;
    if(thirdPersonMode===2){
      bk=new THREE.Vector3(-Math.sin(controls.yaw)*pitchCos*BD,Math.sin(-controls.pitch)*BD+1.2,-Math.cos(controls.yaw)*pitchCos*BD);
    } else {
      bk=new THREE.Vector3(Math.sin(controls.yaw)*pitchCos*BD,Math.sin(-controls.pitch)*BD+1.2,Math.cos(controls.yaw)*pitchCos*BD);
    }
    camera.position.set(player.pos.x+bk.x, eyeY+bk.y, player.pos.z+bk.z);
    camera.lookAt(player.pos.x, player.pos.y+1.2, player.pos.z);
    if(playerMesh3p){
      playerMesh3p.visible=true;
      // しゃがみ時: 本家のように体を低く前傾させる（わかりやすい視覚化）
      const crouchY = player.isCrouching ? -0.2 : 0;
      playerMesh3p.position.set(player.pos.x, player.pos.y+crouchY, player.pos.z);
      playerMesh3p.rotation.y=controls.yaw;

      // エモート再生中は専用ポーズを優先適用
      const emoteActive = player._emoteKey && _applyEmotePose(playerMesh3p, player._emoteKey, player._emoteStart);
      if(!emoteActive){
        player._emoteKey=null;
        const bodyPart=playerMesh3p.getObjectByName('body');
        if(bodyPart) bodyPart.rotation.x = player.isCrouching ? 0.35 : 0;
        const hd=playerMesh3p.getObjectByName('head');
        if(hd)hd.rotation.x=controls.pitch*0.8 + (player.isCrouching?0.15:0);
        const wt=(player._walkT=(player._walkT||0)+(hasInput?dt*(player.isSprinting?14:8):0));
        const sw=hasInput?Math.sin(wt)*0.6:0;
        const ra=playerMesh3p.getObjectByName('ra'),la=playerMesh3p.getObjectByName('la');
        const rl=playerMesh3p.getObjectByName('rl'),ll=playerMesh3p.getObjectByName('ll');
        if(ra)ra.rotation.x=-sw+(player.isCrouching?0.2:0);if(la)la.rotation.x=sw+(player.isCrouching?0.2:0);
        if(rl)rl.rotation.x=sw;if(ll)ll.rotation.x=-sw;
      }
    }
  } else {
    camera.position.set(player.pos.x+(Math.random()-.5)*shakeIntensity+bobX,
                        eyeY+(Math.random()-.5)*shakeIntensity+bobY, player.pos.z);
    camera.rotation.set(controls.pitch,controls.yaw,0,'YXZ');
    if(playerMesh3p)playerMesh3p.visible=false;
  }
  if(shakeIntensity>0){shakeIntensity-=dt*3.5;if(shakeIntensity<0)shakeIntensity=0;}
}

function updateCamera(dt){
  const baseFOV=currentSettings.fov||70;
  const dynamicFOV=currentSettings.dynamicFOV!==false;
  const targetFOV=dynamicFOV&&player.isSprinting&&player.onGround?Math.min(baseFOV+10,120):baseFOV;
  camera.fov+=(targetFOV-camera.fov)*Math.min(1,dt*8);
  camera.far=currentSettings.drawDist||150;
  camera.near=0.05;
  camera.updateProjectionMatrix();
}

// ================================================================
//  BLOCK MINING & PLACING
// ================================================================
const PLACEABLE=new Set(['wool_red','wool_blue','wool_green','wool_yellow','wood','cobblestone','log','end','dirt','grass','stone']);
let breakTarget=null, breakAcc=0;

// レイ生成ヘルパー（1人称・3人称共通・FOV非依存・常にcontrols基準）
function _makeAimRay(reach){
  const eyePos=new THREE.Vector3(player.pos.x,player.pos.y+1.6,player.pos.z);
  const dir=new THREE.Vector3(0,0,-1).applyEuler(new THREE.Euler(controls.pitch,controls.yaw,0,'YXZ'));
  const ray=new THREE.Raycaster();
  ray.set(eyePos,dir);
  ray.far=reach||6.0;
  return {ray,eyePos,dir};
}

function tryPlaceBlock(){
  if(Date.now()-lastPlaceTime<190)return;
  const s=player.inv[player.selectedIdx];
  if(!s||!s.type||s.count<=0)return;
  let btype=s.type;
  if(btype==='wool')btype=woolKey(player.team);
  if(!PLACEABLE.has(btype))return;
  const REACH=6.0;
  const {ray}=_makeAimRay(REACH);
  const hits=ray.intersectObjects(allBlocks(),false);
  const hit=hits.find(h=>h.distance<=REACH&&!h.object.userData.isBed);
  if(!hit)return;
  const px=Math.round(hit.point.x+hit.face.normal.x*0.5);
  const py=Math.round(hit.point.y+hit.face.normal.y*0.5);
  const pz=Math.round(hit.point.z+hit.face.normal.z*0.5);
  const PW=0.3,PH=1.8;
  if(px+0.5>player.pos.x-PW&&px-0.5<player.pos.x+PW&&
     py+0.5>player.pos.y&&py-0.5<player.pos.y+PH&&
     pz+0.5>player.pos.z-PW&&pz-0.5<player.pos.z+PW)return;
  if(blockMap.has(blockKey(px,py,pz)))return;
  addBlock(px,py,pz,btype);
  s.count--;if(s.count<=0){s.type=null;s.count=0;}
  if(gameMode==='multi'){sbRequest({action:'placeBlock',uid:myPeerId,x:px,y:py,z:pz,type:btype,team:player.team});}
  lastPlaceTime=Date.now();updateUI();_swingHand();
}

function mineBlock(dt){
  const prog=document.getElementById('break-progress');
  const REACH=6.0; // 採掘リーチ（設置と同じ固定値）
  const eyePos=new THREE.Vector3(player.pos.x, player.pos.y+1.6, player.pos.z);
  const dir=new THREE.Vector3(0,0,-1).applyEuler(new THREE.Euler(controls.pitch,controls.yaw,0,'YXZ'));
  const ray=new THREE.Raycaster();
  ray.set(eyePos, dir);
  ray.far=REACH;
  
  const all=allBlocks();
  const hits=ray.intersectObjects(all,true);
  const hit=hits.find(h=>h.distance<=REACH);
  let tgt=null;
  if(hit){
    tgt=hit.object;
    if(tgt.parent?.userData?.isBed)tgt=tgt.parent;
  }
  if(tgt&&!tgt.userData?.hardness&&!tgt.userData?.isBed)tgt=null;

  if(tgt!==breakTarget){breakTarget=tgt;breakAcc=0;}

  if(tgt){
    prog.style.display='block';
    let mul=1+(player.upgrades.haste?0.3:0);
    const s=player.inv[player.selectedIdx];
    if(s){
      if(s.type==='shears'&&tgt.userData.type?.startsWith('wool'))mul*=3.5;
      if(s.type==='pickaxe'&&(tgt.userData.type==='end'||tgt.userData.type==='stone'||tgt.userData.type==='cobblestone'))mul*=2.5;
      if(s.type==='iron_pickaxe'&&(tgt.userData.type==='end'||tgt.userData.type==='stone'||tgt.userData.type==='cobblestone'))mul*=3.8;
      if(s.type==='dia_pickaxe'&&(tgt.userData.type==='end'||tgt.userData.type==='stone'||tgt.userData.type==='cobblestone'))mul*=5.5;
      if(s.type==='axe'&&(tgt.userData.type==='log'||tgt.userData.type==='wood'))mul*=3;
    }
    breakAcc+=dt*mul;
    document.getElementById('break-bar').style.width=(Math.min(1,breakAcc/(tgt.userData.hardness||1))*100)+'%';
    if(breakAcc>=(tgt.userData.hardness||1)){
      if(tgt.userData.isBed){
        destroyBed(tgt);
      }else{
        let drop=tgt.userData.type;
        // Wool drops as same team wool (normalized)
        if(drop&&drop.startsWith('wool_'))drop=woolKey(player.team);
        // 土・草はドロップしない
        if(drop&&!['dirt','grass'].includes(drop)){
          spawnDrop(drop,tgt.position.clone());
        }
        spawnParticles(tgt.position.clone(),null,6);
        removeBlock(tgt);
      }
      breakTarget=null;breakAcc=0;prog.style.display='none';
    }
  }else{
    breakAcc=0;prog.style.display='none';
  }
}

function destroyBed(target){
  const team=target.userData.team;
  TEAM_BED_STATUS[team]=false;
  updateScoreboard();
  flashDamage();
  scene.background.setHex(0xffffff);
  setTimeout(()=>scene.background.setHSL(.58,.5,.55),200);
  spawnParticles(target.position?target.position.clone():new THREE.Vector3(),'#ff4444',12);
  announce('💥 BED DESTROYED!','#ff3333');
  if(team===player.team){player.hasBed=false;announce('⚠ YOUR BED DESTROYED!','#ff4444');}
  // Sync bed destruction if multiplayer
  if(gameMode==='multi'){
    sbRequest({action:'bedDestroyed',matchId:currentMatchId,uid:myPeerId,team:team,destroyedBy:player.name});
  }
  scene.remove(target);
  // unregBlock works for both Mesh and Group (uses position property)
  if(target.position)unregBlock(target);
  playerData.kills++;document.getElementById('hud-kills').textContent=playerData.kills;
  checkWin();
}

// ================================================================
//  PARTICLES
// ================================================================
const _pGeo=new THREE.BoxGeometry(.1,.1,.1);
function spawnParticles(pos,color,count=5){
  for(let i=0;i<count;i++){
    const c=color||['#888','#aaa','#666','#bbb'][i%4];
    const m=new THREE.Mesh(_pGeo,new THREE.MeshBasicMaterial({color:c}));
    m.position.copy(pos).add(new THREE.Vector3((Math.random()-.5)*.4,(Math.random()-.5)*.4,(Math.random()-.5)*.4));
    m.userData={vel:new THREE.Vector3((Math.random()-.5)*.12,Math.random()*.12+.04,(Math.random()-.5)*.12),life:.5};
    scene.add(m);particles.push(m);
  }
}
function updateParticles(dt){
  for(let i=particles.length-1;i>=0;i--){
    const p=particles[i];
    p.userData.vel.y+=GRAVITY*dt*.15;
    p.position.addScaledVector(p.userData.vel,dt*30);
    p.userData.life-=dt;
    if(p.userData.life<=0){scene.remove(p);particles.splice(i,1);}
  }
}

// ================================================================
//  AI — improved with gravity & real pathfinding
// ================================================================
function updateAI(dt){
  const TICK=0.05;
  enemies.forEach(e=>{
    if(!e.userData)return;
    const ud=e.userData;
    if(!ud.vel)ud.vel=new THREE.Vector3();
    ud.atkTimer=(ud.atkTimer||0)+dt;
    ud.walkPhase=(ud.walkPhase||0)+dt*8;
    ud.bridgeTimer=(ud.bridgeTimer||0)+dt;
    ud.buyTimer=(ud.buyTimer||0)+dt;
    ud.stateTimer=(ud.stateTimer||0)+dt;
    ud.iron=(ud.iron||0);
    ud.gold=(ud.gold||0);
    ud.strafeT=(ud.strafeT||0)+dt;

    // 重力(プレイヤーと同一のv10物理: GRAV=0.032、フレームレート非依存に統一)
    const aiScale=dt/TICK;
    ud.vel.y=Math.max(ud.vel.y-0.032*aiScale,-3.0);
    e.position.y+=ud.vel.y*aiScale;
    ud.onGround=false;

    // 地面当たり判定(AABB、X/Z独立判定でコーナーのすり抜けを軽減)
    for(const b of nearBlocks(e.position.x,e.position.y,e.position.z)){
      const bp=b.position;
      if(Math.abs(e.position.x-bp.x)<0.5&&Math.abs(e.position.z-bp.z)<0.5){
        if(ud.vel.y<=0&&e.position.y<bp.y+0.5&&e.position.y>=bp.y-0.5){
          e.position.y=bp.y+0.5;ud.vel.y=0;ud.onGround=true;
        } else if(ud.vel.y>0&&e.position.y+1.8>bp.y-0.5&&e.position.y+1.8<=bp.y+0.5){
          e.position.y=bp.y-0.5-1.8;ud.vel.y=0;
        }
      }
    }
    // 奈落: 自チームのスポーン地点へ正しく復帰（自滅バグ修正）
    if(e.position.y<-10){
      const sp=TEAM_SPAWN[ud.team]||{x:0,y:62,z:0};
      e.position.set(sp.x,sp.y+2,sp.z);
      ud.vel.set(0,0,0);
      ud.state='idle';ud.raidTarget=null; // 状態もリセットして再遭難を防ぐ
    }

    // AI購入ロジック(10秒ごと、段階的に強化・ウール優先で早期取得)
    if(ud.buyTimer>10){
      ud.buyTimer=0;
      // ウールを最優先で確保（橋渡しを早く可能にする）
      if(ud.gold>=2&&!ud.hasWool){ud.hasWool=true;ud.gold-=2;ud.woolStock=12;}
      if(ud.iron>=8&&!ud.hasSword){ud.hasSword=true;ud.iron-=8;ud.damage=(ud.damage||3)+4;}
      if(ud.gold>=7&&ud.hasSword&&!ud.hasIronSword){ud.hasIronSword=true;ud.gold-=7;ud.damage=(ud.damage||3)+3;}
      if(ud.iron>=6&&!ud.hasArmor){ud.hasArmor=true;ud.iron-=6;ud.maxHp=(ud.maxHp||20)+4;ud.hp=Math.min(ud.hp+4,ud.maxHp);}
      if(ud.iron>=8&&ud.hasArmor&&!ud.hasFullArmor){ud.hasFullArmor=true;ud.iron-=8;ud.maxHp=(ud.maxHp||20)+4;ud.hp=Math.min(ud.hp+4,ud.maxHp);}
      if(ud.emerald===undefined)ud.emerald=0;
      ud.emerald+=0.02;
      if(ud.emerald>=8&&!ud.hasGolem&&Math.random()<0.3){
        ud.hasGolem=true;ud.emerald-=8;
        const gp=e.position.clone();
        setTimeout(()=>{if(scene)spawnGolem(gp.x,gp.y+1,gp.z,ud.team);},500);
      }
      // ウール残量を継続補充（橋を架け続けられるように）
      if(ud.hasWool&&ud.gold>=2){ud.gold-=2;ud.woolStock=(ud.woolStock||0)+8;}
    }
    // HP低下時に回復ポーションを自己使用（緊急回復）
    if(ud.hp<(ud.maxHp||20)*0.3&&ud.gold>=5&&!ud._usedPotion&&Math.random()<0.02){
      ud._usedPotion=true;
      ud.hp=Math.min((ud.maxHp||20),ud.hp+6);
      ud.gold-=5;
      setTimeout(()=>{ud._usedPotion=false;},20000);
    }

    // ================================================================
    //  ベッド襲撃AI: 敵ベッドを積極的に狙い、橋を架けて突撃する
    // ================================================================
    ud.raidCheckTimer=(ud.raidCheckTimer||0)+dt;
    if(!ud.isGolem && ud.raidCheckTimer>3){
      ud.raidCheckTimer=0;
      // まだ襲撃中でなく、ウールを持っていれば一定確率で襲撃モードへ
      if(ud.state!=='raid' && ud.hasWool && !ud.isDead){
        const enemyTeams=(teamMode===2?['Red','Blue']:['Red','Blue','Green','Yellow']).filter(t=>t!==ud.team);
        const aliveTargets=enemyTeams.filter(t=>TEAM_BED_STATUS[t]);
        if(aliveTargets.length>0 && Math.random()<0.5){
          const targetTeam=aliveTargets[Math.floor(Math.random()*aliveTargets.length)];
          // 実際のベッドオブジェクトを検索して正確な座標を取得
          const actualBed=allBlocks().find(b=>b.userData?.isBed && b.userData.team===targetTeam);
          const tp=actualBed?actualBed.position:TEAM_ISLAND_POS[targetTeam];
          if(tp){
            ud.raidTarget=new THREE.Vector3(tp.x,tp.y+2,tp.z);
            ud.raidTeam=targetTeam;
            ud.state='raid';
            ud.stateTimer=0;
          }
        }
      }
    }

    // ターゲット決定
    let targetPos=player.pos.clone(),targetIsPlayer=true;
    if(ud.isGolem){
      let nearest=null,nd=999;
      enemies.forEach(oth=>{if(oth===e||!oth.userData||oth.userData.team===ud.team)return;
        const d=e.position.distanceTo(oth.position);if(d<nd){nd=d;nearest=oth;}});
      if(nearest){targetPos=nearest.position.clone();targetIsPlayer=false;}
    }
    let dist=e.position.distanceTo(targetPos);

    // 状態機械: idle→patrol→chase→combat→raid→retreat
    // raid中はプレイヤーが近くない限り維持
    const distToPlayer=e.position.distanceTo(player.pos);
    if(ud.state==='raid'){
      if(distToPlayer<4.5){ud.state='combat';targetPos=player.pos.clone();dist=distToPlayer;}
      else if(ud.stateTimer>45){ud.state='idle';ud.raidTarget=null;} // 長時間到達できなければ諦める
    } else {
      if(dist>60)ud.state='idle';
      else if(dist>30&&ud.hp>(ud.maxHp||20)*0.3)ud.state='patrol';
      else if(dist>4.0)ud.state='chase';
      else ud.state='combat';
      if(ud.hp<(ud.maxHp||20)*0.2&&dist<15)ud.state='retreat';
    }

    // ゴーレム特殊
    if(ud.isGolem&&ud.state==='combat'&&ud.atkTimer>1.0){
      ud.atkTimer=0;
      enemies.forEach(oth=>{
        if(oth===e||!oth.userData||oth.userData.team===ud.team)return;
        if(e.position.distanceTo(oth.position)<2.5){oth.userData.hp-=10;if(oth.userData.hp<=0)killEnemy(oth);}
      });
      return;
    }

    // 移動処理（combat中も間合い調整のため軽く動けるようにする）
    if(ud.state!=='idle'){
      let moveTarget=targetPos;
      if(ud.state==='raid'&&ud.raidTarget){
        moveTarget=ud.raidTarget;
      } else if(ud.state==='retreat'){
        // 退却: ターゲットから逆方向
        const away=new THREE.Vector3().subVectors(e.position,targetPos).normalize();
        moveTarget=e.position.clone().addScaledVector(away,5);
      } else if(ud.state==='patrol'){
        // パトロール: ベース周辺をランダムに動く
        if(!ud.patrolTarget||ud.stateTimer>5){
          ud.stateTimer=0;
          const spawnP=TEAM_SPAWN[ud.team]||{x:0,y:62,z:0};
          ud.patrolTarget=new THREE.Vector3(
            spawnP.x+(Math.random()-0.5)*8,
            spawnP.y,
            spawnP.z+(Math.random()-0.5)*8
          );
        }
        moveTarget=ud.patrolTarget;
      } else if(ud.state==='combat'){
        // combat中: 至近距離(1.8未満)なら少し離れ、離れすぎ(3.2超)なら詰める間合い管理
        const cd=e.position.distanceTo(moveTarget);
        if(cd>3.2){ /* そのまま接近方向へ移動許可 */ }
        else if(cd<1.6){
          // 近すぎる場合は少し下がる
          const away=new THREE.Vector3().subVectors(e.position,moveTarget).normalize();
          moveTarget=e.position.clone().addScaledVector(away,3);
        } else {
          // 適正距離: 円運動でストレイフしながら維持
          moveTarget=null;
        }
      }

      if(moveTarget){
      const dir=new THREE.Vector3().subVectors(moveTarget,e.position);
      dir.y=0;
      const dlen=dir.length();
      if(dlen>0.3){
        dir.divideScalar(dlen);
        const aheadNoGround = ud.state==='raid' && !blockMap.has(blockKey(
          Math.round(e.position.x+dir.x*0.9), Math.round(e.position.y-1), Math.round(e.position.z+dir.z*0.9)
        ));
        const spd=(ud.state==='retreat'?0.18:ud.state==='patrol'?0.08:ud.state==='raid'?(aheadNoGround?0.06:0.15):ud.state==='combat'?0.10:0.16)*dt/TICK;
        e.position.x+=dir.x*spd;
        e.position.z+=dir.z*spd;
        e.rotation.y=Math.atan2(dir.x,dir.z);

        // ジャンプ(障害物回避)
        if(ud.onGround){
          const ahead=new THREE.Vector3(e.position.x+dir.x,e.position.y,e.position.z+dir.z);
          for(const b of nearBlocks(ahead.x,ahead.y+0.5,ahead.z)){
            const bp=b.position;
            if(Math.abs(ahead.x-bp.x)<0.55&&Math.abs(ahead.z-bp.z)<0.55&&bp.y>=e.position.y){
              ud.vel.y=0.38;break;
            }
          }
        }

        // 橋架け: raid中は毎フレーム判定（インターバル制限なし、設置頻度のみレート制限）
        if(ud.hasWool && (ud.woolStock===undefined || ud.woolStock>0)){
          const placeRate = ud.state==='raid' ? 0.12 : 0.4;
          if(ud.bridgeTimer>placeRate){
            const checkX=Math.round(e.position.x+dir.x*0.9);
            const checkY=Math.round(e.position.y-1);
            const checkZ=Math.round(e.position.z+dir.z*0.9);
            const hasGroundAhead=blockMap.has(blockKey(checkX,checkY,checkZ));
            // 現在の足元もチェック（落下中の緊急キャッチ）
            const footX=Math.round(e.position.x), footY=Math.round(e.position.y-1), footZ=Math.round(e.position.z);
            const hasGroundUnder=blockMap.has(blockKey(footX,footY,footZ));
            const isFalling = ud.vel.y < -0.05 && !ud.onGround;

            if(ud.state==='raid'&&(!hasGroundAhead||(!hasGroundUnder&&isFalling))){
              ud.bridgeTimer=0;
              // 落下中なら足元を最優先で埋める
              if(!hasGroundUnder && isFalling && !blockMap.has(blockKey(footX,footY,footZ))){
                if(_bwCanPlaceGrounded(footX,footY,footZ)){addBlock(footX,footY,footZ,'wool_'+ud.team.toLowerCase(),true);}
                if(ud.woolStock)ud.woolStock--;
              } else if(!hasGroundAhead && !blockMap.has(blockKey(checkX,checkY,checkZ))){
                if(_bwCanPlaceGrounded(checkX,checkY,checkZ)){addBlock(checkX,checkY,checkZ,'wool_'+ud.team.toLowerCase(),true);}
                if(ud.woolStock)ud.woolStock--;
              }
            } else if(ud.state!=='raid' && ud.state!=='combat' && !hasGroundAhead){
              ud.bridgeTimer=0;
              if(!blockMap.has(blockKey(checkX,checkY,checkZ))){
                addBlock(checkX,checkY,checkZ,'wool_'+ud.team.toLowerCase(),true);
                if(ud.woolStock)ud.woolStock--;
              }
            }
          }
        }
      }
      }

      // raid中: 目標(敵ベース)に到達したらベッドを破壊
      if(ud.state==='raid'&&ud.raidTarget){
        const raidDist=e.position.distanceTo(ud.raidTarget);
        if(raidDist<4 && ud.raidTeam && TEAM_BED_STATUS[ud.raidTeam]){
          // 近くにあるベッドオブジェクトを探して破壊
          const bedBlocks=nearBlocks(ud.raidTarget.x,ud.raidTarget.y-3,ud.raidTarget.z)
            .concat(nearBlocks(e.position.x,e.position.y,e.position.z));
          const bedObj=bedBlocks.find(b=>b.userData?.isBed && b.userData.team===ud.raidTeam);
          if(bedObj){
            ud.bedAttackTimer=(ud.bedAttackTimer||0)+dt;
            if(ud.bedAttackTimer>2){ // 2秒かけて破壊
              destroyBed(bedObj);
              ud.state='idle';ud.raidTarget=null;ud.bedAttackTimer=0;
              announce(`🔨 ${ud.team}のAIが${ud.raidTeam}のベッドを破壊した！`,'#ff8800');
            }
          } else if(raidDist<8){
            // ベッドが見つからない場合は少し待って諦める
            ud.stateTimer+=dt*2;
          }
        }
      }

      // 常に敵の方を向く（combat中の追従含む）
      if(ud.state==='combat'){
        const lookDir=new THREE.Vector3().subVectors(targetPos,e.position);
        lookDir.y=0;
        if(lookDir.lengthSq()>0.01) e.rotation.y=Math.atan2(lookDir.x,lookDir.z);
      }

      // 歩行アニメーション
      if(ud.state!=='combat'||moveTarget){
        const sw=Math.sin(ud.walkPhase)*0.55;
        const ll=e.getObjectByName('ll'),rl=e.getObjectByName('rl');
        const la=e.getObjectByName('la'),ra=e.getObjectByName('ra');
        if(ll)ll.rotation.x=sw;if(rl)rl.rotation.x=-sw;
        if(la)la.rotation.x=-sw;if(ra)ra.rotation.x=sw;
      }
    }

    // 攻撃(combat) — 精度向上版: 発射時に距離を再検証、命中率アップ、間隔短縮
    if(ud.state==='combat'&&ud.atkTimer>0.55){
      const currentDist=e.position.distanceTo(player.pos);
      const ATTACK_REACH=3.4; // 実際の武器リーチと一致させ「攻撃しない」問題を解消
      if(currentDist<=ATTACK_REACH){
        ud.atkTimer=0;
        if(!ud.isGolem||ud.team!==player.team){
          // ストレイフ(横移動回避、命中率を保ちつつ回避行動)
          if(ud.strafeT>1.2){
            ud.strafeT=0;
            const perp=new THREE.Vector3(Math.cos(e.rotation.y),0,-Math.sin(e.rotation.y));
            const sd=(Math.random()<0.5?1:-1)*0.25*dt/TICK;
            e.position.x+=perp.x*sd;e.position.z+=perp.z*sd;
          }
          // クリティカル判定: プレイヤーが空中にいる時に狙いやすい
          const isCrit = player.vel && player.vel.y<-0.2;
          const dmg=(ud.damage||3)*(isCrit?1.5:1);
          applyDamage(dmg);
          // 攻撃モーション（腕を振る）
          const ra=e.getObjectByName('ra');
          if(ra){ra.rotation.x=-1.1;setTimeout(()=>{if(ra)ra.rotation.x=0;},150);}
        }
      } else {
        // 射程外だった場合はすぐ再試行できるよう短いクールダウンに留める
        ud.atkTimer=0.35;
      }
    }
  });
}

// ================================================================
//  DAMAGE / DEATH / RESPAWN
// ================================================================
function applyDamage(amount){
  if(player.respawnProtection>0)return; // Invulnerable during respawn protection
  const def=player.upgrades.protection?0.12:0;
  player.hp-=amount*(1-def);
  updateUI();shakeIntensity=.28;
  flashDamage();
  if(player.hp<=0&&!player.isDead)die();
}
// 奈落死: respawn無敵中でも確実に殺す（"落ちたまま戻れないバグ"の修正）
function applyVoidDeath(){
  player.hp=0;
  player.respawnProtection=0; // 無敵を強制解除
  updateUI();
  if(!player.isDead) die();
  else {
    // 既に死亡中に再度奈落へ落ちた場合は強制的にスポーンへ戻す
    const sp=TEAM_SPAWN[player.team];
    if(sp){player.pos.set(sp.x,sp.y+3,sp.z);player.vel.set(0,0,0);}
  }
}
function flashDamage(){
  const fl=document.getElementById('damage-flash');
  const vg=document.getElementById('damage-hit-vignette');
  fl.classList.add('active'); if(vg)vg.classList.add('active');
  clearTimeout(flashDamage._t);
  flashDamage._t=setTimeout(()=>{fl.classList.remove('active');if(vg)vg.classList.remove('active');},180);
}
// 死亡カウントダウンUI要素を確実に取得/生成
function _getDeathTimerEl(){
  let el=document.getElementById('death-countdown');
  if(!el){
    el=document.createElement('div');
    el.id='death-countdown';
    el.style.cssText='position:fixed;top:45%;left:50%;transform:translate(-50%,-50%);z-index:150;text-align:center;pointer-events:none;display:none';
    document.body.appendChild(el);
  }
  return el;
}

let _deathCountdownInterval=null;

function die(){
  player.isDead=true;
  if(activeMenu)toggleMenu(null);

  player.spectatorMode=true;
  player.spectatorTime=5;

  const sp=TEAM_SPAWN[player.team];
  if(sp) player.pos.set(sp.x,sp.y+10,sp.z);

  document.body.requestPointerLock();

  // カウントダウンUI開始
  const timerEl=_getDeathTimerEl();
  timerEl.style.display='block';
  let remain=5;
  timerEl.innerHTML='<div style="font-size:64px">⏳</div><div style="font-size:32px;color:#55ffff;font-weight:bold;text-shadow:2px 2px 4px #000">'+remain+'s</div>';

  if(_deathCountdownInterval) clearInterval(_deathCountdownInterval);
  _deathCountdownInterval=setInterval(()=>{
    remain--;
    if(remain<=0){
      clearInterval(_deathCountdownInterval);
      _deathCountdownInterval=null;
      timerEl.style.display='none';
      timerEl.innerHTML='';
      return;
    }
    timerEl.innerHTML='<div style="font-size:64px">⏳</div><div style="font-size:32px;color:#55ffff;font-weight:bold;text-shadow:2px 2px 4px #000">'+remain+'s</div>';
  },1000);

  if(!player.hasBed){
    setTimeout(()=>{
      _clearDeathTimer();
      player.spectatorMode=false;
      announce('💀 ELIMINATED!','#ff0000');
      playerData.level=Math.max(1,~~(playerData.kills/5)+1);
      bwStorage.set('bw_data',JSON.stringify(playerData));
      if(gameMode==='multi'){
        stopMultiplayerLoops();
        sbRequest({action:'leave',uid:myPeerId});
        setTimeout(()=>showEndScreen(null,false),3000);
      } else {
        setTimeout(()=>location.reload(),3000);
      }
    },5000);
  }else{
    setTimeout(()=>{respawn();},5000);
  }
}

// カウントダウンUIを確実にクリアする（バグ修正の要）
function _clearDeathTimer(){
  if(_deathCountdownInterval){clearInterval(_deathCountdownInterval);_deathCountdownInterval=null;}
  const el=document.getElementById('death-countdown');
  if(el){el.style.display='none';el.innerHTML='';}
}

function respawn(){
  _clearDeathTimer(); // ← スペクから戻る時に必ずクリア（表示残りバグ修正）
  player.isDead=false;
  player.spectatorMode=false;
  player.spectatorTime=0;
  player.hp=player.maxHp;
  player.hunger=20;
  player.respawnProtection=3;
  const sp=TEAM_SPAWN[player.team];
  player.pos.set(sp.x,sp.y,sp.z);
  player.vel.set(0,0,0);
  updateUI();
  document.body.requestPointerLock();
}
function announce(msg,color='#ff5555'){
  const el=document.getElementById('announcement');
  el.textContent=msg;el.style.color=color;el.style.display='block';
  clearTimeout(announce._t);announce._t=setTimeout(()=>el.style.display='none',2500);
}

// ================================================================
//  MAIN LOOP
// ================================================================
function animate(){
  requestAnimationFrame(animate);
  if(!scene)return;
  const dt=Math.min(clock.getDelta(),.05);
  gameTime+=dt;

  const skyL=Math.max(.28,.56-gameTime/1500);
  scene.background.setHSL(.58,.5,skyL);

  // v26追記: 影の投影範囲をプレイヤー周辺に追従させる
  if(window._bwUpdateSunShadowTarget && player?.pos) window._bwUpdateSunShadowTarget(player.pos.x,player.pos.z);

  if(!activeMenu&&(!player.isDead||player.spectatorMode)){
    physicsStep(dt);
    if(!player.spectatorMode){
      if(player.placing)tryPlaceBlock();
      if(player.mining)mineBlock(dt);
      if(player.bowCharge){
        player.bowChargeTime+=dt;
        if(player.bowChargeTime>1.5)player.bowChargeTime=1.5;
      }
    }
  }

  // Spawners
  npcs.forEach(n=>{
    if(!n.userData?.isSpawner)return;
    n.userData.lastSpawn+=dt;
    n.rotation.y+=dt*.5;
    const spd=gameTime>300?.55:1;
    const iv=(n.userData.type==='emerald'?45:(n.userData.type==='dia'?20:2.2))*spd;
    if(n.userData.lastSpawn>iv){
      n.userData.lastSpawn=0;
      let t=n.userData.type;
      if(t==='iron_gold')t=Math.random()>.3?'iron':'gold';
      spawnDrop(t,n.position.clone().add(new THREE.Vector3(0,1,0)));
    }
  });

  // NPC face player
  npcs.forEach(n=>{
    if(!n.userData?.isNPC)return;
    const d=new THREE.Vector3().subVectors(player.pos,n.position);
    if(d.length()<10)n.rotation.y=Math.atan2(d.x,d.z);
  });

  // v24: Drops have real local gravity instead of floating in mid-air.
  // Each client simulates the short fall locally; Supabase only syncs spawn/pickup state.
  for(let i=drops.length-1;i>=0;i--){
    const d=drops[i];
    const ud=d.userData||(d.userData={});
    if(ud.dropVy==null) ud.dropVy=0;
    if(ud.grounded==null) ud.grounded=false;
    if(!ud.grounded){
      ud.dropVy-=18*dt;
      d.position.y+=ud.dropVy*dt;
      const groundY=(typeof getGroundYAt==='function'?getGroundYAt(d.position.x,d.position.z):null);
      const fallbackY=ud.baseY||d.position.y;
      const gy=(Number.isFinite(groundY)?groundY+.24:fallbackY);
      if(d.position.y<=gy){d.position.y=gy;ud.dropVy=0;ud.grounded=true;}
    }else{
      // Gentle Minecraft-like item bob only after landing; never floats during the fall.
      ud.t=(ud.t||0)+dt;
      d.position.y+=(Math.sin(ud.t*2)*.018);
      const gy=(typeof getGroundYAt==='function'?getGroundYAt(d.position.x,d.position.z):null);
      if(Number.isFinite(gy)) d.position.y=gy+.24+Math.sin(ud.t*2)*.018;
    }
    d.rotation.y+=dt*1.8;
    if(!player.isDead&&d.position.distanceTo(player.pos)<1.4){
      let type=ud.type;
      if(type&&type.startsWith('wool_'))type=woolKey(player.team);
      addItem(type,ud.amount||1);
      if(ud.v22DropId&&window.supabaseClient){
        window.supabaseClient.from('bw_drops').update({state:'picked',picked_by:myPeerId,picked_at:new Date().toISOString()}).eq('drop_id',ud.v22DropId).then(()=>{});
      }
      scene.remove(d);drops.splice(i,1);
    }
  }

  // Labels
  floatingTexts.forEach(ft=>{
    const v=ft.pos.clone().project(camera);
    if(v.z>0&&v.z<1&&ft.pos.distanceTo(camera.position)<70){
      ft.el.style.display='block';
      ft.el.style.left=(v.x*.5+.5)*innerWidth+'px';
      ft.el.style.top=(v.y*-.5+.5)*innerHeight+'px';
      ft.el.style.opacity=Math.max(0,1-ft.pos.distanceTo(player.pos)/55);
    }else ft.el.style.display='none';
  });

  updateAI(dt);
  updateParticles(dt);
  if(Math.random()<.0012&&player.hunger>0){player.hunger=Math.max(0,player.hunger-.08);updateUI();}

  // MP meshes (lerp + 歩行アニメーション + エモート)
  if(gameMode==='multi'){
    for(const[uid,data]of Object.entries(mpPlayers)){
      const mesh=getOrCreateMPMesh(uid,TEAM_COLOR[data.team],data.name,data.skin);
      const prevPos=mesh.position.clone();
      mesh.position.lerp(new THREE.Vector3(+data.x,+data.y,+data.z),.25);
      // 移動量から歩行判定して腕脚を振る
      const moved=mesh.position.distanceTo(prevPos)>0.01;
      const emoteActive = mesh.userData._emoteKey && _applyEmotePose(mesh, mesh.userData._emoteKey, mesh.userData._emoteStart);
      if(!emoteActive){
        mesh.userData._emoteKey=null;
        mesh.userData._walkT=(mesh.userData._walkT||0)+(moved?dt*10:0);
        const sw=moved?Math.sin(mesh.userData._walkT)*0.6:0;
        const ra=mesh.getObjectByName('ra'),la=mesh.getObjectByName('la');
        const rl=mesh.getObjectByName('rl'),ll=mesh.getObjectByName('ll');
        if(ra)ra.rotation.x=-sw;if(la)la.rotation.x=sw;
        if(rl)rl.rotation.x=sw;if(ll)ll.rotation.x=-sw;
        // 移動方向を向く
        if(moved){
          const dir=new THREE.Vector3().subVectors(mesh.position,prevPos);
          if(dir.lengthSq()>0.0001) mesh.rotation.y=Math.atan2(dir.x,dir.z);
        }
      }
    }
    for(const uid of Object.keys(mpMeshes)){
      if(!mpPlayers[uid]){
        scene.remove(mpMeshes[uid]);
        // Remove label
        floatingTexts=floatingTexts.filter(ft=>{
          if(ft.el.textContent===mpMeshes[uid].userData.name){
            ft.el.remove();return false;
          }
          return true;
        });
        delete mpMeshes[uid];
      }
    }
  }

  updateArrows(dt);

  // Win check every 3 seconds
  if(Math.floor(gameTime)%3===0&&Math.floor(gameTime)!==animate._lastWinCheck){
    animate._lastWinCheck=Math.floor(gameTime);
    if(gameTime>10)checkWin();
  }

  window._bwRender ? window._bwRender(scene,camera) : renderer.render(scene,camera);
  // v7: 頭上ネームプレート更新
  if(gameMode==='multi') updateMPNameplates();
  // v9: 世界制限・手元アニメ・FPS・ミニマップ
  enforceWorldLimit();
  if(_handGroup) _animateHandBob(performance.now());
  // v11: ブロックプレビュー
  if(gameMode!=='lobby') updateBlockPreview();
  // 弓チャージバー更新
  if(_bowCharging&&_bowChargeEl){
    const pct=Math.min((Date.now()-_bowChargeStart)/2000*100,100);
    const fill=document.getElementById('bow-fill');
    const fill2=document.getElementById('bow-fill-v2');
    const pct2=document.getElementById('bow-percent-v2');
    const power2=document.getElementById('bow-power-v2');
    const oldPct=document.getElementById('bow-pct-old');
    const power=Math.round(4+(pct/100)*6);
    const col=pct>80?'#ff4444':pct>50?'#ffaa00':'#44ff44';
    if(fill){fill.style.width=pct+'%';fill.style.background=col;}
    if(fill2){fill2.style.width=pct+'%';fill2.style.background=col;}
    if(pct2)pct2.textContent=Math.round(pct)+'%';
    if(power2)power2.textContent='威力 '+power;
    if(oldPct)oldPct.textContent=Math.round(pct)+'% / 威力 '+power;
  }
  updateFPS();
  drawMinimap();
}
animate._lastWinCheck=-1;

// ================================================================
//  INVENTORY / SHOP
// ================================================================
// アイテム追加: ホットバー・メインインベントリ両方でスタック検索、空きに配置
function addItem(t,c){
  if(!t)return false;
  if(!player.mainInv) player.mainInv=Array(27).fill(null).map(()=>({type:null,count:0}));

  // ① 既存スタックを両方の領域から検索して加算
  let s=player.inv.find(x=>x.type===t);
  if(s){s.count+=c; updateUI(); if(typeof renderInvOverlay==='function'&&activeMenu==='inventory')renderInvOverlay(); return true;}
  s=player.mainInv.find(x=>x.type===t);
  if(s){s.count+=c; updateUI(); if(typeof renderInvOverlay==='function'&&activeMenu==='inventory')renderInvOverlay(); return true;}

  // ② 新規スタック: ホットバーの空きへ優先配置
  let e=player.inv.find(x=>!x.type);
  if(e){e.type=t;e.count=c; updateUI(); if(typeof renderInvOverlay==='function'&&activeMenu==='inventory')renderInvOverlay(); return true;}

  // ③ ホットバーが満杯ならメインインベントリの空きへ
  e=player.mainInv.find(x=>!x.type);
  if(e){e.type=t;e.count=c; updateUI(); if(typeof renderInvOverlay==='function'&&activeMenu==='inventory')renderInvOverlay(); return true;}

  // ④ 完全に満杯
  announce('⚠️ インベントリが満杯です！','#ff5555');
  return false;
}
function switchSlot(i){player.selectedIdx=i;updateUI();if(typeof _updateHandItem==='function')_updateHandItem();}

function updateUI(){
  // Player name display
  document.getElementById('hud-player-name').textContent=player.name;
  
  // HP display - 数字のみ
  const hpVal=Math.ceil(player.hp);
  const maxHpVal=Math.ceil(player.maxHp);
  document.getElementById('hp').textContent=hpVal;
  document.getElementById('hp-max').textContent=maxHpVal;
  
  // ホットバー上 HP/防御バー更新
  const hbHp=document.getElementById('hb-hp');
  const hbHpMax=document.getElementById('hb-hp-max');
  const hbArmor=document.getElementById('hb-armor');
  const hbLevel=document.getElementById('hb-level');
  if(hbHp) hbHp.textContent=hpVal;
  if(hbHpMax) hbHpMax.textContent=maxHpVal;
  if(hbArmor) hbArmor.textContent=player.armor||0;
  if(hbLevel) hbLevel.textContent=playerData.level||1;
  
  // Hunger display - 数字のみ
  const hungerVal=Math.ceil(player.hunger);
  document.getElementById('hunger').textContent=hungerVal;
  const diaCount=_sumResource('dia');
  document.getElementById('res-dia').textContent=diaCount;
  const emCount=_sumResource('emerald');
  document.getElementById('res-em').textContent=emCount;

  const wrap=document.getElementById('hotbar-wrap');
  wrap.innerHTML='';
  player.inv.forEach((s,i)=>{
    const div=document.createElement('div');
    div.className='hb-slot'+(i===player.selectedIdx?' active':'');
    if(s.type){
      div.innerHTML=itemIconHTML(s.type);
      const lbl=document.createElement('div');lbl.className='hb-lbl';
      lbl.textContent=ITEM_LABEL[s.type]||s.type.substring(0,6);
      div.appendChild(lbl);
      if(s.count>1){const cnt=document.createElement('div');cnt.className='hb-count';cnt.textContent=s.count;div.appendChild(cnt);}
    }
    wrap.appendChild(div);
  });

  let sm=[];
  if(player.isCrouching)sm.push('🦶SNEAK');
  if(player.isSprinting)sm.push('💨SPRINT');
  document.getElementById('status-msg').textContent=sm.join(' ');

  if(activeMenu==='inventory')renderInvOverlay();
}

function populateShop(cat){
  const grid=document.getElementById('shop-content');grid.innerHTML='';
  shopItems.filter(i=>i.cat===cat).forEach(i=>{
    const cc=i.costType==='gold'?'#ffcc44':(i.costType==='emerald'?'#55ff55':i.costType==='dia'?'#55eeff':'#eee');
    const d=document.createElement('div');d.className='btn-buy shop-card';
    d.innerHTML=`<div style="display:flex;align-items:center;gap:10px;flex:1">${itemIconHTML(i.type)}<span style="text-align:left">${i.name}</span></div>`+
      `<span style="color:${cc};font-weight:bold;white-space:nowrap">${i.cost} ${i.costType.toUpperCase()}</span>`;
    d.onclick=()=>buyItem(i.type,i.count,i.costType,i.cost);
    grid.appendChild(d);
  });
}
function populateUpgrades(){
  const grid=document.getElementById('upgrade-content');grid.innerHTML='';
  upgradeItems.forEach(u=>{
    const owned=player.upgrades[u.key];
    const d=document.createElement('div');d.className='btn-buy shop-card';
    d.style.opacity=owned?'0.5':'1';
    d.title=u.desc||'';
    d.innerHTML=`<div style="display:flex;align-items:center;gap:10px;flex:1"><div class="item-icon" style="background:linear-gradient(145deg,#66ccff,#2288cc)"><span class="item-icon-glyph">${u.emoji}</span></div><span style="text-align:left">${u.name}${owned?' ✓':''}</span></div>`+
      `<span style="color:#55eeff;font-weight:bold">${owned?'取得済み':u.cost+' 💎'}</span>`;
    if(!owned) d.onclick=()=>buyUpgrade(u.key,u.cost);
    grid.appendChild(d);
  });
}
// リソース(iron/gold/dia/emerald)をホットバー+メインインベントリ両方から検索
function _findResource(type){
  let s=player.inv.find(x=>x.type===type);
  if(s) return s;
  if(player.mainInv) return player.mainInv.find(x=>x.type===type);
  return null;
}
function _sumResource(type){
  let total=0;
  player.inv.forEach(x=>{if(x.type===type)total+=x.count;});
  if(player.mainInv) player.mainInv.forEach(x=>{if(x.type===type)total+=x.count;});
  return total;
}
function buyItem(t,a,ct,ca){
  let giveType=t;
  if(t==='wool')giveType=woolKey(player.team);
  const res=_findResource(ct);
  if(res&&res.count>=ca){
    res.count-=ca;
    if(res.count<=0){res.type=null;res.count=0;}
    addItem(giveType,a);
    announce(`✅ ${ITEM_LABEL[giveType]||giveType} x${a}`,'#55ff55');
  }
  else announce('❌ リソース不足！','#ff4444');
}
function buyUpgrade(key,cost){
  const res=_findResource('dia');
  if(res&&res.count>=cost){
    res.count-=cost;
    if(res.count<=0){res.type=null;res.count=0;}
    player.upgrades[key]=true;updateUI();
    const [label,color]=_labelUpgradeBuff(key);
    announce(`⬆ ${label} 取得！`,'#55ffff');
    _renderPermanentBuffs();
  }
  else announce('❌ ダイヤ不足！','#ff4444');
}

// 永続アップグレード（Sharp/Protection/Haste等）を常時アイコン表示
function _renderPermanentBuffs(){
  let wrap=document.getElementById('perm-buff-hud');
  if(!wrap){
    wrap=document.createElement('div');
    wrap.id='perm-buff-hud';
    wrap.style.cssText='position:fixed;top:70px;right:120px;display:flex;flex-direction:column;gap:4px;z-index:110';
    document.body.appendChild(wrap);
  }
  wrap.innerHTML='';
  Object.keys(player.upgrades||{}).forEach(key=>{
    if(!player.upgrades[key]) return;
    const [label,color]=_labelUpgradeBuff(key);
    const row=document.createElement('div');
    row.style.cssText=`display:flex;align-items:center;gap:6px;background:rgba(0,0,0,0.6);border-left:3px solid ${color};padding:3px 8px;border-radius:3px;font-size:11px;color:#fff`;
    row.innerHTML=`<span style="color:${color};font-weight:bold">${label}</span><span style="color:#888">∞</span>`;
    wrap.appendChild(row);
  });
}

function updateScoreboard(){
  const teams=teamMode===2?['Red','Blue']:['Red','Blue','Green','Yellow'];
  const el=document.getElementById('sb-entries');el.innerHTML='';
  teams.forEach(t=>{
    const div=document.createElement('div');div.className='sb-line';
    const status=TEAM_BED_STATUS[t];
    div.innerHTML=`<span style="color:${TEAM_COLOR_HEX[t]}">🛏 ${t}</span><span id="sb-${t.toLowerCase()}" style="color:${status?'#55ff55':'#ff5555'}">${status?'✓':'✗'}</span>`;
    el.appendChild(div);
  });
}

function toggleMenu(menu){
  activeMenu=menu;
  // v26追記: メニューを開く瞬間に直接リセット(pointerlockchangeイベント頼みにしない二重の安全策)
  if(menu){ player.mining=false; player.placing=false; }
  document.getElementById('win-shop').style.display=menu==='shop'?'block':'none';
  document.getElementById('win-upgrade').style.display=menu==='upgrade'?'block':'none';
  document.getElementById('win-inventory').style.display=menu==='inventory'?'block':'none';
  if(menu){document.exitPointerLock();if(menu==='inventory')renderInvOverlay();}
  else if(!player.isDead)document.body.requestPointerLock();
  if(typeof _syncRTAWithMenu==='function') _syncRTAWithMenu();
}

// ================================================================
//  INVENTORY UI
// ================================================================
function buildInvUI(){
  // Armor slots (cosmetic)
  const armorCol=document.getElementById('inv-armor-col');
  ['🪖','👕','👖','🥾'].forEach(em=>{
    const d=document.createElement('div');d.className='inv-slot';d.textContent=em;d.style.opacity='.45';
    armorCol.appendChild(d);
  });
  // Main grid (empty/decoration for BedWars)
  const mg=document.getElementById('inv-main');
  for(let i=0;i<27;i++){
    const d=document.createElement('div');d.className='inv-slot';d.style.opacity='.4';mg.appendChild(d);
  }
  // Hotbar grid
  const hg=document.getElementById('inv-hotbar');
  for(let i=0;i<9;i++){
    const d=document.createElement('div');d.className='inv-slot';d.dataset.hbIdx=i;
    d.addEventListener('click',()=>{switchSlot(i);});
    hg.appendChild(d);
  }
  // Inv model mouse follow
  const box=document.getElementById('inv-skin-box');
  const mdl=document.getElementById('inv-model');
  box.addEventListener('mousemove',e=>{
    const r=box.getBoundingClientRect();
    const dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2);
    let ry=Math.atan2(dx,110)*(180/Math.PI)+35;
    let rx=-Math.atan2(dy,110)*(180/Math.PI)-5;
    ry=Math.max(-45,Math.min(45,ry));rx=Math.max(-30,Math.min(20,rx));
    mdl.style.transform=`rotateY(${ry}deg) rotateX(${rx}deg)`;
  });
}

// ================================================================
//  インベントリ v8 完全版
//  - メイン27スロット（3行×9列）
//  - ホットバー9スロット
//  - 防具4スロット（頭/胴/脚/足）
//  - ドラッグ&ドロップ、右クリックで使用、ダブルクリックで装備
//  - ツールチップ表示
// ================================================================

// メインインベントリ（27スロット）とホットバー（9スロット）を分けて管理
// player.inv はホットバー(9)、player.mainInv はメイン(27)
if(!player.mainInv) player.mainInv = Array(27).fill(null).map(()=>({type:null,count:0}));
if(!player.armorSlots) player.armorSlots = {head:null, chest:null, legs:null, feet:null};

let _invDragFrom=null;
let _invTooltipEl=null;

// アイテム説明
const ITEM_DESC = {
  wool:'ブロックを設置できる。軽くて大量に持ち歩ける。',
  iron:'防具・武器の素材。ショップで交換できる。',
  gold:'ゴールドは高級アイテムと交換できる。',
  dia:'ダイヤモンドは最強装備と交換できる。',
  emerald:'エメラルドは超レアなトップアイテムと交換できる。',
  iron_sword:'鉄の剣。ダメージ+5。',
  dia_sword:'ダイヤの剣。ダメージ+8。最強の剣。',
  bow:'弓。Fキーで構えてチャージ、離して射る。',
  arrow:'弓の矢。弓がないと使えない。',
  pick:'ツルハシ。ブロック採掘速度+50%。',
  axe:'斧。木系ブロックの採掘速度+100%。',
  shears:'ハサミ。ウール系ブロックを一瞬で壊せる。',
  tnt:'TNT。設置すると3秒後に爆発。範囲ダメージ。',
  enderpearl:'エンダーパール。投げた先にテレポート。',
  fireb:'火の玉。投げると着火・ダメージ。',
  speed:'スピードポーション。5秒間移動速度+70%。',
  jump:'ジャンプポーション。10秒間ジャンプ+2倍。',
  invis:'透明化ポーション。15秒間透明になる。',
  hp_pot:'回復ポーション。HP+6回復。',
  bread:'パン。空腹を回復する（+3）。',
  steak:'ステーキ。空腹を大きく回復（+8）。',
  golden_apple:'金のリンゴ。HP+4、空腹+10回復。',
  helmet_iron:'鉄のヘルメット。防御+2。',
  chest_iron:'鉄のチェストプレート。防御+4。',
  legs_iron:'鉄のレギンス。防御+3。',
  boots_iron:'鉄のブーツ。防御+1。落下ダメージ軽減。',
  helmet_dia:'ダイヤのヘルメット。防御+3。',
  chest_dia:'ダイヤのチェストプレート。防御+6。',
  legs_dia:'ダイヤのレギンス。防御+5。',
  boots_dia:'ダイヤのブーツ。防御+2。落下ダメージ無効。',
  golem:'鉄ゴーレムの卵。召喚するとゴーレムがお供する。',
};

// 防具スロットの種別定義
const ARMOR_SLOTS_DEF = [
  {key:'head',  label:'頭',  accepts:['helmet_iron','helmet_dia'],    icon:'🪖'},
  {key:'chest', label:'胴体', accepts:['chest_iron','chest_dia'],     icon:'🦺'},
  {key:'legs',  label:'脚',  accepts:['legs_iron','legs_dia'],        icon:'👖'},
  {key:'feet',  label:'足',  accepts:['boots_iron','boots_dia'],      icon:'👟'},
];

// 防御力計算
const ARMOR_DEFENSE = {
  helmet_iron:2, chest_iron:4, legs_iron:3, boots_iron:1,
  helmet_dia:3,  chest_dia:6,  legs_dia:5,  boots_dia:2
};

function calcTotalArmor(){
  let total=0;
  Object.values(player.armorSlots||{}).forEach(item=>{
    if(item&&item.type) total+=ARMOR_DEFENSE[item.type]||0;
  });
  return total;
}

function renderInvOverlay(){
  // ---- ステータス更新 ----
  document.getElementById('inv-team').textContent=player.team;
  document.getElementById('inv-team').style.color=TEAM_COLOR_HEX[player.team]||'#fff';
  document.getElementById('inv-hp').textContent=Math.ceil(player.hp)+'/'+Math.ceil(player.maxHp);
  document.getElementById('inv-hunger').textContent=Math.ceil(player.hunger)+'/20';
  document.getElementById('inv-bed').textContent=player.hasBed?'✓ あり':'✗ なし';
  document.getElementById('inv-bed').style.color=player.hasBed?'#55ff55':'#ff5555';

  // ---- 防具スロット ----
  const armorCol=document.getElementById('inv-armor-col');
  armorCol.innerHTML='';
  ARMOR_SLOTS_DEF.forEach(def=>{
    const wrap=document.createElement('div');
    wrap.style.cssText='display:flex;align-items:center;gap:4px;margin-bottom:3px';
    const lbl=document.createElement('div');
    lbl.style.cssText='font-size:10px;color:#888;width:22px;text-align:right';
    lbl.textContent=def.icon;
    wrap.appendChild(lbl);

    const slot=document.createElement('div');
    slot.className='inv-slot';
    slot.style.cssText='width:36px;height:36px;position:relative';
    const equipped=player.armorSlots[def.key];
    if(equipped&&equipped.type){
      slot.innerHTML='<div style="display:flex;justify-content:center;padding-top:2px">'+itemIconHTML(equipped.type)+'</div>';
      _addTooltip(slot, equipped.type);
    } else {
      slot.style.opacity='0.4';
      slot.innerHTML='<div style="font-size:16px;line-height:36px;text-align:center;color:#444">'+def.icon+'</div>';
    }
    // クリックで外す
    slot.addEventListener('click',()=>{
      if(equipped&&equipped.type){
        // ホットバーの空きスロットに移す
        const empty=player.inv.findIndex(x=>!x.type);
        if(empty>=0){
          player.inv[empty]={...equipped};
          player.armorSlots[def.key]=null;
          player.armor=calcTotalArmor();
          renderInvOverlay();updateUI();
        }
      }
    });
    // ドロップ受付（対応する防具のみ）
    slot.addEventListener('dragover',e=>{e.preventDefault();});
    slot.addEventListener('drop',e=>{
      e.preventDefault();
      if(!_invDragFrom) return;
      const src=_getSlotItem(_invDragFrom);
      if(!src||!src.type) return;
      if(!def.accepts.includes(src.type)) return;
      // 装備
      const old={...player.armorSlots[def.key]};
      player.armorSlots[def.key]={...src};
      _setSlotItem(_invDragFrom, old.type?old:{type:null,count:0});
      _invDragFrom=null;
      player.armor=calcTotalArmor();
      renderInvOverlay();updateUI();
    });
    wrap.appendChild(slot);
    armorCol.appendChild(wrap);
  });
  // 防御力合計
  const totalArmor=calcTotalArmor();
  const armorInfo=document.createElement('div');
  armorInfo.style.cssText='font-size:11px;color:#55ffff;text-align:center;margin-top:4px';
  armorInfo.textContent='🛡 '+totalArmor;
  armorCol.appendChild(armorInfo);

  // ---- メインインベントリ（27スロット 3行×9列） ----
  const mg=document.getElementById('inv-main');
  mg.style.cssText='display:grid;grid-template-columns:repeat(9,40px);gap:3px;margin-bottom:6px';
  mg.innerHTML='';
  if(!player.mainInv) player.mainInv=Array(27).fill(null).map(()=>({type:null,count:0}));
  for(let i=0;i<27;i++){
    const item=player.mainInv[i]||{type:null,count:0};
    mg.appendChild(_makeInvSlot(item,'main',i,false));
  }

  // ---- ホットバー（9スロット） ----
  const hg=document.getElementById('inv-hotbar');
  hg.style.cssText='display:grid;grid-template-columns:repeat(9,40px);gap:3px';
  hg.innerHTML='';
  player.inv.forEach((item,i)=>{
    hg.appendChild(_makeInvSlot(item,'hb',i,i===player.selectedIdx));
  });

  // マルチ時のチームメイト情報（メインインベントリ下に追加）
  if(gameMode==='multi' && Object.keys(mpPlayers).length>0){
    const teamSection=document.createElement('div');
    teamSection.style.cssText='margin-top:8px;padding:6px;background:rgba(255,255,255,0.04);border-radius:4px;border:1px solid #333';
    teamSection.innerHTML='<div style="color:#ffff88;font-size:12px;margin-bottom:4px">🌐 チームメイト</div>';
    Object.values(mpPlayers).forEach(p=>{
      if(p.team!==player.team) return;
      const row=document.createElement('div');
      row.style.cssText='display:flex;align-items:center;gap:8px;padding:3px;font-size:12px';
      const tc=TEAM_COLOR_HEX[p.team]||'#fff';
      row.innerHTML='<span style="color:'+tc+';font-weight:bold">'+_bwEscapeHtml(p.name)+'</span>'+
        '<span style="color:#ff5555">❤'+Math.ceil(p.hp||0)+'</span>'+
        '<span style="color:#55ff55">'+(p.bed?'🛏あり':'💔なし')+'</span>';
      teamSection.appendChild(row);
    });
    mg.parentNode.insertBefore(teamSection, mg.nextSibling);
  }
}

// ヘルパー: スロットのアイテムを取得
function _getSlotItem(from){
  if(!from) return null;
  if(from.zone==='hb') return player.inv[from.idx];
  if(from.zone==='main') return player.mainInv[from.idx]||{type:null,count:0};
  return null;
}
// ヘルパー: スロットにアイテムをセット
function _setSlotItem(from, item){
  if(!from) return;
  if(from.zone==='hb') player.inv[from.idx]=item||{type:null,count:0};
  if(from.zone==='main') player.mainInv[from.idx]=item||{type:null,count:0};
}

// ツールチップ追加
function _addTooltip(el, type){
  el.addEventListener('mouseenter',e=>{
    _removeTooltip();
    const tip=document.createElement('div');
    tip.id='inv-tooltip';
    tip.style.cssText='position:fixed;z-index:9999;background:#1a1a1a;border:2px solid #555;border-radius:4px;padding:8px 12px;font-size:12px;color:#fff;max-width:200px;pointer-events:none;box-shadow:2px 2px 8px rgba(0,0,0,.8)';
    tip.innerHTML='<div style="color:#ffaa00;font-weight:bold;margin-bottom:4px">'+(ITEM_LABEL[type]||type)+'</div>'+
      '<div style="color:#ccc;font-size:11px">'+(ITEM_DESC[type]||'')+'</div>'+
      (ARMOR_DEFENSE[type]?'<div style="color:#55ffff;margin-top:4px">🛡 防御+'+ARMOR_DEFENSE[type]+'</div>':'');
    document.body.appendChild(tip);
    _invTooltipEl=tip;
    _moveTooltip(e);
  });
  el.addEventListener('mousemove',_moveTooltip);
  el.addEventListener('mouseleave',_removeTooltip);
}
function _moveTooltip(e){
  if(!_invTooltipEl) return;
  _invTooltipEl.style.left=(e.clientX+14)+'px';
  _invTooltipEl.style.top=(e.clientY+14)+'px';
}
function _removeTooltip(){
  if(_invTooltipEl){ _invTooltipEl.remove(); _invTooltipEl=null; }
}

function _makeInvSlot(item, zone, idx, isActive){
  const s=document.createElement('div');
  s.className='inv-slot'+(isActive?' inv-active':'');
  s.style.cssText='width:40px;height:40px;position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;user-select:none';
  s.dataset.zone=zone; s.dataset.idx=idx;
  s.draggable=!!(item&&item.type);

  if(item&&item.type){
    const iconWrap=document.createElement('div');
    iconWrap.style.cssText='pointer-events:none';
    iconWrap.innerHTML=itemIconHTML(item.type);
    s.appendChild(iconWrap);

    const lbl=document.createElement('div');
    lbl.style.cssText='font-size:9px;color:#ccc;text-align:center;overflow:hidden;max-width:38px;pointer-events:none;line-height:1.1;margin-top:1px';
    lbl.textContent=ITEM_LABEL[item.type]||item.type;
    s.appendChild(lbl);

    if(item.count>1){
      const cnt=document.createElement('span');
      cnt.className='inv-count';
      cnt.textContent=item.count;
      s.appendChild(cnt);
    }
    _addTooltip(s, item.type);
  }

  // 左クリック: ホットバーならスロット選択、メインなら使用/移動
  s.addEventListener('click',e=>{
    if(zone==='hb'){ switchSlot(idx); renderInvOverlay(); }
  });

  // 右クリック: アイテム使用
  s.addEventListener('contextmenu',e=>{
    e.preventDefault();
    if(!item||!item.type) return;
    const prevIdx=player.selectedIdx;
    if(zone==='hb') player.selectedIdx=idx;
    useItem();
    player.selectedIdx=prevIdx;
    renderInvOverlay();updateUI();
  });

  // ダブルクリック: 防具を自動装備
  s.addEventListener('dblclick',e=>{
    if(!item||!item.type) return;
    const def=ARMOR_SLOTS_DEF.find(d=>d.accepts.includes(item.type));
    if(def){
      const old={...player.armorSlots[def.key]};
      player.armorSlots[def.key]={...item};
      if(zone==='hb') player.inv[idx]=old.type?old:{type:null,count:0};
      else player.mainInv[idx]=old.type?old:{type:null,count:0};
      player.armor=calcTotalArmor();
      renderInvOverlay();updateUI();
    }
  });

  // ドラッグ
  s.addEventListener('dragstart',e=>{
    if(!item||!item.type){e.preventDefault();return;}
    _invDragFrom={zone,idx};
    e.dataTransfer.effectAllowed='move';
    s.style.opacity='0.45';
  });
  s.addEventListener('dragend',()=>{ s.style.opacity='1'; });
  s.addEventListener('dragover',e=>{e.preventDefault();e.dataTransfer.dropEffect='move';s.style.background='rgba(255,255,255,0.15)';});
  s.addEventListener('dragleave',()=>{ s.style.background=''; });
  s.addEventListener('drop',e=>{
    e.preventDefault();
    s.style.background='';
    if(!_invDragFrom||(_invDragFrom.zone===zone&&_invDragFrom.idx===idx)) return;
    const srcItem=_getSlotItem(_invDragFrom);
    const dstItem=_getSlotItem({zone,idx});
    // スタック可能な同種アイテムならまとめる
    if(srcItem&&dstItem&&srcItem.type&&srcItem.type===dstItem.type){
      dstItem.count+=srcItem.count;
      _setSlotItem(_invDragFrom,{type:null,count:0});
    } else {
      // スワップ
      _setSlotItem({zone,idx},{...srcItem});
      _setSlotItem(_invDragFrom,{...dstItem});
    }
    _invDragFrom=null;
    renderInvOverlay();updateUI();
  });
  return s;
}

// メインインベントリ ↔ ホットバー間の移動（Shift+クリック）
document.addEventListener('keydown',e=>{
  if(e.code==='ShiftLeft'||e.code==='ShiftRight') window._shiftHeld=true;
});
document.addEventListener('keyup',e=>{
  if(e.code==='ShiftLeft'||e.code==='ShiftRight') window._shiftHeld=false;
});


// ================================================================
//  MP MESH v7: 頭上ネームプレート(名前+HP数字)・スキン対応
// ================================================================
function getOrCreateMPMesh(uid,color,name,skinUrl){
  skinUrl=_bwSafeImageSource(skinUrl);
  if(mpMeshes[uid]){
    // v26修正: 後からskinUrlが届いた/変わった場合は正しいスキンで作り直す
    if(skinUrl && mpMeshes[uid].userData.skinUrl!==skinUrl){
      _rebuildMPMeshSkin(uid,color,name,skinUrl);
    }
    return mpMeshes[uid];
  }

  // v26修正: 以前は createSimplePlayerMesh(color) のみを呼び、imgOverrideを渡していなかった。
  // そのため内部で img=imgOverride||_skinImage||... となり「常に自分のスキン」が使われ、
  // 相手のスキンが一切反映されないバグになっていた。
  // ここではまず仮表示(色付きデフォルト)しつつ、正しいスキン画像が読み込めたら
  // createSimplePlayerMesh(color, img) で"リモートの画像を使って"作り直す。
  const g = createSimplePlayerMesh(color||0x8888ff, _getFallbackSkinImage());
  g.userData = {isMPPlayer:true, uid, name, skinUrl:'', hp:20};
  scene.add(g);
  mpMeshes[uid] = g;

  if(skinUrl) _rebuildMPMeshSkin(uid,color,name,skinUrl);

  return g;
}

// v26追記: リモートプレイヤーのスキン画像を実際に読み込んでから、
// 正しいUVクロップ処理(createSimplePlayerMesh)でメッシュを作り直す。
// (以前の applyMPSkin は生のスキン画像をパーツごとの事前クロップ済み
//  マテリアルへ丸ごと上書きしていたため、UVが合わず正しく表示できなかった)
function _rebuildMPMeshSkin(uid,color,name,skinUrl){
  const safe=_bwSafeImageSource(skinUrl);
  if(!safe) return;
  const img=new Image();
  img.crossOrigin='anonymous';
  img.onload=()=>{
    try{
      const old=mpMeshes[uid];
      if(!old) return; // その間に切断等でメッシュが消えていたら何もしない
      const hp=old.userData?.hp??20;
      const pos=old.position.clone(), rot=old.rotation.clone();
      if(old.parent) old.parent.remove(old);
      const g=createSimplePlayerMesh(color||0x8888ff, img);
      g.userData={isMPPlayer:true, uid, name, skinUrl:safe, hp};
      g.position.copy(pos); g.rotation.copy(rot);
      scene.add(g);
      mpMeshes[uid]=g;
    }catch(e){}
  };
  img.onerror=()=>{ /* 読み込み失敗時は仮メッシュのまま維持 */ };
  img.src=safe;
}

// 頭上ネームプレート更新（名前+HP数字）
function updateMPNameplates(){
  // 古いプレートを全削除
  document.querySelectorAll('.mp-nameplate-3d').forEach(e=>e.remove());

  Object.values(mpPlayers).forEach(p=>{
    const mesh = mpMeshes[p.uid];
    if(!mesh) return;

    // 3Dワールド座標をスクリーン座標に変換
    const pos = mesh.position.clone();
    pos.y += 2.5; // 頭の上
    pos.project(camera);

    const x = (pos.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-(pos.y) * 0.5 + 0.5) * window.innerHeight;

    // 画面外はスキップ
    if(pos.z > 1 || x < 0 || x > window.innerWidth) return;

    const el = document.createElement('div');
    el.className = 'mp-nameplate-3d';
    const tc = TEAM_COLOR_HEX[p.team]||'#fff';
    const hpNum = Math.ceil(p.hp||0);
    el.style.cssText = `position:fixed;left:${x}px;top:${y}px;transform:translate(-50%,-100%);pointer-events:none;z-index:60;text-align:center;white-space:nowrap`;
    el.innerHTML = `<div style="background:rgba(0,0,0,0.7);padding:1px 5px;border-radius:2px;font-size:11px;color:${tc};text-shadow:1px 1px 0 #000">${_bwEscapeHtml(p.name)}</div>`+
                   `<div style="background:rgba(0,0,0,0.5);padding:1px 4px;border-radius:2px;font-size:10px;color:#ff5555">❤${hpNum}</div>`;
    document.body.appendChild(el);
  });
}

// ================================================================
//  Supabase MULTIPLAYER v8 — 通信速度設定を取得
// ================================================================
function startSupabaseLobbyRealtime(){
  if(!window.supabaseClient) return;
  const sb=window.supabaseClient;
  const ch=sb.channel('bw-lobby-main').on('postgres_changes',{event:'*',schema:'public',table:'bw_lobby',filter:'lobby_id=eq.main'},()=>{ if(gameMode==='lobby') pollLobby(); }).subscribe();
  _supabaseRealtimeChannels.push(ch);
}

// === v22: リモートプレイヤー状態の視覚反映 ===
function _applyMPVisualState(p,mesh){
  if(!p||!mesh) return;
  mesh.userData.team=p.team||mesh.userData.team||'';
  mesh.userData.name=p.name||mesh.userData.name||'';
  mesh.userData.hp=Number.isFinite(+p.hp)?+p.hp:mesh.userData.hp;
  mesh.rotation.y=Number.isFinite(+p.yaw)?+p.yaw:mesh.rotation.y;
  mesh.userData.pitch=Number.isFinite(+p.pitch)?+p.pitch:0;
  mesh.userData.headYaw=Number.isFinite(+p.headYaw)?+p.headYaw:(mesh.userData.headYaw||0);
  mesh.userData.headPitch=Number.isFinite(+p.headPitch)?+p.headPitch:(mesh.userData.headPitch||0);
  mesh.userData.isSneaking=!!p.isSneaking;
  mesh.userData.isSprinting=!!p.isSprinting;
  mesh.userData.isJumping=!!p.isJumping;
  mesh.userData.heldItem=p.heldItem||'';
  mesh.userData.heldItemCount=+p.heldItemCount||0;
  mesh.userData.actionAnimation=p.actionAnimation||'';
  mesh.userData.attackAnimationUntil=+p.attackAnimationUntil||0;
  const head=mesh.getObjectByName('head');
  if(head){
    head.rotation.y=Number.isFinite(+p.headYaw)?(+p.headYaw-mesh.rotation.y):head.rotation.y;
    head.rotation.x=Number.isFinite(+p.headPitch)?(+p.headPitch):head.rotation.x;
  }
  const ra=mesh.getObjectByName('ra'),la=mesh.getObjectByName('la');
  if(ra&&p.attackAnimationUntil>Date.now()) ra.rotation.x=-1.1;
  if(la&&p.attackAnimationUntil>Date.now()) la.rotation.x=-0.8;
  if(p.heldItem) _updateMPHeldItem(mesh,p.heldItem);
}
function _updateMPHeldItem(mesh,type){
  if(!mesh||!type) return;
  let g=mesh.getObjectByName('mp-held-item');
  if(g){g.userData.type=type;return;}
  const colorMap={wool_red:0xcc4444,wool_blue:0x4444cc,wool_green:0x228822,wool_yellow:0xccaa00,stone:0x888888,wood:0xb8864a,end:0xddddaa,iron:0xcccccc,gold:0xffcc33,dia:0x55eeff,emerald:0x55ee88};
  g=new THREE.Group();g.name='mp-held-item';
  if(type.startsWith('wool_')||['stone','wood','end','iron','gold','dia','emerald'].includes(type)){
    const m=new THREE.Mesh(new THREE.BoxGeometry(.32,.32,.32),new THREE.MeshLambertMaterial({color:colorMap[type]||0xaaaaaa}));
    m.position.set(.32,-.55,-.15);g.add(m);
  }else if(type.includes('sword')){
    const m=new THREE.Mesh(new THREE.BoxGeometry(.08,.7,.12),new THREE.MeshLambertMaterial({color:type==='dia_sword'?0x55eeff:0xcccccc}));m.position.set(.28,-.5,-.1);m.rotation.z=-.25;g.add(m);
  }else if(type==='bow'){
    const m=new THREE.Mesh(new THREE.TorusGeometry(.22,.035,5,12,Math.PI),new THREE.MeshLambertMaterial({color:0x885522}));m.position.set(.28,-.45,-.1);m.rotation.z=Math.PI/2;g.add(m);
  }
  mesh.add(g);g.userData.type=type;
}
function _triggerRemoteAction(uid,action){
  const mesh=mpMeshes[uid]; if(!mesh)return;
  mesh.userData.actionAnimation=action;
  mesh.userData.actionAnimationUntil=Date.now()+180;
  const ra=mesh.getObjectByName('ra'),la=mesh.getObjectByName('la');
  if(ra)ra.rotation.x=-1.1;if(la)la.rotation.x=-.8;
  setTimeout(()=>{if(ra)ra.rotation.x=0;if(la)la.rotation.x=0;},180);
}

window.addEventListener('bw:players',e=>{
  const r=e.detail?.new||e.detail?.record; if(!r||r.uid===myPeerId)return;
  const p={uid:r.uid,name:r.name,team:r.team,x:+r.x,y:+r.y,z:+r.z,hp:+r.hp,maxHp:+(r.max_hp||20),bed:r.bed?1:0,skin:r.skin||'',state:r.state||'normal',
    yaw:+(r.yaw||0),pitch:+(r.pitch||0),headYaw:+(r.head_yaw||r.yaw||0),headPitch:+(r.head_pitch||r.pitch||0),isSneaking:!!r.is_sneaking,isSprinting:!!r.is_sprinting,isJumping:!!r.is_jumping,isFalling:!!r.is_falling,kills:r.kills||0,
    heldItem:r.held_item||'',heldItemCount:+(r.held_item_count||0),inventory:r.inventory||[],hotbar:r.hotbar||[],armor:r.armor||{},vx:+(r.velocity_x||0),vy:+(r.velocity_y||0),vz:+(r.velocity_z||0),actionAnimation:r.action_animation||'',actionAnimationUntil:+(r.action_animation_until||0),attackAnimationUntil:+(r.attack_animation_until||0),botProfile:r.bot_profile||'',botSkin:r.bot_skin||'',skinModel:r.skin_model||'classic'};
  mpPlayers[p.uid]=p; const mm=getOrCreateMPMesh(p.uid,TEAM_COLOR[p.team]||0x8888ff,p.name,p.skin); if(mm){_applyMPVisualState(p,mm);} window._applyMPPlayersResult?.({ok:true,players:Object.values(mpPlayers).concat([{uid:myPeerId,name:player.name,team:player.team,x:player.pos.x,y:player.pos.y,z:player.pos.z,hp:player.hp,bed:player.hasBed?1:0}])});
});
window.addEventListener('bw:action',e=>{const r=e.detail?.new||e.detail?.record;if(!r||r.uid===myPeerId)return;_triggerRemoteAction(r.uid,r.action_type||'action');});

window.addEventListener('bw:blocks',e=>{
  const p=e.detail||{}, r=p.new||p.record||p.old;
  if(!r) return;
  const key=blockKey(Math.round(+r.x),Math.round(+r.y),Math.round(+r.z));
  if(p.eventType==='DELETE' || r.action==='break' || !r.type){
    const arr=blockMap.get(key);
    if(arr) arr.slice().forEach(bl=>{scene.remove(bl);unregBlock(bl);});
    blockMap.delete(key);
    window._blockSyncSeenKeys?.delete(key);
    return;
  }
  if(!blockMap.has(key)){
    addBlock(+r.x,+r.y,+r.z,r.type,true);
  }
  window._blockSyncSeenKeys?.add(key);
});
window.addEventListener('bw:beds',e=>{const r=e.detail?.new||e.detail?.record;if(r?.team&&r.has_bed===false){TEAM_BED_STATUS[r.team]=false;updateScoreboard();}});
window.addEventListener('bw:chat',e=>{const r=e.detail?.new||e.detail?.record;if(!r||r.uid===myPeerId)return;if(r.scope==='team'&&r.team!==player.team)return;if(r.scope==='battle'&&r.team&&r.team!==player.team)return;showInGameChat(r.name,r.msg,false);});


window._bwApplyRemoteDamageEvent=function(r,source){
  if(!r || r.to_uid!==myPeerId) return false;
  const id=String(r.id||'');
  if(id && window._bwDamageSeen.has(id)) return false;
  if(id){
    window._bwDamageSeen.add(id);
    setTimeout(()=>window._bwDamageSeen.delete(id),30000);
  }
  const amount=Number(r.amount)||0;
  if(amount<=0) return false;
  window._bwLastHitDebug=`damage受信 from=${String(r.from_uid||'').slice(0,8)} amount=${amount.toFixed(1)} via=${source||'unknown'}`;
  applyDamage(amount);
  return true;
};

window._bwDamageSeen = window._bwDamageSeen || new Set();
window.addEventListener('bw:damage',e=>{
  const r=e.detail?.new||e.detail?.record;
  window._bwApplyRemoteDamageEvent(r,'realtime');
});

function stopMultiplayerLoops(){
  window._bwMultiplayerStopped=true;
  [mpSyncInterval, ...(window._bwMultiplayerIntervals||[])].forEach(id=>{ if(id) clearInterval(id); });
  mpSyncInterval=null;
  window._bwMultiplayerIntervals=[];
  try{ if(typeof stopSupabaseRealtime==='function') stopSupabaseRealtime(); }catch(e){}
  try{
    if(window.__v22DropChannel && window.supabaseClient) window.supabaseClient.removeChannel(window.__v22DropChannel);
  }catch(e){}
  window.__v22DropChannel=null;
}

async function startMultiplayer(){
  window._bwMultiplayerStopped=false;
  const currentSkin=_bwSafeImageSource(skinUrl||playerSkin||bwStorage.get('bw_skin'))||'';
  await sbRequest({action:'join',uid:myPeerId,name:player.name,team:player.team,skin:currentSkin});
  startSupabaseRealtime();
  if(typeof _v22StartDropRealtime==='function') _v22StartDropRealtime();

  // Supabase の bw_settings から通信速度を取得してから各ループを起動
  sbRequest({action:'getSettings'}).then(cfg=>{
    const s=cfg&&cfg.settings||{};
    const syncMs  = s.syncInterval  || 480;
    const blockMs = s.blockInterval || 800;
    const bedMs   = s.bedInterval   || 2000;
    const dmgMs   = s.dmgInterval   || 500;
    const chatMs  = s.chatInterval  || 3000;

    // ① プレイヤー位置・HP同期
    //    座標は1ブロック単位（整数）に丸め、変化した時だけ書き込み(sync)。
    //    変化なし時は書き込みなしの軽量ポーリング(pollPlayers)のみ実行して負荷を削減。
    let _lastSyncPos={x:null,y:null,z:null,hp:null,bed:null,_t:0};

    function _applyPlayersResult(res){
      if(!res||!res.ok||!Array.isArray(res.players)) return;
      mpPlayers={};
      res.players.forEach(p=>{
        if(p.uid===myPeerId) return;
        mpPlayers[p.uid]=p;
        const mm=getOrCreateMPMesh(p.uid,TEAM_COLOR[p.team]||0x8888ff,p.name,p.skin);
        if(mm){mm.position.set(p.x,p.y,p.z);_applyMPVisualState(p,mm);}
        if((p.bed===0||p.bed==='0')&&TEAM_BED_STATUS[p.team]){
          TEAM_BED_STATUS[p.team]=false;
          updateScoreboard();
          announce(`💔 ${p.team}のベッドが破壊されました！`,'#ffaa00');
        }
      });
      const pDiv=document.getElementById('mp-players');
      if(pDiv){
        pDiv.innerHTML='';
        res.players.forEach(p=>{
          const sp=document.createElement('span');sp.className='mp-player';
          const tc=TEAM_COLOR_HEX[p.team]||'#fff';
          sp.style.borderColor=tc;
          const hp=Math.ceil(p.hp||0);
          const bedIcon=p.bed===0?'💔':'🛏';
          sp.innerHTML=`<span style="color:${tc};font-weight:bold">${_bwEscapeHtml(p.name)}</span> <span style="color:#ff5555">❤${hp}</span> ${bedIcon}`;
          pDiv.appendChild(sp);
        });
        const stEl=document.getElementById('mp-status');
        if(stEl) stEl.textContent=`🌐 ${res.players.length}人`;
      }
    }
    window._applyMPPlayersResult=_applyPlayersResult;
    window._lastMPVisualUpdate=performance.now();

    mpSyncInterval=setInterval(async()=>{
      if(window._bwMultiplayerStopped) return;
      // 1ブロック単位（整数）に丸める
      const rx=Math.round(player.pos.x), ry=Math.round(player.pos.y), rz=Math.round(player.pos.z);
      const rhp=Math.ceil(player.hp), rbed=player.hasBed?1:0;
      const changed = rx!==_lastSyncPos.x || ry!==_lastSyncPos.y || rz!==_lastSyncPos.z ||
                      rhp!==_lastSyncPos.hp || rbed!==_lastSyncPos.bed;
      const forceSync = (Date.now()-_lastSyncPos._t) > 12000; // 12秒毎に強制書込(TTL維持)

      if(changed || forceSync){
        _lastSyncPos={x:rx,y:ry,z:rz,hp:rhp,bed:rbed,_t:Date.now()};
        const res=await sbRequest({action:'sync',uid:myPeerId,name:player.name,team:player.team,
          x:player.pos.x,y:player.pos.y,z:player.pos.z,hp:player.hp,bed:rbed,skin:(skinUrl||playerSkin||''),state:player.isDead?'dead':(player.spectatorMode?'spectator':'normal'),
          yaw:controls.yaw,pitch:controls.pitch,headYaw:controls.yaw,headPitch:controls.pitch,isSneaking:!!player.isCrouching,isSprinting:!!player.isSprinting,isJumping:!!(!player.onGround&&player.vel.y>0),isFalling:!!(!player.onGround&&player.vel.y<0),kills:playerData.kills||0,
          maxHp:player.maxHp||20,heldItem:player.inv[player.selectedIdx]?.type||'',heldItemCount:player.inv[player.selectedIdx]?.count||0,inventory:player.inv||[],hotbar:player.inv||[],armor:player.armor||{},vx:player.vel.x,vy:player.vel.y,vz:player.vel.z,
          actionAnimation:player.placing?'place':player.mining?'mine':'',actionAnimationUntil:0,attackAnimationUntil:window._attackAnimationUntil||0,skinModel:'classic'});
        _applyPlayersResult(res);
      } else {
        // 軽量ポーリング（書込みなし）で他プレイヤーの動きだけ受信
        const res=await sbRequest({action:'pollPlayers'});
        _applyPlayersResult(res);
      }
    }, syncMs);

    // ② ブロック同期（全件取得 + 差分更新）
    window._blockSyncSeenKeys=new Set();
    const _blockSyncSeenKeysRef=window._blockSyncSeenKeys;
    // 初回: 全ブロックを一括取得
    sbRequest({action:'getBlocks'}).then(res=>{
      if(!res||!res.ok||!Array.isArray(res.blocks)) return;
      res.blocks.forEach(b=>{
        if(!b) return;
        const key=blockKey(Math.round(parseFloat(b.x)),Math.round(parseFloat(b.y)),Math.round(parseFloat(b.z)));
        if(b.action==='break'||!b.type){
          const arr=blockMap.get(key); if(arr) arr.slice().forEach(bl=>{scene.remove(bl);unregBlock(bl);});
          _blockSyncSeenKeys.delete(key); return;
        }
        _blockSyncSeenKeys.add(key);
        if(!blockMap.has(key)) addBlock(parseFloat(b.x),parseFloat(b.y),parseFloat(b.z),b.type,true);
      });
    });
    const blockSyncInterval=setInterval(async()=>{
      const res=await sbRequest({action:'getBlocks'});
      if(!res||!res.ok||!Array.isArray(res.blocks)) return;
      // 新規ブロックのみ追加
      res.blocks.forEach(b=>{
        if(!b) return;
        const key=blockKey(Math.round(parseFloat(b.x)),Math.round(parseFloat(b.y)),Math.round(parseFloat(b.z)));
        if(b.action==='break'||!b.type){
          const arr=blockMap.get(key); if(arr) arr.slice().forEach(bl=>{scene.remove(bl);unregBlock(bl);});
          _blockSyncSeenKeys.delete(key); return;
        }
        if(b.uid===myPeerId) return;
        if(!_blockSyncSeenKeys.has(key)){
          _blockSyncSeenKeys.add(key);
          if(!blockMap.has(key)) addBlock(parseFloat(b.x),parseFloat(b.y),parseFloat(b.z),b.type,true);
        }
      });
      // 消えたブロックを削除
      const serverKeys=new Set(res.blocks.filter(b=>b&&b.type).map(b=>
        blockKey(Math.round(parseFloat(b.x)),Math.round(parseFloat(b.y)),Math.round(parseFloat(b.z)))
      ));
      _blockSyncSeenKeys.forEach(k=>{
        if(!serverKeys.has(k)&&blockMap.has(k)){
          const blks=blockMap.get(k);
          if(blks) blks.forEach(bl=>scene.remove(bl));
          blockMap.delete(k);
          _blockSyncSeenKeys.delete(k);
        }
      });
    }, blockMs);

    // ③ ベッド状態同期（hasBed 管理）
    const bedSyncInterval=setInterval(async()=>{
      const res=await sbRequest({action:'getBeds',matchId:currentMatchId});
      if(!res||!res.ok||!Array.isArray(res.destroyed)) return;
      res.destroyed.forEach(b=>{
        if(b.team&&TEAM_BED_STATUS[b.team]){
          TEAM_BED_STATUS[b.team]=false;
          updateScoreboard();
          announce(`💔 ${b.team}のベッドが破壊されました！`,'#ffaa00');
        }
      });
    }, bedMs);

    // ④ ダメージ受信（ダメージ種別付き）
    const dmgInterval=setInterval(async()=>{
      if(player.isDead||player.spectatorMode) return;
      const res=await sbRequest({action:'getDamage',matchId:currentMatchId,uid:myPeerId});
      if(res&&res.ok&&Array.isArray(res.events)){
        let pending=0;
        res.events.forEach(ev=>{
          const id=String(ev.id||'');
          if(id && window._bwDamageSeen.has(id)) return;
          if(id){window._bwDamageSeen.add(id);setTimeout(()=>window._bwDamageSeen.delete(id),30000);}
          pending += Number(ev.amount)||0;
        });
        if(pending>0) applyDamage(pending);
      }else if(res&&res.ok&&res.damage>0){
        applyDamage(res.damage);
      }
    }, dmgMs);

    // ⑤ チャット受信（scope完全分離・連鎖防止）
    const _chatSeenTs=new Set(); // 表示済みtsを管理
    let _chatLastPollTs='';
    const chatSyncInterval=setInterval(async()=>{
      const chatScope2=gameMode==='lobby'?'lobby':gameMode==='multi'?'battle':'battle';
      const res=await sbRequest({action:'getMsgs',scope:chatScope2,team:player.team,matchId:currentMatchId});
      if(!res||!res.ok||!Array.isArray(res.msgs)||res.msgs.length===0) return;
      res.msgs.forEach(m=>{
        const ts=String(m.ts||'');
        if(!ts||_chatSeenTs.has(ts)) return; // 既に表示済み
        _chatSeenTs.add(ts);
        setTimeout(()=>_chatSeenTs.delete(ts), 30000); // 30秒後に忘れる
        if(m.name===player.name) return; // 自分の発言は sendChat で表示済み
        // エモートメッセージの特別処理（key|emoji形式でボディポーズも適用）
        if(m.msg&&m.msg.startsWith('__EMOTE__')){
          const payload=m.msg.replace('__EMOTE__','');
          const [ekey,eemoji]=payload.includes('|')?payload.split('|'):[null,payload];
          showEmoteBubble(m.name, eemoji||payload, false);
          // 送信者のuidを名前から逆引きしてメッシュにポーズ適用
          if(ekey){
            const senderUid=Object.keys(mpPlayers).find(u=>mpPlayers[u].name===m.name);
            if(senderUid && mpMeshes[senderUid]){
              mpMeshes[senderUid].userData._emoteKey=ekey;
              mpMeshes[senderUid].userData._emoteStart=Date.now();
            }
          }
          return;
        }
        // スコープフィルタ
        const scope=m.scope||'all';
        if(scope==='lobby') return; // ゲーム中はロビーチャット無視
        if(scope==='team' && m.team && m.team!==player.team) return;
        const prefix=scope==='team'?'[チーム] ':'';
        showInGameChat(m.name, prefix+m.msg, false);
      });
    }, chatMs);

    window._bwMultiplayerIntervals=[blockSyncInterval,bedSyncInterval,dmgInterval,chatSyncInterval];

    // クリーンアップ
    window.addEventListener('beforeunload',()=>{
      try{ sbRequest({action:'leave',uid:myPeerId}); }catch(e){}
      stopMultiplayerLoops();
    });
  });
}

// ゲーム内チャット表示（5秒で消える、重複防止）
const _shownChatMsgs=new Set();
function showInGameChat(name,msg,isOwn=false){
  const overlay=document.getElementById('chat-overlay');
  if(!overlay) return;
  const key=name+':'+msg;
  if(!isOwn && _shownChatMsgs.has(key)) return; // 重複スキップ
  _shownChatMsgs.add(key);
  setTimeout(()=>_shownChatMsgs.delete(key), 8000);
  const div=document.createElement('div');
  div.className='chat-msg';
  const teamColor=isOwn?'#ffff88':'#ffffff';
  div.innerHTML=`<span style="color:${teamColor};font-weight:bold">${_bwEscapeHtml(name)}:</span> ${_bwEscapeHtml(msg)}`;
  overlay.appendChild(div);
  overlay.style.display='block';
  // 最大10件まで
  while(overlay.children.length>10) overlay.removeChild(overlay.firstChild);
  overlay.scrollTop=overlay.scrollHeight;
  setTimeout(()=>{div.remove();if(overlay.children.length===0)overlay.style.display='none';},5000);
}

// チャット入力表示
function showChatInput(){
  const box=document.getElementById('chat-input-box');
  if(!box) return;
  box.style.display='block';
  const input=document.getElementById('chat-input');
  if(input){input.value='';input.focus();}
}

// チャット送信 - 重複防止
let _lastSentMsg='';
let _lastSentTime=0;
// チャットスコープ: 'all'=全体, 'team'=チーム, 'lobby'=ロビー
let _chatScope='all';

async function sendChat(){
  const input=document.getElementById('chat-input');
  if(!input) return;
  const msg=input.value.trim();
  if(!msg) return;
  const now=Date.now();
  if(msg===_lastSentMsg && now-_lastSentTime<2000){
    closeChatInput(); return;
  }
  _lastSentMsg=msg; _lastSentTime=now;
  input.value='';
  closeChatInput();

  const scope=_chatScope;
  const color=TEAM_COLOR_HEX[player.team]||'#ffffff';
  const scopeLabel={'lobby':'[ロビー]','team':'[チーム]','battle':'[全体]','post':'[終了後]'};
  const prefix=scopeLabel[scope]||'[全体]';
  const displayMsg=prefix+' '+msg;

  // Supabase v9スコープ別送信
  const gasScope=scope==='lobby'?'lobby':scope==='team'?'battle':scope==='post'?'post':'battle';
  await sbRequest({action:'postMsg',name:player.name,msg:displayMsg,color,pcId:myPeerId,
    matchId:gasScope==='lobby'?null:currentMatchId,scope:gasScope,team:(scope==='team')?player.team:''});
  showInGameChat(player.name+'(自)', displayMsg, true);
}

function openChatInput(scope='all'){
  _chatScope=scope;
  const box=document.getElementById('chat-input-box');
  const label=document.getElementById('chat-scope-label');
  const scopeText={all:'全体へ',team:'チームへ',lobby:'ロビーへ'};
  if(label) label.textContent=scopeText[scope]||'全体へ';
  if(!box) return;
  box.style.display='block';
  const input=document.getElementById('chat-input');
  if(input){input.value='';input.focus();}
}
function closeChatInput(){
  const box=document.getElementById('chat-input-box');
  if(box) box.style.display='none';
}
// ================================================================
//  Supabase 通信システム v18
//  sbRequest(data) のインターフェースは既存コードと完全互換のまま維持し、
//  通信先はSupabase JSクライアントに統一。
//  ※ 呼び出し側のゲームロジックはそのまま利用。
// ================================================================
let _supabaseLastError=null;

// TTL(生存判定): この秒数以内にlast_seenが更新されていればアクティブ扱い
const SB_LOBBY_TTL_SEC=30;
const SB_PLAYER_TTL_SEC=15;

function _sbNowIso(){ return new Date().toISOString(); }
function _sbActiveSince(sec){ return new Date(Date.now()-sec*1000).toISOString(); }

async function sbRequest(data){
  if(!window.supabaseClient){
    _supabaseLastError=null;
    _setSupabaseStatus('Supabase: オフライン','#888');
    _hideSupabaseErrorBanner();
    return null;
  }
  if(gameMode==='training_bridge'||gameMode==='training_parkour') return {ok:true,local:true};
  if(window.__BW_AUTH_READY){ try{ await window.__BW_AUTH_READY; }catch(e){} }
  const sb=window.supabaseClient;
  const d={...data};
  const localUid=window.__BW_LOCAL_PEER_ID;
  if(localUid && localUid!==myPeerId){
    ['uid','from','pcId'].forEach(key=>{ if(d[key]===localUid) d[key]=myPeerId; });
  }
  const matchActions=['join','sync','pollPlayers','placeBlock','getBlocks','destroyBlock','clearBlocks','clearMatch','bedDestroyed','getBeds','clearBeds','damage','getDamage','clearDamage','actionEvent'];
  if(matchActions.includes(d.action) && currentMatchId) d.matchId=currentMatchId;
  try{
    let result=null;
    switch(d.action){
      case 'lobbyJoin': {
        const {error}=await sb.rpc('bw_claim_lobby_host',{p_lobby_id:'main',p_name:String(d.name||'Player').slice(0,64)});
        if(error) throw error;
        result=await _sbLobbyPoll(sb,d); break;
      }
      case 'lobbyPoll': {
        const {error}=await sb.rpc('bw_lobby_poll',{p_lobby_id:'main'}); if(error) throw error;
        result=await _sbLobbyPoll(sb,d); break;
      }
      case 'lobbySpectator': {
        const {error}=await sb.rpc('bw_lobby_spectator',{p_lobby_id:'main'}); if(error) throw error; result={ok:true}; break;
      }
      case 'startGame': {
        const {data:startData,error:he}=await sb.rpc('bw_start_match',{
          p_lobby_id:'main',
          p_team_mode:d.teamMode||2,
          p_map_theme:d.mapTheme||'grassland',
          p_assignments:d.assignments||{}
        });
        if(he) throw he;
        const matchId=startData?.matchId;
        const seed=Number(startData?.mapSeed)||0;
        if(!matchId){ result={ok:false,error:'match_create_failed'}; break; }
        currentMatchId=matchId; currentMapSeed=seed; window.dispatchEvent(new CustomEvent('bw:match-ready',{detail:{matchId}})); result={ok:true,matchId,mapSeed:seed}; break;
      }
      case 'lobbyLeave': {
        const {error}=await sb.rpc('bw_leave_lobby',{p_lobby_id:'main'}); if(error) throw error;
        result={ok:true}; break;
      }
      case 'setTeamMode': { const {error}=await sb.rpc('bw_set_team_mode',{p_lobby_id:'main',p_mode:d.mode}); if(error) throw error; result={ok:true}; break; }
      case 'join': {
        if(!d.matchId) { result={ok:false,error:'match_required'}; break; }
        const {error:je}=await sb.from('bw_players').upsert({match_id:d.matchId,uid:d.uid,name:String(d.name||'P').slice(0,64),team:d.team||'Blue',x:0,y:65,z:0,hp:20,max_hp:20,bed:true,alive:true,state:'normal',is_sneaking:false,is_sprinting:false,is_jumping:false,kills:0,last_seen:_sbNowIso(),skin:d.skin||''},{onConflict:'match_id,uid'}); if(je) throw je; result={ok:true}; break;
      }
      case 'sync': {
        const upd={match_id:d.matchId,uid:d.uid,name:String(d.name||'P').slice(0,64),team:d.team||'Blue',x:d.x??0,y:d.y??65,z:d.z??0,hp:d.hp??20,max_hp:d.maxHp??20,bed:!!d.bed,last_seen:_sbNowIso(),
          yaw:d.yaw??0,pitch:d.pitch??0,head_yaw:d.headYaw??(d.yaw??0),head_pitch:d.headPitch??(d.pitch??0),
          is_sneaking:!!d.isSneaking,is_sprinting:!!d.isSprinting,is_jumping:!!d.isJumping,is_falling:!!d.isFalling,
          state:d.state||'normal',kills:d.kills??0,held_item:d.heldItem||'',held_item_count:d.heldItemCount??0,
          inventory:d.inventory||[],hotbar:d.hotbar||[],armor:d.armor||{},velocity_x:d.vx??0,velocity_y:d.vy??0,velocity_z:d.vz??0,
          action_animation:d.actionAnimation||'',action_animation_until:d.actionAnimationUntil??0,attack_animation_until:d.attackAnimationUntil??0,
          bot_profile:d.botProfile||'',bot_skin:d.botSkin||'',skin_model:d.skinModel||'classic'};
        if(d.skin) upd.skin=d.skin;
        const {error:se}=await sb.from('bw_players').upsert(upd,{onConflict:'match_id,uid'}); if(se) throw se;
        result=await _getMatchPlayers(sb,d.matchId); break;
      }
      case 'pollPlayers': result=await _getMatchPlayers(sb,d.matchId); break;
      case 'leave': {
        if(d.matchId){ const {error:pe}=await sb.from('bw_players').delete().eq('match_id',d.matchId).eq('uid',d.uid); if(pe) throw pe; }
        const {error:le}=await sb.rpc('bw_leave_lobby',{p_lobby_id:'main'}); if(le) throw le;
        result={ok:true}; break;
      }
      case 'clearMatch': {
        if(!d.matchId){ result={ok:false,error:'match_required'}; break; }
        const {data,error}=await sb.rpc('bw_clear_match',{p_match_id:d.matchId}); if(error) throw error;
        result={ok:!!data}; break;
      }
      case 'placeBlock': { const rx=Math.round(d.x),ry=Math.round(d.y),rz=Math.round(d.z); const {error:be}=await sb.from('bw_blocks').upsert({match_id:d.matchId,x:rx,y:ry,z:rz,type:d.type||'',team:d.team||'',uid:d.uid||'',action:'place',ts:_sbNowIso()},{onConflict:'match_id,x,y,z'}); if(be) throw be; result={ok:true}; break; }
      case 'getBlocks': { const {data:rows,error}=await sb.from('bw_blocks').select('*').eq('match_id',d.matchId); if(error) throw error; result={ok:true,blocks:(rows||[]).map(r=>({x:+r.x,y:+r.y,z:+r.z,type:r.type,team:r.team,uid:r.uid,action:r.action})),count:(rows||[]).length}; break; }
      case 'destroyBlock': { const rx=Math.round(d.x),ry=Math.round(d.y),rz=Math.round(d.z); const {error:be}=await sb.from('bw_blocks').upsert({match_id:d.matchId,x:rx,y:ry,z:rz,type:'',team:d.team||'',uid:d.uid||'',action:'break',ts:_sbNowIso()},{onConflict:'match_id,x,y,z'}); if(be) throw be; result={ok:true}; break; }
      case 'clearBlocks': { const {error:be}=await sb.from('bw_blocks').delete().eq('match_id',d.matchId); if(be) throw be; result={ok:true}; break; }
      case 'bedDestroyed': { const {error:be}=await sb.from('bw_beds').upsert({match_id:d.matchId,team:d.team,has_bed:false,destroyed_by:d.destroyedBy||'',uid:d.uid||'',destroyed_at:_sbNowIso(),ts:_sbNowIso()},{onConflict:'match_id,team'}); if(be) throw be; result={ok:true,team:d.team,hasBed:false}; break; }
      case 'getBeds': { const {data:rows,error}=await sb.from('bw_beds').select('*').eq('match_id',d.matchId).eq('has_bed',false); if(error) throw error; result={ok:true,destroyed:(rows||[]).map(r=>({team:r.team,destroyedBy:r.destroyed_by})),count:(rows||[]).length}; break; }
      case 'clearBeds': { const {error:be}=await sb.from('bw_beds').delete().eq('match_id',d.matchId); if(be) throw be; result={ok:true}; break; }
      case 'postMsg': { const {error:ce}=await sb.from('bw_chat').insert({lobby_id:'main',match_id:d.matchId||null,scope:d.scope||'battle',team:d.team||'',uid:d.uid||d.pcId||'',name:String(d.name||'Player').slice(0,64),msg:String(d.msg||'').slice(0,300),color:d.color||'#ffffff',pc_id:d.pcId||'',ts:_sbNowIso()}); if(ce) throw ce; result={ok:true}; break; }
      case 'getMsgs': { let q=sb.from('bw_chat').select('*').eq('lobby_id','main').eq('scope',d.scope||'battle').order('ts',{ascending:true}).limit(80); q=d.scope==='lobby'?q.is('match_id',null):d.matchId?q.eq('match_id',d.matchId):q; const {data:rows,error}=await q; if(error) throw error; result={ok:true,msgs:(rows||[]).map(r=>({ts:r.ts,name:r.name,msg:r.msg,color:r.color,pcId:r.pc_id,scope:r.scope,team:r.team||''})),count:(rows||[]).length}; break; }
      case 'clearBattleChat': { let q=sb.from('bw_chat').delete().eq('lobby_id','main'); if(d.matchId) q=q.eq('match_id',d.matchId); else q=q.in('scope',['battle','post']); await q; result={ok:true}; break; }
      case 'damage': { const {error:de}=await sb.from('bw_damage').insert({match_id:d.matchId,to_uid:d.to,from_uid:d.from,amount:+d.amount||0,type:d.type||'melee',ts:_sbNowIso()}); if(de) throw de; result={ok:true}; break; }
      case 'getDamage': {
        const {data:rows,error}=await sb.from('bw_damage').select('*').eq('match_id',d.matchId).eq('to_uid',d.uid).order('ts',{ascending:true}).limit(50);
        if(error) throw error;
        if(rows?.length){
          await Promise.all(rows.map(r=>sb.from('bw_damage').delete().eq('id',r.id)));
        }
        result={ok:true,damage:(rows||[]).reduce((a,r)=>a+(+r.amount||0),0),events:(rows||[]).map(r=>({id:r.id,from:r.from_uid,amount:+r.amount,type:r.type}))};
        break;
      }
      case 'clearDamage': { const {error:de}=await sb.from('bw_damage').delete().eq('match_id',d.matchId); if(de) throw de; result={ok:true}; break; }
      case 'actionEvent': { const {error:ae}=await sb.from('bw_action_events').insert({match_id:d.matchId,uid:d.uid,action_type:d.actionType||'action',item_type:d.itemType||'',x:d.x??null,y:d.y??null,z:d.z??null,yaw:d.yaw??null,pitch:d.pitch??null,payload:d.payload||{},created_at:_sbNowIso()}); if(ae) throw ae; result={ok:true}; break; }
      case 'updateHistory': {
        const {data:e,error:ee}=await sb.from('bw_history').select('*').eq('uid',d.uid).maybeSingle(); if(ee) throw ee;
        const cap=(value,max)=>Math.min(max,Math.max(0,Math.floor(Number(value)||0)));
        const kills=Math.max(cap(e?.kills,10000000),cap(d.kills,10000000));
        const wins=Math.max(cap(e?.wins,1000000),cap(d.wins,1000000));
        const level=Math.max(1,Math.min(100000,Math.floor(Number(d.level)||Number(e?.level)||1)));
        const skin=_bwSafeImageSource(d.skin)||e?.skin||'';
        const payload={uid:d.uid,name:String(d.name||'Player').slice(0,64),kills,wins,level,skin,last_match_id:d.matchId||null,last_seen:_sbNowIso()};
        const {error:he2}=await sb.from('bw_history').upsert(payload,{onConflict:'uid'}); if(he2) throw he2; result={ok:true}; break;
      }
      case 'getHistory': { const {data:rows,error}=await sb.from('bw_history').select('*').order('kills',{ascending:false}).limit(50); if(error) throw error; result={ok:true,history:(rows||[]).map(r=>({uid:r.uid,name:r.name,kills:r.kills||0,wins:r.wins||0,level:r.level||1,skin:r.skin||''})),count:(rows||[]).length}; break; }
      case 'addFriend': { if(d.uid===d.targetUid){result={ok:false,error:'cannot add yourself'};break;} const {error:fe}=await sb.from('bw_friends').upsert({uid:d.uid,target_uid:d.targetUid,target_name:String(d.targetName||'').slice(0,64),status:'accepted',ts:_sbNowIso()},{onConflict:'uid,target_uid'}); if(fe) throw fe; result={ok:true,msg:'フレンド追加成功！'}; break; }
      case 'removeFriend': { const {error:fe}=await sb.from('bw_friends').delete().eq('uid',d.uid).eq('target_uid',d.targetUid); if(fe) throw fe; result={ok:true}; break; }
      case 'getFriends': { const {data:rows,error}=await sb.from('bw_friends').select('*').eq('uid',d.uid).eq('status','accepted'); if(error) throw error; const friends=(rows||[]).map(r=>({uid:r.target_uid,name:r.target_name})); result={ok:true,friends}; break; }
      case 'searchPlayers': { const kw=(d.keyword||'').replace(/[%_]/g,''); if(!kw){result={ok:false,error:'keyword too short'};break;} const {data:rows,error}=await sb.from('bw_history').select('*').ilike('name','%'+kw+'%').neq('uid',d.uid).limit(10); if(error) throw error; result={ok:true,results:(rows||[]).map(r=>({uid:r.uid,name:r.name,kills:r.kills||0,level:r.level||1,skin:r.skin||''}))}; break; }
      case 'getSettings': { const {data:rows,error}=await sb.from('bw_settings').select('*'); if(error) throw error; const cfg={syncInterval:480,blockInterval:800,bedInterval:2000,dmgInterval:500,chatInterval:3000}; (rows||[]).forEach(r=>{const v=parseInt(r.value);if(!isNaN(v))cfg[r.key]=v;}); result={ok:true,settings:cfg}; break; }
      case 'testPing': result={ok:true,ts:_sbNowIso()}; break;
      default: result={ok:false,error:'unknown action: '+d.action};
    }
    _supabaseLastError=null; _hideSupabaseErrorBanner(); _setSupabaseStatus('Supabase: 接続OK','#55ff55'); return result;
  }catch(e){ _supabaseLastError=`Supabase通信エラー: ${e.message}`; _setSupabaseStatus('Supabase: 通信エラー','#ff5555'); _showSupabaseErrorBanner(_supabaseLastError); console.error(e); return null; }
}
async function _getMatchPlayers(sb,matchId){
  if(!matchId) return {ok:true,players:[],count:0};
  const {data:rows,error}=await sb.from('bw_players').select('*').eq('match_id',matchId).gte('last_seen',_sbActiveSince(SB_PLAYER_TTL_SEC));
  if(error) throw error;
  return {ok:true,players:(rows||[]).map(r=>({uid:r.uid,name:r.name,team:r.team,x:+r.x,y:+r.y,z:+r.z,hp:+r.hp,maxHp:+(r.max_hp||20),bed:r.bed?1:0,skin:r.skin||'',state:r.state||'normal',
      yaw:+(r.yaw||0),pitch:+(r.pitch||0),headYaw:+(r.head_yaw||r.yaw||0),headPitch:+(r.head_pitch||r.pitch||0),
      isSneaking:!!r.is_sneaking,isSprinting:!!r.is_sprinting,isJumping:!!r.is_jumping,isFalling:!!r.is_falling,kills:r.kills||0,
      heldItem:r.held_item||'',heldItemCount:+(r.held_item_count||0),inventory:r.inventory||[],hotbar:r.hotbar||[],armor:r.armor||{},
      vx:+(r.velocity_x||0),vy:+(r.velocity_y||0),vz:+(r.velocity_z||0),actionAnimation:r.action_animation||'',actionAnimationUntil:+(r.action_animation_until||0),attackAnimationUntil:+(r.attack_animation_until||0),botProfile:r.bot_profile||'',botSkin:r.bot_skin||'',skinModel:r.skin_model||'classic'})),count:(rows||[]).length};
}
async function _sbLobbyPoll(sb,data){
  const {data:rows,error}=await sb.from('bw_lobby').select('*').eq('lobby_id','main').gte('last_seen',_sbActiveSince(SB_LOBBY_TTL_SEC)).order('joined_at',{ascending:true});
  if(error) throw error;
  const hostRow=rows.find(r=>r.is_host)||rows[0];
  const teamMode=hostRow?.team_mode||2, gameStarted=!!hostRow?.game_started, mapTheme=hostRow?.map_theme||'grassland', assignments=hostRow?.assignments||{};
  const players=rows.filter(r=>!r.is_spectator).map((r,i)=>({uid:r.uid,name:r.name,isHost:!!r.is_host,team:assignments[r.uid]||(teamMode===2?['Blue','Red']:['Blue','Red','Green','Yellow'])[i%(teamMode===2?2:4)]}));
  const spectators=rows.filter(r=>r.is_spectator).map(r=>({uid:r.uid,name:r.name}));
  if(hostRow?.match_id) currentMatchId=hostRow.match_id;
  if(gameStarted && hostRow?.match_id){ const m=await sb.from('bw_matches').select('map_seed').eq('match_id',hostRow.match_id).maybeSingle(); if(m.error) throw m.error; if(m.data?.map_seed!=null) currentMapSeed=Number(m.data.map_seed); }
  return {ok:true,players,spectators,teamMode,gameStarted,assignments,mapTheme,matchId:hostRow?.match_id||null,mapSeed:currentMapSeed,settings:{syncInterval:480,blockInterval:800,bedInterval:2000,dmgInterval:500,chatInterval:3000}};
}

function stopSupabaseRealtime(){ _supabaseRealtimeChannels.forEach(ch=>{try{window.supabaseClient?.removeChannel(ch)}catch(e){}}); _supabaseRealtimeChannels=[]; }
function startSupabaseRealtime(){
  if(!window.supabaseClient||!currentMatchId||gameMode!=='multi') return;
  stopSupabaseRealtime(); const sb=window.supabaseClient;
  const report=(name)=>(status)=>{
    if(status==='SUBSCRIBED'){ _setSupabaseStatus('Supabase Realtime: '+name+' 接続OK','#55ff55'); }
    else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'){ _setSupabaseStatus('Supabase Realtime: '+name+' エラー','#ff5555'); console.warn('[Realtime]',name,status); }
  };
  const playersCh=sb.channel('bw-players-'+currentMatchId).on('postgres_changes',{event:'*',schema:'public',table:'bw_players',filter:'match_id=eq.'+currentMatchId},payload=>{ window.dispatchEvent(new CustomEvent('bw:players',{detail:payload})); }).subscribe(report('players'));
  const actionsCh=sb.channel('bw-actions-'+currentMatchId).on('postgres_changes',{event:'INSERT',schema:'public',table:'bw_action_events',filter:'match_id=eq.'+currentMatchId},payload=>{ window.dispatchEvent(new CustomEvent('bw:action',{detail:payload})); }).subscribe(report('actions'));
  const blocksCh=sb.channel('bw-blocks-'+currentMatchId).on('postgres_changes',{event:'*',schema:'public',table:'bw_blocks',filter:'match_id=eq.'+currentMatchId},payload=>{ window.dispatchEvent(new CustomEvent('bw:blocks',{detail:payload})); }).subscribe(report('blocks'));
  const bedsCh=sb.channel('bw-beds-'+currentMatchId).on('postgres_changes',{event:'*',schema:'public',table:'bw_beds',filter:'match_id=eq.'+currentMatchId},payload=>{ window.dispatchEvent(new CustomEvent('bw:beds',{detail:payload})); }).subscribe(report('beds'));
  const chatCh=sb.channel('bw-chat-'+currentMatchId).on('postgres_changes',{event:'INSERT',schema:'public',table:'bw_chat',filter:'match_id=eq.'+currentMatchId},payload=>{ window.dispatchEvent(new CustomEvent('bw:chat',{detail:payload})); }).subscribe(report('chat'));
  const lobbyChatCh=sb.channel('bw-chat-lobby').on('postgres_changes',{event:'INSERT',schema:'public',table:'bw_chat',filter:'lobby_id=eq.main'},payload=>{ window.dispatchEvent(new CustomEvent('bw:chat',{detail:payload})); }).subscribe(report('lobby-chat'));
  const damageCh=sb.channel('bw-damage-'+currentMatchId).on('postgres_changes',{event:'INSERT',schema:'public',table:'bw_damage',filter:'match_id=eq.'+currentMatchId},payload=>{ window.dispatchEvent(new CustomEvent('bw:damage',{detail:payload})); }).subscribe(report('damage'));
  _supabaseRealtimeChannels=[playersCh,actionsCh,blocksCh,bedsCh,chatCh,lobbyChatCh,damageCh];
}

// Supabase接続エラーをUIに表示（"オンライン対戦できない"原因の可視化）
function _showSupabaseErrorBanner(msg){
  let el=document.getElementById('supabase-error-banner');
  if(!el){
    el=document.createElement('div');
    el.id='supabase-error-banner';
    el.style.cssText='position:fixed;top:0;left:0;width:100%;background:#cc2222;color:#fff;padding:8px 16px;font-size:13px;z-index:9999;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.5)';
    document.body.appendChild(el);
  }
  el.innerHTML=`⚠️ Supabase接続エラー: ${_bwEscapeHtml(msg)}<br><small>Supabase URL / publishable key / Table / RLS Policy を確認してください</small>`;
  el.style.display='block';
}
function _hideSupabaseErrorBanner(){
  const el=document.getElementById('supabase-error-banner');
  if(el) el.style.display='none';
}
async function sendDamageSupabase(uid,amount,type='melee'){
  await sbRequest({action:'damage',matchId:currentMatchId,from:myPeerId,to:uid,amount,type});
}

// ================================================================
//  LOBBY SYSTEM
// ================================================================
let lobbyInterval=null,currentTeamMode=2;

// ロビーから抜けて選択画面(タイトル)に戻る（"抜け出せなくなるバグ"の修正）
async function leaveLobbyToTitle(){
  if(lobbyInterval){clearInterval(lobbyInterval);lobbyInterval=null;}
  stopMultiplayerLoops();
  try{ await sbRequest({action:'lobbyLeave',uid:myPeerId}); }catch(e){}
  player.isSpectator=false;
  document.getElementById('host-controls').style.display='none';
  document.getElementById('guest-controls').style.display='none';
  document.getElementById('lobby-status').textContent='モードを選んでください';
  const listEl=document.getElementById('player-list');
  if(listEl) listEl.innerHTML='<div style="color:#666;font-size:18px">ここに参加者が表示されます</div>';
}

async function joinLobby(){
  const name=document.getElementById('player-name').value.trim()||'Player';
  player.name=name;playerName=name;
bwStorage.set('bw_name',name);
  document.getElementById('lobby-status').textContent='接続中...';

  const wantSpectator = document.getElementById('join-as-spectator-check')?.checked || false;

  const res=await sbRequest({action:'lobbyJoin',uid:myPeerId,name});
  if(!res){
    // オンライン対戦はSupabase接続失敗時にローカルへ切り替えない
    document.getElementById('lobby-status').textContent='Supabaseに接続できませんでした';
    return;
  }

  // チェックが入っていれば即座に観戦者登録
  if(wantSpectator){
    await sbRequest({action:'lobbySpectator',uid:myPeerId});
    player.isSpectator=true;
    document.getElementById('lobby-status').textContent='👁️ 観戦者として参加しました！';
  } else {
    document.getElementById('lobby-status').textContent='ロビーに参加しました！';
  }
  if(lobbyInterval)clearInterval(lobbyInterval);
  lobbyInterval=setInterval(pollLobby,1500);
  pollLobby(); // Call immediately and display buttons
}

async function pollLobby(){
  const res=await sbRequest({action:'lobbyPoll',uid:myPeerId});
  if(!res||!res.players)return;

  if(res.teamMode) currentTeamMode=res.teamMode;

  const listEl=document.getElementById('player-list');listEl.innerHTML='';
  let iAmHost=false;
  // 観戦者を除外して表示
  const activePlayers=(res.players||[]).filter(p=>!p.isSpectator);
  activePlayers.forEach((p,i)=>{
    const div=document.createElement('div');div.className='player-entry';
    const isMe=p.uid===myPeerId;
    const isH=!!p.isHost;
    if(isMe&&isH) iAmHost=true;
    const tc=TEAM_COLOR_HEX[p.team]||'#fff';
    div.style.color=isMe?'#ffff88':'#ddd';
    div.innerHTML=`<span style="color:${tc}">■</span> ${_bwEscapeHtml(p.name)}${isH?' 👑':''}${isMe?' (YOU)':''}`;
    listEl.appendChild(div);
  });

  isHost=iAmHost;
  document.getElementById('host-controls').style.display=iAmHost?'block':'none';
  document.getElementById('guest-controls').style.display=iAmHost?'none':'block';
  document.getElementById('btn-2team').style.outline=currentTeamMode===2?'3px solid #ffff00':'';
  document.getElementById('btn-4team').style.outline=currentTeamMode===4?'3px solid #ffff00':'';
  document.getElementById('lobby-status').textContent=
    `ロビー ${activePlayers.length}人 | ${currentTeamMode}チーム${iAmHost?' 👑ホスト':''}`;

  if(res.gameStarted){
    clearInterval(lobbyInterval);
    const myData=activePlayers.find(p=>p.uid===myPeerId);
    const amSpectator = player.isSpectator || (res.spectators||[]).some(s=>s.uid===myPeerId);
    if(amSpectator){
      // 観戦者として参加した場合はチーム未所属のままスペクテイターモードで開始
      player.isSpectator=true;
      player.spectatorMode=true;
      player.team=null;
    } else if(myData){
      player.team=myData.team;
    } else {
      player.team=(currentTeamMode===2?['Red','Blue']:['Red','Blue','Green','Yellow'])[0];
    }
    teamMode=currentTeamMode;
    gameMode='multi';
    // ホストが決めたマップテーマをゲストにも適用
    if(res.mapTheme && MAP_THEMES[res.mapTheme]) currentMapTheme=res.mapTheme;
    startGamePlay();
  }
}
async function setTeamMode(mode){
  currentTeamMode=mode;
  await sbRequest({action:'setTeamMode',uid:myPeerId,mode});
  document.getElementById('btn-2team').style.outline=mode===2?'3px solid #ffff00':'';
  document.getElementById('btn-4team').style.outline=mode===4?'3px solid #ffff00':'';
}
async function hostStartGame(){
  const teams=currentTeamMode===2?['Red','Blue']:['Red','Blue','Green','Yellow'];
  _resolveMapTheme();

  const res=await sbRequest({action:'lobbyPoll',uid:myPeerId});
  if(!res?.players){
    document.getElementById('lobby-status').textContent='Supabaseからロビー情報を取得できませんでした';
    return;
  }
  if(res.players.length===0){
    document.getElementById('lobby-status').textContent='参加者がいません';
    return;
  }

  const assignments={};
  res.players.forEach((p,i)=>{assignments[p.uid]=teams[i%teams.length];});

  const startRes=await sbRequest({
    action:'startGame',
    uid:myPeerId,
    teamMode:currentTeamMode,
    assignments,
    mapTheme:currentMapTheme
  });
  if(!startRes?.ok){
    document.getElementById('lobby-status').textContent='試合開始通知に失敗しました';
    return;
  }

  player.team=assignments[myPeerId]||teams[0];
  teamMode=currentTeamMode;
  gameMode='multi';
  clearInterval(lobbyInterval);
  startGamePlay();
}

function startTraining(type){ player.isSpectator=false; player.spectatorMode=false; player.team='Blue'; teamMode=2; gameMode=type==='bridge'?'training_bridge':'training_parkour'; currentMatchId=null; currentMapSeed=0; startGamePlay(); }

function startGame(mode){
  const name=document.getElementById('player-name').value.trim()||'Player';
  player.name=name;playerName=name;
bwStorage.set('bw_name',name);
  player.team='Blue';teamMode=2;gameMode=mode;
  // マップ選択を確定（ランダムならここで決定）
  _resolveMapTheme();
  startGamePlay();
}

// マップテーマ選択UIの初期化
let _selectedMapTheme='random';
function setMapTheme(v){ _selectedMapTheme=v; }
function _resolveMapTheme(){
  currentMapTheme = (_selectedMapTheme==='random') ? pickRandomMap() : _selectedMapTheme; currentMapSeed=Math.floor(Math.random()*2147483647);
}
function _initMapThemeSelect(){
  const sel=document.getElementById('map-theme-select');
  if(!sel) return;
  Object.entries(MAP_THEMES).forEach(([key,theme])=>{
    const opt=document.createElement('option');
    opt.value=key; opt.textContent=theme.name||key;
    sel.appendChild(opt);
  });
}
window.addEventListener('load',_initMapThemeSelect);
function startGamePlay(){
  document.getElementById('lobby').style.display='none';
bwStorage.remove('bw_lobby_players');
  clearInterval(lobbyInterval);
  
  // Reset all game state
  TEAM_BED_STATUS.Red=true;
  TEAM_BED_STATUS.Blue=true;
  TEAM_BED_STATUS.Green=true;
  TEAM_BED_STATUS.Yellow=true;
  blockMap.clear();
  breaks=0;
  gameTime=0;

  // 純粋観戦者: チームnullだとスポーン計算がクラッシュするため仮チームを割当（見た目のみ、対戦には影響しない）
  if(player.isSpectator || !player.team){
    player.team = player.team || 'Blue';
    player.spectatorMode = true;
  } else {
    player.respawnProtection=3; // 3 seconds invulnerability（通常プレイヤーのみ）
  }

  document.body.requestPointerLock();
  initScene();
  // v8: 保存済み設定を適用
  if(camera){
    camera.fov=currentSettings.fov||75;
    camera.far=currentSettings.drawDist||150;
    camera.updateProjectionMatrix();
  }
  if(renderer){
    const tq=currentSettings.texQuality||1;
    renderer.setPixelRatio(window.devicePixelRatio*(tq===2?1.5:tq===0.5?0.5:1));
  }
  // v7.1: 右腕・ミニマップをゲーム開始時に表示
  setTimeout(()=>{
    initRightArm();
    const mw=document.getElementById('minimap-wrap');
    if(mw) mw.style.display='block';
    if(_fpsEl) _fpsEl.style.display='block';
  }, 500);
  // ロビーチャットを停止
  if(_lobbyChatInterval){ clearInterval(_lobbyChatInterval); _lobbyChatInterval=null; }
  // v9: 手元・弓チャージ初期化
  setTimeout(()=>{
    initRightArm();
    initBowCharge();
    _updateHandItem();
    // スキンをlocalStorageから読み込んでメッシュ更新
    const savedSkin=bwStorage.get('mc3d_skin')||bwStorage.get('bw_skin');
    if(savedSkin){
      loadSkinFromDataURL(savedSkin,()=>{
        if(playerMesh3p) refreshPlayerMeshSkin();
      });
    }
  },300);
}

// ================================================================
//  GOLEM / BOW LOGIC
// ================================================================
// AI専用のゴーレム召喚（プレイヤーのuseGolemとは別関数）
function spawnGolem(gx,gy,gz,teamName){
  const g=new THREE.Group();
  const body=new THREE.Mesh(new THREE.BoxGeometry(.9,1.6,.6),new THREE.MeshLambertMaterial({color:0xbbbbbb,emissive:0x222222}));
  body.position.y=.8;
  const head=new THREE.Mesh(new THREE.BoxGeometry(.7,.7,.7),new THREE.MeshLambertMaterial({color:0xaaaaaa}));
  head.position.y=1.75;
  g.add(body,head);
  g.position.set(gx,gy,gz);
  g.userData={isGolem:true,isEnemy:true,team:teamName,hp:40,maxHp:40,vel:new THREE.Vector3(),onGround:false,atkTimer:0,walkPhase:0,state:'idle'};
  if(scene){scene.add(g);enemies.push(g);}
}

function useGolem(){
  const s=player.inv[player.selectedIdx];
  if(!s||s.type!=='golem'||s.count<=0)return;
  s.count--;if(s.count<=0){s.type=null;s.count=0;}
  // Spawn a golem ally
  const g=new THREE.Group();
  const body=new THREE.Mesh(new THREE.BoxGeometry(.9,1.6,.6),new THREE.MeshLambertMaterial({color:0xbbbbbb,emissive:0x222222}));
  body.position.y=.8;
  const head=new THREE.Mesh(new THREE.BoxGeometry(.7,.7,.7),new THREE.MeshLambertMaterial({color:0xaaaaaa}));
  head.position.y=1.75;
  g.add(body,head);
  g.position.copy(player.pos).add(new THREE.Vector3(Math.sin(controls.yaw)*2,0,Math.cos(controls.yaw)*2));
  g.userData={isGolem:true,isEnemy:true,team:player.team,hp:40,maxHp:40,vel:new THREE.Vector3(),onGround:false,atkTimer:0,walkPhase:0,state:'idle'};
  scene.add(g);enemies.push(g); // share enemy logic; golems won't attack own team
  announce('🤖 ゴーレム召喚！','#55ffff');updateUI();
}

// Arrow projectiles
let arrows=[];
function shootBow(){
  const s=player.inv.find(x=>x.type==='arrow');
  const b=player.inv.find(x=>x.type==='bow');
  if(!b||!s||s.count<=0)return;
  s.count--;if(s.count<=0){s.type=null;s.count=0;}
  const dir=new THREE.Vector3(0,0,-1).applyEuler(new THREE.Euler(controls.pitch,controls.yaw,0,'YXZ'));
  const arrowMesh=new THREE.Mesh(
    new THREE.CylinderGeometry(.03,.03,.6,6),
    new THREE.MeshLambertMaterial({color:0xc8a020})
  );
  arrowMesh.position.copy(camera.position).add(dir.clone().multiplyScalar(.5));
  const vel=dir.clone().multiplyScalar(0.6); // Arrow speed (normalized from original)
  arrowMesh.userData={vel,life:3,isArrow:true};
  scene.add(arrowMesh);arrows.push(arrowMesh);
  updateUI();
}

function shootBowCharged(chargeTime){
  const s=player.inv.find(x=>x.type==='arrow');
  const b=player.inv.find(x=>x.type==='bow');
  if(!b||!s||s.count<=0)return;
  s.count--;if(s.count<=0){s.type=null;s.count=0;}
  
  const ray=new THREE.Raycaster();
  
  // 1人称: カメラから（元のまま）
  if(!thirdPerson){
    ray.setFromCamera(new THREE.Vector2(),camera);
  } else {
    // 3人称: プレイヤー視点方向（pitch上下で変更可能）
    const dir=new THREE.Vector3(0,0,-1).applyEuler(new THREE.Euler(controls.pitch,controls.yaw,0,'YXZ'));
    ray.set(player.pos.clone().add(new THREE.Vector3(0,1.6,0)),dir);
  }
  
  const distance=0.5+Math.min(chargeTime*2,2.5);
  
  const eHit=ray.intersectObjects(enemies,true).find(h=>h.distance<distance);
  if(eHit){
    const enemy=_bwResolveHitRoot(eHit.object,'isEnemy');
    if(!enemy) return;
    const dmg=6+Math.floor(chargeTime*4);
    enemy.userData.hp-=dmg;
    spawnParticles(enemy.position.clone(),'#ff4444',8);
    announce(`🏹 HIT! +${dmg}dmg`,'#ffff00');
    if(enemy.userData.hp<=0)killEnemy(enemy);
    shakeIntensity=0.1;
  } else if(gameMode==='multi'){
    const mpRoots=Object.values(mpMeshes);
    const mh=ray.intersectObjects(mpRoots,true).find(h=>h.distance<Math.max(4,0.5+chargeTime*8));
    if(mh){
      const mesh=_bwResolveHitRoot(mh.object,'isMPPlayer'); const uid=mesh?Object.keys(mpMeshes).find(k=>mpMeshes[k]===mesh):null;
      if(uid){
        const dmg=6+Math.floor(chargeTime*4);
        sendDamageSupabase(uid,dmg,'bow');
        showDamageNumber(dmg,mesh.position.clone().add(new THREE.Vector3(0,1.6,0)),'#ff5555');
        sbRequest({action:'actionEvent',uid:myPeerId,actionType:'attack',itemType:'bow',x:player.pos.x,y:player.pos.y+1.2,z:player.pos.z,yaw:controls.yaw,pitch:controls.pitch,payload:{charge:chargeTime}});
      }
    }
  }
  updateUI();
}

function updateArrows(dt){
  for(let i=arrows.length-1;i>=0;i--){
    const a=arrows[i];
    a.userData.vel.y-=0.013; // Original gravity
    a.position.addScaledVector(a.userData.vel,dt);
    a.userData.life-=dt;
    if(a.userData.life<=0){scene.remove(a);arrows.splice(i,1);continue;}
    // Hit enemy?
    let hit=false;
    for(const e of enemies){
      if(e.position.distanceTo(a.position)<0.8){
        e.userData.hp-=6;spawnParticles(a.position.clone(),'#ff4444',4);
        if(e.userData.hp<=0)killEnemy(e);
        hit=true;break;
      }
    }
    if(hit){scene.remove(a);arrows.splice(i,1);}
  }
}

// ================================================================
//  WIN CHECK → 終了画面表示
// ================================================================
function checkWin(){
  if(gameTime<10)return;
  const allTeams=teamMode===2?['Red','Blue']:['Red','Blue','Green','Yellow'];

  const aliveTeams=allTeams.filter(t=>{
    const hasBed=TEAM_BED_STATUS[t];
    if(hasBed)return true;
    if(t===player.team) return !player.isDead;
    if(gameMode==='multi'){
      return Object.values(mpPlayers).some(p=>p.team===t&&p.hp>0);
    }else{
      return enemies.some(e=>e.userData.team===t&&e.userData.hp>0);
    }
  });

  if(aliveTeams.length<=1){
    if(checkWin._fired)return;
    checkWin._fired=true;
    const winner=aliveTeams[0];
    const isWin=(winner===player.team);
    if(isWin){
      playerData.wins++;
      playerData.level=Math.max(1,~~(playerData.kills/5)+1);
bwStorage.set('bw_data',JSON.stringify(playerData));
    }
    // マルチ時: Supabaseに終了通知
    if(gameMode==='multi'){
      stopMultiplayerLoops();
      sbRequest({action:'leave',uid:myPeerId});
      // 履歴更新
      sbRequest({action:'updateHistory',uid:myPeerId,name:player.name,kills:playerData.kills,wins:playerData.wins,level:playerData.level,skin:(skinUrl||playerSkin||'')});
    }
    // 3秒後に終了画面
    setTimeout(()=>showEndScreen(winner,isWin), 2000);
    announce(isWin?'🏆 YOU WIN!':'💀 GAME OVER', isWin?'#FFAA00':'#ff5555');
  }
}
checkWin._fired=false;

// ================================================================
//  終了画面
// ================================================================
function showEndScreen(winner, isWin){
  _releaseCursor();
  // 終了画面を表示
  const es=document.getElementById('end-screen');
  if(!es) return;
  es.style.display='block';

  // タイトル
  document.getElementById('end-title').textContent = isWin?'🏆 YOU WIN!':'💀 GAME OVER';
  document.getElementById('end-title').style.color  = isWin?'#FFAA00':'#ff5555';
  const tc = winner? TEAM_COLOR_HEX[winner]||'#fff' : '#888';
  document.getElementById('end-result').innerHTML =
    winner? `<span style="color:${tc};font-size:28px;font-weight:bold">${winner} チームの勝利！</span>`
           : '<span style="color:#888">引き分け</span>';

  // 成績
  document.getElementById('end-stats').innerHTML=`
    <div style="background:#1a1a1a;border:2px solid #444;border-radius:6px;padding:12px">
      <div style="font-size:28px">⚔️</div>
      <div style="font-size:24px;color:#ff5555;font-weight:bold">${playerData.kills}</div>
      <div style="color:#888;font-size:13px">KILL数</div>
    </div>
    <div style="background:#1a1a1a;border:2px solid #444;border-radius:6px;padding:12px">
      <div style="font-size:28px">🏆</div>
      <div style="font-size:24px;color:#ffaa00;font-weight:bold">${playerData.wins}</div>
      <div style="color:#888;font-size:13px">勝利数</div>
    </div>
    <div style="background:#1a1a1a;border:2px solid #444;border-radius:6px;padding:12px">
      <div style="font-size:28px">⚡</div>
      <div style="font-size:24px;color:#55ffff;font-weight:bold">Lv${playerData.level}</div>
      <div style="color:#888;font-size:13px">レベル</div>
    </div>`;

  // ランキング（マルチ時）
  if(gameMode==='multi'){
    sbRequest({action:'getHistory'}).then(res=>{
      if(!res||!res.history) return;
      const el=document.getElementById('end-ranking');
      el.innerHTML='<div style="color:#ffaa00;font-size:14px;margin-bottom:6px">📊 ランキング</div>'+
        '<table style="width:100%;border-collapse:collapse;font-size:12px">'+
        '<tr style="border-bottom:1px solid #333;color:#888"><th style="text-align:left">#</th><th>名前</th><th>KILL</th><th>Lv</th></tr>'+
        res.history.slice(0,10).map((p,i)=>`<tr style="border-bottom:1px solid #222;${p.name===player.name?'background:rgba(255,170,0,0.1)':''}">
          <td style="color:#888">${i+1}</td>
          <td style="color:${p.name===player.name?'#ffaa00':'#ccc'}">${_bwEscapeHtml(p.name)}</td>
          <td style="color:#ff5555">${Number(p.kills)||0}</td>
          <td style="color:#55ffff">${Number(p.level)||1}</td>
        </tr>`).join('')+
        '</table>';
    });
  }

  // 背景: 島がくるくる回るThree.jsシーン
  _startEndBgScene();

  // 終了チャットポーリング開始
  _startEndChatPoll();

  // キーバインド
  document.getElementById('end-chat-input')?.addEventListener('keydown',e=>{
    e.stopPropagation();
    if(e.key==='Enter'){e.preventDefault();sendEndChat();}
  });
}

// 終了画面の背景（実際の戦場をカメラがくるくる移動）
let _endBgAnimId=null;
function _startEndBgScene(){
  const canvas=document.getElementById('end-bg-canvas');
  if(!canvas) return;

  // 既存のゲームシーンを流用してカメラだけ動かす
  if(renderer && scene && camera){
    let angle=0;
    const centerY=70;
    const radius=35;
    function endLoop(){
      _endBgAnimId=requestAnimationFrame(endLoop);
      angle+=0.004;
      // カメラが戦場をゆっくり周回
      camera.position.set(
        Math.cos(angle)*radius,
        centerY + Math.sin(angle*0.5)*5,
        Math.sin(angle)*radius
      );
      camera.lookAt(0, 62, 0);
      window._bwRender ? window._bwRender(scene, camera) : renderer.render(scene, camera);
      // 終了画面のcanvasにコピー
      const ctx=canvas.getContext('2d');
      canvas.width=window.innerWidth;
      canvas.height=window.innerHeight;
      ctx.drawImage(renderer.domElement, 0, 0, canvas.width, canvas.height);
    }
    endLoop();
  } else {
    // フォールバック: シンプルな空色
    canvas.style.background='linear-gradient(180deg,#87ceeb 0%,#4caf50 80%)';
  }
}

// 終了チャット
let _endChatInterval=null;
let _endChatLastTs='';
function _startEndChatPoll(){
  _endChatInterval=setInterval(async()=>{
    const res=await sbRequest({action:'getMsgs',scope:'post',matchId:currentMatchId});
    if(!res||!res.ok||!Array.isArray(res.msgs)) return;
    const el=document.getElementById('end-chat-log');
    if(!el) return;
    res.msgs.slice(-20).forEach(m=>{
      const ts=m.ts||'';
      if(!ts||ts===_endChatLastTs) return;
      _endChatLastTs=ts;
      const div=document.createElement('div');
      div.style.cssText='padding:2px 0;border-bottom:1px solid #222';
      div.innerHTML=`<span style="color:${_bwSafeColor(m.color,'#ccc')};font-weight:bold">${_bwEscapeHtml(m.name)}:</span> ${_bwEscapeHtml(m.msg)}`;
      el.appendChild(div);
      el.scrollTop=el.scrollHeight;
    });
  },2000);
}

async function sendEndChat(){
  const input=document.getElementById('end-chat-input');
  if(!input) return;
  const msg=input.value.trim();
  if(!msg) return;
  input.value='';
  await sbRequest({action:'postMsg',name:player.name,msg:`[終了後] ${msg}`,color:TEAM_COLOR_HEX[player.team]||'#fff',pcId:myPeerId,matchId:currentMatchId,scope:'post'});
  const el=document.getElementById('end-chat-log');
  if(el){
    const div=document.createElement('div');
    div.style.cssText='padding:2px 0;border-bottom:1px solid #222;color:#ffff88';
    div.innerHTML=`<b>${_bwEscapeHtml(player.name)}(自):</b> [終了後] ${_bwEscapeHtml(msg)}`;
    el.appendChild(div);el.scrollTop=el.scrollHeight;
  }
}

// ロビーへ戻る（全員退出後にSupabaseの試合データをリセット）
async function leaveToLobby(){
  if(_endBgAnimId) cancelAnimationFrame(_endBgAnimId);
  if(_endChatInterval) clearInterval(_endChatInterval);
  stopMultiplayerLoops();

  if(gameMode==='multi'){
    // Supabaseに退出を通知
    await sbRequest({action:'leave', uid:myPeerId});
    await new Promise(r=>setTimeout(r,300));
    // サーバー側で残存プレイヤーがいない場合のみ試合データを削除する。
    if(currentMatchId) await sbRequest({action:'clearMatch',matchId:currentMatchId});
  }

  // ローカル状態をリセット
  checkWin._fired=false;
  blockMap.clear();
  mpPlayers={};
  mpMeshes={};
  enemies=[];
  gameTime=0;
  player.hp=20; player.maxHp=20;
  player.isDead=false; player.spectatorMode=false;
  player.hasBed=true;
  TEAM_BED_STATUS={Red:true,Blue:true,Green:true,Yellow:true};

  location.reload();
}


// ================================================================
//  SKIN SYSTEM
// ================================================================
// Real Steve skin (64×64 canvas-generated fallback)
function generateSteveSkin(){
  const cv=document.createElement('canvas');cv.width=64;cv.height=64;
  const c=cv.getContext('2d');
  // Head
  c.fillStyle='#f0a060';c.fillRect(8,8,8,8);   // face
  c.fillStyle='#8b6040';c.fillRect(8,8,8,2);   // hair top
  c.fillStyle='#704020';c.fillRect(8,10,8,1);  // hair
  c.fillStyle='#302010';c.fillRect(9,14,2,2);  // left eye
  c.fillStyle='#302010';c.fillRect(13,14,2,2); // right eye
  c.fillStyle='#c86020';c.fillRect(10,16,4,1); // mouth
  // Body
  c.fillStyle='#3060c0';c.fillRect(20,20,8,12); // torso
  c.fillStyle='#305090';c.fillRect(20,20,8,2);  // collar
  // Arms
  c.fillStyle='#f0a060';c.fillRect(40,20,4,12); // right arm (skin)
  c.fillStyle='#3060c0';c.fillRect(40,20,4,10);
  c.fillStyle='#f0a060';c.fillRect(44,20,4,12); // mirrored left arm
  c.fillStyle='#3060c0';c.fillRect(44,20,4,10);
  // Legs
  c.fillStyle='#204080';c.fillRect(4,20,4,12);  // right leg
  c.fillStyle='#204080';c.fillRect(8,20,4,12);  // left leg
  return cv.toDataURL();
}
const STEVE=generateSteveSkin();

// v26追記: メニュー/インベントリのCSS 3Dプレビュー(.face要素)は、
// スキン画像をそのまま各面に切り出して貼るだけで、帽子(hat)・上着(jacket)・
// 袖・ズボンの「オーバーレイレイヤー」を一切合成していなかった。
// そのため実際のゲーム内3Dモデル(_createSkinBodyPartはbase+overlayの2枚を
// 重ねて描画している)とプレビューの見た目が食い違っていた。
// ここでは _createSkinBodyPart と同じ base/overlay のUV対応表を使い、
// オーバーレイ画素をベース画素の位置へアルファ合成した「合成済みスキン画像」を
// 事前に1枚作ってからCSSプレビューに渡すことで、実モデルと一致させる。
function _buildComposedSkinForPreview(rawUrl, cb){
  const safe=_bwSafeImageSource(rawUrl);
  if(!safe){cb(rawUrl);return;}
  const img=new Image();
  img.crossOrigin='anonymous';
  img.onload=()=>{
    try{
      const w=img.naturalWidth||64, h=img.naturalHeight||64;
      const scale=w/64; // 64x64基準のレイアウト比率(高解像度スキンにも比例対応)
      const c=document.createElement('canvas'); c.width=w; c.height=h;
      const ctx=c.getContext('2d'); ctx.imageSmoothingEnabled=false;
      ctx.drawImage(img,0,0,w,h); // まずベースレイヤーをそのまま描画
      // [baseX,baseY, layerX,layerY, netW,netH] = _createSkinBodyPart のUVと同じ6面ネット展開
      const parts=[
        [0,0,   32,0,  32,16], // 頭 + 帽子オーバーレイ
        [16,16, 16,32, 24,16], // 胴体 + 上着オーバーレイ
        [40,16, 40,32, 16,16], // 右腕 + 右袖オーバーレイ
        [32,48, 48,48, 16,16], // 左腕 + 左袖オーバーレイ
        [0,16,  0,32,  16,16], // 右脚 + 右ズボンオーバーレイ
        [16,48, 0,48,  16,16], // 左脚 + 左ズボンオーバーレイ
      ];
      parts.forEach(([bx,by,lx,ly,nw,nh])=>{
        try{
          ctx.drawImage(img,
            lx*scale, ly*scale, nw*scale, nh*scale,
            bx*scale, by*scale, nw*scale, nh*scale);
        }catch(e){}
      });
      cb(c.toDataURL());
    }catch(e){ cb(rawUrl); } // CORS等で失敗した場合は元画像のままフォールバック
  };
  img.onerror=()=>cb(rawUrl);
  img.src=safe;
}

function applySkin(url){
  // まず即座に元画像を反映(空白防止)。合成が完了次第、正しい見た目に差し替える。
  const safe=_bwSafeImageSource(url)||STEVE;
  document.querySelectorAll('.face').forEach(el=>el.style.backgroundImage=`url(${_bwSafeCssUrl(safe)})`);
  _buildComposedSkinForPreview(safe, composed=>{
    const composedSafe=_bwSafeImageSource(composed)||safe;
    document.querySelectorAll('.face').forEach(el=>el.style.backgroundImage=`url(${_bwSafeCssUrl(composedSafe)})`);
  });
}
applySkin(STEVE);

// ---- Lobby background (local only, no external asset) ----
const _bwLobbyBgPresets=[
  {name:'夕焼け',css:'linear-gradient(135deg,#1b1035,#5b2a86 45%,#ff8a5c)'},
  {name:'深海',css:'linear-gradient(135deg,#021b2f,#064663 55%,#0f8b8d)'},
  {name:'草原',css:'linear-gradient(135deg,#0b2d1b,#2f6f3e 55%,#a7c957)'},
  {name:'夜桜',css:'linear-gradient(135deg,#120b1f,#4a1e3f 55%,#ff8fab)'}
];
function _bwLobbyBgCss(stored){
  if(!stored) return '';
  if(stored.startsWith('image:')){
    const img=_bwSafeImageSource(stored.slice(6));
    return img ? `url(${_bwSafeCssUrl(img)})` : '';
  }
  if(stored.startsWith('preset:')){
    const idx=Number(stored.slice(7));
    return Number.isInteger(idx) && _bwLobbyBgPresets[idx] ? _bwLobbyBgPresets[idx].css : '';
  }
  const legacyImage=_bwSafeImageSource(stored);
  return legacyImage ? `url(${_bwSafeCssUrl(legacyImage)})` : '';
}
function _bwApplyLobbyBackground(css){
  const lobby=document.getElementById('lobby');
  if(!lobby || !css) return;
  lobby.style.setProperty('--lobby-bg', css);
}
function _bwSetLobbyBackground(stored){
  const css=_bwLobbyBgCss(stored);
  if(!css && stored) return;
  _bwApplyLobbyBackground(css);
  try{
    if(stored) bwStorage.set('bw_lobby_bg', stored);
    else bwStorage.remove('bw_lobby_bg');
  }catch(e){ console.warn('背景設定を保存できませんでした', e); }
}
function _bwRenderBgThumbs(){
  const grid=document.getElementById('bg-thumb-grid');
  if(!grid) return;
  grid.innerHTML='';
  _bwLobbyBgPresets.forEach((preset,idx)=>{
    const btn=document.createElement('button');
    btn.type='button';
    btn.title=preset.name;
    btn.textContent=preset.name;
    btn.style.cssText=`height:44px;border:2px solid #555;border-radius:3px;cursor:pointer;background:${preset.css};color:#fff;font-size:11px;text-shadow:1px 1px 0 #000`;
    btn.onclick=()=>{ _bwSetLobbyBackground('preset:'+idx); const sel=document.getElementById('bg-selector'); if(sel) sel.style.display='none'; };
    grid.appendChild(btn);
  });
  const reset=document.createElement('button');
  reset.type='button';
  reset.textContent='既定に戻す';
  reset.style.cssText='height:36px;border:2px solid #555;border-radius:3px;cursor:pointer;background:#222;color:#ddd;font-size:12px';
  reset.onclick=()=>{ _bwSetLobbyBackground(''); const lobby=document.getElementById('lobby'); if(lobby) lobby.style.removeProperty('--lobby-bg'); const sel=document.getElementById('bg-selector'); if(sel) sel.style.display='none'; };
  grid.appendChild(reset);
}
function toggleBgSelector(){
  const el=document.getElementById('bg-selector');
  if(!el) return;
  const open=el.style.display==='none' || !el.style.display;
  el.style.display=open?'block':'none';
  if(open) _bwRenderBgThumbs();
}
{
  const saved=bwStorage.get('bw_lobby_bg');
  const css=_bwLobbyBgCss(saved);
  if(css) _bwApplyLobbyBackground(css);
  const input=document.getElementById('bg-file-input');
  if(input){
    input.addEventListener('change',e=>{
      const file=e.target.files?.[0]; if(!file) return;
      if(file.size>4*1024*1024){announce('⚠️ 画像は4MB以下にしてください','#ff5555');return;}
      const reader=new FileReader();
      reader.onload=()=>{
        const safe=_bwSafeImageSource(reader.result);
        if(!safe){announce('⚠️ 画像ファイルを読み込めませんでした','#ff5555');return;}
        _bwSetLobbyBackground('image:'+safe);
        const sel=document.getElementById('bg-selector'); if(sel) sel.style.display='none';
      };
      reader.readAsDataURL(file);
    });
  }
}

document.getElementById('skin-file').addEventListener('change',e=>{
  const file=e.target.files[0];if(!file)return;
  const r=new FileReader();
  r.onload=ev=>{
    const safe=_bwSafeImageSource(ev.target.result);
    if(!safe){announce('⚠️ 画像ファイルを読み込めませんでした','#ff5555');return;}
    skinUrl=safe;
    playerSkin=skinUrl;
    bwStorage.set('bw_skin',skinUrl);
    bwStorage.set('mc3d_skin',skinUrl);
    applySkin(skinUrl);
    // ゲーム中メッシュにも即時反映
    loadSkinFromDataURL(skinUrl,()=>{
      if(playerMesh3p) refreshPlayerMeshSkin();
      // マルチ中に変更したスキンをSupabaseへ即時反映
      if(gameMode==='multi'){
        sbRequest({
          action:'sync',uid:myPeerId,name:player.name,team:player.team,
          x:Math.round(player.pos.x),y:Math.round(player.pos.y),z:Math.round(player.pos.z),
          hp:Math.ceil(player.hp),bed:player.hasBed?1:0,skin:skinUrl
        });
      }
    });
    announce('✅ スキンを読み込みました','#55ff55');
  };
  r.readAsDataURL(file);
});
// Apply saved skin on load
const _initSkin=_bwSafeImageSource(bwStorage.get('mc3d_skin'))||_bwSafeImageSource(bwStorage.get('bw_skin'))||_bwSafeImageSource(playerSkin);
if(_initSkin){applySkin(_initSkin);skinUrl=_initSkin;loadSkinFromDataURL(_initSkin,null);}

// Lobby skin drag rotation + walking animation
{
  const box=document.getElementById('lobby-skin-box');
  const mdl=document.getElementById('lobby-model');
  let drag=false,prevX=0,rotY=0;
  box.addEventListener('mousedown',e=>{drag=true;prevX=e.clientX;});
  window.addEventListener('mousemove',e=>{if(!drag)return;rotY+=(e.clientX-prevX)*.8;prevX=e.clientX;mdl.style.transform=`rotateY(${rotY}deg)rotateX(-5deg)`;});
  window.addEventListener('mouseup',()=>drag=false);

  // ウォーキングアニメーション（腕・脚が交互に振れる）
  let _lwt=0;
  function _lwalk(){
    requestAnimationFrame(_lwalk);
    _lwt+=0.05;
    const sw=Math.sin(_lwt)*20;
    if(!mdl) return;
    const rl=mdl.querySelector('.r-leg-3d');
    const ll=mdl.querySelector('.l-leg-3d');
    const ra=mdl.querySelector('.r-arm-3d');
    const la=mdl.querySelector('.l-arm-3d');
    if(rl)rl.style.transform=`rotateX(${sw}deg)`;
    if(ll)ll.style.transform=`rotateX(${-sw}deg)`;
    if(ra)ra.style.transform=`rotateX(${-sw}deg)`;
    if(la)la.style.transform=`rotateX(${sw}deg)`;
  }
  _lwalk();
}

// ================================================================
//  v9: 一時停止・ゲーム内メニュー
// ================================================================
let _gamePaused=false;

// PointerLock管理: メニュー/終了画面ではカーソルを解放
function _releaseCursor(){ try{document.exitPointerLock();}catch(e){} }
function _captureCursor(){ try{document.body.requestPointerLock();}catch(e){} }

// PointerLock変更イベント
document.addEventListener('pointerlockchange',()=>{
  const locked=!!document.pointerLockElement;
  // v26追記: 自陣ブロックが勝手に壊れ続けるバグの根本原因を修正。
  // ポインターロックが外れた瞬間(ESC押下やメニューを開いた時など)、
  // 左クリックを押しっぱなしにしたままだと対応するmouseupが発火せず
  // player.mining(採掘中フラグ)がtrueのまま固定されてしまっていた。
  // その状態でメニューを閉じてカーソルが復帰すると、クロスヘアが
  // 向いている先を延々と自動で採掘し続けてしまう(自陣や橋を勝手に
  // 破壊しているように見える現象の正体)。ロックが外れた時点で必ず
  // mining/placingをリセットする。
  if(!locked){
    player.mining=false;
    player.placing=false;
    const prog=document.getElementById('break-progress');
    if(prog) prog.style.display='none';
    breakTarget=null; breakAcc=0;
  }
  // メニュー・終了画面・ポーズ中は再取得しない
  const pauseOpen=document.getElementById('pause-menu')?.style.display==='block';
  const igOpen=document.getElementById('ingame-menu')?.style.display==='block';
  const endOpen=document.getElementById('end-screen')?.style.display==='block';
  const settOpen=document.getElementById('settings-panel')?.style.display==='block';
  if(!locked&&!pauseOpen&&!igOpen&&!endOpen&&!settOpen&&gameMode!=='lobby'&&!activeMenu){
    // 意図せず外れた場合のみ再取得
    setTimeout(()=>{
      const pl2=!!document.pointerLockElement;
      if(!pl2&&gameMode!=='lobby'&&!activeMenu) _captureCursor();
    },200);
  }
});

function togglePauseMenu(){
  _gamePaused=!_gamePaused;
  const el=document.getElementById('pause-menu');
  if(!el) return;
  el.style.display=_gamePaused?'block':'none';
  if(_gamePaused){ _releaseCursor(); _pauseRTATimer(); }
  else { _captureCursor(); _resumeRTATimer(); }
}

function resumeGame(){
  _gamePaused=false;
  const el=document.getElementById('pause-menu');
  if(el) el.style.display='none';
  _captureCursor();
  _resumeRTATimer();
}

function toggleInGameMenu(){
  const el=document.getElementById('ingame-menu');
  if(!el) return;
  const isOpen=el.style.display==='block';
  el.style.display=isOpen?'none':'block';
  if(!isOpen){ _releaseCursor(); _pauseRTATimer(); }
  else { _captureCursor(); _resumeRTATimer(); }
}

function closeIngameMenu(){
  const el=document.getElementById('ingame-menu');
  if(el) el.style.display='none';
  setTimeout(_captureCursor,50);
  _resumeRTATimer();
}

// ================================================================
//  v8: 設定システム
// ================================================================
// ================================================================
//  設定システム v11 (35項目完全版)
// ================================================================
const DEFAULT_SETTINGS = {
  // ゲームプレイ
  autoSprint:false, toggleSneak:false, autoBridge:false,
  blockPreview:true, hotbarLock:false, smartRespawn:true,
  scrollSlot:true,
  // グラフィック
  fov:70, dynamicFOV:true, drawDist:150, texQuality:1,
  viewBobbing:true, screenShake:true, particles:true,
  gamma:1.0, sky:'day', shadow:'low',
  // HUD
  crosshair:'cross', uiScale:1,
  showCps:false, showDebug:true, showArmor:true,
  showEnemyHp:true, showTimer:true, dmgIndicator:true,
  // 操作
  sens:0.15, invertY:false,
  // サウンド
  vol:80, bgm:60, sfx:80, spatialAudio:true, bedAlert:true,
  // キーバインド
  keys:{
    forward:'KeyW', back:'KeyS', left:'KeyA', right:'KeyD',
    jump:'Space', crouch:'ShiftLeft', sprint:'ControlLeft',
    use:'KeyF', drop:'KeyQ', thirdPerson:'F5',
    chatAll:'Backspace', chatTeam:'Enter',
    inv:'KeyI', shop:'KeyE', scoreboard:'Tab',
    drop2:'ArrowDown'
  }
};
const _savedSettings = _bwSafeJsonParse(bwStorage.get('bw_settings'), null);
let currentSettings = Object.assign({}, JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), _savedSettings || {});
currentSettings.keys = Object.assign({}, DEFAULT_SETTINGS.keys, (_savedSettings && _savedSettings.keys) || {});

// トグル設定の適用
function setToggle(key, val){
  currentSettings[key]=val;
  applySettingEffects();
}

// 設定画面を開く
function openSettings(){
  const s=currentSettings;
  const el=document.getElementById('settings-panel');
  if(el) el.style.display='block';
  _releaseCursor();
  _pauseRTATimer();

  // 各コントロールに現在値をセット
  const setChk=(id,v)=>{const e=document.getElementById(id);if(e)e.checked=!!v;};
  const setVal=(id,v)=>{const e=document.getElementById(id);if(e)e.value=v;};
  const setLbl=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};

  setVal('set-fov',s.fov||70);     setLbl('lbl-fov',s.fov||70);
  setVal('set-draw',s.drawDist||150); setLbl('lbl-draw',s.drawDist||150);
  setVal('set-tex',s.texQuality||1);
  setVal('set-sens',Math.round((s.sens||0.15)*100)); setLbl('lbl-sens',(s.sens||0.15).toFixed(2));
  setVal('set-gamma',Math.round((s.gamma||1.0)*10)); setLbl('lbl-gamma',(s.gamma||1.0).toFixed(1));
  setVal('set-vol',s.vol||80);   setLbl('lbl-vol',s.vol||80);
  setVal('set-bgm',s.bgm||60);   setLbl('lbl-bgm',s.bgm||60);
  setVal('set-sfx',s.sfx||80);   setLbl('lbl-sfx',s.sfx||80);
  setVal('set-sky',s.sky||'day');
  setVal('set-shadow',s.shadow||'low');
  setVal('set-crosshair',s.crosshair||'cross');
  setVal('set-uiscale',s.uiScale||1);

  setChk('set-autoSprint',s.autoSprint);  setChk('set-toggleSneak',s.toggleSneak);
  setChk('set-autoBridge',s.autoBridge);  setChk('set-blockPreview',s.blockPreview!==false);
  setChk('set-hotbarLock',s.hotbarLock);  setChk('set-smartRespawn',s.smartRespawn!==false);
  setChk('set-scrollSlot',s.scrollSlot!==false);
  setChk('set-faceHighlight',s.faceHighlight!==false);
  setChk('set-kishiku',s.kishiku);
  setChk('set-kishikuUgly',s.kishikuUgly);
  setChk('set-dynamicFOV',s.dynamicFOV!==false);
  setChk('set-viewBobbing',s.viewBobbing!==false);
  setChk('set-screenShake',s.screenShake!==false);
  setChk('set-particles',s.particles!==false);
  setChk('set-showCps',s.showCps);
  setChk('set-showDebug',s.showDebug!==false);
  setChk('set-showArmor',s.showArmor!==false);
  setChk('set-showEnemyHp',s.showEnemyHp!==false);
  setChk('set-showTimer',s.showTimer!==false);
  setChk('set-dmgIndicator',s.dmgIndicator!==false);
  setChk('set-invertY',s.invertY);
  setChk('set-spatialAudio',s.spatialAudio!==false);
  setChk('set-bedAlert',s.bedAlert!==false);

  _renderKeybindList();
}

function closeSettings(){
  const el=document.getElementById('settings-panel');
  if(el) el.style.display='none';
  setTimeout(_captureCursor,80);
  _resumeRTATimer();
}

// スライダー変更時に即時反映
function applySettings(){
  const getV=(id)=>{const e=document.getElementById(id);return e?e.value:null;};
  const setLbl=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};

  const fov=parseInt(getV('set-fov'))||70;
  const draw=parseInt(getV('set-draw'))||150;
  const tex=parseFloat(getV('set-tex'))||1;
  const sens=parseInt(getV('set-sens'))/100||0.15;
  const gamma=parseInt(getV('set-gamma'))/10||1.0;
  const vol=parseInt(getV('set-vol'))||80;
  const bgm=parseInt(getV('set-bgm'))||60;
  const sfx=parseInt(getV('set-sfx'))||80;
  const sky=getV('set-sky')||'day';
  const shadow=getV('set-shadow')||'low';
  const crosshair=getV('set-crosshair')||'cross';
  const uiScale=parseFloat(getV('set-uiscale'))||1;

  setLbl('lbl-fov',fov); setLbl('lbl-draw',draw);
  setLbl('lbl-sens',sens.toFixed(2)); setLbl('lbl-gamma',gamma.toFixed(1));
  setLbl('lbl-vol',vol); setLbl('lbl-bgm',bgm); setLbl('lbl-sfx',sfx);

  Object.assign(currentSettings,{fov,drawDist:draw,texQuality:tex,sens,
    gamma,vol,bgm,sfx,sky,shadow,crosshair,uiScale});

  applySettingEffects();
}

// 設定値をゲームに反映
function applySettingEffects(){
  const s=currentSettings;
  if(camera){camera.fov=s.fov||70;camera.far=s.drawDist||150;camera.near=0.05;camera.updateProjectionMatrix();}
  if(renderer)renderer.setPixelRatio(window.devicePixelRatio*(s.texQuality===2?1.5:s.texQuality===0.5?0.5:1));

  // クロスヘア更新
  const ch=document.getElementById('crosshair-el');
  if(ch){
    const shapes={cross:'＋',dot:'·',circle:'○',none:''};
    ch.textContent=shapes[s.crosshair||'cross']||'＋';
    ch.style.display=s.crosshair==='none'?'none':'block';
  }

  // 空の色
  if(scene){
    const skyColors={day:0x87CEEB,evening:0xe87832,night:0x0a0a2a,cycle:0x87CEEB};
    scene.background=new THREE.Color(skyColors[s.sky||'day']||0x87CEEB);
  }

  // 明るさ (ambient light)
  if(scene){
    scene.children.forEach(c=>{
      if(c.isAmbientLight)c.intensity=0.4*(s.gamma||1.0);
    });
  }

  // UIスケール
  const hud=document.getElementById('hud');
  if(hud) hud.style.transform=`scale(${s.uiScale||1})`;

  // FPS/座標表示
  const dbg=document.getElementById('fps-counter');
  if(dbg) dbg.style.display=s.showDebug?'block':'none';

  // CPS表示
  let cpsEl=document.getElementById('cps-el');
  if(s.showCps&&!cpsEl){
    cpsEl=document.createElement('div');cpsEl.id='cps-el';
    cpsEl.style.cssText='position:fixed;top:4px;left:60px;font-size:12px;color:#0f0;background:rgba(0,0,0,0.5);padding:2px 6px;border-radius:2px;z-index:200;font-family:monospace';
    document.body.appendChild(cpsEl);
  }
  if(!s.showCps&&cpsEl) cpsEl.remove();

  // 音量適用
  if(window._bgmAudio) window._bgmAudio.volume=(s.bgm||60)/100*(s.vol||80)/100;
}

function saveSettings(){
  bwStorage.set('bw_settings',JSON.stringify(currentSettings));
  closeSettings();
  announce('✅ 設定を保存しました','#55ff55');
}

function resetSettings(){
  currentSettings=JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  openSettings();
  announce('↩ 設定をリセットしました','#ffaa00');
}

// キーバインドUIレンダリング
const KEYBIND_LABELS = {
  forward:'前進', back:'後退', left:'左', right:'右',
  jump:'ジャンプ', crouch:'スニーク', sprint:'ダッシュ',
  use:'使用[F]', drop:'ドロップ', thirdPerson:'三人称',
  chatAll:'全体チャット', chatTeam:'チームチャット',
  inv:'インベントリ', shop:'ショップ', scoreboard:'スコアボード'
};
let _rebindingKey = null;
function _renderKeybindList(){
  const el=document.getElementById('keybind-list');
  if(!el) return;
  el.innerHTML='';
  Object.entries(currentSettings.keys).forEach(([action,code])=>{
    const label=document.createElement('div');
    label.style.cssText='color:#ccc;font-size:12px;display:flex;align-items:center;justify-content:space-between;padding:3px 0;border-bottom:1px solid #222';
    const display=String(code||'').replace('Key','').replace('Digit','').replace('Arrow','↑').replace('Left','L').replace('Right','R');
    label.innerHTML=`<span>${_bwEscapeHtml(KEYBIND_LABELS[action]||action)}</span>
      <button data-action="${_bwEscapeHtml(action)}" style="padding:2px 8px;background:#333;color:#fff;border:1px solid #555;border-radius:2px;cursor:pointer;font-size:11px">${_bwEscapeHtml(display)}</button>`;
    label.querySelector('button').addEventListener('click',e=>{
      _rebindingKey=e.target.dataset.action;
      e.target.textContent='...';
      e.target.style.background='#664400';
    });
    el.appendChild(label);
  });
}
// キー入力をキャプチャして再割り当て
window.addEventListener('keydown',e=>{
  if(_rebindingKey){
    e.preventDefault();
    currentSettings.keys[_rebindingKey]=e.code;
    _rebindingKey=null;
    _renderKeybindList();
  }
},{capture:true});

// ================================================================
//  v8: ロビーチャット
// ================================================================
let _lobbyChatInterval=null;
let _lobbyChatLastTs='';

function startLobbyChatPoll(){
  if(!window.supabaseClient){ _setSupabaseStatus('Supabase: オフライン','#888'); return; }
  if(_lobbyChatInterval) clearInterval(_lobbyChatInterval);
  _lobbyChatInterval=setInterval(async()=>{
    const res=await sbRequest({action:'getMsgs',scope:'lobby'});
    if(!res||!res.ok||!Array.isArray(res.msgs)) return;
    const el=document.getElementById('lobby-chat-log');
    if(!el) return;
    res.msgs.filter(m=>(m.scope||'all')==='lobby'||!m.scope).forEach(m=>{
      const ts=m.ts||'';
      if(!ts) return;
      const key=m.name+ts;
      if(el.dataset.lastKey===key) return;
      el.dataset.lastKey=key;
      const div=document.createElement('div');
      div.style.cssText='padding:2px 0;border-bottom:1px solid #1a1a1a;font-size:11px';
      div.innerHTML=`<span style="color:${_bwSafeColor(m.color,'#ccc')};font-weight:bold">${_bwEscapeHtml(m.name)}:</span> ${_bwEscapeHtml(m.msg)}`;
      el.appendChild(div);
      el.scrollTop=el.scrollHeight;
    });
  },3000);
}

async function sendLobbyChat(){
  const input=document.getElementById('lobby-chat-input');
  if(!input) return;
  const msg=input.value.trim();
  if(!msg) return;
  input.value='';
  const name=document.getElementById('player-name').value.trim()||'Player';
  await sbRequest({action:'postMsg',name,msg:`[ロビー] ${msg}`,color:'#cccccc',pcId:myPeerId,scope:'lobby'});
  const el=document.getElementById('lobby-chat-log');
  if(el){
    const div=document.createElement('div');
    div.style.cssText='padding:2px 0;font-size:11px;color:#ffff88';
    div.innerHTML=`<b>${_bwEscapeHtml(name)}(自):</b> [ロビー] ${_bwEscapeHtml(msg)}`;
    el.appendChild(div);el.scrollTop=el.scrollHeight;
  }
}
// ロビーチャット Enter 送信
document.getElementById('lobby-chat-input')?.addEventListener('keydown',e=>{
  e.stopPropagation();
  if(e.key==='Enter'){e.preventDefault();sendLobbyChat();}
});

// ページロード時にロビーチャットをポーリング開始
window.addEventListener('load',()=>{
  startLobbyChatPoll();
  // 設定を読み込んでカメラ等に反映
  const saved=_bwSafeJsonParse(bwStorage.get('bw_settings'), null);
  if(saved && typeof saved==='object'){
    currentSettings=Object.assign({}, currentSettings, saved);
    currentSettings.keys=Object.assign({}, DEFAULT_SETTINGS.keys, saved.keys||{});
  }
});

// ================================================================
//  v11: ダメージ数値表示 (Damage Indicators)
// ================================================================
function showDamageNumber(dmg, pos3d, color='#ff5555'){
  if(!currentSettings.dmgIndicator) return;
  if(!camera) return;
  const p=pos3d.clone().project(camera);
  const x=(p.x*0.5+0.5)*window.innerWidth;
  const y=(-(p.y)*0.5+0.5)*window.innerHeight;
  const el=document.createElement('div');
  el.textContent='-'+Math.round(dmg);
  el.style.cssText=`position:fixed;left:${x}px;top:${y}px;color:${color};font-size:18px;font-weight:bold;pointer-events:none;z-index:500;text-shadow:2px 2px 0 #000;transform:translate(-50%,-100%);transition:all 0.8s ease`;
  document.body.appendChild(el);
  requestAnimationFrame(()=>{
    el.style.top=(y-40)+'px';el.style.opacity='0';
  });
  setTimeout(()=>el.remove(),900);
}

// ================================================================
//  v11: CPS カウンター
// ================================================================
let _cpsClicks=[];
document.addEventListener('mousedown',()=>{
  _cpsClicks.push(Date.now());
  _cpsClicks=_cpsClicks.filter(t=>Date.now()-t<1000);
  const el=document.getElementById('cps-el');
  if(el) el.textContent=`${_cpsClicks.length} CPS`;
});

// ================================================================
//  v11: ブロック設置プレビュー（ワイヤーフレーム）
// ================================================================
let _previewMesh=null;
function updateBlockPreview(){
  if(!currentSettings.blockPreview){
    if(_previewMesh){scene.remove(_previewMesh);_previewMesh=null;}
    return;
  }
  if(!scene) return;
  const {ray}=_makeAimRay(6.0);
  const hits=ray.intersectObjects(allBlocks(),false);
  const hit=hits.find(h=>h.distance<=6.0&&!h.object.userData.isBed);
  if(hit){
    const px=Math.round(hit.point.x+hit.face.normal.x*0.5);
    const py=Math.round(hit.point.y+hit.face.normal.y*0.5);
    const pz=Math.round(hit.point.z+hit.face.normal.z*0.5);
    if(!_previewMesh){
      const geo=new THREE.BoxGeometry(1.01,1.01,1.01);
      const mat=new THREE.MeshBasicMaterial({color:0xffffff,wireframe:true,transparent:true,opacity:0.5});
      _previewMesh=new THREE.Mesh(geo,mat);
      scene.add(_previewMesh);
    }
    _previewMesh.position.set(px,py,pz);
    _previewMesh.visible=true;
  } else {
    if(_previewMesh) _previewMesh.visible=false;
  }
}

// ================================================================
//  v11: マウスホイールでスロット切替
// ================================================================
document.addEventListener('wheel',e=>{
  if(!currentSettings.scrollSlot) return;
  if(document.pointerLockElement){
    const dir=e.deltaY>0?1:-1;
    player.selectedIdx=((player.selectedIdx+dir)+9)%9;
    updateUI();
    if(typeof _updateHandItem==='function')_updateHandItem();
  }
});

let _fpsTimes=[]; let _fpsEl=null; let _frameTimeMs=0,_lastFrameTs=performance.now();
function initFPS(){
  _fpsEl=document.createElement('div');
  _fpsEl.id='fps-counter';
  _fpsEl.style.cssText='position:fixed;top:4px;left:4px;font-size:12px;color:#0f0;background:rgba(0,0,0,0.65);padding:6px 10px;border-radius:2px;z-index:200;font-family:monospace;display:none;line-height:1.5;white-space:pre';
  document.body.appendChild(_fpsEl);
}
function updateFPS(){
  if(!_fpsEl) return;
  const now=performance.now();
  _frameTimeMs=now-_lastFrameTs; _lastFrameTs=now;
  _fpsTimes=_fpsTimes.filter(t=>now-t<1000);
  _fpsTimes.push(now);

  if(_fpsEl.style.display==='none') return;

  // 精密デバッグ情報（本家F3画面準拠）
  const fps=_fpsTimes.length;
  const px=player.pos.x.toFixed(3), py=player.pos.y.toFixed(3), pz=player.pos.z.toFixed(3);
  const bx=Math.floor(player.pos.x), by=Math.floor(player.pos.y), bz=Math.floor(player.pos.z);
  const yawDeg=((controls.yaw*180/Math.PI)%360).toFixed(1);
  const pitchDeg=(controls.pitch*180/Math.PI).toFixed(1);
  const facing=['South','West','North','East'][Math.floor(((controls.yaw+Math.PI)/(Math.PI/2))%4+4)%4]||'?';
  const blockCount=(()=>{let c=0;blockMap.forEach(a=>c+=a.length);return c;})();
  const enemyCount=enemies.length;
  const mpCount=Object.keys(mpPlayers||{}).length;
  const vel=Math.sqrt(player.vel.x*player.vel.x+player.vel.z*player.vel.z).toFixed(3);
  const ground=player.onGround?'true':'false';
  const theme=currentMapTheme||'?';
  const memInfo=(performance.memory)?`${(performance.memory.usedJSHeapSize/1048576).toFixed(1)}/${(performance.memory.jsHeapSizeLimit/1048576).toFixed(0)} MB`:'N/A';

  _fpsEl.textContent=
`${fps} fps (${_frameTimeMs.toFixed(1)} ms) T: ${theme}
XYZ: ${px} / ${py} / ${pz}
Block: ${bx} ${by} ${bz}
Facing: ${facing} (${yawDeg}° / ${pitchDeg}°)
Vel(XZ): ${vel}  Ground: ${ground}
Blocks: ${blockCount}  Enemies: ${enemyCount}  MP: ${mpCount}
Mem: ${memInfo}  Mode: ${gameMode}`;
}
// F3でFPS/デバッグ表示切替
document.addEventListener('keydown',e=>{
  if(e.code==='F3'){e.preventDefault();if(_fpsEl)_fpsEl.style.display=_fpsEl.style.display==='none'?'block':'none';}
});
initFPS();

// ================================================================
//  v7.1: ミニマップ
// ================================================================
let _minimapCanvas=null, _minimapCtx=null;
let _minimapZoom=1.5; // クリックでズーム切替
const MINIMAP_ZOOMS=[1.0,1.5,2.5,4.0];
let _minimapZoomIdx=1;

function initMinimap(){
  const wrap=document.createElement('div');
  wrap.id='minimap-wrap';
  wrap.style.cssText='position:fixed;bottom:72px;right:10px;z-index:110;display:none;cursor:pointer';
  _minimapCanvas=document.createElement('canvas');
  _minimapCanvas.width=150; _minimapCanvas.height=150;
  _minimapCanvas.style.cssText='border:3px solid rgba(255,255,255,0.5);border-radius:50%;background:rgba(0,0,0,0.5);image-rendering:pixelated;box-shadow:0 2px 8px rgba(0,0,0,0.6)';
  _minimapCtx=_minimapCanvas.getContext('2d');
  wrap.appendChild(_minimapCanvas);
  // ズームレベル表示
  const zoomLabel=document.createElement('div');
  zoomLabel.id='minimap-zoom-label';
  zoomLabel.style.cssText='text-align:center;font-size:10px;color:#aaa;margin-top:2px';
  zoomLabel.textContent='ズーム: x'+MINIMAP_ZOOMS[_minimapZoomIdx];
  wrap.appendChild(zoomLabel);
  wrap.addEventListener('click',()=>{
    _minimapZoomIdx=(_minimapZoomIdx+1)%MINIMAP_ZOOMS.length;
    _minimapZoom=MINIMAP_ZOOMS[_minimapZoomIdx];
    zoomLabel.textContent='ズーム: x'+MINIMAP_ZOOMS[_minimapZoomIdx];
  });
  document.body.appendChild(wrap);
}

function drawMinimap(){
  if(!_minimapCtx||!_minimapCanvas) return;
  const ctx=_minimapCtx, W=150, SCALE=_minimapZoom;
  ctx.clearRect(0,0,W,W);
  ctx.fillStyle='rgba(0,30,0,0.75)';
  ctx.fillRect(0,0,W,W);

  const LIMIT=80;
  const cx=W/2, cz=W/2;
  const px=player.pos.x, pz=player.pos.z;

  // 地形グリッド
  ctx.strokeStyle='rgba(255,255,255,0.06)';
  for(let g=-LIMIT;g<=LIMIT;g+=20){
    const sx=cx+(g-px)/SCALE;
    ctx.beginPath();ctx.moveTo(sx,0);ctx.lineTo(sx,W);ctx.stroke();
    const sz=cz+(g-pz)/SCALE;
    ctx.beginPath();ctx.moveTo(0,sz);ctx.lineTo(W,sz);ctx.stroke();
  }

  // ブロック（設置済み、種別で色分け）
  blockMap.forEach((blks,key)=>{
    if(!blks||!blks[0]) return;
    const b=blks[0];
    const sx=cx+(b.position.x-px)/SCALE;
    const sz=cz+(b.position.z-pz)/SCALE;
    if(sx<0||sx>W||sz<0||sz>W) return;
    const t=b.userData?.type||'';
    ctx.fillStyle = t.startsWith('wool_')?(TEAM_COLOR_HEX[t.replace('wool_','').replace(/^./,c=>c.toUpperCase())]||'#c88'):
                    t==='end'?'#e8e0b0': t==='cobblestone'?'#999':
                    'rgba(100,80,60,0.8)';
    ctx.fillRect(sx-1.5,sz-1.5,3,3);
  });

  // チームスポーン地点（ベッド有無で色を変化：健在=チームカラー、破壊済み=グレー）
  const teams=teamMode===2?['Red','Blue']:['Red','Blue','Green','Yellow'];
  teams.forEach(t=>{
    const sp=TEAM_SPAWN[t]; if(!sp) return;
    const sx=cx+(sp.x-px)/SCALE, sz=cz+(sp.z-pz)/SCALE;
    if(sx<-8||sx>W+8||sz<-8||sz>W+8) return;
    const bedAlive=TEAM_BED_STATUS[t];
    ctx.fillStyle=bedAlive?(TEAM_COLOR_HEX[t]||'#fff'):'#555';
    ctx.beginPath();ctx.arc(sx,sz,6,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=bedAlive?'#fff':'#ff4444';ctx.lineWidth=1.5;ctx.stroke();
    ctx.fillStyle='#fff';ctx.font='bold 9px monospace';ctx.textAlign='center';
    ctx.fillText(bedAlive?t[0]:'✕',sx,sz+3);
  });

  // 敵AI（ソロモード）
  enemies.forEach(en=>{
    if(!en.userData||en.userData.isGolem) return;
    const sx=cx+(en.position.x-px)/SCALE, sz=cz+(en.position.z-pz)/SCALE;
    if(sx<0||sx>W||sz<0||sz>W) return;
    ctx.fillStyle=TEAM_COLOR_HEX[en.userData.team]||'#f55';
    ctx.beginPath();ctx.arc(sx,sz,2.5,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#000';ctx.lineWidth=0.5;ctx.stroke();
  });

  // MPプレイヤー（チーム色＋名前頭文字）
  Object.values(mpPlayers).forEach(p=>{
    const sx=cx+(p.x-px)/SCALE, sz=cz+(p.z-pz)/SCALE;
    if(sx<0||sx>W||sz<0||sz>W) return;
    ctx.fillStyle=TEAM_COLOR_HEX[p.team]||'#0ff';
    ctx.beginPath();ctx.arc(sx,sz,3.5,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#fff';ctx.lineWidth=0.8;ctx.stroke();
  });

  // 自分（中央、方向付き三角、常に最前面）
  ctx.fillStyle='#ffff00';
  ctx.save();ctx.translate(cx,cz);ctx.rotate(Math.PI-controls.yaw);
  ctx.beginPath();ctx.moveTo(0,-7);ctx.lineTo(-5,6);ctx.lineTo(5,6);ctx.closePath();ctx.fill();
  ctx.strokeStyle='#000';ctx.lineWidth=1;ctx.stroke();
  ctx.restore();

  // 世界制限ライン
  const limL=cx+(-LIMIT-px)/SCALE, limR=cx+(LIMIT-px)/SCALE;
  const limT=cz+(-LIMIT-pz)/SCALE, limB=cz+(LIMIT-pz)/SCALE;
  ctx.strokeStyle='rgba(255,50,50,0.6)';ctx.lineWidth=1.5;
  ctx.strokeRect(limL,limT,limR-limL,limB-limT);ctx.lineWidth=1;
}
// Mキーでミニマップ切替、Bキーでエモートメニュー
document.addEventListener('keydown',e=>{
  if(e.code==='KeyM'){const w=document.getElementById('minimap-wrap');if(w)w.style.display=w.style.display==='none'?'block':'none';}
  if(e.code==='KeyB'&&document.pointerLockElement&&!activeMenu&&gameMode!=='lobby'){toggleEmoteMenu();}
});
initMinimap();

// ================================================================
//  v9: 右腕 (DOCTYPE_html.html 方式)
//  カメラの子要素として追加、アイテム種別ごとに3Dメッシュ
// ================================================================
let _handGroup=null, _handMesh=null, _armMesh=null;
const _DEFAULT_HAND_POS={x:0.45,y:-0.38,z:-0.65};

// アイテム種別ごとの2Dキャンバス描画
function _drawHandItem(ctx, type){
  ctx.clearRect(0,0,16,16);
  const COLOR={
    wool:'#cc4444',wool_blue:'#4444cc',wool_green:'#44aa44',wool_yellow:'#eecc00',
    iron:'#bbbbbb',gold:'#eecc00',dia:'#55eeff',emerald:'#44ee88',
    iron_sword:'#cccccc',dia_sword:'#55eeff',
    bow:'#885522',arrow:'#886644',
    pick:'#888888',axe:'#aa7744',shears:'#aaaaaa',
    tnt:'#cc2222',enderpearl:'#226644',
    hp_pot:'#ff4466',speed:'#ffee44',jump:'#aaffaa',invis:'#aaaaff',
    bread:'#cc8833',steak:'#884422',golden_apple:'#ffdd00',
    helmet_iron:'#cccccc',chest_iron:'#cccccc',legs_iron:'#bbbbbb',boots_iron:'#aaaaaa',
    helmet_dia:'#55eeff',chest_dia:'#44ddee',legs_dia:'#33ccdd',boots_dia:'#22bbcc',
  };
  const c=COLOR[type]||'#888888';
  if(type&&type.includes('sword')){
    // 剣
    ctx.fillStyle=c;
    for(let i=0;i<9;i++){ctx.fillRect(6+i,8-i,2,2);}
    ctx.fillStyle='#885522';
    for(let i=2;i<14;i++){ctx.fillRect(i,15-i,1,1);}
    ctx.fillStyle='#555';ctx.fillRect(4,12,3,2);
  } else if(type==='bow'){
    ctx.strokeStyle='#885522';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.arc(8,8,5,Math.PI*0.3,Math.PI*1.7);ctx.stroke();
    ctx.strokeStyle='#eee';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(8,3);ctx.lineTo(8,13);ctx.stroke();
  } else if(type&&(type.includes('pick')||type.includes('axe'))){
    ctx.fillStyle='#885522';
    for(let i=2;i<13;i++){ctx.fillRect(i,15-i,1,1);}
    ctx.fillStyle=c;
    if(type.includes('pick')){ctx.fillRect(7,2,7,2);ctx.fillRect(12,3,2,6);}
    else {ctx.fillRect(7,2,6,4);ctx.fillRect(6,3,7,3);}
  } else if(type&&type.includes('helmet')){
    ctx.fillStyle=c;ctx.fillRect(3,3,10,8);ctx.clearRect(5,7,6,4);
  } else if(type&&type.includes('chest')){
    ctx.fillStyle=c;ctx.fillRect(2,3,12,9);ctx.clearRect(6,3,4,3);
  } else if(type&&type.includes('legs')){
    ctx.fillStyle=c;ctx.fillRect(3,3,10,10);ctx.clearRect(6,6,4,7);
  } else if(type&&type.includes('boots')){
    ctx.fillStyle=c;ctx.fillRect(3,8,4,6);ctx.fillRect(9,8,4,6);
  } else if(type&&type.startsWith('wool')){
    ctx.fillStyle=c;ctx.fillRect(1,1,14,14);
    ctx.fillStyle='rgba(0,0,0,0.15)';
    for(let i=0;i<5;i++){ctx.fillRect(Math.random()*14,Math.random()*14,2,2);}
  } else {
    // その他: 単色正方形
    ctx.fillStyle=c;ctx.fillRect(3,3,10,10);
  }
}

function _makeHandTexture(type){
  const c=document.createElement('canvas');c.width=16;c.height=16;
  _drawHandItem(c.getContext('2d'),type);
  const t=new THREE.CanvasTexture(c);
  t.magFilter=THREE.NearestFilter;t.minFilter=THREE.NearestFilter;
  return t;
}

// v26追記: 一人称視点の右腕(_armMesh)用マテリアルを作る関数。
// これが未定義だったため initRightArm() が呼び出された瞬間に
// ReferenceError で丸ごと失敗し、camera.add(_handGroup) まで
// 到達できず「一人称視点で右腕が全く表示されない」バグの原因になっていた。
// 呼び出し元は _partTex(44,20,4,12,...) のように「右腕UVの前面(front)矩形」を
// そのまま渡してくる想定なので、ここでは1枚の矩形を現在のスキン(_skinImage)から
// 切り出し、BoxGeometryの6面すべてに同じ前面テクスチャを貼る
// (一人称視点では前面しかまず見えないため、これで実用上十分)。
function _partTex(ox, oy, w, h, fallbackColor){
  const img = (typeof _skinImage!=='undefined' && _skinImage) ? _skinImage : null;
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,w); canvas.height=Math.max(1,h);
  const ctx=canvas.getContext('2d');
  ctx.imageSmoothingEnabled=false;
  if(img){
    try{ ctx.drawImage(img, ox, oy, w, h, 0, 0, w, h); }
    catch(e){ ctx.fillStyle=fallbackColor||'#cc9955'; ctx.fillRect(0,0,w,h); }
  } else {
    ctx.fillStyle=fallbackColor||'#cc9955'; ctx.fillRect(0,0,w,h);
  }
  const tex=new THREE.CanvasTexture(canvas);
  tex.magFilter=THREE.NearestFilter; tex.minFilter=THREE.NearestFilter;
  return new THREE.MeshLambertMaterial({map:tex});
}

function _hookRightArm(){
  // Compatibility hook used by the older UI bootstrap.
  // The actual first-person 3D arm is initialized by initRightArm().
  if(typeof initRightArm==='function') initRightArm();
}

function initRightArm(){
  if(!camera) return;
  if(_handGroup){
    try{camera.remove(_handGroup);}catch(e){}
    _handGroup=null; _armMesh=null; _handMesh=null;
  }
  _handGroup=new THREE.Group();

  // Same 64x64 skin UV mapping as the third HTML's player model.
  // This is a real six-face 3D arm, not a single-textured rectangular prism.
  if(typeof _createSkinBodyPart==='function'){
    const skinImg=(typeof _skinImage!=='undefined'&&_skinImage)?_skinImage:_getFallbackSkinImage();
    const armPart=_createSkinBodyPart(skinImg,40,16,4,12,4,40,32,-6,[]);
    armPart.scale.set(1/16,1/16,1/16);
    armPart.position.set(0,-0.08,0.02);
    armPart.rotation.set(-0.12,0.05,0.02);
    _armMesh=armPart;
    _handGroup.add(armPart);
  }else{
    const armGeo=new THREE.BoxGeometry(0.28,0.55,0.28);
    _armMesh=new THREE.Mesh(armGeo,_partTex(44,20,4,12,'#cc9955'));
    _armMesh.position.set(0,-0.15,0.05);
    _handGroup.add(_armMesh);
  }

  const geo=new THREE.BoxGeometry(0.35,0.35,0.35);
  const mat=new THREE.MeshLambertMaterial({color:0xffd5a0});
  _handMesh=new THREE.Mesh(geo,mat);
  _handMesh.name='first-person-held-item';
  _handGroup.add(_handMesh);

  _handGroup.position.set(_DEFAULT_HAND_POS.x,_DEFAULT_HAND_POS.y,_DEFAULT_HAND_POS.z);
  _handGroup.rotation.set(0.2,-0.35,0.1);
  camera.add(_handGroup);
  _updateHandItem();
}

function _updateHandItem(){
  if(!_handMesh) return;
  const item=player.inv[player.selectedIdx];
  if(!item||!item.type){
    // 素手（腕のみ表示、持ち物メッシュは非表示）
    _handMesh.visible=false;
    if(_armMesh) _armMesh.position.set(0,-0.15,0.05);
    _handGroup.rotation.set(0.2,-0.35,0.1);
    _handGroup.position.set(_DEFAULT_HAND_POS.x,_DEFAULT_HAND_POS.y,_DEFAULT_HAND_POS.z);
    return;
  }
  _handMesh.visible=true;
  const type=item.type;
  if(type.includes('sword')||type.includes('pick')||type.includes('axe')||type==='shears'){
    // ツール: 縦長、腕の先に握らせる
    _handMesh.geometry=new THREE.BoxGeometry(0.12,0.6,0.08);
    _handMesh.material=new THREE.MeshLambertMaterial({map:_makeHandTexture(type)});
    _handMesh.position.set(0,0.15,-0.2);
    _handGroup.rotation.set(-0.3,-0.4,0.2);
  } else if(type==='bow'){
    _handMesh.geometry=new THREE.BoxGeometry(0.08,0.5,0.05);
    _handMesh.material=new THREE.MeshLambertMaterial({map:_makeHandTexture('bow')});
    _handMesh.position.set(0,0.1,-0.2);
    _handGroup.rotation.set(0.1,-0.5,0.15);
  } else {
    // ブロック・アイテム: 正方形、腕の先に持たせる
    _handMesh.geometry=new THREE.BoxGeometry(0.3,0.3,0.3);
    _handMesh.material=new THREE.MeshLambertMaterial({map:_makeHandTexture(type)});
    _handMesh.position.set(0,0.12,-0.18);
    _handGroup.rotation.set(0.2,-0.35,0.1);
  }
  _handGroup.position.set(_DEFAULT_HAND_POS.x,_DEFAULT_HAND_POS.y,_DEFAULT_HAND_POS.z);
}

function _swingHand(){
  if(!_handGroup) return;
  _handGroup.rotation.x=-0.9;
  _handGroup.position.z=_DEFAULT_HAND_POS.z+0.2;
  setTimeout(()=>{
    if(!_handGroup) return;
    _handGroup.position.z=_DEFAULT_HAND_POS.z;
    _handGroup.rotation.x=0.2;
  },120);
}

function _animateHandBob(time){
  if(!_handGroup) return;
  const crouchOffset = player.isCrouching ? -0.05 : 0;
  _handGroup.position.y=_DEFAULT_HAND_POS.y+crouchOffset+Math.sin(time*0.003)*0.008;
}

// ================================================================
//  v9: 弓チャージシステム (右クリック長押しでチャージ→離してで発射)
// ================================================================
let _bowCharging=false, _bowChargeStart=0, _bowChargeEl=null;

function initBowCharge(){
  _bowChargeEl=document.createElement('div');
  _bowChargeEl.id='bow-charge';
  _bowChargeEl.style.cssText='position:fixed;bottom:120px;left:50%;transform:translateX(-50%);display:none;z-index:95;background:rgba(0,0,0,0.7);border-radius:4px;padding:4px 12px;color:#fff;font-size:13px;min-width:160px;text-align:center';
  _bowChargeEl.innerHTML='<div style="font-size:11px;color:#aaa;margin-bottom:3px">🏹 チャージ中...</div><div id="bow-bar" style="height:8px;background:#555;border-radius:4px;overflow:hidden"><div id="bow-fill" style="height:100%;background:#44ff44;width:0%;transition:none"></div></div><div id="bow-pct-old" style="font-size:12px;color:#fff;margin-top:3px">0%</div>';
  document.body.appendChild(_bowChargeEl);
}

function startBowCharge(){
  const item=player.inv[player.selectedIdx];
  if(!item||item.type!=='bow') return;
  _bowCharging=true;
  _bowChargeStart=Date.now();
  if(_bowChargeEl) _bowChargeEl.style.display='block';
  const v2=document.getElementById('bow-charge-v2'); if(v2)v2.style.display='block';
  // 弓を引くアニメーション
  if(_handGroup){_handGroup.rotation.x=0.6;_handGroup.position.z=_DEFAULT_HAND_POS.z-0.1;}
}

function releaseBow(){
  if(!_bowCharging) return;
  _bowCharging=false;
  const chargeTime=Math.min((Date.now()-_bowChargeStart)/2000,1.0); // 最大2秒でフルチャージ
  if(_bowChargeEl) _bowChargeEl.style.display='none';
  const v2=document.getElementById('bow-charge-v2'); if(v2)v2.style.display='none';
  if(_handGroup){_handGroup.rotation.x=0.2;_handGroup.position.z=_DEFAULT_HAND_POS.z;}
  if(chargeTime>0.1) fireBowArrow(chargeTime);
}

function fireBowArrow(charge){
  // 矢を発射（シンプルなプロジェクタイル）
  const dmg=Math.floor(4+charge*6); // 4〜10ダメージ
  const dir=new THREE.Vector3(0,0,-1).applyEuler(new THREE.Euler(controls.pitch,controls.yaw,0,'YXZ'));
  // 矢メッシュ
  const arrowGeo=new THREE.BoxGeometry(0.05,0.05,0.5);
  const arrowMat=new THREE.MeshLambertMaterial({color:0x886644});
  const arrow=new THREE.Mesh(arrowGeo,arrowMat);
  arrow.position.set(camera.position.x,camera.position.y,camera.position.z);
  arrow.lookAt(arrow.position.clone().add(dir));
  scene.add(arrow);
  // 矢の飛行
  const spd=0.6+charge*0.5;
  let t=0;
  const fly=setInterval(()=>{
    t+=0.05;
    arrow.position.add(dir.clone().multiplyScalar(spd));
    arrow.position.y-=0.01*t; // 重力落下
    // 当たり判定 (敵・地面)
    let hit=false;
    enemies.forEach(e=>{
      if(e.position.distanceTo(arrow.position)<1.2){
        e.userData.hp-=dmg;
        if(e.userData.hp<=0)killEnemy(e);
        hit=true;
      }
    });
    if(!hit&&gameMode==='multi'){
      for(const [uid,m] of Object.entries(mpMeshes)){
        if(!m||m.userData?.team===player.team)continue;
        if(m.position.distanceTo(arrow.position)<1.0){
          sendDamageSupabase(uid,dmg,'bow');
          showDamageNumber(dmg,m.position.clone().add(new THREE.Vector3(0,1.6,0)),'#ff5555');
          sbRequest({action:'actionEvent',uid:myPeerId,actionType:'attack',itemType:'bow',x:player.pos.x,y:player.pos.y+1.2,z:player.pos.z,yaw:controls.yaw,pitch:controls.pitch,payload:{charge}});
          hit=true;break;
        }
      }
    }
    if(t>60||hit||arrow.position.y<-10){
      clearInterval(fly);
      scene.remove(arrow);
    }
  },50);
  // マルチ: ダメージ送信は別で行う
  announce(`🏹 ${Math.round(charge*100)}% チャージ!`,'#ffaa00');
}

// ================================================================
//  v7.1: フレンドリスト UI（ロビー画面）
// ================================================================
// ================================================================
//  フレンド & ランキング UI v9
//  - プレイヤー名検索でフレンド追加
//  - フレンドリストにスキン顔アイコン表示
//  - ランキングTop20
// ================================================================
function openFriendUI(){
  let panel=document.getElementById('friend-panel');
  if(panel){panel.remove();return;}
  panel=document.createElement('div');
  panel.id='friend-panel';
  panel.style.cssText='position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:2000;background:#111;border:3px solid #444;padding:20px;min-width:400px;max-height:80vh;overflow-y:auto;border-radius:6px;box-shadow:0 8px 32px rgba(0,0,0,0.9)';
  panel.innerHTML=`
    <h3 style="color:#FFAA00;margin:0 0 12px;font-size:20px;text-align:center">👥 フレンド & ランキング</h3>
    <div style="display:flex;gap:8px;margin-bottom:12px">
      <button class="mc-btn" onclick="loadFriendTab('friends')" style="flex:1;font-size:14px">🤝 フレンド</button>
      <button class="mc-btn" onclick="loadFriendTab('search')" style="flex:1;font-size:14px">🔍 検索</button>
      <button class="mc-btn" onclick="loadFriendTab('ranking')" style="flex:1;font-size:14px">🏆 ランキング</button>
    </div>
    <div id="friend-search-box" style="display:none;margin-bottom:8px">
      <div style="display:flex;gap:6px">
        <input type="text" id="friend-search-input" placeholder="プレイヤー名で検索..." style="flex:1;padding:7px;background:#222;color:#fff;border:1px solid #555;border-radius:3px;font-size:13px;outline:none">
        <button class="mc-btn" onclick="doFriendSearch()" style="font-size:13px">検索</button>
      </div>
      <div id="friend-search-results" style="margin-top:8px"></div>
    </div>
    <div id="friend-content" style="min-height:160px;color:#ccc;font-size:13px">読み込み中...</div>
    <button class="mc-btn btn-red" onclick="document.getElementById('friend-panel').remove()" style="width:100%;margin-top:12px;font-size:17px">✕ 閉じる</button>
  `;
  document.body.appendChild(panel);
  loadFriendTab('friends');
}

function _skinFaceImg(skinDataUrl){
  return new Promise(resolve=>{
    const safe=_bwSafeImageSource(skinDataUrl);
    if(!safe){resolve(null);return;}
    const img=new Image();
    img.crossOrigin='anonymous';
    img.onload=()=>{
      try{
        const c=document.createElement('canvas');c.width=16;c.height=16;
        const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;
        ctx.drawImage(img,8,8,8,8,0,0,16,16);
        resolve(c.toDataURL());
      }catch(e){resolve(null);}
    };
    img.onerror=()=>resolve(null);
    img.src=safe;
  });
}

async function _friendCard(f){
  const tc=f.online?'#55ff55':'#888';
  const uidArg=_bwEncodeArg(f.uid);
  const nameArg=_bwEncodeArg(f.name);
  let faceHtml='<div style="width:32px;height:32px;background:#333;border-radius:2px;border:1px solid #555;display:flex;align-items:center;justify-content:center;font-size:18px">👤</div>';
  if(f.skin){
    const face=await _skinFaceImg(f.skin);
    if(face) faceHtml=`<img src="${_bwEscapeHtml(face)}" style="width:32px;height:32px;image-rendering:pixelated;border-radius:2px;border:1px solid #555">`;
  }
  return `<div style="display:flex;align-items:center;gap:10px;padding:7px;border-bottom:1px solid #1e1e1e">
    ${faceHtml}
    <div style="flex:1">
      <div style="color:#fff;font-weight:bold;font-size:14px">${_bwEscapeHtml(f.name)}</div>
      <div style="font-size:11px;color:${tc}">${f.online?'● オンライン':'○ オフライン'}</div>
      <div style="font-size:11px;color:#888">⚔${Number(f.kills)||0} 🏆${Number(f.wins)||0} Lv${Number(f.level)||1}</div>
    </div>
    <button onclick="removeFriendAction(decodeURIComponent('${uidArg}'),decodeURIComponent('${nameArg}'))" style="padding:3px 8px;background:#cc3333;color:#fff;border:none;border-radius:2px;cursor:pointer;font-size:11px">削除</button>
  </div>`;
}

async function loadFriendTab(tab){
  const el=document.getElementById('friend-content');
  const sb=document.getElementById('friend-search-box');
  if(!el) return;
  if(sb) sb.style.display=(tab==='search')?'block':'none';
  el.innerHTML='<div style="color:#888;text-align:center;padding:20px">読み込み中...</div>';

  if(tab==='ranking'){
    const res=await sbRequest({action:'getHistory'});
    if(!res||!res.ok||!res.history){el.innerHTML='<div style="color:#f55;text-align:center">取得失敗</div>';return;}
    el.innerHTML='<table style="width:100%;border-collapse:collapse;font-size:13px">'+
      '<tr style="border-bottom:1px solid #444;color:#ffaa00"><th style="text-align:left;padding:4px">#</th><th>名前</th><th>⚔KILL</th><th>🏆勝利</th><th>Lv</th></tr>'+
      res.history.slice(0,20).map((p,i)=>`<tr style="border-bottom:1px solid #222;${p.name===player.name?'background:rgba(255,170,0,0.12)':''}">
        <td style="color:#888;padding:4px;text-align:center">${i+1}</td>
        <td style="color:${p.name===player.name?'#ffaa00':'#ddd'};padding:4px">${_bwEscapeHtml(p.name)}</td>
        <td style="color:#ff7777;text-align:center">${Number(p.kills)||0}</td>
        <td style="color:#77ff77;text-align:center">${Number(p.wins)||0}</td>
        <td style="color:#77ffff;text-align:center">${Number(p.level)||1}</td>
      </tr>`).join('')+'</table>';

  } else if(tab==='friends'){
    const res=await sbRequest({action:'getFriends',uid:myPeerId});
    if(!res||!res.ok){el.innerHTML='<div style="color:#f55;text-align:center">取得失敗</div>';return;}
    const friends=res.friends||[];
    if(!friends.length){
      el.innerHTML='<div style="color:#888;text-align:center;padding:20px">フレンドがいません<br><small style="color:#666">「検索」タブでプレイヤーを検索して追加しましょう</small></div>';
      return;
    }
    el.innerHTML='<div style="color:#888;font-size:11px;margin-bottom:6px">フレンド '+friends.length+'人</div>';
    const cards=await Promise.all(friends.map(f=>_friendCard(f)));
    el.innerHTML+='<div>'+cards.join('')+'</div>';

  } else if(tab==='search'){
    el.innerHTML='<div style="color:#888;text-align:center;padding:12px">プレイヤー名を入力して検索してください</div>';
  }
}

async function doFriendSearch(){
  const inp=document.getElementById('friend-search-input');
  const res2=document.getElementById('friend-search-results');
  if(!inp||!res2) return;
  const kw=inp.value.trim();
  if(!kw){res2.innerHTML='<div style="color:#f55;font-size:12px">キーワードを入力してください</div>';return;}
  res2.innerHTML='<div style="color:#888;font-size:12px">検索中...</div>';
  const res=await sbRequest({action:'searchPlayers',uid:myPeerId,keyword:kw});
  if(!res||!res.ok){res2.innerHTML='<div style="color:#f55;font-size:12px">検索失敗</div>';return;}
  if(!res.results||!res.results.length){res2.innerHTML='<div style="color:#888;font-size:12px">見つかりませんでした</div>';return;}
  res2.innerHTML=res.results.map(p=>{
    const uidArg=_bwEncodeArg(p.uid);
    const nameArg=_bwEncodeArg(p.name);
    return `
    <div style="display:flex;align-items:center;gap:8px;padding:6px;border-bottom:1px solid #222">
      <div style="flex:1">
        <span style="color:#fff;font-weight:bold">${_bwEscapeHtml(p.name)}</span>
        <span style="color:#888;font-size:11px;margin-left:6px">⚔${Number(p.kills)||0} Lv${Number(p.level)||1}</span>
      </div>
      <button onclick="addFriendAction(decodeURIComponent('${uidArg}'),decodeURIComponent('${nameArg}'))" style="padding:4px 10px;background:#225599;color:#fff;border:none;border-radius:2px;cursor:pointer;font-size:12px">+追加</button>
    </div>`;
  }).join('');
}

async function addFriendAction(uid,name){
  const res=await sbRequest({action:'addFriend',uid:myPeerId,targetUid:uid,targetName:name});
  if(res&&res.ok){announce('✅ '+name+' をフレンド追加しました','#55ff55');loadFriendTab('friends');}
  else announce('⚠️ '+(res?.error||'追加失敗'),'#ff5555');
}

async function removeFriendAction(uid,name){
  if(!confirm(name+' をフレンドから削除しますか？'))return;
  const res=await sbRequest({action:'removeFriend',uid:myPeerId,targetUid:uid});
  if(res&&res.ok){announce('🗑 '+name+' を削除しました','#ffaa00');loadFriendTab('friends');}
}


// ロビー画面にフレンドボタン追加
window.addEventListener('load',()=>{
  setTimeout(()=>{
    const lb=document.getElementById('lobby');
    if(lb){
      const btn=document.createElement('button');
      btn.className='mc-btn btn-gold';
      btn.textContent='👥 フレンド & ランキング';
      btn.style.cssText='font-size:18px;margin-top:6px';
      btn.onclick=openFriendUI;
      const lp=lb.querySelector('.lobby-panel');
      if(lp) lp.appendChild(btn);
    }
    initFPS();
    _hookRightArm();
  },500);
});

// ================================================================
//  v7.1: 世界制限（WORLD_LIMIT範囲外は押し戻す）
// ================================================================
const WORLD_LIMIT=85;
function enforceWorldLimit(){
  if(player.spectatorMode) return;
  const LIMIT=WORLD_LIMIT;
  if(player.pos.x>LIMIT){ player.pos.x=LIMIT; player.vel.x=0; }
  if(player.pos.x<-LIMIT){ player.pos.x=-LIMIT; player.vel.x=0; }
  if(player.pos.z>LIMIT){ player.pos.z=LIMIT; player.vel.z=0; }
  if(player.pos.z<-LIMIT){ player.pos.z=-LIMIT; player.vel.z=0; }
  if(player.pos.y<-20){ // 落下死
    if(!player.isDead){
      player.hp=0;
      applyDamage(player.hp);
    }
  }
}
