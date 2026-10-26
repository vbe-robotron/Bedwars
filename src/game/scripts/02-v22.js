
(function(){
'use strict';

/* ---------------------------------------------------------------
   1. スキン向き修正
   v22前半では modelGroup.rotation.y=Math.PI になっていたため、
   skin_view.html の座標系をそのまま使い、固定180度反転を解除。
   物理・座標計算には触れない。
---------------------------------------------------------------- */
const _v22OldCreateSkin = window.createSimplePlayerMesh;
if(typeof _v22OldCreateSkin==='function' && !window.__v22SkinFixed){
  window.__v22SkinFixed=true;
  window.createSimplePlayerMesh=function(color,img){
    const m=_v22OldCreateSkin(color,img);
    const model=m?.children?.find(c=>c?.type==='Group' && c!==m);
    if(model) model.rotation.y=0;
    return m;
  };
}

/* ---------------------------------------------------------------
   2. BOT専用スキン
   プレイヤーのスキンを参照しない。設定からPNGを読み込み、
   localStorageへ保存。spawnAI内部のDream fallbackへ差し込む。
---------------------------------------------------------------- */
let _v22BotSkinData=_bwSafeImageSource(bwStorage.get('bw_bot_skin'))||'';
let _v22BotSkinImage=null;

function _v22LoadBotSkin(data,cb){
  const safe=_bwSafeImageSource(data);
  if(!safe){_v22BotSkinImage=null;cb&&cb();return;}
  const img=new Image();
  img.onload=()=>{_v22BotSkinImage=img;cb&&cb();};
  img.onerror=()=>{_v22BotSkinImage=null;cb&&cb();};
  img.src=safe;
}

if(_v22BotSkinData) _v22LoadBotSkin(_v22BotSkinData);

function _v22BuildBotSkinUI(){
  const settings=document.getElementById('settings-panel');
  if(!settings || document.getElementById('v22-bot-skin-row')) return;
  const cols=settings.querySelectorAll('div[style*="display:grid"]');
  const target=cols.length?cols[cols.length-1]:settings;
  const row=document.createElement('div');
  row.id='v22-bot-skin-row';
  row.innerHTML=`
    <div style="color:#ffaa00;font-size:14px;margin-bottom:5px">🤖 BOT専用スキン</div>
    <div style="color:#999;font-size:11px;margin-bottom:6px">
      プレイヤーのスキンとは独立しています。PNGを選ぶと、以後のBOTに使用します。
    </div>
    <input id="v22-bot-skin-file" type="file" accept="image/png">
    <button class="mc-btn" id="v22-bot-skin-clear" style="font-size:12px;padding:4px 9px">デフォルトに戻す</button>
    <span id="v22-bot-skin-status" style="font-size:11px;color:#55ff55;margin-left:6px"></span>`;
  target.appendChild(row);
  row.querySelector('#v22-bot-skin-file').addEventListener('change',e=>{
    const f=e.target.files?.[0]; if(!f)return;
    const rd=new FileReader();
    rd.onload=ev=>{
      const safe=_bwSafeImageSource(ev.target.result);
      if(!safe){announce('⚠️ 画像ファイルを読み込めませんでした','#ff5555');return;}
      _v22BotSkinData=safe;
      bwStorage.set('bw_bot_skin',_v22BotSkinData);
      _v22LoadBotSkin(_v22BotSkinData,()=>{
        row.querySelector('#v22-bot-skin-status').textContent='読み込み済み';
        announce('🤖 BOTスキンを更新しました','#55ffff');
      });
    };
    rd.readAsDataURL(f);
  });
  row.querySelector('#v22-bot-skin-clear').onclick=()=>{
    _v22BotSkinData='';_v22BotSkinImage=null;
    bwStorage.remove('bw_bot_skin');
    row.querySelector('#v22-bot-skin-status').textContent='デフォルト';
    announce('🤖 BOTスキンをデフォルトへ戻しました','#ffaa00');
  };
}
window.addEventListener('load',()=>setTimeout(_v22BuildBotSkinUI,600));

/* spawnAI前にBOTスキンを差し込む。元のAIロジックは維持。 */
const _v22OldLoadDream=window._loadDreamSkin;
if(typeof _v22OldLoadDream==='function' && !window.__v22BotHook){
  window.__v22BotHook=true;
  window._loadDreamSkin=function(cb){
    if(_v22BotSkinImage){
      window._dreamSkinImage=_v22BotSkinImage;
      cb&&cb();
      return;
    }
    _v22OldLoadDream(cb);
  };
}

/* ---------------------------------------------------------------
   3. デバッグ表示
   設定の「FPS/座標表示」と独立して、詳細デバッグを任意で表示。
---------------------------------------------------------------- */
let _v22Debug=false;
function _v22DebugPanel(){
  let p=document.getElementById('v22-debug-panel');
  if(!p){
    p=document.createElement('div');p.id='v22-debug-panel';document.body.appendChild(p);
  }
  p.style.display=_v22Debug?'block':'none';
}
function _v22UpdateDebug(){
  if(!_v22Debug)return;
  const p=document.getElementById('v22-debug-panel');if(!p)return;
  const vel=player?.vel?`${player.vel.x.toFixed(3)}, ${player.vel.y.toFixed(3)}, ${player.vel.z.toFixed(3)}`:'-';
  const item=player?.inv?.[player.selectedIdx];
  const rt=typeof _supabaseRealtimeChannels!=='undefined'?_supabaseRealtimeChannels.length:0;
  const dropsN=typeof drops!=='undefined'?drops.length:0;
  p.textContent=
`V22 DEBUG
Mode: ${gameMode}
Match: ${currentMatchId||'-'}
Theme: ${currentMapTheme}
Seed: ${currentMapSeed||0}
Player: ${player.name}
XYZ: ${player.pos.x.toFixed(3)} / ${player.pos.y.toFixed(3)} / ${player.pos.z.toFixed(3)}
Yaw/Pitch: ${(controls.yaw*180/Math.PI).toFixed(1)} / ${(controls.pitch*180/Math.PI).toFixed(1)}
Head: ${player.isCrouching?'CROUCH':'STAND'} ${player.isSprinting?'SPRINT':''} ${player.isDead?'DEAD':''}
Vel: ${vel}
HP: ${Math.ceil(player.hp)}/${Math.ceil(player.maxHp)}
Held: ${item?.type||'-'} x${item?.count||0}
MP: ${Object.keys(mpPlayers||{}).length}
AI: ${typeof enemies!=='undefined'?enemies.length:0}
Drops: ${dropsN}
Blocks: ${typeof blockMap!=='undefined'?blockMap.size:0}
Realtime channels: ${rt}
FOV: ${camera?.fov?.toFixed(1)||'-'}`;
}
setInterval(_v22UpdateDebug,250);

/* ---------------------------------------------------------------
   4. 対戦中ショートカット
   デフォルト:
   V = FOV切替
   F3 = 詳細デバッグ
   設定で変更可能な既存keybindにも対応。
---------------------------------------------------------------- */
const _v22Fovs=[60,70,80,90,100,110];
let _v22FovIdx=1;
function _v22CycleFov(){
  _v22FovIdx=(_v22FovIdx+1)%_v22Fovs.length;
  const f=_v22Fovs[_v22FovIdx];
  if(typeof currentSettings!=='undefined'){
    currentSettings.fov=f;
    const el=document.getElementById('set-fov');if(el)el.value=f;
    const lb=document.getElementById('lbl-fov');if(lb)lb.textContent=f;
    if(typeof applySettingEffects==='function')applySettingEffects();
  }
  announce(`👁 FOV ${f}°`,'#55ffff');
}
document.addEventListener('keydown',e=>{
  if(e.repeat)return;
  if(e.code==='F3'){
    _v22Debug=!_v22Debug;_v22DebugPanel();
    return;
  }
  const fovKey=(typeof currentSettings!=='undefined'&&currentSettings.keys?.toggleFov)||'KeyV';
  const dbgKey=(typeof currentSettings!=='undefined'&&currentSettings.keys?.toggleDebug)||'F3';
  if(e.code===fovKey){e.preventDefault();_v22CycleFov();}
  if(e.code===dbgKey && dbgKey!=='F3'){e.preventDefault();_v22Debug=!_v22Debug;_v22DebugPanel();}
});

/* ---------------------------------------------------------------
   5. バイオーム強化
   既存のcreateWorldを残し、その後に「中央〜中間帯」へ
   テーマ固有の地形/構造物を追加する。Seed生成をそのまま利用。
---------------------------------------------------------------- */
function _v22Add(x,y,z,type){
  if(typeof blockMap==='undefined'||typeof addBlock!=='function')return;
  const k=blockKey(x,y,z);
  if(!blockMap.has(k))addBlock(x,y,z,type,false);
}
function _v22BiomeLandmarks(){
  const t=currentMapTheme, y=61;
  const add=_v22Add;
  const ring=[
    [-22,-10],[-10,-22],[22,10],[10,22],
    [-22,10],[-10,22],[22,-10],[10,-22]
  ];
  if(t==='grassland'){
    // 小さな丘・石橋・遺跡
    ring.slice(0,4).forEach(([x,z],i)=>{
      const h=2+(i%3);
      for(let yy=0;yy<h;yy++)for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)
        if(Math.abs(dx)+Math.abs(dz)<2)add(x+dx,y+yy,z+dz,yy===h-1?'grass':'stone');
    });
    for(let x=-20;x<=20;x+=2)add(x,y,Math.round(Math.sin(x*.25)*4),'cobblestone');
  }else if(t==='desert'){
    // 砂丘・峡谷・小神殿
    for(let i=0;i<5;i++){
      const cx=-20+i*10,cz=Math.round(Math.sin(i*1.7)*12);
      for(let r=0;r<4;r++)for(let x=-r;x<=r;x++)for(let z=-r;z<=r;z++)
        if(Math.abs(x)+Math.abs(z)<=r+1)add(cx+x,y+r,cz+z,r%2?'sand':'sandstone');
    }
    const cx=18,cz=-15;
    for(let h=0;h<5;h++)for(let x=-3+h/2;x<=3-h/2;x++)for(let z=-3+h/2;z<=3-h/2;z++)
      if(Math.abs(x)>1||Math.abs(z)>1)add(Math.round(cx+x),y+h,Math.round(cz+z),'sandstone');
  }else if(t==='snow'){
    // 樹氷群 + 氷のアーチ
    [[-20,-12],[-12,20],[20,12],[12,-20]].forEach(([cx,cz],i)=>{
      const h=7+i%3;
      for(let yy=0;yy<h;yy++){
        const r=Math.max(0,Math.floor((h-yy)/3));
        for(let x=-r;x<=r;x++)for(let z=-r;z<=r;z++)add(cx+x,y+yy,cz+z,'packed_ice');
      }
    });
    for(let x=-7;x<=7;x++)add(x,y+3,20-Math.abs(x),'ice');
  }else if(t==='nether'){
    // 玄武岩風の柱・魂の砂地帯
    [[-20,-12],[-12,20],[20,12],[12,-20]].forEach(([cx,cz],i)=>{
      const h=5+i%4;
      for(let yy=0;yy<h;yy++)for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)
        add(cx+dx,y+yy,cz+dz,yy%2?'netherrack':'nether_brick');
    });
    for(let x=-18;x<=18;x+=2)add(x,y,Math.round(Math.sin(x*.3)*6),'soul_sand');
  }else if(t==='end'){
    // 浮遊感のある柱列・空洞を意識した遺跡
    [[-20,-14],[-14,20],[20,14],[14,-20]].forEach(([cx,cz],i)=>{
      const h=8+i%4;
      for(let yy=0;yy<h;yy++){
        const r=Math.max(0,2-Math.floor(yy/4));
        for(let x=-r;x<=r;x++)for(let z=-r;z<=r;z++)add(cx+x,y+yy,cz+z,'end');
      }
      add(cx,y+h,cz,'emerald');
    });
    for(let x=-16;x<=16;x+=2)add(x,y,Math.round(Math.cos(x*.35)*10),'end');
  }else if(t==='mushroom'){
    // 巨大キノコの森と段丘
    [[-20,-10],[-10,20],[20,10],[10,-20]].forEach(([cx,cz],i)=>{
      const h=6+i%3;
      for(let yy=0;yy<h;yy++)add(cx,y+yy,cz,'log');
      for(let dx=-4;dx<=4;dx++)for(let dz=-4;dz<=4;dz++)
        if(dx*dx+dz*dz<=16)add(cx+dx,y+h,cz+dz,i%2?'wool_red':'mycelium');
    });
  }else if(t==='mesa'){
    // メサの層状峡谷と岩柱
    [[-20,-12],[-12,20],[20,12],[12,-20]].forEach(([cx,cz],i)=>{
      const h=8+i%4;
      for(let yy=0;yy<h;yy++)for(let dx=-2;dx<=2;dx++)
        add(cx+dx,y+yy,cz,yy%3===0?'red_sand':'terracotta');
    });
    for(let x=-18;x<=18;x+=2){
      const z=Math.round(Math.sin(x*.25)*7);
      add(x,y,z,'terracotta');add(x,y+1,z,'red_sand');
    }
  }
}
const _v22OldCreateWorld=window.createWorld;
if(typeof _v22OldCreateWorld==='function' && !window.__v22WorldHook){
  window.__v22WorldHook=true;
  window.createWorld=function(){
    const r=_v22OldCreateWorld.apply(this,arguments);
    if(gameMode!=='training_bridge'&&gameMode!=='training_parkour')_v22BiomeLandmarks();
    return r;
  };
}

