'use strict';
const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const PUB  = path.join(__dirname, 'public');
const MIME = {'.html':'text/html;charset=utf-8','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.mp3':'audio/mpeg'};

// ═══════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════
const SECTORS = ['ia','fintech','seguranca','biotech','energia'];
const SECTOR_NAME = {ia:'IA',fintech:'Fintech',seguranca:'Segurança',biotech:'Biotech',energia:'Energia'};

const STARTUPS = [
  {id:'deepanic',  name:'DeePanic',       sector:'ia',        price:3},
  {id:'halluci',   name:'HalluciNet',     sector:'ia',        price:2},
  {id:'cashburn',  name:'CashBurn',       sector:'fintech',   price:4},
  {id:'tokenstonk',name:'TokenStonks',    sector:'fintech',   price:3},
  {id:'hackshield',name:'HackShield',     sector:'seguranca', price:3},
  {id:'zerotrust', name:'ZeroTrustUs',    sector:'seguranca', price:2},
  {id:'crispash',  name:'CRISPRash',      sector:'biotech',   price:4},
  {id:'pharmarush',name:'PharmaRush',     sector:'biotech',   price:3},
  {id:'fusionfail',name:'FusionFail',     sector:'energia',   price:2},
  {id:'solarscam', name:'SolarScam',      sector:'energia',   price:3},
];

// 12 unique CEOs
const CEOS = [
  {id:'ev',  name:'Elon V.',      role:'Caótico Visionário', hasRoll:true,
   effect:(g,roll)=>{
     const mult=roll||1;
     adjSector(g,'ia',mult*2-3);adjSector(g,'energia',mult-3);
     if(roll>=5) randomImplode(g);
     return `Elon V.: IA ${fmtDelta(mult*2-3)}, Energia ${fmtDelta(mult-3)}${roll>=5?' 💥 Startup implodiu!':''}`;
   }},
  {id:'mz',  name:'Mark Z.',      role:'Metódico Controlador', hasRoll:false,
   effect:(g)=>{
     adjSector(g,'fintech',3);SECTORS.filter(s=>s!=='fintech').forEach(s=>adjSector(g,s,-1));
     return 'Mark Z.: Fintech +3M, resto -1M';
   }},
  {id:'sa',  name:'Sam A.',       role:'Hype Master', hasRoll:true,
   effect:(g,roll)=>{
     adjSector(g,'ia',roll*2);SECTORS.filter(s=>s!=='ia').forEach(s=>adjSectorPct(g,s,-10));
     return `Sam A.: IA +${roll*2}M, resto -10%`;
   }},
  {id:'jh',  name:'Jensen H.',    role:'Técnico Preciso', hasRoll:false,
   effect:(g)=>{
     adjSector(g,'ia',5);adjSector(g,'energia',-2);
     return 'Jensen H.: IA +5M, Energia -2M';
   }},
  {id:'rh',  name:'Reed H.',      role:'Pivot Constante', hasRoll:true,
   effect:(g,roll)=>{
     const s1=SECTORS[roll%5],s2=SECTORS[(roll+2)%5];
     adjSectorPct(g,s1,roll*10);adjSectorPct(g,s2,-50);
     return `Reed H.: ${SECTOR_NAME[s1]} ×dado, ${SECTOR_NAME[s2]} -50%`;
   }},
  {id:'tk',  name:'Travis K.',    role:'Disruptivo Destrutivo', hasRoll:true,
   effect:(g,roll)=>{
     adjSector(g,'fintech',-3);
     const fintechs=g.startups.filter(s=>s.sector==='fintech'&&!s.imploded);
     if(fintechs.length) fintechs[0].imploded=true;
     return `Travis K.: Fintech -3M, ${fintechs[0]?.name||'?'} implodiu`;
   }},
  {id:'eh',  name:'Elizabeth H.', role:'Fraude Elegante', hasRoll:false,
   effect:(g)=>{
     adjSector(g,'biotech',8);g.pendingPenalty={sector:'biotech',delta:-8,turns:1};
     return 'Elizabeth H.: Biotech +8M agora, -8M no próximo turno';
   }},
  {id:'bc',  name:'Brian C.',     role:'Partilha de Risco', hasRoll:false,
   effect:(g)=>{
     SECTORS.forEach(s=>adjSector(g,s,1));g.safeThisTurn=true;
     return 'Brian C.: todos +1M, nenhuma startup implode este turno';
   }},
  {id:'an',  name:'Adam N.',      role:'Wellness Caótico', hasRoll:true,
   effect:(g,roll)=>{
     adjSector(g,'biotech',roll*2-4);g.collaboratorSurcharge=1;
     return `Adam N.: Biotech ${fmtDelta(roll*2-4)}, colaboradores +1M este turno`;
   }},
  {id:'pc',  name:'Patrick C.',   role:'Crescimento Metódico', hasRoll:false,
   effect:(g)=>{
     adjSector(g,'fintech',4);adjSector(g,'seguranca',2);adjSector(g,'ia',-1);
     return 'Patrick C.: Fintech +4M, Segurança +2M, IA -1M';
   }},
  {id:'sb',  name:'Sam B.',       role:'Colapso Espectacular', hasRoll:true,
   effect:(g,roll)=>{
     if(roll>=4){randomImplode(g);return `Sam B.: dado ${roll} ≥ 4 — startup aleatória implodiu!`;}
     else{adjSectorPct(g,'fintech',200);return `Sam B.: dado ${roll} ≤ 3 — Fintech triplicou!`;}
   }},
  {id:'ww',  name:'Whitney W.',   role:'Exit Queen', hasRoll:false,
   effect:(g)=>{
     g.gateMultiplierBonus=(g.gateMultiplierBonus||0)+1;
     return 'Whitney W.: próximo Gate tem multiplicador +1 nível';
   }},
];

