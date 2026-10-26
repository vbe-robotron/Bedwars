
(function(){
  'use strict';
  // ---------------- MC-like UI controller ----------------
  const oldPause=window.togglePauseMenu;
  const oldIngame=window.toggleInGameMenu;
  function release(){try{document.exitPointerLock();}catch(e){}}
  function capture(){if(window.gameMode!=='lobby'&&!window.activeMenu&&document.body.requestPointerLock){try{document.body.requestPointerLock();}catch(e){}}}
  window.togglePauseMenu=function(){
    const el=document.getElementById('pause-menu'); if(!el)return;
    const open=el.style.display==='block';
    el.style.display=open?'none':'block';
    if(!open)release(); else capture();
    if(typeof window._syncRTAWithMenu==='function')window._syncRTAWithMenu();
  };
  window.toggleInGameMenu=function(){
    const el=document.getElementById('ingame-menu'); if(!el)return;
    const open=el.style.display==='block';
    el.style.display=open?'none':'block';
    if(!open)release(); else capture();
    if(typeof window._syncRTAWithMenu==='function')window._syncRTAWithMenu();
  };

  // Inventory: mouse-first controls. Drag-and-drop is already supported by the game;
  // this layer adds left/right click affordances and a clear mouse cursor while open.
  function invOpen(){return window.activeMenu==='inventory';}
  document.addEventListener('mousemove',function(e){
    if(!invOpen())return;
    const box=document.getElementById('inv-skin-box');
    if(box && window.document.getElementById('inv-model')){
      const r=box.getBoundingClientRect();
      const nx=(e.clientX-(r.left+r.width/2))/(r.width/2);
      const ny=(e.clientY-(r.top+r.height/2))/(r.height/2);
      const mdl=document.getElementById('inv-model');
      mdl.style.transform='rotateY('+(Math.max(-.95,Math.min(.95,nx))*.9)+'rad) rotateX('+(-Math.max(-.45,Math.min(.45,ny))*.42)+'rad)';
      const head=mdl.querySelector('.head-3d');
      if(head)head.style.transform='translate3d(-50%,0,0) rotateY('+(Math.max(-.8,Math.min(.8,nx))*.35)+'rad) rotateX('+(-Math.max(-.5,Math.min(.5,ny))*.25)+'rad)';
    }
  });

  // Inventory open: put the cursor back on the screen and prevent accidental pointer-lock capture.
  const obs=new MutationObserver(function(){
    if(invOpen())release();
  });
  const inv=document.getElementById('win-inventory'); if(inv)obs.observe(inv,{attributes:true,attributeFilter:['style']});

  // (ESC処理は setupInput 側で一本化済み。ここでの重複リスナーは削除)

  // Shop polish: add a compact Minecraft-style header without changing shop purchase logic.
  const shop=document.getElementById('win-shop');
  if(shop){
    shop.setAttribute('id','win-shop');
    const h=shop.querySelector('h2');
    if(h){h.textContent='アイテムショップ';h.style.fontSize='30px';h.style.marginBottom='8px';}
  }

  // Pause/in-game menus: use Japanese Minecraft-like labels while preserving existing actions.
  const p=document.getElementById('pause-menu');
  if(p){
    const title=p.querySelector('div div');
    if(title)title.textContent='ゲームメニュー';
  }

  // Drop spawn hook: initialize gravity state for every newly spawned item, including remote drops.
  const originalSpawn=window.spawnDrop;
  if(typeof originalSpawn==='function'){
    window.spawnDrop=function(type,pos,remote){
      const before=window.drops?window.drops.length:0;
      const r=originalSpawn.apply(this,arguments);
      const arr=window.drops;
      if(arr && arr.length>before){
        const d=arr[arr.length-1];
        d.userData.dropVy=0;
        d.userData.grounded=false;
        d.userData.amount=d.userData.amount||1;
        d.userData.baseY=pos.y;
      }
      return r;
    };
  }

  // If getGroundYAt does not exist in a particular map build, infer a reasonable block top
  // from the collision system where possible. This is deliberately conservative.
  if(typeof window.getGroundYAt!=='function'){
    window.getGroundYAt=function(x,z){
      try{
        if(window.blocks && window.blocks.length){
          let best=-Infinity;
          for(const b of window.blocks){
            const p=b.position;
            if(Math.abs(p.x-x)<.51 && Math.abs(p.z-z)<.51 && p.y>best)best=p.y;
          }
          if(best>-Infinity)return best+.5;
        }
      }catch(e){}
      return null;
    };
  }
})();