/* ---------------------------------------------------------------
   6. 練習場を再構築
   - 複雑なルート
   - 安全なリスポーン土台
   - 記録/ベスト記録
   - リスポーン時に必ず安全床へ戻す
---------------------------------------------------------------- */
let _v22Training={
  type:null,start:0,attempt:0,deaths:0,best:null,
  spawn:new THREE.Vector3(),startPos:new THREE.Vector3(),
  courseEnd:new THREE.Vector3()
};
function _v22TrainingKey(type){return 'bw_training_'+type+'_best';}
function _v22TrainingLoadBest(type){
  const v=Number(bwStorage.get(_v22TrainingKey(type))||0);
  return v>0?v:null;
}
function _v22TrainingSave(type,ms){
  const key=_v22TrainingKey(type),old=_v22TrainingLoadBest(type);
  if(!old||ms<old){bwStorage.set(key,String(ms));return true;}
  return false;
}
function _v22TrainingHud(){
  let p=document.getElementById('v22-training-panel');
  if(!p){p=document.createElement('div');p.id='v22-training-panel';document.body.appendChild(p);}
  const type=_v22Training.type==='bridge'?'🧱 ブリッジ':'🏃 パルクール';
  const elapsed=_v22Training.start?((performance.now()-_v22Training.start)/1000):0;
  const best=_v22Training.best?(_v22Training.best/1000).toFixed(3)+'s':'--';
  p.style.display='block';
  p.innerHTML=`<b>${type}練習</b>　試行 ${_v22Training.attempt}　死亡 ${_v22Training.deaths}<br>
    <span class="record">TIME ${elapsed.toFixed(3)}s</span>　
    <span class="best">BEST ${best}</span><br>
    <small>リスポーンは必ずスタート土台へ戻ります</small>`;
}
function _v22FinishTraining(){
  if(!_v22Training.start)return;
  const ms=Math.round(performance.now()-_v22Training.start);
  const newBest=_v22TrainingSave(_v22Training.type,ms);
  _v22Training.best=_v22TrainingLoadBest(_v22Training.type);
  announce(newBest?`🏆 NEW BEST ${(ms/1000).toFixed(3)}s`:`⏱ ${(ms/1000).toFixed(3)}s`,newBest?'#55ff55':'#55ffff');
  _v22Training.start=performance.now();
  _v22Training.attempt++;
}
function _v22SafeTrainingRespawn(){
  if(!_v22Training.type)return false;
  player.isDead=false;player.spectatorMode=false;player.spectatorTime=0;
  player.hp=player.maxHp;player.hunger=20;player.vel.set(0,0,0);
  player.pos.copy(_v22Training.spawn);
  player.respawnProtection=1.2;
  _v22Training.deaths++;
  _v22Training.start=performance.now();
  _v22Training.attempt++;
  _v22TrainingHud();
  return true;
}
function _v22CreateTrainingWorld(type){
  const baseY=60;
  // 広い安全なスタート土台
  for(let x=-14;x<=-5;x++)for(let z=-5;z<=5;z++)addBlock(x,baseY,z,'stone',false);
  _v22Training.type=type;
  _v22Training.spawn.set(-9,baseY+1.05,0);
  _v22Training.startPos.copy(_v22Training.spawn);
  _v22Training.attempt=1;_v22Training.deaths=0;_v22Training.best=_v22TrainingLoadBest(type);
  _v22Training.start=performance.now();

  if(type==='bridge'){
    // 3種類のブリッジ: 直線/蛇行/高さ変化
    for(let x=-4;x<=34;x++){
      const z=Math.round(Math.sin(x*.35)*2);
      const y=baseY+1+Math.floor(Math.max(0,x-10)/12);
      addBlock(x,y,z,'wool_blue',false);
      if(x%6===0)for(let dz=-1;dz<=1;dz++)addBlock(x,y,z+dz,'stone',false);
    }
    for(let x=6;x<=26;x+=4){
      const y=baseY+2+Math.floor((x-6)/8);
      addBlock(x,y,6,'wool_green',false);
      if(x<24)addBlock(x+1,y+1,6,'wool_green',false);
    }
    _v22Training.courseEnd.set(34,baseY+2,0);
  }else{
    // パルクール: 高低差、横ずれ、階段、ギャップを組み合わせる
    const pads=[
      [-3,1,0,1],[0,2,2,1],[3,3,-1,1],[6,4,2,1],
      [9,5,-2,1],[12,6,1,1],[15,5,4,2],[19,7,1,1],
      [23,8,-2,1],[27,9,2,2],[31,10,0,2]
    ];
    pads.forEach(([x,dy,z,r],i)=>{
      for(let dx=-r;dx<=r;dx++)for(let dz=-r;dz<=r;dz++)
        addBlock(x+dx,baseY+dy,z+dz,i%3===0?'wool_green':'stone',false);
    });
    _v22Training.courseEnd.set(31,baseY+11,0);
  }
  player.pos.copy(_v22Training.spawn);player.vel.set(0,0,0);
  let p=document.getElementById('training-hud');if(p)p.remove();
  _v22TrainingHud();
}
const _v22OldCreateTraining=window.createTrainingWorld;
if(typeof _v22OldCreateTraining==='function' && !window.__v22TrainingHook){
  window.__v22TrainingHook=true;
  window.createTrainingWorld=function(type){
    // 既存の練習場生成を使わず、後半版へ置換
    _v22CreateTrainingWorld(type);
  };
}

