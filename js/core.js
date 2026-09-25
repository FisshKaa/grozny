'use strict';
/* ================= БАЗОВОЕ ================= */
const CELL = 20; // метров в клетке
const T = { OPEN:0, ROAD:1, BLD:2, FOREST:3, WATER:4, BRIDGE:5, RAIL:6, ROCK:7, YARD:8, RUBBLE:9, BARR:10 };
const MOVE = {
  foot:  [1, 0.9, 1.7, 1.4, Infinity, 1, 1.05, 2.6, 1, 1.5, 2.2],
  track: [1.5, 1, Infinity, 2.6, Infinity, 1, 1.3, Infinity, 1.35, 2.2, Infinity],
  wheel: [2.1, 1, Infinity, 4.5, Infinity, 1, 1.5, Infinity, 1.7, 4, Infinity]
};
const SIDES = ['fed', 'chr'];
const SIDE_NAME = { fed: 'Федеральные силы', chr: 'ВС ЧРИ' };
const other = s => s === 'fed' ? 'chr' : 'fed';
function mulberry(seed){ let a = seed >>> 0; return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
function angDiff(a, b){ let d = a - b; while (d > Math.PI) d -= 2*Math.PI; while (d < -Math.PI) d += 2*Math.PI; return d; }
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;

/* ================= ВООРУЖЕНИЕ ================= */
// r — дальность, м; rof — перезарядка, с; di — урон по пехоте; dv — урон по технике при пробитии; pen — бронепробитие, мм
const WP = {
  ak:   { n:'АК-74', r:220, rof:1, acc:.34, di:5, dv:0, pen:2, supp:6, k:'small' },
  akm:  { n:'АКМ', r:210, rof:1, acc:.32, di:5.5, dv:0, pen:2, supp:6, k:'small' },
  rpk:  { n:'РПК-74', r:320, rof:1.1, acc:.28, di:7, dv:0, pen:3, supp:11, k:'mg' },
  pkm:  { n:'ПКМ', r:400, rof:1.2, acc:.3, di:9, dv:0, pen:5, supp:15, k:'mg' },
  pkt:  { n:'ПКТ', r:450, rof:1.1, acc:.3, di:8, dv:0, pen:5, supp:12, k:'mg' },
  svd:  { n:'СВД', r:620, rof:3.2, acc:.62, di:11, dv:0, pen:4, supp:22, k:'small' },
  rpg7: { n:'РПГ-7 (ПГ-7В)', r:200, rof:6, acc:.42, di:14, dv:55, pen:330, supp:22, k:'at', ammo:6 , bd:12 },
  rpg26:{ n:'РПГ-26', r:170, rof:5, acc:.4, di:12, dv:48, pen:440, supp:20, k:'at', ammo:3 , bd:10 },
  kpvt: { n:'КПВТ 14,5 мм', r:800, rof:1.5, acc:.33, di:13, dv:12, pen:32, supp:18, k:'mg', aa:true, aadmg:14 },
  a42:  { n:'2А42 30 мм', r:1200, rof:1.3, acc:.45, di:16, dv:18, pen:45, supp:22, k:'cannon', he:true, splash:8 , bd:8 },
  konk: { n:'ПТУР «Конкурс»', r:2500, rof:14, acc:.72, di:0, dv:80, pen:600, supp:30, k:'at', ammo:4, min:75, noInf:true },
  d81:  { n:'2А46 125 мм', r:2000, rof:7.5, acc:.55, di:42, dv:90, pen:450, supp:45, k:'cannon', he:true, splash:16, lowElev:true , bd:55 },
  amur: { n:'4×23 мм АЗП-23', r:1500, rof:1, acc:.4, di:26, dv:10, pen:25, supp:40, k:'mg', he:true, splash:6 , bd:6, aa:true, aadmg:22 },
  zu23: { n:'ЗУ-23-2', r:1500, rof:1.2, acc:.35, di:20, dv:8, pen:25, supp:30, k:'mg', he:true, splash:5 , bd:5, aa:true, aadmg:22 },
  borz: { n:'ПП «Борз»', r:110, rof:.7, acc:.3, di:5, dv:0, pen:1, supp:7, k:'small' },
  rpg18:{ n:'РПГ-18 «Муха»', r:135, rof:4, acc:.36, di:10, dv:45, pen:300, supp:18, k:'at', ammo:2, bd:8 },
  rpg22:{ n:'РПГ-22 «Нетто»', r:160, rof:4, acc:.38, di:11, dv:48, pen:390, supp:20, k:'at', ammo:2, bd:9 },
  gren: { n:'Гранаты Ф-1, РГД-5', r:35, rof:7, acc:.6, di:20, dv:0, pen:2, supp:40, k:'small', ammo:4, gren:true, splash:6 },
  nsv:  { n:'НСВ-12,7 «Утёс»', r:1000, rof:1.3, acc:.34, di:14, dv:12, pen:28, supp:22, k:'mg', aa:true, aadmg:14 },
  spg9: { n:'СПГ-9 «Копьё»', r:800, rof:7, acc:.5, di:22, dv:70, pen:400, supp:35, k:'at', ammo:8, splash:6, bd:22 },
  fagot:{ n:'ПТРК 9К111 «Фагот»', r:2000, rof:12, acc:.7, di:0, dv:80, pen:460, supp:30, k:'at', ammo:4, min:70, noInf:true },
  ags:  { n:'АГС-17 «Пламя»', manual:true, r:600, rof:1.4, acc:.32, di:13, dv:4, pen:8, supp:32, k:'mg', he:true, splash:8, bd:6, gl:true }
};

/* ================= ПОДРАЗДЕЛЕНИЯ ================= */
const UT = {
  f_msv:{ side:'fed', name:'Мотострелковое отделение', icon:'inf', cls:'inf', mc:'foot', men:8, hp:80, speed:4, vision:320, acc:.85, cost:25, limit:12,
    w:['ak','rpk',['rpg7',{ammo:3}],['rpg18',{ammo:2}],'gren'], desc:'Основная пехота группировки. В декабре 1994 года многие подразделения собирали наспех из срочников разных частей, без боевого слаживания.' },
  f_vdv:{ side:'fed', name:'Отделение ВДВ', icon:'inf', cls:'inf', mc:'foot', men:7, hp:70, speed:4.3, vision:340, acc:1.05, cost:35, limit:8,
    w:['ak','pkm',['rpg26',{ammo:3}],'gren'], desc:'Десантники были подготовлены лучше мотострелков и чаще действовали штурмовыми группами.' },
  f_rec:{ side:'fed', name:'Разведгруппа', icon:'recon', cls:'inf', mc:'foot', men:5, hp:50, speed:4.6, vision:460, stealth:.7, acc:1, cost:30, limit:4,
    w:['ak',['rpg26',{ammo:2}],['gren',{ammo:2}]], desc:'Видит дальше и заметна меньше обычной пехоты, но огневой мощи мало. Нужна технике как глаза.' },
  f_snp:{ side:'fed', name:'Снайперская пара', icon:'sniper', cls:'inf', mc:'foot', men:2, hp:20, speed:4, vision:500, stealth:.55, acc:1, cost:25, limit:4,
    w:['svd'], desc:'Пара с СВД. Хорошо работает по пулемётчикам и гранатомётчикам в окнах.' },
  f_btr:{ side:'fed', name:'БТР-80', icon:'apc', cls:'veh', mc:'wheel', hp:100, speed:11, vision:240, cost:40, limit:8, armor:{f:14,s:10,r:8,t:7},
    w:['kpvt','pkt'], desc:'Колёсный бронетранспортёр. Броня противопульная: РПГ пробивает его с любой стороны.' },
  f_bmp:{ side:'fed', name:'БМП-2', icon:'ifv', cls:'veh', mc:'track', hp:100, speed:10, vision:260, cost:60, limit:8, armor:{f:35,s:20,r:16,t:12},
    w:['a42','konk','pkt'], desc:'Пушка 2А42 поднимается почти вертикально и достаёт верхние этажи. Это одно из немногих средств против гранатомётчиков на крышах.' },
  f_t72:{ side:'fed', name:'Т-72А', icon:'armor', cls:'veh', mc:'track', hp:150, speed:8.5, vision:250, cost:85, limit:6, armor:{f:420,s:80,r:55,t:35}, cookoff:true,
    w:['d81','pkt'], desc:'Лоб держит РПГ-7, борта и крыша нет. Боекомплект в карусели под башней при пробитии часто детонировал. Пушке не хватает угла возвышения по верхним этажам вблизи.' },
  f_t80:{ side:'fed', name:'Т-80БВ', icon:'armor', cls:'veh', mc:'track', hp:150, speed:10.5, vision:260, cost:100, limit:4, armor:{f:520,s:95,r:55,t:35}, cookoff:true,
    w:['d81','pkt'], desc:'Танк с газотурбинным двигателем и динамической защитой. По свидетельствам участников, часть машин вошла в Грозный с незаряженными блоками ДЗ.' },
  f_zsu:{ side:'fed', name:'ЗСУ-23-4 «Шилка»', icon:'aa', cls:'veh', mc:'track', hp:80, speed:9, vision:280, cost:55, limit:3, armor:{f:15,s:12,r:10,t:8},
    w:['amur'], desc:'Счетверённые 23-мм пушки с большим углом возвышения. В Грозном «Шилки» били по огневым точкам в верхних этажах. Броня только от пуль.' },
  f_ural:{ side:'fed', name:'Урал-4320 с боеприпасами', icon:'truck', cls:'veh', mc:'wheel', hp:40, speed:11, vision:200, cost:20, limit:3, armor:{f:3,s:3,r:3,t:3}, supply:true,
    w:[], desc:'Пополняет гранаты и ПТУР у отрядов в радиусе 90 м, пока стоит на месте.' },
  f_conv:{ side:'fed', name:'Грузовик колонны', icon:'truck', cls:'veh', mc:'wheel', hp:40, speed:10, vision:200, cost:20, limit:0, armor:{f:3,s:3,r:3,t:3}, convoy:true, killVal:45,
    w:[], desc:'Машина колонны 245-го полка. Её нужно довести до восточного края ущелья.' },

  c_opl:{ side:'chr', name:'Отряд ополчения', icon:'inf', cls:'inf', mc:'foot', men:6, hp:60, speed:4.2, vision:320, acc:.8, cost:15, limit:14,
    w:['borz','akm',['rpg18',{ammo:2}],['gren',{ammo:2}]], desc:'Добровольцы. Знают город и мотивированы, но плохо вооружены и почти не обучены. У многих — пистолет-пулемёт «Борз», который делали в Грозном в 1992–1994 годах.' },
  c_rpg:{ side:'chr', name:'Гранатомётная группа', icon:'inf', cls:'inf', mc:'foot', men:4, hp:40, speed:4.4, vision:320, stealth:.85, acc:1, cost:35, limit:10,
    w:['akm','pkm',['rpg7',{ammo:8}],['rpg22',{ammo:2}],'gren'], desc:'Типичная ячейка обороны Грозного: гранатомётчики, пулемётчик и автоматчики. Бьют сверху по крышам и бортам и сразу меняют позицию.' },
  c_vet:{ side:'chr', name:'Штурмовая группа ветеранов', icon:'inf', cls:'inf', mc:'foot', men:6, hp:60, speed:4.5, vision:340, stealth:.9, acc:1.15, cost:45, limit:6,
    w:['akm','pkm',['rpg7',{ammo:5}],['rpg26',{ammo:2}],'gren'], desc:'Бойцы с опытом войны в Абхазии 1992–1993 годов. Самые подготовленные подразделения чеченской стороны.' },
  c_snp:{ side:'chr', name:'Снайперская пара', icon:'sniper', cls:'inf', mc:'foot', men:2, hp:20, speed:4, vision:500, stealth:.55, acc:1, cost:25, limit:4,
    w:['svd'], desc:'Особенно опасна для командиров и экипажей, высунувшихся из люков.' },
  c_pk:{ side:'chr', name:'Пулемётный расчёт', icon:'mg', cls:'inf', mc:'foot', men:3, hp:30, speed:4, vision:320, acc:1, cost:20, limit:6,
    w:['pkm','akm',['gren',{ammo:2}]], desc:'Расчёт ПКМ. Прижимает пехоту и отрезает её от техники.' },
  c_t72:{ side:'chr', name:'Т-72А', icon:'armor', cls:'veh', mc:'track', hp:150, speed:8.5, vision:250, acc:.9, cost:80, limit:2, armor:{f:420,s:80,r:55,t:35}, cookoff:true,
    w:['d81','pkt'], desc:'Танки остались от частей Советской армии, выведенных из Чечни в 1992 году. Их было немного.' },
  c_btr:{ side:'chr', name:'БТР-70', icon:'apc', cls:'veh', mc:'wheel', hp:90, speed:10, vision:240, acc:.9, cost:35, limit:3, armor:{f:12,s:9,r:7,t:6},
    w:['kpvt','pkt'], desc:'Бронетранспортёр из тех же советских запасов.' },
  c_zu:{ side:'chr', name:'ЗУ-23-2 на КамАЗе', icon:'aa', cls:'veh', mc:'wheel', hp:40, speed:11, vision:260, cost:40, limit:3, armor:{f:4,s:4,r:4,t:4},
    w:['zu23'], desc:'Зенитная установка на грузовике. Сильна против пехоты и лёгкой техники, но гибнет от первого попадания.' },
  c_sup:{ side:'chr', name:'КамАЗ с боеприпасами', icon:'truck', cls:'veh', mc:'wheel', hp:40, speed:11, vision:200, cost:15, limit:3, armor:{f:3,s:3,r:3,t:3}, supply:true,
    w:[], desc:'Пополняет выстрелы к РПГ у групп в радиусе 90 м, пока стоит на месте.' },
  f_t72b:{ side:'fed', name:'Т-72Б1', icon:'armor', cls:'veh', mc:'track', hp:155, speed:8.5, vision:250, cost:95, limit:6, armor:{f:520,s:90,r:55,t:40}, cookoff:true,
    w:['d81','pkt'], desc:'Т-72Б1 с навесной динамической защитой «Контакт-1» на лобовом листе и башне, ящиками ЗИП на полках и бревном самовытаскивания на корме. Такие машины воевали в Чечне в 1995–1996 годах. ДЗ держит РПГ в лоб, но борт и крыша по-прежнему уязвимы, а боекомплект в карусели детонирует.' },
  f_cmd:{ side:'fed', name:'КШМ Р-145БМ', icon:'hq', cls:'veh', mc:'wheel', hp:90, speed:10, vision:260, cost:30, limit:2, armor:{f:10,s:7,r:7,t:6}, comm:450,
    w:[], desc:'Командно-штабная машина на шасси БТР-60 с радиостанциями. Подразделения в радиусе 450 м от неё или рядом со штабом (зоной расстановки) получают приказы сразу, остальные — с задержкой через посыльных и ретрансляцию.' },
  f_ags:{ side:'fed', name:'Расчёт АГС-17 «Пламя»', icon:'gl', cls:'inf', mc:'foot', men:3, hp:30, speed:2.8, vision:320, cost:35, limit:4, gun:'ags',
    w:['ags','ak'], desc:'Автоматический гранатомёт на станке. Засыпает осколочными гранатами дворы и окна и выкуривает пехоту из домов. Расчёт со станком перемещается медленно.' },
  c_nsv:{ side:'chr', name:'Расчёт НСВ «Утёс»', icon:'hmg', cls:'inf', mc:'foot', men:3, hp:30, speed:2.6, vision:320, cost:30, limit:3, gun:'nsv',
    w:['nsv','akm'], desc:'Крупнокалиберный пулемёт 12,7 мм на станке. Прошивает лёгкую броню, а по самолётам бьёт с зенитного станка.' },
  c_spg:{ side:'chr', name:'Расчёт СПГ-9 «Копьё»', icon:'at', cls:'inf', mc:'foot', men:3, hp:30, speed:2.4, vision:320, cost:40, limit:3, gun:'spg',
    w:['spg9','akm'], desc:'Станковый противотанковый гранатомёт. Бьёт дальше РПГ, а осколочными выстрелами — по огневым точкам в домах.' },
  c_zu2:{ side:'chr', name:'ЗУ-23-2 на станке', icon:'aa', cls:'inf', mc:'foot', men:4, hp:40, speed:1.8, vision:300, cost:35, limit:2, gun:'zu',
    w:['zu23'], desc:'Спаренная 23-мм зенитная установка без грузовика. Главное средство против штурмовиков, а по пехоте и лёгкой броне она страшна не меньше.' },
  c_fag:{ side:'chr', name:'Расчёт ПТРК «Фагот»', icon:'at', cls:'inf', mc:'foot', men:2, hp:20, speed:3, vision:340, cost:45, limit:2, gun:'atgm',
    w:['fagot','akm'], desc:'Переносной противотанковый комплекс. Поражает танк с 2 км, но ближе 70 м бесполезен.' },
  f_sap:{ side:'fed', name:'Инженерно-сапёрное отделение', icon:'eng', cls:'inf', mc:'foot', men:6, hp:60, speed:4, vision:320, acc:.9, cost:30, limit:3, sapper:true,
    w:['ak',['rpg26',{ammo:1}],'gren'], desc:'Находит мины в радиусе 70 м, снимает их и разбирает баррикады. Остановите сапёров рядом с целью, дальше они работают сами.' },
  c_sap:{ side:'chr', name:'Сапёры', icon:'eng', cls:'inf', mc:'foot', men:4, hp:40, speed:4.2, vision:320, acc:.9, cost:25, limit:3, sapper:true,
    w:['akm',['rpg7',{ammo:2}]], desc:'Находят мины в радиусе 70 м, снимают их и разбирают баррикады противника.' }
};
const TK = Object.keys(UT); const TI = {}; TK.forEach((k, i) => TI[k] = i);
const SMOKE_CH = { f_t72:2, f_t72b:2, f_t80:2, c_t72:2, f_bmp:1, f_btr:1, c_btr:1 };
const CAP = { f_btr:1, f_bmp:1, c_btr:1 };
for (const k of TK){
  const d = UT[k]; d.key = k;
  d.smk = d.cls === 'inf' ? (d.icon === 'sniper' ? 0 : 1) : (SMOKE_CH[k] || 0);
  d.cap = CAP[k] || 0; d.hasGL = d.w.some(x => (typeof x === 'string' ? x : x[0]) === 'ags');
  d.weapons = d.w.map(x => typeof x === 'string' ? { ...WP[x] } : { ...WP[x[0]], ...x[1] });
  d.maxRange = d.weapons.reduce((m, w) => Math.max(m, w.r), 0);
  d.stealth = d.stealth || 1; d.acc = d.acc || 1;
}

/* Огневая поддержка */
const AB = {
  fed:{ name:'Артналёт 122 мм', cost:40, cd:90, delay:10, shells:8, scatter:55, r:24, dmg:40, pen:25, bdmg:130,
    desc:'Батарея 2С1 «Гвоздика». Снаряды ложатся через 10 секунд с большим рассеиванием и бьют по всем, включая своих.' },
  chr:{ name:'Миномёт 82 мм', charges:2, cost:20, cd:60, delay:6, shells:5, scatter:30, r:20, dmg:48, pen:32, bdmg:60,
    desc:'Мобильный миномётный расчёт: два налёта подряд, затем перезарядка. Слабее артиллерии, зато быстрее.' }
};
const AB2 = {
  fed:{ name:'Дымовые снаряды', cost:15, cd:45, delay:9, shells:4, scatter:40, r:42, life:60 },
  chr:{ name:'Дымовые мины', cost:10, cd:40, delay:6, shells:3, scatter:30, r:34, life:50 }
};
const FLARE = { name:'Осветительная ракета', cost:5, cd:20, r:260, life:30 };
const ENG = {
  barr:{ name:'Баррикада', cost:5, lim:{ fed:10, chr:16 }, desc:'Завал из бетона и машин на одну клетку. Техника не проедет, пехота пролезет медленно и получит укрытие. Разрушается фугасами, разбирается сапёрами.' },
  trap:{ name:'Растяжка в доме', cost:5, lim:{ fed:0, chr:14 }, desc:'Граната на растяжке в подъезде или комнате. Срабатывает, когда в дом заходит вражеская пехота. Противник её не видит, сапёры находят за 40 м. Можно ставить при расстановке или бойцом, который стоит в доме (клавиша L).' },
  mine:{ name:'ПТ-мина ТМ-62', cost:10, lim:{ fed:6, chr:16 }, desc:'Противник её не видит. Срабатывает под вражеской техникой: лёгкую уничтожает, танку разбивает ходовую. Пехота на ней не подрывается.' }
};
const ENG_OK = new Set([0, 1, 5, 6, 8, 9]);
const AIR = { name:'Штурмовка Су-25', cost:35, cd:120, speed:190, hp:60, bombs:6, r:30, dmg:70, pen:40, bdmg:150, kill:60 };
const engAvail = (g, side, k) => k === 'trap' ? side === 'chr' : side === g.sc.defender;
function trapOk(g, side, x, y){
  if (side !== 'chr') return false;
  const m = g.map; if (x < 0 || y < 0 || x >= m.W*CELL || y >= m.H*CELL) return false;
  const i = cellIdx(m, x, y); if (m.t[i] !== T.BLD || !m.res[i] || (g.traps || []).some(t => t.i === i)) return false;
  return g.phase !== 'deploy' || zoneDist(g, 'fed', x, y) >= 200;
}
const rectDist = (r, x, y) => Math.hypot(Math.max(r.x - x, 0, x - (r.x + r.w)), Math.max(r.y - y, 0, y - (r.y + r.h)));
const zoneDist = (g, side, x, y) => Math.min(...g.sc.deploy[side].map(r => rectDist(r, x, y)));
// инженерные средства ставит только обороняющийся, в любом месте не ближе 200 м к зоне противника
function engOk(g, side, x, y, k){
  if (k === 'trap') return trapOk(g, side, x, y);
  if (side !== g.sc.defender) return false;
  const m = g.map; if (x < 0 || y < 0 || x >= m.W*CELL || y >= m.H*CELL) return false;
  const i = cellIdx(m, x, y); if (!ENG_OK.has(m.t[i]) || m.obst[i]) return false;
  return zoneDist(g, other(side), x, y) >= 200;
}
// чеченская пехота может выходить из подвалов жилых домов
function infilOk(g, side, type, x, y){
  const d = UT[type]; if (side !== 'chr' || !d || d.cls !== 'inf') return false;
  const m = g.map; if (x < 0 || y < 0 || x >= m.W*CELL || y >= m.H*CELL) return false;
  const i = cellIdx(m, x, y), wood = m.kind === 'mountain' && (m.t[i] === T.FOREST || m.t[i] === T.ROCK);
  if (!wood && (!m.res[i] || (m.t[i] !== T.BLD && m.t[i] !== T.RUBBLE))) return false;
  if (g.phase === 'deploy') return zoneDist(g, 'fed', x, y) >= 250;
  if (zoneDist(g, 'fed', x, y) < 120) return false;
  return !g.units.some(u => !u.dead && u.side === 'fed' && Math.hypot(u.x - x, u.y - y) < 220);
}
const GAME_SPEED = 1.6; // сжатие времени при движении
const ARRIVE = 9;
const CIV_PEN = 3; // штраф очков за гибель мирного жителя // секунд до прибытия подкрепления

/* ================= СЦЕНАРИИ ================= */
const SCEN = {
  ny95:{
    id:'ny95', title:'Новогодний штурм', date:'31 декабря 1994', place:'Грозный, центр города', map:'city',
    history:'В последний день 1994 года федеральные войска вошли в Грозный с нескольких направлений. Колонны группировки «Север», в их числе 131-я майкопская бригада и 81-й мотострелковый полк, двинулись к вокзалу и президентскому дворцу почти без пехотного прикрытия и с плохой связью. В городе их встретили небольшие мобильные группы с гранатомётами, стрелявшие с верхних этажей и из подвалов. Бригада понесла тяжелейшие потери у вокзала, а дворец федеральные силы заняли только 19 января 1995 года.',
    goals:{ fed:'Возьмите пехотой вокзал, дворец, Совмин и площадь Минутка. Техника без пехоты в городе слепа и уязвима.',
            chr:'Удержите ключевые здания. Бейте по бортам и крышам машин с верхних этажей и меняйте позиции после выстрела.' },
    start:{ fed:{points:600, income:1.2}, chr:{points:520, income:1.0} },
    decks:{ fed:['f_msv','f_sap','f_vdv','f_rec','f_snp','f_ags','f_cmd','f_btr','f_bmp','f_t72','f_t80','f_zsu','f_ural'],
            chr:['c_opl','c_rpg','c_vet','c_snp','c_pk','c_nsv','c_spg','c_fag','c_zu2','c_t72','c_btr','c_zu','c_sup'] },
    deploy:{ fed:[{x:0,y:0,w:2400,h:170},{x:0,y:170,w:120,h:900}], chr:[{x:420,y:360,w:1700,h:1200}] },
    entry:{ fed:[{x:500,y:30},{x:1200,y:30},{x:1900,y:30},{x:30,y:700}], chr:[{x:1200,y:1570},{x:2370,y:1000}] },
    face:{ fed:Math.PI/2, chr:-Math.PI/2 },
    objectives:[ {name:'Вокзал',x:660,y:400,r:80,owner:'chr'}, {name:'Президентский дворец',x:1200,y:800,r:90,owner:'chr'},
                 {name:'Совмин',x:1380,y:700,r:70,owner:'chr'}, {name:'пл. Минутка',x:1800,y:1280,r:80,owner:'chr'} ],
    objRate:.2, target:600, duration:900, deployTime:120, defender:'chr', civs:45, winter:true
  },
  aug96:{
    id:'aug96', title:'Август 1996', date:'6 августа 1996', place:'Грозный', map:'city',
    history:'6 августа 1996 года чеченские отряды, по разным оценкам до полутора тысяч бойцов, скрытно вошли в Грозный и блокировали федеральные блокпосты и комендатуры. Гарнизон города в несколько раз превосходил нападавших числом, но был рассредоточен по опорным пунктам. Бои шли около двух недель и закончились перемирием, а 31 августа были подписаны Хасавюртовские соглашения.',
    goals:{ fed:'Удержите блокпосты до подхода подкреплений со стороны Ханкалы, с восточного края карты.',
            chr:'Проникните в город, отрежьте и возьмите блокпосты. Тяжёлой техники нет: действуйте группами и избегайте открытых улиц.' },
    start:{ fed:{points:380, income:.8}, chr:{points:660, income:1.25} },
    decks:{ fed:['f_msv','f_sap','f_vdv','f_snp','f_ags','f_cmd','f_btr','f_bmp','f_t72b','f_zsu','f_ural'],
            chr:['c_opl','c_rpg','c_vet','c_snp','c_pk','c_nsv','c_spg','c_fag','c_zu2','c_zu','c_sup'] },
    deploy:{ fed:[{x:100,y:160,w:260,h:260},{x:530,y:270,w:260,h:260},{x:1070,y:670,w:260,h:260},{x:1670,y:1150,w:260,h:260}],
             chr:[{x:0,y:1520,w:2400,h:80},{x:0,y:600,w:100,h:800}] },
    entry:{ fed:[{x:2370,y:800}], chr:[{x:1200,y:1580},{x:30,y:1000},{x:600,y:1580}] },
    face:{ fed:-Math.PI/2, chr:-Math.PI/2 },
    objectives:[ {name:'Блокпост на Старопромысловском ш.',x:230,y:290,r:70,owner:'fed'}, {name:'Вокзал',x:660,y:400,r:80,owner:'fed'},
                 {name:'Дом правительства',x:1200,y:800,r:90,owner:'fed'}, {name:'пл. Минутка',x:1800,y:1280,r:80,owner:'fed'} ],
    objRate:.2, target:600, duration:900, deployTime:120, defender:'fed', civs:35
  },
  yar96:{
    id:'yar96', title:'Засада у Ярышмарды', date:'16 апреля 1996', place:'Аргунское ущелье', map:'mountain',
    history:'16 апреля 1996 года колонна 245-го мотострелкового полка, шедшая в Шатой, попала в засаду в Аргунском ущелье у села Ярышмарды. Узкая горная дорога не давала машинам развернуться, а огонь вёлся с заранее подготовленных позиций на склонах. Это одна из самых тяжёлых засад той войны: колонна потеряла большую часть машин.',
    goals:{ fed:'Проведите грузовики колонны к восточному краю карты. Занимайте высоты, чтобы прикрыть дорогу.',
            chr:'Остановите колонну. Каждый уничтоженный грузовик приносит очки, высоты дают обзор на дорогу.' },
    start:{ fed:{points:280, income:.7}, chr:{points:340, income:.6} },
    decks:{ fed:['f_msv','f_sap','f_rec','f_snp','f_ags','f_cmd','f_btr','f_bmp','f_t72b','f_zsu'],
            chr:['c_opl','c_rpg','c_vet','c_snp','c_pk','c_nsv','c_spg','c_fag','c_zu2','c_zu','c_sup'] },
    deploy:{ fed:[{x:0,y:600,w:440,h:480}], chr:[{x:700,y:160,w:1400,h:460},{x:900,y:1160,w:1100,h:300}] },
    entry:{ fed:[{x:30,y:880}], chr:[{x:1000,y:30},{x:1700,y:30}] },
    face:{ fed:0, chr:Math.PI/2 },
    exit:{ side:'fed', x:2280, y:400, w:120, h:900, value:60 },
    objectives:[ {name:'Высота 1',x:1000,y:480,r:90,owner:null}, {name:'Высота 2',x:1760,y:520,r:90,owner:null} ],
    objRate:.25, target:320, duration:780, deployTime:100, defender:'chr', civs:14,
    convoy:6
  }
};

/* ================= КАРТЫ ================= */
function buildMap(kind, seed){
  const m = kind === 'city' ? buildGrozny(seed) : buildMountain(seed);
  m.bhp = new Float32Array(m.W*m.H); m.bst = new Uint8Array(m.W*m.H); m.obst = new Uint8Array(m.W*m.H);
  for (let i = 0; i < m.W*m.H; i++) if (m.t[i] === T.BLD) m.bhp[i] = m.res[i] ? 100 : 260;
  assignFloors(m, seed, kind);
  placeProps(m, seed);
  return m;
}
// брошенные машины: легковушки, «рафики», автобусы; часть уже сгорела
function placeProps(m, seed){
  const R = mulberry(seed*131 + 11), W = m.W, out = [];
  const isR = (x, y) => x >= 0 && y >= 0 && x < W && y < m.H && (m.t[y*W+x] === T.ROAD || m.t[y*W+x] === T.BRIDGE);
  for (let i = 0; i < W*m.H; i++){
    const x = i % W, y = Math.floor(i/W), v = m.t[i];
    let rot, px = (x + .5)*CELL, py = (y + .5)*CELL, p;
    if (v === T.ROAD){
      p = m.kind === 'city' ? .026 : .008; if (R() >= p) continue;
      const vert = isR(x, y - 1) && isR(x, y + 1), hor = isR(x - 1, y) && isR(x + 1, y); if (vert && hor) continue;
      if (vert){ rot = R() < .5 ? Math.PI/2 : -Math.PI/2; px += isR(x + 1, y) ? -5 : 5; }
      else { rot = R() < .5 ? 0 : Math.PI; py += isR(x, y + 1) ? -5 : 5; }
    } else if (v === T.YARD){ if (R() >= .014) continue; rot = R()*Math.PI*2; px += (R() - .5)*8; py += (R() - .5)*8; }
    else continue;
    const k = R(), kind = v === T.ROAD && k < .06 ? 'bus' : k < .18 ? 'van' : 'car';
    out.push({ id:out.length, x:px, y:py, rot:rot + (R() - .5)*.25, kind, col:Math.floor(R()*6), st:R() < .38 ? 1 : 0 });
  }
  m.props = out;
}
function propHit(g, x, y, r){
  for (const pr of g.map.props) if (pr.st === 0 && Math.abs(pr.x - x) < r && Math.abs(pr.y - y) < r && Math.hypot(pr.x - x, pr.y - y) < r){ pr.st = 1; g.ev.push({ e:'prop', id:pr.id, s:1 }); }
}
// этажность: дома — связные группы клеток; в Грозном много пяти- и девятиэтажек, в селе 1–2 этажа
function assignFloors(m, seed, kind){
  const R = mulberry(seed*31 + 5), W = m.W, fl = new Uint8Array(W*m.H), seen = new Uint8Array(W*m.H), bid = new Uint16Array(W*m.H); let bidN = 0;
  const city = [2, 3, 4, 5, 5, 5, 5, 9, 9, 9, 12], village = [1, 1, 2];
  for (let i = 0; i < W*m.H; i++){
    if (m.t[i] !== T.BLD || seen[i]) continue;
    const comp = [i]; seen[i] = 1;
    for (let h = 0; h < comp.length; h++){ const j = comp[h], x = j % W, y = Math.floor(j/W);
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]){ const X = x+dx, Y = y+dy; if (X < 0 || Y < 0 || X >= W || Y >= m.H) continue; const k = Y*W+X; if (!seen[k] && m.t[k] === T.BLD && m.res[k] === m.res[i]){ seen[k] = 1; comp.push(k); } } }
    let f;
    if (kind !== 'city') f = village[Math.floor(R()*village.length)];
    else if (!m.res[i]){ const x = i % W, y = Math.floor(i/W); f = (x >= 58 && x <= 62 && y >= 38 && y <= 42) ? 11 : (y < 19 ? 3 : 8); }
    else { f = city[Math.floor(R()*city.length)]; if (comp.length <= 3) f = Math.min(f, 2 + Math.floor(R()*2)); }
    bidN++; for (const j of comp){ fl[j] = f; bid[j] = bidN; }
  }
  m.fl = fl; m.bid = bid;
}
const bldMax = (m, i) => m.res[i] ? 100 : 260;

