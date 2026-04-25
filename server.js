'use strict';
const http = require('http');
const fs   = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT    = process.env.PORT || 3000;
const PUB_DIR = path.join(__dirname, 'public');
const MIME    = {'.html':'text/html;charset=utf-8','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.ico':'image/x-icon','.mp3':'audio/mpeg'};

// ═══════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════
const SECTORS = ['ia','fintech','seguranca','biotech','energia'];
const SECTOR_LABEL = {ia:'IA',fintech:'Fintech',seguranca:'Segurança',biotech:'Biotech',energia:'Energia'};

// 10 startups, 2 per sector
const STARTUP_DEFS = [
  {id:'deepanic',   name:'DeePanic',     sector:'ia',        basePrice:3},
  {id:'halluci',    name:'HalluciNet',   sector:'ia',        basePrice:2},
  {id:'cashburn',   name:'CashBurn',     sector:'fintech',   basePrice:4},
  {id:'tokenstonk', name:'TokenStonks',  sector:'fintech',   basePrice:3},
  {id:'hackshield', name:'HackShield',   sector:'seguranca', basePrice:3},
  {id:'zerotrust',  name:'ZeroTrustUs',  sector:'seguranca', basePrice:2},
  {id:'crispash',   name:'CRISPRash',    sector:'biotech',   basePrice:4},
  {id:'pharmarush', name:'PharmaRush',   sector:'biotech',   basePrice:3},
  {id:'fusionfail', name:'FusionFail',   sector:'energia',   basePrice:2},
  {id:'solarscam',  name:'SolarScam',    sector:'energia',   basePrice:3},
];

// 12 CEOs — each has a sector affinity (+1 permanent to that sector) + special effect
// hasRoll: true → auto-rolls dice, effect amplified by roll
const CEO_DEFS = [
  {id:'ev', name:'Elon V.',    role:'Caótico Visionário',   sector:'energia',   hasRoll:true,
   mult:null, // determined at gate by archetype
   effect(g,roll){
     const d=roll||3;
     applyToSector(g,'ia',Math.floor(d/2));
     if(d>=5) randomImplode(g);
     return `IA +${Math.floor(d/2)}M${d>=5?', startup aleatória implodiu!':''}`;
   }},
  {id:'mz', name:'Mark Z.',    role:'Metódico Controlador', sector:'fintech',   hasRoll:false,
   effect(g){applyToSector(g,'fintech',2);applyToSector(g,'ia',-1);return 'Fintech +2M, IA -1M';}},
  {id:'sa', name:'Sam A.',     role:'Hype Master',          sector:'ia',        hasRoll:true,
   effect(g,roll){applyToSector(g,'ia',roll);applyToSector(g,'biotech',-1);return `IA +${roll}M, Biotech -1M`;}},
  {id:'jh', name:'Jensen H.',  role:'Técnico Preciso',      sector:'ia',        hasRoll:false,
   effect(g){applyToSector(g,'ia',3);applyToSector(g,'energia',-1);return 'IA +3M, Energia -1M';}},
  {id:'rh', name:'Reed H.',    role:'Pivot Constante',      sector:'fintech',   hasRoll:true,
   effect(g,roll){const up=SECTORS[roll%5],down=SECTORS[(roll+2)%5];applyToSector(g,up,2);applyToSector(g,down,-2);return `${SECTOR_LABEL[up]} +2M, ${SECTOR_LABEL[down]} -2M`;}},
  {id:'tk', name:'Travis K.',  role:'Disruptivo',           sector:'seguranca', hasRoll:true,
   effect(g,roll){if(!g.safeThisTurn)randomImplode(g);applyToSector(g,'seguranca',roll-2);return `Segurança ${fmtD(roll-2)}, implode startup`;}},
  {id:'eh', name:'Elizabeth H.',role:'Fraude Elegante',    sector:'biotech',   hasRoll:false,
   effect(g){applyToSector(g,'biotech',4);g.pendingPenalty={sector:'biotech',delta:-4};return 'Biotech +4M agora, -4M na próxima ronda';}},
  {id:'bc', name:'Brian C.',   role:'Partilha de Risco',   sector:'energia',   hasRoll:false,
   effect(g){g.safeThisTurn=true;SECTORS.forEach(s=>applyToSector(g,s,1));return 'Todos os sectores +1M, nenhuma startup implode';}},
  {id:'an', name:'Adam N.',    role:'Wellness Caótico',    sector:'biotech',   hasRoll:true,
   effect(g,roll){applyToSector(g,'biotech',roll-3);g.salarySurcharge=1;return `Biotech ${fmtD(roll-3)}, salários +1M este turno`;}},
  {id:'pc', name:'Patrick C.', role:'Crescimento Metódico',sector:'fintech',   hasRoll:false,
   effect(g){applyToSector(g,'fintech',2);applyToSector(g,'seguranca',1);return 'Fintech +2M, Segurança +1M';}},
  {id:'sb', name:'Sam B.',     role:'Colapso Espectacular',sector:'fintech',   hasRoll:true,
   effect(g,roll){
     if(roll>=4){randomImplode(g);return `Dado ${roll}: startup aleatória implodiu!`;}
     else{applyToSector(g,'fintech',4);return `Dado ${roll}: Fintech +4M`;}
   }},
  {id:'ww', name:'Whitney W.', role:'Exit Queen',           sector:'seguranca', hasRoll:false,
   effect(g){g.gateMultiplierBonus=(g.gateMultiplierBonus||0)+1;return 'Gate multiplicador +1 nível';}},
];