/* startTrainingは既存を利用し、開始後に記録HUDを初期化 */
const _v22OldStartTraining=window.startTraining;
if(typeof _v22OldStartTraining==='function'&&!window.__v22StartTrainingHook){
  window.__v22StartTrainingHook=true;
  window.startTraining=function(type){
    _v22OldStartTraining(type);
    setTimeout(()=>{_v22Training.type=type;_v22Training.best=_v22TrainingLoadBest(type);_v22Training.start=performance.now();_v22Training.attempt=1;_v22Training.deaths=0;_v22TrainingHud();},350);
  };
}

/* 練習場でのrespawnを安全化 */
const _v22OldRespawn=window.respawn;
if(typeof _v22OldRespawn==='function'&&!window.__v22RespawnHook){
  window.__v22RespawnHook=true;
  window.respawn=function(){
    if(_v22Training.type){_v22SafeTrainingRespawn();return;}
    _v22OldRespawn();
  };
}

/* ゴール判定: プレイヤーが終点付近へ到達したら記録 */
setInterval(()=>{
  if(!_v22Training.type||!scene||gameMode!=='training_bridge'&&gameMode!=='training_parkour')return;
  const d=player.pos.distanceTo(_v22Training.courseEnd);
  if(d<2.4){
    _v22FinishTraining();
    // ゴール地点から安全にスタートへ戻す
    player.pos.copy(_v22Training.spawn);player.vel.set(0,0,0);
  }
  _v22TrainingHud();
},100);