function mkGrid(W, H){
  const t = new Uint8Array(W*H), res = new Uint8Array(W*H);
  const set = (x, y, v) => { if (x >= 0 && y >= 0 && x < W && y < H){ t[y*W+x] = v; if (v !== T.BLD) res[y*W+x] = 0; } };
  const disc = (cx, cy, r, v) => { for (let y = Math.floor(cy-r); y <= cy+r; y++) for (let x = Math.floor(cx-r); x <= cx+r; x++) if ((x-cx)**2 + (y-cy)**2 <= r*r) set(x, y, v); };
  const rect = (x0, y0, x1, y1, v, r) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++){ set(x, y, v); if (r !== undefined && x>=0&&y>=0&&x<W&&y<H) res[y*W+x] = r; } };
  return { W, H, t, res, set, disc, rect };
}

function buildGrozny(seed){
  const R = mulberry(seed * 7919 + 13), W = 120, H = 80, G = mkGrid(W, H), { t, res, set, disc, rect } = G;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) t[y*W+x] = y >= 9 ? T.YARD : T.OPEN;
  for (let i = 0; i < 16; i++) disc(R()*W, R()*7, 1 + R()*2.5, T.FOREST);
  const vx = [10,24,38,52,66,80,94,108].map(v => v + Math.floor(R()*3) - 1);
  const hy = [13,26,40,54,68];
  const xs = [-1, ...vx, W], ys = [8, ...hy, H];
  for (let bi = 0; bi < xs.length-1; bi++) for (let bj = 0; bj < ys.length-1; bj++){
    const x0 = xs[bi]+3, x1 = xs[bi+1]-2, y0 = ys[bj]+3, y1 = ys[bj+1]-2;
    let y = y0;
    while (y <= y1){
      const lh = 2 + Math.floor(R()*3); let x = x0;
      while (x <= x1){
        const lw = 2 + Math.floor(R()*4);
        if (R() < .84) for (let yy = y; yy < Math.min(y+lh, y1+1); yy++) for (let xx = x; xx < Math.min(x+lw, x1+1); xx++){ set(xx, yy, T.BLD); res[yy*W+xx] = 1; }
        x += lw + 1;
      }
      y += lh + 1;
    }
  }
  // парки
  disc(45, 33, 3, T.FOREST); disc(76, 49, 2.5, T.FOREST); disc(19, 61, 3.2, T.FOREST); disc(103, 34, 2.5, T.FOREST);
  // улицы
  for (const x of vx) for (let y = 0; y < H; y++){ set(x, y, T.ROAD); set(x+1, y, T.ROAD); }
  for (const y of hy) for (let x = 0; x < W; x++){ set(x, y, T.ROAD); set(x, y+1, T.ROAD); }
  // железная дорога и вокзал
  for (let x = 0; x < W; x++){ if (t[19*W+x] !== T.ROAD) set(x, 19, T.YARD); set(x, 20, T.RAIL); if (t[21*W+x] !== T.ROAD) set(x, 21, T.YARD); }
  rect(28, 15, 38, 18, T.YARD); rect(30, 16, 36, 17, T.BLD, 0); rect(28, 22, 38, 23, T.YARD);
  // президентский дворец и Совмин
  rect(55, 35, 65, 45, T.YARD); rect(58, 38, 62, 42, T.BLD, 0);
  rect(66, 33, 72, 37, T.YARD); rect(67, 34, 71, 36, T.BLD, 0);
  // Минутка
  disc(90, 64, 3.5, T.YARD);
  // Сунжа
  const bridges = new Set([vx[1], vx[1]+1, vx[3], vx[3]+1, vx[5], vx[5]+1, vx[7], vx[7]+1]);
  const riverY = [];
  for (let x = 0; x < W; x++){
    const cy = Math.round(50 + 12*Math.sin(x/W*Math.PI*1.3 + .3)); riverY[x] = cy;
    for (let dy = -1; dy <= 2; dy++){
      const y = cy + dy; if (y < 0 || y >= H) continue;
      if (dy === -1 || dy === 2){ if (t[y*W+x] === T.BLD) set(x, y, T.YARD); continue; }
      set(x, y, bridges.has(x) ? T.BRIDGE : T.WATER);
    }
  }
  const labels = [
    { x:420, y:riverY[21]*CELL + 70, text:'р. Сунжа' }, { x:vx[0]*CELL + 20, y:110, text:'Старопромысловское ш.' },
    { x:900, y:60, text:'Северные окраины' }
  ];
  return { W, H, t, res, labels, kind:'city' };
}

