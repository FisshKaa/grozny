/* ================= ГРАФИКА ================= */
const REL = { own:'#4fb3ff', ownD:'#1f5f99', ownF:'#b9dcf7', en:'#ff4d3d', enD:'#8f1f16', enF:'#f7b3aa', sel:'#f2d36b' };
const hr = (i, k) => { let h = (i*374761393 + k*668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0)/4294967296; };

/* ---------- Клетки карты ---------- */
const BASE = { [T.OPEN]:'#c7c8a9', [T.ROAD]:'#e4dcbc', [T.BLD]:'#8b8571', [T.FOREST]:'#9cab84', [T.WATER]:'#7d9db0', [T.BRIDGE]:'#dcd3b1',
  [T.RAIL]:'#bdb8a0', [T.ROCK]:'#a39b8b', [T.YARD]:'#bfc0a2', [T.RUBBLE]:'#958c79', [T.BARR]:'#bfc0a2' };
const BASE_W = { [T.OPEN]:'#e4e7e5', [T.ROAD]:'#aaa79f', [T.BLD]:'#d3d6d5', [T.FOREST]:'#dde2de', [T.WATER]:'#5d7785', [T.BRIDGE]:'#9e9a90',
  [T.RAIL]:'#c9cac6', [T.ROCK]:'#c2c3bf', [T.YARD]:'#d9dcda', [T.RUBBLE]:'#b3aea4', [T.BARR]:'#d9dcda' };