/* 奈落/死亡時に練習場なら即座に安全リスポーン */
setInterval(()=>{
  if(!_v22Training.type)return;
  if(gameMode!=='training_bridge'&&gameMode!=='training_parkour')return;
  if(player.pos.y<45){
    _v22SafeTrainingRespawn();
    announce('↩ スタート地点へリスポーン','#ffaa00');
  }
},100);

/* ---------------------------------------------------------------
   7. ドロップはローカル物理を優先し、同期対象は生成/取得だけ。
   毎フレーム座標は送らない。
---------------------------------------------------------------- */
const _v22OldSpawnDrop=window.spawnDrop;
if(typeof _v22OldSpawnDrop==='function'&&!window.__v22DropHook){
  window.__v22DropHook=true;
  window.spawnDrop=function(type,pos,remote=false){
    _v22OldSpawnDrop(type,pos);
    if(remote||gameMode!=='multi'||!currentMatchId||!window.supabaseClient)return;
    const id='drop_'+myPeerId+'_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,6);
    const m=drops?.[drops.length-1];
    if(m)m.userData.v22DropId=id;
    window.supabaseClient.from('bw_drops').upsert({
      drop_id:id,match_id:currentMatchId,item_type:type,amount:1,
      x:pos.x,y:pos.y,z:pos.z,owner_uid:myPeerId,state:'ground',
      expires_at:new Date(Date.now()+60000).toISOString()
    }).then(()=>{}).catch(()=>{});
  };
}

/* ドロップRealtime受信 */
function _v22StartDropRealtime(){
  if(!window.supabaseClient||!currentMatchId||gameMode!=='multi')return;
  if(window.__v22DropChannel)try{window.supabaseClient.removeChannel(window.__v22DropChannel)}catch(e){}
  window.__v22DropChannel=window.supabaseClient
    .channel('bw-drops-'+currentMatchId)
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'bw_drops',
      filter:'match_id=eq.'+currentMatchId},p=>{
        const d=p.new;
        if(!d||d.owner_uid===myPeerId)return;
        if(d.state!=='ground')return;
        if(typeof drops!=='undefined'&&drops.some(x=>x.userData?.v22DropId===d.drop_id))return;
        if(typeof spawnDrop==='function')spawnDrop(d.item_type,new THREE.Vector3(+d.x,+d.y,+d.z),true);
        const m=drops?.[drops.length-1];if(m)m.userData.v22DropId=d.drop_id;
      })
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'bw_drops',
      filter:'match_id=eq.'+currentMatchId},p=>{
        const d=p.new;if(!d)return;
        const m=(drops||[]).find(x=>x.userData?.v22DropId===d.drop_id);
        if(m&&d.state!=='ground'){scene.remove(m);drops.splice(drops.indexOf(m),1);}
      }).subscribe();
}
window.addEventListener('bw:players',()=>{});
window.addEventListener('load',()=>setTimeout(_v22StartDropRealtime,1200));

/* ---------------------------------------------------------------
   8. 練習記録をSupabaseにも保存（失敗時はローカルのみで継続）
---------------------------------------------------------------- */
async function _v22SaveTrainingCloud(type,ms){
  try{
    if(!window.supabaseClient||!myPeerId)return;
    const best=_v22TrainingLoadBest(type);
    await window.supabaseClient.from('bw_training_records').upsert({
      uid:myPeerId,course_id:'default_'+type,type,
      score_ms:ms,attempts:_v22Training.attempt,
      best_ms:best,last_ms:ms,
      completed_count:1,deaths:_v22Training.deaths,
      updated_at:new Date().toISOString()
    },{onConflict:'uid,course_id'});
  }catch(e){}
}
const _v22OldFinish=_v22FinishTraining;
_v22FinishTraining=function(){
  const before=_v22Training.start;
  _v22OldFinish();
  if(before){
    const ms=Math.round(performance.now()-before);
    _v22SaveTrainingCloud(_v22Training.type,ms);
  }
};

/* ---------------------------------------------------------------
   9. アイテム表示の最低限の3D化
   既存の右手表示を壊さず、ブロック系は小型Cubeとして見せる。
---------------------------------------------------------------- */
function _v22UpdateHeldBlockVisual(){
  if(typeof _handGroup==='undefined'||!_handGroup)return;
  const item=player?.inv?.[player.selectedIdx];
  let old=_handGroup.getObjectByName('v22-held-block');
  if(old){_handGroup.remove(old);old.geometry?.dispose?.();}
  if(!item?.type)return;
  const blockTypes=new Set(['wool_red','wool_blue','wool_green','wool_yellow','wood','end','dirt','grass','stone','cobblestone','log','leaves']);
  if(!blockTypes.has(item.type))return;
  const geo=new THREE.BoxGeometry(.42,.42,.42);
  const hex={
    wool_red:0xcc4444,wool_blue:0x4444cc,wool_green:0x228822,wool_yellow:0xccaa00,
    wood:0xc49a62,end:0xd9d9a0,dirt:0x8a5a35,grass:0x5d9b2a,stone:0x888888,
    cobblestone:0x777777,log:0x6b4724,leaves:0x3d7f27
  }[item.type]||0xaaaaaa;
  const mat=new THREE.MeshLambertMaterial({color:hex});
  const mesh=new THREE.Mesh(geo,mat);mesh.name='v22-held-block';
  mesh.position.set(.05,-.05,-.42);mesh.rotation.set(.3,.4,.2);
  _handGroup.add(mesh);
}
setInterval(_v22UpdateHeldBlockVisual,120);