function buildMountain(seed){
  const R = mulberry(seed * 104729 + 7), W = 120, H = 80, G = mkGrid(W, H), { t, res, set, disc, rect } = G;
  t.fill(T.FOREST);
  for (let i = 0; i < 26; i++) disc(R()*W, R()*H, 1.5 + R()*3, T.OPEN);
  const roadY = [];
  for (let x = 0; x < W; x++) roadY[x] = Math.round(42 + 7*Math.sin(x/17) + 3*Math.sin(x/7.3));
  // скальные гряды над дорогой
  for (let x = 18; x < W-10; x++) if ((x % 9) < 5) for (let dy = -7; dy <= -5; dy++) if (R() < .8) set(x, roadY[x]+dy, T.ROCK);
  // река
  for (let x = 0; x < W; x++) for (let dy = 4; dy <= 5; dy++) set(x, roadY[x]+dy, (x === 40 || x === 41 || x === 96 || x === 97) ? T.BRIDGE : T.WATER);
  for (let x = 0; x < W; x++){ for (let dy = 1; dy <= 3; dy++) if (R() < .5) set(x, roadY[x]+dy, T.OPEN); for (let dy = -3; dy <= -1; dy++) if (R() < (dy === -1 ? .7 : .4)) set(x, roadY[x]+dy, T.OPEN); }
  // дорога
  for (let x = 0; x < W; x++){
    const a = roadY[x], b = x > 0 ? roadY[x-1] : a;
    for (let y = Math.min(a, b); y <= Math.max(a, b); y++) set(x, y, T.ROAD);
  }
  // съезды к мостам
  for (const bx of [40, 96]) for (let y = roadY[bx]+1; y <= roadY[bx]+9; y++){ set(bx, y, y <= roadY[bx]+5 && y >= roadY[bx]+4 ? T.BRIDGE : T.ROAD); }
  // Ярышмарды
  for (let x = 64; x <= 76; x++) for (let y = roadY[x]-4; y <= roadY[x]-1; y++){ set(x, y, T.YARD); if (R() < .55 && (x % 3)) { set(x, y, T.BLD); res[y*W+x] = 1; } }
  // высоты
  disc(50, 24, 3.2, T.OPEN); disc(88, 26, 3.2, T.OPEN);
  // сборный и конечный пункты
  for (let x = 0; x < 22; x++) for (let y = roadY[x]-4; y <= roadY[x]+3; y++) if (t[y*W+x] !== T.ROAD && t[y*W+x] !== T.WATER) set(x, y, T.OPEN);
  for (let x = 110; x < W; x++) for (let y = roadY[x]-5; y <= roadY[x]+3; y++) if (t[y*W+x] !== T.ROAD && t[y*W+x] !== T.WATER) set(x, y, T.OPEN);
  const labels = [
    { x:1400, y:(roadY[70]-6)*CELL, text:'с. Ярышмарды' },
    { x:600, y:(roadY[30]+9)*CELL, text:'р. Аргун' }, { x:200, y:(roadY[10]-6)*CELL, text:'Колонна' }, { x:2250, y:(roadY[115]-7)*CELL, text:'На Шатой' }
  ];
  return { W, H, t, res, labels, kind:'mountain', roadY };
}

const cellIdx = (map, x, y) => clamp(Math.floor(y/CELL), 0, map.H-1)*map.W + clamp(Math.floor(x/CELL), 0, map.W-1);
const terrAt = (map, x, y) => map.t[cellIdx(map, x, y)];
const passableAt = (map, mc, x, y) => x >= 0 && y >= 0 && x < map.W*CELL && y < map.H*CELL && isFinite(MOVE[mc][terrAt(map, x, y)]) && !(mc !== 'foot' && map.obst && map.obst[cellIdx(map, x, y)]);
const cellCenter = (map, i) => ({ x:(i % map.W + .5)*CELL, y:(Math.floor(i/map.W) + .5)*CELL });

function nearestPassable(map, mc, ci){
  const C = MOVE[mc], W = map.W, H = map.H, cx = ci % W, cy = Math.floor(ci/W), ob = mc !== 'foot' && map.obst;
  if (isFinite(C[map.t[ci]]) && !(ob && ob[ci])) return ci;
  for (let r = 1; r < 14; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++){
    if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
    const x = cx+dx, y = cy+dy; if (x < 0 || y < 0 || x >= W || y >= H) continue;
    if (isFinite(C[map.t[y*W+x]]) && !(ob && ob[y*W+x])) return y*W+x;
  }
  return -1;
}

/* ================= ПОИСК ПУТИ (A*) ================= */
const DX = [1,-1,0,0,1,1,-1,-1], DY = [0,0,1,-1,1,-1,1,-1];
function hpush(h, n){ h.push(n); let i = h.length-1; while (i > 0){ const p = (i-1) >> 1; if (h[p][0] <= h[i][0]) break; [h[p], h[i]] = [h[i], h[p]]; i = p; } }
function hpop(h){ const top = h[0], last = h.pop(); if (h.length){ h[0] = last; let i = 0; for (;;){ const l = 2*i+1, r = l+1; let m = i; if (l < h.length && h[l][0] < h[m][0]) m = l; if (r < h.length && h[r][0] < h[m][0]) m = r; if (m === i) break; [h[m], h[i]] = [h[i], h[m]]; i = m; } } return top; }
function findPath(map, mc, sx, sy, tx, ty){
  const W = map.W, H = map.H, N = W*H, C = MOVE[mc], tt = map.t, ob = mc !== 'foot' ? map.obst : null;
  let s = cellIdx(map, sx, sy), e = cellIdx(map, tx, ty);
  if (!isFinite(C[tt[s]])){ s = nearestPassable(map, mc, s); if (s < 0) return null; }
  if (ob && ob[cellIdx(map, tx, ty)]){ const e2 = nearestPassable(map, mc, cellIdx(map, tx, ty)); if (e2 < 0) return null; const c2 = cellCenter(map, e2); tx = c2.x; ty = c2.y; }
  const eOk = isFinite(C[tt[e]]) && tx >= 0 && ty >= 0 && tx < W*CELL && ty < H*CELL;
  if (!isFinite(C[tt[e]])){ e = nearestPassable(map, mc, e); if (e < 0) return null; }
  if (s === e) return [eOk ? { x:tx, y:ty } : cellCenter(map, e)];
  const gs = new Float32Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
  const ex = e % W, ey = Math.floor(e/W); let minC = Infinity; for (const c of C) if (c < minC) minC = c;
  const hh = i => { const dx = Math.abs(i % W - ex), dy = Math.abs(Math.floor(i/W) - ey); return minC*(Math.max(dx, dy) + .414*Math.min(dx, dy)); };
  const heap = []; gs[s] = 0; hpush(heap, [hh(s), s]); let it = 0;
  while (heap.length && it++ < 25000){
    const i = hpop(heap)[1]; if (closed[i]) continue; if (i === e) break; closed[i] = 1;
    const x = i % W, y = Math.floor(i/W);
    for (let k = 0; k < 8; k++){
      const nx = x+DX[k], ny = y+DY[k]; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny*W+nx; if (closed[j]) continue; const cj = C[tt[j]]; if (!isFinite(cj) || (ob && ob[j])) continue;
      if (k >= 4 && (!isFinite(C[tt[y*W+nx]]) || !isFinite(C[tt[ny*W+x]]))) continue;
      const ng = gs[i] + (cj + C[tt[i]])*.5*(k >= 4 ? 1.414 : 1);
      if (ng < gs[j]){ gs[j] = ng; from[j] = i; hpush(heap, [ng + hh(j), j]); }
    }
  }
  if (from[e] < 0) return null;
  const cells = []; for (let i = e; i !== s; i = from[i]) cells.push(i); cells.reverse();
  const pts = []; let pdx = null, pdy = null, prev = s;
  for (let k = 0; k < cells.length; k++){
    const i = cells[k], dx = i % W - prev % W, dy = Math.floor(i/W) - Math.floor(prev/W);
    if (k > 0 && dx === pdx && dy === pdy) pts[pts.length-1] = i; else pts.push(i);
    pdx = dx; pdy = dy; prev = i;
  }
  const out = pts.map(i => cellCenter(map, i));
  if (eOk) out[out.length-1] = { x:tx, y:ty };
  return out;
}

/* ================= ЛИНИЯ ВИДИМОСТИ ================= */
function los(map, x1, y1, x2, y2){
  const W = map.W; let cx = Math.floor(x1/CELL), cy = Math.floor(y1/CELL); const ex = Math.floor(x2/CELL), ey = Math.floor(y2/CELL);
  const dx = x2-x1, dy = y2-y1, sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1;
  const tDx = dx !== 0 ? Math.abs(CELL/dx) : Infinity, tDy = dy !== 0 ? Math.abs(CELL/dy) : Infinity;
  let tMx = dx !== 0 ? ((sx > 0 ? (cx+1)*CELL - x1 : x1 - cx*CELL)/Math.abs(dx)) : Infinity;
  let tMy = dy !== 0 ? ((sy > 0 ? (cy+1)*CELL - y1 : y1 - cy*CELL)/Math.abs(dy)) : Infinity;
  let veg = 0, n = 0;
  while (n++ < 400){
    if (tMx < tMy){ tMx += tDx; cx += sx; } else { tMy += tDy; cy += sy; }
    if (cx === ex && cy === ey) return true;
    if (cx < 0 || cy < 0 || cx >= W || cy >= map.H) return false;
    const v = map.t[cy*W+cx];
    if (v === T.BLD){ if (n === 1) continue; return false; }
    if (v === T.FOREST){ veg++; if (veg >= 3) return false; }
    else if (v === T.ROCK){ veg += 2; if (veg >= 3) return false; }
    else if (v === T.RUBBLE || v === T.BARR){ veg += 1; if (veg >= 3) return false; }
  }
  return true;
}

/* ================= ИГРА ================= */
function mkSide(s){ return { pts:s.points, inc:s.income, score:0, lostVal:0, lostMen:0, lostVeh:0, civK:0, used:{}, eng:{}, cd:0, cd2:0, cd3:0, cd4:0, ready:false }; }

function makeGame(scnId, seed, opts){
  opts = opts || {};
  const sc = SCEN[scnId], map = buildMap(sc.map, seed); map.winter = !!sc.winter;
  const g = { scn:scnId, sc, seed, map, t:0, phase:'deploy', phaseT:sc.deployTime, units:[], byId:new Map(), nextId:1,
    sides:{ fed:mkSide(sc.start.fed), chr:mkSide(sc.start.chr) },
    objs: sc.objectives.map(o => ({ ...o, prog: o.owner === 'fed' ? 100 : o.owner === 'chr' ? -100 : 0 })),
    ev:[], shells:[], artyMarks:[], arrivals:[], bldHits:0, bldDown:0, civs:[], noise:[], civDead:0, civEvac:0, result:null, visT:0, delayed:[], fires:new Map(), traps:[], air:[], entry:JSON.parse(JSON.stringify(sc.entry)),
    rounds:opts.rounds === 2 ? 2 : 1, round:1, tod:opts.tod || 'day', winter:!!sc.winter, mines:[], smokes:[], flares:[], rr:[], mineId:1, engT:0 };
  g.night = g.tod === 'night';
  spawnConvoy(g);
  if (sc.civs) spawnCivs(g, sc.civs);
  return g;
}