function drawCell(x, map, i){
  const W = map.W, H = map.H, t = map.t, X = i % W, Y = Math.floor(i/W), px = X*CELL, py = Y*CELL, v = t[i];
  const at = (dx, dy) => { const xx = X+dx, yy = Y+dy; return xx >= 0 && yy >= 0 && xx < W && yy < H ? t[yy*W+xx] : -1; };
  const wn = map.winter, B = wn ? BASE_W : BASE;
  if (v === T.BLD){
    const dmg = map.bst ? map.bst[i] : 0, res = map.res[i];
    x.fillStyle = wn ? (res ? (dmg ? '#a9aaa6' : '#d0d3d2') : (dmg ? '#8f908c' : '#b3b6b5')) : res ? (dmg ? '#77715e' : '#8b8571') : (dmg ? '#4e4839' : '#5f5848'); x.fillRect(px, py, CELL, CELL);
    x.fillStyle = 'rgba(255,255,255,.06)'; x.fillRect(px + 3, py + 3, CELL - 6, CELL - 6);
    if (dmg){
      x.fillStyle = '#3a352c';
      for (let k = 0; k < 4; k++) x.fillRect(px + 1 + hr(i, k)*15, py + 1 + hr(i, k+7)*15, 2 + hr(i, k+3)*4, 2 + hr(i, k+5)*4);
      x.strokeStyle = 'rgba(30,26,20,.7)'; x.lineWidth = 1; x.beginPath();
      x.moveTo(px + hr(i, 11)*CELL, py); x.lineTo(px + hr(i, 12)*CELL, py + CELL*.55); x.lineTo(px + hr(i, 13)*CELL, py + CELL); x.stroke();
    }
    x.strokeStyle = wn ? '#6b6e6c' : '#4c473b'; x.lineWidth = 1.2; x.beginPath();
    if (at(0,-1) !== T.BLD){ x.moveTo(px, py); x.lineTo(px + CELL, py); }
    if (at(0,1) !== T.BLD){ x.moveTo(px, py + CELL); x.lineTo(px + CELL, py + CELL); }
    if (at(-1,0) !== T.BLD){ x.moveTo(px, py); x.lineTo(px, py + CELL); }
    if (at(1,0) !== T.BLD){ x.moveTo(px + CELL, py); x.lineTo(px + CELL, py + CELL); }
    x.stroke(); return;
  }
  x.fillStyle = v === T.RUBBLE && !map.res[i] ? (wn ? '#9d988e' : '#7a7264') : B[v]; x.fillRect(px, py, CELL, CELL);
  if (v === T.FOREST) for (let k = 0; k < 3; k++){ x.fillStyle = wn ? (k % 2 ? '#3e5a44' : '#566f5b') : k % 2 ? '#8a9a74' : '#a9b791'; x.beginPath(); x.arc(px + hr(i, k)*CELL, py + hr(i, k+9)*CELL, 3 + hr(i, k+4)*4, 0, 7); x.fill(); }
  else if (v === T.ROCK){ x.strokeStyle = '#7d7668'; x.lineWidth = 1; for (let k = 4; k < CELL; k += 6){ x.beginPath(); x.moveTo(px + k, py + 2); x.lineTo(px + k - 4, py + CELL - 2); x.stroke(); } }
  else if (v === T.WATER){ x.strokeStyle = 'rgba(230,240,245,.35)'; x.lineWidth = 1; x.beginPath(); const yy = py + 8 + hr(i, 1)*4; x.moveTo(px + 3, yy); x.lineTo(px + 15, yy); x.stroke(); }
  else if (v === T.BRIDGE){ x.fillStyle = '#5c5648'; x.fillRect(px, py, 2, CELL); x.fillRect(px + CELL - 2, py, 2, CELL); }
  else if (v === T.RAIL){ x.fillStyle = '#4a4740'; x.fillRect(px, py + 8, CELL, 4); x.fillStyle = '#e9e4cf'; x.fillRect(px + (X % 2 ? 0 : 10), py + 9, 10, 2); }
  else if (v === T.BARR){
    const cols = ['#6d6a63', '#8d8a82', '#5b4a3a', '#7a3f2c', '#9a978f'];
    for (let k = 0; k < 7; k++){ x.fillStyle = cols[Math.floor(hr(i, k)*cols.length)]; const s = 4 + hr(i, k+20)*6; x.fillRect(px + 1 + hr(i, k+40)*(CELL - s - 2), py + 1 + hr(i, k+60)*(CELL - s - 2), s, s*(.5 + hr(i, k+80)*.6)); }
    x.fillStyle = '#1e1d1b'; for (let k = 0; k < 3; k++){ x.beginPath(); x.arc(px + 4 + hr(i, k+90)*12, py + 4 + hr(i, k+95)*12, 2.4, 0, 7); x.fill(); }
    x.strokeStyle = '#3a3733'; x.lineWidth = 1; x.strokeRect(px + 1.5, py + 1.5, CELL - 3, CELL - 3);
  }
  else if (v === T.RUBBLE){
    const cols = ['#a89f8a', '#6d6557', '#8a5a45', '#b9ad93', '#5a544a', '#9b7a5e'];
    for (let k = 0; k < 11; k++){ x.fillStyle = cols[Math.floor(hr(i, k)*cols.length)]; const s = 2 + hr(i, k+20)*5; x.fillRect(px + hr(i, k+40)*(CELL - s), py + hr(i, k+60)*(CELL - s), s, s*(.6 + hr(i, k+80)*.8)); }
    x.fillStyle = 'rgba(35,30,25,.45)'; for (let k = 0; k < 3; k++) x.fillRect(px + hr(i, k+90)*16, py + hr(i, k+95)*16, 3, 2);
    if (hr(i, 99) < .5){ x.strokeStyle = '#6a6254'; x.lineWidth = 2; x.beginPath(); x.moveTo(px + 2, py + hr(i, 101)*CELL); x.lineTo(px + CELL*.4, py + hr(i, 102)*CELL); x.stroke(); }
  }
  // тени от соседних зданий
  x.fillStyle = wn ? 'rgba(60,70,80,.28)' : 'rgba(40,36,28,.35)';
  if (at(-1,0) === T.BLD) x.fillRect(px, py + 3, 3, CELL - 3);
  if (at(0,-1) === T.BLD) x.fillRect(px + 3, py, CELL - 3, 3);
  if (at(-1,-1) === T.BLD && at(-1,0) !== T.BLD && at(0,-1) !== T.BLD) x.fillRect(px, py, 3, 3);
}
function drawGrid(x, w, h){
  x.strokeStyle = 'rgba(70,64,40,.28)'; x.lineWidth = 1; x.fillStyle = 'rgba(60,55,35,.6)'; x.font = '14px "PT Sans Narrow", sans-serif'; x.textAlign = 'left';
  for (let gx = 500; gx < w; gx += 500){ x.beginPath(); x.moveTo(gx, 0); x.lineTo(gx, h); x.stroke(); x.fillText(String(gx/100).padStart(2, '0'), gx + 4, 16); }
  for (let gy = 500; gy < h; gy += 500){ x.beginPath(); x.moveTo(0, gy); x.lineTo(w, gy); x.stroke(); x.fillText(String(gy/100).padStart(2, '0'), 4, gy - 4); }
}
/* ---------- Объёмные дома: стены с окнами и поднятые крыши, отдельным слоем ---------- */
const FLOOR_M = 3.1;
const bldH = (map, i) => map.t[i] === T.BLD && map.fl ? map.fl[i]*FLOOR_M : 0;
// груда обломков на месте обрушенной части дома, иногда с огрызком стены
function drawRubbleHeap(x, map, i){
  const W = map.W, X = i % W, Y = Math.floor(i/W), px = X*CELL, py = Y*CELL, fl = map.fl[i], wn = map.winter;
  const hh = FLOOR_M*(1 + Math.min(fl, 4)*.35), base = py + CELL;
  // огрызок стены у высоких домов
  if (fl >= 4 && hr(i, 71) < .45){
    const sw = 4 + hr(i, 72)*6, sx = px + hr(i, 73)*(CELL - sw), sh = fl*FLOOR_M*(.25 + hr(i, 74)*.35);
    x.fillStyle = wn ? '#9c9d99' : '#6f6958'; x.beginPath(); x.moveTo(sx, base - 2); x.lineTo(sx, base - sh);
    x.lineTo(sx + sw*.4, base - sh + 2 + hr(i, 75)*4); x.lineTo(sx + sw*.7, base - sh - 1); x.lineTo(sx + sw, base - sh + 3 + hr(i, 76)*5); x.lineTo(sx + sw, base - 2); x.closePath(); x.fill();
    x.fillStyle = '#1b1916';
    for (let f = 1; f*FLOOR_M < sh - 2; f++) x.fillRect(sx + 1, base - f*FLOOR_M - 1.6, Math.max(1.5, sw - 2), 1.3);
  }
  // сама груда: неровный гребень
  const cols = wn ? ['#b9b6ad', '#9d998f', '#c9c7c0'] : ['#8e8574', '#776f60', '#a0967f', '#8a6a52'];
  x.fillStyle = cols[0]; x.beginPath(); x.moveTo(px - 1, base);
  for (let k = 0; k <= 6; k++){ const tx = px + k*CELL/6, th = hh*(.45 + hr(i, 80 + k)*.55)*(k === 0 || k === 6 ? .4 : 1); x.lineTo(tx, base - th); }
  x.lineTo(px + CELL + 1, base); x.closePath(); x.fill();
  for (let k = 0; k < 9; k++){
    x.fillStyle = cols[Math.floor(hr(i, 90 + k)*cols.length)]; const sz = 2 + hr(i, 100 + k)*4;
    x.fillRect(px + hr(i, 110 + k)*(CELL - sz), base - hr(i, 120 + k)*hh*.8 - sz*.5, sz, sz*.7);
  }
  x.strokeStyle = '#3a342b'; x.lineWidth = .8; x.beginPath();
  for (let k = 0; k < 3; k++){ const rx = px + 3 + hr(i, 130 + k)*14, ry = base - hr(i, 133 + k)*hh*.7; x.moveTo(rx, ry); x.lineTo(rx + (hr(i, 136 + k) - .5)*6, ry - 3 - hr(i, 139 + k)*3); }
  x.stroke();
  if (wn){ x.fillStyle = 'rgba(245,247,247,.7)'; for (let k = 0; k < 4; k++) x.fillRect(px + hr(i, 150 + k)*16, base - hh*(.5 + hr(i, 154 + k)*.4), 3, 1.2); }
}
// разлом: у дома обрушилась южная часть — видны перекрытия, комнаты, арматура
function drawExposedWall(x, map, i, top, hh, px, py, fl){
  const wn = map.winter, base = py + CELL;
  x.fillStyle = wn ? '#4a4c4b' : '#35312a'; x.fillRect(px, top, CELL, hh);
  for (let f = 0; f <= fl; f++){
    const y = base - f*FLOOR_M; if (y < top - .5) break;
    const gap = hr(i, 200 + f) < .3, gx = px + hr(i, 210 + f)*12;
    x.fillStyle = wn ? '#a5a7a4' : '#8c8576';
    if (gap){ x.fillRect(px, y - .9, gx - px, .9); x.fillRect(gx + 5, y - .9, px + CELL - gx - 5, .9);
      x.strokeStyle = '#6b5a4a'; x.lineWidth = .6; x.beginPath(); x.moveTo(gx, y - .5); x.lineTo(gx + 2, y + 1.5); x.moveTo(gx + 5, y - .5); x.lineTo(gx + 3.5, y + 2); x.stroke(); }
    else x.fillRect(px, y - .9, CELL, .9);
    if (f < fl){
      x.fillStyle = 'rgba(0,0,0,.45)';
      for (let k = 0; k < 2; k++){ const wx = px + 3 + hr(i, 220 + f*3 + k)*13; x.fillRect(wx, y - FLOOR_M + .2, .8, FLOOR_M - 1.1); }
      if (hr(i, 240 + f) < .25){ x.fillStyle = wn ? '#707371' : '#5a5143'; x.fillRect(px + hr(i, 250 + f)*14, y - 1.8, 3, .9); }
    }
  }
  x.fillStyle = wn ? '#bcbdb9' : '#766e5d';
  x.beginPath(); x.moveTo(px, top); for (let k = 0; k <= 5; k++) x.lineTo(px + k*CELL/5, top + hr(i, 260 + k)*2.2); x.lineTo(px + CELL, top); x.closePath(); x.fill();
}
function drawTallCell(x, map, i){
  if (map.t[i] === T.RUBBLE && map.fl && map.fl[i] > 0){ drawRubbleHeap(x, map, i); return; }
  if (map.t[i] !== T.BLD) return;
  const W = map.W, X = i % W, Y = Math.floor(i/W), px = X*CELL, py = Y*CELL, H = bldH(map, i), wn = map.winter;
  const res = map.res[i], dmg = map.bst ? map.bst[i] : 0, fl = map.fl ? map.fl[i] : 1;
  const at = (dx, dy) => { const xx = X+dx, yy = Y+dy; return xx >= 0 && yy >= 0 && xx < W && yy < map.H ? yy*W+xx : -1; };
  const isB = j => j >= 0 && map.t[j] === T.BLD, sH = at(0, 1);
  // южная стена видна, если южнее нет такого же дома
  const exposed = sH >= 0 && map.t[sH] === T.RUBBLE && map.fl && map.fl[sH] > 0;
  if (exposed){ drawExposedWall(x, map, i, py + CELL - H, H, px, py, fl); }
  else if (!isB(sH) || bldH(map, sH) < H){
    const top = py + CELL - H, hh = isB(sH) ? H - bldH(map, sH) : H;
    const wall = wn ? (res ? '#a9aaa5' : '#8d8f8b') : res ? '#7a7463' : '#57503f';
    x.fillStyle = shade(wall, dmg ? .85 : 1); x.fillRect(px, top, CELL, hh);
    x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(px, py + CELL - 1.2, CELL, 1.2);
    for (let f = 0; f < fl; f++){
      const wy = py + CELL - (f + 1)*FLOOR_M + .7; if (wy < top) break;
      for (let k = 0; k < 4; k++){
        const broken = dmg && hr(i, f*7 + k) < .45;
        x.fillStyle = broken ? '#141210' : (wn ? '#5d666c' : '#3b3a34');
        x.fillRect(px + 1.6 + k*4.6, wy, 2.4, 1.5);
      }
    }
    if (dmg){ x.fillStyle = '#26221d'; x.fillRect(px + hr(i, 51)*12, top + hr(i, 52)*H*.6, 5 + hr(i, 53)*4, 3 + hr(i, 54)*4); }
    x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = 1;
    if (!isB(at(-1, 0))){ x.beginPath(); x.moveTo(px + .5, top); x.lineTo(px + .5, top + hh); x.stroke(); }
    if (!isB(at(1, 0))){ x.beginPath(); x.moveTo(px + CELL - .5, top); x.lineTo(px + CELL - .5, top + hh); x.stroke(); }
  }
  // крыша
  const ry = py - H;
  const roof = wn ? (res ? (dmg ? '#bfc0bc' : '#e2e5e4') : (dmg ? '#a7a9a6' : '#c6c9c8')) : res ? (dmg ? '#857f6c' : '#9a9481') : (dmg ? '#5d5647' : '#6c6452');
  x.fillStyle = roof; x.fillRect(px, ry, CELL, CELL);
  if (fl >= 5 && hr(i, 3) < .18){ x.fillStyle = shade(roof, .82); x.fillRect(px + 5, ry + 5, 7, 6); }
  if (dmg){
    x.fillStyle = '#2c2924';
    for (let k = 0; k < 4; k++) x.fillRect(px + 1 + hr(i, k)*14, ry + 1 + hr(i, k+7)*14, 2 + hr(i, k+3)*5, 2 + hr(i, k+5)*5);
    x.strokeStyle = 'rgba(30,26,20,.7)'; x.lineWidth = 1; x.beginPath(); x.moveTo(px + hr(i, 11)*CELL, ry); x.lineTo(px + hr(i, 12)*CELL, ry + CELL*.55); x.lineTo(px + hr(i, 13)*CELL, ry + CELL); x.stroke();
  }
  x.strokeStyle = wn ? '#6f7270' : '#4a4539'; x.lineWidth = 1.3; x.beginPath();
  const edge = (j) => !isB(j) || Math.abs(bldH(map, j) - H) > .5;
  if (edge(at(0, -1))){ x.moveTo(px, ry); x.lineTo(px + CELL, ry); }
  if (edge(at(0, 1))){ x.moveTo(px, ry + CELL); x.lineTo(px + CELL, ry + CELL); }
  if (edge(at(-1, 0))){ x.moveTo(px, ry); x.lineTo(px, ry + CELL); }
  if (edge(at(1, 0))){ x.moveTo(px + CELL, ry); x.lineTo(px + CELL, ry + CELL); }
  x.stroke();
}
function renderTall(c, map){
  const t = document.createElement('canvas'); t.width = c.width; t.height = c.height; const x = t.getContext('2d');
  for (let i = 0; i < map.W*map.H; i++) drawTallCell(x, map, i);
  c.tall = t;
}
function redrawTall(c, map, i){
  if (!c.tall) return;
  const x = c.tall.getContext('2d'), X = i % map.W, Y = Math.floor(i/map.W), up = Math.ceil(13*FLOOR_M/CELL);
  const x0 = Math.max(0, X-1), x1 = Math.min(map.W-1, X+1), y0 = Math.max(0, Y-1), y1 = Math.min(map.H-1, Y+1);
  const rx = x0*CELL, rw = (x1 - x0 + 1)*CELL, top = y0*CELL - up*CELL, rh = (y1 + 1)*CELL - top;
  x.save(); x.beginPath(); x.rect(rx, top, rw, rh); x.clip(); x.clearRect(rx, top, rw, rh);
  for (let yy = Math.max(0, y0 - up); yy <= Math.min(map.H - 1, y1 + up); yy++) for (let xx = x0; xx <= x1; xx++) drawTallCell(x, map, yy*map.W + xx);
  x.restore();
}
// клик по нарисованной крыше или стене — это клик по дому под ней
function pickBuilding(map, wx, wy){
  if (!map || !map.fl) return null;
  const X = Math.floor(wx/CELL); if (X < 0 || X >= map.W) return null;
  for (let Y = Math.min(map.H - 1, Math.floor((wy + 13*FLOOR_M)/CELL)); Y >= Math.max(0, Math.floor(wy/CELL) - 1); Y--){
    const i = Y*map.W + X; if (map.t[i] !== T.BLD) continue;
    const H = bldH(map, i), top = Y*CELL - H, bot = (Y + 1)*CELL;
    if (wy >= top && wy <= bot) return i;
  }
  return null;
}
function renderMapCanvas(map){
  const c = document.createElement('canvas'); c.width = map.W*CELL; c.height = map.H*CELL; const x = c.getContext('2d');
  for (let i = 0; i < map.W*map.H; i++) drawCell(x, map, i);
  drawGrid(x, c.width, c.height);
  c.decals = [];
  renderTall(c, map);
  return c;
}
function redrawAround(c, map, i){
  const x = c.getContext('2d'), X = i % map.W, Y = Math.floor(i/map.W);
  const x0 = Math.max(0, X-1), x1 = Math.min(map.W-1, X+1), y0 = Math.max(0, Y-1), y1 = Math.min(map.H-1, Y+1);
  for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++){ const j = yy*map.W + xx; if (map.t[j] !== T.BLD) drawCell(x, map, j); }
  for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++){ const j = yy*map.W + xx; if (map.t[j] === T.BLD) drawCell(x, map, j); }
  x.save(); x.beginPath(); x.rect(x0*CELL, y0*CELL, (x1-x0+1)*CELL, (y1-y0+1)*CELL); x.clip();
  drawGrid(x, c.width, c.height);
  for (const d of c.decals) if (d.x > x0*CELL - 30 && d.x < (x1+1)*CELL + 30 && d.y > y0*CELL - 30 && d.y < (y1+1)*CELL + 30) paintDecal(x, d);
  x.restore();
  redrawTall(c, map, i);
}
function paintDecal(x, d){
  if (d.k === 'crater'){
    x.fillStyle = 'rgba(176,166,140,.45)'; x.beginPath(); x.arc(d.x, d.y, d.r*1.35, 0, 7); x.fill();
    x.fillStyle = 'rgba(58,52,42,.8)'; x.beginPath(); x.arc(d.x, d.y, d.r, 0, 7); x.fill();
    x.fillStyle = 'rgba(30,27,22,.6)'; x.beginPath(); x.arc(d.x + d.r*.15, d.y + d.r*.15, d.r*.55, 0, 7); x.fill();
  } else if (d.k === 'scorch'){
    x.fillStyle = 'rgba(28,25,22,.45)'; x.beginPath(); x.arc(d.x, d.y, d.r, 0, 7); x.fill();
  } else if (d.k === 'bit'){ x.fillStyle = d.c; x.fillRect(d.x, d.y, d.r, d.r); }
  else if (d.k === 'trk'){
    const dx = d.x2 - d.x, dy = d.y2 - d.y, L = Math.hypot(dx, dy) || 1, nx = -dy/L*d.w, ny = dx/L*d.w;
    x.strokeStyle = 'rgba(120,125,125,.45)'; x.lineWidth = 1.6; x.beginPath();
    x.moveTo(d.x + nx, d.y + ny); x.lineTo(d.x2 + nx, d.y2 + ny); x.moveTo(d.x - nx, d.y - ny); x.lineTo(d.x2 - nx, d.y2 - ny); x.stroke();
  }
}
function addDecal(c, d){ c.decals.push(d); if (c.decals.length > 4000) c.decals.splice(0, 400); paintDecal(c.getContext('2d'), d); }