/* ---------------------------------------------------------------
   10. 頭部向き/攻撃アニメーションの見た目反映
---------------------------------------------------------------- */
setInterval(()=>{
  const apply=(mesh,p)=>{
    if(!mesh||!p)return;
    const head=mesh.getObjectByName('head');
    if(head){
      head.rotation.x=-Math.max(-1.0,Math.min(1.0,(p.headPitch??p.pitch??0)*0.8));
      head.rotation.y=(p.headYaw??p.yaw??0)-(mesh.rotation.y||0);
    }
    const now=Date.now();
    const atk=(p.attackAnimationUntil||0)>now;
    const ra=mesh.getObjectByName('ra'),la=mesh.getObjectByName('la');
    if(atk){
      const phase=Math.max(0,Math.min(1,(p.attackAnimationUntil-now)/180));
      if(ra)ra.rotation.x=-Math.sin(phase*Math.PI)*1.4;
      if(la)la.rotation.x= Math.sin(phase*Math.PI)*0.15;
    }
  };
  apply(typeof playerMesh3p!=='undefined'?playerMesh3p:null,player);
  if(typeof mpPlayers!=='undefined'){
    Object.entries(mpPlayers).forEach(([uid,p])=>apply(mpMeshes?.[uid],p));
  }
},33);


/* ===============================================================
   V23 GAMEPLAY / AI / FLUID / VISUAL ENHANCEMENTS
   - AI block breaking/defense/grounded bridging
   - finite-ish resource economy for bots
   - precise fall damage + water landing
   - match timer always visible outside training
   - precision debug overlay
   - water/lava flow-like physics
   - enhanced rendering / texture filtering
   - bot held-item switching
   =============================================================== */
window._bwFluidEnabled=true;
window._bwFall={lastLanding:0,airStartY:0,wasAir:false};
window._bwMatchStart=0;
window._bwVisualQuality=bwStorage.get('bw_visual_quality')||'standard';

function _bwEnsureOverlay(){
  let t=document.getElementById('bw-match-timer');
  if(!t){t=document.createElement('div');t.id='bw-match-timer';document.body.appendChild(t);}
  let f=document.getElementById('bw-fluid-badge');
  if(!f){f=document.createElement('div');f.id='bw-fluid-badge';document.body.appendChild(f);}
  let d=document.getElementById('bw-debug-precision');
  if(!d){d=document.createElement('div');d.id='bw-debug-precision';document.body.appendChild(d);}
}
function _bwFmt(ms){
  const s=Math.max(0,ms/1000),m=Math.floor(s/60),ss=Math.floor(s%60),cs=Math.floor((s%1)*100);
  return `${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}.${String(cs).padStart(2,'0')}`;
}
function _bwUpdateMatchTimer(){
  _bwEnsureOverlay();
  const el=document.getElementById('bw-match-timer');
  if(!el)return;
  const show=gameMode==='multi'||gameMode==='solo'||gameMode==='kishiku';
  if(!show||gameMode==='training_bridge'||gameMode==='training_parkour'){
    el.style.display='none'; return;
  }
  if(!_bwMatchStart)_bwMatchStart=performance.now();
  el.style.display='block';
  el.textContent='⏱ '+_bwFmt(performance.now()-_bwMatchStart);
}

function _bwLandingDamage(speed){
  if(gameMode==='training_bridge'||gameMode==='training_parkour') return;
  if(!Number.isFinite(speed))return;
  // Minecraft-like thresholded model: no damage for small drops, increasing damage above ~3 blocks/s.
  // Water cancels fall damage; see fluid section below.
  if(window._bwInWater)return;
  const effective=Math.max(0,speed-7.2);
  if(effective<=0)return;
  const dmg=Math.floor(effective*1.35);
  if(dmg>0)applyDamage(Math.min(dmg,player.maxHp));
}
window._bwLandingDamage=_bwLandingDamage;

function _bwIsFluidAt(x,y,z){
  const k=blockKey(Math.round(x),Math.round(y),Math.round(z));
  const a=blockMap.get(k)||[];
  return a.find(b=>['water','water_source','lava','magma','flowing_water','flowing_lava'].includes(b.userData?.type||b.type));
}
function _bwFluidTick(dt){
  if(!window._bwFluidEnabled||!blockMap||!player)return;
  window._bwInWater=false;
  const around=[];
  for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(let dz=-1;dz<=1;dz++){
    const b=_bwIsFluidAt(player.pos.x+dx,player.pos.y+dy,player.pos.z+dz);
    if(b)around.push(b);
  }
  if(!around.length)return;
  let water=false,lava=false,wx=0,wz=0,lx=0,lz=0;
  around.forEach(b=>{
    const t=b.userData?.type||b.type;
    if(t==='water'||t==='water_source'||t==='flowing_water'){water=true;wx+=b.position.x-player.pos.x;wz+=b.position.z-player.pos.z;}
    if(t==='lava'||t==='magma'||t==='flowing_lava'){lava=true;lx+=b.position.x-player.pos.x;lz+=b.position.z-player.pos.z;}
  });
  if(water){
    window._bwInWater=true;
    player.vel.y=Math.max(player.vel.y,-2.2);
    player.vel.x*=Math.pow(.45,dt);
    player.vel.z*=Math.pow(.45,dt);
    // Simple flow: fluid gradients push entities; local simulation avoids per-frame DB traffic.
    player.vel.x+=Math.sign(wx)*0.55*dt;
    player.vel.z+=Math.sign(wz)*0.55*dt;
  }
  if(lava){
    player.vel.x*=Math.pow(.72,dt);
    player.vel.z*=Math.pow(.72,dt);
    if(Math.random()<dt*0.7)applyDamage(1.0);
  }
  const badge=document.getElementById('bw-fluid-badge');
  if(badge){
    badge.style.display='block';
    badge.textContent=lava?'🔥 マグマ流：移動低下 / 継続ダメージ':'💧 水流：減速 / 落下ダメージ無効';
    setTimeout(()=>{if(badge)badge.style.display='none';},220);
  }
}

