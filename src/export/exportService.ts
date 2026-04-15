import type { Project } from '../models/types';
import { ART_SIZE, ROOM_SIZE } from '../models/types';

// Generates a completely self-contained, playable HTML file
export function exportGameAsHTML(project: Project): void {
  const html = buildStandaloneHTML(project);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${project.name.replace(/[^\wåäöÅÄÖ\s\-]/g, '').trim() || 'spel'}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

function buildStandaloneHTML(project: Project): string {
  // Escape </script> so it can't break out of the script tag
  const projectJSON = JSON.stringify(project).replace(/<\/script>/gi, '<\\/script>');
  const safeTitle = escapeHtml(project.name);

  return `<!DOCTYPE html>
<html lang="sv">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<title>${safeTitle}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;overflow:hidden;background:#191929;display:flex;flex-direction:column;align-items:center;font-family:system-ui,-apple-system,sans-serif;user-select:none;-webkit-user-select:none;-webkit-text-size-adjust:100%}
#hdr{width:100%;max-width:640px;display:flex;align-items:center;justify-content:space-between;padding:8px 14px;flex-shrink:0}
#gtitle{font-size:.9rem;font-weight:700;color:#a5b4fc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:65%}
#rbtn{padding:5px 14px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16);border-radius:8px;color:rgba(255,255,255,.7);font-size:.8rem;font-weight:600;cursor:pointer;transition:all .15s}
#rbtn:hover{background:rgba(255,255,255,.16);color:#fff}
#gwrap{flex:1;display:flex;align-items:center;justify-content:center;width:100%;min-height:0;padding:0 8px}
#game{display:block;image-rendering:pixelated;image-rendering:crisp-edges;max-width:100%;max-height:100%;border-radius:4px}
#ctrl{display:none;align-items:center;justify-content:space-between;width:100%;max-width:640px;padding:10px 16px 14px;flex-shrink:0;gap:16px}
.dp{display:flex;gap:10px}
.cb{width:64px;height:64px;border-radius:50%;background:rgba(255,255,255,.1);border:2px solid rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:1.4rem;color:rgba(255,255,255,.85);-webkit-tap-highlight-color:transparent;touch-action:none;cursor:pointer;transition:background .1s,transform .1s}
.cb.on{background:rgba(255,255,255,.28);border-color:rgba(255,255,255,.5);transform:scale(.93)}
#bJ{width:72px;height:72px;background:rgba(99,102,241,.2);border-color:rgba(99,102,241,.5);font-size:1.6rem}
#bJ.on{background:rgba(99,102,241,.4)}
#hint{font-size:.7rem;color:rgba(255,255,255,.25);text-align:center;padding:3px 0 8px;flex-shrink:0}
@media(hover:none),(pointer:coarse){#ctrl{display:flex}#hint{display:none}}
</style>
</head>
<body>
<div id="hdr">
  <span id="gtitle">${safeTitle}</span>
  <button id="rbtn" onclick="restart()">🔄 Starta om</button>
</div>
<div id="gwrap"><canvas id="game"></canvas></div>
<div id="ctrl">
  <div class="dp">
    <button class="cb" id="bL">◀</button>
    <button class="cb" id="bR">▶</button>
  </div>
  <button class="cb" id="bJ">▲</button>
</div>
<div id="hint">Tangenter: ← → &nbsp;·&nbsp; Mellanslag / W / ↑ = hoppa &nbsp;·&nbsp; R = starta om</div>
<script>
(function(){
const PROJECT=${projectJSON};
${RUNTIME_JS}
startGame(PROJECT,document.getElementById('game'));
})();
</script>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Self-contained runtime (no external deps) ─────────────────────────────────
const RUNTIME_JS = `
const AS=${ART_SIZE},RS=${ROOM_SIZE},TS=48,RP=RS*TS;
const GR=.48,MF=14,MS=3.6,JV=-11.5,LG=.1,LMF=2.5,LJ=-7,BV=-14;
const COY=7,JBF=9,INV=80,PW=28,PH=42,EW=34,EH=42;

function ovlp(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;}

function gCells(project,roomId,beh){
  const room=project.worldMap.rooms[roomId];if(!room)return[];
  const r=[];
  for(let i=0;i<room.cells.length;i++){
    const tid=room.cells[i];if(!tid)continue;
    const t=project.tileArts.find(x=>x.id===tid);
    if(!t||t.blockTypeId!==beh)continue;
    const row=Math.floor(i/RS),col=i%RS;
    r.push({idx:i,row,col,x:col*TS,y:row*TS});
  }
  return r;
}

function resolve(e,solids){
  e.x+=e.vx;
  for(const c of solids){
    if(!ovlp(e,{x:c.x,y:c.y,w:TS,h:TS}))continue;
    const dx=(e.x+e.w/2)-(c.x+TS/2);e.x=dx>0?c.x+TS:c.x-e.w;e.vx=0;
  }
  e.y+=e.vy;e.onGround=false;
  for(const c of solids){
    if(!ovlp(e,{x:c.x,y:c.y,w:TS,h:TS}))continue;
    const dy=(e.y+e.h/2)-(c.y+TS/2);
    if(dy<0){e.y=c.y-e.h;e.vy=0;e.onGround=true;}
    else{e.y=c.y+TS;e.vy=Math.max(0,e.vy);}
  }
}

function buildCaches(project){
  const tc={},cc={};
  for(const tile of project.tileArts){
    const c=document.createElement('canvas');c.width=c.height=TS;
    const x=c.getContext('2d');const px=TS/AS;
    for(let y=0;y<AS;y++)for(let ix=0;ix<AS;ix++){
      x.fillStyle=(ix+y)%2===0?'#2a2848':'#1e1c38';x.fillRect(ix*px,y*px,px,px);
    }
    for(let i=0;i<tile.pixels.length;i++){
      const col=tile.pixels[i];if(!col)continue;
      x.fillStyle=col;x.fillRect((i%AS)*px,Math.floor(i/AS)*px,px,px);
    }
    tc[tile.id]=c;
  }
  const ch=project.playerCharacter;
  if(ch)for(const[an,anim]of Object.entries(ch.animations)){
    anim.frames.forEach((frame,i)=>{
      const c=document.createElement('canvas');c.width=c.height=TS;
      const x=c.getContext('2d');const px=TS/AS;
      for(let fi=0;fi<frame.pixels.length;fi++){
        const col=frame.pixels[fi];if(!col)continue;
        x.fillStyle=col;x.fillRect((fi%AS)*px,Math.floor(fi/AS)*px,px,px);
      }
      cc[an+'_'+i]=c;
    });
  }
  return{tc,cc};
}

function initState(project){
  const sid=project.worldMap.startRoomId;
  let rr=0,rc=0;
  const grid=project.worldMap.grid;
  outer:for(let r=0;r<project.worldMap.gridRows;r++)
    for(let c=0;c<project.worldMap.gridCols;c++)
      if(grid[r]?.[c]===sid){rr=r;rc=c;break outer;}
  const si=project.worldMap.spawnCellIndex??0;
  const sx=(si%RS)*TS+TS/2-PW/2,sy=Math.floor(si/RS)*TS-PH;
  const coins=[],enemies=[];
  for(const[rid]of Object.entries(project.worldMap.rooms)){
    gCells(project,rid,'collectible').forEach(c=>
      coins.push({id:'c_'+rid+'_'+c.idx,roomId:rid,x:c.x+TS/2-10,y:c.y+TS/2-10,collected:false,bobTime:Math.random()*Math.PI*2}));
    gCells(project,rid,'enemy').forEach(c=>
      enemies.push({id:'e_'+rid+'_'+c.idx,roomId:rid,x:c.x+TS/2-EW/2,y:c.y+TS/2-EH/2,w:EW,h:EH,vx:1.5,vy:0,onGround:false,health:1,invTimer:0,dir:1}));
  }
  return{player:{x:sx,y:sy,w:PW,h:PH,vx:0,vy:0,onGround:false,inLiquid:false,health:3,maxHealth:3,invTimer:0,coyoteTimer:0,jumpBuffer:0},
    coins,enemies,currentRoomId:sid||'',roomRow:rr,roomCol:rc,coinsCollected:0,status:'playing',statusTimer:0,flashAlpha:0,flashColor:'#ff0000',time:0};
}

function startGame(project,canvas){
  canvas.width=canvas.height=RP;
  const ctx=canvas.getContext('2d');
  const{tc,cc}=buildCaches(project);
  let state=initState(project);
  const inp={left:false,right:false,jumpHeld:false,jumpPressed:false};

  document.addEventListener('keydown',e=>{
    if(['ArrowLeft','a','A'].includes(e.key))inp.left=true;
    if(['ArrowRight','d','D'].includes(e.key))inp.right=true;
    if(['ArrowUp','w','W',' '].includes(e.key)){if(!inp.jumpHeld)inp.jumpPressed=true;inp.jumpHeld=true;e.preventDefault();}
    if(e.key==='r'||e.key==='R')state=initState(project);
  });
  document.addEventListener('keyup',e=>{
    if(['ArrowLeft','a','A'].includes(e.key))inp.left=false;
    if(['ArrowRight','d','D'].includes(e.key))inp.right=false;
    if(['ArrowUp','w','W',' '].includes(e.key))inp.jumpHeld=false;
  });

  function bindBtn(id,press,release){
    const el=document.getElementById(id);if(!el)return;
    el.addEventListener('pointerdown',e=>{e.preventDefault();el.classList.add('on');press();});
    el.addEventListener('pointerup',e=>{e.preventDefault();el.classList.remove('on');release();});
    el.addEventListener('pointerleave',e=>{e.preventDefault();el.classList.remove('on');release();});
  }
  bindBtn('bL',()=>inp.left=true,()=>inp.left=false);
  bindBtn('bR',()=>inp.right=true,()=>inp.right=false);
  bindBtn('bJ',()=>{if(!inp.jumpHeld)inp.jumpPressed=true;inp.jumpHeld=true;},()=>inp.jumpHeld=false);

  // Expose restart to inline onclick
  window.restart=()=>{state=initState(project);};

  function update(){
    if(state.status!=='playing'){state={...state,statusTimer:state.statusTimer+1};return;}
    const p={...state.player};const rid=state.currentRoomId;
    if(!project.worldMap.rooms[rid])return;
    state={...state,time:state.time+1};
    const solids=[...gCells(project,rid,'terrain'),...gCells(project,rid,'action')];
    p.inLiquid=gCells(project,rid,'liquid').some(c=>ovlp(p,{x:c.x,y:c.y,w:TS,h:TS}));
    const ac=.8,fr=p.onGround?.7:.85;
    const spd=MS*(project.moveSpeed??1);
    if(inp.left)p.vx=Math.max(p.vx-ac,-spd);
    else if(inp.right)p.vx=Math.min(p.vx+ac,spd);
    else p.vx*=fr;
    if(p.inLiquid){p.vy+=LG;p.vy=Math.min(p.vy,LMF);}else{p.vy+=GR;p.vy=Math.min(p.vy,MF);}
    if(p.onGround)p.coyoteTimer=COY;else if(p.coyoteTimer>0)p.coyoteTimer--;
    if(inp.jumpPressed)p.jumpBuffer=JBF;else if(p.jumpBuffer>0)p.jumpBuffer--;
    if(p.jumpBuffer>0&&(p.coyoteTimer>0||p.inLiquid)){p.vy=p.inLiquid?LJ:JV;p.coyoteTimer=0;p.jumpBuffer=0;p.onGround=false;}
    inp.jumpPressed=false;
    resolve(p,solids);
    let nr=rid,nrr=state.roomRow,nrc=state.roomCol;
    const g=project.worldMap.grid,TI=24;
    if(p.x+p.w<0){const id=g[state.roomRow]?.[state.roomCol-1]??null;
      if(id&&project.worldMap.rooms[id]){nr=id;nrc=state.roomCol-1;p.x=RP-p.w-2;p.y=Math.min(Math.max(p.y,0),RP-p.h-1);p.invTimer=Math.max(p.invTimer,TI);}else{p.x=0;p.vx=0;}}
    else if(p.x>RP){const id=g[state.roomRow]?.[state.roomCol+1]??null;
      if(id&&project.worldMap.rooms[id]){nr=id;nrc=state.roomCol+1;p.x=2;p.y=Math.min(Math.max(p.y,0),RP-p.h-1);p.invTimer=Math.max(p.invTimer,TI);}else{p.x=RP-p.w;p.vx=0;}}
    else if(p.y+p.h<0){const id=g[state.roomRow-1]?.[state.roomCol]??null;
      if(id&&project.worldMap.rooms[id]){nr=id;nrr=state.roomRow-1;p.y=RP-p.h-2;p.x=Math.min(Math.max(p.x,0),RP-p.w-1);p.invTimer=Math.max(p.invTimer,TI);}else{p.y=0;p.vy=0;}}
    else if(p.y>RP){const id=g[state.roomRow+1]?.[state.roomCol]??null;
      if(id&&project.worldMap.rooms[id]){nr=id;nrr=state.roomRow+1;p.y=2;p.x=Math.min(Math.max(p.x,0),RP-p.w-1);p.invTimer=Math.max(p.invTimer,TI);}
      else{p.health=Math.max(0,p.health-1);
        if(p.health<=0){state={...state,player:{...p},status:'dead',statusTimer:0,flashAlpha:1,flashColor:'#000'};return;}
        const ri=project.worldMap.spawnCellIndex??0;
        p.x=(ri%RS)*TS+TS/2-PW/2;p.y=Math.floor(ri/RS)*TS-PH;p.vy=0;p.vx=0;p.invTimer=INV;}}
    if(p.invTimer<=0)for(const c of gCells(project,nr,'hazard')){
      if(ovlp(p,{x:c.x,y:c.y,w:TS,h:TS})){p.health=Math.max(0,p.health-1);p.invTimer=INV;p.vy=JV*.6;
        if(p.health<=0){state={...state,player:{...p},currentRoomId:nr,roomRow:nrr,roomCol:nrc,status:'dead',statusTimer:0,flashAlpha:1,flashColor:'#f00'};return;}break;}}
    for(const c of gCells(project,nr,'action'))
      if(ovlp(p,{x:c.x,y:c.y,w:TS,h:TS})&&p.vy>0&&p.y+p.h>c.y&&p.y+p.h<c.y+TS/2){p.vy=BV;break;}
    if(p.invTimer<=0)for(const c of gCells(project,nr,'powerup'))
      if(ovlp(p,{x:c.x,y:c.y,w:TS,h:TS})){p.health=Math.min(p.maxHealth,p.health+1);break;}
    for(const c of gCells(project,nr,'story'))
      if(c.row<RS-2&&ovlp(p,{x:c.x,y:c.y,w:TS,h:TS})){
        state={...state,player:p,currentRoomId:nr,roomRow:nrr,roomCol:nrc,status:'won',statusTimer:0,flashAlpha:1,flashColor:'#22c55e'};return;}
    if(p.invTimer>0)p.invTimer--;
    const uc=state.coins.map(coin=>{
      if(coin.collected||coin.roomId!==nr)return{...coin,bobTime:coin.bobTime+.05};
      if(ovlp(p,{x:coin.x,y:coin.y,w:20,h:20}))return{...coin,collected:true};
      return{...coin,bobTime:coin.bobTime+.05};
    });
    const dc=state.coins.filter(c=>c.roomId!==nr||!c.collected).length-uc.filter(c=>c.roomId!==nr||!c.collected).length;
    const ue=state.enemies.map(en=>{
      if(en.roomId!==nr)return en;
      const e={...en};if(e.invTimer>0)e.invTimer--;
      e.vy+=GR*.8;e.vy=Math.min(e.vy,MF);e.vx=e.dir*1.5;
      resolve(e,gCells(project,nr,'terrain'));
      if(e.x<=0||e.x+e.w>=RP){e.dir=e.dir===1?-1:1;e.vx=e.dir*1.5;}
      if(p.invTimer<=0&&ovlp(p,e)){
        if(p.vy>0&&p.y+p.h<e.y+e.h*.4){e.health=0;p.vy=JV*.5;}
        else{p.health=Math.max(0,p.health-1);p.invTimer=INV;p.vy=JV*.4;p.vx=p.x<e.x+e.w/2?-3:3;}}
      return e;
    }).filter(e=>e.health>0);
    state={...state,player:p,coins:uc,enemies:ue,currentRoomId:nr,roomRow:nrr,roomCol:nrc,
      coinsCollected:state.coinsCollected+dc,flashAlpha:Math.max(0,state.flashAlpha-.05)};
  }

  function render(){
    const{player:p,currentRoomId:rid,coins,enemies,status,statusTimer,flashAlpha,flashColor,coinsCollected}=state;
    const room=project.worldMap.rooms[rid];
    const W=canvas.width,H=canvas.height;
    ctx.fillStyle=project.backgroundColor;ctx.fillRect(0,0,W,H);
    if(!room)return;
    const sc=Math.min(W/RP,H/RP),ox=(W-RP*sc)/2,oy=(H-RP*sc)/2;
    ctx.save();ctx.translate(ox,oy);ctx.scale(sc,sc);
    for(let i=0;i<room.cells.length;i++){
      const tid=room.cells[i];if(!tid)continue;
      const col=i%RS,row=Math.floor(i/RS);
      const t=tc[tid];if(t)ctx.drawImage(t,col*TS,row*TS,TS,TS);
    }
    ctx.save();
    for(const coin of coins){
      if(coin.collected||coin.roomId!==rid)continue;
      const by=Math.sin(coin.bobTime)*4;
      ctx.fillStyle='#fbbf24';ctx.shadowColor='#fbbf24';ctx.shadowBlur=8;
      ctx.beginPath();ctx.arc(coin.x+10,coin.y+10+by,9,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#fde047';ctx.shadowBlur=0;
      ctx.beginPath();ctx.arc(coin.x+7,coin.y+7+by,3.5,0,Math.PI*2);ctx.fill();
    }
    ctx.shadowBlur=0;ctx.restore();
    for(const en of enemies){
      if(en.roomId!==rid)continue;
      if(en.invTimer>0&&Math.floor(en.invTimer/4)%2===0)continue;
      ctx.fillStyle='#c084fc';ctx.fillRect(en.x,en.y,en.w,en.h);
      ctx.fillStyle='#fff';
      const ex=en.dir===1?en.x+en.w*.6:en.x+en.w*.2;
      ctx.fillRect(ex,en.y+en.h*.2,8,8);ctx.fillStyle='#000';ctx.fillRect(ex+2,en.y+en.h*.2+2,4,4);
    }
    if(!(p.invTimer>0&&Math.floor(p.invTimer/4)%2===0)){
      const ch=project.playerCharacter;let cf=null;
      if(ch){
        let an;
        if(p.invTimer>INV/2)an='hurt';
        else if(!p.onGround&&p.vy<0)an='jump';
        else if(!p.onGround&&p.vy>1)an='fall';
        else if(Math.abs(p.vx)>.3)an='walk';
        else an='idle';
        let anim=ch.animations[an];
        if(!anim||anim.frames.length===0){an='idle';anim=ch.animations['idle'];}
        if(anim&&anim.frames.length>0){
          const fi=Math.floor(state.time/Math.max(1,Math.round(60/anim.fps)))%anim.frames.length;
          cf=cc[an+'_'+fi]??null;
        }
      }
      if(cf){
        ctx.save();
        if(p.vx<-.1){ctx.translate(p.x+p.w,p.y);ctx.scale(-1,1);ctx.drawImage(cf,0,0,p.w,p.h);}
        else ctx.drawImage(cf,p.x,p.y,p.w,p.h);
        ctx.restore();
      }else{
        ctx.fillStyle=p.inLiquid?'#60a5fa':'#4f46e5';ctx.fillRect(p.x,p.y,p.w,p.h);
        ctx.fillStyle='#fff';ctx.fillRect(p.x+p.w*.6,p.y+p.h*.18,9,9);ctx.fillRect(p.x+p.w*.1,p.y+p.h*.18,9,9);
        ctx.fillStyle='#1e1b4b';ctx.fillRect(p.x+p.w*.6+2,p.y+p.h*.18+2,5,5);ctx.fillRect(p.x+p.w*.1+2,p.y+p.h*.18+2,5,5);
        ctx.fillStyle='#fff';ctx.fillRect(p.x+p.w*.2,p.y+p.h*.55,p.w*.6,3);
      }
    }
    ctx.restore();
    ctx.fillStyle='#fbbf24';ctx.font='bold 18px system-ui,sans-serif';
    ctx.fillText('\uD83E\uDE99 '+coinsCollected,14,30);
    for(let i=0;i<p.maxHealth;i++){ctx.font='20px system-ui';ctx.fillText(i<p.health?'\u2764\uFE0F':'\uD83D\uDDA4',W-24-i*28,30);}
    if(flashAlpha>0){ctx.globalAlpha=flashAlpha*.5;ctx.fillStyle=flashColor;ctx.fillRect(0,0,W,H);ctx.globalAlpha=1;}
    if(status==='won'){
      ctx.fillStyle='rgba(0,0,0,'+Math.min(.7,statusTimer/30)+')';ctx.fillRect(0,0,W,H);
      ctx.fillStyle='#22c55e';ctx.textAlign='center';ctx.font='bold 48px system-ui,sans-serif';
      ctx.fillText('\uD83C\uDF89 Du vann!',W/2,H/2);
      ctx.font='bold 20px system-ui,sans-serif';ctx.fillStyle='#86efac';
      ctx.fillText('Tryck R f\u00F6r att spela igen',W/2,H/2+50);ctx.textAlign='left';
    }
    if(status==='dead'){
      ctx.fillStyle='rgba(0,0,0,'+Math.min(.75,statusTimer/30)+')';ctx.fillRect(0,0,W,H);
      ctx.fillStyle='#ef4444';ctx.textAlign='center';ctx.font='bold 48px system-ui,sans-serif';
      ctx.fillText('\uD83D\uDC80 Game Over',W/2,H/2);
      ctx.font='bold 20px system-ui,sans-serif';ctx.fillStyle='#fca5a5';
      ctx.fillText('Tryck R f\u00F6r att f\u00F6rs\u00F6ka igen',W/2,H/2+50);ctx.textAlign='left';
    }
  }

  function loop(){update();render();requestAnimationFrame(loop);}
  loop();
}
`;
