/* ================= КЛИЕНТ ================= */
const $ = s => document.querySelector(s);
const cv = $('#cv'), ctx = cv.getContext('2d');
const mini = $('#mini'), mctx = mini.getContext('2d');
let dpr = 1, cw = 0, ch = 0;
function resize(){
  dpr = window.devicePixelRatio || 1; cw = innerWidth; ch = innerHeight; cv.width = cw*dpr; cv.height = ch*dpr;
  mini.width = mini.clientWidth*dpr || 264; mini.height = mini.clientHeight*dpr || 176;
}
addEventListener('resize', resize); resize();

const APP = { mode:null, side:null, g:null, sc:null, map:null, mapCv:null, view:null, byId:new Map(), prev:new Map(), viewT:0,
  sel:new Set(), placing:null, targeting:false, fastNext:false, cam:{ x:1200, y:800, z:.55 }, fx:[], wrecks:[], ghosts:new Map(),
  keys:{}, ai:{}, lobby:{ scn:'ny95', hostSide:'chr', mode:'1v1', players:[] }, loop:null, netEv:[], lastSnap:0, drag:null, pan:null,
  pings:[], newUnits:new Map(), burning:[], viewMode:'auto', shake:0, log:[], logFilter:'all', lastArtyLog:0, bldAgg:null,
  miniBase:null, miniDirty:true, miniT:0, miniDrag:false, bodies:[], side0:null, trk:new Map(), snow:[], lastPhase:null, opts:{}, roundShown:false };
APP.lobby.rounds = 2; APP.lobby.tod = 'day';
const pseudoG = () => ({ sc:APP.sc, map:APP.map, phase:APP.view.phase, traps:(APP.view.traps || []).map(t => ({ i:cellIdx(APP.map, t[1], t[2]) })), units:APP.view.units.filter(u => u.side === APP.side || u.vis[APP.side]) });
const infilOkC = (type, x, y) => APP.sc && APP.view && infilOk(pseudoG(), APP.side, type, x, y);
const engOkC = (x, y, k) => APP.sc && engOk(pseudoG(), APP.side, x, y, k);
const isMine = u => u && u.side === APP.side && (!u.owner || u.owner === APP.pid);
const roleOf = s => APP.sc && s === APP.sc.defender ? 'защита' : 'атака';

/* ---------- Сеть: хост и до трёх гостей ---------- */
const PEER_PREFIX = 'grz9496-';
const PEER_OPTS = { config:{ iceServers:[ { urls:'stun:stun.l.google.com:19302' }, { urls:'stun:stun1.l.google.com:19302' }, { urls:'stun:global.stun.twilio.com:3478' } ] } };
const NET = { peer:null, conn:null, conns:new Map() };
function genCode(){ const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 5; i++) s += a[Math.floor(Math.random()*a.length)]; return s; }
function netClose(){
  try { NET.conn && NET.conn.close(); } catch(e){}
  for (const c of NET.conns.values()) try { c.close(); } catch(e){}
  NET.conns.clear(); try { NET.peer && NET.peer.destroy(); } catch(e){} NET.conn = null; NET.peer = null;
}
function hasPeer(){ return typeof Peer !== 'undefined'; }
const netOpen = () => APP.mode === 'host' ? [...NET.conns.values()].some(c => c.open) : !!(NET.conn && NET.conn.open);
function netSend(m, exceptPid){
  if (APP.mode === 'host'){ for (const [pid, c] of NET.conns) if (pid !== exceptPid && c.open) c.send(m); }
  else if (NET.conn && NET.conn.open) NET.conn.send(m);
}
try { APP.name = localStorage.getItem('grz-name') || ''; } catch(e){ APP.name = ''; }
const myName = () => (APP.name || '').trim().slice(0, 24) || (APP.mode === 'host' ? 'Создатель' : 'Игрок');
const perSide = () => APP.lobby.mode === '2v2' ? 2 : 1;
const sideCount = sd => APP.lobby.players.filter(p => p.side === sd).length;

function hostLobby(){
  if (!hasPeer()){ showScreen('main'); toast('Не загрузилась библиотека PeerJS. Проверьте интернет и откройте страницу с сервера, а не как файл.'); return; }
  netClose(); APP.mode = 'host'; APP.pid = 1; APP.nextPid = 1;
  APP.lobby = { scn:APP.lobby.scn, rounds:APP.lobby.rounds, tod:APP.lobby.tod, mode:APP.lobby.mode || '1v1', code:genCode(),
    players:[{ pid:1, name:myName(), side:APP.lobby.hostSide || 'chr' }] };
  showScreen('lobby'); renderLobby(); setLobbyStatus('Создаём комнату…');
  const p = new Peer(PEER_PREFIX + APP.lobby.code, PEER_OPTS); NET.peer = p;
  p.on('open', () => { setLobbyStatus('Ждём игроков. Отправьте код друзьям.'); renderLobby(); });
  p.on('connection', c => {
    c.on('open', () => {
      const L = APP.lobby, max = L.mode === '2v2' ? 3 : 1;
      if (APP.g || L.players.length - 1 >= max){ c.send({ t:'full', started:!!APP.g }); setTimeout(() => c.close(), 300); return; }
      const pid = ++APP.nextPid; c.pid = pid; NET.conns.set(pid, c);
      const host = L.players[0], side = L.mode === '1v1' ? other(host.side) : (sideCount('fed') <= sideCount('chr') ? 'fed' : 'chr');
      L.players.push({ pid, name:'Игрок ' + pid, side });
      c.send({ t:'welcome', pid }); sendLobby(); renderLobby(); setLobbyStatus('Подключился игрок. В лобби: ' + L.players.length + '.');
    });
    c.on('data', m => onHostData(m, c.pid));
    c.on('close', () => onHostDrop(c.pid));
  });
  p.on('error', e => {
    if (e.type === 'unavailable-id'){ APP.lobby.code = genCode(); hostLobby(); return; }
    setLobbyStatus('Ошибка сети: ' + (e.type || e.message) + '. Попробуйте создать лобби ещё раз.');
  });
  p.on('disconnected', () => { try { p.reconnect(); } catch(e){} });
}
function joinLobby(code){
  if (!hasPeer()){ toast('Не загрузилась библиотека PeerJS. Проверьте интернет.'); return; }
  code = (code || '').trim().toUpperCase(); if (code.length !== 5){ setJoinStatus('Код состоит из 5 символов.'); return; }
  netClose(); APP.mode = 'guest'; APP.pid = 0; setJoinStatus('Подключаемся…');
  const p = new Peer(PEER_OPTS); NET.peer = p;
  p.on('open', () => {
    const c = p.connect(PEER_PREFIX + code, { reliable:true }); NET.conn = c;
    c.on('open', () => { c.send({ t:'hello', name:myName() }); });
    c.on('data', onGuestData);
    c.on('close', () => onDisconnect());
  });
  p.on('error', e => {
    if (e.type === 'peer-unavailable') setJoinStatus('Лобби с кодом ' + code + ' не найдено. Проверьте код или попросите друга создать лобби заново.');
    else setJoinStatus('Ошибка сети: ' + (e.type || e.message));
  });
}
function sendLobby(){ const L = APP.lobby; netSend({ t:'lobby', scn:L.scn, rounds:L.rounds, tod:L.tod, mode:L.mode, players:L.players }); }
function setPlayerSide(pid, sd){
  const L = APP.lobby, pl = L.players.find(p => p.pid === pid); if (!pl || APP.g) return;
  if (L.mode === '1v1'){ pl.side = sd; for (const q of L.players) if (q !== pl) q.side = other(sd); }
  else if (pl.side !== sd && sideCount(sd) >= 2){ if (pid === APP.pid) toast('На этой стороне уже два игрока'); return; }
  else pl.side = sd;
  sendLobby(); renderLobby();
}
function onChat(m){
  if (typeof m.m !== 'string') return;
  const who = (m.name ? String(m.name).slice(0, 24) : SIDE_NAME[m.side] || 'Игрок') + (m.side ? (m.side === APP.side ? ' (союзник)' : ' (противник)') : '');
  addLog(who + ': ' + m.m.slice(0, 200), 'chat ' + (m.side || ''), null, 'chat'); sound('hit', .2);
}
function onHostData(m, pid){
  if (!m || !m.t) return;
  const L = APP.lobby, pl = L.players.find(p => p.pid === pid);
  if (m.t === 'hello' || m.t === 'name'){ if (pl && typeof m.name === 'string' && m.name.trim()) pl.name = m.name.trim().slice(0, 24); if (!APP.g){ sendLobby(); renderLobby(); } }
  else if (m.t === 'side') setPlayerSide(pid, m.side);
  else if (m.t === 'cmd' && APP.g){ const sd = pidSide(APP.g, pid); if (sd) applyCommand(APP.g, sd, { ...m.c, _pid:pid }); }
  else if (m.t === 'chat'){ const msg = { ...m, name:pl ? pl.name : m.name }; onChat(msg); netSend(msg, pid); }
}
function onHostDrop(pid){
  NET.conns.delete(pid);
  const L = APP.lobby, pl = L.players.find(p => p.pid === pid);
  if (!APP.g){ L.players = L.players.filter(p => p.pid !== pid); sendLobby(); renderLobby(); setLobbyStatus((pl ? pl.name : 'Игрок') + ' отключился.'); return; }
  orphanPlayer(APP.g, pid);
  if (!netOpen() && !(APP.view && APP.view.phase === 'end')) toast('Все игроки отключились.', 6000, 'bad');
}
function onGuestData(m){
  if (!m || !m.t) return;
  if (m.t === 'welcome'){ APP.pid = m.pid; return; }
  if (m.t === 'full'){ setJoinStatus(m.started ? 'Бой в этом лобби уже идёт.' : 'В этом лобби нет свободных мест.'); return; }
  if (m.t === 'lobby'){
    Object.assign(APP.lobby, { scn:m.scn, rounds:m.rounds || 1, tod:m.tod || 'day', mode:m.mode || '1v1', players:m.players || [] });
    if (APP.sc){ stopGame(); }
    showScreen('lobby'); renderLobby(); setLobbyStatus('Вы в лобби. Сценарий и режим выбирает создатель, сторону можно сменить.');
  } else if (m.t === 'start'){ startGame('guest', m.scn, m.seed, m.side, m.opts, m.pid, m.players); }
  else if (m.t === 'snap' && APP.sc){ onSnap(m.s); }
  else if (m.t === 'chat') onChat(m);
}
function onDisconnect(){
  if (APP.sc && !(APP.view && APP.view.phase === 'end')){ addLog('Соединение с создателем лобби потеряно.', 'bad'); toast('Соединение потеряно.', 6000, 'bad'); }
  if (APP.mode === 'guest' && !APP.sc) setLobbyStatus('Соединение с создателем лобби потеряно.');
}
function sendCmd(c){
  if (APP.mode === 'guest'){ if (netOpen()) NET.conn.send({ t:'cmd', c }); }
  else if (APP.g) applyCommand(APP.g, APP.side, { ...c, _pid:APP.pid || 1 });
}
function sendChat(text){
  text = text.trim().slice(0, 200); if (!text) return;
  addLog('Вы: ' + text, 'chat ' + APP.side, null, 'chat');
  if (APP.mode === 'solo') { addLog('Бот не читает чат.', 'sys', null, 'chat'); return; }
  netSend({ t:'chat', m:text, side:APP.side, name:myName(), pid:APP.pid });
}

/* ---------- Запуск партии ---------- */
function setView(v){
  APP.view = v; APP.byId = new Map(v.units.map(u => [u.id, u]));
  if (APP.side0){ const want = v.round === 2 ? other(APP.side0) : APP.side0; if (APP.side !== want){ APP.side = want; onRoundSwap(); } }
}
function onRoundSwap(){
  musSetSide(APP.side);
  APP.sel.clear(); APP.placing = null; APP.targeting = false; APP.ghosts.clear(); APP.newUnits.clear(); APP.pings = []; APP.ai = {}; APP.trk.clear();
  const z = APP.sc.deploy[APP.side][0]; APP.cam.x = z.x + z.w/2; APP.cam.y = z.y + z.h/2; clampCam();
  $('#round').hidden = true; APP.roundShown = false; buildDeck();
  addLog('Этап 2. Стороны поменялись: теперь вы — ' + SIDE_NAME[APP.side] + ', ' + roleOf(APP.side) + '.' + (APP.view.night ? ' Наступила ночь.' : ''), 'sys');
  addLog('Задача: ' + APP.sc.goals[APP.side], 'sys');
  toast('Этап 2: вы — ' + SIDE_NAME[APP.side] + ', ' + roleOf(APP.side), 4000);
}
function startGame(mode, scn, seed, side, opts, pid, players){
  opts = opts || {};
  APP.pid = pid || 1; APP.players = players && players.length ? players : [{ pid:APP.pid, name:myName(), side }];
  APP.mode = mode; APP.side = side; APP.side0 = side; APP.opts = opts; APP.sc = SCEN[scn]; APP.bodies = []; APP.trk.clear(); APP.lastPhase = null; APP.roundShown = false; $('#round').hidden = true; APP.sel.clear(); APP.placing = null; APP.targeting = false; APP.fastNext = false;
  APP.fx = []; APP.wrecks = []; APP.ghosts.clear(); APP.prev = new Map(); APP.ai = {}; APP.pings = []; APP.newUnits.clear(); APP.burning = [];
  PART.length = 0; APP.log = []; $('#log-list').innerHTML = ''; APP.bldAgg = null;
  const g = makeGame(scn, seed, opts); APP.map = g.map;
  g.players = APP.players.map(p => ({ pid:p.pid, side0:p.side, name:p.name }));
  APP.rec = { base:{ t:g.map.t.slice(), bst:g.map.bst.slice(), obst:g.map.obst.slice(), props:(g.map.props || []).map(p => p.st) }, frames:[], events:[], lastF:0, ended:false }; APP.replay = null; APP.mapCv = renderMapCanvas(g.map); APP.miniDirty = true;
  APP.g = mode === 'guest' ? null : g;
  setView(decodeSnap(encodeSnap(g, []))); APP.viewT = performance.now();
  const z = APP.sc.deploy[side][0]; APP.cam.x = z.x + z.w/2; APP.cam.y = z.y + z.h/2; APP.cam.z = .8; clampCam();
  hideMenu(); $('#hud').hidden = false; $('#end').hidden = true; buildDeck(); updateHud(); resize();
  addLog(APP.sc.title + ', ' + APP.sc.date + '. Вы: ' + SIDE_NAME[side] + '.', 'sys');
  musSetSide(side);
  addLog('Задача: ' + APP.sc.goals[side], 'sys');
  if (g.rounds === 2) addLog('Бой из двух этапов. Сейчас у вас ' + roleOf(side) + ', во втором этапе стороны поменяются, а город останется таким, каким вы его оставите.', 'sys');
  if (g.night) addLog('Ночь: видимость вдвое меньше, выстрелы выдают стрелка. Осветительная ракета — клавиша E.', 'sys');
  if (g.winter) addLog('Зима: снег замедляет колёсную технику вне дорог.', 'sys');
  addLog('Идёт расстановка. Выберите отряды и инженерные средства в колоде и поставьте их в своей зоне.', 'sys');
  if (mode !== 'guest'){
    let last = performance.now(), acc = 0;
    clearInterval(APP.loop);
    APP.loop = setInterval(() => {
      const now = performance.now(); acc += Math.min(1, (now - last)/1000); last = now;
      while (acc >= .05){
        acc -= .05;
        if (mode === 'solo') aiStep(APP.g, other(APP.side), .05, APP.ai);
        step(APP.g, .05);
        if (APP.g.ev.length){ const evs = APP.g.ev.slice(); APP.g.ev.length = 0; if (mode === 'host') APP.netEv.push(...evs); addFx(evs, null, APP.g.t); }
      }
      const s = encodeSnap(APP.g, []); recFrame(s, now);
      setView(decodeSnap(s)); APP.viewT = now;
      if (mode === 'host' && netOpen() && now - APP.lastSnap > 95){
        APP.lastSnap = now; s.ev = APP.netEv; APP.netEv = []; netSend({ t:'snap', s });
      }
      if (APP.view.phase === 'end') showEnd(); else if (APP.view.phase === 'inter') showRound();
    }, 50);
  }
}
function onSnap(s){
  if (APP.replay) return;
  recFrame(s, performance.now());
  const now = performance.now();
  APP.prev = new Map(APP.view ? APP.view.units.map(u => [u.id, u]) : []);
  const old = APP.byId;
  setView(decodeSnap(s)); APP.viewT = now;
  if (s.ev && s.ev.length) addFx(s.ev, old, s.t);
  if (APP.view.phase === 'end') showEnd(); else if (APP.view.phase === 'inter') showRound();
}
function stopGame(){ try { updateEngines([]); } catch(e){} APP.replay = null; document.body.classList.remove('replay'); $('#replay').hidden = true; clearInterval(APP.loop); APP.loop = null; APP.g = null; APP.sc = null; APP.view = null; $('#hud').hidden = true; $('#end').hidden = true; PART.length = 0; }

/* ---------- Журнал ---------- */
function gridRef(x, y){ const p = v => String(Math.floor(v/500)*5).padStart(2, '0'); return 'кв. ' + p(x) + '-' + p(y); }
function logTime(){
  const v = APP.view; if (!v || !APP.sc) return '';
  if (v.phase === 'deploy') return 'расст.';
  return fmtT(APP.sc.duration - v.phaseT);
}
function addLog(text, cls = '', pos = null, cat = 'battle'){
  if (APP.replay) return;
  const box = $('#log-list'); if (!box) return;
  const near = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
  const d = document.createElement('div'); d.className = 'le ' + cls; d.dataset.cat = cat;
  const t = document.createElement('time'); t.textContent = logTime(); d.appendChild(t);
  const sp = document.createElement('span'); sp.textContent = text; d.appendChild(sp);
  if (pos){ d.classList.add('go'); d.title = 'Показать на карте'; d.onclick = () => { APP.cam.x = pos.x; APP.cam.y = pos.y; clampCam(); addPing(pos.x, pos.y, '#f2d36b', 2500); }; }
  box.appendChild(d);
  while (box.children.length > 250) box.firstChild.remove();
  if (near) box.scrollTop = box.scrollHeight;
  if (cat === 'chat' && APP.logFilter === 'battle'){ $('#log-tab-chat').classList.add('unread'); }
  if (cat === 'chat' && document.body.classList.contains('logmin')) $('#log-min').classList.add('unread');
}
function setLogFilter(f){
  APP.logFilter = f; $('#log').dataset.filter = f;
  document.querySelectorAll('#log .tabs button').forEach(b => b.classList.toggle('on', b.dataset.f === f));
  if (f !== 'battle') $('#log-tab-chat').classList.remove('unread');
  const box = $('#log-list'); box.scrollTop = box.scrollHeight;
}
document.querySelectorAll('#log .tabs button').forEach(b => b.onclick = () => setLogFilter(b.dataset.f));
const chatIn = $('#chat-in');
chatIn.addEventListener('keydown', e => {
  e.stopPropagation();
  if (e.key === 'Enter'){ sendChat(chatIn.value); chatIn.value = ''; chatIn.blur(); }
  else if (e.key === 'Escape'){ chatIn.blur(); }
});
function addPing(x, y, col, ms = 8000, label = ''){ APP.pings.push({ x, y, col, t0:performance.now(), ms, label }); if (APP.pings.length > 30) APP.pings.shift(); }