/* ---------- Объёмные модели (стопка вокселей) ---------- */
const VX = 4; // пикселей на воксель в заготовке
const PAL = {
  fed:  { hull:'#5a6440', light:'#737e52', dark:'#3e4530', track:'#2a2926', metal:'#4d5047', glass:'#9fb4b8', tent:'#6a6d4a', era:'#8d9563', wheel:'#232220', stripe:'#ecebe2', wood:'#8d7a52', box:'#727a52' },
  chr:  { hull:'#4d5536', light:'#646b46', dark:'#353a28', track:'#2a2926', metal:'#4d5047', glass:'#9fb4b8', tent:'#5a573e', era:'#7a8455', wheel:'#232220', stripe:'#646b46', wood:'#8d7a52', box:'#636a47' },
  burnt:{ hull:'#2d2926', light:'#3b332d', dark:'#1d1a18', track:'#181715', metal:'#42352b', glass:'#161616', tent:'#221e1a', era:'#322b25', wheel:'#141312', stripe:'#2e2925', wood:'#2a2420', box:'#2c2622' }
};
const tracks = (L, w, t, h) => [[-L, L, -w, -w+t, 0, h, 'track'], [-L, L, w-t, w, 0, h, 'track']];
const wheels = (xs, w, h) => xs.flatMap(x => [[x-1.2, x+1.2, -w, -w+1.2, 0, h, 'wheel'], [x-1.2, x+1.2, w-1.2, w, 0, h, 'wheel']]);
const truckBody = tent => [ ...wheels([-6, -3, 5], 3.3, 1.8), [-8, 8, -2.2, 2.2, .8, 1.6, 'dark'],
  [4, 8, -3, 3, 1.6, 4, 'hull'], [7.2, 8, -2.6, 2.6, 2.8, 3.6, 'glass'], [4, 7.4, -2.8, 2.8, 4, 4.5, 'light'],
  [-8, 3.6, -3.2, 3.2, 1.6, 2.5, 'hull'], ...(tent ? [[-8, 3.4, -3.1, 3.1, 2.5, 4.3, 'tent'], [-8, 3.4, -.4, .4, 4.3, 4.5, 'dark']] : [[-8, 3.6, -3.2, -2.6, 2.5, 3.2, 'dark'], [-8, 3.6, 2.6, 3.2, 2.5, 3.2, 'dark']]) ];