const COLLABORATORS = [
  {id:'engineer', name:'Engineer',  effect:'dividendos +2M/turno por startup', salary:1, free_effect:'dividendos +1M/turno'},
  {id:'lawyer',   name:'Lawyer',    effect:'bloqueia 1 efeito CEO por turno',   salary:2, free_effect:'bloqueia 50% chance'},
  {id:'pr',       name:'PR',        effect:'multiplicador de Gate +0.5x',        salary:1, free_effect:'multiplicador +0.2x'},
  {id:'cfo',      name:'CFO',       effect:'desconto 1M em compra de acções',   salary:1, free_effect:'desconto 0.5M'},
];

// Gate multipliers: [low,mid,high] — CEO at gate picks one based on their nature
const GATE_MULTS = [1,5,20];

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════
function adjSector(g,sector,delta){
  g.startups.forEach(s=>{if(s.sector===sector)s.price=Math.max(1,s.price+delta);});
}
function adjSectorPct(g,sector,pct){
  g.startups.forEach(s=>{if(s.sector===sector)s.price=Math.max(1,Math.round(s.price*(1+pct/100)));});
}
function randomImplode(g){
  if(g.safeThisTurn)return;
  const alive=g.startups.filter(s=>!s.imploded);
  if(alive.length) alive[Math.floor(Math.random()*alive.length)].imploded=true;
}
function fmtDelta(n){return (n>=0?'+':'')+n+'M';}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=0|Math.random()*(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}

// ═══════════════════════════════════════════════════════
// GAME LOGIC
// ═══════════════════════════════════════════════════════
function spNewGame(players){
  const startups=STARTUPS.map(s=>({...s,shares:{},workers:{},imploded:false}));
  // Each player starts with 10M
  const ps=players.map((lp,i)=>({
    name:lp.name,isBot:!!lp.isBot,colorIdx:i,
    cash:10,portfolio:{},collaborators:[],score:0,
  }));
  const ceoDeck=shuffle([...CEOS.map(c=>c.id)]);
  return {
    n:players.length,players:ps,startups,
    ceoDeck,ceoDiscard:[],currentCeo:null,currentRoll:null,ceoLog:'',
    turn:0,phase:'CEO',  // phases: CEO → MARKET → MAINTENANCE → next
    cur:0,round:1,block:1,gateOpen:false,gateMultiplierBonus:0,
    safeThisTurn:false,collaboratorSurcharge:0,pendingPenalty:null,
    log:[],
  };
}

function spCeoData(id){return CEOS.find(c=>c.id===id);}

function spLog(g,msg){g.log.unshift(msg);if(g.log.length>20)g.log.pop();}