/* ---------- События и эффекты ---------- */
function camVol(x, y){ const d = Math.hypot(x - APP.cam.x, y - APP.cam.y); return Math.pow(clamp(1 - d/1600, 0, 1), 1.6)*(.55 + .45*clamp(APP.cam.z, 0, 1)); }
function onScreen(x, y, pad = 60){ const p = toScreen(x, y); return p.x > -pad && p.y > -pad && p.x < cw + pad && p.y < ch + pad; }
function voxW(){ return clamp(1.5 + APP.cam.z*.45, 2.1, 3.3)/APP.cam.z; }
function recFrame(s, now){
  const R = APP.rec; if (!R || APP.replay) return;
  if ((s.ph === 'battle' && now - R.lastF >= 400) || (s.ph === 'end' && !R.ended)){
    R.lastF = now; if (s.ph === 'end') R.ended = true;
    R.frames.push({ t:s.t, s:{ ...s, ev:null } });
  }
}
function addFx(evs, oldById, t){
  if (APP.rec && !APP.replay && t !== undefined) for (const e of evs) if (e.e !== 'delay' && e.e !== 'buyfail') APP.rec.events.push({ t, e });
  const now = performance.now(), me = APP.side, map = APP.map;
  const unitOf = id => APP.byId.get(id) || (oldById && oldById.get(id));
  for (const e of evs){
    switch (e.e){
      case 's': {
        const su = unitOf(e.sid), tu = unitOf(e.tid);
        const seen = (su && (su.side === me || su.vis[me])) || (tu && tu.side === me);
        const [x1, y1, x2, y2] = e.a;
        if (!seen){ if (e.k === 'cannon' || e.k === 'at') sound(e.k === 'at' ? 'rocket' : 'cannon', camVol(x1, y1)*.5); break; }
        if (su && su.side !== me && !su.vis[me]){
          // стрелка не видно, но видна вспышка и трасса
          APP.fx.push({ k:'flashmark', x:x1, y:y1, t0:now, d:2500 });
          if (now - (APP.lastHidden || 0) > 7000 && tu && tu.side === me){ APP.lastHidden = now; addLog('По нам бьют из невидимой точки' + (terrAt(map, x1, y1) === T.BLD ? ' в здании' : '') + ', ' + gridRef(x1, y1) + '. Можно обстрелять её: T.', 'bad', { x:x1, y:y1 }); }
        }
        let sx = x1, sy = y1; const ang = Math.atan2(y2 - y1, x2 - x1);
        if (su && UT[su.type].cls === 'veh' && MODEL_OF[su.type]){ const tip = barrelTip(MODEL_OF[su.type], su.x, su.y, su.h, su.ta, voxW()); sx = tip.x; sy = tip.y; }
        if (e.gr || e.gl){
          APP.fx.push({ k:'arc', a:[x1, y1, x2, y2], t0:now, d:e.gr ? 650 : 900 });
          setTimeout(() => { if (!APP.map) return; spawnExplosion(APP.map, x2, y2, e.gr ? .35 : .3); sound('gren', camVol(x2, y2)); }, e.gr ? 620 : 860);
          if (e.gl) sound('small', camVol(x1, y1)*.6);
          break;
        }
        const kind = e.k === 'at' ? 'rocket' : e.k === 'cannon' ? 'shell' : 'tracer';
        APP.fx.push({ k:kind, a:[sx, sy, x2, y2], t0:now, d:kind === 'rocket' ? 420 : kind === 'shell' ? 180 : 110 });
        spawnMuzzle(sx, sy, ang, e.k === 'cannon' || e.k === 'at');
        if (e.k === 'at'){ for (let i = 0; i < 3; i++) part({ k:'smoke', x:x1 - Math.cos(ang)*6, y:y1 - Math.sin(ang)*6, z:2, vx:-Math.cos(ang)*14 + gauss()*4, vy:-Math.sin(ang)*14 + gauss()*4, vz:3, r:4, dr:7, life:2, max:2, c:185, tan:1 }); }
        const vol = camVol(x1, y1);
        sound(e.k === 'small' ? 'small' : e.k === 'mg' ? 'mg' : e.k === 'at' ? 'rocket' : 'cannon', vol);
        const delay = kind === 'rocket' ? 380 : kind === 'shell' ? 150 : 90;
        setTimeout(() => {
          if (!APP.map) return;
          if (e.k === 'cannon'){ spawnExplosion(APP.map, x2, y2, .6); sound('boom', camVol(x2, y2)*.6); }
          else if (e.k === 'at'){ spawnExplosion(APP.map, x2, y2, .45); sound('boom', camVol(x2, y2)*.45); }
          else if (Math.random() < .35) spawnDust(x2, y2, 1, false);
        }, delay);
        break;
      }
      case 'inc':
        APP.fx.push({ k:'fall', x:e.x, y:e.y, t0:now, d:900, big:e.big });
        sound('whistle', camVol(e.x, e.y)); break;
      case 'boom': {
        spawnExplosion(map, e.x, e.y, e.big ? 1.6 : 1);
        addDecal(APP.mapCv, { k:'crater', x:e.x, y:e.y, r:e.big ? 8 : 5.5 }); APP.miniDirty = true;
        const vol = camVol(e.x, e.y); sound(e.big ? 'bigboom' : 'boom', vol);
        if (onScreen(e.x, e.y, 200)) APP.shake = Math.min(14, APP.shake + (e.big ? 7 : 4)*clamp(APP.cam.z, .4, 1.5));
        if (e.side && e.side !== me && now - APP.lastArtyLog > 8000 && APP.view.units.some(u => u.side === me && Math.hypot(u.x - e.x, u.y - e.y) < 350)){
          APP.lastArtyLog = now; addLog('Противник обстреливает наши позиции, ' + gridRef(e.x, e.y) + '.', 'bad', { x:e.x, y:e.y }); addPing(e.x, e.y, '#ff8a3a', 6000);
        }
        break;
      }
      case 'pen':
        part({ k:'flash', x:e.x, y:e.y, z:4, r:9, life:.18, max:.18 });
        for (let i = 0; i < 8; i++){ const a = Math.random()*7, v = 30 + Math.random()*40; part({ k:'debris', x:e.x, y:e.y, z:4, vx:Math.cos(a)*v, vy:Math.sin(a)*v, vz:20 + Math.random()*30, s:1.2, c:Math.random() < .5 ? '#ffcf66' : '#3a3f36', life:2, max:2 }); }
        sound('hit', camVol(e.x, e.y)); break;
      case 'ric':
        part({ k:'flash', x:e.x, y:e.y, z:3, r:3, life:.08, max:.08 });
        for (let i = 0; i < 3; i++){ const a = Math.random()*7; part({ k:'debris', x:e.x, y:e.y, z:3, vx:Math.cos(a)*50, vy:Math.sin(a)*50, vz:15, s:1, c:'#fff3c4', life:1, max:1 }); }
        sound('hit', camVol(e.x, e.y)*.6); break;
      case 'cook':
        spawnExplosion(map, e.x, e.y, 1.3);
        for (let i = 0; i < 6; i++) part({ k:'fire', x:e.x, y:e.y, z:6, vx:gauss()*10, vy:gauss()*10, vz:30 + Math.random()*20, r:8, life:1, max:1 });
        APP.burning.push({ x:e.x, y:e.y, until:now + 60000, big:true, acc:0 });
        sound('bigboom', camVol(e.x, e.y)); break;
      case 'kill': {
        const d = UT[e.type], u = unitOf(e.id);
        if (e.v){
          map.obst[cellIdx(map, e.x, e.y)] = 1;
          APP.wrecks.push({ x:e.x, y:e.y, h:e.h/100, ta:e.ta/100 + (Math.random() - .5)*.8, type:e.type, t0:now });
          addDecal(APP.mapCv, { k:'scorch', x:e.x, y:e.y, r:11 });
          APP.burning.push({ x:e.x, y:e.y, until:now + 35000 + Math.random()*20000, big:false, acc:0 });
          spawnExplosion(map, e.x, e.y, .8); sound('boom', camVol(e.x, e.y));
        }
        if (e.side === me){ addLog('Потерян: ' + d.name + ', ' + gridRef(e.x, e.y) + '.', 'bad', { x:e.x, y:e.y }); addPing(e.x, e.y, REL.en, 5000); }
        else addLog((u && u.vis[me]) ? 'Уничтожен противник: ' + d.name + '.' : 'Противник понёс потери.', 'good', (u && u.vis[me]) ? { x:e.x, y:e.y } : null);
        break;
      }
      case 'bd': {
        if (APP.mode === 'guest' || APP.replay){ if (e.s === 2) map.t[e.i] = T.RUBBLE; map.bst[e.i] = e.s; }
        redrawAround(APP.mapCv, map, e.i); APP.miniDirty = true;
        const p = cellCenter(map, e.i);
        if (e.s === 1) spawnDust(p.x, p.y, 3, false);
        else {
          spawnDust(p.x, p.y, 9, true); spawnExplosion(map, p.x, p.y, .5, 'collapse');
          if (Math.random() < .35) APP.burning.push({ x:p.x + gauss()*5, y:p.y + gauss()*5, until:now + 30000 + Math.random()*40000, big:false, acc:0 });
          sound('collapse', camVol(p.x, p.y));
          if (!APP.bldAgg || now - APP.bldAgg.t > 6000){ APP.bldAgg = { t:now, n:0, x:p.x, y:p.y }; }
          APP.bldAgg.n++; APP.bldAgg.x = p.x; APP.bldAgg.y = p.y;
          clearTimeout(APP.bldAgg.tm);
          const agg = APP.bldAgg; agg.tm = setTimeout(() => { addLog('Обрушились здания: ' + agg.n + ', ' + gridRef(agg.x, agg.y) + '.', 'neu', { x:agg.x, y:agg.y }); }, 1500);
        }
        break;
      }
      case 'civ': {
        if (e.p) for (const q of e.p) APP.bodies.push({ x:q[0], y:q[1], rot:Math.random()*7, pal:UNIF.civ, seed:(q[2]*29) & 255 });
        const who = e.side === me ? 'от нашего огня' : e.side ? 'от огня противника' : '';
        addLog('Погибли мирные жители: ' + e.n + (who ? ' (' + who + ')' : '') + ', ' + gridRef(e.x, e.y) + '.', 'civ', { x:e.x, y:e.y });
        addPing(e.x, e.y, '#e8e2c9', 5000);
        break;
      }
      case 'aa': { const [x1, y1, x2, y2] = e.a; APP.fx.push({ k:'aa', a:[x1, y1, x2, y2], t0:now, d:420 }); sound('mg', camVol(x1, y1)); break; }
      case 'air':
        sound('jet', 1);
        if (e.side === me) addLog(AIR.name + ': самолёт заходит на цель, ' + gridRef(e.x, e.y) + '.', 'sys', { x:e.x, y:e.y });
        else { addLog('Штурмовик противника! Удар ожидается в районе ' + gridRef(e.x, e.y) + '.', 'bad', { x:e.x, y:e.y }); addPing(e.x, e.y, REL.en, 7000, 'Су-25'); }
        break;
      case 'crash':
        addLog(e.side === me ? 'Наш Су-25 сбит над ' + gridRef(e.x, e.y) + '.' : 'Сбит штурмовик противника!', e.side === me ? 'bad' : 'good', { x:e.x, y:e.y });
        for (let k = 0; k < 8; k++) part({ k:'smoke', x:e.x + gauss()*8, y:e.y - 70, z:0, vx:gauss()*8, vy:gauss()*4, vz:-4, r:6, dr:5, life:4, max:4, c:40 });
        sound('boom', camVol(e.x, e.y)); break;
      case 'trap':
        spawnExplosion(map, e.x, e.y - 30, .35); sound('gren', camVol(e.x, e.y));
        if (e.side === me) addLog('Растяжка в доме! Отряд понёс потери, ' + gridRef(e.x, e.y) + '.', 'bad', { x:e.x, y:e.y });
        else addLog('Сработала растяжка, ' + gridRef(e.x, e.y) + '.', 'good', { x:e.x, y:e.y });
        break;
      case 'trapset': if (e.side === me) addLog('Растяжка установлена.', 'sys', { x:e.x, y:e.y }); break;
      case 'trev': if (e.side === me){ addLog('Сапёры нашли растяжку, ' + gridRef(e.x, e.y) + '.', 'neu', { x:e.x, y:e.y }); addPing(e.x, e.y, '#f2d36b', 4000); } break;
      case 'detrap': if (e.side === me) addLog('Сапёры сняли растяжку.', 'good', { x:e.x, y:e.y }); break;
      case 'fire': {
        const c = cellCenter(map, e.i);
        if (now - (APP.lastFireLog || 0) > 10000 && APP.view.units.some(u => u.side === me && Math.hypot(u.x - c.x, u.y - c.y) < 350)){
          APP.lastFireLog = now; addLog('Загорелся дом, ' + gridRef(c.x, c.y) + '. Огонь пойдёт по этажам — пехоте лучше уйти.', 'neu', { x:c.x, y:c.y });
        }
        break;
      }
      case 'delay': if (me === 'fed' && now - (APP.lastDelay || 0) > 6000){ APP.lastDelay = now; addLog('Нет связи с ' + e.n + ' подразд.: приказ дойдёт примерно через ' + e.s + ' с. Держите их в радиусе КШМ или у штаба.', 'neu'); } break;
      case 'dive': if (e.side === me) addLog('Отряд ушёл в подвал.', 'sys'); break;
      case 'emerge': if (e.side === me) addLog('Отряд вышел из подвала, ' + gridRef(e.x, e.y) + '.', 'arr', { x:e.x, y:e.y }); break;
      case 'prop': {
        const pr = map.props && map.props[e.id]; if (!pr) break;
        pr.st = e.s;
        if (e.s === 1){ spawnExplosion(map, pr.x, pr.y, .35); APP.burning.push({ x:pr.x, y:pr.y, until:now + 20000 + Math.random()*15000, big:false, acc:0 }); }
        else { for (let k = 0; k < 6; k++){ const a = Math.random()*7; part({ k:'debris', x:pr.x, y:pr.y, z:2, vx:Math.cos(a)*30, vy:Math.sin(a)*30, vz:15, s:1.2, c:'#8fa6ae', life:1.2, max:1.2 }); } sound('hit', camVol(pr.x, pr.y)); }
        break;
      }
      case 'left': addLog((e.name || 'Игрок') + ' вышел из боя. Его отряды переданы союзнику.', 'sys'); break;
      case 'buyfail': if (e.side === me) addLog('Выйти в этом доме не удалось: рядом противник. Очки не списаны.', 'bad', { x:e.x, y:e.y }); break;
      case 'arr':
        if (e.side === me){
          addLog((e.inf ? 'Вышли из подвала: ' : 'Прибыло подкрепление: ') + UT[e.type].name + ', ' + gridRef(e.x, e.y) + '.', 'arr', { x:e.x, y:e.y });
          if (!e.owner || e.owner === APP.pid){ addPing(e.x, e.y, REL.own, 9000, UT[e.type].name); APP.newUnits.set(e.id, now); }
        }
        break;
      case 'obj':
        if (!e.owner){ addLog(e.name + ': точка стала нейтральной.', 'neu', objPos(e.name)); }
        else if (e.owner === me){ addLog(e.name + ': точка взята.', 'good', objPos(e.name)); }
        else { addLog(e.name + ': противник взял точку.', 'bad', objPos(e.name)); toast(e.name + ': противник взял точку', 3500, 'bad'); }
        { const p = objPos(e.name); if (p) addPing(p.x, p.y, e.owner === me ? REL.own : e.owner ? REL.en : '#e8e2c9', 6000); }
        break;
      case 'exit': if (e.side === me) addLog('Грузовик колонны вышел из ущелья.', 'good'); else addLog('Грузовик колонны противника ушёл.', 'bad'); break;
      case 'battle': addLog('Бой начался.', 'sys'); toast('Бой начался', 2500); break;
      case 'man': {
        const pal = UNIF[e.side];
        for (let k = 0; k < e.n; k++){ const a = Math.random()*7, r = 3 + Math.random()*9; APP.bodies.push({ x:e.x + Math.cos(a)*r, y:e.y + Math.sin(a)*r, rot:Math.random()*7, pal, seed:Math.floor(Math.random()*255) }); }
        if (APP.bodies.length > 2500) APP.bodies.splice(0, 200);
        break;
      }
      case 'ter':
        if (APP.mode === 'guest' || APP.replay) map.t[e.i] = e.v;
        redrawAround(APP.mapCv, map, e.i); APP.miniDirty = true;
        if (e.v === T.RUBBLE){ const p = cellCenter(map, e.i); spawnDust(p.x, p.y, 3, false); }
        break;
      case 'smk': {
        sound('pop', camVol(e.x, e.y));
        for (let k = 0; k < 6; k++) part({ k:'smoke', x:e.x + gauss()*e.r*.4, y:e.y + gauss()*e.r*.4, z:2, vx:gauss()*6, vy:gauss()*6, vz:2, r:6, dr:10, life:2.5, max:2.5, c:205, tan:0 });
        break;
      }
      case 'pop': sound('pop', camVol(e.x, e.y)); break;
      case 'flare': sound('flare', camVol(e.x, e.y)); if (e.side === me) addLog('Осветительная ракета, ' + gridRef(e.x, e.y) + '.', 'sys', { x:e.x, y:e.y }); break;
      case 'mine':
        if (e.side === me){ addLog('Подрыв на мине: ' + UT[e.type].name + ', ' + gridRef(e.x, e.y) + '.', 'bad', { x:e.x, y:e.y }); addPing(e.x, e.y, REL.en, 6000); }
        else addLog('Противник подорвался на мине, ' + gridRef(e.x, e.y) + '.', 'good', { x:e.x, y:e.y });
        break;
      case 'mrev': if (e.side === me){ addLog('Обнаружена мина противника, ' + gridRef(e.x, e.y) + '.', 'neu', { x:e.x, y:e.y }); addPing(e.x, e.y, '#f2d36b', 5000); } break;
      case 'demine': if (e.side === me) addLog('Сапёры сняли мину.', 'good', { x:e.x, y:e.y }); break;
      case 'unbarr': if (e.side === me) addLog('Сапёры разобрали баррикаду.', 'good'); break;
      case 'rend': addLog('Этап 1 окончен. ' + (e.res.winner ? (e.res.winner === me ? 'Этап за вами.' : 'Этап за противником.') : 'Ничья.'), 'sys'); break;
    }
  }
  if (APP.wrecks.length > 80) APP.wrecks.shift();
  if (APP.burning.length > 60) APP.burning.shift();
}
function objPos(name){ const o = APP.sc && APP.sc.objectives.find(o => o.name === name); return o ? { x:o.x, y:o.y } : null; }

/* ---------- Камера ---------- */
function clampCam(){
  if (!APP.map) return; const Wm = APP.map.W*CELL, Hm = APP.map.H*CELL, c = APP.cam;
  c.z = clamp(c.z, Math.min(cw/Wm, ch/Hm)*.95, 3.2);
  const hw = cw/2/c.z, hh = ch/2/c.z;
  c.x = hw*2 >= Wm ? Wm/2 : clamp(c.x, hw, Wm - hw);
  c.y = hh*2 >= Hm ? Hm/2 : clamp(c.y, hh - 60/c.z, Hm - hh + 60/c.z);
}
const toWorld = (sx, sy) => ({ x:(sx - cw/2)/APP.cam.z + APP.cam.x, y:(sy - ch/2)/APP.cam.z + APP.cam.y });
const toScreen = (x, y) => ({ x:(x - APP.cam.x)*APP.cam.z + cw/2, y:(y - APP.cam.y)*APP.cam.z + ch/2 });

function viewUnits(){
  const v = APP.view; if (!v) return [];
  const interp = APP.mode === 'guest' || APP.replay;
  const a = APP.replay ? APP.replay.alpha : APP.mode === 'guest' ? clamp((performance.now() - APP.viewT)/105, 0, 1) : 1;
  return v.units.filter(u => !u.carrier).map(u => {
    const p = APP.prev.get(u.id);
    const r = interp && p ? { ...u, rx:p.x + (u.x - p.x)*a, ry:p.y + (u.y - p.y)*a, rh:p.h + angDiff(u.h, p.h)*a, rta:p.ta + angDiff(u.ta, p.ta)*a } : { ...u, rx:u.x, ry:u.y, rh:u.h, rta:u.ta };
    r.cell = cellIdx(APP.map, u.x, u.y);
    r.lift = u.inB && !u.under && UT[u.type].cls === 'inf' ? bldH(APP.map, r.cell)*.62 : 0;
    return r;
  });
}
function visibleToMe(u){ const v = APP.view; if (APP.replay && APP.replay.full) return !u.under || true; if (u.side === APP.side) return true; if (!v || v.phase === 'deploy') return false; return u.vis[APP.side]; }
const useModels = () => APP.viewMode === 'models' || (APP.viewMode === 'auto' && APP.cam.z >= .5);