// Т-72 по фото: низкий корпус с длинными ящиками ЗИП на полках, круглая литая башня по центру,
// ящик на корме башни, дымовые гранатомёты, бревно самовытаскивания поперёк кормы; у Б1 — «Контакт-1»
function t72Model(b1){
  const hull = [ ...tracks(9, 4.5, 1.2, 1.8), [-8.6, 8.6, -3.3, 3.3, 0, 2, 'dark'],
    [-9, 9, -4.4, 4.4, 1.8, 2.6, 'hull'],
    // ящики ЗИП вдоль обоих бортов
    ...[[-7.6, -3.4], [-3.2, 1.2], [1.4, 5.2]].flatMap(([a, b]) => [[a, b, -4.4, -3.3, 2.6, 3.3, 'box'], [a, b, 3.3, 4.4, 2.6, 3.3, 'box'],
      [a + .5, a + .9, -4.45, -4.2, 3.3, 3.45, 'dark'], [b - .9, b - .5, 4.2, 4.45, 3.3, 3.45, 'dark']]),
    // моторное отделение: крышка, жалюзи
    [-8.8, -3.3, -3.1, 3.1, 2.6, 3, 'dark'], [-8.2, -4.2, -2.6, -.4, 3, 3.2, 'metal'], [-8.2, -4.2, .4, 2.6, 3, 3.2, 'metal'],
    [-3.2, -1.2, -3, 3, 2.6, 2.9, 'hull'],
    // бревно поперёк кормы
    [-9.9, -9, -4.6, 4.6, 2.3, 3.2, 'wood', 'e'],
    [8.3, 9, -3.6, -2.9, 2.6, 3, 'glass'], [8.3, 9, 2.9, 3.6, 2.6, 3, 'glass'] ];
  if (b1){
    // кирпичи динамической защиты на лобовом листе, в шахматном порядке
    for (let r = 0; r < 4; r++){ const x0 = 5 + r*1.0, off = (r % 2)*.8;
      for (let c = -3.7 + off; c < 3.5; c += 1.55) hull.push([x0, x0 + .85, c, Math.min(c + 1.35, 3.7), 2.6, 3.2, 'era']); }
  } else {
    hull.push([5.2, 9, -3.6, 3.6, 1.8, 2.6, 'light'], [6.2, 6.8, -3.2, 3.2, 2.6, 3.1, 'dark']);
    hull.push([-9.6, -8.3, -3.2, -.4, 2.6, 3.6, 'metal', 'e'], [-9.6, -8.3, .4, 3.2, 2.6, 3.6, 'metal', 'e']);
  }
  const tur = [ [-5.4, -3.2, -3, 2.2, .2, 1.8, 'box'], [-5.2, -3.4, -2.8, 2, 1.8, 2, 'dark'],
    [-3.7, 3.7, -3.6, 3.6, 0, 1, 'hull', 'e'], [-3.5, 3.5, -3.35, 3.35, 1, 1.8, 'hull', 'e'], [-2.9, 2.9, -2.8, 2.8, 1.8, 2.4, 'light', 'e'] ];
  if (b1){
    // блоки «Контакт-1» подковой по лбу и сверху башни
    for (let k = -5; k <= 5; k++){ const a = k*.3, cx = Math.cos(a)*3.05, cy = Math.sin(a)*3.05;
      tur.push([cx - .6, cx + .6, cy - .55, cy + .55, .4, 2, 'era']); }
    for (let k = -4; k <= 4; k++){ if (!k) continue; const a = k*.34, c2x = Math.cos(a)*1.9 + .2, c2y = Math.sin(a)*1.9; tur.push([c2x - .55, c2x + .55, c2y - .5, c2y + .5, 2.4, 2.8, 'era']); }
  } else tur.push([2, 3.2, .9, 1.9, .9, 1.8, 'metal']);
  tur.push([-.45, .45, -2.6, 2.6, 1.7, 2.4, 'stripe'],
    [-2.3, -.3, .6, 2.6, 2.4, 3.1, 'dark', 'e'], [-1.6, 1.8, 1.45, 1.75, 3.1, 3.4, 'metal'],
    [-1.6, 0, -2.3, -.7, 2.4, 2.8, 'dark', 'e'],
    // дымовые гранатомёты «Туча»
    [-1.4, .2, -4.1, -3.2, .8, 1.5, 'dark'], [-1.2, -.6, -4, -3.4, 1.5, 1.9, 'metal', 'e'], [-.5, .1, -4, -3.4, 1.5, 1.9, 'metal', 'e'],
    // шноркель на корме башни справа
    [-4.6, -1.6, 3.2, 3.8, .8, 1.3, 'metal'],
    [3.3, 15.8, -.4, .4, .9, 1.6, 'metal'], [6.8, 7.2, -.52, .52, .9, 1.6, 'dark'], [9.8, 11, -.6, .6, .9, 1.6, 'dark']);
  return { hull, tx:.2, tz:2.6, barrel:15.8, turret:tur };
}
const MODEL_DEF = {
  tank:t72Model(false),
  tank72b:t72Model(true),
  // Т-80БВ: та же литая башня, но с «подковой» блоков динамической защиты и блоками на лобовом листе, корма с решёткой ГТД
  tank80:{ hull:[ ...tracks(9.5, 4.5, 1.3, 1.8), [-9, 9, -3.2, 3.2, 0, 2, 'dark'],
      [-9.5, 9.5, -4.5, 4.5, 1.8, 2.6, 'hull'], [-1, 9.5, -4.65, -4.25, 1.1, 2.6, 'dark'], [-1, 9.5, 4.25, 4.65, 1.1, 2.6, 'dark'],
      [5.4, 9.5, -3.7, 3.7, 1.8, 2.6, 'light'],
      [5.8, 7.2, -3.6, -2.4, 2.6, 3.2, 'era'], [5.8, 7.2, -2.2, -1, 2.6, 3.2, 'era'], [5.8, 7.2, 1, 2.2, 2.6, 3.2, 'era'], [5.8, 7.2, 2.4, 3.6, 2.6, 3.2, 'era'],
      [7.4, 8.8, -3.6, -2.4, 2.6, 3.2, 'era'], [7.4, 8.8, -2.2, -1, 2.6, 3.2, 'era'], [7.4, 8.8, 1, 2.2, 2.6, 3.2, 'era'], [7.4, 8.8, 2.4, 3.6, 2.6, 3.2, 'era'],
      [-9.5, -5.2, -3.3, 3.3, 2.6, 3, 'dark'], [-9.3, -5.6, -3, 3, 3, 3.2, 'metal'], [-4.8, -3.4, -3.3, 3.3, 2.6, 3.1, 'dark'] ],
    tx:.8, tz:2.6, barrel:15.4, turret:[ [-4.2, -3, -2.2, 2.2, .3, 1.4, 'dark'],
      [-3.1, 3.1, -2.85, 2.85, 0, 1, 'hull', 'e'], [-2.9, 2.9, -2.6, 2.6, 1, 1.8, 'hull', 'e'], [-2.4, 2.4, -2.1, 2.1, 1.8, 2.4, 'light', 'e'],
      [1.9, 3.5, -2.9, -1.9, .4, 2, 'era'], [2.3, 3.7, -1.7, -.6, .4, 2, 'era'], [2.3, 3.7, .6, 1.7, .4, 2, 'era'], [1.9, 3.5, 1.9, 2.9, .4, 2, 'era'],
      [.4, 2.2, -2.4, -1.3, 2.2, 2.6, 'era'], [.4, 2.2, 1.3, 2.4, 2.2, 2.6, 'era'],
      [-.45, .45, -2.4, 2.4, 1.8, 2.4, 'stripe'],
      [-1.9, -.1, .3, 2.1, 2.4, 3.1, 'dark', 'e'], [-1.4, .1, -1.9, -.5, 2.4, 2.75, 'dark', 'e'],
      [3.7, 15.4, -.38, .38, .9, 1.6, 'metal'] ] },
  ifv:{ hull:[ ...tracks(8, 4, 1.2, 1.6), [-7.5, 7.5, -2.8, 2.8, 0, 2, 'dark'], [-8, 5, -4, 4, 1.6, 3, 'hull'], [5, 8, -3.6, 3.6, 1.2, 2.4, 'light'],
      [3.8, 5.4, -4, 4, 1.6, 2.8, 'light'], [-8, -6, -3.6, -.8, 3, 3.4, 'dark'], [-8, -6, .8, 3.6, 3, 3.4, 'dark'] ],
    tx:1, tz:3, barrel:10, turret:[ [-2.2, 2, -2, 2, 0, 1.5, 'hull'], [-1.4, 1, -1.3, 1.3, 1.5, 2.1, 'light'], [-.8, .8, -2, 2, 1.5, 1.9, 'stripe'],
      [2, 10, -.35, .35, .6, 1.3, 'metal'], [-1, 3, 2, 2.9, 1.2, 2.1, 'metal'] ] },
  cmd:{ hull:[ ...wheels([-6.5, -3, 1.5, 5], 3.5, 2), [-8.6, 7, -3, 3, 1, 3, 'hull'], [7, 9.4, -2.2, 2.2, 1, 2.3, 'light'], [9.4, 10, -1.2, 1.2, 1, 1.8, 'light'],
      [-7.6, 3.6, -2.6, 2.6, 3, 4.4, 'light'], [-7.2, 3.2, -2.2, 2.2, 4.4, 4.7, 'hull'], [3.6, 6.4, -2.4, 2.4, 3, 3.6, 'dark'],
      [-6.8, -5.2, -1.8, -.8, 4.7, 5.4, 'metal'], [-6.8, -5.2, .8, 1.8, 4.7, 5.4, 'metal'], [1.4, 2.6, -2.4, -1.4, 4.7, 5.3, 'metal'],
      [-4.4, 0, -.3, .3, 4.7, 5.1, 'dark'], [-3.2, -1.4, -2.9, 2.9, 4.7, 5, 'stripe'] ] },
  apc:{ hull:[ ...wheels([-6, -2.5, 2.5, 6], 3.6, 2), [-9, 8, -3, 3, 1, 3, 'hull'], [8, 9.3, -2.5, 2.5, 1, 2.4, 'light'],
      [-8, 6, -2.5, 2.5, 3, 3.8, 'light'], [-8.5, -7, -1.5, 1.5, 3, 3.5, 'dark'] ],
    tx:2, tz:3.8, barrel:7.5, turret:[ [-1.4, 1.4, -1.4, 1.4, 0, 1.3, 'hull'], [-.6, .6, -1.4, 1.4, .6, 1.3, 'stripe'], [1.4, 7.5, -.35, .35, .4, 1, 'metal'] ] },
  aa:{ hull:[ ...tracks(8, 4, 1.2, 1.6), [-7.5, 7.5, -2.8, 2.8, 0, 2, 'dark'], [-8, 8, -4, 4, 1.6, 3, 'hull'], [6, 8, -3.6, 3.6, 1.6, 2.6, 'light'] ],
    tx:0, tz:3, barrel:9, turret:[ [-3.5, 3.5, -3.5, 3.5, 0, 2.5, 'hull'], [-3, 3, -3, 3, 2.5, 3, 'light'], [-.8, .8, -3, 3, 2.5, 3, 'stripe'],
      [-5, -3.5, -2.6, 2.6, 1.5, 4.6, 'metal'], [-5.3, -4.7, -2.8, 2.8, 4.2, 4.8, 'dark'],
      [3.5, 9, -2.1, -1.5, 1.2, 1.8, 'metal'], [3.5, 9, -1, -.4, 1.2, 1.8, 'metal'], [3.5, 9, .4, 1, 1.2, 1.8, 'metal'], [3.5, 9, 1.5, 2.1, 1.2, 1.8, 'metal'] ] },
  truck:{ hull:truckBody(true) },
  tech:{ hull:truckBody(false), tx:-3, tz:2.5, barrel:7, turret:[ [-1.6, 1.6, -1.6, 1.6, 0, .9, 'metal'], [-1.6, -.6, -.6, .6, .9, 2.2, 'dark'],
      [1, 7, -.9, -.45, .6, 1.1, 'metal'], [1, 7, .45, .9, .6, 1.1, 'metal'], [.2, 1.6, -1.2, 1.2, .6, 1.6, 'dark'] ] }
};
const MODEL_OF = { f_t72b:'tank72b', f_cmd:'cmd', f_btr:'apc', f_bmp:'ifv', f_t72:'tank', f_t80:'tank80', f_zsu:'aa', f_ural:'truck', f_conv:'truck', c_t72:'tank', c_btr:'apc', c_zu:'tech', c_sup:'truck' };
function shade(hex, f){ const n = parseInt(hex.slice(1), 16); const r = clamp(Math.round((n >> 16)*f), 0, 255), g = clamp(Math.round(((n >> 8) & 255)*f), 0, 255), b = clamp(Math.round((n & 255)*f), 0, 255); return `rgb(${r},${g},${b})`; }
function buildStack(boxes, pal){
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z1 = 0;
  for (const b of boxes){ x0 = Math.min(x0, b[0]); x1 = Math.max(x1, b[1]); y0 = Math.min(y0, b[2]); y1 = Math.max(y1, b[3]); z1 = Math.max(z1, b[5]); }
  const nz = Math.ceil(z1*2), layers = []; // полувоксельные слои
  const w = Math.ceil((x1 - x0)*VX), h = Math.ceil((y1 - y0)*VX);
  for (let k = 0; k < nz; k++){
    const zc = (k + .5)/2, c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
    let any = false;
    for (const b of boxes){
      if (!(b[4] <= zc && zc < b[5])) continue; any = true;
      const top = zc + .5 >= b[5], f = (.62 + .38*zc/z1)*(top ? 1.12 : .92);
      x.fillStyle = shade(pal[b[6]], f);
      const rx = (b[0] - x0)*VX, ry = (b[2] - y0)*VX, rw = (b[1] - b[0])*VX, rh = (b[3] - b[2])*VX;
      if (b[7] === 'e'){
        x.beginPath(); x.ellipse(rx + rw/2, ry + rh/2, rw/2, rh/2, 0, 0, 7); x.fill();
        if (top){ x.strokeStyle = shade(pal[b[6]], f*.7); x.lineWidth = 1; x.stroke(); }
      } else {
        x.fillRect(rx, ry, rw, rh);
        if (top){ x.strokeStyle = shade(pal[b[6]], f*.7); x.lineWidth = 1; x.strokeRect(rx + .5, ry + .5, rw - 1, rh - 1); }
      }
    }
    layers.push(any ? c : null);
  }
  return { layers, x0, y0, w:x1 - x0, h:y1 - y0, z:z1 };
}
const MODEL_CACHE = {};
function getModel(key, palKey){
  const k = key + ':' + palKey; if (MODEL_CACHE[k]) return MODEL_CACHE[k];
  const d = MODEL_DEF[key], pal = PAL[palKey];
  const m = { hull:buildStack(d.hull, pal), turret:d.turret ? buildStack(d.turret, pal) : null, tx:d.tx || 0, tz:d.tz || 0, barrel:d.barrel || 0 };
  return MODEL_CACHE[k] = m;
}
const LZ = .75; // высота слоя относительно ширины вокселя
function drawStack(c, st, x, y, ang, s, zOff){
  const n = st.layers.length, step = s*LZ/2, sub = step > 1.2 ? Math.ceil(step/1.2) : 1;
  for (let k = 0; k < n; k++){
    const L = st.layers[k]; if (!L) continue;
    for (let j = 0; j < sub; j++){
      c.save(); c.translate(x, y - zOff - (k + j/sub)*step); c.rotate(ang);
      c.drawImage(L, st.x0*s, st.y0*s, st.w*s, st.h*s); c.restore();
    }
  }
}
function drawVehicle(c, key, palKey, x, y, h, ta, s, alpha){
  const m = getModel(key, palKey);
  c.globalAlpha = alpha*.35; c.fillStyle = '#000';
  c.save(); c.translate(x + s*1.4, y + s*1.4); c.rotate(h); c.fillRect(m.hull.x0*s, m.hull.y0*s, m.hull.w*s, m.hull.h*s); c.restore();
  c.globalAlpha = alpha;
  drawStack(c, m.hull, x, y, h, s, 0);
  if (m.turret){ const px = x + Math.cos(h)*m.tx*s, py = y + Math.sin(h)*m.tx*s; drawStack(c, m.turret, px, py, ta, s, m.tz*s*LZ); }
  c.globalAlpha = 1;
  return m;
}
function barrelTip(key, x, y, h, ta, s){
  const d = MODEL_DEF[key]; if (!d || !d.turret) return { x, y };
  const px = x + Math.cos(h)*(d.tx || 0)*s, py = y + Math.sin(h)*(d.tx || 0)*s;
  return { x:px + Math.cos(ta)*d.barrel*s, y:py + Math.sin(ta)*d.barrel*s - (d.tz + 1.3)*s*LZ };
}
function drawFlag(c, side, x, y, s){
  c.fillStyle = '#222'; c.fillRect(x - s*.08, y - s*3.2, s*.16, s*3.2);
  const fw = s*1.8, fh = s*1.15, fy = y - s*3.2;
  if (side === 'fed'){ c.fillStyle = '#f2f2ee'; c.fillRect(x, fy, fw, fh/3); c.fillStyle = '#2b55b3'; c.fillRect(x, fy + fh/3, fw, fh/3); c.fillStyle = '#c8322b'; c.fillRect(x, fy + 2*fh/3, fw, fh/3); }
  else { c.fillStyle = '#2e7d3a'; c.fillRect(x, fy, fw, fh); c.fillStyle = '#f2f2ee'; c.fillRect(x, fy + fh*.62, fw, fh*.12); c.fillStyle = '#c8322b'; c.fillRect(x, fy + fh*.74, fw, fh*.14); }
}