function spView(g,seat){
  const me=g.players[seat];
  return {
    n:g.n,cur:g.cur,myIdx:seat,round:g.round,block:g.block,
    phase:g.phase,gateOpen:g.gateOpen,
    players:g.players.map((p,i)=>({
      name:p.name,isBot:p.isBot,colorIdx:p.colorIdx,
      cash:i===seat?p.cash:null,
      cashVisible:i!==seat?'?':null,
      portfolio:i===seat?p.portfolio:{},
      collaborators:i===seat?p.collaborators:[],
      score:p.score,
    })),
    startups:g.startups.map(s=>({
      ...s,
      myShares:(s.shares[seat]||0),
      myWorkers:(s.workers[seat]||0),
    })),
    currentCeo:g.currentCeo?spCeoData(g.currentCeo):null,
    currentRoll:g.currentRoll,
    ceoLog:g.ceoLog,
    gateMultiplierBonus:g.gateMultiplierBonus,
    collaboratorTypes:COLLABORATORS,
    log:g.log,
  };
}

function spHandle(g,seat,msg){
  const p=g.players[seat];

  // ── CEO phase ──────────────────────────────────────────
  if(msg.type==='SP_CEO_REVEAL'){
    if(g.phase!=='CEO'||g.cur!==seat)return{error:'Não é a tua fase'};
    if(g.currentCeo)return{error:'CEO já revelado'};
    const ceoId=g.ceoDeck.pop();
    g.currentCeo=ceoId;
    g.ceoDiscard.push(ceoId);
    const ceo=spCeoData(ceoId);
    spLog(g,`📋 CEO: ${ceo.name} — ${ceo.role}`);
    if(!ceo.hasRoll){
      // Apply immediately
      const log=ceo.effect(g,null);
      g.ceoLog=log;spLog(g,`🎭 ${log}`);
      g.phase='MARKET';
    } else {
      g.phase='ROLL';
    }
    return{ok:true};
  }

  if(msg.type==='SP_ROLL'){
    if(g.phase!=='ROLL'||g.cur!==seat)return{error:'Não é a fase de dado'};
    const roll=(msg.roll)||(Math.ceil(Math.random()*6));
    g.currentRoll=roll;
    const ceo=spCeoData(g.currentCeo);
    const log=ceo.effect(g,roll);
    g.ceoLog=log;spLog(g,`🎲 Dado: ${roll} — ${log}`);
    g.phase='MARKET';
    return{ok:true,roll};
  }

  // ── Market phase ───────────────────────────────────────
  if(msg.type==='SP_BUY'){
    if(g.phase!=='MARKET'||g.cur!==seat)return{error:'Não é o teu turno'};
    const su=g.startups.find(s=>s.id===msg.startupId);
    if(!su||su.imploded)return{error:'Startup inválida'};
    const qty=msg.qty||1;
    const cfo=p.collaborators.find(c=>c.id==='cfo');
    const discount=cfo?(cfo.paid?1:0.5):0;
    const cost=Math.max(0,su.price*qty-discount);
    if(p.cash<cost)return{error:`Precisas de ${cost}M (tens ${p.cash}M)`};
    p.cash-=cost;
    su.shares[seat]=(su.shares[seat]||0)+qty;
    p.portfolio[su.id]=(p.portfolio[su.id]||0)+qty;
    spLog(g,`💰 ${p.name} comprou ${qty}× ${su.name} por ${cost}M`);
    return{ok:true};
  }

  if(msg.type==='SP_SELL_STARTUP'){
    if(!g.gateOpen)return{error:'Gate de Venda não está aberto'};
    if(g.cur!==seat)return{error:'Não é o teu turno'};
    const su=g.startups.find(s=>s.id===msg.startupId);
    if(!su)return{error:'Startup inválida'};
    const shares=su.shares[seat]||0;
    if(!shares)return{error:'Não tens acções desta startup'};
    // Check majority
    const maxShares=Math.max(...Object.values(su.shares));
    if(shares<maxShares)return{error:'Precisas de maioria para vender'};
    // Determine multiplier from gateOpen data
    const mult=g.gateMultiplier+(g.gateMultiplierBonus||0);
    const pr=p.collaborators.find(c=>c.id==='pr');
    const prBonus=pr?(pr.paid?0.5:0.2):0;
    const finalMult=mult+prBonus;
    const proceeds=Math.round(su.price*shares*finalMult);
    p.cash+=proceeds;
    // Clear shares
    su.shares[seat]=0;p.portfolio[su.id]=0;
    spLog(g,`🏙 ${p.name} vendeu ${su.name} ×${finalMult} = ${proceeds}M!`);
    return{ok:true};
  }

  if(msg.type==='SP_COLLECT_DIVIDENDS'){
    if(g.phase!=='MARKET'||g.cur!==seat)return{error:'Não é o teu turno'};
    let total=0;
    g.startups.forEach(su=>{
      if(su.imploded)return;
      const workers=su.workers[seat]||0;
      if(!workers)return;
      const eng=p.collaborators.find(c=>c.id==='engineer');
      const bonus=eng?(eng.paid?2:1):0;
      const div=(workers+bonus);
      p.cash+=div;total+=div;
    });
    if(total>0) spLog(g,`💵 ${p.name} recebeu ${total}M em dividendos`);
    return{ok:true};
  }

  if(msg.type==='SP_END_MARKET'){
    if(g.phase!=='MARKET'||g.cur!==seat)return{error:'Não é o teu turno'};
    g.phase='MAINTENANCE';
    return{ok:true};
  }

  // ── Maintenance phase ──────────────────────────────────
  if(msg.type==='SP_HIRE'){
    if(g.phase!=='MAINTENANCE'||g.cur!==seat)return{error:'Não é a fase de manutenção'};
    const colType=COLLABORATORS.find(c=>c.id===msg.collabId);
    if(!colType)return{error:'Colaborador inválido'};
    const su=g.startups.find(s=>s.id===msg.startupId);
    if(!su||su.imploded)return{error:'Startup inválida'};
    const paid=!!msg.paid;
    if(paid&&p.cash<1)return{error:'Sem capital para pagar salário'};
    // Max 1 of each type per player
    if(p.collaborators.find(c=>c.id===msg.collabId))return{error:'Já tens este colaborador'};
    p.collaborators.push({id:msg.collabId,startupId:msg.startupId,paid});
    su.workers[seat]=(su.workers[seat]||0)+1;
    spLog(g,`👷 ${p.name} contratou ${colType.name}${paid?' (salário)':' (free)'} em ${su.name}`);
    return{ok:true};
  }

  if(msg.type==='SP_FIRE'){
    if(g.phase!=='MAINTENANCE'||g.cur!==seat)return{error:'Não é a fase de manutenção'};
    const idx=p.collaborators.findIndex(c=>c.id===msg.collabId);
    if(idx<0)return{error:'Colaborador não encontrado'};
    const col=p.collaborators.splice(idx,1)[0];
    const su=g.startups.find(s=>s.id===col.startupId);
    if(su&&su.workers[seat])su.workers[seat]=Math.max(0,su.workers[seat]-1);
    spLog(g,`❌ ${p.name} despediu colaborador`);
    return{ok:true};
  }

  if(msg.type==='SP_PAY_SALARIES'){
    if(g.phase!=='MAINTENANCE'||g.cur!==seat)return{error:'Não é a fase de manutenção'};
    let cost=0;
    const toFire=[];
    p.collaborators.forEach(col=>{
      if(!col.paid)return;
      const colType=COLLABORATORS.find(c=>c.id===col.id);
      const salary=(colType?.salary||1)+(g.collaboratorSurcharge||0);
      if(p.cash>=salary){p.cash-=salary;cost+=salary;}
      else{toFire.push(col.id);}
    });
    // Fire those that couldn't be paid
    toFire.forEach(id=>{
      const idx=p.collaborators.findIndex(c=>c.id===id);
      if(idx>=0){
        const col=p.collaborators.splice(idx,1)[0];
        const su=g.startups.find(s=>s.id===col.startupId);
        if(su&&su.workers[seat])su.workers[seat]=Math.max(0,su.workers[seat]-1);
        spLog(g,`💸 ${p.name}: colaborador abandonou (sem salário)`);
      }
    });
    if(cost>0) spLog(g,`💼 ${p.name} pagou ${cost}M em salários`);
    return{ok:true};
  }

  if(msg.type==='SP_END_TURN'){
    if(g.phase!=='MAINTENANCE'||g.cur!==seat)return{error:'Não é o teu turno'};
    spEndTurn(g);
    return{ok:true};
  }

  return{error:'Acção desconhecida'};
}