function spawnConvoy(g){
  const sc = g.sc, map = g.map; if (!sc.convoy || !map.roadY) return;
  for (let i = 0; i < sc.convoy; i++){
    const cx = 3 + i*3, p = cellCenter(map, map.roadY[cx]*map.W + cx);
    const u = spawnUnit(g, 'f_conv', 'fed', p.x, p.y); u.pre = true;
  }
  g.entry.fed = [ cellCenter(map, map.roadY[1]*map.W + 1) ];
}
function spawnUnit(g, type, side, x, y){
  const d = UT[type];
  const u = { id:g.nextId++, type, side, x, y, h:g.sc.face[side] || 0, hp:d.hp, supp:0, hitT:-10, path:null, dest:null, fast:false, focus:0,
    w:d.weapons.map(w => ({ cd:Math.random()*w.rof, ammo:w.ammo !== undefined ? w.ammo : Infinity })),
    ta:g.sc.face[side] || 0, aim:0, aimT:-10, vis:{ fed:side === 'fed', chr:side === 'chr' }, shootable:[], fired:-10, inB:false, dead:false, moving:false, resupT:0,
    smk:d.smk, carrier:0, cargo:0, board:0, immob:false, work:0, workT:null };
  g.units.push(u); g.byId.set(u.id, u); return u;
}
function removeUnit(g, u){ u.dead = true; g.units = g.units.filter(x => x !== u); g.byId.delete(u.id); }
const inRect = (r, x, y) => x >= r.x && y >= r.y && x <= r.x + r.w && y <= r.y + r.h;
const inRects = (rs, x, y) => rs.some(r => inRect(r, x, y));
const deckOf = (g, side) => g.sc.decks[side];

let CUR_PID; // игрок, от имени которого выполняется команда (в 2 на 2 каждый управляет своими отрядами)
function ownUnits(g, side, ids, withCarried){ const out = []; for (const id of ids || []){ const u = g.byId.get(id); if (u && !u.dead && u.side === side && (withCarried || !u.carrier) && (CUR_PID === undefined || !u.owner || u.owner === CUR_PID)) out.push(u); } return out; }
function pidSide(g, pid){ const p = (g.players || []).find(p => p.pid === pid); if (!p) return null; return g.round === 2 ? other(p.side0) : p.side0; }
function teamOf(g, side){ return (g.players || []).filter(p => !p.gone && pidSide(g, p.pid) === side); }
function orphanPlayer(g, pid){
  const p = (g.players || []).find(p => p.pid === pid); if (!p) return; p.gone = true;
  for (const u of g.units) if (u.owner === pid) u.owner = 0;
  for (const s of SIDES){ const t = teamOf(g, s); if (g.phase === 'deploy') g.sides[s].ready = t.length ? t.every(q => g.pready && g.pready[q.pid]) : true; }
  g.ev.push({ e:'left', pid, name:p.name });
}
function unloadCargo(g, v){
  const c = v.cargo ? g.byId.get(v.cargo) : null; v.cargo = 0; if (!c || c.dead) return null;
  const bx = v.x - Math.cos(v.h)*14, by = v.y - Math.sin(v.h)*14;
  const ci = nearestPassable(g.map, 'foot', cellIdx(g.map, bx, by)), p = ci >= 0 ? cellCenter(g.map, ci) : { x:v.x, y:v.y };
  c.carrier = 0; c.x = p.x + gauss()*4; c.y = p.y + gauss()*4; c.path = null; c.dest = null; c.board = 0;
  return c;
}

// маршрут, заданный при расстановке: отряды тронутся сами в начале боя
function planMove(g, us, x, y, fast, append){
  const offs = [[0, 0]]; for (let ring = 1; offs.length < us.length; ring++){ const cnt = 6*ring; for (let k = 0; k < cnt && offs.length < us.length; k++){ const a = k/cnt*Math.PI*2; offs.push([Math.cos(a)*32*ring, Math.sin(a)*32*ring]); } }
  const sorted = [...us].sort((a, b) => Math.hypot(a.x-x, a.y-y) - Math.hypot(b.x-x, b.y-y));
  sorted.forEach((u, i) => { if (!append || !u.q) u.q = []; u.q.push({ x:x + offs[i][0], y:y + offs[i][1], fast }); if (u.q.length > 8) u.q.shift(); });
}
function launchPlans(g){
  for (const u of g.units){
    if (!u.q || !u.q.length || u.carrier) continue;
    const d = UT[u.type], nx = u.q.shift(), p = findPath(g.map, d.mc, u.x, u.y, nx.x, nx.y);
    if (p){ u.path = p; u.dest = p[p.length-1]; u.fast = nx.fast; }
    if (!u.q.length) u.q = null;
  }
}
function formationMove(g, us, x, y, fast, queue){
  const offs = []; let ring = 0;
  while (offs.length < us.length){
    if (ring === 0){ offs.push([0,0]); ring++; continue; }
    const cnt = 6*ring;
    for (let k = 0; k < cnt && offs.length < us.length; k++){ const a = k/cnt*Math.PI*2; offs.push([Math.cos(a)*32*ring, Math.sin(a)*32*ring]); }
    ring++;
  }
  // ближайшие к цели юниты получают центральные места
  const sorted = [...us].sort((a, b) => Math.hypot(a.x-x, a.y-y) - Math.hypot(b.x-x, b.y-y));
  sorted.forEach((u, i) => {
    const d = UT[u.type];
    const tx = x + offs[i][0], ty = y + offs[i][1];
    if (queue && (u.path || (u.q && u.q.length))){ (u.q = u.q || []).push({ x:tx, y:ty, fast }); if (u.q.length > 8) u.q.shift(); return; }
    u.q = null;
    const p = findPath(g.map, d.mc, u.x, u.y, tx, ty);
    if (p){ u.path = p; u.dest = p[p.length-1]; u.fast = fast; u.aiHold = false; }
  });
}

const COMM_ZONE = 300, COMM_CMDS = new Set(['move', 'attack', 'afire', 'smoke', 'unload', 'stop', 'board']);
function hasComm(g, u){
  if (u.side !== 'fed' || UT[u.type].comm) return true;
  if (zoneDist(g, 'fed', u.x, u.y) <= COMM_ZONE) return true;
  return g.units.some(k => !k.dead && !k.carrier && k.side === 'fed' && UT[k.type].comm && Math.hypot(k.x - u.x, k.y - u.y) <= UT[k.type].comm);
}
// подвалы: жилые дома (и их руины) одного квартала, между которыми не больше одной клетки прохода
const isCellar = (m, i) => m.res[i] && (m.t[i] === T.BLD || m.t[i] === T.RUBBLE);
function cellarReach(m, from, limit = 900){
  const W = m.W, H = m.H, prev = new Map([[from, -1]]), q = [from];
  for (let h = 0; h < q.length && q.length < limit; h++){
    const i = q[h], x = i % W, y = Math.floor(i/W);
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++){
      if (!dx && !dy) continue; const X = x+dx, Y = y+dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
      const j = Y*W + X; if (prev.has(j) || !isCellar(m, j)) continue; prev.set(j, i); q.push(j);
    }
  }
  return prev;
}
function cellarPath(m, from, to){
  if (!isCellar(m, from) || !isCellar(m, to)) return null;
  const prev = cellarReach(m, from); if (!prev.has(to)) return null;
  const out = []; for (let i = to; i !== -1; i = prev.get(i)) out.push(cellCenter(m, i));
  return out.reverse();
}
function applyCommand(g, side, c){
  const prev = CUR_PID; CUR_PID = c ? c._pid : undefined;
  try { return applyCommand0(g, side, c); } finally { CUR_PID = prev; }
}
function applyCommand0(g, side, c){
  if (!c || g.phase === 'end') return;
  if (side === 'fed' && g.phase === 'battle' && !c._d && COMM_CMDS.has(c.c) && c.ids){
    const us = ownUnits(g, side, c.ids, true), out = us.filter(u => !hasComm(g, u));
    if (out.length){
      const outIds = new Set(out.map(u => u.id)), delay = 6 + Math.random()*4;
      g.delayed.push({ t:g.t + delay, c:{ ...c, ids:[...outIds], _d:true } });
      for (const u of out) u.pend = g.t + delay;
      g.ev.push({ e:'delay', n:out.length, s:Math.round(delay) });
      c = { ...c, ids:c.ids.filter(id => !outIds.has(id)) };
      if (!c.ids.length) return;
    }
  }
  const S = g.sides[side];
  switch (c.c){
    case 'deploy': {
      if (g.phase !== 'deploy') return; const d = UT[c.type];
      if (!d || d.side !== side || !deckOf(g, side).includes(c.type)) return;
      if (S.pts < d.cost || (S.used[c.type] || 0) >= d.limit) return;
      if (!((inRects(g.sc.deploy[side], c.x, c.y) || infilOk(g, side, c.type, c.x, c.y)) && passableAt(g.map, d.mc, c.x, c.y))) return;
      S.pts -= d.cost; S.used[c.type] = (S.used[c.type] || 0) + 1; spawnUnit(g, c.type, side, c.x, c.y).owner = CUR_PID || 0; return;
    }
    case 'undeploy': {
      if (g.phase !== 'deploy') return;
      for (const u of ownUnits(g, side, c.ids)){ if (u.pre) continue; if (u.cargo) unloadCargo(g, u); removeUnit(g, u); S.pts += UT[u.type].cost; S.used[u.type]--; }
      return;
    }
    case 'eng': {
      if (g.phase !== 'deploy') return; const E = ENG[c.k]; if (!E) return;
      if (S.pts < E.cost || (S.eng[c.k] || 0) >= E.lim[side] || !engAvail(g, side, c.k) || !engOk(g, side, c.x, c.y, c.k)) return;
      const m = g.map, i = cellIdx(m, c.x, c.y);
      if (c.k === 'trap'){ const p = cellCenter(m, i); g.traps.push({ id:g.mineId++, i, x:p.x, y:p.y, side, rev:{ fed:false, chr:true } }); }
      else if (c.k === 'barr'){
        if (g.units.some(u => cellIdx(m, u.x, u.y) === i)) return;
        m.bprev = m.bprev || new Int8Array(m.W*m.H).fill(-1); m.bown = m.bown || new Uint8Array(m.W*m.H);
        m.bprev[i] = m.t[i]; m.bown[i] = side === 'fed' ? 1 : 2; m.t[i] = T.BARR; m.bhp[i] = 90;
        g.ev.push({ e:'ter', i, v:T.BARR });
      } else {
        if (g.mines.some(n => Math.hypot(n.x - c.x, n.y - c.y) < 12)) return;
        g.mines.push({ id:g.mineId++, x:c.x, y:c.y, side, rev:{ fed:side === 'fed', chr:side === 'chr' } });
      }
      S.pts -= E.cost; S.eng[c.k] = (S.eng[c.k] || 0) + 1; return;
    }
    case 'uneng': {
      if (g.phase !== 'deploy') return;
      const ti = g.traps.findIndex(t => t.side === side && t.i === cellIdx(g.map, c.x, c.y));
      if (ti >= 0){ g.traps.splice(ti, 1); S.pts += ENG.trap.cost; S.eng.trap--; return; }
      const mi = g.mines.findIndex(n => n.side === side && Math.hypot(n.x - c.x, n.y - c.y) < 14);
      if (mi >= 0){ g.mines.splice(mi, 1); S.pts += ENG.mine.cost; S.eng.mine--; return; }
      const m = g.map, i = cellIdx(m, c.x, c.y);
      if (m.t[i] === T.BARR && m.bown && m.bown[i] === (side === 'fed' ? 1 : 2) && m.bprev[i] >= 0){
        m.t[i] = m.bprev[i]; m.bown[i] = 0; g.ev.push({ e:'ter', i, v:m.t[i] }); S.pts += ENG.barr.cost; S.eng.barr--;
      }
      return;
    }
    case 'settrap': {
      if (g.phase !== 'battle' || side !== 'chr') return; const E = ENG.trap;
      if (S.pts < E.cost || (S.eng.trap || 0) >= E.lim[side]) return;
      const u = ownUnits(g, side, c.ids).find(u => UT[u.type].cls === 'inf' && !u.under && trapOk(g, side, u.x, u.y)); if (!u) return;
      const i = cellIdx(g.map, u.x, u.y), p = cellCenter(g.map, i);
      g.traps.push({ id:g.mineId++, i, x:p.x, y:p.y, side, rev:{ fed:false, chr:true } }); S.pts -= E.cost; S.eng.trap = (S.eng.trap || 0) + 1;
      g.ev.push({ e:'trapset', side, x:Math.round(p.x), y:Math.round(p.y) }); return;
    }
    case 'air': {
      if (g.phase !== 'battle' || side !== 'fed' || S.cd4 > 0 || S.pts < AIR.cost) return;
      S.pts -= AIR.cost; S.cd4 = AIR.cd;
      const en = g.entry.fed, ex = en.reduce((a, b) => a + b.x, 0)/en.length, ey = en.reduce((a, b) => a + b.y, 0)/en.length;
      let dx = c.x - ex, dy = c.y - ey; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
      g.air.push({ id:g.mineId++, side, x:c.x - dx*1800, y:c.y - dy*1800, dx, dy, tx:c.x, ty:c.y, hp:AIR.hp, dropped:0, nextDrop:0 });
      g.ev.push({ e:'air', side, x:Math.round(c.x), y:Math.round(c.y) }); return;
    }
    case 'board': {
      if (g.phase !== 'deploy' && g.phase !== 'battle') return;
      const v = g.byId.get(c.target); if (!v || v.dead || v.side !== side || !UT[v.type].cap || v.cargo) return;
      const inf = ownUnits(g, side, c.ids).filter(u => UT[u.type].cls === 'inf' && UT[u.type].men <= 9);
      const u = inf.sort((a, b) => dist(a, v) - dist(b, v))[0]; if (!u) return;
      if (g.phase === 'deploy'){ u.carrier = v.id; v.cargo = u.id; u.x = v.x; u.y = v.y; return; }
      u.board = v.id; u.focus = 0; const p = findPath(g.map, 'foot', u.x, u.y, v.x, v.y); if (p){ u.path = p; u.dest = p[p.length-1]; } return;
    }
    case 'unload': {
      if (g.phase !== 'deploy' && g.phase !== 'battle') return;
      for (const v of ownUnits(g, side, c.ids)) if (v.cargo){ const cu = unloadCargo(g, v); if (cu) g.ev.push({ e:'dis', side, id:v.id, x:Math.round(v.x), y:Math.round(v.y) }); }
      return;
    }
    case 'smoke': {
      if (g.phase !== 'battle') return;
      for (const u of ownUnits(g, side, c.ids)){
        if (u.smk <= 0) continue; u.smk--; const d = UT[u.type];
        const a = d.cls === 'veh' ? u.ta : u.h, r = d.cls === 'veh' ? 34 : 20, off = d.cls === 'veh' ? 38 : 10;
        addSmoke(g, u.x + Math.cos(a)*off, u.y + Math.sin(a)*off, r, d.cls === 'veh' ? 45 : 35);
      }
      return;
    }
    case 'asmoke': {
      if (g.phase !== 'battle') return; const A = AB2[side];
      if (S.cd2 > 0 || S.pts < A.cost) return;
      S.pts -= A.cost; S.cd2 = A.cd;
      for (let i = 0; i < A.shells; i++) g.shells.push({ x:c.x + gauss()*A.scatter*1.4, y:c.y + gauss()*A.scatter*1.4, t:g.t + A.delay + i*.6, side, A, smoke:true });
      g.artyMarks.push({ side, x:c.x, y:c.y, t:g.t + A.delay, end:g.t + A.delay + A.shells*.6 + .5, smoke:true });
      return;
    }
    case 'flare': {
      if (g.phase !== 'battle' || !g.night) return;
      if (S.cd3 > 0 || S.pts < FLARE.cost) return;
      S.pts -= FLARE.cost; S.cd3 = FLARE.cd;
      g.flares.push({ x:c.x, y:c.y, t0:g.t, until:g.t + FLARE.life, side }); g.ev.push({ e:'flare', x:Math.round(c.x), y:Math.round(c.y), side });
      return;
    }
    case 'redeploy': {
      if (g.phase !== 'deploy') return; const u = ownUnits(g, side, [c.id])[0]; if (!u) return;
      if (!((inRects(g.sc.deploy[side], c.x, c.y) || infilOk(g, side, u.type, c.x, c.y)) && passableAt(g.map, UT[u.type].mc, c.x, c.y))) return;
      u.x = c.x; u.y = c.y; if (u.cargo){ const cu = g.byId.get(u.cargo); if (cu){ cu.x = u.x; cu.y = u.y; } } return;
    }
    case 'ready': {
      if (g.players && g.players.length && CUR_PID !== undefined){
        g.pready = g.pready || {}; g.pready[CUR_PID] = !!c.v;
        const t = teamOf(g, side); S.ready = t.length ? t.every(p => g.pready[p.pid]) : true;
      } else S.ready = !!c.v;
      return;
    }
    case 'buy': {
      if (g.phase !== 'battle') return; const d = UT[c.type];
      if (!d || d.side !== side || !deckOf(g, side).includes(c.type)) return;
      if (S.pts < d.cost || (S.used[c.type] || 0) >= d.limit) return;
      if (c.x !== undefined){
        if (!infilOk(g, side, c.type, c.x, c.y)){ g.ev.push({ e:'buyfail', side, x:Math.round(c.x), y:Math.round(c.y) }); return; }
        const p = cellCenter(g.map, cellIdx(g.map, c.x, c.y));
        S.pts -= d.cost; S.used[c.type] = (S.used[c.type] || 0) + 1; g.arrivals.push({ type:c.type, side, at:g.t + ARRIVE + 3, x:p.x, y:p.y, owner:CUR_PID || 0 }); return;
      }
      S.pts -= d.cost; S.used[c.type] = (S.used[c.type] || 0) + 1; g.arrivals.push({ type:c.type, side, at:g.t + ARRIVE, owner:CUR_PID || 0 }); return;
    }
    case 'afire': {
      if (g.phase !== 'battle') return;
      for (const u of ownUnits(g, side, c.ids)){ if (!UT[u.type].weapons.some(w => w.k !== 'at')) continue; u.afire = { x:c.x, y:c.y, until:g.t + 40 }; u.focus = 0; }
      return;
    }
    case 'move': {
      if (g.phase === 'deploy'){ const us = ownUnits(g, side, c.ids); if (us.length) planMove(g, us, c.x, c.y, !!c.fast, !!c.queue); return; }
      if (g.phase !== 'battle') return; const us = ownUnits(g, side, c.ids); if (us.length) formationMove(g, us, c.x, c.y, !!c.fast, !!c.queue); if (!c.queue) for (const u of us){ u.focus = 0; u.afire = null; } return; }
    case 'fmode': { for (const u of ownUnits(g, side, c.ids, true)) u.ambush = !!c.v; return; }
    case 'attack': {
      if (g.phase !== 'battle') return; const tg = g.byId.get(c.target); if (!tg || tg.side === side || tg.dead) return;
      for (const u of ownUnits(g, side, c.ids)){
        const d = UT[u.type]; if (!d.weapons.length) continue; u.focus = tg.id;
        if (dist(u, tg) > d.maxRange*.85 || !u.shootable.includes(tg)){ const p = findPath(g.map, d.mc, u.x, u.y, tg.x, tg.y); if (p){ u.path = p; u.dest = p[p.length-1]; u.fast = false; } }
      }
      return;
    }
    case 'stop': if (g.phase === 'deploy'){ for (const u of ownUnits(g, side, c.ids)) u.q = null; return; }
      for (const u of ownUnits(g, side, c.ids)){ u.path = null; u.dest = null; u.focus = 0; u.fast = false; u.board = 0; u.afire = null; u.q = null; } return;
    case 'tunnel': {
      if (g.phase !== 'battle' || side !== 'chr') return;
      const m = g.map, to = cellIdx(m, c.x, c.y);
      for (const u of ownUnits(g, side, c.ids)){
        if (UT[u.type].cls !== 'inf' || u.under) continue;
        const p = cellarPath(m, cellIdx(m, u.x, u.y), to); if (!p || p.length < 2) continue;
        u.under = true; u.upath = p.slice(1); u.path = null; u.dest = p[p.length - 1]; u.focus = 0; u.afire = null; u.supp = 0;
        g.ev.push({ e:'dive', side, id:u.id });
      }
      return;
    }
    case 'ability': {
      if (g.phase !== 'battle') return; const A = AB[side];
      if (S.ch === undefined) S.ch = A.charges || 1;
      if (S.ch <= 0 || S.pts < A.cost) return;
      S.pts -= A.cost; S.ch--; if (S.ch <= 0) S.cd = A.cd;
      for (let i = 0; i < A.shells; i++) g.shells.push({ x:c.x + gauss()*A.scatter*1.6, y:c.y + gauss()*A.scatter*1.6, t:g.t + A.delay + i*.55, side, A });
      g.artyMarks.push({ side, x:c.x, y:c.y, t:g.t + A.delay, end:g.t + A.delay + A.shells*.55 + .5 });
      return;
    }
  }
}