/* ---------- Пехота и мирные жители ---------- */
const UNIF = {
  fed:{ body:['#5f6647', '#666c4c', '#5a6043'], head:['#4a5236', '#4a5236', '#56603c'], legs:'#3e412e' },
  chr:{ body:['#3b3a33', '#4d4a3c', '#2f3330', '#55503f', '#46503a'], head:['#2a2a28', '#2f5a34', '#c69c7a', '#3a3a36'], legs:'#2c2b27' },
  civ:{ body:['#8a4a3a', '#c9c2ae', '#5a6a8a', '#7a6a50', '#9a8f7a', '#6b3f5a', '#a8a397'], head:['#2b2420', '#4a3a2e', '#c8c3b8', '#7a5a4a'], legs:'#3a3632' }
};
function squadSlots(id, n){
  const out = [];
  for (let i = 0; i < n; i++){ const a = i/n*Math.PI*2 + hr(id, i)*.9, r = i === 0 ? 0 : 3.2 + hr(id, i+20)*2.6; out.push([Math.cos(a)*r, Math.sin(a)*r]); }
  return out;
}
function drawMan(c, x, y, m, pal, seed, h, pinned, weapon, tube){
  c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(x + m*.4, y + m*.2, m*1, m*.55, 0, 0, 7); c.fill();
  const body = pal.body[seed % pal.body.length], head = pal.head[(seed >> 3) % pal.head.length];
  if (pinned){
    c.save(); c.translate(x, y); c.rotate(h);
    c.fillStyle = pal.legs; c.fillRect(-m*1.6, -m*.45, m*1.2, m*.9);
    c.fillStyle = body; c.fillRect(-m*.5, -m*.6, m*1.4, m*1.2);
    c.fillStyle = head; c.fillRect(m*.9, -m*.45, m*.8, m*.9);
    if (weapon){ c.strokeStyle = '#1f1f1c'; c.lineWidth = m*.28; c.beginPath(); c.moveTo(m*.6, m*.5); c.lineTo(m*2.4, m*.5); c.stroke(); }
    c.restore(); return;
  }
  c.fillStyle = pal.legs; c.fillRect(x - m*.55, y - m*.9, m*1.1, m*.95);
  c.fillStyle = shade(body, .8); c.fillRect(x - m*.75, y - m*2.1, m*1.5, m*1.3);
  c.fillStyle = body; c.fillRect(x - m*.75, y - m*2.3, m*1.5, m*.5);
  c.fillStyle = head; c.fillRect(x - m*.5, y - m*3.05, m*1, m*.85);
  if (weapon){
    const dx = Math.cos(h), dy = Math.sin(h)*.6;
    c.strokeStyle = tube ? '#4f5a38' : '#1f1f1c'; c.lineWidth = m*(tube ? .5 : .3);
    c.beginPath(); c.moveTo(x - dx*m*.4, y - m*1.7 - dy*m*.4); c.lineTo(x + dx*m*(tube ? 2 : 2.3), y - m*1.7 + dy*m*2.2); c.stroke();
  }
}