function spEndTurn(g){
  // Apply pending penalty from Elizabeth H.
  if(g.pendingPenalty){
    const pp=g.pendingPenalty;pp.turns--;
    if(pp.turns<=0){adjSector(g,pp.sector,pp.delta);g.pendingPenalty=null;}
  }
  g.safeThisTurn=false;g.collaboratorSurcharge=0;

  // Next player
  g.cur=(g.cur+1)%g.n;
  g.turn++;

  // Check gate (every 4th turn total = end of 4-turn block)
  if(g.turn>0&&g.turn%4===0){
    g.gateOpen=true;
    // CEO at this turn determines multiplier
    const ceo=spCeoData(g.currentCeo);
    // Assign multiplier based on CEO archetype (hype→high, cautious→low, random→roll)
    const highCeos=['sa','ev','ww'];const lowCeos=['mz','jh','pc','bc'];
    let mIdx=1;
    if(highCeos.includes(g.currentCeo)) mIdx=2;
    else if(lowCeos.includes(g.currentCeo)) mIdx=0;
    else mIdx=Math.floor(Math.random()*3);
    g.gateMultiplier=GATE_MULTS[Math.min(2,mIdx+(g.gateMultiplierBonus||0))];
    g.block++;
    spLog(g,`🔔 Gate ${g.block-1} aberto! Multiplicador: ×${g.gateMultiplier} (${ceo.name})`);
  }else{
    g.gateOpen=false;
  }

  // Check end of game (after 3 gates = turn 12)
  if(g.turn>=12){
    spEndGame(g);return;
  }

  // Reset for new player turn
  g.currentCeo=null;g.currentRoll=null;g.ceoLog='';
  g.phase='CEO';
  spLog(g,`→ Turno de ${g.players[g.cur].name}`);
}