function _bwFluidBlockType(type){
  return ['water','water_source','flowing_water','lava','flowing_lava','magma'].includes(type);
}
function _bwAddFluidLandmarks(){
  if(!['grassland','nether'].includes(currentMapTheme))return;
  const y=61;
  const add=(x,z,type)=>{
    const k=blockKey(x,y,z);
    if(!blockMap.has(k))addBlock(x,y,z,type,false);
  };
  if(currentMapTheme==='grassland'){
    // small stream with a source and two flow directions
    for(let z=-9;z<=9;z++){
      add(14,z,z===-9?'water_source':'flowing_water');
      if(z%3===0)add(15,z,'water');
    }
  }else{
    // nether lava channel
    for(let x=-18;x<=18;x++){
      add(x,-13,'flowing_lava');
      if(x%4===0)add(x,-12,'lava');
    }
  }
}
const _bwOldWorld2=window.createWorld;
if(typeof _bwOldWorld2==='function'&&!window.__bwFluidWorldHook){
  window.__bwFluidWorldHook=true;
  window.createWorld=function(){
    const r=_bwOldWorld2.apply(this,arguments);
    try{_bwAddFluidLandmarks();}catch(e){}
    return r;
  };
}

function _bwCanPlaceGrounded(x,y,z){
  // Do not allow AI to place into unsupported air.
  // A block must touch the current footprint or another solid block from below.
  const key=blockKey(x,y,z);
  if(blockMap.has(key))return false;
  const below=blockMap.has(blockKey(x,y-1,z));
  const side=blockMap.has(blockKey(x-1,y,z))||blockMap.has(blockKey(x+1,y,z))||
             blockMap.has(blockKey(x,y,z-1))||blockMap.has(blockKey(x,y,z+1));
  return below||side;
}
function _bwAIBlockBreak(e){
  const ud=e?.userData;if(!ud||ud.isGolem)return;
  if(!ud.breakTimer)ud.breakTimer=0;
  ud.breakTimer+=0.05;
  if(ud.breakTimer<0.55)return;
  const dir=new THREE.Vector3(Math.sin(e.rotation.y),0,Math.cos(e.rotation.y));
  const bx=Math.round(e.position.x+dir.x*1.0),by=Math.round(e.position.y),bz=Math.round(e.position.z+dir.z*1.0);
  const candidates=nearBlocks(bx,by,bz).filter(b=>!b.userData?.isBed);
  const target=candidates.find(b=>{
    const dx=Math.abs(b.position.x-e.position.x),dz=Math.abs(b.position.z-e.position.z);
    return dx<1.2&&dz<1.2&&b.position.y>=e.position.y-1&&b.position.y<=e.position.y+1.8;
  });
  if(target&&typeof removeBlock==='function'){
    ud.breakTimer=0;
    const pos=target.position.clone();
    const typ=target.userData?.type||'';
    removeBlock(target);
    spawnParticles(pos,'#bbbbbb',4);
    // Only award useful drops for placed blocks.
    if(typ&&typ!=='stone'&&typ!=='dirt'&&gameMode==='solo')spawnDrop(typ,pos);
  }
}
function _bwAIDefendBed(e){
  const ud=e?.userData;if(!ud||ud.isGolem||!TEAM_BED_STATUS[ud.team])return;
  if(!ud.hasWool||!(ud.woolStock>0))return;
  ud.defendTimer=(ud.defendTimer||0)+0.05;
  if(ud.defendTimer<1.4)return;
  const bed=allBlocks().find(b=>b.userData?.isBed&&b.userData.team===ud.team);
  if(!bed)return;
  const dx=Math.round(bed.position.x+(Math.random()<.5?1:-1)*(Math.random()<.5?1:2));
  const dz=Math.round(bed.position.z+(Math.random()<.5?1:-1)*(Math.random()<.5?1:2));
  const by=Math.round(bed.position.y+1);
  if(_bwCanPlaceGrounded(dx,by,dz)){
    ud.defendTimer=0;addBlock(dx,by,dz,'wool_'+String(ud.team).toLowerCase(),true);ud.woolStock--;
  }
}
function _bwAIInventory(e){
  const ud=e?.userData;if(!ud)return;
  if(!ud.aiInv)ud.aiInv={iron:8,gold:2,wool:0,iron_sword:0};
  // Pickup nearby drops instead of inventing resources.
  if(typeof drops!=='undefined'){
    for(let i=drops.length-1;i>=0;i--){
      const d=drops[i],t=d.userData?.type;
      if(!t||e.position.distanceTo(d.position)>2.2)continue;
      if(t==='iron')ud.aiInv.iron+=(d.userData?.count||1);
      else if(t==='gold')ud.aiInv.gold+=(d.userData?.count||1);
      else if(t.startsWith('wool_'))ud.aiInv.wool+=(d.userData?.count||1);
      else continue;
      scene.remove(d);drops.splice(i,1);
    }
  }
  // Simple shop: only wool and iron sword as requested.
  if(ud.aiInv.wool<4&&ud.aiInv.gold>=2){
    ud.aiInv.gold-=2;ud.aiInv.wool+=8;ud.hasWool=true;ud.woolStock=(ud.woolStock||0)+8;
  }
  if(!ud.hasIronSword&&ud.aiInv.iron>=8){
    ud.aiInv.iron-=8;ud.hasIronSword=true;ud.damage=Math.max(7,ud.damage||3);
  }
  // No passive resource generation.
  ud.iron=ud.aiInv.iron;ud.gold=ud.aiInv.gold;
}
function _bwAISwitchHeld(e){
  const ud=e?.userData;if(!ud)return;
  const hp=ud.hp/(ud.maxHp||20);
  if(hp<.35&&ud.hasIronSword)ud.heldItem='iron_sword';
  else if(ud.state==='raid'&&ud.woolStock>0)ud.heldItem='wool_'+String(ud.team).toLowerCase();
  else if(ud.hasIronSword)ud.heldItem='iron_sword';
  else ud.heldItem='wool_'+String(ud.team).toLowerCase();
}
const _bwOldAI2=window.updateAI;
if(typeof _bwOldAI2==='function'&&!window.__bwAI2Hook){
  window.__bwAI2Hook=true;
  window.updateAI=function(dt){
    _bwOldAI2.call(this,dt);
    enemies.forEach(e=>{
      _bwAIInventory(e);
      _bwAISwitchHeld(e);
      _bwAIBlockBreak(e);
      _bwAIDefendBed(e);
    });
  };
}