/* ---------- Отрисовка ---------- */
function drawUnit(u, now, models, s){
  const d = UT[u.type], me = APP.side, own = u.side === me, sel = APP.sel.has(u.id), z = APP.cam.z;
  const ws = voxW();
  if (!models){
    if (d.cls === 'veh'){ ctx.strokeStyle = own ? REL.ownD : REL.enD; ctx.lineWidth = 2.5/z; ctx.beginPath(); ctx.moveTo(u.rx + Math.cos(u.rh)*s*.7, u.ry + Math.sin(u.rh)*s*.7); ctx.lineTo(u.rx + Math.cos(u.rh)*s*1.6, u.ry + Math.sin(u.rh)*s*1.6); ctx.stroke(); }
    drawIcon(ctx, u.rx, u.ry, s, d, own, 1, sel);
    return s*.9;
  }
  // кольцо принадлежности
  const rr = (d.cls === 'veh' ? 10.5 : 10)*ws;
  ctx.beginPath(); ctx.ellipse(u.rx, u.ry - (u.lift ? u.lift + 2*ws : 0), rr, rr*.62, 0, 0, 7);
  ctx.fillStyle = own ? 'rgba(79,179,255,.13)' : 'rgba(255,77,61,.16)'; ctx.fill();
  const ally = own && !isMine(u);
  ctx.lineWidth = (sel ? 3 : 2)/z; ctx.strokeStyle = sel ? REL.sel : ally ? '#5fd6b4' : own ? REL.own : REL.en;
  if (!own) ctx.setLineDash([6/z, 3/z]); ctx.stroke(); ctx.setLineDash([]);
  let top;
  if (u.under) ctx.globalAlpha = .4;
  if (d.cls === 'veh'){
    const key = MODEL_OF[u.type];
    drawVehicle(ctx, key, u.side, u.rx, u.ry, u.rh, u.rta, ws, 1);
    const m = MODEL_DEF[key];
    top = ((m.tz || 3) + 3)*ws*LZ + 4*ws;
    if (u.type === 'f_cmd'){
      // антенны КШМ: высокие штыри и рамка — главное, чем она отличается от БТР
      const baseZ = 4.9*ws*LZ, c = Math.cos(u.rh), sn = Math.sin(u.rh);
      const ants = [[-6, -1.3, 24], [-6, 1.3, 20], [2, -1.9, 16], [-1.5, 0, 11]];
      ctx.strokeStyle = '#1e1f1c'; ctx.lineWidth = Math.max(.9/APP.cam.z, ws*.22);
      for (const [ax, ay, L] of ants){ const bx = u.rx + c*ax*ws - sn*ay*ws, by = u.ry + sn*ax*ws + c*ay*ws - baseZ;
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + ws*.8, by - L*ws*.9); ctx.stroke(); }
      const fx = u.rx + c*1.5*ws, fy = u.ry + sn*1.5*ws - baseZ;
      ctx.beginPath(); ctx.rect(fx - 2.2*ws, fy - 3.4*ws, 4.4*ws, 2.4*ws); ctx.stroke();
      top = Math.max(top, 26*ws);
    }
    drawFlag(ctx, u.side, u.rx - Math.cos(u.rh)*5*ws, u.ry - Math.sin(u.rh)*5*ws - (m.tz || 3)*ws*LZ, ws);
  } else {
    if (d.gun && !u.under) drawCrewGun(ctx, d.gun, u.rx, u.ry - (u.lift || 0) + 2*ws, u.rh, ws*1.4);
    const men = Math.max(1, Math.ceil(u.hp/(d.hp/d.men))), slots = squadSlots(u.id, men);
    const pal = UNIF[u.side], m = ws*1.6, pinned = u.supp >= 70;
    const tubes = d.weapons.reduce((n, w, i) => n + (w.k === 'at' && u.ammo[i] !== 0 ? (d.key === 'c_rpg' ? 2 : 1) : 0), 0);
    const order = slots.map((p, i) => [p, i]).sort((a, b) => a[0][1] - b[0][1]);
    const lift = u.lift || 0, inside = lift > 0, cy = u.ry - lift;
    if (inside){
      // вырез в крыше: комната на этаже, где сидит отряд
      const W2 = Math.max(14*ws, 16/z), H2 = Math.max(10*ws, 12/z), fx = u.rx - W2/2, fy = cy - H2*.75;
      ctx.fillStyle = own ? 'rgba(14,28,44,.82)' : 'rgba(48,16,12,.82)'; ctx.fillRect(fx, fy, W2, H2);
      ctx.fillStyle = own ? 'rgba(79,179,255,.18)' : 'rgba(255,77,61,.2)'; ctx.fillRect(fx, fy + H2*.72, W2, H2*.28);
      ctx.strokeStyle = own ? REL.own : REL.en; ctx.lineWidth = 1.8/z; ctx.setLineDash(own ? [] : [5/z, 3/z]); ctx.strokeRect(fx, fy, W2, H2); ctx.setLineDash([]);
      ctx.strokeStyle = own ? 'rgba(79,179,255,.5)' : 'rgba(255,77,61,.55)'; ctx.lineWidth = 1/z; ctx.setLineDash([2/z, 3/z]);
      ctx.beginPath(); ctx.moveTo(u.rx, fy + H2); ctx.lineTo(u.rx, u.ry); ctx.stroke(); ctx.setLineDash([]);
    }
    if (u.under){
      const W2 = 14*ws, H2 = 7*ws;
      ctx.strokeStyle = 'rgba(159,208,255,.8)'; ctx.lineWidth = 1.5/z; ctx.setLineDash([3/z, 3/z]); ctx.strokeRect(u.rx - W2/2, u.ry - H2/2, W2, H2); ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(159,208,255,.85)'; ctx.beginPath(); ctx.moveTo(u.rx - 4/z, u.ry + H2/2 + 2/z); ctx.lineTo(u.rx + 4/z, u.ry + H2/2 + 2/z); ctx.lineTo(u.rx, u.ry + H2/2 + 8/z); ctx.closePath(); ctx.fill();
    }
    const sc = inside ? .75 : 1;
    for (const [p, i] of order) drawMan(ctx, u.rx + p[0]*ws*(inside ? 1 : 1.6), cy + p[1]*ws*(inside ? .5 : 1.9), m*sc, pal, (u.id*7 + i*13) & 255, u.rh, pinned, true, i < tubes);
    top = 4*m*sc + 3*ws + lift + (inside ? 8*ws : 0);
    ctx.globalAlpha = 1;
  }
  return top;
}
function drawBars(u, top, now){
  const d = UT[u.type], me = APP.side, own = u.side === me, z = APP.cam.z;
  const hp = clamp(u.hp/d.hp, 0, 1), bw = 26/z, bh = 4/z, bx = u.rx - bw/2; let by = u.ry - top - 8/z;
  if (useModels() && z < 1.4){ drawIcon(ctx, u.rx, by - 9/z, 9/z, d, own, .95, false); by -= 18/z; }
  ctx.fillStyle = 'rgba(15,15,15,.75)'; ctx.fillRect(bx - 1/z, by - 1/z, bw + 2/z, bh + 2/z);
  ctx.fillStyle = hp > .6 ? '#8fbf6a' : hp > .3 ? '#e0b24a' : '#d4533b'; ctx.fillRect(bx, by, bw*hp, bh);
  if (u.supp > 30){ ctx.fillStyle = u.supp >= 70 ? '#f2d36b' : 'rgba(242,211,107,.55)'; ctx.fillRect(bx, by + bh + 1/z, bw*clamp(u.supp/100, 0, 1), 2/z); }
  ctx.textAlign = 'center';
  const tag = u.inFire ? 'пожар!' : u.under ? 'в подвале' : u.pend ? 'приказ через ' + u.pend + ' с' : u.nocomm && own ? 'нет связи' : u.immob ? 'ходовая разбита' : u.working === 'mine' ? 'снимает мину' : u.working === 'barr' ? 'разбирает завал' : u.boarding ? 'на посадку' : null;
  if (own && u.ambush){ ctx.fillStyle = '#b9c98a'; ctx.font = `bold ${10/z}px "PT Sans Narrow",sans-serif`; ctx.fillText('засада', u.rx - 26/z, by + 5/z); }
  if (own){ const cg = APP.view.units.find(c => c.carrier === u.id); if (cg){ ctx.fillStyle = REL.own; ctx.font = `bold ${11/z}px "PT Sans Narrow",sans-serif`; ctx.fillText('десант ' + Math.max(1, Math.ceil(cg.hp/(UT[cg.type].hp/UT[cg.type].men))), u.rx + 26/z, by + 5/z); } }
  if (u.supp >= 70){ ctx.fillStyle = '#f2d36b'; ctx.font = `bold ${12/z}px "PT Sans Narrow",sans-serif`; ctx.fillText('прижат', u.rx, by - 3/z); }
  else if (tag && (own || u.immob)){ ctx.fillStyle = u.inFire ? '#ff7a3a' : u.immob ? '#ff9a7a' : (u.nocomm || u.pend) ? '#c9c4b3' : u.under ? '#9fd0ff' : '#f2d36b'; ctx.font = `bold ${11/z}px "PT Sans Narrow",sans-serif`; ctx.fillText(tag, u.rx, by - 3/z); }
  else if (u.inB){
    const dz = !own && APP.view.units.some(t => t.side === me && APP.sel.has(t.id) && UT[t.type].weapons.some(w => w.lowElev) && Math.hypot(t.x - u.x, t.y - u.y) < 70);
    ctx.fillStyle = dz ? '#ff9a7a' : own ? '#cfe6fa' : '#ffc4bb'; ctx.font = `${11/z}px "PT Sans Narrow",sans-serif`;
    const fl = APP.map.fl ? APP.map.fl[u.cell] : 0;
    ctx.fillText(dz ? 'выше угла пушки' : 'в доме' + (fl ? ', ' + fl + ' эт.' : ''), u.rx, by - 3/z);
  }
  const nt = APP.newUnits.get(u.id);
  if (nt && now - nt < 9000){
    const k = ((now - nt)/900) % 1;
    ctx.strokeStyle = `rgba(79,179,255,${1 - k})`; ctx.lineWidth = 2/z; ctx.beginPath(); ctx.arc(u.rx, u.ry, (14 + k*22)/z, 0, 7); ctx.stroke();
    ctx.fillStyle = REL.own; ctx.font = `bold ${12/z}px "PT Sans Narrow",sans-serif`; ctx.fillText('новый', u.rx, by - 15/z);
  }
}
function drawWreck(w, models){
  const key = MODEL_OF[w.type]; if (!key) return;
  if (models) drawVehicle(ctx, key, 'burnt', w.x, w.y, w.h, w.ta, voxW(), 1);
  else { const s = 7/APP.cam.z; ctx.strokeStyle = 'rgba(30,26,22,.85)'; ctx.lineWidth = 3/APP.cam.z; ctx.beginPath(); ctx.moveTo(w.x - s, w.y - s); ctx.lineTo(w.x + s, w.y + s); ctx.moveTo(w.x + s, w.y - s); ctx.lineTo(w.x - s, w.y + s); ctx.stroke(); }
}
function updateBurning(now, dt){
  for (const b of APP.burning){
    if (now > b.until) continue;
    b.acc += dt;
    const rate = b.big ? .05 : .09;
    while (b.acc > rate){
      b.acc -= rate;
      part({ k:'fire', x:b.x + gauss()*3, y:b.y + gauss()*3, z:2, vx:gauss()*2, vy:gauss()*2, vz:8 + Math.random()*10, r:b.big ? 5 : 3.2, life:.5 + Math.random()*.3, max:.8 });
      if (Math.random() < .5) part({ k:'smoke', x:b.x + gauss()*3, y:b.y, z:6, vx:5 + gauss()*2, vy:gauss()*1.5, vz:9 + Math.random()*5, r:4, dr:4.5, life:6 + Math.random()*4, max:10, c:45 + Math.random()*25 });
    }
  }
  APP.burning = APP.burning.filter(b => now < b.until);
}