function spEndGame(g){
  g.phase='GAME_OVER';
  // Final score: cash + value of remaining shares
  g.players.forEach((p,i)=>{
    let total=p.cash;
    g.startups.forEach(su=>{
      if(!su.imploded) total+=(su.shares[i]||0)*su.price;
    });
    p.score=total;
  });
  const winner=g.players.reduce((a,b)=>a.score>b.score?a:b);
  spLog(g,`🏆 Fim do jogo! ${winner.name} vence com ${winner.score}M!`);
}

// ═══════════════════════════════════════════════════════
// BOT AI
// ═══════════════════════════════════════════════════════
function spBot(g){
  if(g.phase==='GAME_OVER')return null;
  const p=g.players[g.cur];if(!p.isBot)return null;

  if(g.phase==='CEO') return{type:'SP_CEO_REVEAL'};
  if(g.phase==='ROLL') return{type:'SP_ROLL',roll:Math.ceil(Math.random()*6)};

  if(g.phase==='MARKET'){
    // Try to collect dividends first
    const hasDividends=g.startups.some(su=>!su.imploded&&(su.workers[g.cur]||0)>0);
    if(hasDividends) return{type:'SP_COLLECT_DIVIDENDS'};
    // Buy cheapest non-imploded startup in best sector
    const afford=g.startups.filter(su=>!su.imploded&&su.price<=p.cash);
    if(afford.length&&p.cash>3){
      afford.sort((a,b)=>a.price-b.price);
      return{type:'SP_BUY',startupId:afford[0].id,qty:1};
    }
    // Sell if gate is open and has majority
    if(g.gateOpen){
      for(const su of g.startups){
        const mine=su.shares[g.cur]||0;
        if(!mine)continue;
        const maxShares=Math.max(0,...Object.values(su.shares));
        if(mine>=maxShares) return{type:'SP_SELL_STARTUP',startupId:su.id};
      }
    }
    return{type:'SP_END_MARKET'};
  }

  if(g.phase==='MAINTENANCE'){
    // Pay salaries if can afford
    const needPay=p.collaborators.some(c=>c.paid);
    if(needPay) return{type:'SP_PAY_SALARIES'};
    // Hire engineer free if no collaborators and has shares
    if(!p.collaborators.length){
      const owned=g.startups.find(su=>!su.imploded&&(su.shares[g.cur]||0)>0);
      if(owned) return{type:'SP_HIRE',collabId:'engineer',startupId:owned.id,paid:false};
    }
    return{type:'SP_END_TURN'};
  }
  return null;
}