function _bwPreciseDebug(){
  _bwEnsureOverlay();
  const d=document.getElementById('bw-debug-precision');
  if(!window._v22Debug){d.style.display='none';return;}
  const near=_bwIsFluidAt(player.pos.x,player.pos.y,player.pos.z);
  const rows=[
    '=== PRECISION DEBUG ===',
    `mode=${gameMode} match=${currentMatchId||'-'}`,
    `theme=${currentMapTheme} seed=${currentMapSeed||0}`,
    `pos=${player.pos.x.toFixed(4)},${player.pos.y.toFixed(4)},${player.pos.z.toFixed(4)}`,
    `vel=${player.vel.x.toFixed(4)},${player.vel.y.toFixed(4)},${player.vel.z.toFixed(4)}`,
    `yaw=${(controls.yaw*180/Math.PI).toFixed(3)} pitch=${(controls.pitch*180/Math.PI).toFixed(3)}`,
    `ground=${!!player.onGround} crouch=${!!player.isCrouching} sprint=${!!player.isSprinting}`,
    `hp=${player.hp.toFixed(2)}/${player.maxHp.toFixed(2)} fallV=${player.vel.y.toFixed(3)}`,
    `held=${player.inv?.[player.selectedIdx]?.type||'-'} slot=${player.selectedIdx}`,
    `blocks=${typeof blockMap!=='undefined'?blockMap.size:0} drops=${typeof drops!=='undefined'?drops.length:0}`,
    `mp=${Object.keys(mpPlayers||{}).length} ai=${typeof enemies!=='undefined'?enemies.length:0}`,
    `fluid=${near?(near.userData?.type||near.type||'?'):'none'} fluidOn=${window._bwFluidEnabled}`,
    `fov=${camera?.fov?.toFixed(2)||'-'} pixelRatio=${renderer?.getPixelRatio?.().toFixed(2)||'-'}`,
    `rt=${typeof _supabaseRealtimeChannels!=='undefined'?_supabaseRealtimeChannels.length:0}`,
    `fps=${typeof _fpsEl!=='undefined'&&_fpsEl?.textContent?_fpsEl.textContent:'-'}`,
    `--- v26 追加デバッグ ---`,
    `gameMode=${gameMode} matchId=${currentMatchId||'-'} activeMenu=${activeMenu||'-'} paused=${_gamePaused}`,
    `右腕: handGroup=${!!_handGroup} attached=${_handGroup&&_handGroup.parent===camera} item=${player.inv?.[player.selectedIdx]?.type||'素手'}`,
    `影: enabled=${renderer?.shadowMap?.enabled} type=${renderer?.shadowMap?.type} mapSize=${window._bwSunLight?.shadow?.mapSize?.x||'-'}`,
    `画質=${window._bwVisualQuality} 実験的機能=${window._bwExperimentalGraphics} スキン精度=${window._bwSkinRealism}`,
    `最終ヒット: ${window._bwLastHitDebug||'(なし)'}`,
    `Supabase: ${window._supabaseLastError||'OK'}`,
    `--- v26.3 追加デバッグ ---`,
    `採掘中=${!!player.mining} 設置中=${!!player.placing} pointerLock=${!!document.pointerLockElement}`,
    `スキン読込=${!!_skinImage} 精度=${window._bwSkinRealism||'mid'} レイヤー表示=${_skinLayerVisible}`,
    `頭yaw=${(playerMesh3p?.getObjectByName('head')?.rotation.y*180/Math.PI||0).toFixed(1)} 頭pitch=${(playerMesh3p?.getObjectByName('head')?.rotation.x*180/Math.PI||0).toFixed(1)}`,
    `AI内訳: ${typeof enemies!=='undefined'?enemies.map(e=>`${e.userData?.team||'?'}:${e.userData?.state||'?'}(hp${Math.round(e.userData?.hp||0)})`).join(' / '):'(なし)'}`,
    `画面=${innerWidth}x${innerHeight} DPR=${devicePixelRatio}`
  ];
  d.textContent=rows.join('\n');d.style.display='block';
}
setInterval(_bwPreciseDebug,150);


function _bwConfigureShadowQuality(q){
  if(!renderer || !window._bwSunLight) return;
  const sun=window._bwSunLight;
  const cinematic=q==='cinematic', enhanced=q==='enhanced';

  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=cinematic ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;

  const size=cinematic?4096:enhanced?3072:2048;
  sun.shadow.mapSize.set(size,size);

  // Tight, player-centered cascade-like frustum. The light itself is moved
  // every frame by _bwUpdateSunShadowTarget().
  const range=cinematic?34:enhanced?44:54;
  const cam=sun.shadow.camera;
  cam.left=-range; cam.right=range;
  cam.top=range; cam.bottom=-range;
  cam.near=1; cam.far=220;
  cam.bias=-0.00035;
  cam.normalBias=0.018;
  cam.updateProjectionMatrix();

  // Re-enable shadow casting on all world geometry, while excluding HUD-like
  // sprites and post-process objects.
  if(scene){
    scene.traverse(o=>{
      if(!o || !o.isMesh) return;
      const ud=o.userData||{};
      if(ud.noShadow || ud.isHUD || ud.postProcess) {
        o.castShadow=false; o.receiveShadow=false; return;
      }
      o.castShadow=true;
      o.receiveShadow=true;
    });
  }
}

function _bwSetVisualQuality(q){
  window._bwVisualQuality=q;
  bwStorage.set('bw_visual_quality',q);
  if(!renderer)return;
  const ratio=q==='cinematic'?Math.min(devicePixelRatio,2):q==='enhanced'?Math.min(devicePixelRatio,1.75):Math.min(devicePixelRatio,1.25);
  renderer.setPixelRatio(ratio);
  // v28: 実シャドウマップを品質設定へ反映
  _bwConfigureShadowQuality(q);

  // v26追記: 高画質ほど環境光/半球光を少し絞ってコントラストを強め、
  // 影がはっきり主張する「影MOD的な」メリハリのある見た目に近づける。
  scene.traverse(o=>{
    if(o.isAmbientLight) o.intensity=q==='cinematic'?0.32:q==='enhanced'?0.38:0.42;
    if(o.isHemisphereLight) o.intensity=q==='cinematic'?0.28:q==='enhanced'?0.32:0.35;
    if(o.isDirectionalLight) o.intensity=q==='cinematic'?0.95:q==='enhanced'?0.9:0.85;
  });
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=q==='cinematic'?1.08:1.0;
  // Better texture sampling without destroying pixel-art character skins.
  if(typeof TEX==='object')Object.values(TEX).forEach(t=>{
    if(t&&t.isTexture){
      t.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),q==='cinematic'?8:4);
      t.needsUpdate=true;
    }
  });
}