function drawMine(x, y, own, z){
  const r = 6/z;
  ctx.fillStyle = own ? '#3b3a30' : '#5a1f18'; ctx.strokeStyle = own ? REL.own : REL.en; ctx.lineWidth = 1.6/z;
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = own ? '#d9d4bf' : '#ffd0c8'; ctx.beginPath(); ctx.moveTo(x - r*.55, y); ctx.lineTo(x + r*.55, y); ctx.moveTo(x, y - r*.55); ctx.lineTo(x, y + r*.55); ctx.stroke();
  if (!own){ ctx.fillStyle = REL.en; ctx.font = `bold ${11/z}px "PT Sans Narrow",sans-serif`; ctx.textAlign = 'center'; ctx.fillText('мина', x, y - r - 3/z); }
}
function drawTrap(x, y, own, z){
  const r = 5/z;
  ctx.strokeStyle = own ? REL.own : REL.en; ctx.lineWidth = 1.4/z; ctx.fillStyle = own ? 'rgba(20,40,60,.8)' : 'rgba(80,20,14,.85)';
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - r*1.8, y + r*.6); ctx.lineTo(x + r*1.8, y + r*.6); ctx.setLineDash([2/z, 2/z]); ctx.stroke(); ctx.setLineDash([]);
  if (!own){ ctx.fillStyle = REL.en; ctx.font = `bold ${10/z}px "PT Sans Narrow",sans-serif`; ctx.textAlign = 'center'; ctx.fillText('растяжка', x, y - r - 3/z); }
}
function drawSmokeCloud(sm, now, z, night){
  const [x, y, r0, left] = sm, r = Math.max(8, r0), fade = clamp(left/8, 0, 1)*(r0 > 0 ? 1 : .5);
  ctx.fillStyle = night ? '#6c7076' : APP.map.winter ? '#8e918d' : '#dcdcd5';
  for (let k = 0; k < 12; k++){
    const a = k*2.4 + now/9000*(1 + k % 3), d = r*.6*hr(k, 3), rr = r*(.42 + hr(k, 5)*.35);
    ctx.globalAlpha = .34*fade; ctx.beginPath(); ctx.arc(x + Math.cos(a)*d + Math.sin(now/4000 + k)*3, y + Math.sin(a)*d*.8 - 4, rr, 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
let darkCv = null;
function drawNight(now, mine){
  if (!darkCv) darkCv = document.createElement('canvas');
  const W = Math.ceil(cw/2), H = Math.ceil(ch/2); if (darkCv.width !== W || darkCv.height !== H){ darkCv.width = W; darkCv.height = H; }
  const d = darkCv.getContext('2d'), z = APP.cam.z;
  d.globalCompositeOperation = 'source-over'; d.clearRect(0, 0, W, H); d.fillStyle = APP.view.phase === 'deploy' ? 'rgba(6,10,24,.55)' : 'rgba(6,10,24,.8)'; d.fillRect(0, 0, W, H);
  d.globalCompositeOperation = 'destination-out';
  const light = (x, y, r, a) => {
    const p = toScreen(x, y), R = Math.max(4, r*z/2), px = p.x/2, py = p.y/2;
    if (px < -R || py < -R || px > W + R || py > H + R) return;
    const gr = d.createRadialGradient(px, py, 0, px, py, R); gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(.6, `rgba(0,0,0,${a*.6})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    d.fillStyle = gr; d.beginPath(); d.arc(px, py, R, 0, 7); d.fill();
  };
  for (const u of mine) light(u.rx, u.ry, UT[u.type].cls === 'veh' ? 70 : 55, .6);
  for (const i of APP.view.fires || []){ const c = cellCenter(APP.map, i); light(c.x, c.y - bldH(APP.map, i)*.5, 80, .8); }
  for (const f of APP.view.flares || []) light(f[0], f[1], FLARE.r*1.15, .95*clamp(f[2]/5, 0, 1));
  for (const b of APP.burning) light(b.x, b.y, b.big ? 90 : 55, .75);
  let n = 0; for (const p of PART){ if ((p.k !== 'flash' && p.k !== 'fire') || n++ > 160) continue; light(p.x, p.y - p.z, p.r*(p.k === 'flash' ? 9 : 5), .85*clamp(p.life/p.max, 0, 1)); }
  ctx.drawImage(darkCv, 0, 0, cw, ch);
}
function drawSnow(dt){
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!APP.snow.length) for (let i = 0; i < 170; i++) APP.snow.push({ x:Math.random()*cw, y:Math.random()*ch, v:25 + Math.random()*45, s:1 + Math.random()*2 });
  ctx.fillStyle = 'rgba(255,255,255,.75)';
  for (const f of APP.snow){ f.y += f.v*dt; f.x += (12 + Math.sin(f.y/40)*8)*dt; if (f.y > ch) { f.y = -4; f.x = Math.random()*cw; } if (f.x > cw) f.x = 0; ctx.fillRect(f.x, f.y, f.s, f.s); }
}

function drawTallLayer(){
  const t = APP.mapCv && APP.mapCv.tall; if (!t) return;
  const z = APP.cam.z, glass = APP.roofs === 'glass', peek = (APP.keys.AltLeft || APP.keys.AltRight) && APP.mouse;
  ctx.imageSmoothingEnabled = z < 1;
  if (peek){
    const w = toWorld(APP.mouse.x, APP.mouse.y), R = 90/Math.max(.6, Math.min(1.4, z));
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, t.width, t.height); ctx.arc(w.x, w.y, R, 0, 7); ctx.clip('evenodd'); ctx.globalAlpha = glass ? .35 : 1; ctx.drawImage(t, 0, 0); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.arc(w.x, w.y, R, 0, 7); ctx.clip(); ctx.globalAlpha = .15; ctx.drawImage(t, 0, 0); ctx.restore();
    ctx.strokeStyle = 'rgba(242,211,107,.6)'; ctx.lineWidth = 1.5/z; ctx.beginPath(); ctx.arc(w.x, w.y, R, 0, 7); ctx.stroke();
  } else { ctx.globalAlpha = glass ? .35 : 1; ctx.drawImage(t, 0, 0); }
  ctx.globalAlpha = 1; ctx.imageSmoothingEnabled = true;
}
function drawFires(now, dt, z){
  const fr = APP.view.fires; if (!fr || !fr.length) return;
  const m = APP.map, tl = toWorld(-60, -60), br = toWorld(cw + 60, ch + 300);
  ctx.globalCompositeOperation = 'lighter';
  for (const i of fr){
    const X = i % m.W, Y = Math.floor(i/m.W), px = X*CELL, py = Y*CELL; if (px < tl.x - 30 || px > br.x || py < tl.y || py > br.y) continue;
    const H = bldH(m, i), fl = (Math.sin(now/90 + i) + Math.sin(now/53 + i*1.7))*.25 + .75;
    const sBld = Y + 1 < m.H && m.t[i + m.W] === T.BLD;
    if (!sBld){ // окна южной стены светятся
      ctx.globalAlpha = .22*fl; ctx.fillStyle = '#ff6a1a'; ctx.fillRect(px, py + CELL - H, CELL, H);
      ctx.globalAlpha = .75*fl; ctx.fillStyle = '#ffb040';
      for (let f = 0; f < (m.fl[i] || 1); f++) for (let k = 0; k < 4; k++) if (hr(i, f*5 + k) < .55) ctx.fillRect(px + 1.6 + k*4.6, py + CELL - (f + 1)*FLOOR_M + .7, 2.4, 1.5);
    }
    ctx.globalAlpha = .35*fl; ctx.fillStyle = '#ff8a2a'; ctx.fillRect(px + 2, py - H + 2, CELL - 4, CELL - 4);
    if (Math.random() < dt*9) part({ k:'fire', x:px + 3 + Math.random()*14, y:py - H + 4 + Math.random()*12, z:1, vx:gauss()*2, vy:gauss()*2, vz:10 + Math.random()*12, r:2.6 + Math.random()*2.4, life:.5 + Math.random()*.4, max:.9 });
    if (Math.random() < dt*3) part({ k:'smoke', x:px + 10 + gauss()*5, y:py - H + 8, z:4, vx:5 + gauss()*2, vy:gauss()*1.5, vz:10 + Math.random()*6, r:5, dr:5, life:7 + Math.random()*4, max:11, c:40 + Math.random()*25 });
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}
function toggleRoofs(){ APP.roofs = APP.roofs === 'glass' ? 'solid' : 'glass'; toast(APP.roofs === 'glass' ? 'Крыши полупрозрачные' : 'Крыши обычные', 1500); updateHud(); }
let lastFrame = performance.now();
/* ---------- Повтор боя ---------- */
function frameAt(i){ const f = APP.rec.frames[i]; if (!f.v) f.v = decodeSnap(f.s); return f.v; }
function replaySilent(e, decals){
  const m = APP.map;
  switch (e.e){
    case 'bd': if (e.s === 2) m.t[e.i] = T.RUBBLE; m.bst[e.i] = e.s; break;
    case 'ter': m.t[e.i] = e.v; break;
    case 'prop': if (m.props && m.props[e.id]) m.props[e.id].st = e.s; break;
    case 'boom': decals.push({ k:'crater', x:e.x, y:e.y, r:e.big ? 8 : 5.5 }); break;
    case 'kill': if (e.v){ m.obst[cellIdx(m, e.x, e.y)] = 1; APP.wrecks.push({ x:e.x, y:e.y, h:e.h/100, ta:e.ta/100, type:e.type, t0:0 }); decals.push({ k:'scorch', x:e.x, y:e.y, r:11 }); } break;
    case 'man': { const pal = UNIF[e.side]; for (let k = 0; k < e.n; k++){ const a = hr(e.id, k)*7, r = 3 + hr(e.id, k + 9)*9; APP.bodies.push({ x:e.x + Math.cos(a)*r, y:e.y + Math.sin(a)*r, rot:hr(e.id, k + 3)*7, pal, seed:(e.id*7 + k) & 255 }); } break; }
    case 'civ': if (e.p) for (const q of e.p) APP.bodies.push({ x:q[0], y:q[1], rot:hr(q[2], 1)*7, pal:UNIF.civ, seed:(q[2]*29) & 255 }); break;
  }
}
function replaySeek(t){
  const R = APP.replay, B = APP.rec.base, m = APP.map;
  m.t.set(B.t); m.bst.set(B.bst); m.obst.set(B.obst); if (m.props && B.props) m.props.forEach((p, k) => p.st = B.props[k]);
  APP.bodies = []; APP.wrecks = []; APP.burning = []; PART.length = 0; APP.fx = []; APP.ghosts.clear(); APP.pings = [];
  const decals = []; let i = 0; const ev = APP.rec.events;
  for (; i < ev.length && ev[i].t <= t; i++) replaySilent(ev[i].e, decals);
  R.ei = i; R.t = t;
  APP.mapCv = renderMapCanvas(m); for (const d of decals) addDecal(APP.mapCv, d); APP.miniDirty = true;
  replayView();
}
function replayView(){
  const R = APP.replay, F = APP.rec.frames; let lo = 0, hi = F.length - 1;
  while (lo < hi){ const mid = (lo + hi + 1) >> 1; if (F[mid].t <= R.t) lo = mid; else hi = mid - 1; }
  const f0 = frameAt(lo), f1 = frameAt(Math.min(F.length - 1, lo + 1)), t0 = F[lo].t, t1 = F[Math.min(F.length - 1, lo + 1)].t;
  R.alpha = t1 > t0 ? clamp((R.t - t0)/(t1 - t0), 0, 1) : 1;
  APP.prev = new Map(f0.units.map(u => [u.id, u]));
  APP.view = f1; APP.byId = new Map(f1.units.map(u => [u.id, u]));
  APP.side = f1.round === 2 ? other(APP.side0) : APP.side0;
  R.round = f1.round; R.bt = APP.sc.duration - f0.phaseT;
}
function enterReplay(){
  if (!APP.rec || APP.rec.frames.length < 2){ toast('Для повтора пока нет записи боя'); return; }
  clearInterval(APP.loop); APP.loop = null;
  const F = APP.rec.frames;
  APP.replay = { t:F[0].t, t0:F[0].t, t1:F[F.length - 1].t, playing:true, speed:2, full:true, ei:0, alpha:1 };
  $('#end').hidden = true; $('#round').hidden = true; $('#b-res').hidden = true; $('#replay').hidden = false; document.body.classList.add('replay');
  APP.sel.clear(); APP.placing = null; APP.targeting = false;
  replaySeek(APP.replay.t0); updateReplayBar();
}
function exitReplay(){
  const R = APP.replay; if (!R) return;
  replaySeek(R.t1); APP.replay = null; document.body.classList.remove('replay'); $('#replay').hidden = true;
  APP.side = APP.view.round === 2 ? other(APP.side0) : APP.side0; $('#end').hidden = false;
}
function replayTick(dt){
  const R = APP.replay; if (!R.playing) return;
  const nt = Math.min(R.t1, R.t + dt*R.speed), ev = APP.rec.events, batch = [];
  while (R.ei < ev.length && ev[R.ei].t <= nt){ batch.push(ev[R.ei].e); R.ei++; }
  R.t = nt; replayView();
  if (batch.length) addFx(batch, APP.prev);
  if (R.t >= R.t1) R.playing = false;
}
function updateReplayBar(){
  const R = APP.replay; if (!R) return;
  $('#rp-play').textContent = R.playing ? 'Пауза' : (R.t >= R.t1 ? 'Сначала' : 'Смотреть');
  $('#rp-speed').textContent = '×' + R.speed;
  $('#rp-vis').textContent = R.full ? 'Видно всё' : 'Моё зрение';
  $('#rp-time').textContent = 'Этап ' + (R.round || 1) + ', ' + fmtT(R.bt || 0);
  if (document.activeElement !== $('#rp-seek')) $('#rp-seek').value = Math.round((R.t - R.t0)/Math.max(.01, R.t1 - R.t0)*1000);
}
$('#rp-play').onclick = () => { const R = APP.replay; if (R.t >= R.t1){ replaySeek(R.t0); R.playing = true; } else R.playing = !R.playing; updateReplayBar(); };
$('#rp-speed').onclick = () => { const R = APP.replay; R.speed = { 1:2, 2:4, 4:8, 8:1 }[R.speed]; updateReplayBar(); };
$('#rp-vis').onclick = () => { APP.replay.full = !APP.replay.full; updateReplayBar(); };
$('#rp-exit').onclick = exitReplay;
$('#rp-seek').addEventListener('input', e => { const R = APP.replay; replaySeek(R.t0 + (R.t1 - R.t0)*e.target.value/1000); updateReplayBar(); });
$('#end-replay').onclick = enterReplay;
setInterval(() => { if (APP.replay) updateReplayBar(); }, 200);

function frame(now){
  const dt = Math.min(.05, (now - lastFrame)/1000); lastFrame = now;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (!APP.sc || !APP.view){ drawMenuBg(now); requestAnimationFrame(frame); return; }
  if (APP.replay) replayTick(dt);
  const K = APP.keys, sp = 700/APP.cam.z*dt;
  if (!K.ControlLeft && !K.ControlRight && document.activeElement !== chatIn){
    if (K.KeyW || K.ArrowUp) APP.cam.y -= sp; if (K.KeyS || K.ArrowDown) APP.cam.y += sp;
    if (K.KeyA || K.ArrowLeft) APP.cam.x -= sp; if (K.KeyD || K.ArrowRight) APP.cam.x += sp;
  }
  clampCam();
  updateParticles(dt, p => { if (Math.random() < .6) addDecal(APP.mapCv, { k:'bit', x:p.x, y:p.y, r:Math.max(1, p.s*.8), c:p.c }); });
  updateBurning(now, dt);
  const v = APP.view, me = APP.side, z = APP.cam.z, models = useModels();
  ctx.fillStyle = '#1b1d1f'; ctx.fillRect(0, 0, cw, ch);
  APP.shake *= Math.pow(.02, dt);
  const shx = APP.shake > .3 ? gauss()*APP.shake : 0, shy = APP.shake > .3 ? gauss()*APP.shake : 0;
  ctx.save(); ctx.translate(cw/2 + shx, ch/2 + shy); ctx.scale(z, z); ctx.translate(-APP.cam.x, -APP.cam.y);
  ctx.imageSmoothingEnabled = z < 1;
  ctx.drawImage(APP.mapCv, 0, 0);
  ctx.imageSmoothingEnabled = true;
  if (APP.placing && APP.placing.startsWith('eng:') && APP.placing !== 'eng:trap'){
    const eng = APP.placing.startsWith('eng:'), tl = toWorld(0, 0), br = toWorld(cw, ch), m = APP.map, pg = pseudoG();
    const x0 = Math.max(0, Math.floor(tl.x/CELL)), x1 = Math.min(m.W - 1, Math.ceil(br.x/CELL)), y0 = Math.max(0, Math.floor(tl.y/CELL)), y1 = Math.min(m.H - 1, Math.ceil(br.y/CELL));
    ctx.fillStyle = eng ? 'rgba(242,211,107,.16)' : 'rgba(79,179,255,.28)';
    for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++){
      const cx = xx*CELL + 10, cy = yy*CELL + 10;
      if (eng ? engOk(pg, me, cx, cy, APP.placing.slice(4)) : infilOk(pg, me, APP.placing, cx, cy)) ctx.fillRect(xx*CELL, yy*CELL, CELL, CELL);
    }
  }
  if (v.phase === 'deploy') for (const s of SIDES) for (const r of APP.sc.deploy[s]){
    ctx.fillStyle = s === me ? 'rgba(79,179,255,.14)' : 'rgba(30,30,30,.12)';
    ctx.fillRect(r.x, r.y, r.w, r.h); ctx.setLineDash([12/z, 8/z]); ctx.lineWidth = 2/z; ctx.strokeStyle = s === me ? REL.own : '#6b6a60'; ctx.strokeRect(r.x, r.y, r.w, r.h); ctx.setLineDash([]);
  }
  if (APP.sc.exit){ const e = APP.sc.exit, own = e.side === me; ctx.fillStyle = own ? 'rgba(79,179,255,.1)' : 'rgba(255,77,61,.1)'; ctx.fillRect(e.x, e.y, e.w, e.h); ctx.setLineDash([6/z, 6/z]); ctx.strokeStyle = own ? REL.own : REL.en; ctx.lineWidth = 2/z; ctx.strokeRect(e.x, e.y, e.w, e.h); ctx.setLineDash([]); }
  APP.sc.objectives.forEach((o, i) => {
    const [prog, owner] = v.objs[i], rel = owner ? (owner === me ? 'own' : 'en') : null;
    ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, 7);
    ctx.fillStyle = rel === 'own' ? 'rgba(79,179,255,.07)' : rel === 'en' ? 'rgba(255,77,61,.07)' : 'rgba(240,235,210,.1)'; ctx.fill();
    ctx.lineWidth = 2.5/z; ctx.strokeStyle = rel === 'own' ? REL.own : rel === 'en' ? REL.en : '#6d6a5a'; ctx.stroke();
    if (Math.abs(prog) < 100){ const toward = prog > 0 ? 'fed' : 'chr'; ctx.beginPath(); ctx.arc(o.x, o.y, o.r + 6/z, -Math.PI/2, -Math.PI/2 + Math.abs(prog)/100*Math.PI*2); ctx.strokeStyle = toward === me ? REL.own : REL.en; ctx.lineWidth = 4/z; ctx.stroke(); }
  });
  drawParticles(ctx, z, 'ground');
  const tlw = toWorld(-80, -80), brw = toWorld(cw + 80, ch + 80), inView = (x, y) => x > tlw.x && x < brw.x && y > tlw.y && y < brw.y;
  if (models){ const bm = voxW()*1.6; for (const b of APP.bodies) if (inView(b.x, b.y)) drawBody(ctx, b.x, b.y, b.rot, b.pal, b.seed, bm); }
  else { ctx.fillStyle = 'rgba(40,35,30,.55)'; for (const b of APP.bodies) if (inView(b.x, b.y)) ctx.fillRect(b.x - 1.5/z, b.y - 1.5/z, 3/z, 3/z); }
  for (const w of APP.wrecks) drawWreck(w, models);
  if (APP.map.props){ const pw = voxW(); for (const pr of APP.map.props) if (inView(pr.x, pr.y)) drawProp(ctx, pr, pw, z, models); }
  for (const m of v.mines || []){ const ms = m[3] ? 'chr' : 'fed', own = ms === me, rev = m[4] & (me === 'fed' ? 1 : 2) || (APP.replay && APP.replay.full); if (own || rev) drawMine(m[1], m[2], own, z); }
  // мирные жители рядом с нашими подразделениями
  const units = viewUnits(), mine = units.filter(u => u.side === me);
  if (models && v.civs) for (const c of v.civs){
    if (c.st === 2) continue;
    if (!mine.some(u => Math.abs(u.x - c.x) < 380 && Math.abs(u.y - c.y) < 380)) continue;
    drawMan(ctx, c.x, c.y, voxW()*1.15, UNIF.civ, (c.id*29) & 255, c.h, false, false, false);
  }
  for (const m of v.marks){ const ms = m[0] ? 'chr' : 'fed'; if (ms !== me) continue;
    const col = m[4] ? '#d8d8d0' : '#ff8a3a', R = m[4] ? AB2[ms].scatter*1.4 : AB[ms].scatter*1.6;
    ctx.setLineDash([8/z, 6/z]); ctx.strokeStyle = col; ctx.lineWidth = 2/z; ctx.beginPath(); ctx.arc(m[1], m[2], R, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    if (m[3] > 0){ ctx.fillStyle = col; ctx.font = `bold ${16/z}px "PT Sans Narrow",sans-serif`; ctx.textAlign = 'center'; ctx.fillText(Math.ceil(m[3]) + ' с', m[1], m[2] + 5/z); }
  }
  // юниты
  const s = 15/z, shown = [], shownIds = new Set();
  for (const u of units){ if (!visibleToMe(u)) continue; shown.push(u); shownIds.add(u.id); if (u.side !== me) APP.ghosts.set(u.id, { x:u.rx, y:u.ry, type:u.type, side:u.side, t:now }); }
  shown.sort((a, b) => a.ry - b.ry);
  if (APP.map.winter) for (const u of shown){
    if (UT[u.type].cls !== 'veh') continue; const last = APP.trk.get(u.id);
    if (!last){ APP.trk.set(u.id, { x:u.rx, y:u.ry }); continue; }
    const dd = Math.hypot(u.rx - last.x, u.ry - last.y);
    if (dd > 7){ addDecal(APP.mapCv, { k:'trk', x:last.x, y:last.y, x2:u.rx, y2:u.ry, w:UT[u.type].mc === 'track' ? 3.2 : 2.6 }); APP.trk.set(u.id, { x:u.rx, y:u.ry }); }
  }
  for (const u of shown) if (u.side === me && APP.sel.has(u.id) && u.dest){
    ctx.strokeStyle = u.fast ? 'rgba(240,200,90,.85)' : 'rgba(240,235,210,.75)'; ctx.lineWidth = 1.5/z; ctx.setLineDash([5/z, 5/z]); ctx.beginPath(); ctx.moveTo(u.rx, u.ry); ctx.lineTo(u.dest.x, u.dest.y); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(240,235,210,.8)'; ctx.beginPath(); ctx.arc(u.dest.x, u.dest.y, 3/z, 0, 7); ctx.fill();
  }
  if (me === 'fed' && v.phase !== 'end') for (const u of shown) if (u.side === me && UT[u.type].comm){
    ctx.strokeStyle = 'rgba(120,200,255,.35)'; ctx.lineWidth = 1.5/z; ctx.setLineDash([10/z, 8/z]); ctx.beginPath(); ctx.arc(u.rx, u.ry, UT[u.type].comm, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(160,215,255,.8)'; ctx.font = `${11/z}px "PT Sans Narrow",sans-serif`; ctx.textAlign = 'center'; ctx.fillText('радиосвязь', u.rx, u.ry - UT[u.type].comm - 4/z);
  }
  for (const u of shown) if (isMine(u) && u.q && u.q.length && (APP.sel.has(u.id) || v.phase === 'deploy')){
    ctx.strokeStyle = 'rgba(240,235,210,.55)'; ctx.lineWidth = 1.3/z; ctx.setLineDash([3/z, 5/z]); ctx.beginPath();
    let px = u.dest ? u.dest.x : u.rx, py = u.dest ? u.dest.y : u.ry; ctx.moveTo(px, py);
    for (const [qx, qy] of u.q){ ctx.lineTo(qx, qy); } ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(240,235,210,.85)'; u.q.forEach(([qx, qy], k) => { ctx.beginPath(); ctx.arc(qx, qy, 3/z, 0, 7); ctx.fill(); ctx.font = `${10/z}px "PT Sans Narrow",sans-serif`; ctx.fillText(String(k + (u.dest ? 2 : 1)), qx + 5/z, qy - 4/z); });
  }
  for (const u of shown) if (u.side === me && u.afire && APP.sel.has(u.id)){ ctx.strokeStyle = 'rgba(255,138,58,.7)'; ctx.lineWidth = 1.2/z; ctx.setLineDash([3/z, 4/z]); ctx.beginPath(); ctx.moveTo(u.rx, u.ry); ctx.lineTo(u.afire.x, u.afire.y); ctx.stroke(); ctx.setLineDash([]); ctx.beginPath(); ctx.arc(u.afire.x, u.afire.y, 8/z, 0, 7); ctx.stroke(); }
  for (const u of shown) if (u.side === me && APP.sel.has(u.id) && UT[u.type].weapons.some(w => w.lowElev)){
    ctx.strokeStyle = 'rgba(255,90,70,.55)'; ctx.lineWidth = 1.5/z; ctx.setLineDash([2/z, 5/z]); ctx.beginPath(); ctx.arc(u.rx, u.ry, 70, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    if (APP.sel.size === 1){ ctx.fillStyle = 'rgba(255,140,120,.9)'; ctx.font = `${11/z}px "PT Sans Narrow",sans-serif`; ctx.textAlign = 'center'; ctx.fillText('пушка не достаёт верхние этажи', u.rx, u.ry + 70 + 12/z); }
  }
  for (const u of shown) if (u.side === me && APP.sel.has(u.id) && APP.sel.size <= 3 && UT[u.type].maxRange){ ctx.strokeStyle = 'rgba(242,211,107,.35)'; ctx.lineWidth = 1/z; ctx.beginPath(); ctx.arc(u.rx, u.ry, UT[u.type].maxRange, 0, 7); ctx.stroke(); }
  const tops = new Map();
  for (const u of shown) if (!u.lift && !u.under) tops.set(u.id, drawUnit(u, now, models, s));
  drawTallLayer();
  drawFires(now, dt, z);
  for (const t of v.traps || []){ const ts = t[3] ? 'chr' : 'fed', own = ts === me, rev = (t[4] & (me === 'fed' ? 1 : 2)) || (APP.replay && APP.replay.full); if (!own && !rev) continue; const ci = cellIdx(APP.map, t[1], t[2]); drawTrap(t[1], t[2] - bldH(APP.map, ci), own, z); }
  // дома поверх улицы: подсветки на крышах, кольца отрядов за домами, точки
  const trapPlacing = APP.placing === 'eng:trap';
  if ((APP.targeting === 'tunnel' && APP.tunnelReach) || trapPlacing || (APP.placing && me === 'chr' && UT[APP.placing] && UT[APP.placing].cls === 'inf')){
    const m = APP.map, pg = pseudoG(), tl = toWorld(0, 0), br = toWorld(cw, ch + 300);
    ctx.fillStyle = 'rgba(79,179,255,.38)';
    const mark = ci => { const X = ci % m.W, Y = Math.floor(ci/m.W); ctx.fillRect(X*CELL, Y*CELL - bldH(m, ci), CELL, CELL); };
    if (APP.targeting === 'tunnel') for (const ci of APP.tunnelReach) mark(ci);
    else for (let yy = Math.max(0, Math.floor(tl.y/CELL)); yy <= Math.min(m.H - 1, Math.ceil(br.y/CELL)); yy++) for (let xx = Math.max(0, Math.floor(tl.x/CELL)); xx <= Math.min(m.W - 1, Math.ceil(br.x/CELL)); xx++){
      const ci = yy*m.W + xx; if (trapPlacing ? trapOk(pg, me, xx*CELL + 10, yy*CELL + 10) : infilOk(pg, me, APP.placing, xx*CELL + 10, yy*CELL + 10)){ if (m.t[ci] === T.BLD || !trapPlacing) mark(ci); } }
  }
  APP.sc.objectives.forEach((o, i) => { const ow = v.objs[i][1]; ctx.globalAlpha = .55; ctx.strokeStyle = ow ? (ow === me ? REL.own : REL.en) : '#6d6a5a'; ctx.lineWidth = 2/z; ctx.setLineDash([6/z, 5/z]); ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, 7); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1; });
  if (models) for (const u of shown){
    if (u.lift || u.under || pickBuilding(APP.map, u.rx, u.ry) === null) continue;
    const own = u.side === me, rr = (UT[u.type].cls === 'veh' ? 10.5 : 10)*voxW();
    ctx.globalAlpha = .8; ctx.beginPath(); ctx.ellipse(u.rx, u.ry, rr, rr*.62, 0, 0, 7); ctx.lineWidth = 2/z; ctx.strokeStyle = APP.sel.has(u.id) ? REL.sel : own ? REL.own : REL.en; ctx.setLineDash([4/z, 3/z]); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
  }
  for (const u of shown) if (u.lift || u.under) tops.set(u.id, drawUnit(u, now, models, s));
  for (const [id, gh] of APP.ghosts){
    if (shownIds.has(id)) continue; const age = now - gh.t;
    if (age > 8000 || v.phase === 'deploy'){ APP.ghosts.delete(id); continue; }
    drawIcon(ctx, gh.x, gh.y, s, UT[gh.type], false, .38*(1 - age/8000), false);
  }
  for (const sm of v.smokes || []) drawSmokeCloud(sm, now, z, v.night);
  drawParticles(ctx, z, 'air');
  for (const a of v.air || []){
    const [ax, ay, dx, dy] = a, ang = Math.atan2(dy, dx), ps = Math.max(2.1, 18/z/8);
    drawPlane(ctx, ax + 26, ay + 18, ang, ps, true);
    drawPlane(ctx, ax, ay - 70, ang, ps, false);
  }
  ctx.restore();
  if (v.night) drawNight(now, mine);
  // поверх темноты
  ctx.save(); ctx.translate(cw/2 + shx, ch/2 + shy); ctx.scale(z, z); ctx.translate(-APP.cam.x, -APP.cam.y);
  if (v.night){
    ctx.globalCompositeOperation = 'lighter';
    let n = 0; for (const p of PART){ if ((p.k !== 'flash' && p.k !== 'fire') || n++ > 220) continue; const a = clamp(p.life/p.max, 0, 1); ctx.globalAlpha = a*.55; ctx.fillStyle = p.k === 'flash' ? '#ffe7a0' : '#ff8a30'; ctx.beginPath(); ctx.arc(p.x, p.y - p.z, p.r*(p.k === 'flash' ? 1.6 : 1.1), 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    for (const u of shown){ const own = u.side === me, rr = (UT[u.type].cls === 'veh' ? 10.5 : 10)*voxW(); ctx.beginPath(); ctx.ellipse(u.rx, u.ry, rr, rr*.62, 0, 0, 7); ctx.lineWidth = 2/z; ctx.strokeStyle = APP.sel.has(u.id) ? REL.sel : own ? REL.own : REL.en; if (!own) ctx.setLineDash([6/z, 3/z]); ctx.stroke(); ctx.setLineDash([]); }
  }
  for (const f of v.flares || []){
    const drift = (FLARE.life - f[2])*1.2, fx = f[0] + drift, fy = f[1] - 40 + drift*.4;
    ctx.globalAlpha = .9; ctx.fillStyle = '#fffbe6'; ctx.beginPath(); ctx.arc(fx, fy, 4/z, 0, 7); ctx.fill();
    ctx.globalAlpha = .35; ctx.fillStyle = '#fff3c4'; ctx.beginPath(); ctx.arc(fx, fy, 14/z, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(220,220,210,.5)'; ctx.lineWidth = 1/z; ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx - 8/z, fy - 14/z); ctx.lineTo(fx + 8/z, fy - 14/z); ctx.closePath(); ctx.stroke();
  }
  // трассеры и падающие снаряды
  APP.fx = APP.fx.filter(f => now - f.t0 < f.d);
  for (const f of APP.fx){
    const k = (now - f.t0)/f.d;
    if (f.k === 'arc'){
      const [x1, y1, x2, y2] = f.a, q = Math.min(1, k*1.05), px = x1 + (x2 - x1)*q, py = y1 + (y2 - y1)*q - Math.sin(q*Math.PI)*Math.min(60, Math.hypot(x2 - x1, y2 - y1)*.45);
      ctx.fillStyle = '#2a2a26'; ctx.beginPath(); ctx.arc(px, py, 1.6/z + .6, 0, 7); ctx.fill(); continue;
    }
    if (f.k === 'aa'){
      const [x1, y1, x2, y2] = f.a; ctx.globalAlpha = 1 - k; ctx.strokeStyle = '#ffd36b'; ctx.lineWidth = 1.4/z;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 + (x2 - x1)*Math.min(1, k*1.8), y1 + (y2 - 70 - y1)*Math.min(1, k*1.8)); ctx.stroke(); ctx.globalAlpha = 1; continue;
    }
    if (f.k === 'flashmark'){
      ctx.globalAlpha = 1 - k; ctx.strokeStyle = '#ffb347'; ctx.lineWidth = 2/z;
      ctx.beginPath(); for (let i = 0; i < 8; i++){ const a = i/8*Math.PI*2; ctx.moveTo(f.x + Math.cos(a)*4/z, f.y + Math.sin(a)*4/z); ctx.lineTo(f.x + Math.cos(a)*10/z, f.y + Math.sin(a)*10/z); } ctx.stroke();
      ctx.globalAlpha = 1; continue;
    }
    if (f.k === 'fall'){
      const h = (1 - k)*260, off = (1 - k)*50;
      ctx.globalAlpha = .8; ctx.strokeStyle = v.night ? '#c9c2b0' : '#2b2620'; ctx.lineWidth = (f.big ? 3 : 2)/z; ctx.beginPath(); ctx.moveTo(f.x + off, f.y - h - 18/z); ctx.lineTo(f.x + off*.9, f.y - h); ctx.stroke();
      ctx.globalAlpha = .25 + k*.4; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(f.x, f.y, (f.big ? 7 : 5)*(1.5 - k*.5), (f.big ? 4 : 3)*(1.5 - k*.5), 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
      continue;
    }
    const [x1, y1, x2, y2] = f.a;
    ctx.globalAlpha = 1 - k*.8; ctx.strokeStyle = f.k === 'rocket' ? '#ff9a3c' : f.k === 'shell' ? '#ffd166' : (v.night ? '#ffe28a' : '#f5dc8a');
    ctx.lineWidth = (f.k === 'tracer' ? (v.night ? 1.8 : 1.3) : 2.6)/z; ctx.beginPath();
    if (f.k === 'rocket'){
      const q = Math.min(1, k*1.15), px = x1 + (x2 - x1)*q, py = y1 + (y2 - y1)*q;
      ctx.strokeStyle = 'rgba(210,205,190,.55)'; ctx.lineWidth = 4/z; ctx.moveTo(x1, y1); ctx.lineTo(px, py); ctx.stroke();
      ctx.beginPath(); ctx.fillStyle = '#ffb347'; ctx.arc(px, py, 2.5/z, 0, 7); ctx.fill();
    } else {
      const q0 = Math.max(0, k*1.6 - .6), q1 = Math.min(1, k*1.6 + .1);
      ctx.moveTo(x1 + (x2 - x1)*q0, y1 + (y2 - y1)*q0); ctx.lineTo(x1 + (x2 - x1)*q1, y1 + (y2 - y1)*q1); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  for (const u of shown) drawBars(u, tops.get(u.id) || s, now);
  // подписи
  ctx.fillStyle = v.night ? 'rgba(220,215,195,.8)' : 'rgba(40,36,26,.85)'; ctx.textAlign = 'center';
  ctx.font = `italic ${clamp(15/z, 12, 40)}px "PT Serif",serif`;
  for (const l of APP.map.labels) ctx.fillText(l.text, l.x, l.y);
  ctx.font = `bold ${clamp(14/z, 11, 36)}px "PT Sans Narrow",sans-serif`;
  for (const o of APP.sc.objectives){ ctx.fillStyle = v.night ? '#e8e2c9' : '#2b2820'; ctx.fillText(o.name, o.x, o.y + o.r + 18/z); }
  // отметки на карте
  APP.pings = APP.pings.filter(p => now - p.t0 < p.ms);
  for (const p of APP.pings){
    const age = now - p.t0;
    for (let r = 0; r < 2; r++){ const k = ((age/1200) + r*.5) % 1; ctx.globalAlpha = (1 - k)*(1 - age/p.ms); ctx.strokeStyle = p.col; ctx.lineWidth = 2.5/z; ctx.beginPath(); ctx.arc(p.x, p.y, (12 + k*40)/z, 0, 7); ctx.stroke(); }
  }
  ctx.globalAlpha = 1;
  if (APP.placing && APP.mouse){
    const w = pickW(APP.mouse.x, APP.mouse.y);
    if (APP.placing.startsWith('eng:')){
      const k = APP.placing.slice(4), ok = engOkC(w.x, w.y, k);
      ctx.globalAlpha = ok ? .85 : .3;
      if (k === 'trap'){ const ci = cellIdx(APP.map, w.x, w.y), c = cellCenter(APP.map, ci); drawTrap(c.x, c.y - bldH(APP.map, ci), true, z); }
      else if (k === 'barr'){ const cx = Math.floor(w.x/CELL)*CELL, cy = Math.floor(w.y/CELL)*CELL; ctx.fillStyle = '#6d6a63'; ctx.fillRect(cx, cy, CELL, CELL); ctx.strokeStyle = REL.own; ctx.lineWidth = 2/z; ctx.strokeRect(cx, cy, CELL, CELL); }
      else drawMine(w.x, w.y, true, z);
      ctx.globalAlpha = 1;
    } else { const d = UT[APP.placing]; const ok = (v.phase === 'deploy' && inRects(APP.sc.deploy[me], w.x, w.y) && passableAt(APP.map, d.mc, w.x, w.y)) || infilOkC(APP.placing, w.x, w.y); drawIcon(ctx, w.x, w.y, s, d, true, ok ? .85 : .3, false); }
  }
  if (APP.targeting && APP.mouse){
    if (APP.targeting === 'air'){
      const w = toWorld(APP.mouse.x, APP.mouse.y), en = APP.sc.entry.fed, ex = en.reduce((a, b) => a + b.x, 0)/en.length, ey = en.reduce((a, b) => a + b.y, 0)/en.length;
      let dx = w.x - ex, dy = w.y - ey; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
      ctx.strokeStyle = 'rgba(255,138,58,.8)'; ctx.lineWidth = 2/z; ctx.setLineDash([10/z, 6/z]);
      ctx.beginPath(); ctx.moveTo(w.x - dx*600, w.y - dy*600); ctx.lineTo(w.x + dx*200, w.y + dy*200); ctx.stroke(); ctx.setLineDash([]);
      ctx.lineWidth = 12/z*0 + 44; ctx.strokeStyle = 'rgba(255,138,58,.18)'; ctx.beginPath(); ctx.moveTo(w.x - dx*80, w.y - dy*80); ctx.lineTo(w.x + dx*120, w.y + dy*120); ctx.stroke();
    }
    const w = toWorld(APP.mouse.x, APP.mouse.y), R = APP.targeting === 'air' ? 30 : APP.targeting === 'smoke' ? AB2[me].scatter*1.4 : APP.targeting === 'flare' ? FLARE.r : APP.targeting === 'afire' ? 25 : AB[me].scatter*1.6;
    ctx.strokeStyle = APP.targeting === 'smoke' ? '#e0e0d8' : APP.targeting === 'flare' ? '#fff3c4' : '#ff8a3a'; ctx.lineWidth = 2/z;
    ctx.beginPath(); ctx.arc(w.x, w.y, R, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.moveTo(w.x - 12/z, w.y); ctx.lineTo(w.x + 12/z, w.y); ctx.moveTo(w.x, w.y - 12/z); ctx.lineTo(w.x, w.y + 12/z); ctx.stroke();
  }
  ctx.restore();
  if (APP.map.winter) drawSnow(dt);
  // стрелки к отметкам за краем экрана
  for (const p of APP.pings){
    const q = toScreen(p.x, p.y), m = 40;
    if (q.x > m && q.y > m && q.x < cw - m && q.y < ch - m) continue;
    const cx = cw/2, cy = ch/2, dx = q.x - cx, dy = q.y - cy, k = Math.min((cw/2 - m)/Math.abs(dx || 1), (ch/2 - m)/Math.abs(dy || 1));
    const ex = cx + dx*k, ey = cy + dy*k, a = Math.atan2(dy, dx);
    ctx.save(); ctx.translate(ex, ey); ctx.rotate(a); ctx.fillStyle = p.col; ctx.globalAlpha = .9;
    ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-6, -9); ctx.lineTo(-6, 9); ctx.closePath(); ctx.fill(); ctx.restore();
    if (p.label){ ctx.fillStyle = '#efe9d4'; ctx.font = '13px "PT Sans Narrow",sans-serif'; ctx.textAlign = 'center'; ctx.fillText(p.label, ex - Math.cos(a)*30, ey - Math.sin(a)*22); }
  }
  if (APP.drag && APP.drag.box){ const d = APP.drag; ctx.strokeStyle = REL.sel; ctx.lineWidth = 1; ctx.fillStyle = 'rgba(242,211,107,.08)'; ctx.fillRect(d.x0, d.y0, d.x1 - d.x0, d.y1 - d.y0); ctx.strokeRect(d.x0, d.y0, d.x1 - d.x0, d.y1 - d.y0); }
  drawMini(now, units);
  if (now - (APP.engT || 0) > 120){
    APP.engT = now;
    updateEngines(shown.filter(u => UT[u.type].cls === 'veh').map(u => ({ type:u.type, moving:u.moving, vol:camVol(u.rx, u.ry) })));
  }
  requestAnimationFrame(frame);
}

/* ---------- Мини-карта ---------- */
function drawMini(now, units){
  const W = mini.width, H = mini.height; if (!W || !APP.map) return;
  const Wm = APP.map.W*CELL, Hm = APP.map.H*CELL, sc = Math.min(W/Wm, H/Hm), ox = (W - Wm*sc)/2, oy = (H - Hm*sc)/2;
  if (APP.miniDirty && now - APP.miniT > 800){
    APP.miniT = now; APP.miniDirty = false;
    if (!APP.miniBase){ APP.miniBase = document.createElement('canvas'); }
    APP.miniBase.width = W; APP.miniBase.height = H;
    const b = APP.miniBase.getContext('2d'); b.fillStyle = '#1b1d1f'; b.fillRect(0, 0, W, H); b.imageSmoothingEnabled = true; b.drawImage(APP.mapCv, ox, oy, Wm*sc, Hm*sc);
  }
  mctx.setTransform(1, 0, 0, 1, 0, 0);
  if (APP.miniBase) mctx.drawImage(APP.miniBase, 0, 0); else { mctx.fillStyle = '#222'; mctx.fillRect(0, 0, W, H); }
  mctx.setTransform(sc, 0, 0, sc, ox, oy);
  const v = APP.view, me = APP.side;
  APP.sc.objectives.forEach((o, i) => { const ow = v.objs[i][1]; mctx.strokeStyle = ow ? (ow === me ? REL.own : REL.en) : '#e8e2c9'; mctx.lineWidth = 3/sc; mctx.beginPath(); mctx.arc(o.x, o.y, o.r, 0, 7); mctx.stroke(); });
  if (v.phase === 'deploy') for (const r of APP.sc.deploy[me]){ mctx.strokeStyle = REL.own; mctx.lineWidth = 1.5/sc; mctx.strokeRect(r.x, r.y, r.w, r.h); }
  const dot = 3.2/sc;
  for (const u of units){
    if (!visibleToMe(u)) continue; const own = u.side === me;
    mctx.fillStyle = own ? (APP.sel.has(u.id) ? REL.sel : REL.own) : REL.en;
    if (UT[u.type].cls === 'veh') mctx.fillRect(u.rx - dot, u.ry - dot, dot*2, dot*2); else { mctx.beginPath(); mctx.arc(u.rx, u.ry, dot, 0, 7); mctx.fill(); }
  }
  for (const a of v.air || []){ mctx.fillStyle = a[5] && v.air ? '#fff' : '#fff'; mctx.beginPath(); mctx.arc(a[0], a[1], 22, 0, 7); mctx.fill(); }
  mctx.fillStyle = '#ff7a2a'; for (const i of v.fires || []){ const c = cellCenter(APP.map, i); mctx.fillRect(c.x - 12, c.y - 12, 24, 24); }
  for (const sm of v.smokes || []){ mctx.fillStyle = 'rgba(220,220,214,.6)'; mctx.beginPath(); mctx.arc(sm[0], sm[1], Math.max(10, sm[2]), 0, 7); mctx.fill(); }
  for (const [, gh] of APP.ghosts){ mctx.strokeStyle = 'rgba(255,77,61,.6)'; mctx.lineWidth = 1/sc; mctx.strokeRect(gh.x - dot, gh.y - dot, dot*2, dot*2); }
  for (const p of APP.pings){ const k = ((now - p.t0)/1000) % 1; mctx.strokeStyle = p.col; mctx.globalAlpha = 1 - k; mctx.lineWidth = 2/sc; mctx.beginPath(); mctx.arc(p.x, p.y, (8 + k*30)/sc, 0, 7); mctx.stroke(); mctx.globalAlpha = 1; }
  const tl = toWorld(0, 0), br = toWorld(cw, ch);
  mctx.strokeStyle = '#f2ecd6'; mctx.lineWidth = 1.5/sc; mctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
  mctx.setTransform(1, 0, 0, 1, 0, 0);
}
function miniToWorld(e){
  const r = mini.getBoundingClientRect(), W = r.width, H = r.height, Wm = APP.map.W*CELL, Hm = APP.map.H*CELL, sc = Math.min(W/Wm, H/Hm);
  const ox = (W - Wm*sc)/2, oy = (H - Hm*sc)/2;
  return { x:clamp((e.clientX - r.left - ox)/sc, 0, Wm), y:clamp((e.clientY - r.top - oy)/sc, 0, Hm) };
}
mini.addEventListener('contextmenu', e => e.preventDefault());
mini.addEventListener('mousedown', e => {
  if (!APP.map) return; e.stopPropagation(); const w = miniToWorld(e);
  if (e.button === 0){ APP.miniDrag = true; APP.cam.x = w.x; APP.cam.y = w.y; clampCam(); }
  else if (e.button === 2 && APP.view && APP.view.phase === 'battle' && APP.sel.size){ sendCmd({ c:'move', ids:[...APP.sel], x:w.x, y:w.y, fast:APP.fastNext }); APP.fastNext = false; addPing(w.x, w.y, '#f2d36b', 1500); }
});
addEventListener('mousemove', e => { if (APP.miniDrag){ const w = miniToWorld(e); APP.cam.x = w.x; APP.cam.y = w.y; clampCam(); } });
addEventListener('mouseup', () => { APP.miniDrag = false; });

/* ---------- Фон меню ---------- */
let bgMap = null, bgCv = null;
function drawMenuBg(now){
  if (!bgCv){ bgMap = buildMap('city', 3); bgCv = renderMapCanvas(bgMap); }
  ctx.fillStyle = '#1b1d1f'; ctx.fillRect(0, 0, cw, ch);
  const z = Math.max(cw/1400, ch/900), reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ox = 500 + (reduce ? 0 : Math.sin(now/40000)*300), oy = 350 + (reduce ? 0 : Math.cos(now/52000)*150);
  ctx.save(); ctx.translate(cw/2, ch/2); ctx.scale(z, z); ctx.translate(-ox - 700, -oy - 450); ctx.drawImage(bgCv, 0, 0); ctx.restore();
  const gr = ctx.createLinearGradient(0, 0, cw*.7, ch); gr.addColorStop(0, 'rgba(24,26,28,.55)'); gr.addColorStop(1, 'rgba(24,26,28,.82)'); ctx.fillStyle = gr; ctx.fillRect(0, 0, cw, ch);
}

/* ---------- Ввод ---------- */
function pickW(sx, sy){
  const w = toWorld(sx, sy), i = pickBuilding(APP.map, w.x, w.y);
  if (i !== null){ const c = cellCenter(APP.map, i); return { x:c.x, y:c.y, bld:i }; }
  return w;
}
function unitAt(sx, sy, pred){
  let best = null, bd = useModels() ? Math.max(16, 11*voxW()*APP.cam.z) : 16;
  for (const u of viewUnits()){ if (!pred(u)) continue; const p = toScreen(u.rx, u.ry - (u.lift || 0)), d = Math.hypot(p.x - sx, p.y - sy); if (d < bd){ bd = d; best = u; } }
  return best;
}
addEventListener('pointerdown', () => sndInit(), { capture:true });
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('mousedown', e => {
  if (!APP.sc) return;
  if (document.activeElement === chatIn) chatIn.blur();
  if (e.button === 1 || (e.button === 0 && APP.keys.Space)){ APP.pan = { x:e.clientX, y:e.clientY, cx:APP.cam.x, cy:APP.cam.y }; return; }
  if (e.button === 0) APP.drag = { x0:e.clientX, y0:e.clientY, x1:e.clientX, y1:e.clientY, box:false };
  if (e.button === 2) rightClick(e);
});
addEventListener('mousemove', e => {
  APP.mouse = { x:e.clientX, y:e.clientY };
  if (APP.pan){ APP.cam.x = APP.pan.cx - (e.clientX - APP.pan.x)/APP.cam.z; APP.cam.y = APP.pan.cy - (e.clientY - APP.pan.y)/APP.cam.z; clampCam(); }
  if (APP.drag){ APP.drag.x1 = e.clientX; APP.drag.y1 = e.clientY; if (Math.hypot(APP.drag.x1 - APP.drag.x0, APP.drag.y1 - APP.drag.y0) > 6) APP.drag.box = true; }
});
addEventListener('mouseup', e => {
  if (APP.pan && (e.button === 1 || e.button === 0)){ APP.pan = null; return; }
  if (e.button !== 0 || !APP.drag) return;
  const d = APP.drag; APP.drag = null;
  if (!APP.sc || !APP.view) return;
  const me = APP.side;
  if (!d.box){
    const w = pickW(e.clientX, e.clientY);
    if (APP.placing){
      if (APP.placing.startsWith('eng:')) sendCmd({ c:'eng', k:APP.placing.slice(4), x:w.x, y:w.y });
      else if (APP.view.phase === 'battle'){
        if (!infilOkC(APP.placing, w.x, w.y)){ toast('Сюда нельзя: нужен жилой дом не ближе 220 м к противнику'); return; }
        sendCmd({ c:'buy', type:APP.placing, x:w.x, y:w.y }); addLog(UT[APP.placing].name + ' выйдет из подвала через ' + (ARRIVE + 3) + ' с, ' + gridRef(w.x, w.y) + '.', 'sys', { x:w.x, y:w.y }); APP.placing = null; setTimeout(buildDeck, 80); updateHud(); return;
      }
      else sendCmd({ c:'deploy', type:APP.placing, x:w.x, y:w.y });
      if (!e.shiftKey) APP.placing = null; setTimeout(buildDeck, 60); updateHud(); return;
    }
    if (APP.targeting){
      const t = APP.targeting; APP.targeting = false;
      if (t === 'smoke'){ sendCmd({ c:'asmoke', x:w.x, y:w.y }); addLog(AB2[me].name + ': запрошены, ' + gridRef(w.x, w.y) + '.', 'sys', { x:w.x, y:w.y }); }
      else if (t === 'flare') sendCmd({ c:'flare', x:w.x, y:w.y });
      else if (t === 'air'){ sendCmd({ c:'air', x:w.x, y:w.y }); }
      else if (t === 'tunnel'){
        const ci = cellIdx(APP.map, w.x, w.y);
        if (!APP.tunnelReach || !APP.tunnelReach.has(ci)){ toast('Туда подвалами не пройти: только дома этого квартала'); APP.targeting = 'tunnel'; return; }
        sendCmd({ c:'tunnel', ids:tunnelUnits().map(u => u.id), x:w.x, y:w.y }); addPing(w.x, w.y, REL.own, 1500);
      }
      else if (t === 'afire'){ sendCmd({ c:'afire', ids:selOwn().map(u => u.id), x:w.x, y:w.y }); addPing(w.x, w.y, '#ff8a3a', 1500); }
      else { sendCmd({ c:'ability', x:w.x, y:w.y }); addLog(AB[me].name + ': огонь запрошен, ' + gridRef(w.x, w.y) + '.', 'sys', { x:w.x, y:w.y }); }
      updateHud(); return;
    }
    const u = unitAt(e.clientX, e.clientY, isMine);
    if (!e.shiftKey) APP.sel.clear();
    if (u){ if (e.detail >= 2){ for (const x of viewUnits()) if (isMine(x) && x.type === u.type){ const p = toScreen(x.rx, x.ry); if (p.x > 0 && p.y > 0 && p.x < cw && p.y < ch) APP.sel.add(x.id); } } else APP.sel.add(u.id); }
  } else {
    if (!e.shiftKey) APP.sel.clear();
    const x0 = Math.min(d.x0, d.x1), x1 = Math.max(d.x0, d.x1), y0 = Math.min(d.y0, d.y1), y1 = Math.max(d.y0, d.y1);
    for (const u of viewUnits()){ if (!isMine(u)) continue; const p = toScreen(u.rx, u.ry - (u.lift || 0)); if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1) APP.sel.add(u.id); }
  }
  updateSel();
});
function rightClick(e){
  if (APP.replay) return;
  const me = APP.side, v = APP.view;
  if (APP.placing || APP.targeting){ APP.placing = null; APP.targeting = false; updateHud(); return; }
  const ids = [...APP.sel].filter(id => isMine(APP.byId.get(id)));
  const w = pickW(e.clientX, e.clientY);
  const own = unitAt(e.clientX, e.clientY, isMine);
  const infSel = ids.filter(id => UT[APP.byId.get(id).type].cls === 'inf');
  if (own && infSel.length && UT[own.type].cap && !APP.view.units.some(c => c.carrier === own.id)){
    sendCmd({ c:'board', ids:infSel, target:own.id }); addPing(own.x, own.y, REL.own, 900); return;
  }
  if (v.phase === 'deploy'){
    if (own && !ids.length){ sendCmd({ c:'undeploy', ids:[own.id] }); setTimeout(buildDeck, 60); return; }
    if (ids.length){
      const u1 = APP.byId.get(ids[0]), inZone = inRects(APP.sc.deploy[me], w.x, w.y) || (u1 && infilOkC(u1.type, w.x, w.y));
      if (ids.length === 1 && inZone && !e.shiftKey && !e.ctrlKey){ sendCmd({ c:'redeploy', id:ids[0], x:w.x, y:w.y }); return; }
      sendCmd({ c:'move', ids, x:w.x, y:w.y, fast:APP.fastNext || e.ctrlKey, queue:e.shiftKey }); APP.fastNext = false;
      addPing(w.x, w.y, '#efe9d4', 900); return;
    }
    if (!ids.length){ sendCmd({ c:'uneng', x:w.x, y:w.y }); setTimeout(buildDeck, 60); }
    return;
  }
  if (!ids.length) return;
  const en = unitAt(e.clientX, e.clientY, u => u.side !== me && u.vis[me]);
  if (en){ sendCmd({ c:'attack', ids, target:en.id }); addPing(en.x, en.y, REL.en, 900); return; }
  const fast = APP.fastNext || e.ctrlKey; APP.fastNext = false;
  sendCmd({ c:'move', ids, x:w.x, y:w.y, fast, queue:e.shiftKey }); updateHud();
  addPing(w.x, w.y, fast ? '#f0c85a' : '#efe9d4', 900);
}
cv.addEventListener('wheel', e => {
  if (!APP.sc) return; e.preventDefault();
  const before = toWorld(e.clientX, e.clientY);
  APP.cam.z *= e.deltaY < 0 ? 1.15 : 1/1.15; clampCam();
  const after = toWorld(e.clientX, e.clientY); APP.cam.x += before.x - after.x; APP.cam.y += before.y - after.y; clampCam();
}, { passive:false });
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  if (APP.replay){ APP.keys[e.code] = true; if (e.code === 'Space'){ e.preventDefault(); $('#rp-play').click(); } if (e.code === 'Escape') exitReplay(); return; }
  sndInit();
  APP.keys[e.code] = true; if (!APP.sc || !APP.view) return;
  const ids = [...APP.sel];
  if (e.code === 'Enter'){ e.preventDefault(); chatIn.focus(); if (APP.logFilter === 'battle') setLogFilter('all'); return; }
  if (e.code === 'Escape'){ APP.placing = null; APP.targeting = false; APP.sel.clear(); updateSel(); updateHud(); }
  if (e.code === 'KeyF'){ APP.fastNext = !APP.fastNext; updateHud(); }
  if (e.code === 'KeyH' && ids.length) sendCmd({ c:'stop', ids });
  if (e.code === 'KeyQ') toggleAbility('arty');
  if (e.code === 'KeyZ') toggleAbility('smoke');
  if (e.code === 'KeyE') toggleAbility('flare');
  if (e.code === 'KeyG') unitSmoke();
  if (e.code === 'KeyU') unloadSel();
  if (e.code === 'KeyB') toggleTunnel();
  if (e.code === 'KeyY') toggleAbility('air');
  if (e.code === 'KeyL') setTrap();
  if (e.code === 'KeyT'){ if (APP.view.phase === 'battle' && selOwn().length){ APP.targeting = APP.targeting === 'afire' ? false : 'afire'; APP.placing = null; updateHud(); } }
  if (e.code === 'KeyV') cycleView();
  if (e.code === 'KeyJ') setPanelMin('log', !document.body.classList.contains('logmin'));
  if (e.code === 'KeyK') setPanelMin('deck', !document.body.classList.contains('deckmin'));
  if (e.code === 'KeyR') toggleRoofs();
  if (e.key === 'Alt') e.preventDefault();
  if (e.code === 'KeyM') toggleSound();
  if (e.code === 'KeyN'){ if (e.shiftKey) musNext(-1); else musNext(1); }
  if (e.code === 'KeyP') musToggle();
  if ((e.code === 'Delete' || e.code === 'Backspace') && APP.view.phase === 'deploy' && ids.length){ sendCmd({ c:'undeploy', ids }); APP.sel.clear(); setTimeout(buildDeck, 60); }
  if (e.code === 'KeyA' && e.ctrlKey){ e.preventDefault(); for (const u of APP.view.units) if (isMine(u) && !u.carrier) APP.sel.add(u.id); updateSel(); }
  if (e.code === 'Space') e.preventDefault();
  if (/^Digit[0-9]$/.test(e.code)){
    const n = +e.code.slice(5);
    if (APP.view.phase === 'deploy' || e.altKey){ e.preventDefault(); const k = APP.sc.decks[APP.side][n === 0 ? 9 : n - 1]; if (k) deckClick(k); return; }
    APP.groups = APP.groups || {};
    if (e.shiftKey){ APP.groups[n] = [...APP.sel]; toast('Группа ' + n + ': ' + APP.sel.size + ' подразд.', 1400); return; }
    const gr = (APP.groups[n] || []).filter(id => isMine(APP.byId.get(id)));
    if (!gr.length) return;
    const now = performance.now();
    if (APP.lastGroup === n && now - APP.lastGroupT < 350){
      let cx = 0, cy = 0; for (const id of gr){ const u = APP.byId.get(id); cx += u.x; cy += u.y; } APP.cam.x = cx/gr.length; APP.cam.y = cy/gr.length; clampCam();
    }
    APP.lastGroup = n; APP.lastGroupT = now; APP.sel = new Set(gr); updateSel(); updateHud();
  }
  if (e.code === 'KeyI' || e.code === 'KeyC'){
    const inf = e.code === 'KeyI'; if (!e.shiftKey) APP.sel.clear();
    for (const u of viewUnits()){ if (!isMine(u) || (UT[u.type].cls === 'inf') !== inf) continue; const p = toScreen(u.rx, u.ry - (u.lift || 0)); if (p.x > 0 && p.y > 0 && p.x < cw && p.y < ch) APP.sel.add(u.id); }
    updateSel(); updateHud();
  }
  if (e.code === 'KeyX') toggleAmbush();
});
addEventListener('keyup', e => { APP.keys[e.code] = false; });
addEventListener('blur', () => { APP.keys = {}; });

function cycleView(){
  APP.viewMode = { auto:'models', models:'icons', icons:'auto' }[APP.viewMode];
  toast({ auto:'Отображение: модели вблизи, знаки издалека', models:'Отображение: всегда модели', icons:'Отображение: всегда тактические знаки' }[APP.viewMode], 2200);
  updateHud();
}
function toggleSound(){ sndInit(); SND.on = !SND.on; toast(SND.on ? 'Звук включён' : 'Звук выключен', 1500); updateHud(); }
function toggleAbility(kind){
  const v = APP.view, S = v.sides[APP.side];
  if (v.phase !== 'battle'){ toast('Доступно после начала боя'); return; }
  if (kind === 'flare' && !v.night){ toast('Осветительные ракеты нужны только ночью'); return; }
  if (kind === 'air' && APP.side !== 'fed'){ toast('Авиация есть только у федеральных сил'); return; }
  const cd = kind === 'air' ? S.cd4 : kind === 'smoke' ? S.cd2 : kind === 'flare' ? S.cd3 : (S.ch > 0 ? 0 : S.cd), cost = kind === 'air' ? AIR.cost : kind === 'smoke' ? AB2[APP.side].cost : kind === 'flare' ? FLARE.cost : AB[APP.side].cost;
  if (cd > 0){ toast('Перезарядка: ' + cd + ' с'); return; }
  if (S.p < cost){ toast('Нужно ' + cost + ' очков'); return; }
  APP.targeting = APP.targeting === kind ? false : kind; APP.placing = null; updateHud();
}
function tunnelUnits(){ return selOwn().filter(u => APP.side === 'chr' && UT[u.type].cls === 'inf' && !u.under && isCellar(APP.map, cellIdx(APP.map, u.x, u.y))); }
function setTrap(){
  if (APP.view.phase !== 'battle' || APP.side !== 'chr') return;
  const us = selOwn().filter(u => UT[u.type].cls === 'inf' && !u.under && APP.map.t[cellIdx(APP.map, u.x, u.y)] === T.BLD && APP.map.res[cellIdx(APP.map, u.x, u.y)]);
  if (!us.length){ toast('Выберите свою пехоту в жилом доме'); return; }
  sendCmd({ c:'settrap', ids:us.map(u => u.id) });
}
function toggleTunnel(){
  if (APP.view.phase !== 'battle') return;
  const us = tunnelUnits();
  if (!us.length){ toast(APP.side === 'chr' ? 'Выберите пехоту, стоящую в жилом доме' : 'Подвалами ходят только бойцы ВС ЧРИ'); return; }
  if (APP.targeting === 'tunnel'){ APP.targeting = false; updateHud(); return; }
  APP.tunnelReach = new Set(); for (const u of us) for (const k of cellarReach(APP.map, cellIdx(APP.map, u.x, u.y)).keys()) APP.tunnelReach.add(k);
  APP.targeting = 'tunnel'; APP.placing = null; updateHud();
}
function toggleAmbush(){
  const us = selOwn(); if (!us.length){ toast('Сначала выберите подразделения'); return; }
  const v = !us.every(u => u.ambush);
  sendCmd({ c:'fmode', ids:us.map(u => u.id), v });
  toast(v ? 'Засада: огонь только в упор (90 м), по приказу или в ответ' : 'Огонь свободный', 2200);
}
function selOwn(){ return [...APP.sel].map(id => APP.byId.get(id)).filter(u => isMine(u) && !u.carrier); }
function unitSmoke(){
  const us = selOwn().filter(u => u.smk > 0);
  if (!us.length){ toast('У выбранных нет дымовых гранат'); return; }
  sendCmd({ c:'smoke', ids:us.map(u => u.id) });
}
function unloadSel(){
  const vs = selOwn().filter(u => APP.view.units.some(c => c.carrier === u.id));
  if (!vs.length){ toast('В выбранных машинах нет десанта'); return; }
  sendCmd({ c:'unload', ids:vs.map(u => u.id) });
}

/* ---------- Интерфейс ---------- */
function fmtT(s){ s = Math.max(0, Math.ceil(s)); return Math.floor(s/60) + ':' + String(s % 60).padStart(2, '0'); }
function toast(msg, ms = 3200, cls = ''){
  if (APP.replay && !APP.replayToast) return;
  const box = $('#toasts'); const d = document.createElement('div'); d.className = 'toast ' + cls; d.textContent = msg; box.appendChild(d);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => d.remove(), ms);
}
function deckClick(k){
  const v = APP.view, S = v.sides[APP.side];
  if (v.phase === 'end' || v.phase === 'inter') return;
  if (k.startsWith('eng:')){
    const E = ENG[k.slice(4)];
    if ((S.eng[k.slice(4)] || 0) >= E.lim[APP.side]){ toast('Лимит: ' + E.name); return; }
    if (S.p < E.cost){ toast('Не хватает очков: нужно ' + E.cost); return; }
    APP.placing = APP.placing === k ? null : k; APP.targeting = false; updateHud(); return;
  }
  const d = UT[k];
  if ((S.used[k] || 0) >= d.limit){ toast('Лимит: ' + d.name + ' больше нет'); return; }
  if (S.p < d.cost){ toast('Не хватает очков: нужно ' + d.cost); return; }
  if (v.phase === 'deploy'){ APP.placing = APP.placing === k ? null : k; APP.targeting = false; }
  else if (APP.side === 'chr' && d.cls === 'inf' && APP.placing !== k){ APP.placing = k; APP.targeting = false; }
  else { APP.placing = null; sendCmd({ c:'buy', type:k }); addLog('Вызвано подкрепление: ' + d.name + ', прибудет с края карты через ' + ARRIVE + ' с.', 'sys'); setTimeout(buildDeck, 80); }
  updateHud();
}
function buildDeck(){
  const box = $('#deck-list'); if (!APP.sc || !APP.view) return;
  const S = APP.view.sides[APP.side];
  box.innerHTML = '';
  if (APP.view.phase === 'deploy'){
    const h = document.createElement('div'); h.className = 'deck-h'; h.textContent = 'Инженерная подготовка'; box.appendChild(h);
    if (APP.side !== APP.sc.defender){ const n = document.createElement('p'); n.className = 'deck-n'; n.textContent = APP.side === 'fed' ? 'Мины и баррикады ставит обороняющийся. У вас есть сапёры: они находят мины за 70 м, растяжки за 40 м и снимают их.' : 'Мины и баррикады ставит обороняющийся. Зато ваша пехота выходит из домов (в горах — из леса) и может ставить растяжки.'; box.appendChild(n); }
    for (const ek of Object.keys(ENG)){
      if (!engAvail({ sc:APP.sc }, APP.side, ek) || !ENG[ek].lim[APP.side]) continue;
      const E = ENG[ek], k = 'eng:' + ek, left = E.lim[APP.side] - ((S.eng || {})[ek] || 0);
      const b = document.createElement('button'); b.className = 'card eng' + (APP.placing === k ? ' on' : '');
      b.disabled = left <= 0 || S.p < E.cost; b.dataset.k = k;
      b.innerHTML = `<span class="ck"></span><span class="cn"></span><span class="cc">${E.cost}</span><span class="cl">×${left}</span>`;
      b.querySelector('.cn').textContent = E.name; b.title = E.desc; b.onclick = () => deckClick(k); box.appendChild(b);
    }
    const h2 = document.createElement('div'); h2.className = 'deck-h'; h2.textContent = 'Подразделения'; box.appendChild(h2);
  }

  APP.sc.decks[APP.side].forEach((k, i) => {
    const d = UT[k], left = d.limit - (S.used[k] || 0);
    const b = document.createElement('button'); b.className = 'card' + (APP.placing === k ? ' on' : '');
    b.disabled = left <= 0 || S.p < d.cost;
    b.innerHTML = `<span class="ck">${(i+1) % 10}</span><span class="cn"></span><span class="cc">${d.cost}</span><span class="cl">×${left}</span>`;
    b.querySelector('.cn').textContent = d.name; b.title = d.desc; b.onclick = () => deckClick(k); b.dataset.k = k;
    box.appendChild(b);
  });
}
function updateHud(){
  const v = APP.view; if (!v || !APP.sc) return;
  const me = APP.side, S = v.sides[me], F = v.sides.fed, C = v.sides.chr;
  $('#h-scn').textContent = APP.sc.title + ', ' + APP.sc.date;
  if (APP.lastPhase !== v.phase + v.round){ APP.lastPhase = v.phase + v.round; buildDeck(); }
  const rtag = v.rounds === 2 ? 'Этап ' + v.round + ' из 2, ' + roleOf(me) + (v.night ? ', ночь' : '') + '. ' : (v.night ? 'Ночь. ' : '');
  $('#h-phase').textContent = rtag + (v.phase === 'deploy' ? 'Расстановка ' + fmtT(v.phaseT) : v.phase === 'battle' ? 'Бой ' + fmtT(v.phaseT) : v.phase === 'inter' ? 'Смена сторон ' + fmtT(v.phaseT) : 'Бой окончен');
  if (v.phase === 'inter' && $('#round-t')) $('#round-t').textContent = Math.ceil(v.phaseT);
  $('#h-fed').textContent = F.s; $('#h-chr').textContent = C.s; $('#h-target').textContent = 'до ' + APP.sc.target;
  $('#bar-fed').style.width = clamp(F.s/APP.sc.target*100, 0, 100) + '%'; $('#bar-chr').style.width = clamp(C.s/APP.sc.target*100, 0, 100) + '%';
  $('#h-me').textContent = 'Вы: ' + SIDE_NAME[me]; $('#h-me').className = 'me ' + me;
  $('#h-pts').textContent = S.p + ' очков, +' + S.i.toFixed(1) + ' в секунду' + (S.arr ? ', в пути: ' + S.arr : '');
  const ready = $('#b-ready'); ready.hidden = v.phase !== 'deploy'; ready.textContent = S.r ? 'Готов, ждём соперника' : 'Готов к бою'; ready.classList.toggle('on', !!S.r);
  const ab = $('#b-ab'); ab.hidden = v.phase !== 'battle'; const chMax = AB[me].charges || 1, ch = S.ch === undefined ? chMax : S.ch;
  ab.textContent = AB[me].name + (chMax > 1 ? ' ' + ch + '/' + chMax : '') + (ch <= 0 ? ' (' + S.cd + ' с)' : ', ' + AB[me].cost + ' оч.') + ' [Q]'; ab.classList.toggle('on', APP.targeting === 'arty'); ab.disabled = ch <= 0;
  const as = $('#b-asmoke'); as.hidden = v.phase !== 'battle'; as.textContent = AB2[me].name + (S.cd2 > 0 ? ' (' + S.cd2 + ' с)' : ', ' + AB2[me].cost + ' оч.') + ' [Z]'; as.classList.toggle('on', APP.targeting === 'smoke'); as.disabled = S.cd2 > 0;
  const air = $('#b-air'); air.hidden = v.phase !== 'battle' || me !== 'fed'; air.textContent = AIR.name + ((S.cd4 || 0) > 0 ? ' (' + S.cd4 + ' с)' : ', ' + AIR.cost + ' оч.') + ' [Y]'; air.classList.toggle('on', APP.targeting === 'air'); air.disabled = (S.cd4 || 0) > 0;
  const trb = $('#b-trap'); trb.hidden = v.phase !== 'battle' || me !== 'chr' || !selOwn().some(u => UT[u.type].cls === 'inf' && !u.under && APP.map.t[cellIdx(APP.map, u.x, u.y)] === T.BLD);
  const fl = $('#b-flare'); fl.hidden = v.phase !== 'battle' || !v.night; fl.textContent = 'Ракета' + (S.cd3 > 0 ? ' (' + S.cd3 + ' с)' : ', ' + FLARE.cost + ' оч.') + ' [E]'; fl.classList.toggle('on', APP.targeting === 'flare'); fl.disabled = S.cd3 > 0;
  const so = selOwn();
  $('#b-smoke').hidden = v.phase !== 'battle' || !so.some(u => u.smk > 0);
  $('#b-unload').hidden = !so.some(u => v.units.some(c => c.carrier === u.id));
  const tb = $('#b-tunnel'); tb.hidden = v.phase !== 'battle' || me !== 'chr' || !tunnelUnits().length; tb.classList.toggle('on', APP.targeting === 'tunnel');
  const amb = $('#b-amb'); amb.hidden = v.phase === 'end' || !so.length; amb.classList.toggle('on', so.length > 0 && so.every(u => u.ambush)); amb.textContent = so.length && so.every(u => u.ambush) ? 'Засада [X]' : 'Огонь свободный [X]';
  const af = $('#b-afire'); af.hidden = v.phase !== 'battle' || !so.length; af.classList.toggle('on', APP.targeting === 'afire');
  const fb = $('#b-fast'); fb.hidden = v.phase !== 'battle'; fb.classList.toggle('on', APP.fastNext);
  $('#b-stop').hidden = v.phase !== 'battle';
  $('#b-snd').textContent = SND.on ? 'Звук: вкл' : 'Звук: выкл';
  $('#b-roofs').textContent = APP.roofs === 'glass' ? 'Крыши: сквозь' : 'Крыши: обычно';
  $('#b-view').textContent = { auto:'Вид: авто', models:'Вид: модели', icons:'Вид: знаки' }[APP.viewMode];
  $('#hint').textContent = APP.placing && v.phase === 'deploy' && me === 'chr' && UT[APP.placing] && UT[APP.placing].cls === 'inf' ? 'Пехоту можно ставить в своей зоне или в любом подсвеченном жилом доме. Shift+щелчок — несколько.'
    : APP.placing && v.phase === 'battle' ? 'Подсвечены жилые дома, где отряд выйдет из подвала: не ближе 220 м к противнику. Щёлкните карточку ещё раз, чтобы вызвать его с края карты.'
    : APP.placing && !APP.placing.startsWith('eng:') ? 'Щелчок в своей зоне ставит отряд, Shift+щелчок — несколько. Правая кнопка отменяет.'
    : APP.placing && APP.placing.startsWith('eng:') ? 'Щелчок по улице или двору в своей зоне. Правый щелчок по поставленному убирает его и возвращает очки.'
    : APP.targeting === 'smoke' ? 'Щёлкните по карте: дымовая завеса встанет через несколько секунд и закроет обзор примерно на минуту.'
    : APP.targeting === 'flare' ? 'Щёлкните по карте: ракета осветит круг радиусом 260 м на полминуты. Свет видят обе стороны.'
    : APP.targeting === 'air' ? 'Щёлкните по цели. Су-25 зайдёт со стороны ваших войск и сбросит бомбы полосой вдоль линии захода. Зенитки противника могут его сбить.'
    : APP.placing === 'eng:trap' ? 'Подсвечены жилые дома, где можно поставить растяжку. Сработает, когда туда войдёт вражеская пехота.'
    : APP.targeting === 'tunnel' ? 'Подсвечены дома квартала, связанные подвалами и проходами. Щёлкните дом: отряд пройдёт под землёй невидимым и неуязвимым и выйдет там.'
    : APP.targeting === 'afire' ? 'Щёлкните по дому или точке: выбранные будут 40 с вести огонь туда, даже не видя противника. Фугасы рушат стены, пулемёты прижимают.'
    : APP.placing && v.phase === 'battle' ? 'Подсвечены жилые дома, где отряд может выйти из подвала: не ближе 220 м к противнику. Щёлкните карточку ещё раз, чтобы вызвать его с края карты.'
    : APP.placing && me === 'chr' && UT[APP.placing] && UT[APP.placing].cls === 'inf' ? 'Пехоту можно ставить в своей зоне или в любом подсвеченном жилом доме.'
    : APP.targeting ? 'Щёлкните по карте, чтобы вызвать огонь. Снаряды ложатся с рассеиванием и бьют по всем, включая мирных жителей.'
    : v.phase === 'deploy' ? 'Правый щелчок по своей зоне переставляет отряд, за её пределами — задаёт маршрут (Shift — добавить точку, H — сбросить). В начале боя отряды пойдут сами.'
    : APP.fastNext ? 'Следующий приказ на движение будет бегом: быстрее, но без стрельбы.' : '';
  updateSel();
}
function updateSel(){
  const box = $('#sel'), v = APP.view; if (!v) return;
  for (const id of [...APP.sel]) if (!APP.byId.has(id)) APP.sel.delete(id);
  const us = v.units.filter(u => APP.sel.has(u.id) && isMine(u) && !u.carrier);
  if (!us.length){ box.hidden = true; return; }
  box.hidden = false;
  if (us.length === 1){
    const u = us[0], d = UT[u.type];
    const st = [u.immob ? 'ходовая разбита, машина обездвижена' : null, u.working === 'mine' ? 'снимает мину' : u.working === 'barr' ? 'разбирает баррикаду' : null, u.boarding ? 'идёт на посадку' : null,
      u.supp >= 70 ? 'прижат огнём' : u.supp > 30 ? 'под огнём' : null, u.inB ? 'в здании' : null, u.fast ? 'бегом' : u.moving ? 'движется' : 'на месте'].filter(Boolean).join(', ');
    const cg = v.units.find(c => c.carrier === u.id);
    const comm = u.side === 'fed' ? (d.comm ? '<p class="arm">Радиус связи 450 м: отряды внутри получают приказы сразу.</p>' : u.nocomm ? '<p class="arm">Нет связи: приказы доходят с задержкой 6–10 с.</p>' : '') : '';
    const cel = u.side === 'chr' && d.cls === 'inf' ? (u.under ? '<p class="arm">Идёт подвалами, противник его не видит.</p>' : isCellar(APP.map, cellIdx(APP.map, u.x, u.y)) ? '<p class="arm">В жилом доме: можно уйти подвалами (B).</p>' : '') : '';
    const elev = comm + cel + (d.weapons.some(w => w.lowElev) ? '<p class="arm">Пушка не поднимается на верхние этажи ближе 70 м (красный круг). Отойдите дальше или приведите БМП-2 и «Шилку».</p>' : '');
    const extra = elev + (d.cap ? `<p class="arm">Десант: ${cg ? UT[cg.type].name + ', ' + Math.max(1, Math.ceil(cg.hp/(UT[cg.type].hp/UT[cg.type].men))) + ' чел. Высадить: U' : 'пусто. Выберите пехоту и щёлкните правой по машине'}</p>` : '') + (d.smk ? `<p class="arm">Дымовых зарядов: ${u.smk} (G)</p>` : '');
    const men = d.cls === 'inf' ? `, в строю ${Math.max(1, Math.ceil(u.hp/(d.hp/d.men)))} из ${d.men}` : '';
    const ws = d.weapons.map((w, i) => `<li>${w.n}<span>${w.r} м${u.ammo[i] >= 0 ? ', выстрелов: ' + u.ammo[i] : ''}</span></li>`).join('');
    const arm = d.armor ? `<p class="arm">Броня, мм: лоб ${d.armor.f}, борт ${d.armor.s}, корма ${d.armor.r}, крыша ${d.armor.t}</p>` : '';
    box.innerHTML = `<h3>${d.name}</h3><p class="st">${st}${men}</p><ul>${ws}</ul>${arm}${extra}<p class="ds">${d.desc}</p>`;
  } else {
    const cnt = {}; for (const u of us) cnt[u.type] = (cnt[u.type] || 0) + 1;
    box.innerHTML = `<h3>Выбрано: ${us.length}</h3><ul>${Object.entries(cnt).map(([k, n]) => `<li>${UT[k].name}<span>×${n}</span></li>`).join('')}</ul>`;
  }
}
setInterval(() => { if (APP.sc && APP.view){ updateHud(); if (APP.view.phase !== 'end') buildDeckLight(); } }, 250);
function buildDeckLight(){
  const S = APP.view.sides[APP.side];
  for (const b of document.querySelectorAll('#deck-list .card')){
    const k = b.dataset.k; let left, cost;
    if (k.startsWith('eng:')){ const E = ENG[k.slice(4)]; left = E.lim[APP.side] - ((S.eng || {})[k.slice(4)] || 0); cost = E.cost; }
    else { const d = UT[k]; left = d.limit - (S.used[k] || 0); cost = d.cost; }
    b.disabled = left <= 0 || S.p < cost; b.querySelector('.cl').textContent = '×' + left; b.classList.toggle('on', APP.placing === k);
  }
}
$('#b-ready').onclick = () => { const S = APP.view.sides[APP.side]; sendCmd({ c:'ready', v:!S.r }); };
$('#b-ab').onclick = () => toggleAbility('arty');
$('#b-asmoke').onclick = () => toggleAbility('smoke');
$('#b-flare').onclick = () => toggleAbility('flare');
$('#b-smoke').onclick = unitSmoke;
$('#b-unload').onclick = unloadSel;
$('#b-tunnel').onclick = toggleTunnel;
$('#b-air').onclick = () => toggleAbility('air');
$('#b-trap').onclick = setTrap;
$('#b-amb').onclick = toggleAmbush;
$('#b-afire').onclick = () => { if (APP.view.phase === 'battle' && selOwn().length){ APP.targeting = APP.targeting === 'afire' ? false : 'afire'; updateHud(); } };
$('#b-fast').onclick = () => { APP.fastNext = !APP.fastNext; updateHud(); };
$('#b-stop').onclick = () => { if (APP.sel.size) sendCmd({ c:'stop', ids:[...APP.sel] }); };
$('#b-snd').onclick = toggleSound;
$('#b-view').onclick = cycleView;
$('#b-roofs').onclick = toggleRoofs;
function setPanelMin(which, v){
  document.body.classList.toggle(which + 'min', v);
  const b = $('#' + which + '-min'); b.textContent = v ? '+' : '–'; b.title = v ? 'Развернуть' : 'Свернуть'; b.setAttribute('aria-expanded', String(!v));
  if (!v) b.classList.remove('unread');
  try { localStorage.setItem('grz-' + which + 'min', v ? '1' : ''); } catch(e){}
}
$('#log-min').onclick = () => setPanelMin('log', !document.body.classList.contains('logmin'));
$('#deck-min').onclick = () => setPanelMin('deck', !document.body.classList.contains('deckmin'));
try { setPanelMin('log', !!localStorage.getItem('grz-logmin')); setPanelMin('deck', !!localStorage.getItem('grz-deckmin')); } catch(e){}
$('#b-menu').onclick = () => { if (confirm('Выйти из боя в главное меню?')) toMenu(); };

function showRound(){
  if (APP.roundShown) return; APP.roundShown = true;
  const v = APP.view, r0 = v.rr && v.rr[0]; if (!r0) return;
  const me = APP.side0, op = other(me), nx = other(me);
  $('#round-body').innerHTML = `<h2>Этап 1 окончен</h2><p class="why">${r0.res.reason}. ${r0.res.winner ? (r0.res.winner === me ? 'Этап за вами.' : 'Этап за соперником.') : 'Ничья.'}</p>
    <table><tr><th></th><th>Очки</th><th>Погибло бойцов</th><th>Потеряно машин</th></tr>
    <tr><th>Вы, ${SIDE_NAME[me]}</th><td>${r0[me].s}</td><td>${r0[me].lm}</td><td>${r0[me].lvh}</td></tr>
    <tr><th>Соперник, ${SIDE_NAME[op]}</th><td>${r0[op].s}</td><td>${r0[op].lm}</td><td>${r0[op].lvh}</td></tr></table>
    <p>Через <b id="round-t">15</b> с стороны поменяются. Во втором этапе вы — <b>${SIDE_NAME[nx]}</b>, у вас ${roleOf(nx)}. Разрушения, воронки и павшие останутся на своих местах${v.rounds === 2 && APP.opts.tod === 'daynight' ? ', а бой пойдёт ночью' : ''}.</p>`;
  $('#round').hidden = false;
}
function showEnd(){
  if (!$('#end').hidden) return;
  $('#round').hidden = true;
  const v = APP.view, r = v.res || {}, me = APP.side0, F = v.sides.fed, C = v.sides.chr;
  const title = r.winner === me ? 'Победа' : r.winner ? 'Поражение' : 'Ничья';
  addLog('Бой окончен: ' + title.toLowerCase() + '. ' + (r.reason || ''), 'sys');
  const row = (n, s) => `<tr><th>${n}</th><td>${s.s}</td><td>${s.lm}</td><td>${s.lvh}</td><td>${s.ck || 0}</td></tr>`;
  let table;
  if (r.two && v.rr && v.rr.length === 2){
    const op = other(me), a = v.rr[0], b = v.rr[1];
    table = `<table><tr><th></th><th>Вы</th><th>Соперник</th></tr>
      <tr><th>Этап 1: вы — ${SIDE_NAME[me]}, ${roleOf(me)}</th><td>${a[me].s}</td><td>${a[op].s}</td></tr>
      <tr><th>Этап 2: вы — ${SIDE_NAME[op]}, ${roleOf(op)}</th><td>${b[op].s}</td><td>${b[me].s}</td></tr>
      <tr><th>Итого очков</th><td><b>${r.totals[me]}</b></td><td><b>${r.totals[op]}</b></td></tr>
      <tr><th>Погибло бойцов</th><td>${a[me].lm + b[op].lm}</td><td>${a[op].lm + b[me].lm}</td></tr>
      <tr><th>Потеряно машин</th><td>${a[me].lvh + b[op].lvh}</td><td>${a[op].lvh + b[me].lvh}</td></tr>
      <tr><th>Мирных погибло от огня</th><td>${a[me].ck + b[op].ck}</td><td>${a[op].ck + b[me].ck}</td></tr></table>`;
  } else table = `<table><tr><th></th><th>Очки</th><th>Погибло бойцов</th><th>Потеряно машин</th><th>Мирных погибло от огня</th></tr>${row(SIDE_NAME.fed, F)}${row(SIDE_NAME.chr, C)}</table>`;
  $('#end-body').innerHTML = `<h2>${title}</h2><p class="why">${r.reason || ''}</p>
    ${table}
    <p>Погибло мирных жителей: <b>${v.civDead || 0}</b>. Вышли из зоны боёв: <b>${v.civEvac || 0}</b>. Разрушено зданий: <b>${v.bldDown || 0}</b>, попаданий по жилым домам: <b>${v.bh}</b>.</p>
    <p class="hist">${APP.sc.id === 'yar96' ? 'Горная война 1995–1996 годов шла среди сёл, где жили мирные люди.' : 'По подсчётам «Мемориала», с декабря 1994 по март 1995 года в Грозном погибли от 25 до 29 тысяч жителей. Большинство из них стали жертвами обстрелов и бомбардировок.'}</p>
    <p class="hist">${APP.sc.history}</p>`;
  $('#end-lobby').hidden = APP.mode === 'solo' || APP.mode === 'guest';
  $('#end-wait').hidden = APP.mode !== 'guest';
  $('#end').hidden = false;
}
$('#end-menu').onclick = () => toMenu();
$('#end-map').onclick = () => { $('#end').hidden = true; toast('Итоги откроются снова кнопкой «Итоги»', 2500); $('#b-res').hidden = false; };
$('#b-res').onclick = () => { $('#end').hidden = false; $('#b-res').hidden = true; };
$('#end-lobby').onclick = () => { stopGame(); const L = APP.lobby; L.players = L.players.filter(p => p.pid === 1 || NET.conns.has(p.pid)); showScreen('lobby'); renderLobby(); sendLobby(); setLobbyStatus(L.players.length > 1 ? 'Игроки в лобби. Можно начинать новый бой.' : 'Ждём игроков.'); };
function toMenu(){ stopGame(); netClose(); APP.mode = null; showScreen('main'); }

/* ---------- Меню ---------- */
function showScreen(id){ $('#menu').hidden = false; $('#b-res').hidden = true; document.querySelectorAll('.screen').forEach(s => s.hidden = s.id !== 's-' + id); }
function hideMenu(){ $('#menu').hidden = true; }
function setLobbyStatus(t){ $('#l-status').textContent = t; }
function setJoinStatus(t){ $('#j-status').textContent = t; }
function renderLobby(){
  const L = APP.lobby, m = APP.mode, iAmHost = m === 'host' || m === 'solo';
  $('#l-title').textContent = m === 'solo' ? 'Бой против бота' : m === 'host' ? 'Ваше лобби' : 'Лобби друга';
  $('#l-code-wrap').hidden = m !== 'host';
  $('#l-code').textContent = L.code || '';
  if (m === 'solo') L.players = [{ pid:1, name:myName(), side:L.hostSide || 'chr' }];
  L.players = L.players || [];
  const me0 = L.players.find(p => p.pid === (m === 'guest' ? APP.pid : 1)), mySide = me0 ? me0.side : (L.hostSide || 'chr');
  const list = $('#l-scn'); list.innerHTML = '';
  for (const k of Object.keys(SCEN)){
    const s = SCEN[k], b = document.createElement('button');
    b.className = 'scn' + (L.scn === k ? ' on' : ''); b.disabled = !iAmHost && L.scn !== k;
    b.innerHTML = `<b>${s.title}</b><span>${s.date}, ${s.place}</span>`;
    b.onclick = () => { if (!iAmHost) return; L.scn = k; renderLobby(); sendLobby(); };
    list.appendChild(b);
  }
  const s = SCEN[L.scn];
  $('#l-brief').innerHTML = `<h3>${s.title}</h3><p class="meta">${s.date}. ${s.place}</p><p>${s.history}</p>
    <h4>Задача: ${SIDE_NAME[mySide]}</h4><p>${s.goals[mySide]}</p><p class="meta">Бой ${Math.round(s.duration/60)} мин, расстановка ${s.deployTime} с, победа при ${s.target} очках. За каждого мирного жителя, погибшего от вашего огня, снимается ${CIV_PEN} очка.</p>`;
  for (const sd of SIDES){
    const b = $('#l-side-' + sd), names = L.players.filter(p => p.side === sd).map(p => (p.pid === (m === 'guest' ? APP.pid : 1) ? 'вы' : p.name));
    const cap = m === 'solo' ? 1 : perSide();
    b.classList.toggle('on', sd === mySide);
    b.querySelector('span').textContent = m === 'solo' ? (sd === mySide ? 'вы' : 'бот') : (names.length ? names.join(', ') : 'свободно') + (cap > 1 ? ' (' + names.length + '/' + cap + ')' : '');
    b.onclick = () => {
      if (m === 'guest'){ netSend({ t:'side', side:sd }); }
      else if (m === 'solo'){ L.hostSide = sd; renderLobby(); }
      else { L.hostSide = sd; setPlayerSide(1, sd); }
    };
  }
  for (const b of document.querySelectorAll('#o-mode button')){
    b.classList.toggle('on', (L.mode || '1v1') === b.dataset.v); b.disabled = m !== 'host' && (L.mode || '1v1') !== b.dataset.v;
    b.onclick = () => {
      if (m !== 'host') return;
      if (b.dataset.v === '1v1' && L.players.length > 2){ toast('В лобби больше двух игроков'); return; }
      L.mode = b.dataset.v;
      if (L.mode === '1v1' && L.players[1]) L.players[1].side = other(L.players[0].side);
      renderLobby(); sendLobby();
    };
  }
  $('#o-mode-wrap').hidden = m === 'solo';
  const nm = $('#l-name'); if (document.activeElement !== nm) nm.value = APP.name || '';
  for (const [id, key] of [['#o-rounds', 'rounds'], ['#o-tod', 'tod']]){
    for (const b of document.querySelectorAll(id + ' button')){
      const val = key === 'rounds' ? +b.dataset.v : b.dataset.v;
      b.classList.toggle('on', L[key] === val); b.disabled = !iAmHost && L[key] !== val;
      b.onclick = () => { if (!iAmHost) return; L[key] = val; renderLobby(); sendLobby(); };
    }
  }
  $('#o-note').textContent = (s.winter ? 'Зима: снег, колёсная техника вне дорог медленнее. ' : '') + (L.rounds === 2 ? 'Во втором этапе игроки меняются сторонами, город остаётся разрушенным. Побеждает сумма очков.' : '');
  const start = $('#l-start');
  const ok = m === 'solo' || (L.mode === '2v2' ? sideCount('fed') >= 1 && sideCount('chr') >= 1 && L.players.length >= 2 : L.players.length === 2);
  start.hidden = m === 'guest'; start.disabled = m === 'host' && !ok;
  start.textContent = m === 'host' && !ok ? (L.mode === '2v2' ? 'Нужен хотя бы один игрок на каждой стороне' : 'Ждём соперника') : 'Начать бой';
}
$('#l-start').onclick = () => {
  const L = APP.lobby, seed = Math.floor(Math.random()*1e6);
  const opts = { rounds:L.rounds, tod:L.tod };
  if (APP.mode === 'solo'){ startGame('solo', L.scn, seed, L.hostSide || 'chr', opts, 1, [{ pid:1, name:myName(), side:L.hostSide || 'chr' }]); return; }
  if (!netOpen()){ setLobbyStatus('Никто не подключён.'); return; }
  for (const pl of L.players){ if (pl.pid === 1) continue; const c = NET.conns.get(pl.pid); if (c && c.open) c.send({ t:'start', scn:L.scn, seed, side:pl.side, pid:pl.pid, opts, players:L.players }); }
  startGame('host', L.scn, seed, L.players[0].side, opts, 1, L.players);
};
$('#l-copy').onclick = async () => { try { await navigator.clipboard.writeText(APP.lobby.code); toast('Код скопирован'); } catch(e){ toast('Не удалось скопировать, перепишите код вручную'); } };
$('#l-back').onclick = () => toMenu();
$('#l-name').addEventListener('change', e => {
  APP.name = e.target.value.trim().slice(0, 24); try { localStorage.setItem('grz-name', APP.name); } catch(err){}
  if (APP.mode === 'host'){ const me0 = APP.lobby.players.find(p => p.pid === 1); if (me0){ me0.name = myName(); sendLobby(); renderLobby(); } }
  else if (APP.mode === 'guest') netSend({ t:'name', name:myName() });
});
$('#l-name').addEventListener('keydown', e => e.stopPropagation());
$('#m-host').onclick = () => hostLobby();
$('#m-join').onclick = () => { showScreen('join'); setJoinStatus(''); setTimeout(() => $('#j-code').focus(), 30); };
$('#m-solo').onclick = () => { netClose(); APP.mode = 'solo'; showScreen('lobby'); renderLobby(); setLobbyStatus('Бот займёт вторую сторону.'); };
$('#m-help').onclick = () => showScreen('help');
$('#j-go').onclick = () => joinLobby($('#j-code').value);
$('#j-code').addEventListener('keydown', e => { if (e.key === 'Enter') joinLobby($('#j-code').value); });
$('#j-back').onclick = () => toMenu();
$('#h-back').onclick = () => showScreen('main');


/* ---------- Музыка: плейлисты сторон ---------- */
const MUS = { db:null, tracks:[], audio:new Audio(), side:'fed', tab:'fed', cur:null, url:null, vol:.5, auto:true, shuffle:false };
MUS.audio.preload = 'auto';
try { const st = JSON.parse(localStorage.getItem('grz-music-set') || '{}'); if (st.vol !== undefined) MUS.vol = st.vol; if (st.auto !== undefined) MUS.auto = st.auto; if (st.shuffle !== undefined) MUS.shuffle = st.shuffle; } catch(e){}
const musSave = () => { try { localStorage.setItem('grz-music-set', JSON.stringify({ vol:MUS.vol, auto:MUS.auto, shuffle:MUS.shuffle })); } catch(e){} };
function musDb(){
  return new Promise((res, rej) => {
    if (MUS.db) return res(MUS.db);
    if (!window.indexedDB) return rej(new Error('no idb'));
    const r = indexedDB.open('grz-music', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('tracks', { keyPath:'id' });
    r.onsuccess = () => { MUS.db = r.result; res(MUS.db); }; r.onerror = () => rej(r.error);
  });
}
async function musLoad(){
  try { const db = await musDb(); const req = db.transaction('tracks', 'readonly').objectStore('tracks').getAll();
    req.onsuccess = () => { MUS.tracks = req.result.sort((a, b) => a.order - b.order); renderMusic(); };
  } catch(e){ MUS.noDb = true; renderMusic(); }
}
async function musPut(t){ try { const db = await musDb(); db.transaction('tracks', 'readwrite').objectStore('tracks').put(t); } catch(e){} }
async function musDel(id){ try { const db = await musDb(); db.transaction('tracks', 'readwrite').objectStore('tracks').delete(id); } catch(e){} }
const musList = side => MUS.tracks.filter(t => t.side === side);
function musPlay(t){
  if (!t) return;
  if (MUS.url){ URL.revokeObjectURL(MUS.url); MUS.url = null; }
  if (t.blob){ MUS.url = URL.createObjectURL(t.blob); MUS.audio.src = MUS.url; } else MUS.audio.src = t.url;
  MUS.cur = t.id; MUS.audio.volume = MUS.vol;
  MUS.audio.play().then(() => renderMusic()).catch(() => { renderMusic(); musNote('Не удалось включить «' + t.name + '». Проверьте файл или ссылку.'); });
  if ('mediaSession' in navigator){ try { navigator.mediaSession.metadata = new MediaMetadata({ title:t.name, artist:SIDE_NAME[t.side] }); } catch(e){} }
  renderMusic();
}
function musNext(dir = 1){
  const list = musList(MUS.side); if (!list.length){ musNote('В плейлисте «' + SIDE_NAME[MUS.side] + '» пока нет треков.'); return; }
  let i = list.findIndex(t => t.id === MUS.cur);
  if (MUS.shuffle && list.length > 1){ let j; do j = Math.floor(Math.random()*list.length); while (j === i); i = j; }
  else i = i < 0 ? 0 : (i + dir + list.length) % list.length;
  musPlay(list[i]);
}
function musToggle(){
  if (!MUS.cur || !musList(MUS.side).some(t => t.id === MUS.cur)){ musNext(0); return; }
  if (MUS.audio.paused) MUS.audio.play().catch(() => {}); else MUS.audio.pause();
  renderMusic();
}
function musSetSide(side){
  MUS.side = side; MUS.tab = side;
  const list = musList(side), curOk = list.some(t => t.id === MUS.cur);
  if (MUS.auto && list.length && !(curOk && !MUS.audio.paused)) musPlay(MUS.shuffle ? list[Math.floor(Math.random()*list.length)] : list[0]);
  else if (!curOk && MUS.cur && !MUS.audio.paused) MUS.audio.pause();
  renderMusic();
}
MUS.audio.addEventListener('ended', () => musNext(1));
MUS.audio.addEventListener('error', () => { if (MUS.cur) musNote('Трек не воспроизводится, переключаю на следующий.'); setTimeout(() => musNext(1), 400); });
MUS.audio.addEventListener('play', () => renderMusic()); MUS.audio.addEventListener('pause', () => renderMusic());
if ('mediaSession' in navigator){ try {
  navigator.mediaSession.setActionHandler('nexttrack', () => musNext(1)); navigator.mediaSession.setActionHandler('previoustrack', () => musNext(-1));
  navigator.mediaSession.setActionHandler('play', () => musToggle()); navigator.mediaSession.setActionHandler('pause', () => musToggle());
} catch(e){} }
function musNote(t){ const n = $('#mu-note'); if (n){ n.textContent = t; clearTimeout(musNote.tm); musNote.tm = setTimeout(() => n.textContent = '', 5000); } }
function renderMusic(){
  const cur = MUS.tracks.find(t => t.id === MUS.cur), playing = cur && !MUS.audio.paused;
  const now = $('#mu-now'); if (now){ now.hidden = !cur; now.textContent = (playing ? '♪ ' : '❚❚ ') + (cur ? cur.name : ''); }
  const bm = $('#b-music'); if (bm) bm.classList.toggle('on', !!playing);
  const box = $('#mu-list'); if (!box) return;
  document.querySelectorAll('#music .tabs button').forEach(b => b.classList.toggle('on', b.dataset.s === MUS.tab));
  const list = musList(MUS.tab); box.innerHTML = '';
  if (!list.length){ const p = document.createElement('p'); p.className = 'meta'; p.textContent = 'Плейлист пуст. Добавьте свои аудиофайлы или прямые ссылки на них.'; box.appendChild(p); }
  list.forEach((t, i) => {
    const row = document.createElement('div'); row.className = 'mu-row' + (t.id === MUS.cur ? ' cur' : '');
    const nm = document.createElement('button'); nm.className = 'mu-name'; nm.textContent = (t.id === MUS.cur && playing ? '♪ ' : '') + t.name; nm.title = 'Включить';
    nm.onclick = () => { MUS.side = t.side; musPlay(t); };
    const up = document.createElement('button'); up.textContent = '↑'; up.title = 'Выше'; up.disabled = i === 0;
    up.onclick = () => { const o = list[i-1].order; list[i-1].order = t.order; t.order = o; musPut(t); musPut(list[i-1]); MUS.tracks.sort((a, b) => a.order - b.order); renderMusic(); };
    const del = document.createElement('button'); del.textContent = '×'; del.title = 'Убрать из плейлиста';
    del.onclick = () => { if (t.id === MUS.cur){ MUS.audio.pause(); MUS.cur = null; } MUS.tracks = MUS.tracks.filter(x => x !== t); musDel(t.id); renderMusic(); };
    row.append(nm, up, del); box.appendChild(row);
  });
  $('#mu-play').textContent = playing ? 'Пауза' : 'Играть';
  $('#mu-shuf').classList.toggle('on', MUS.shuffle);
  $('#mu-auto').checked = MUS.auto; $('#mu-vol').value = Math.round(MUS.vol*100);
  $('#mu-side').textContent = 'Сейчас играет плейлист: ' + SIDE_NAME[MUS.side];
  if (MUS.noDb) $('#mu-store').textContent = 'Браузер не даёт сохранить файлы: после перезагрузки их нужно будет добавить снова.';
}
function musAddFiles(files){
  let o = Date.now();
  for (const f of files){
    if (!f.type.startsWith('audio/') && !/\.(mp3|ogg|wav|m4a|aac|flac|opus|webm)$/i.test(f.name)) continue;
    const t = { id:'t' + o + Math.random().toString(36).slice(2, 6), side:MUS.tab, name:f.name.replace(/\.[^.]+$/, ''), blob:f, order:o++ };
    MUS.tracks.push(t); musPut(t);
  }
  renderMusic();
}
function musAddUrl(u){
  u = (u || '').trim(); if (!/^https?:\/\//i.test(u)){ musNote('Нужна ссылка, которая начинается с http:// или https://'); return; }
  let name = decodeURIComponent(u.split('/').pop().split('?')[0] || 'Трек').replace(/\.[^.]+$/, '') || 'Трек';
  const t = { id:'u' + Date.now(), side:MUS.tab, name, url:u, order:Date.now() }; MUS.tracks.push(t); musPut(t); renderMusic();
}
function openMusic(){ $('#music').hidden = !$('#music').hidden; if (!$('#music').hidden){ MUS.tab = MUS.side; renderMusic(); } }
document.querySelectorAll('#music .tabs button').forEach(b => b.onclick = () => { MUS.tab = b.dataset.s; renderMusic(); });
$('#mu-file').addEventListener('change', e => { musAddFiles(e.target.files); e.target.value = ''; });
$('#mu-addurl').onclick = () => { musAddUrl($('#mu-url').value); $('#mu-url').value = ''; };
$('#mu-url').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') $('#mu-addurl').click(); });
$('#mu-play').onclick = () => { if (MUS.tab !== MUS.side){ MUS.side = MUS.tab; MUS.cur = null; } musToggle(); };
$('#mu-next').onclick = () => { MUS.side = MUS.tab; musNext(1); };
$('#mu-prev').onclick = () => { MUS.side = MUS.tab; musNext(-1); };
$('#mu-shuf').onclick = () => { MUS.shuffle = !MUS.shuffle; musSave(); renderMusic(); };
$('#mu-auto').onchange = e => { MUS.auto = e.target.checked; musSave(); };
$('#mu-vol').addEventListener('input', e => { MUS.vol = e.target.value/100; MUS.audio.volume = MUS.vol; musSave(); });
$('#mu-close').onclick = () => { $('#music').hidden = true; };
$('#b-music').onclick = openMusic; $('#m-music').onclick = openMusic; $('#mu-now').onclick = openMusic;
musLoad();

/* ---------- Патчноут из коммитов GitHub ---------- */
const PATCH_FALLBACK = { date:'2026-09-25', title:'Разрушенные дома, КШМ, миномёт ВС ЧРИ', notes:[
  'У КШМ Р-145БМ своя модель с антеннами, её легко отличить от БТР-80',
  'Обрушенная часть дома показывает перекрытия и комнаты, на месте рухнувших клеток — груды обломков',
  'Миномёт ВС ЧРИ: два налёта подряд, потом перезарядка' ] };
function patchRepo(){
  const r = (window.GAME_REPO || '').trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/, '').replace(/\/+$/, '');
  if (/^[\w.-]+\/[\w.-]+$/.test(r)) return r;
  const m = location.hostname.match(/^([\w-]+)\.github\.io$/i);
  if (!m) return null;
  const seg = location.pathname.split('/').filter(Boolean)[0];
  return m[1] + '/' + (seg && !/\.html?$/i.test(seg) ? seg : m[1] + '.github.io');
}
const fmtDate = iso => { try { return new Date(iso).toLocaleDateString('ru-RU', { day:'numeric', month:'long', year:'numeric' }); } catch(e){ return iso; } };
function patchEntry(title, date, notes, url){
  const d = document.createElement('div');
  const t = document.createElement('time'); t.textContent = fmtDate(date); d.appendChild(t);
  const h = document.createElement('h4'); h.textContent = title; d.appendChild(h);
  if (notes.length){ const ul = document.createElement('ul'); for (const n of notes){ const li = document.createElement('li'); li.textContent = n; ul.appendChild(li); } d.appendChild(ul); }
  if (url){ const a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'Коммит на GitHub'; a.style.fontSize = '13px'; d.appendChild(a); }
  return d;
}
function parseCommit(msg){
  const lines = (msg || '').split(/\r?\n/).map(s => s.trim());
  const title = lines.shift() || 'Обновление';
  const notes = lines.filter(Boolean).map(s => s.replace(/^[-*•–]\s*/, ''));
  return { title, notes };
}
function renderPatch(list, note){
  const box = $('#patch-body'); box.innerHTML = '';
  if (!list.length){ box.textContent = note || 'Обновлений пока нет.'; return; }
  const [first, ...rest] = list;
  box.appendChild(patchEntry(first.title, first.date, first.notes, first.url));
  if (rest.length){
    const det = document.createElement('details'); det.className = 'older';
    const sm = document.createElement('summary'); sm.textContent = 'Предыдущие обновления'; det.appendChild(sm);
    for (const e of rest) det.appendChild(patchEntry(e.title, e.date, e.notes, e.url));
    box.appendChild(det);
  }
  if (note){ const p = document.createElement('p'); p.className = 'meta'; p.style.fontSize = '13px'; p.textContent = note; box.appendChild(p); }
}
async function loadPatch(force){
  const repo = patchRepo();
  if (!repo){
    renderPatch([{ ...PATCH_FALLBACK, url:null }], 'Чтобы здесь показывались коммиты, впишите репозиторий в GAME_REPO в начале index.html.');
    return;
  }
  const key = 'grz-patch:' + repo + ':' + (window.GAME_FILE || '');
  let cached = null; try { cached = JSON.parse(localStorage.getItem(key) || 'null'); } catch(e){}
  if (cached && !force && Date.now() - cached.t < 10*60*1000){ renderPatch(cached.list); return; }
  if (cached) renderPatch(cached.list, 'Проверяем обновления…');
  const q = new URLSearchParams({ per_page:'6' });
  if (window.GAME_FILE) q.set('path', window.GAME_FILE);
  if (window.GAME_BRANCH) q.set('sha', window.GAME_BRANCH);
  try {
    const r = await fetch('https://api.github.com/repos/' + repo + '/commits?' + q, { headers:{ Accept:'application/vnd.github+json' } });
    if (!r.ok){
      const why = r.status === 404 ? 'репозиторий не найден или он приватный' : r.status === 403 ? 'GitHub временно ограничил запросы, попробуйте через час' : 'ошибка ' + r.status;
      if (cached) renderPatch(cached.list, 'Не удалось обновить: ' + why + '.'); else renderPatch([], 'Не удалось загрузить патчноут: ' + why + '.');
      return;
    }
    const data = await r.json();
    const list = data.map(c => { const p = parseCommit(c.commit && c.commit.message); return { title:p.title, notes:p.notes, date:(c.commit.committer || c.commit.author).date, url:c.html_url }; });
    try { localStorage.setItem(key, JSON.stringify({ t:Date.now(), list })); } catch(e){}
    renderPatch(list);
  } catch(e){
    if (cached) renderPatch(cached.list, 'Нет связи с GitHub, показана сохранённая версия.'); else renderPatch([{ ...PATCH_FALLBACK, url:null }], 'Нет связи с GitHub.');
  }
}
$('#patch-refresh').onclick = () => loadPatch(true);
loadPatch(false);

showScreen('main');
setLogFilter('all');
requestAnimationFrame(frame);