// ═══════════════════════════════════════════════════════
// LOBBY + WS INFRASTRUCTURE
// ═══════════════════════════════════════════════════════
const LOBBY_DEFS = [
  {id:'sp-2p-1',name:'Mesa 2J — 1',maxP:2,solo:false},
  {id:'sp-2p-2',name:'Mesa 2J — 2',maxP:2,solo:false},
  {id:'sp-3p-1',name:'Mesa 3J — 1',maxP:3,solo:false},
  {id:'sp-4p-1',name:'Mesa 4J — 1',maxP:4,solo:false},
  {id:'sp-solo', name:'Solo vs 1 IA', maxP:1,solo:true,bots:1},
];

const LOBBIES={},SESSIONS={},WS_MAP=new WeakMap();
LOBBY_DEFS.forEach(d=>{
  LOBBIES[d.id]={...d,players:Array(d.maxP).fill(null),names:Array(d.maxP).fill(''),
    tokens:Array(d.maxP).fill(null),game:null,graceTimers:Array(d.maxP).fill(null),
    botTimer:null,_abandonedAt:null};
});

function cSend(ws,obj){if(ws?.readyState===1)ws.send(JSON.stringify(obj));}
function lobbyInfo(l){return{id:l.id,name:l.name,solo:l.solo,maxP:l.maxP,
  seated:l.players.filter(Boolean).length,playing:!!l.game};}
function broadcastLobbies(){
  const ls=Object.values(LOBBIES).map(lobbyInfo);
  WS_MAP.forEach((_,ws)=>{cSend(ws,{type:'LOBBIES',lobbies:ls});});
}
function broadcastGame(lobby){
  const g=lobby.game;if(!g)return;
  lobby.players.forEach((ws,i)=>{if(ws)cSend(ws,{type:'GAME_STATE',state:spView(g,i)});});
}
function sendLobbyState(lobby,ws,seat){
  cSend(ws,{type:'LOBBY_STATE',lobby:lobbyInfo(lobby),names:lobby.names,mySeat:seat});
}
function scheduleBots(lobby){
  if(lobby.botTimer)return;
  lobby.botTimer=setTimeout(()=>{
    lobby.botTimer=null;
    const g=lobby.game;if(!g||g.phase==='GAME_OVER')return;
    const p=g.players[g.cur];if(!p?.isBot)return;
    const action=spBot(g);
    if(action){const res=spHandle(g,g.cur,action);broadcastGame(lobby);}
    if(g.phase!=='GAME_OVER') scheduleBots(lobby);
  },1000);
}

const server=http.createServer((req,res)=>{
  const url=req.url.split('?')[0];
  res.setHeader('Access-Control-Allow-Origin','*');
  let fp=url==='/'?path.join(PUB,'index.html'):path.join(PUB,url);
  fs.readFile(fp,(err,data)=>{
    if(err){res.writeHead(404);res.end('Not found');return;}
    const ext=path.extname(fp);
    res.writeHead(200,{'Content-Type':MIME[ext]||'application/octet-stream'});
    res.end(data);
  });
});
const wss=new WebSocketServer({server});