function drawBody(c, x, y, rot, pal, seed, m){
  const body = shade(pal.body[seed % pal.body.length], .72), head = shade(pal.head[(seed >> 3) % pal.head.length], .75);
  c.save(); c.translate(x, y); c.rotate(rot);
  c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(-m*1.7, -m*.5, m*3.5, m*1.2);
  c.fillStyle = shade(pal.legs, .8); c.fillRect(-m*1.6, -m*.42, m*1.25, m*.36); c.fillRect(-m*1.5, m*.08, m*1.15, m*.36);
  c.fillStyle = body; c.fillRect(-m*.45, -m*.55, m*1.35, m*1.1);
  c.fillRect(m*.2, -m*.9, m*.5, m*.35);
  c.fillStyle = head; c.fillRect(m*.95, -m*.36, m*.72, m*.72);
  c.restore();
}

/* ---------- Условные знаки (при малом масштабе) ---------- */
function drawIcon(c, x, y, s, d, own, alpha, selected){
  c.save(); c.translate(x, y); c.globalAlpha = alpha;
  const w = s*1.5, h = s;
  c.lineWidth = s*.14; c.strokeStyle = own ? REL.ownD : REL.enD; c.fillStyle = own ? REL.ownF : REL.enF;
  c.beginPath();
  if (own) c.rect(-w/2, -h/2, w, h);
  else { c.moveTo(0, -h*.8); c.lineTo(w*.55, 0); c.lineTo(0, h*.8); c.lineTo(-w*.55, 0); c.closePath(); }
  c.fill(); c.stroke();
  const iw = own ? w/2 : w*.28, ih = own ? h/2 : h*.4;
  c.lineWidth = s*.11; c.beginPath();
  const X = () => { c.moveTo(-iw, -ih); c.lineTo(iw, ih); c.moveTo(iw, -ih); c.lineTo(-iw, ih); };
  const E = (sc = 1) => { c.moveTo(iw*.62*sc, 0); c.ellipse(0, 0, iw*.62*sc, ih*.5*sc, 0, 0, 7); };
  switch (d.icon){
    case 'inf': X(); break;
    case 'recon': c.moveTo(-iw, ih); c.lineTo(iw, -ih); break;
    case 'sniper': X(); c.moveTo(iw*.28, 0); c.arc(0, 0, iw*.28, 0, 7); break;
    case 'mg': X(); c.moveTo(0, -ih); c.lineTo(0, ih); break;
    case 'armor': E(); break;
    case 'ifv': X(); E(); break;
    case 'apc': E(.8); c.moveTo(-iw*.3 + 2, ih*.8); c.arc(-iw*.3, ih*.8, 1.5, 0, 7); c.moveTo(iw*.3 + 2, ih*.8); c.arc(iw*.3, ih*.8, 1.5, 0, 7); break;
    case 'aa': c.moveTo(-iw, ih); c.quadraticCurveTo(0, -ih*.8, iw, ih); break;
    case 'eng': c.moveTo(-iw*.75, ih*.45); c.lineTo(-iw*.75, -ih*.35); c.lineTo(iw*.75, -ih*.35); c.lineTo(iw*.75, ih*.45); c.moveTo(0, -ih*.35); c.lineTo(0, ih*.45); break;
    case 'hq': c.moveTo(-w/2, h/2); c.lineTo(-w/2, h*1.3); c.moveTo(-iw*.8, -ih*.1); c.lineTo(iw*.8, -ih*.1); c.moveTo(-iw*.8, ih*.3); c.lineTo(iw*.8, ih*.3); break;
    case 'truck': c.moveTo(-iw, 0); c.lineTo(iw, 0); c.moveTo(-iw*.4 + 2, ih*.6); c.arc(-iw*.4, ih*.6, 2, 0, 7); c.moveTo(iw*.4 + 2, ih*.6); c.arc(iw*.4, ih*.6, 2, 0, 7); break;
  }
  c.stroke();
  if (selected){ c.strokeStyle = REL.sel; c.lineWidth = s*.14; c.strokeRect(-w/2 - s*.3, -h/2 - s*.3, w + s*.6, h + s*.6); }
  c.restore();
}