function addSmoke(g, x, y, r, life){ g.smokes.push({ x, y, r, t0:g.t, until:g.t + life }); g.ev.push({ e:'smk', x:Math.round(x), y:Math.round(y), r }); if (g.smokes.length > 40) g.smokes.shift(); }
function smokeR(g, s){ const age = g.t - s.t0; if (age < 1) return 0; return s.r*Math.min(1, age/3)*clamp((s.until - g.t)/8, 0, 1); }
function smokeBlocks(g, x1, y1, x2, y2){
  for (const s of g.smokes){
    const r = smokeR(g, s); if (r <= 0) continue;
    const dx = x2-x1, dy = y2-y1, L = dx*dx + dy*dy; let k = L ? ((s.x-x1)*dx + (s.y-y1)*dy)/L : 0; k = clamp(k, 0, 1);
    if (Math.hypot(x1 + dx*k - s.x, y1 + dy*k - s.y) < r*.85) return true;
  }
  return false;
}
const lit = (g, x, y) => g.flares.some(f => Math.hypot(f.x - x, f.y - y) < FLARE.r);

/* ================= ОБНАРУЖЕНИЕ ================= */
function detectRange(g, a, b){
  const da = UT[a.type], db = UT[b.type];
  let r = da.vision, st = db.cls === 'veh' ? 1.25 : db.stealth;
  const tb = terrAt(g.map, b.x, b.y);
  if (db.cls === 'inf'){ if (tb === T.BLD) st *= .45; else if (tb === T.FOREST) st *= .55; else if (tb === T.ROCK || tb === T.RUBBLE) st *= .6; }
  else if (tb === T.FOREST) st *= .7;
  const flash = g.t - b.fired < 3;
  if (flash) st = Math.max(st, 1)*1.4;
  if (b.fast) st *= 1.2;
  if (g.night && !lit(g, b.x, b.y)) r *= flash ? .9 : .45;
  if (db.cls === 'inf' && tb === T.BARR) st *= .6;
  if (da.cls === 'veh' && db.cls === 'inf') r *= .6; // экипаж с закрытыми люками видит плохо
  return r*st;
}
function updateVis(g){
  const us = g.units;
  for (const u of us){ u.vis.fed = u.side === 'fed'; u.vis.chr = u.side === 'chr'; u._c = []; }
  for (let i = 0; i < us.length; i++){
    const a = us[i]; if (a.dead || a.carrier || a.under) continue; const da = UT[a.type];
    for (let j = i+1; j < us.length; j++){
      const b = us[j]; if (b.dead || b.carrier || b.under || b.side === a.side) continue; const db = UT[b.type];
      const d = Math.hypot(b.x-a.x, b.y-a.y);
      const ra = Math.max(da.vision*1.5, da.maxRange), rb = Math.max(db.vision*1.5, db.maxRange);
      if (d > ra && d > rb) continue;
      if (!los(g.map, a.x, a.y, b.x, b.y) || (g.smokes.length && smokeBlocks(g, a.x, a.y, b.x, b.y))) continue;
      if (d <= detectRange(g, a, b)) b.vis[a.side] = true;
      if (d <= detectRange(g, b, a)) a.vis[b.side] = true;
      if (d <= da.maxRange) a._c.push(b);
      if (d <= db.maxRange) b._c.push(a);
    }
  }
  for (const a of us) a.shootable = a._c.filter(b => b.vis[a.side]);
  // автоматический гранатомёт бьёт навесом по целям, которые видят свои
  for (const a of us){
    if (a.dead || a.carrier || a.under || !UT[a.type].hasGL) continue;
    a.glT = us.filter(b => !b.dead && !b.carrier && !b.under && b.side !== a.side && b.vis[a.side] && Math.hypot(b.x - a.x, b.y - a.y) <= 600 && Math.hypot(b.x - a.x, b.y - a.y) >= 40);
  }
}

/* ================= БОЙ ================= */
function targetScore(u, w, ws, b, d){
  const db = UT[b.type];
  let s;
  if (db.cls === 'veh'){
    const minA = Math.min(db.armor.s, db.armor.r);
    if (w.k === 'at') s = 3; else if (w.pen >= minA*.9) s = w.k === 'cannon' ? 2.2 : 1.2; else s = 0;
  } else {
    if (w.noInf) s = 0;
    else if (w.k === 'at') s = (ws.ammo > 2 && b.inB) ? .5 : 0;
    else s = 2;
  }
  return s/(d + 60);
}
function pickTarget(g, u, w, ws){
  if (w.manual) return null;
  let best = null, bs = 0;
  for (const b of (w.gl && u.glT ? u.glT : u.shootable)){
    if (b.dead) continue; const d = dist(u, b);
    if (d > w.r || d < (w.min || 0)) continue;
    const s = targetScore(u, w, ws, b, d); if (s <= 0) continue;
    if (u.focus === b.id) return b;
    if (s > bs){ bs = s; best = b; }
  }
  return best;
}
const menOf = (d, hp) => hp <= 0 ? 0 : Math.max(1, Math.ceil(hp/(d.hp/d.men)));
function damage(g, b, dmg){
  if (b.dead) return;
  const bd = UT[b.type], m0 = bd.cls === 'inf' ? menOf(bd, b.hp) : 0;
  b.hp -= dmg;
  if (bd.cls === 'inf'){ const m1 = menOf(bd, b.hp); if (m1 < m0) g.ev.push({ e:'man', x:Math.round(b.x), y:Math.round(b.y), n:m0 - m1, side:b.side, id:b.id }); }
  if (b.hp <= 0 && b.cargo){
    const c = unloadCargo(g, b);
    if (c){ c.supp = 100; c.hitT = g.t; damage(g, c, c.hp*.55); }
  }
  if (b.hp <= 0){
    b.dead = true; const d = UT[b.type], S = g.sides[b.side], E = g.sides[other(b.side)];
    S.lostVal += d.cost; if (d.cls === 'veh'){ S.lostVeh++; g.map.obst[cellIdx(g.map, b.x, b.y)] = 1; } else S.lostMen += d.men;
    E.score += d.killVal !== undefined ? d.killVal : d.cost*.5;
    g.ev.push({ e:'kill', id:b.id, x:Math.round(b.x), y:Math.round(b.y), h:Math.round(b.h*100), ta:Math.round((b.ta || 0)*100), v:d.cls === 'veh' ? 1 : 0, side:b.side, type:b.type });
  } else if (UT[b.type].cls === 'inf'){
    // гибель бойцов ослабляет отряд
  }
}
function splash(g, x, y, r, dmg, pen, exclude, side){
  if (g.map.props && r >= 8) propHit(g, x, y, r*1.1);
  for (const u of g.units){
    if (u.dead || u.carrier || u.under || u.id === exclude) continue;
    const d = Math.hypot(u.x-x, u.y-y); if (d > r*2) continue;
    const du = UT[u.type];
    u.supp = Math.min(120, u.supp + (du.cls === 'veh' ? 8 : 30)*(1 - d/(r*2))); u.hitT = g.t;
    if (d > r) continue; const f = (1 - Math.pow(d/r, 1.6))*(d < 4 ? 1.5 : 1);
    if (du.cls === 'inf') damage(g, u, dmg*f*(u.inB ? .5 : 1));
    else damage(g, u, du.armor.t < pen ? dmg*.8*f : dmg*.04*f);
  }
  const dead = [];
  for (const c of g.civs){
    if (c.dead || c.st === 3) continue;
    const d = Math.hypot(c.x-x, c.y-y); if (d > r*1.2) continue;
    const hid = terrAt(g.map, c.x, c.y) === T.BLD;
    if (Math.random() < (1 - d/(r*1.2))*(hid ? .25 : .85)){ c.dead = true; dead.push([Math.round(c.x), Math.round(c.y), c.id]); }
    else { c.scare = g.t; }
  }
  if (dead.length) civLoss(g, dead, x, y, side);
}
function civLoss(g, dead, x, y, side){
  const n = dead.length; g.civDead += n;
  if (side){ const S = g.sides[side]; S.civK += n; S.score = Math.max(0, S.score - CIV_PEN*n); }
  g.ev.push({ e:'civ', n, x:Math.round(x), y:Math.round(y), side:side || 0, p:dead });
}
function collapse(g, i, side){
  const m = g.map; m.t[i] = T.RUBBLE; m.bst[i] = 2; m.bhp[i] = 0; g.bldDown++;
  const p = cellCenter(m, i);
  g.ev.push({ e:'bd', i, s:2 });
  for (const u of g.units) if (!u.dead && !u.carrier && cellIdx(m, u.x, u.y) === i && UT[u.type].cls === 'inf'){ damage(g, u, 22); u.supp = Math.min(120, u.supp + 60); }
  const dead = [];
  for (const c of g.civs) if (!c.dead && c.st !== 3 && cellIdx(m, c.x, c.y) === i){ if (Math.random() < .5){ c.dead = true; dead.push([Math.round(c.x), Math.round(c.y), c.id]); } else { c.st = 1; c.path = null; c.scare = g.t; } }
  if (dead.length) civLoss(g, dead, p.x, p.y, side);
}
// пожары: фугасы поджигают дома, огонь идёт по зданию, выгоняет пехоту и подтачивает стены
function ignite(g, i, side){
  const m = g.map; if (m.t[i] !== T.BLD || g.fires.has(i)) return;
  g.fires.set(i, { until:g.t + 55 + Math.random()*45, spread:g.t + 4 + Math.random()*3, side });
  g.ev.push({ e:'fire', i, side:side || 0 });
}
function updateAir(g, dt){
  if (!g.air.length) return;
  for (const p of g.air){
    p.x += p.dx*AIR.speed*dt; p.y += p.dy*AIR.speed*dt;
    const along = (p.x - p.tx)*p.dx + (p.y - p.ty)*p.dy;
    if (p.hp > 0 && p.dropped < AIR.bombs && along > -150 && p.nextDrop <= g.t){
      p.dropped++; p.nextDrop = g.t + .16;
      g.shells.push({ x:p.x + p.dx*70 + gauss()*14, y:p.y + p.dy*70 + gauss()*14, t:g.t + .9, side:p.side, A:{ r:AIR.r, dmg:AIR.dmg, pen:AIR.pen, bdmg:AIR.bdmg } });
    }
    for (const u of g.units){
      if (u.dead || u.carrier || u.under || u.side === p.side || p.hp <= 0) continue;
      const d = UT[u.type], w = d.weapons.find(w => w.aa); if (!w) continue;
      const dd = Math.hypot(u.x - p.x, u.y - p.y); if (dd > w.r) continue;
      u.aaT = (u.aaT || 0) - dt; if (u.aaT > 0) continue;
      u.aaT = w.rof*1.1; u.fired = g.t;
      g.ev.push({ e:'aa', a:[Math.round(u.x), Math.round(u.y), Math.round(p.x), Math.round(p.y)], sid:u.id });
      if (Math.random() < .15*(1 - dd/w.r*.5)*(u.supp >= 70 ? .4 : 1)) p.hp -= w.aadmg || 12;
    }
    if (p.hp <= 0 && !p.down){
      p.down = true; g.sides[other(p.side)].score += AIR.kill;
      g.ev.push({ e:'crash', side:p.side, x:Math.round(p.x), y:Math.round(p.y) });
      g.shells.push({ x:p.x + p.dx*230, y:p.y + p.dy*230, t:g.t + 1.6, side:p.side, A:{ r:24, dmg:40, pen:20, bdmg:90 } });
    }
    p.along = along;
  }
  g.air = g.air.filter(p => !p.down && p.along < 2000);
}
function updateFires(g, dt){
  if (!g.fires.size) return;
  const m = g.map, W = m.W;
  for (const [i, f] of [...g.fires]){
    if (m.t[i] !== T.BLD || g.t > f.until){ g.fires.delete(i); g.ev.push({ e:'fireout', i }); continue; }
    m.bhp[i] -= 1.2*dt;
    if (m.bst[i] === 0 && m.bhp[i] < bldMax(m, i)*.5){ m.bst[i] = 1; g.ev.push({ e:'bd', i, s:1 }); }
    if (m.bhp[i] <= 0){ g.fires.delete(i); collapse(g, i, f.side); continue; }
    if (g.t >= f.spread){
      f.spread = g.t + 4 + Math.random()*3;
      const x = i % W, y = Math.floor(i/W);
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]){ const X = x+dx, Y = y+dy; if (X < 0 || Y < 0 || X >= W || Y >= m.H) continue; const j = Y*W+X;
        if (m.t[j] === T.BLD && m.res[j] === m.res[i] && Math.random() < .2) ignite(g, j, f.side); }
    }
  }
  for (const u of g.units){
    if (u.dead || u.carrier || u.under || UT[u.type].cls !== 'inf') continue;
    const ci = cellIdx(m, u.x, u.y); if (!g.fires.has(ci)) continue;
    u.supp = Math.min(120, u.supp + 40*dt); u.hitT = g.t; damage(g, u, 3*dt); u.inFire = true;
  }
  for (const c of g.civs) if (!c.dead && c.st !== 3 && g.fires.has(cellIdx(m, c.x, c.y))){ c.scare = g.t; if (c.st === 2) c.st = 1; c.path = null; }
}
function damageBuilding(g, x, y, amt, rc, side){
  const m = g.map, cx = Math.floor(x/CELL), cy = Math.floor(y/CELL);
  if (cx < 0 || cy < 0 || cx >= m.W || cy >= m.H) return;
  const ci = cy*m.W + cx; if (m.t[ci] === T.BLD && m.res[ci]) g.bldHits++;
  for (let dy = -rc; dy <= rc; dy++) for (let dx = -rc; dx <= rc; dx++){
    const X = cx+dx, Y = cy+dy; if (X < 0 || Y < 0 || X >= m.W || Y >= m.H) continue;
    const i = Y*m.W + X;
    if (m.t[i] === T.BARR){ m.bhp[i] -= amt*((dx || dy) ? .6 : 1); if (m.bhp[i] <= 0){ m.t[i] = T.RUBBLE; g.ev.push({ e:'ter', i, v:T.RUBBLE }); } continue; }
    if (m.t[i] !== T.BLD) continue;
    const hit = amt*((dx || dy) ? .6 : 1);
    m.bhp[i] -= hit*(.7 + Math.random()*.6);
    if (m.bhp[i] <= 0) collapse(g, i, side);
    else if (Math.random() < Math.min(.22, hit/420)) ignite(g, i, side);
    else if (m.bst[i] === 0 && m.bhp[i] < bldMax(m, i)*.5){ m.bst[i] = 1; g.ev.push({ e:'bd', i, s:1 }); }
  }
}
function fireAt(g, u, w, ws, b){
  const d = dist(u, b), du = UT[u.type], db = UT[b.type];
  u.fired = g.t; if (isFinite(ws.ammo)) ws.ammo--;
  if (Math.random() < .25) g.noise.push({ x:b.x, y:b.y, t:g.t });
  let p = w.acc*du.acc;
  p *= 1 - .55*Math.pow(d/w.r, 2);
  if (u.moving) p *= du.cls === 'veh' ? .6 : .45;
  if (b.moving) p *= .8;
  p *= 1 - .6*Math.min(u.supp, 100)/100;
  if (db.cls === 'inf'){
    const tb = terrAt(g.map, b.x, b.y);
    let c = 1; if (g.map.props && g.map.props.some(pr => pr.st !== 2 && Math.abs(pr.x - b.x) < 8 && Math.abs(pr.y - b.y) < 8)) c = .7; if (g.map.obst[cellIdx(g.map, b.x, b.y)]) c = .6; if (tb === T.BLD) c = w.he ? .7 : .35; else if (tb === T.RUBBLE) c = w.he ? .65 : .5; else if (tb === T.FOREST) c = .6; else if (tb === T.ROCK) c = .5;
    p *= c;
    if (w.lowElev && b.inB && d < 70) p *= .3; // пушка танка не задирается на верхние этажи
    if (w.gren) p = w.acc*du.acc*(1 - .6*Math.min(u.supp, 100)/100)*(u.moving ? .7 : 1); // граната в окно или за угол
  } else if (w.k === 'small' || w.k === 'mg') p *= 1.3;
  const hit = Math.random() < Math.min(.95, p);
  const mx = hit ? 0 : gauss()*25, my = hit ? 0 : gauss()*25;
  g.ev.push({ e:'s', a:[Math.round(u.x), Math.round(u.y), Math.round(b.x+mx), Math.round(b.y+my)], k:w.k, sid:u.id, tid:b.id, gr:w.gren ? 1 : 0, gl:w.gl ? 1 : 0 });
  b.supp = Math.min(120, b.supp + w.supp*(hit ? 1 : .55)*(db.cls === 'veh' ? .3 : (b.inB ? .6 : 1))); b.hitT = g.t;
  if (!hit){ if (w.splash) splash(g, b.x+mx, b.y+my, w.splash, w.di*.4, 5, -1, u.side); if (w.bd) damageBuilding(g, b.x+mx, b.y+my, w.bd*.6, 0, u.side); return; }
  if (db.cls === 'inf'){
    let dmg = w.di;
    if (du.cls === 'inf' && (w.k === 'small' || w.k === 'mg')) dmg *= Math.max(.35, u.hp/du.hp);
    damage(g, b, dmg*(.7 + Math.random()*.6));
    if (w.bd && (b.inB || w.he)) damageBuilding(g, b.x, b.y, w.bd, 0, u.side);
    if (w.splash) splash(g, b.x, b.y, w.splash, w.di*.5, 5, b.id, u.side);
  } else {
    const ang = Math.atan2(u.y-b.y, u.x-b.x), rel = Math.abs(angDiff(ang, b.h));
    let face = rel < Math.PI/4 ? 'f' : rel > Math.PI*.75 ? 'r' : 's';
    if (w.k === 'at' && u.inB && d < 150 && Math.random() < .6) face = 't';
    const arm = db.armor[face], pen = w.pen*(.85 + Math.random()*.3);
    if (pen > arm){
      let dmg = w.dv*(.7 + Math.random()*.6);
      if (db.cookoff && w.k === 'at' && Math.random() < .18){ dmg = 9999; g.ev.push({ e:'cook', x:Math.round(b.x), y:Math.round(b.y) }); }
      g.ev.push({ e:'pen', x:Math.round(b.x), y:Math.round(b.y), f:face });
      damage(g, b, dmg);
    } else {
      g.ev.push({ e:'ric', x:Math.round(b.x), y:Math.round(b.y) });
      damage(g, b, w.dv*.04);
    }
  }
}