wss.on('connection',ws=>{
  cSend(ws,{type:'LOBBIES',lobbies:Object.values(LOBBIES).map(lobbyInfo)});
  ws.on('message',raw=>{try{dispatch(ws,JSON.parse(raw));}catch(e){console.error(e);}});
  ws.on('close',()=>{
    const st=WS_MAP.get(ws);if(!st?.lobbyId)return;
    const lobby=LOBBIES[st.lobbyId];if(!lobby)return;
    const{seat,token}=st;
    lobby.players[seat]=null;
    if(lobby.solo){
      lobby.graceTimers[seat]=setTimeout(()=>{
        lobby.names[seat]='';lobby.tokens[seat]=null;
        if(SESSIONS[token])delete SESSIONS[token];
        if(lobby.game){lobby.game=null;if(lobby.botTimer){clearTimeout(lobby.botTimer);lobby.botTimer=null;}}
        lobby._abandonedAt=null;broadcastLobbies();
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
  if(msg.type==='SET_NAME'){
    const name=(msg.name||'').trim().slice(0,20);
    if(!name)return;
    cSend(ws,{type:'NAME_OK',name});
    cSend(ws,{type:'LOBBIES',lobbies:Object.values(LOBBIES).map(lobbyInfo)});
    return;
  }
  if(msg.type==='JOIN'){
    const lobby=LOBBIES[msg.lobbyId];if(!lobby)return;
    const token=msg.token||Math.random().toString(36).slice(2);
    // Reconnect?
    if(SESSIONS[token]){
      const{lobbyId,seat}=SESSIONS[token];
      const lb=LOBBIES[lobbyId];
      if(lb&&lb.tokens[seat]===token){
        clearTimeout(lb.graceTimers[seat]);lb.graceTimers[seat]=null;
        lb.players[seat]=ws;WS_MAP.set(ws,{lobbyId,seat,token});
        cSend(ws,{type:'RECONNECTED',seat,solo:lb.solo});
        if(lb.game){cSend(ws,{type:'GAME_STATE',state:spView(lb.game,seat)});
          if(lb.solo&&lb.game.phase!=='GAME_OVER')scheduleBots(lb);}
        else sendLobbyState(lb,ws,seat);
        broadcastLobbies();return;
      }
    }
    // Find empty seat
    let seat=lobby.players.indexOf(null);
    if(seat<0)return;
    lobby.players[seat]=ws;lobby.names[seat]=msg.name||'?';lobby.tokens[seat]=token;
    SESSIONS[token]={lobbyId:msg.lobbyId,seat};
    WS_MAP.set(ws,{lobbyId:msg.lobbyId,seat,token});
    sessionStorage_compat: cSend(ws,{type:'JOINED',seat,token,solo:lobby.solo});
    sendLobbyState(lobby,ws,seat);broadcastLobbies();
    // Start solo immediately
    if(lobby.solo){
      const bots=lobby.bots||1;
      const players=[{name:lobby.names[0],isBot:false}];
      for(let i=0;i<bots;i++)players.push({name:`IA Angel ${i+1}`,isBot:true});
      lobby.game=spNewGame(players);
      spLog(lobby.game,`🚀 Startup Panic começou!`);
      broadcastGame(lobby);scheduleBots(lobby);
    }
    return;
  }
  if(msg.type==='START'){
    const st=WS_MAP.get(ws);if(!st)return;
    const lobby=LOBBIES[st.lobbyId];if(!lobby||lobby.game)return;
    const seated=lobby.players.filter(Boolean);
    if(seated.length<2)return;
    const players=lobby.names.map((n,i)=>({name:n||`P${i+1}`,isBot:false}));
    lobby.game=spNewGame(players);
    spLog(lobby.game,'🚀 Startup Panic começou!');
    broadcastGame(lobby);return;
  }
  if(msg.type==='LEAVE_LOBBY'){
    const st=WS_MAP.get(ws);if(!st)return;
    const lobby=LOBBIES[st.lobbyId];if(!lobby)return;
    const{seat,token}=st;
    clearTimeout(lobby.graceTimers[seat]);
    if(SESSIONS[token])delete SESSIONS[token];
    lobby.players[seat]=null;lobby.names[seat]='';lobby.tokens[seat]=null;
    WS_MAP.delete(ws);
    if(lobby.game&&lobby.solo){lobby.game=null;if(lobby.botTimer){clearTimeout(lobby.botTimer);lobby.botTimer=null;}}
    if(lobby.game&&!lobby.solo){lobby.game=null;lobby.players.forEach(p=>{if(p)cSend(p,{type:'GAME_ABORTED',reason:`${lobby.names[seat]} saiu.`});});}
    lobby._abandonedAt=null;broadcastLobbies();return;
  }
  // Game actions
  const st=WS_MAP.get(ws);if(!st)return;
  const lobby=LOBBIES[st.lobbyId];if(!lobby?.game)return;
  const result=spHandle(lobby.game,st.seat,msg);
  if(result?.error){cSend(ws,{type:'ERROR',text:result.error});return;}
  broadcastGame(lobby);
  if(lobby.game.phase!=='GAME_OVER') scheduleBots(lobby);
}

server.listen(PORT,'0.0.0.0',()=>console.log(`[Startup Panic] http://0.0.0.0:${PORT}`));