// Gate multipliers by CEO archetype
const HIGH_MULT_CEOS = new Set(['sa','ev','ww','sb']);
const LOW_MULT_CEOS  = new Set(['mz','jh','pc','bc']);
const GATE_MULTS = [1,5,20];

// Worker pool — names + types
const WORKER_TYPES = ['engineer','lawyer','pr','cfo'];
const WORKER_NAMES = {
  engineer:['Ada','Linus','Grace','Tim','Bjarne','Guido','Dennis','Ken'],
  lawyer:  ['Harvey','Kim','Elle','Saul','Alan','Ruth','Thurgood','Amal'],
  pr:      ['Max','Donna','Olivia','Louis','Judy','Seth','Ari','Samantha'],
  cfo:     ['Gordon','Warren','Ray','Carol','Jack','Sheryl','Jamie','Mary'],
};
// Dividends per worker per round: engineer→2, others→1; senior doubles it
const WORKER_DIV = {engineer:2, lawyer:1, pr:1, cfo:1};

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════
function fmtD(n){return (n>=0?'+':'')+n+'M';}
function shuf(a){for(let i=a.length-1;i>0;i--){const j=0|Math.random()*(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
function ceoData(id){return CEO_DEFS.find(c=>c.id===id);}
function spLog(g,msg){g.log.unshift(msg);if(g.log.length>30)g.log.pop();}

function applyToSector(g,sector,delta){
  if(!delta)return;
  g.sectorValues[sector]=(g.sectorValues[sector]||0)+delta;
  g.startups.forEach(s=>{
    if(s.sector===sector&&!s.imploded)
      s.price=Math.max(1,s.basePrice+(g.sectorValues[sector]||0));
  });
}

function randomImplode(g){
  if(g.safeThisTurn)return;
  const alive=g.startups.filter(s=>!s.imploded);
  if(!alive.length)return;
  const target=alive[0|Math.random()*alive.length];
  target.imploded=true;
  spLog(g,`💀 ${target.name} implodiu!`);
}

// Build initial worker pool
function buildWorkerPool(){
  const pool=[];
  WORKER_TYPES.forEach(type=>{
    const names=shuf([...WORKER_NAMES[type]]);
    for(let i=0;i<3;i++) pool.push({id:`${type}_${i}`,type,name:names[i],available:true});
  });
  return pool; // 12 workers (3 per type)
}

// ═══════════════════════════════════════════════════════
// GAME INIT
// ═══════════════════════════════════════════════════════
function spNewGame(players){
  const startups=STARTUP_DEFS.map(s=>({...s,price:s.basePrice,shares:{},imploded:false}));
  const ps=players.map((lp,i)=>({
    name:lp.name,isBot:!!lp.isBot,colorIdx:i,
    cash:10,shares:{},workers:[],score:0,
  }));
  const ceoDeck=shuf(CEO_DEFS.map(c=>c.id));
  const workerPool=buildWorkerPool();
  return {
    n:ps.length,players:ps,startups,
    ceoDeck,ceoIdx:0,
    currentCeo:null,currentRoll:null,ceoLog:'',
    sectorValues:{ia:0,fintech:0,seguranca:0,biotech:0,energia:0},
    workerPool,
    turn:0,round:1,cur:0,
    phase:'MARKET', // MARKET | MAINTENANCE | GAME_OVER
    gateOpen:false,gateMultiplier:1,gateMultiplierBonus:0,
    safeThisTurn:false,salarySurcharge:0,pendingPenalty:null,
    dividendLog:[],
    log:['🚀 Startup Panic começou! Ronda 1 — ' + ps[0].name],
  };
}

// ═══════════════════════════════════════════════════════
// ROUND START — auto CEO + dice
// ═══════════════════════════════════════════════════════
function startRound(g){
  g.safeThisTurn=false;g.salarySurcharge=0;

  // Apply pending penalty (Elizabeth H.)
  if(g.pendingPenalty){
    applyToSector(g,g.pendingPenalty.sector,g.pendingPenalty.delta);
    spLog(g,`📉 Elizabeth H.: Biotech ${fmtD(g.pendingPenalty.delta)} (efeito diferido)`);
    g.pendingPenalty=null;
  }

  // Reveal CEO
  const ceoId=g.ceoDeck[g.ceoIdx%12];g.ceoIdx++;
  const ceo=ceoData(ceoId);
  g.currentCeo=ceoId;

  // CEO permanent sector bonus
  applyToSector(g,ceo.sector,1);

  // Auto-roll if needed
  const roll=ceo.hasRoll?(1+0|Math.random()*6):null;
  g.currentRoll=roll;

  // Apply effect
  const effectLog=ceo.effect(g,roll);
  g.ceoLog=effectLog;

  spLog(g,`📋 ${ceo.name} (${SECTOR_LABEL[ceo.sector]} +1M)${roll?' 🎲'+roll:''}: ${effectLog}`);

  // Check gate (turns 4, 8, 12)
  const globalTurn=g.ceoIdx; // 1-indexed
  if(globalTurn===4||globalTurn===8||globalTurn===12){
    g.gateOpen=true;
    const mIdx=HIGH_MULT_CEOS.has(ceoId)?2:LOW_MULT_CEOS.has(ceoId)?0:1;
    g.gateMultiplier=GATE_MULTS[Math.min(2,mIdx+(g.gateMultiplierBonus||0))];
    spLog(g,`🔔 Gate de Venda! Multiplicador ×${g.gateMultiplier} — ${ceo.name}`);
  } else {
    g.gateOpen=false;
  }
}

// ═══════════════════════════════════════════════════════
// END OF ROUND — auto dividends
// ═══════════════════════════════════════════════════════
function endRound(g){
  g.dividendLog=[];
  g.players.forEach((p,pi)=>{
    let total=0;
    g.startups.forEach(su=>{
      if(su.imploded)return;
      const shares=su.shares[pi]||0;if(!shares)return;
      // Workers this player has in this startup
      const myWorkers=p.workers.filter(w=>w.startupId===su.id);
      if(!myWorkers.length)return; // no workers = no dividends
      // Dividend = shares × Σ workerDiv (senior doubles)
      const div=myWorkers.reduce((s,w)=>{
        const base=WORKER_DIV[w.type]||1;
        return s+(w.senior?base*2:base);
      },0);
      const earned=shares*div;
      p.cash+=earned;total+=earned;
      g.dividendLog.push({player:p.name,startup:su.name,shares,div,earned});
    });
    if(total>0) spLog(g,`💵 ${p.name} recebeu ${total}M em dividendos`);
  });

  g.round++;
  spLog(g,`— Ronda ${g.round} —`);
}

// ═══════════════════════════════════════════════════════
// HANDLE ACTIONS
// ═══════════════════════════════════════════════════════
function spHandle(g,seat,msg){
  const p=g.players[seat];

  // ── MARKET ──────────────────────────────────────────
  if(msg.type==='SP_BUY'){
    if(g.phase!=='MARKET'||g.cur!==seat)return{error:'Não é o teu turno'};
    const su=g.startups.find(s=>s.id===msg.startupId);
    if(!su||su.imploded)return{error:'Startup inválida'};
    const qty=msg.qty||1;
    const cost=su.price*qty;
    if(p.cash<cost)return{error:`Precisas de ${cost}M (tens ${p.cash}M)`};
    p.cash-=cost;
    su.shares[seat]=(su.shares[seat]||0)+qty;
    p.shares[su.id]=(p.shares[su.id]||0)+qty;
    spLog(g,`💰 ${p.name} comprou ${qty}× ${su.name} (${cost}M)`);
    return{ok:true};
  }

  if(msg.type==='SP_SELL_STARTUP'){
    if(!g.gateOpen||g.cur!==seat)return{error:'Gate de Venda não está aberto'};
    const su=g.startups.find(s=>s.id===msg.startupId);if(!su)return{error:'Startup inválida'};
    const shares=su.shares[seat]||0;if(!shares)return{error:'Não tens acções'};
    const maxSh=Math.max(0,...Object.values(su.shares));
    if(shares<maxSh)return{error:'Precisas de maioria para vender'};
    const mult=g.gateMultiplier+(g.gateMultiplierBonus||0);
    const proceeds=Math.round(su.price*shares*mult);
    p.cash+=proceeds;
    su.shares[seat]=0;p.shares[su.id]=0;
    spLog(g,`🏙 ${p.name} vendeu ${su.name} ×${mult} = ${proceeds}M!`);
    return{ok:true};
  }

  if(msg.type==='SP_TRADE'){
    if(!g.gateOpen)return{error:'Só é possível trocar em Gate de Venda'};
    const {fromSu,toSeat,toSu}=msg;
    const target=g.players[toSeat];if(!target||target.isBot)return{error:'Alvo inválido'};
    const su1=g.startups.find(s=>s.id===fromSu);
    const su2=g.startups.find(s=>s.id===toSu);
    if(!su1||!su2)return{error:'Startups inválidas'};
    const sh1=su1.shares[seat]||0,sh2=su2.shares[toSeat]||0;
    if(!sh1||!sh2)return{error:'Ambos precisam de acções nas respectivas startups'};
    // Swap all shares
    su1.shares[seat]=0;su1.shares[toSeat]=sh1;
    su2.shares[toSeat]=0;su2.shares[seat]=sh2;
    p.shares[su1.id]=0;p.shares[su2.id]=sh2;
    target.shares[su2.id]=0;target.shares[su1.id]=sh1;
    spLog(g,`🔄 ${p.name} trocou ${su1.name} com ${target.name} por ${su2.name}`);
    return{ok:true};
  }

  if(msg.type==='SP_END_MARKET'){
    if(g.phase!=='MARKET'||g.cur!==seat)return{error:'Não é o teu turno'};
    g.phase='MAINTENANCE';
    return{ok:true};
  }

  // ── MAINTENANCE ──────────────────────────────────────
  if(msg.type==='SP_HIRE'){
    if(g.phase!=='MAINTENANCE'||g.cur!==seat)return{error:'Não é a fase de manutenção'};
    const worker=g.workerPool.find(w=>w.id===msg.workerId&&w.available);
    if(!worker)return{error:'Trabalhador não disponível'};
    const su=g.startups.find(s=>s.id===msg.startupId);
    if(!su||su.imploded)return{error:'Startup inválida'};
    const senior=!!msg.senior;
    // Hiring cost: senior = 2× salary upfront, junior = free
    const salary=senior?2:0;
    if(p.cash<salary)return{error:`Precisas de ${salary}M para contratar Sénior`};
    p.cash-=salary;
    worker.available=false;
    p.workers.push({id:worker.id,type:worker.type,name:worker.name,startupId:su.id,senior});
    spLog(g,`👷 ${p.name} contratou ${worker.name} (${worker.type}${senior?' Sénior':' Estagiário'}) → ${su.name}`);
    return{ok:true};
  }

  if(msg.type==='SP_FIRE'){
    if(g.phase!=='MAINTENANCE'||g.cur!==seat)return{error:'Não é a fase de manutenção'};
    const idx=p.workers.findIndex(w=>w.id===msg.workerId);
    if(idx<0)return{error:'Trabalhador não encontrado'};
    const w=p.workers.splice(idx,1)[0];
    // Pay severance (1 salary = 1M for estagiário, 2M for senior) - optional, skip for now
    const poolW=g.workerPool.find(pw=>pw.id===w.id);
    if(poolW)poolW.available=true; // returns to pool
    spLog(g,`❌ ${p.name} despediu ${w.name} — volta à pool`);
    return{ok:true};
  }

  if(msg.type==='SP_MOVE_WORKER'){
    if(g.phase!=='MAINTENANCE'||g.cur!==seat)return{error:'Não é a fase de manutenção'};
    const w=p.workers.find(w=>w.id===msg.workerId);if(!w)return{error:'Trabalhador não encontrado'};
    const su=g.startups.find(s=>s.id===msg.startupId);if(!su||su.imploded)return{error:'Startup inválida'};
    const cost=w.senior?2:1; // indemnização = 1 salário
    if(p.cash<cost)return{error:`Indemnização de ${cost}M para mover`};
    p.cash-=cost;
    const old=w.startupId;w.startupId=su.id;
    spLog(g,`🔀 ${p.name} moveu ${w.name} de ${old} → ${su.name} (indemnização ${cost}M)`);
    return{ok:true};
  }

  if(msg.type==='SP_PAY_SALARY'){
    if(g.phase!=='MAINTENANCE'||g.cur!==seat)return{error:'Não é a fase de manutenção'};
    // Pay all seniors (1M each this round)
    let cost=0;const toFire=[];
    p.workers.forEach(w=>{
      if(!w.senior)return;
      const salary=1+(g.salarySurcharge||0);
      if(p.cash>=salary){p.cash-=salary;cost+=salary;}
      else toFire.push(w.id);
    });
    toFire.forEach(id=>{
      const idx=p.workers.findIndex(w=>w.id===id);
      if(idx<0)return;
      const w=p.workers.splice(idx,1)[0];
      const pw=g.workerPool.find(x=>x.id===w.id);if(pw)pw.available=true;
      spLog(g,`💸 ${w.name} abandonou ${p.name} (sem salário)`);
    });
    if(cost>0)spLog(g,`💼 ${p.name} pagou ${cost}M em salários`);
    return{ok:true};
  }

  if(msg.type==='SP_END_TURN'){
    if(g.phase!=='MAINTENANCE'||g.cur!==seat)return{error:'Não é o teu turno'};
    // Next player
    g.cur=(g.cur+1)%g.n;
    if(g.cur===0){
      // All players done — end of round
      endRound(g);
      if(g.ceoIdx>=12){spEndGame(g);return{ok:true};}
      startRound(g);
    }
    g.phase='MARKET';
    spLog(g,`→ Turno de ${g.players[g.cur].name}`);
    return{ok:true};
  }

  return{error:'Acção desconhecida: '+msg.type};
}

function spEndGame(g){
  g.phase='GAME_OVER';
  g.players.forEach((p,i)=>{
    let total=p.cash;
    g.startups.forEach(su=>{if(!su.imploded)total+=(su.shares[i]||0)*su.price;});
    p.score=total;
  });
  const winner=g.players.reduce((a,b)=>a.score>b.score?a:b);
  spLog(g,`🏆 ${winner.name} vence com ${winner.score}M!`);
}

// ═══════════════════════════════════════════════════════
// VIEW (what each player sees)
// ═══════════════════════════════════════════════════════
function spView(g,seat){
  const me=g.players[seat];
  const ceo=g.currentCeo?ceoData(g.currentCeo):null;
  const ceoSafe=ceo?{id:ceo.id,name:ceo.name,role:ceo.role,sector:ceo.sector,hasRoll:ceo.hasRoll}:null;
  return {
    n:g.n,cur:g.cur,myIdx:seat,round:g.round,phase:g.phase,
    gateOpen:g.gateOpen,gateMultiplier:g.gateMultiplier+(g.gateMultiplierBonus||0),
    currentCeo:ceoSafe,currentRoll:g.currentRoll,ceoLog:g.ceoLog,
    sectorValues:g.sectorValues,
    players:g.players.map((p,i)=>({
      name:p.name,isBot:p.isBot,colorIdx:p.colorIdx,score:p.score,
      cash:i===seat?p.cash:null,
      shares:i===seat?p.shares:{},
      workerCount:p.workers.length,
      workers:i===seat?p.workers:[],
    })),
    startups:g.startups.map(s=>({
      id:s.id,name:s.name,sector:s.sector,price:s.price,basePrice:s.basePrice,
      imploded:s.imploded,
      myShares:s.shares[seat]||0,
      totalShares:Object.values(s.shares).reduce((a,b)=>a+b,0),
      majority:Object.entries(s.shares).sort((a,b)=>b[1]-a[1])[0]||null,
    })),
    workerPool:g.workerPool.filter(w=>w.available).map(w=>({id:w.id,type:w.type,name:w.name})),
    myWorkers:me.workers,
    dividendLog:g.dividendLog,
    log:g.log,
  };
}

// ═══════════════════════════════════════════════════════
// BOT AI
// ═══════════════════════════════════════════════════════
function spBot(g){
  if(g.phase==='GAME_OVER')return null;
  const p=g.players[g.cur];if(!p?.isBot)return null;

  if(g.phase==='MARKET'){
    // Sell if gate open and has majority
    if(g.gateOpen){
      for(const su of g.startups){
        const mine=su.shares[g.cur]||0;if(!mine)continue;
        const mx=Math.max(0,...Object.values(su.shares));
        if(mine>=mx)return{type:'SP_SELL_STARTUP',startupId:su.id};
      }
    }
    // Buy cheapest affordable startup
    const options=g.startups.filter(su=>!su.imploded&&su.price<=p.cash);
    if(options.length&&p.cash>=3){
      options.sort((a,b)=>b.price-a.price); // prefer higher value
      return{type:'SP_BUY',startupId:options[0].id,qty:1};
    }
    return{type:'SP_END_MARKET'};
  }

  if(g.phase==='MAINTENANCE'){
    // Pay salaries first
    const hasSeniors=p.workers.some(w=>w.senior);
    if(hasSeniors)return{type:'SP_PAY_SALARY'};
    // Hire a free worker if has shares and no workers in that startup
    const availW=g.workerPool.find(w=>w.available&&w.type==='engineer');
    const targetSu=g.startups.find(su=>!su.imploded&&(su.shares[g.cur]||0)>0&&!p.workers.find(w=>w.startupId===su.id));
    if(availW&&targetSu)return{type:'SP_HIRE',workerId:availW.id,startupId:targetSu.id,senior:false};
    return{type:'SP_END_TURN'};
  }
  return null;
}

// ═══════════════════════════════════════════════════════
// LOBBY + WS INFRASTRUCTURE
// ═══════════════════════════════════════════════════════
const LOBBY_DEFS=[
  {id:'sp-solo', name:'Solo vs IA', maxP:1,solo:true, bots:1},
  {id:'sp-2p-1', name:'2 Jogadores — Mesa 1', maxP:2,solo:false},
  {id:'sp-2p-2', name:'2 Jogadores — Mesa 2', maxP:2,solo:false},
  {id:'sp-3p-1', name:'3 Jogadores',           maxP:3,solo:false},
  {id:'sp-4p-1', name:'4 Jogadores',           maxP:4,solo:false},
];

const LOBBIES={},SESSIONS={},WS_MAP=new WeakMap(),CONNS=new Set();
LOBBY_DEFS.forEach(d=>{
  LOBBIES[d.id]={...d,
    players:Array(d.maxP).fill(null),names:Array(d.maxP).fill(''),
    tokens:Array(d.maxP).fill(null),game:null,
    graceTimers:Array(d.maxP).fill(null),botTimer:null,_abandonedAt:null};
});

function cSend(ws,obj){if(ws?.readyState===1)ws.send(JSON.stringify(obj));}
function lobbyInfo(l){return{id:l.id,name:l.name,solo:l.solo,maxP:l.maxP,
  seated:l.players.filter(Boolean).length,playing:!!l.game};}
function broadcastLobbies(){
  const ls=Object.values(LOBBIES).map(lobbyInfo);
  CONNS.forEach(ws=>cSend(ws,{type:'LOBBIES',lobbies:ls}));
}
function broadcastGame(lobby){
  const g=lobby.game;if(!g)return;
  lobby.players.forEach((ws,i)=>{
    if(!ws)return;
    try{cSend(ws,{type:'GAME_STATE',state:spView(g,i)});}
    catch(e){console.error('[broadcastGame]',e.message);}
  });
}
function scheduleBots(lobby){
  if(lobby.botTimer)return;
  lobby.botTimer=setTimeout(()=>{
    lobby.botTimer=null;
    const g=lobby.game;if(!g||g.phase==='GAME_OVER')return;
    const p=g.players[g.cur];if(!p?.isBot)return;
    const action=spBot(g);
    if(action){spHandle(g,g.cur,action);broadcastGame(lobby);}
    if(g.phase!=='GAME_OVER')scheduleBots(lobby);
  },800);
}

const server=http.createServer((req,res)=>{
  res.setHeader('Access-Control-Allow-Origin','*');
  const url=req.url.split('?')[0];
  const fp=url==='/'?path.join(PUB_DIR,'index.html'):path.join(PUB_DIR,url);
  fs.readFile(fp,(err,data)=>{
    if(err){res.writeHead(404);res.end('Not found');return;}
    res.writeHead(200,{'Content-Type':MIME[path.extname(fp)]||'application/octet-stream'});
    res.end(data);
  });
});

const wss=new WebSocketServer({server,perMessageDeflate:false});

wss.on('connection',ws=>{
  CONNS.add(ws);
  cSend(ws,{type:'LOBBIES',lobbies:Object.values(LOBBIES).map(lobbyInfo)});
  ws.on('message',raw=>{try{dispatch(ws,JSON.parse(raw));}catch(e){console.error(e);}});
  ws.on('close',()=>{
    CONNS.delete(ws);
    const st=WS_MAP.get(ws);if(!st?.lobbyId)return;
    const lobby=LOBBIES[st.lobbyId];if(!lobby)return;
    const{seat,token}=st;
    lobby.players[seat]=null;
    if(lobby.solo){
      lobby.graceTimers[seat]=setTimeout(()=>{
        lobby.names[seat]='';lobby.tokens[seat]=null;
        if(SESSIONS[token])delete SESSIONS[token];
        if(lobby.game){lobby.game=null;if(lobby.botTimer){clearTimeout(lobby.botTimer);lobby.botTimer=null;}}
        broadcastLobbies();
      },12000);
    } else {
      lobby.graceTimers[seat]=setTimeout(()=>{
        lobby.names[seat]='';lobby.tokens[seat]=null;
        if(SESSIONS[token])delete SESSIONS[token];
        if(lobby.game){lobby.game=null;lobby.players.forEach(p=>{if(p)cSend(p,{type:'GAME_ABORTED',reason:'Adversário desligou.'});});}
        broadcastLobbies();
      },45000);
    }
    broadcastLobbies();
  });
});

function dispatch(ws,msg){
  // SET_NAME
  if(msg.type==='SET_NAME'){
    cSend(ws,{type:'NAME_OK',name:(msg.name||'').trim().slice(0,20)});
    return;
  }
  // REQUEST_STATE
  if(msg.type==='REQUEST_STATE'){
    const st=WS_MAP.get(ws);if(!st)return;
    const lobby=LOBBIES[st.lobbyId];if(!lobby?.game)return;
    cSend(ws,{type:'GAME_STATE',state:spView(lobby.game,st.seat)});
    return;
  }
  // LEAVE_LOBBY
  if(msg.type==='LEAVE_LOBBY'){
    const st=WS_MAP.get(ws);if(!st)return;
    const lobby=LOBBIES[st.lobbyId];if(!lobby)return;
    const{seat,token}=st;
    clearTimeout(lobby.graceTimers[seat]);
    if(SESSIONS[token])delete SESSIONS[token];
    lobby.players[seat]=null;lobby.names[seat]='';lobby.tokens[seat]=null;
    WS_MAP.delete(ws);
    if(lobby.game&&lobby.solo){lobby.game=null;if(lobby.botTimer){clearTimeout(lobby.botTimer);lobby.botTimer=null;}}
    if(lobby.game&&!lobby.solo){lobby.game=null;lobby.players.forEach(p=>{if(p)cSend(p,{type:'GAME_ABORTED',reason:'Jogador saiu.'});});}
    broadcastLobbies();return;
  }
  // START (multiplayer)
  if(msg.type==='START'){
    const st=WS_MAP.get(ws);if(!st)return;
    const lobby=LOBBIES[st.lobbyId];if(!lobby||lobby.game)return;
    const seated=lobby.players.map((p,i)=>p?{name:lobby.names[i],isBot:false}:null).filter(Boolean);
    if(seated.length<2)return;
    lobby.game=spNewGame(seated);
    startRound(lobby.game);
    broadcastGame(lobby);return;
  }
  // JOIN
  if(msg.type==='JOIN'){
    const lobby=LOBBIES[msg.lobbyId];if(!lobby)return;
    const token=msg.token||Math.random().toString(36).slice(2)+Date.now().toString(36);
    // Reconnect?
    if(SESSIONS[token]){
      const{lobbyId,seat}=SESSIONS[token];
      const lb=LOBBIES[lobbyId];
      if(lb&&lb.tokens[seat]===token){
        clearTimeout(lb.graceTimers[seat]);lb.graceTimers[seat]=null;
        lb.players[seat]=ws;WS_MAP.set(ws,{lobbyId,seat,token});
        cSend(ws,{type:'JOINED',seat,token,solo:lb.solo});
        if(lb.game)cSend(ws,{type:'GAME_STATE',state:spView(lb.game,seat)});
        else cSend(ws,{type:'LOBBY_STATE',names:lb.names,mySeat:seat});
        if(lb.solo&&lb.game?.phase!=='GAME_OVER')scheduleBots(lb);
        broadcastLobbies();return;
      }
    }
    let seat=lobby.players.indexOf(null);if(seat<0)return;
    lobby.players[seat]=ws;lobby.names[seat]=msg.name||'?';lobby.tokens[seat]=token;
    SESSIONS[token]={lobbyId:msg.lobbyId,seat};
    WS_MAP.set(ws,{lobbyId:msg.lobbyId,seat,token});
    cSend(ws,{type:'JOINED',seat,token,solo:lobby.solo});
    broadcastLobbies();
    if(lobby.solo){
      const players=[{name:lobby.names[0],isBot:false}];
      for(let i=0;i<(lobby.bots||1);i++)players.push({name:`IA Angel ${i+1}`,isBot:true});
      lobby.game=spNewGame(players);
      startRound(lobby.game);
      console.log('[SOLO] started, phase:',lobby.game.phase,'ceo:',lobby.game.currentCeo);
      cSend(ws,{type:'GAME_STATE',state:spView(lobby.game,seat)});
      scheduleBots(lobby);
    } else {
      cSend(ws,{type:'LOBBY_STATE',names:lobby.names,mySeat:seat});
    }
    return;
  }
  // Game actions
  const st=WS_MAP.get(ws);if(!st)return;
  const lobby=LOBBIES[st.lobbyId];if(!lobby?.game)return;
  const result=spHandle(lobby.game,st.seat,msg);
  if(result?.error){cSend(ws,{type:'ERROR',text:result.error});return;}
  broadcastGame(lobby);
  if(lobby.game.phase!=='GAME_OVER')scheduleBots(lobby);
}

server.listen(PORT,'0.0.0.0',()=>console.log(`[Startup Panic] http://0.0.0.0:${PORT}`));