/* ---------- Частицы ---------- */
const PART = [];
const MAX_PART = 1600;
function part(p){ if (PART.length < MAX_PART) PART.push(p); }
function groundDebrisColor(map, x, y){
  const v = terrAt(map, x, y);
  if (v === T.BLD || v === T.RUBBLE) return ['#b5aa92', '#8a8270', '#9a6a50', '#6d6557'];
  if (v === T.ROAD || v === T.BRIDGE) return ['#5a574f', '#7c776a', '#3f3d38'];
  if (v === T.FOREST) return ['#5f6e45', '#6b5a3e', '#4a5236'];
  if (v === T.WATER) return ['#b7cad6', '#dfe8ee'];
  return ['#7a6a4e', '#8c7b5a', '#5e5240'];
}
function spawnExplosion(map, x, y, R, kind){
  const cols = groundDebrisColor(map, x, y);
  part({ k:'flash', x, y, z:0, r:14*R, life:.14, max:.14 });
  part({ k:'ring', x, y, z:0, r:4, dr:170*R, life:.35, max:.35 });
  for (let i = 0; i < 2 + 5*R; i++){ const a = Math.random()*7, v = 10 + Math.random()*25*R; part({ k:'fire', x, y, z:2, vx:Math.cos(a)*v, vy:Math.sin(a)*v*.7, vz:8 + Math.random()*16, r:4 + Math.random()*5*R, life:.35 + Math.random()*.35, max:.7 }); }
  const nd = kind === 'collapse' ? 26 : Math.round(12*R);
  for (let i = 0; i < nd; i++){ const a = Math.random()*7, v = 20 + Math.random()*55*R; part({ k:'debris', x, y, z:2, vx:Math.cos(a)*v, vy:Math.sin(a)*v, vz:25 + Math.random()*45*R, s:1 + Math.random()*2.4, c:cols[Math.floor(Math.random()*cols.length)], life:4, max:4 }); }
  if (PART.length < 900) for (let i = 0; i < 1 + 3*R; i++) part({ k:'smoke', x:x + gauss()*8*R, y:y + gauss()*8*R, z:2, vx:3 + gauss()*4, vy:gauss()*3, vz:4 + Math.random()*5, r:8 + Math.random()*8*R, dr:6 + Math.random()*4, life:3 + Math.random()*3*R, max:6*R, c:Math.random() < .5 ? 70 : 95 });
}
function spawnDust(x, y, n, big){
  for (let i = 0; i < n; i++) part({ k:'smoke', x:x + gauss()*14, y:y + gauss()*14, z:1, vx:2 + gauss()*4, vy:gauss()*3, vz:2 + Math.random()*4, r:(big ? 12 : 6) + Math.random()*8, dr:(big ? 8 : 5), life:3 + Math.random()*5, max:8, c:150, tan:1 });
}
function spawnMuzzle(x, y, ang, big){
  part({ k:'flash', x:x + Math.cos(ang)*2, y:y + Math.sin(ang)*2, z:0, r:big ? 8 : 3, life:big ? .1 : .06, max:.1 });
  if (big){ for (let i = 0; i < 3; i++) part({ k:'smoke', x:x + Math.cos(ang)*4, y:y + Math.sin(ang)*4, z:1, vx:Math.cos(ang)*8 + gauss()*3, vy:Math.sin(ang)*8 + gauss()*3, vz:2, r:5, dr:6, life:1.6, max:1.6, c:170, tan:1 }); }
}
function updateParticles(dt, onLand){
  for (let i = PART.length - 1; i >= 0; i--){
    const p = PART[i]; p.life -= dt;
    if (p.k === 'debris'){
      p.vz -= 70*dt; p.z += p.vz*dt; p.x += p.vx*dt; p.y += p.vy*dt;
      if (p.z <= 0){ if (onLand && Math.random() < .5) onLand(p); PART.splice(i, 1); continue; }
    } else if (p.k === 'smoke'){ p.x += p.vx*dt; p.y += p.vy*dt; p.z += p.vz*dt; p.r += p.dr*dt; p.vx *= .995; }
    else if (p.k === 'fire'){ p.x += p.vx*dt; p.y += p.vy*dt; p.z += p.vz*dt; p.vx *= .9; p.vy *= .9; }
    else if (p.k === 'ring'){ p.r += p.dr*dt; }
    if (p.life <= 0) PART.splice(i, 1);
  }
}
function drawParticles(c, z, layer){
  for (const p of PART){
    const a = clamp(p.life/p.max, 0, 1);
    if (layer === 'ground'){
      if (p.k === 'ring'){ c.globalAlpha = a*.6; c.strokeStyle = '#f3e7c4'; c.lineWidth = 2/z; c.beginPath(); c.arc(p.x, p.y, p.r, 0, 7); c.stroke(); }
      continue;
    }
    if (p.k === 'flash'){ c.globalAlpha = a; c.fillStyle = '#fff1b8'; c.beginPath(); c.arc(p.x, p.y - p.z, p.r*(1.2 - a*.2), 0, 7); c.fill(); c.globalAlpha = a*.6; c.fillStyle = '#ffae42'; c.beginPath(); c.arc(p.x, p.y - p.z, p.r*1.7, 0, 7); c.fill(); }
    else if (p.k === 'fire'){ c.globalAlpha = a; c.fillStyle = a > .6 ? '#ffd36b' : a > .3 ? '#ff8a2a' : '#8a3a1a'; c.beginPath(); c.arc(p.x, p.y - p.z, p.r*(.6 + a*.5), 0, 7); c.fill(); }
    else if (p.k === 'debris'){ c.globalAlpha = 1; c.fillStyle = '#0003'; c.fillRect(p.x, p.y, p.s, p.s*.6); c.fillStyle = p.c; c.fillRect(p.x, p.y - p.z, p.s, p.s); }
    else if (p.k === 'smoke'){ const g = p.c; c.globalAlpha = a*.3; c.fillStyle = p.tan ? `rgb(${g+20},${g+10},${g-15})` : `rgb(${g},${g},${g-4})`; c.beginPath(); c.arc(p.x, p.y - p.z, p.r, 0, 7); c.fill(); }
  }
  c.globalAlpha = 1;
}