function areaFire(g, u, d, w, ws){
  const A = u.afire; if (g.t > A.until){ u.afire = null; return false; }
  const dd = Math.hypot(A.x - u.x, A.y - u.y); if (dd > w.r || dd < (w.min || 0)) return false;
  if (!w.gl && !los(g.map, u.x, u.y, A.x, A.y)) return false;
  if (d.cls === 'veh'){ u.aim = Math.atan2(A.y - u.y, A.x - u.x); u.aimT = g.t; if (Math.abs(angDiff(u.aim, u.ta)) > .18){ ws.cd = .1; return true; } }
  const ix = A.x + gauss()*10, iy = A.y + gauss()*10, inB = terrAt(g.map, A.x, A.y) === T.BLD;
  u.fired = g.t; if (isFinite(ws.ammo)) ws.ammo--;
  g.ev.push({ e:'s', a:[Math.round(u.x), Math.round(u.y), Math.round(ix), Math.round(iy)], k:w.k, sid:u.id, tid:0, gl:w.gl ? 1 : 0 });
  g.noise.push({ x:ix, y:iy, t:g.t });
  if (w.he){
    const eff = w.lowElev && dd < 70 && inB ? .35 : 1;
    splash(g, ix, iy, (w.splash || 6)*1.2, w.di*.6*eff, 5, -1, u.side);
    if (w.bd) damageBuilding(g, ix, iy, w.bd*eff, 0, u.side);
  } else {
    for (const t of g.units){
      if (t.dead || t.carrier || t.side === u.side) continue; const r = Math.hypot(t.x - ix, t.y - iy); if (r > 30) continue;
      t.supp = Math.min(120, t.supp + w.supp*.5*(t.inB ? .6 : 1)); t.hitT = g.t;
      if (UT[t.type].cls === 'inf' && r < 14 && Math.random() < .15) damage(g, t, w.di*.5*(t.inB ? .5 : 1));
    }
  }
  ws.cd = w.rof*(.9 + Math.random()*.3);
  return true;
}
function separateVehicles(g, dt){
  const vs = g.units.filter(u => !u.dead && !u.carrier && UT[u.type].cls === 'veh'), m = g.map, R = 10;
  for (let i = 0; i < vs.length; i++) for (let j = i + 1; j < vs.length; j++){
    const a = vs[i], b = vs[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
    if (d >= R) continue;
    const nx = d > .01 ? dx/d : Math.cos(a.id), ny = d > .01 ? dy/d : Math.sin(a.id), push = Math.min((R - d)*.5, 12*dt + (R - d)*.2);
    const ka = a.moving || !b.moving ? 1 : .3, kb = b.moving || !a.moving ? 1 : .3;
    const ax = a.x - nx*push*ka, ay = a.y - ny*push*ka, bx = b.x + nx*push*kb, by = b.y + ny*push*kb;
    if (passableAt(m, UT[a.type].mc, ax, ay)){ a.x = ax; a.y = ay; }
    if (passableAt(m, UT[b.type].mc, bx, by)){ b.x = bx; b.y = by; }
  }
  // не въезжать в остовы: если впереди на пути появился остов — перестроить маршрут
  for (const u of vs){
    if (!u.path || !u.path.length || u.immob) continue;
    const p = u.path[0], k = Math.min(1, 12/Math.max(1, Math.hypot(p.x - u.x, p.y - u.y)));
    const ci = cellIdx(m, u.x + (p.x - u.x)*k, u.y + (p.y - u.y)*k);
    if (m.obst[ci] && ci !== cellIdx(m, u.x, u.y) && u.dest){ const np = findPath(m, UT[u.type].mc, u.x, u.y, u.dest.x, u.dest.y); u.path = np; if (!np) u.dest = null; }
  }
}
function updateUnit(g, u, dt){
  const d = UT[u.type];
  u.supp = Math.max(0, u.supp - (g.t - u.hitT > 3 ? 14 : 5)*dt);
  const pinned = u.supp >= 70;
  const tr = terrAt(g.map, u.x, u.y); u.inB = tr === T.BLD;
  if (u.immob && u.path){ u.path = null; u.dest = null; }
  // посадка на броню
  if (u.under){
    const p = u.upath[0];
    if (!p){ u.under = false; u.dest = null; g.ev.push({ e:'emerge', side:u.side, id:u.id, x:Math.round(u.x), y:Math.round(u.y) }); return; }
    const dx = p.x - u.x, dy = p.y - u.y, dd = Math.hypot(dx, dy), st = GAME_SPEED*2.6*dt;
    if (st >= dd){ u.x = p.x; u.y = p.y; u.upath.shift(); } else { u.x += dx/dd*st; u.y += dy/dd*st; }
    u.moving = true; return;
  }
  if (u.board){
    const v = g.byId.get(u.board);
    if (!v || v.dead || v.cargo || v.side !== u.side) u.board = 0;
    else if (dist(u, v) < 20){ u.board = 0; u.carrier = v.id; v.cargo = u.id; u.path = null; u.dest = null; g.ev.push({ e:'mount', side:u.side, id:v.id }); return; }
    else if (!u.path || (g.t % 2 < dt)){ const p = findPath(g.map, 'foot', u.x, u.y, v.x, v.y); if (p){ u.path = p; u.dest = p[p.length-1]; } }
  }
  // атака: подъехать и остановиться
  if (u.focus){
    const tg = g.byId.get(u.focus);
    if (!tg || tg.dead) u.focus = 0;
    else if (u.path && u.shootable.includes(tg) && dist(u, tg) <= d.maxRange*.85){ u.path = null; u.dest = null; }
  }
  if (u.path && u.path.length){
    const p = u.path[0], dx = p.x-u.x, dy = p.y-u.y, dd = Math.hypot(dx, dy);
    const mc = MOVE[d.mc][tr]; let sp = GAME_SPEED*d.speed/(isFinite(mc) ? mc : 2);
    if (u.fast) sp *= 1.4; if (pinned) sp *= .4;
    if (g.winter && tr !== T.ROAD && tr !== T.BRIDGE) sp *= d.mc === 'wheel' ? .7 : d.mc === 'foot' ? .9 : .92;
    if (d.cls === 'veh' && dd > .5){
      const want = Math.atan2(dy, dx), diff = angDiff(want, u.h), turn = 2.2*dt;
      if (Math.abs(diff) > turn){ u.h += Math.sign(diff)*turn; if (Math.abs(diff) > .8) sp *= .25; } else u.h = want;
    } else if (dd > .5) u.h = Math.atan2(dy, dx);
    const stp = sp*dt;
    if (stp >= dd){ u.x = p.x; u.y = p.y; u.path.shift();
      if (!u.path.length){ u.path = null; u.dest = null; u.fast = false;
        if (u.q && u.q.length){ const nx = u.q.shift(); const np = findPath(g.map, d.mc, u.x, u.y, nx.x, nx.y); if (np){ u.path = np; u.dest = np[np.length-1]; u.fast = nx.fast; } if (!u.q.length) u.q = null; } } }
    else { u.x += dx/dd*stp; u.y += dy/dd*stp; }
    u.moving = true;
  } else u.moving = false;
  if (d.cls === 'veh'){
    const want = g.t - u.aimT < 3 ? u.aim : u.h, diff = angDiff(want, u.ta), tr2 = 1.1*dt;
    u.ta = Math.abs(diff) <= tr2 ? want : u.ta + Math.sign(diff)*tr2;
  }
  if (u.fast && u.moving) return;
  for (let i = 0; i < d.weapons.length; i++){
    const w = d.weapons[i], ws = u.w[i]; ws.cd -= dt;
    if (ws.cd > 0 || ws.ammo <= 0) continue;
    let tg = pickTarget(g, u, w, ws);
    if (tg && u.ambush && tg.id !== u.focus && g.t - u.hitT > 3 && dist(u, tg) > 90) tg = null;
    if (tg && u.ambush) u.ambush = u.ambush && !(g.t - u.hitT <= 3);
    if (!tg){ if (!(u.afire && w.k !== 'at' && areaFire(g, u, d, w, ws))) ws.cd = .3; continue; }
    if (d.cls === 'veh'){ // башня должна довернуться на цель
      u.aim = Math.atan2(tg.y - u.y, tg.x - u.x); u.aimT = g.t;
      if (Math.abs(angDiff(u.aim, u.ta)) > .18){ ws.cd = .1; continue; }
    }
    fireAt(g, u, w, ws, tg);
    ws.cd = w.rof*(.85 + Math.random()*.3)*(pinned ? 1.6 : 1);
  }
}

function startRound2(g){
  const sc = g.sc;
  g.round = 2; g.phase = 'deploy'; g.phaseT = sc.deployTime; g.pready = {};
  g.units = []; g.byId.clear();
  g.sides = { fed:mkSide(sc.start.fed), chr:mkSide(sc.start.chr) };
  g.objs = sc.objectives.map(o => ({ ...o, prog: o.owner === 'fed' ? 100 : o.owner === 'chr' ? -100 : 0 }));
  g.shells = []; g.artyMarks = []; g.arrivals = []; g.mines = []; g.smokes = []; g.flares = []; g.delayed = []; g.fires = new Map(); g.traps = []; g.air = [];
  for (const c of g.civs) if (!c.dead && c.st !== 3){ c.st = 0; c.path = null; }
  g.night = g.tod === 'night' || g.tod === 'daynight';
  spawnConvoy(g);
  g.ev.push({ e:'round2' });
}
function roundSum(g, res){ const f = s => { const S = g.sides[s]; return { s:Math.floor(S.score), lm:S.lostMen, lvh:S.lostVeh, ck:S.civK, lv:S.lostVal }; }; return { res, fed:f('fed'), chr:f('chr') }; }
function step(g, dt){
  if (g.phase === 'end') return;
  if (g.phase === 'inter'){ g.phaseT -= dt; if (g.phaseT <= 0) startRound2(g); return; }
  if (g.phase === 'deploy'){
    g.phaseT -= dt;
    if (g.players && g.players.length) for (const s of SIDES) if (!teamOf(g, s).length) g.sides[s].ready = true;
    if (g.phaseT <= 0 || (g.sides.fed.ready && g.sides.chr.ready)){ g.phase = 'battle'; g.phaseT = g.sc.duration; g.ev.push({ e:'battle' }); updateVis(g); launchPlans(g); }
    return;
  }
  g.t += dt; g.phaseT -= dt;
  for (const s of SIDES){ const S = g.sides[s]; S.pts += S.inc*dt; if (S.cd > 0){ S.cd -= dt; if (S.cd <= 0) S.ch = AB[s].charges || 1; } else if (S.ch !== undefined && S.ch <= 0) S.ch = AB[s].charges || 1; if (S.ch === undefined) S.ch = AB[s].charges || 1; if (S.cd4 > 0) S.cd4 -= dt; if (S.cd2 > 0) S.cd2 -= dt; if (S.cd3 > 0) S.cd3 -= dt; }
  g.smokes = g.smokes.filter(s => s.until > g.t); g.flares = g.flares.filter(f => f.until > g.t);
  // подкрепления
  for (const a of g.arrivals.filter(a => a.at <= g.t)){
    const pts = g.entry[a.side], e = a.x !== undefined ? { x:a.x, y:a.y } : pts[Math.floor(Math.random()*pts.length)], d = UT[a.type], sp = a.x !== undefined ? 0 : 30;
    const ci = nearestPassable(g.map, d.mc, cellIdx(g.map, e.x + gauss()*sp, e.y + gauss()*sp));
    if (ci >= 0){ const p = cellCenter(g.map, ci); const nu = spawnUnit(g, a.type, a.side, p.x, p.y); nu.owner = a.owner || 0; g.ev.push({ e:'arr', side:a.side, owner:nu.owner, type:a.type, id:nu.id, x:Math.round(p.x), y:Math.round(p.y), inf:a.x !== undefined ? 1 : 0 }); }
  }
  g.arrivals = g.arrivals.filter(a => a.at > g.t);
  g.visT -= dt; if (g.visT <= 0){ updateVis(g); g.visT = .25; }
  updateCivs(g, dt);
  for (const u of g.units) u.inFire = false;
  updateFires(g, dt);
  updateAir(g, dt);
  for (let k = g.traps.length - 1; k >= 0; k--){
    const tp = g.traps[k];
    const v = g.units.find(u => !u.dead && !u.carrier && !u.under && u.side !== tp.side && UT[u.type].cls === 'inf' && cellIdx(g.map, u.x, u.y) === tp.i);
    if (!v) continue;
    g.traps.splice(k, 1);
    g.ev.push({ e:'trap', side:v.side, x:Math.round(tp.x), y:Math.round(tp.y) });
    v.supp = 120; v.hitT = g.t; damage(g, v, 28); splash(g, tp.x, tp.y, 8, 10, 2, v.id, tp.side);
  }
  for (const u of g.units) if (!u.dead && !u.carrier) updateUnit(g, u, dt);
  separateVehicles(g, dt);
  if (g.map.props) for (const u of g.units){
    if (u.dead || u.carrier || !u.moving || UT[u.type].cls !== 'veh') continue;
    for (const pr of g.map.props) if (pr.st !== 2 && Math.abs(pr.x - u.x) < 7 && Math.abs(pr.y - u.y) < 7){ pr.st = 2; g.ev.push({ e:'prop', id:pr.id, s:2, x:Math.round(pr.x), y:Math.round(pr.y) }); }
  }
  for (const u of g.units) if (u.carrier){ const v = g.byId.get(u.carrier); if (v && !v.dead){ u.x = v.x; u.y = v.y; u.supp = 0; } else u.carrier = 0; }
  // мины
  for (let k = g.mines.length - 1; k >= 0; k--){
    const mn = g.mines[k];
    const v = g.units.find(u => !u.dead && u.side !== mn.side && UT[u.type].cls === 'veh' && Math.hypot(u.x - mn.x, u.y - mn.y) < 9);
    if (!v) continue;
    g.mines.splice(k, 1); const d = UT[v.type];
    g.ev.push({ e:'boom', x:Math.round(mn.x), y:Math.round(mn.y), big:0, mine:1 }); g.ev.push({ e:'mine', side:v.side, type:v.type, x:Math.round(mn.x), y:Math.round(mn.y) });
    damage(g, v, d.mc === 'track' ? 75 + Math.random()*30 : 120);
    if (!v.dead && d.mc === 'track'){ v.immob = true; v.path = null; v.dest = null; }
    else if (!v.dead){ v.immob = true; }
  }
  if (g.delayed.length){
    const due = g.delayed.filter(d => d.t <= g.t); g.delayed = g.delayed.filter(d => d.t > g.t);
    for (const d of due){ for (const id of d.c.ids){ const u = g.byId.get(id); if (u && u.pend && u.pend <= g.t + .01) u.pend = 0; } applyCommand(g, 'fed', d.c); }
  }
  g.engT -= dt;
  if (g.engT <= 0){
    g.engT = .5;
    for (const u of g.units) if (u.side === 'fed' && !u.dead) u.nocomm = !hasComm(g, u);
    for (const tp of g.traps){
      if (tp.rev.fed) continue;
      if (g.units.some(u => !u.dead && !u.carrier && u.side === 'fed' && UT[u.type].sapper && Math.hypot(u.x - tp.x, u.y - tp.y) < 40)){ tp.rev.fed = true; g.ev.push({ e:'trev', side:'fed', x:Math.round(tp.x), y:Math.round(tp.y) }); }
    }
    for (const mn of g.mines){
      const es = other(mn.side); if (mn.rev[es]) continue;
      for (const u of g.units){
        if (u.dead || u.carrier || u.side !== es) continue; const d = UT[u.type], r = Math.hypot(u.x - mn.x, u.y - mn.y);
        if ((d.sapper && r < 70) || (d.cls === 'inf' && r < 14 && Math.random() < .15)){ mn.rev[es] = true; g.ev.push({ e:'mrev', side:es, x:Math.round(mn.x), y:Math.round(mn.y) }); break; }
      }
    }
    for (const u of g.units){
      if (u.dead || u.carrier || !UT[u.type].sapper) continue;
      if (u.moving || u.supp >= 70){ u.work = 0; u.workT = null; continue; }
      let tgt = null;
      const mn = g.mines.find(n => n.side !== u.side && n.rev[u.side] && Math.hypot(n.x - u.x, n.y - u.y) < 28);
      const tq = g.traps.find(t => t.side !== u.side && t.rev[u.side] && Math.hypot(t.x - u.x, t.y - u.y) < 28);
      if (mn) tgt = { k:'mine', id:mn.id, need:5 };
      else if (tq) tgt = { k:'trap', id:tq.id, need:4 };
      else {
        const m = g.map, cx = Math.floor(u.x/CELL), cy = Math.floor(u.y/CELL);
        for (let dy = -1; dy <= 1 && !tgt; dy++) for (let dx = -1; dx <= 1 && !tgt; dx++){
          const X = cx+dx, Y = cy+dy; if (X < 0 || Y < 0 || X >= m.W || Y >= m.H) continue; const i = Y*m.W + X;
          if (m.t[i] === T.BARR && !(m.bown && m.bown[i] === (u.side === 'fed' ? 1 : 2))) tgt = { k:'barr', i, need:8 };
        }
      }
      if (!tgt){ u.work = 0; u.workT = null; continue; }
      const key = tgt.k + (tgt.id || tgt.i);
      if (!u.workT || u.workT.key !== key){ u.workT = { key, k:tgt.k }; u.work = 0; }
      u.work += .5;
      if (u.work >= tgt.need){
        if (tgt.k === 'trap'){ const j = g.traps.findIndex(t => t.id === tgt.id); if (j >= 0){ const t = g.traps[j]; g.traps.splice(j, 1); g.ev.push({ e:'detrap', side:u.side, x:Math.round(t.x), y:Math.round(t.y) }); } }
        else if (tgt.k === 'mine'){ const j = g.mines.findIndex(n => n.id === tgt.id); if (j >= 0){ const n = g.mines[j]; g.mines.splice(j, 1); g.ev.push({ e:'demine', side:u.side, x:Math.round(n.x), y:Math.round(n.y) }); } }
        else { g.map.t[tgt.i] = T.RUBBLE; g.ev.push({ e:'ter', i:tgt.i, v:T.RUBBLE }); g.ev.push({ e:'unbarr', side:u.side }); }
        u.work = 0; u.workT = null;
      }
    }
  }
  // артиллерия
  for (const s of g.shells){
    if (!s.inc && s.t - g.t <= .9){ s.inc = true; g.ev.push({ e:'inc', x:Math.round(s.x), y:Math.round(s.y), big:s.side === 'fed' && !s.smoke ? 1 : 0 }); }
    if (s.t <= g.t){
      if (s.smoke){ addSmoke(g, s.x, s.y, s.A.r, s.A.life); g.ev.push({ e:'pop', x:Math.round(s.x), y:Math.round(s.y) }); continue; }
      g.ev.push({ e:'boom', x:Math.round(s.x), y:Math.round(s.y), big:s.side === 'fed' ? 1 : 0, side:s.side });
      g.noise.push({ x:s.x, y:s.y, t:g.t });
      splash(g, s.x, s.y, s.A.r, s.A.dmg, s.A.pen, -1, s.side);
      damageBuilding(g, s.x, s.y, s.A.bdmg, 1, s.side);
    }
  }
  g.shells = g.shells.filter(s => s.t > g.t);
  g.artyMarks = g.artyMarks.filter(m => m.end > g.t);
  // пополнение боеприпасов
  for (const u of g.units){
    if (u.dead) continue; const d = UT[u.type];
    if (!d.weapons.some(w => w.ammo !== undefined)) continue;
    const near = inRects(g.sc.deploy[u.side], u.x, u.y) || g.units.some(s => !s.dead && s.side === u.side && UT[s.type].supply && !s.moving && dist(s, u) < 90);
    if (!near){ u.resupT = 0; continue; }
    u.resupT += dt;
    if (u.resupT >= 6){ u.resupT = 0; d.weapons.forEach((w, i) => { if (w.ammo !== undefined && u.w[i].ammo < w.ammo) u.w[i].ammo++; }); }
  }
  // контрольные точки
  for (const o of g.objs){
    let f = 0, c = 0;
    for (const u of g.units){
      if (u.dead || u.carrier || u.under || UT[u.type].cls !== 'inf' || u.supp >= 70) continue;
      if ((u.x-o.x)**2 + (u.y-o.y)**2 > o.r*o.r) continue;
      if (u.side === 'fed') f++; else c++;
    }
    o.fN = f; o.cN = c;
    if (f > 0 && c === 0) o.prog = Math.min(100, o.prog + 4*dt*Math.min(3, f));
    else if (c > 0 && f === 0) o.prog = Math.max(-100, o.prog - 4*dt*Math.min(3, c));
    const before = o.owner;
    if (o.prog >= 100) o.owner = 'fed'; else if (o.prog <= -100) o.owner = 'chr';
    else if ((o.owner === 'fed' && o.prog < 0) || (o.owner === 'chr' && o.prog > 0)) o.owner = null;
    if (o.owner !== before) g.ev.push({ e:'obj', name:o.name, owner:o.owner || 0 });
    if (o.owner) g.sides[o.owner].score += g.sc.objRate*dt;
  }
  // выход колонны
  const ex = g.sc.exit;
  if (ex) for (const u of g.units){
    if (u.dead || u.side !== ex.side || !UT[u.type].convoy || !inRect(ex, u.x, u.y)) continue;
    g.sides[ex.side].score += ex.value; g.ev.push({ e:'exit', side:ex.side }); removeUnit(g, u);
  }
  g.units = g.units.filter(u => { if (u.dead){ g.byId.delete(u.id); return false; } return true; });
  // конец боя
  const F = g.sides.fed, C = g.sides.chr, tgt = g.sc.target;
  let res = null;
  if (F.score >= tgt || C.score >= tgt) res = { winner: F.score >= C.score ? 'fed' : 'chr', reason:'Набрано нужное число очков' };
  else if (g.phaseT <= 0) res = { winner: F.score > C.score ? 'fed' : C.score > F.score ? 'chr' : null, reason:'Время боя вышло' };
  else if (g.t > 30) for (const s of SIDES){
    const alive = g.units.some(u => u.side === s), coming = g.arrivals.some(a => a.side === s);
    const cheapest = Math.min(...deckOf(g, s).map(k => UT[k].cost));
    if (!alive && !coming && g.sides[s].pts < cheapest){ res = { winner:other(s), reason:'Противник потерял все подразделения' }; break; }
  }
  if (res){
    g.rr.push(roundSum(g, res));
    if (g.rounds === 2 && g.round === 1){ g.phase = 'inter'; g.phaseT = 15; g.mines = []; g.ev.push({ e:'rend', res }); return; }
    if (g.rounds === 2){
      const a = g.rr[0].fed.s + g.rr[1].chr.s, b = g.rr[0].chr.s + g.rr[1].fed.s;
      g.result = { winner: a > b ? 'fed' : b > a ? 'chr' : null, reason:'Сумма очков за два этапа', totals:{ fed:a, chr:b }, two:true };
    } else g.result = res;
    g.phase = 'end'; g.ev.push({ e:'end' });
  }
}


/* ================= МИРНЫЕ ЖИТЕЛИ ================= */
function spawnCivs(g, n){
  const m = g.map, cand = [], N4 = [[1,0],[-1,0],[0,1],[0,-1]];
  for (let i = 0; i < m.W*m.H; i++){
    const v = m.t[i]; if (v !== T.YARD && v !== T.ROAD && v !== T.OPEN) continue;
    const x = i % m.W, y = Math.floor(i/m.W);
    if (!N4.some(([dx, dy]) => { const X = x+dx, Y = y+dy; return X >= 0 && Y >= 0 && X < m.W && Y < m.H && m.t[Y*m.W+X] === T.BLD && m.res[Y*m.W+X]; })) continue;
    const p = cellCenter(m, i);
    if (SIDES.some(sd => sd !== g.sc.defender && inRects(g.sc.deploy[sd], p.x, p.y))) continue;
    cand.push(p);
  }
  for (let k = 0; k < n && cand.length; k++){
    const p = cand.splice(Math.floor(Math.random()*cand.length), 1)[0];
    g.civs.push({ id:k+1, x:p.x + gauss()*6, y:p.y + gauss()*6, h:Math.random()*6, st:0, path:null, t:Math.random()*8, scare:-99, calm:0, dead:false, mv:false });
  }
}
function hideSpot(g, c){
  const m = g.map, cx = Math.floor(c.x/CELL), cy = Math.floor(c.y/CELL);
  let nx = 0, ny = 0, nn = 0; for (const n of g.noise){ if (Math.hypot(n.x-c.x, n.y-c.y) < 260){ nx += n.x; ny += n.y; nn++; } }
  let best = null, bs = Infinity;
  for (let dy = -8; dy <= 8; dy++) for (let dx = -8; dx <= 8; dx++){
    const X = cx+dx, Y = cy+dy; if (X < 0 || Y < 0 || X >= m.W || Y >= m.H) continue;
    const i = Y*m.W+X; if (m.t[i] !== T.BLD || m.bst[i] === 2) continue;
    const p = cellCenter(m, i); let sc = Math.hypot(dx, dy);
    if (nn) sc -= Math.hypot(p.x - nx/nn, p.y - ny/nn)/CELL*.6;
    if (sc < bs){ bs = sc; best = p; }
  }
  return best;
}
function edgePath(g, c){
  const Wm = g.map.W*CELL, Hm = g.map.H*CELL;
  const opts = [{ x:10, y:c.y }, { x:Wm-10, y:c.y }, { x:c.x, y:10 }, { x:c.x, y:Hm-10 }]
    .filter(p => !SIDES.some(sd => sd !== g.sc.defender && inRects(g.sc.deploy[sd], p.x, p.y)));
  opts.sort((a, b) => Math.hypot(a.x-c.x, a.y-c.y) - Math.hypot(b.x-c.x, b.y-c.y));
  return opts.length ? findPath(g.map, 'foot', c.x, c.y, opts[0].x, opts[0].y) : null;
}
function updateCivs(g, dt){
  const m = g.map, Wm = m.W*CELL, Hm = m.H*CELL;
  g.noise = g.noise.filter(n => g.t - n.t < 5);
  for (const c of g.civs){
    if (c.dead || c.st === 3) continue;
    if (c.path && c.path.length){
      const p = c.path[0], dx = p.x-c.x, dy = p.y-c.y, dd = Math.hypot(dx, dy);
      const mc = MOVE.foot[terrAt(m, c.x, c.y)];
      const st = GAME_SPEED*(c.st === 1 || c.st === 4 ? 3.2 : 1.2)/(isFinite(mc) ? mc : 2)*dt;
      if (st >= dd){ c.x = p.x; c.y = p.y; c.path.shift(); if (!c.path.length) c.path = null; }
      else { c.x += dx/dd*st; c.y += dy/dd*st; }
      if (dd > .3) c.h = Math.atan2(dy, dx); c.mv = true;
    } else c.mv = false;
    c.t -= dt; if (c.t > 0) continue; c.t = .8 + Math.random()*.6;
    const inB = terrAt(m, c.x, c.y) === T.BLD;
    let danger = g.t - c.scare < 4;
    if (!danger) for (const n of g.noise) if (Math.abs(n.x-c.x) < 200 && Math.abs(n.y-c.y) < 200){ danger = true; break; }
    if (!danger) for (const u of g.units) if (!u.dead && Math.abs(u.x-c.x) < 50 && Math.abs(u.y-c.y) < 50){ danger = true; break; }
    if (danger){
      c.calm = 0;
      if (c.st === 2 && inB) continue;
      if (c.st !== 1 || !c.path){
        c.st = 1; const h = hideSpot(g, c);
        c.path = h ? findPath(m, 'foot', c.x, c.y, h.x, h.y) : edgePath(g, c);
      }
      continue;
    }
    c.calm += 1;
    if (c.st === 1 && !c.path) c.st = inB ? 2 : 0;
    else if (c.st === 2 && !inB) c.st = 0;
    else if (c.st === 2 && c.calm > 30 && Math.random() < .03){ c.st = 4; c.path = edgePath(g, c); }
    else if (c.st === 4 && !c.path){
      if (c.x < 40 || c.y < 40 || c.x > Wm-40 || c.y > Hm-40){ c.st = 3; g.civEvac++; g.ev.push({ e:'evac' }); }
      else c.path = edgePath(g, c);
    }
    else if (c.st === 0 && !c.path && Math.random() < .12){
      const p = findPath(m, 'foot', c.x, c.y, c.x + gauss()*45, c.y + gauss()*45); if (p && p.length < 8) c.path = p;
    }
  }
}

/* ================= БОТ ================= */
function aiStep(g, side, dt, st){
  st.t = (st.t || 0) + dt;
  const S = g.sides[side], deck = deckOf(g, side);
  const affordable = () => deck.filter(k => S.pts >= UT[k].cost && (S.used[k] || 0) < UT[k].limit);
  const pick = opts => { const ws = opts.map(k => UT[k].cls === 'inf' ? 3 : 1); let r = Math.random()*ws.reduce((a, b) => a + b, 0); for (let i = 0; i < opts.length; i++){ r -= ws[i]; if (r <= 0) return opts[i]; } return opts[0]; };
  if (g.phase === 'deploy'){
    if (st.deployed) return; st.deployed = true;
    const zones = g.sc.deploy[side];
    const objsNear = g.objs.filter(o => inRects(zones, o.x, o.y));
    for (let guard = 0; guard < 300; guard++){
      const opts = affordable(); if (!opts.length || S.pts < 30) break;
      const k = pick(opts), d = UT[k];
      let x, y;
      if (objsNear.length && d.cls === 'inf' && Math.random() < .7){ const o = objsNear[Math.floor(Math.random()*objsNear.length)]; x = o.x + gauss()*o.r; y = o.y + gauss()*o.r; }
      else { const z = zones[Math.floor(Math.random()*zones.length)]; x = z.x + Math.random()*z.w; y = z.y + Math.random()*z.h; }
      applyCommand(g, side, { c:'deploy', type:k, x, y });
    }
    if (side === g.sc.defender){
      const zones = g.sc.deploy[side];
      for (const o of g.objs) for (let k = 0; k < 5; k++){
        const a = Math.random()*7, r = o.r + 30 + Math.random()*90, x = o.x + Math.cos(a)*r, y = o.y + Math.sin(a)*r;
        const t = terrAt(g.map, x, y);
        if (t === T.ROAD) applyCommand(g, side, { c:'eng', k:k % 2 ? 'mine' : 'barr', x, y });
      }
    }
    if (side === 'chr') for (const o of g.objs) for (let k = 0; k < 6; k++){
      const x = o.x + gauss()*o.r*2, y = o.y + gauss()*o.r*2; if (trapOk(g, side, x, y)) applyCommand(g, side, { c:'eng', k:'trap', x, y });
    }
    applyCommand(g, side, { c:'ready', v:true }); return;
  }
  if (g.phase !== 'battle' || st.t < (st.next || 0)) return;
  st.next = st.t + 2.5;
  if (S.pts > 70 && Math.random() < .6){ const o = affordable(); if (o.length){
    const k = pick(o);
    if (side === 'chr' && UT[k].cls === 'inf' && Math.random() < .6){
      const ob = g.objs[Math.floor(Math.random()*g.objs.length)];
      for (let tr = 0; tr < 12; tr++){ const x = ob.x + gauss()*350, y = ob.y + gauss()*350; if (infilOk(g, side, k, x, y)){ applyCommand(g, side, { c:'buy', type:k, x, y }); break; } }
    } else applyCommand(g, side, { c:'buy', type:k });
  } }
  if (side === 'fed' && S.cd4 <= 0 && S.pts > AIR.cost + 40){
    const en = g.units.filter(u => u.side !== side && u.vis[side]); let best = null, bn = 2;
    for (const e of en){ const n = en.filter(x => dist(x, e) < 80).length; if (n > bn && !g.units.some(x => x.side === side && dist(x, e) < 120)){ bn = n; best = e; } }
    if (best) applyCommand(g, side, { c:'air', x:best.x, y:best.y });
  }
  if ((S.ch === undefined || S.ch > 0) && S.pts > AB[side].cost + 25){
    const en = g.units.filter(u => u.side !== side && u.vis[side]);
    let best = null, bn = 1;
    for (const e of en){ const n = en.filter(x => dist(x, e) < 70).length; const own = g.units.filter(x => x.side === side && dist(x, e) < 90).length; if (n > bn && !own){ bn = n; best = e; } }
    if (best) applyCommand(g, side, { c:'ability', x:best.x, y:best.y });
  }
  if (g.night && S.cd3 <= 0 && S.pts > 30){ const o = g.objs[Math.floor(Math.random()*g.objs.length)]; applyCommand(g, side, { c:'flare', x:o.x + gauss()*80, y:o.y + gauss()*80 }); }
  const mine = g.units.filter(u => u.side === side && !u.carrier), inf = mine.filter(u => UT[u.type].cls === 'inf');
  for (const u of inf){
    if (!u.inFire || u.under) continue;
    for (let tr = 0; tr < 10; tr++){ const a = Math.random()*7, x = u.x + Math.cos(a)*60, y = u.y + Math.sin(a)*60; const ci = cellIdx(g.map, x, y);
      if (passableAt(g.map, 'foot', x, y) && !g.fires.has(ci)){ applyCommand(g, side, { c:'move', ids:[u.id], x, y, fast:true }); break; } }
  }
  if (side === 'chr') for (const u of inf){
    if (u.under || !u.inB || u.supp < 45 || Math.random() > .35) continue;
    const reach = cellarReach(g.map, cellIdx(g.map, u.x, u.y)); if (reach.size < 4) continue;
    const en = g.units.filter(e => e.side !== side && e.vis[side]); if (!en.length) continue;
    let best = null, bs = -1;
    for (const ci of reach.keys()){ const p = cellCenter(g.map, ci); const d = Math.min(...en.map(e => Math.hypot(e.x - p.x, e.y - p.y))); if (d > bs){ bs = d; best = p; } }
    if (best) applyCommand(g, side, { c:'tunnel', ids:[u.id], x:best.x, y:best.y });
  }
  for (const u of mine){
    const d = UT[u.type];
    if (d.convoy){ if (!u.path && g.sc.exit){ const e = g.sc.exit; applyCommand(g, side, { c:'move', ids:[u.id], x:e.x + e.w/2, y:u.y }); } continue; }
    if (u.path) continue;
    if (d.cls === 'inf' && g.sc.convoy && side !== g.sc.exit.side && g.map.roadY && (u.id % 3) !== 0){
      if (!u.aiHold){ const cx = clamp(Math.floor(u.x/CELL), 0, g.map.W-1), ry = g.map.roadY[cx];
        applyCommand(g, side, { c:'move', ids:[u.id], x:u.x + gauss()*60, y:(ry - 2 - Math.random()*2)*CELL }); u.aiHold = true; }
      continue;
    }
    if (d.cls === 'inf'){
      let best = null, bs = -1;
      for (const o of g.objs){
        let w = o.owner === side ? (g.sc.defender === side ? 1.4 : .5) : 2;
        if (o.owner === side && (side === 'fed' ? o.cN : o.fN)) w = 2.5;
        const s = w/(Math.hypot(o.x-u.x, o.y-u.y) + 300);
        if (s > bs){ bs = s; best = o; }
      }
      if (best){
        if (Math.hypot(best.x-u.x, best.y-u.y) > best.r*.8){ if (!u.aiHold || Math.random() < .15) applyCommand(g, side, { c:'move', ids:[u.id], x:best.x + gauss()*best.r*.6, y:best.y + gauss()*best.r*.6 }); }
        else u.aiHold = true;
      }
    } else {
      let f = null, fd = Infinity; for (const i of inf){ const dd = dist(i, u); if (dd < fd){ fd = dd; f = i; } }
      if (f && fd > 100) applyCommand(g, side, { c:'move', ids:[u.id], x:f.x + gauss()*40, y:f.y + gauss()*40 });
    }
  }
}

/* ================= СНИМОК СОСТОЯНИЯ ================= */
function sideSnap(g, s){ const S = g.sides[s]; return { p:Math.floor(S.pts), i:S.inc, s:Math.floor(S.score), cd:Math.max(0, Math.ceil(S.cd)), ch:S.ch === undefined ? (AB[s].charges || 1) : S.ch, used:S.used, r:S.ready, lv:S.lostVal, lm:S.lostMen, lvh:S.lostVeh, ck:S.civK, cd2:Math.max(0, Math.ceil(S.cd2)), cd3:Math.max(0, Math.ceil(S.cd3)), cd4:Math.max(0, Math.ceil(S.cd4 || 0)), eng:S.eng, arr:g.arrivals.filter(a => a.side === s).length }; }
function encodeSnap(g, ev){
  return { ph:g.phase, pt:Math.round(g.phaseT*10)/10, t:Math.round(g.t*100)/100,
    S:{ fed:sideSnap(g, 'fed'), chr:sideSnap(g, 'chr') },
    o:g.objs.map(o => [Math.round(o.prog), o.owner || 0]),
    u:g.units.map(u => [u.id, TI[u.type], u.side === 'fed' ? 0 : 1, Math.round(u.x), Math.round(u.y), Math.round(u.h*100), Math.round(u.hp), Math.round(u.supp),
      (u.vis.fed?1:0)|(u.vis.chr?2:0)|(u.inB?4:0)|(u.moving?8:0)|(u.fast?16:0)|((g.t-u.fired < .4)?32:0)|(u.focus?64:0),
      u.dest ? Math.round(u.dest.x) : -1, u.dest ? Math.round(u.dest.y) : -1, u.w.map(w => isFinite(w.ammo) ? w.ammo : -1), Math.round(u.ta*100), u.carrier, u.smk, (u.immob?1:0)|(u.workT?2:0)|(u.board?4:0)|(u.workT && u.workT.k === 'mine'?8:0), u.afire ? Math.round(u.afire.x) : -1, u.afire ? Math.round(u.afire.y) : -1, (u.nocomm?1:0)|(u.under?2:0), u.pend ? Math.max(1, Math.ceil(u.pend - g.t)) : 0, u.q ? u.q.map(p => [Math.round(p.x), Math.round(p.y)]) : 0, (u.ambush?1:0)|(u.inFire?2:0), u.owner || 0]),
    pr:g.pready || {},
    fr:[...g.fires.keys()],
    tp:g.traps.map(t => [t.id, Math.round(t.x), Math.round(t.y), t.side === 'fed' ? 0 : 1, (t.rev.fed?1:0)|(t.rev.chr?2:0)]),
    ar:g.air.map(p => [Math.round(p.x), Math.round(p.y), Math.round(p.dx*100), Math.round(p.dy*100), Math.max(0, Math.round(p.hp)), p.id]),
    mn:g.mines.map(m => [m.id, Math.round(m.x), Math.round(m.y), m.side === 'fed' ? 0 : 1, (m.rev.fed?1:0)|(m.rev.chr?2:0)]),
    sm:g.smokes.map(s => [Math.round(s.x), Math.round(s.y), Math.round(smokeR(g, s)), Math.round(s.until - g.t)]),
    fl:g.flares.map(f => [Math.round(f.x), Math.round(f.y), Math.round((f.until - g.t)*10)/10]),
    rd:g.round, rds:g.rounds, nt:g.night ? 1 : 0, rr:g.rr,
    cv:g.civs.filter(c => !c.dead && c.st !== 3).map(c => [Math.round(c.x), Math.round(c.y), c.st, Math.round(c.h*10), c.mv ? 1 : 0, c.id]),
    cd:g.civDead, ce:g.civEvac, bdn:g.bldDown,
    a:g.artyMarks.map(m => [m.side === 'fed' ? 0 : 1, Math.round(m.x), Math.round(m.y), Math.max(0, Math.round((m.t - g.t)*10)/10), m.smoke ? 1 : 0]),
    ev, bh:g.bldHits, res:g.result };
}
function decodeSnap(s){
  return { phase:s.ph, phaseT:s.pt, t:s.t, sides:s.S, objs:s.o, bh:s.bh, res:s.res, marks:s.a, civDead:s.cd, civEvac:s.ce, bldDown:s.bdn,
    mines:s.mn, smokes:s.sm, flares:s.fl, round:s.rd, rounds:s.rds, night:!!s.nt, rr:s.rr,
    civs:s.cv.map(a => ({ x:a[0], y:a[1], st:a[2], h:a[3]/10, mv:!!a[4], id:a[5] })),
    units:s.u.map(a => ({ id:a[0], type:TK[a[1]], side:a[2] ? 'chr' : 'fed', x:a[3], y:a[4], h:a[5]/100, hp:a[6], supp:a[7],
      vis:{ fed:!!(a[8]&1), chr:!!(a[8]&2) }, inB:!!(a[8]&4), moving:!!(a[8]&8), fast:!!(a[8]&16), fired:!!(a[8]&32), focus:!!(a[8]&64),
      dest:a[9] >= 0 ? { x:a[9], y:a[10] } : null, ammo:a[11], ta:a[12]/100, carrier:a[13], smk:a[14], immob:!!(a[15]&1), working:(a[15]&2) ? ((a[15]&8) ? 'mine' : 'barr') : null, boarding:!!(a[15]&4), afire:a[16] >= 0 ? { x:a[16], y:a[17] } : null, nocomm:!!(a[18]&1), under:!!(a[18]&2), pend:a[19] || 0, q:a[20] || null, ambush:!!(a[21]&1), inFire:!!(a[21]&2), owner:a[22] || 0 })), pready:s.pr || {}, fires:s.fr || [], traps:s.tp || [], air:s.ar || [] };
}

if (typeof module !== 'undefined') module.exports = { orphanPlayer, pidSide, AIR, trapOk, engAvail, cellarPath, cellarReach, hasComm, UT, SCEN, AB, AB2, ENG, T, CELL, TK, spawnUnit, infilOk, engOk, makeGame, step, applyCommand, aiStep, encodeSnap, decodeSnap, findPath, buildMap, los };