window._bwApplyMeshShadows=function(root){
  if(!root || !root.traverse) return;
  root.traverse(o=>{
    if(!o || !o.isMesh) return;
    if(o.userData?.noShadow || o.userData?.isHUD){o.castShadow=false;o.receiveShadow=false;return;}
    o.castShadow=true;
    o.receiveShadow=true;
  });
};

window._bwSetVisualQuality=_bwSetVisualQuality;
setTimeout(()=>_bwSetVisualQuality(window._bwVisualQuality),1000);

// v26追記: 実験的機能(ポストエフェクトシェーダー / スキン描画精度3段階)の状態管理
window._bwExperimentalGraphics = bwStorage.get('bw_exp_graphics')==='1';
window._bwSkinRealism = bwStorage.get('bw_skin_realism') || 'mid';

window._bwSetExperimentalGraphics=function(on){
  window._bwExperimentalGraphics=!!on;
  bwStorage.set('bw_exp_graphics', on?'1':'0');
};

window._bwSetSkinRealism=function(level){
  if(!['low','mid','high'].includes(level)) level='mid';
  window._bwSkinRealism=level;
  bwStorage.set('bw_skin_realism', level);
  // 既存のプレイヤーメッシュを新しい精度設定で作り直す
  if(typeof refreshPlayerMeshSkin==='function' && playerMesh3p) refreshPlayerMeshSkin();
};

// 設定パネルを開いたときにUIへ現在値を反映
(function _bwSyncExperimentalUI(){
  const applyUI=()=>{
    const cb=document.getElementById('set-expGraphics');
    if(cb) cb.checked=!!window._bwExperimentalGraphics;
    const sel=document.getElementById('set-skinRealism');
    if(sel) sel.value=window._bwSkinRealism||'mid';
    const sm=document.getElementById('bw-shader-mode');
    if(sm) sm.value=window._bwShaderMode||'vanilla';
  };
  setTimeout(applyUI,1200);
  const btn=document.querySelector('[onclick*="settings-panel"]');
  document.addEventListener('click',()=>{setTimeout(applyUI,50);},true);
})();

function _bwAddSettings(){
  const panel=document.getElementById('settings-panel');
  if(!panel||document.getElementById('bw-bot-skin-setting'))return;
  const host=panel.querySelector('div[style*="max-width:820px"]')||panel.firstElementChild;
  const section=document.createElement('div');
  section.id='bw-bot-skin-setting';
  section.style.cssText='margin-top:14px;border-top:1px solid #333;padding-top:10px';
  section.innerHTML=`<div class="set-section">🤖 BOT</div>
  <label class="set-label">BOTスキンPNG <input id="bw-bot-skin-file" type="file" accept="image/png"></label>
  <div style="font-size:11px;color:#777;margin-top:4px">選択したPNGはこのPCのBOT用スキンとして使用します。</div>`;
  host?.appendChild(section);
  const inp=section.querySelector('#bw-bot-skin-file');
  inp?.addEventListener('change',e=>{
    const f=e.target.files?.[0];if(!f)return;
    const r=new FileReader();
    r.onload=()=>{
      const safe=_bwSafeImageSource(r.result);
      if(!safe){announce('⚠️ 画像ファイルを読み込めませんでした','#ff5555');return;}
      bwStorage.set('bw_bot_skin_data',safe);
      announce('🤖 BOTスキンを設定しました','#55ffff');
    };
    r.readAsDataURL(f);
  });
}
window.addEventListener('load',_bwAddSettings);

function _bwApplyBotSkinToMesh(mesh){
  const data=_bwSafeImageSource(bwStorage.get('bw_bot_skin_data'));
  if(!data||!mesh)return;
  const img=new Image();
  img.onload=()=>{
    if(!mesh.parent)return;
    const pos=mesh.position.clone(),ud={...mesh.userData};
    const parent=mesh.parent;
    parent.remove(mesh);
    const nm=createSimplePlayerMesh(TEAM_COLOR[ud.team]||0xff3333,img);
    nm.position.copy(pos);Object.assign(nm.userData,ud);parent.add(nm);
    const idx=enemies.indexOf(mesh);if(idx>=0)enemies[idx]=nm;
  };
  img.src=data;
}
const _bwOldSpawnAI=window.spawnAI;
if(typeof _bwOldSpawnAI==='function'&&!window.__bwBotSkinHook){
  window.__bwBotSkinHook=true;
  window.spawnAI=function(...args){
    const before=enemies.length;
    const r=_bwOldSpawnAI.apply(this,args);
    setTimeout(()=>{if(enemies.length>before)_bwApplyBotSkinToMesh(enemies[enemies.length-1]);},40);
    return r;
  };
}

/* Render a small amount of actual fluid geometry; keeps it local and cheap. */
const _bwFluidMeshes=[];
function _bwFluidVisualTick(){
  if(!scene||!blockMap)return;
  // only create visuals for existing fluid blocks; do not rebuild every frame
  const seen=new Set();
  blockMap.forEach(arr=>arr.forEach(b=>{
    const t=b.userData?.type||b.type;
    if(!_bwFluidBlockType(t))return;
    const id=b.uuid;seen.add(id);
    if(b.userData._fluidEnhanced)return;
    const mat=new THREE.MeshPhongMaterial({
      color:t.includes('lava')||t==='magma'?0xff5522:0x2b8cff,
      transparent:true,opacity:t.includes('lava')||t==='magma'?.82:.56,
      shininess:70,emissive:t.includes('lava')||t==='magma'?0x331100:0x001133
    });
    b.material=mat;b.userData._fluidEnhanced=true;
  }));
}
setInterval(_bwFluidVisualTick,500);

setInterval(()=>{
  try{
    if(!_bwMatchStart&&(gameMode==='multi'||gameMode==='solo'))_bwMatchStart=performance.now();
    _bwUpdateMatchTimer();
    _bwFluidTick(0.1);
  }catch(e){}
},100);

window.addEventListener('load',()=>{
  setTimeout(()=>{
    _bwEnsureOverlay();
    _bwSetVisualQuality(window._bwVisualQuality);
  },700);
});

/* 初期UI */
window.addEventListener('load',()=>{_v22DebugPanel();});
})();