/* ---------- Звук (синтез, без файлов) ---------- */
const SND = { ctx:null, on:true, vol:.55, last:{}, master:null, noise:null };
function sndInit(){
  if (SND.ctx){ if (SND.ctx.state === 'suspended') SND.ctx.resume(); return; }
  try {
    const A = window.AudioContext || window.webkitAudioContext; if (!A) return;
    SND.ctx = new A(); SND.master = SND.ctx.createGain(); SND.master.gain.value = SND.vol; SND.master.connect(SND.ctx.destination);
    const len = SND.ctx.sampleRate*2, b = SND.ctx.createBuffer(1, len, SND.ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random()*2 - 1; SND.noise = b;
  } catch(e){ SND.ctx = null; }
}
function sndNoise(dur, f0, f1, gain, type = 'lowpass', q = .7, delay = 0){
  const a = SND.ctx, t = a.currentTime + delay, src = a.createBufferSource(); src.buffer = SND.noise; src.playbackRate.value = .8 + Math.random()*.4;
  const f = a.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  const g = a.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + .006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(SND.master); src.start(t, Math.random()); src.stop(t + dur + .05);
}
function sndTone(dur, f0, f1, gain, type = 'sine', delay = 0){
  const a = SND.ctx, t = a.currentTime + delay, o = a.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = a.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + .03); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(SND.master); o.start(t); o.stop(t + dur + .05);
}
function sound(kind, vol){
  if (!SND.on || !SND.ctx || vol < .03) return;
  const now = performance.now(), gap = { pop:80, flare:200, small:35, mg:45, rocket:60, cannon:40, boom:25, whistle:120, collapse:150, hit:40 }[kind] || 30;
  if (now - (SND.last[kind] || 0) < gap) return; SND.last[kind] = now;
  const v = Math.min(1, vol);
  switch (kind){
    case 'small': sndNoise(.07, 2600, 900, .22*v, 'bandpass', 1.2); break;
    case 'mg': sndNoise(.06, 1900, 700, .26*v, 'bandpass', 1); sndNoise(.06, 1900, 700, .2*v, 'bandpass', 1, .07); break;
    case 'rocket': sndNoise(.5, 700, 2400, .22*v, 'bandpass', 2); break;
    case 'cannon': sndNoise(.7, 900, 90, .75*v); sndTone(.35, 90, 40, .5*v); break;
    case 'hit': sndNoise(.12, 3000, 1500, .18*v, 'highpass'); break;
    case 'boom': sndNoise(1.3, 700, 60, .9*v); sndTone(.6, 70, 30, .6*v); break;
    case 'bigboom': sndNoise(2, 600, 40, 1*v); sndTone(.9, 60, 25, .8*v); break;
    case 'whistle': sndTone(.9, 1500, 420, .09*v, 'sine'); break;
    case 'pop': sndNoise(.25, 600, 250, .25*v, 'bandpass', 1.5); break;
    case 'flare': sndTone(.6, 900, 1600, .05*v, 'triangle'); sndNoise(.4, 1200, 3000, .08*v, 'highpass'); break;
    case 'collapse': sndNoise(2.2, 300, 60, .7*v); sndNoise(1.5, 1200, 300, .15*v, 'bandpass', .8, .2); break;
  }
}

/* ---------- Двигатели ---------- */
const ENG_V = [];
function engVoice(){
  const a = SND.ctx, o1 = a.createOscillator(), o2 = a.createOscillator(); o1.type = 'sawtooth'; o2.type = 'square';
  const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 240; lp.Q.value = 3;
  const n = a.createBufferSource(); n.buffer = SND.noise; n.loop = true;
  const nf = a.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 160; nf.Q.value = .9;
  const ng = a.createGain(); ng.gain.value = .9;
  const cl = a.createBiquadFilter(); cl.type = 'bandpass'; cl.frequency.value = 2200; cl.Q.value = 4; const clg = a.createGain(); clg.gain.value = 0;
  const lfo = a.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 9; const lfog = a.createGain(); lfog.gain.value = 0; lfo.connect(lfog); lfog.connect(clg.gain);
  const wh = a.createOscillator(); wh.type = 'sine'; const whg = a.createGain(); whg.gain.value = 0;
  const g = a.createGain(); g.gain.value = 0;
  const o2g = a.createGain(); o2g.gain.value = .35;
  o1.connect(lp); o2.connect(o2g); o2g.connect(lp); n.connect(nf); nf.connect(ng); ng.connect(lp); lp.connect(g);
  n.connect(cl); cl.connect(clg); clg.connect(g);
  wh.connect(whg); whg.connect(g); g.connect(SND.master);
  o1.start(); o2.start(); n.start(Math.random()); wh.start(); lfo.start();
  return { o1, o2, lp, g, wh, whg, lfog, lfo, jit:Math.random()*.12 };
}
function updateEngines(list){
  if (!SND.ctx) return;
  const t = SND.ctx.currentTime;
  if (!SND.on){ for (const v of ENG_V) v.g.gain.setTargetAtTime(0, t, .1); return; }
  while (ENG_V.length < 4) ENG_V.push(engVoice());
  list.sort((a, b) => b.vol - a.vol);
  ENG_V.forEach((v, i) => {
    const u = list[i];
    if (!u || u.vol < .03){ v.g.gain.setTargetAtTime(0, t, .3); v.lfog.gain.setTargetAtTime(0, t, .2); return; }
    const d = UT[u.type], turb = u.type === 'f_t80', wheel = d.mc === 'wheel', tr = d.mc === 'track';
    const f = (wheel ? 42 : 31)*(u.moving ? 1.75 : 1)*(1 + v.jit);
    v.o1.frequency.setTargetAtTime(f, t, .35); v.o2.frequency.setTargetAtTime(f*1.5, t, .35);
    v.lp.frequency.setTargetAtTime(u.moving ? 460 : 230, t, .35);
    v.whg.gain.setTargetAtTime(turb ? (u.moving ? .018 : .01) : 0, t, .3); v.wh.frequency.setTargetAtTime(turb ? (u.moving ? 1350 : 950) : 120, t, .5);
    v.lfog.gain.setTargetAtTime(tr && u.moving ? .05 : 0, t, .2); v.lfo.frequency.setTargetAtTime(tr ? 7 + v.jit*20 : 9, t, .3);
    v.g.gain.setTargetAtTime(u.vol*(u.moving ? .085 : .035), t, .25);
  });
}
