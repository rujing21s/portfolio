/* ############################################################################
   BusTrack — Lesson 5 / 第 5 課：到站時間與完整互動
   ETA + full interactions
   ----------------------------------------------------------------------------
   本課目標 / Goal: 加入到站時間估算、選站詳情頁、即時更新，以及手機抽屜/底部抽屜。
   完成後 / Result: 點任一站 → 看到各路線公車的即時到站分鐘數並持續更新；手機可拉抽屜，完整成品。
   使用方式 / How to run:
     把 index.html 最後的 <script src="app.js"> 改成
     <script src="app_js_course/code/app_lesson5.js">，再用瀏覽器打開 index.html。
   ############################################################################ */

/* ============================================================================
   1) DATA — 資料模型 / Data model（吉隆坡 Kuala Lumpur）
   ----------------------------------------------------------------------------
   為什麼用「陣列裝物件」？每個站牌都有多個屬性（站號、站名、經緯度、路線），
   用物件最自然；多個站牌放進陣列，方便用迴圈一次處理。
   An array of objects is the natural shape for a list of records.
   ============================================================================ */
const STOPS = [
  // id 站號 | name 站名 | lat/lng 緯度/經度 | routes 經過路線
  { id:1001, name:"KLCC, Jalan Ampang",                 lat:3.1578, lng:101.7123, routes:["100","T780","U26","40"] },
  { id:1002, name:"Bukit Bintang, Jalan Bukit Bintang", lat:3.1466, lng:101.7099, routes:["58","T780","U88"] },
  { id:1003, name:"KL Sentral, Jalan Stesen Sentral",   lat:3.1339, lng:101.6869, routes:["40","100","U69"] },
  { id:1004, name:"Chow Kit, Jalan Raja Laut",          lat:3.1665, lng:101.6976, routes:["40","58","T780"] },
  { id:1005, name:"Masjid India, Jalan Melayu",         lat:3.1496, lng:101.6984, routes:["40","U26","58","100"] },
  { id:1006, name:"Pasar Seni, Jalan Cheng Lock",       lat:3.1440, lng:101.6957, routes:["40","U26","100","U69"] },
  { id:1007, name:"Dang Wangi, Jalan Sultan Ismail",    lat:3.1579, lng:101.7056, routes:["U26","100","T780"] },
  { id:1008, name:"Ampang Park, Jalan Ampang",          lat:3.1617, lng:101.7176, routes:["100","U88"] },
  { id:1009, name:"Jalan Imbi, Berjaya Times Square",   lat:3.1444, lng:101.7112, routes:["58","T780","U88"] },
  { id:1010, name:"Titiwangsa, Jalan Pahang",           lat:3.1749, lng:101.7072, routes:["40","T780"] },
];

// 路線資料 / Route data：color 代表色、freq 發車間隔(分)、stopIds 依序經過的站。
const ROUTES = [
  { id:"40",   name:"Titiwangsa — KL Sentral",   color:"#1a2340", freq:10, stopIds:[1010,1004,1005,1006,1003] },
  { id:"U26",  name:"KLCC — Pasar Seni",          color:"#e6304a", freq:12, stopIds:[1001,1007,1005,1006] },
  { id:"100",  name:"KL Sentral — Ampang Park",   color:"#4dabf7", freq:15, stopIds:[1003,1006,1005,1007,1001,1008] },
  { id:"58",   name:"Chow Kit — Bukit Bintang",   color:"#845ef7", freq:8,  stopIds:[1004,1005,1009,1002] },
  { id:"T780", name:"Titiwangsa — Bukit Bintang", color:"#f59f00", freq:9,  stopIds:[1010,1007,1001,1009,1002] },
];

// 小工具 / Helpers：用 id 找站牌或路線。
const stopById  = id => STOPS.find(s => s.id === id);
const routeById = id => ROUTES.find(r => r.id === id);

/* ============================================================================
   2) SIMULATION — 公車模擬 / Bus simulation
   ----------------------------------------------------------------------------
   沒有真實 GPS，所以「模擬」公車沿路線在站與站之間移動。
   si = 目前第幾段；prog = 這段走了多少(0~1)。
   ============================================================================ */
const BUSES = [];

function initBuses() {
  // 預先擺幾台車，分散在不同路線、不同進度，畫面才熱鬧。
  const defs = [
    { id:"B01", routeId:"40",   si:0, prog:.22 },
    { id:"B02", routeId:"40",   si:3, prog:.65 },
    { id:"B03", routeId:"U26",  si:1, prog:.40 },
    { id:"B04", routeId:"U26",  si:0, prog:.15 },
    { id:"B05", routeId:"100",  si:0, prog:.55 },
    { id:"B06", routeId:"58",   si:2, prog:.80 },
    { id:"B07", routeId:"T780", si:1, prog:.35 },
  ];
  defs.forEach(d => {
    const route = routeById(d.routeId);
    BUSES.push({ ...d, route, speed:.0012 + Math.random()*.0008, marker:null, heading:0 });
  });
}

// 算出公車「現在」的經緯度：在起點站與終點站之間做線性內插。
function busPos(bus) {
  const sids = bus.route.stopIds;
  const from = stopById(sids[bus.si % sids.length]);
  const to   = stopById(sids[(bus.si + 1) % sids.length]);
  if (!from || !to) return null;
  return {
    lat: from.lat + (to.lat - from.lat) * bus.prog,
    lng: from.lng + (to.lng - from.lng) * bus.prog,
    fromStop: from, toStop: to,
  };
}

// 算出行進方向角度(度，0 = 向上/北)，讓箭頭指對方向。
function busHeading(bus) {
  const sids = bus.route.stopIds;
  const from = stopById(sids[bus.si % sids.length]);
  const to   = stopById(sids[(bus.si + 1) % sids.length]);
  if (!from || !to) return 0;
  const dy = to.lat - from.lat;
  const dx = to.lng - from.lng;
  return (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
}

// 估算某台車到「指定站牌」還要幾分鐘 / Estimate ETA (minutes).
// 先算還要經過幾段(ahead)，再加上目前這段剩下的部分。每段假設固定 2 分鐘。
function etaMin(bus, targetId) {
  const sids = bus.route.stopIds;
  const n = sids.length;
  const cur = bus.si % n;
  let ahead = 0, idx = cur;
  while (sids[idx] !== targetId) {
    ahead++; idx = (idx + 1) % n;
    if (ahead > n) return null;        // 這台車不會到這站
  }
  const segM = 2;
  const rem = (1 - bus.prog) * segM;
  const total = rem + (ahead > 0 ? (ahead - 1) * segM : 0);
  return Math.max(0, Math.round(total));
}

/* ============================================================================
   3) MAP — Leaflet 地圖 / The map
   ============================================================================ */
let map;

function initMap() {
  // 建立地圖、設定中心點與縮放等級；zoomControl:false 因為我們自己做按鈕。
  map = L.map('map', { zoomControl:false, attributionControl:true })
         .setView([3.1490, 101.7020], 15);

  // 底圖圖磚 / Base map tiles（CARTO 淺色地圖）。
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    maxZoom:19, subdomains:'abcd',
    attribution:'&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
  }).addTo(map);

  // 畫出每條路線（把站點座標串成折線）。
  ROUTES.forEach(route => {
    const coords = route.stopIds.map(id => { const s = stopById(id); return s ? [s.lat, s.lng] : null; }).filter(Boolean);
    L.polyline(coords, { color:route.color, weight:3, opacity:.45, dashArray:'6 5' }).addTo(map);
  });

  // 放上所有站牌標記；點站牌 → 選取該站。
  STOPS.forEach(s => {
    s.marker = L.marker([s.lat, s.lng], { icon: stopIcon() })
                .addTo(map)
                .on('click', () => selectStop(s.id));
  });

  // 使用者目前位置（示範用固定點）。
  L.marker([3.1490, 101.7050], {
    icon: L.divIcon({ className:'', html:'<div class="upulse-ring"><div class="upulse-dot"></div></div>', iconSize:[74,74], iconAnchor:[37,37] }),
    zIndexOffset:-20,
  }).addTo(map);

  // 放上所有公車標記 / Add a marker for every bus.
  initBuses();
  BUSES.forEach(bus => {
    const p = busPos(bus); if (!p) return;
    bus.heading = busHeading(bus);
    bus.marker = L.marker([p.lat, p.lng], {
      icon: busIcon(bus.route.color, bus.heading),
      zIndexOffset:100,
    }).addTo(map);
  });

  // 把控制鈕接上地圖動作 / Wire up the custom map buttons.
  document.getElementById('zinBtn').onclick  = () => map.zoomIn();
  document.getElementById('zoutBtn').onclick = () => map.zoomOut();
  document.getElementById('locBtn').onclick  = () => map.flyTo([3.1490, 101.7050], 16, { duration:.8 });
}

// 站牌 icon / Stop icon：小圓點 + 白色公車圖示。
function stopIcon(color = '#1a2340') {
  return L.divIcon({
    className:'',
    html:`<div class="stop-pin" style="background:${color}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><circle cx="7" cy="17" r="1"/><circle cx="17" cy="17" r="1"/></svg>
          </div>`,
    iconSize:[26,26], iconAnchor:[13,13],
  });
}

// 公車 icon / Bus icon：水滴徽章 + 白色公車 + 可旋轉的方向箭頭 + 脈動環。
function busIcon(color, heading = 0) {
  return L.divIcon({
    className:'',
    html:`<div class="bus-pin">
            <div class="ring"></div>
            <div class="arrow" style="transform:rotate(${heading}deg)"></div>
            <div class="badge" style="background:${color}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.2-.8-.5-1.1l-1.5-1.5c-.5-.5-1.2-.8-1.9-.8H5.4c-.7 0-1.4.3-1.9.8L2 13c-.3.3-.5.7-.5 1.1V18h3"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>
            </div>
          </div>`,
    iconSize:[38,38], iconAnchor:[19,19],
  });
}

/* ============================================================================
   4) ANIMATION — 動畫迴圈 / Animation loop
   ----------------------------------------------------------------------------
   requestAnimationFrame 每秒約 60 次；每格把公車往前推一點點。
   乘上時間差 dt，確保不同效能的電腦速度一致。
   ============================================================================ */
let lastT = Date.now();

function tick() {
  const now = Date.now();
  const dt = (now - lastT) / 1000;   // 距離上一格的秒數
  lastT = now;

  BUSES.forEach(bus => {
    bus.prog += bus.speed * dt * 28;                 // 往前走
    if (bus.prog >= 1) {                             // 到站 → 進入下一段
      bus.prog = 0;
      bus.si = (bus.si + 1) % bus.route.stopIds.length;
      bus.heading = busHeading(bus);                 // 轉彎後更新方向
      if (bus.marker) bus.marker.setIcon(busIcon(bus.route.color, bus.heading));
    }
    const p = busPos(bus);
    if (p && bus.marker) bus.marker.setLatLng([p.lat, p.lng]);  // 移到新位置
  });

  if (selStop !== null) liveETA();   // 正在看某站時順便更新到站時間
  requestAnimationFrame(tick);
}

/* ============================================================================
   5) STATE — 介面狀態 / UI state
   ============================================================================ */
let activeTab = 'nearby';     // 目前分頁
let selStop   = null;         // 目前選的站（null = 沒選）
let searchQuery = '';         // 目前搜尋字串
const favs    = new Set();    // 收藏的站號

function switchTab(tab) {
  activeTab = tab;
  if (tab !== 'nearby' && tab !== 'stops') selStop = null;  // 離開站牌頁就取消選取
  syncTabUI();
  render();
}

function syncTabUI() {
  document.querySelectorAll('.tab-btn').forEach(b => setTabActive(b, b.dataset.tab === activeTab));
  document.querySelectorAll('.bn-btn').forEach(b => {
    const on = b.dataset.tab === activeTab;
    b.classList.toggle('text-navy', on);
    b.classList.toggle('text-muted', !on);
  });
}

function openDrawer() {
  document.getElementById('sidebar').classList.remove('-translate-x-full');
  document.getElementById('overlay').classList.remove('hidden');
}
function closeDrawer() {
  document.getElementById('sidebar').classList.add('-translate-x-full');
  document.getElementById('overlay').classList.add('hidden');
}

function setTabActive(btn, on) {
  btn.classList.toggle('text-navy', on);
  btn.classList.toggle('border-navy', on);
  btn.classList.toggle('text-muted', !on);
  btn.classList.toggle('border-transparent', !on);
}

// 選取一個站牌 → 飛過去並顯示到站時刻。
function selectStop(id) {
  selStop = id;
  const s = stopById(id); if (!s) return;
  map.flyTo([s.lat, s.lng], 16, { duration:.7 });
  if (activeTab !== 'nearby' && activeTab !== 'stops') activeTab = 'nearby';
  render();
  if (window.innerWidth < 1024) openDrawer();   // 小螢幕自動拉出側欄
  const sheet = document.getElementById('bsheet');
  if (sheet) sheet.classList.add('exp');
}

function clearStop() { selStop = null; render(); }
function toggleFav(id) { favs.has(id) ? favs.delete(id) : favs.add(id); render(); }

function onSearch(val) {
  searchQuery = (val == null ? (document.getElementById('sbSearch')?.value || '') : val).toString();
  ['sbSearch', 'topSearch'].forEach(id => {
    const el = document.getElementById(id);
    if (el && el.value !== searchQuery) el.value = searchQuery;
  });
  if (searchQuery.trim() && activeTab !== 'stops') { activeTab = 'stops'; selStop = null; syncTabUI(); }
  render();
  if (searchQuery.trim() && window.innerWidth < 1024) openDrawer();
}

function highlightRoute(rid) {
  const route = routeById(rid); if (!route) return;
  const coords = route.stopIds.map(id => { const s = stopById(id); return s ? [s.lat, s.lng] : null; }).filter(Boolean);
  if (coords.length) map.fitBounds(coords, { padding:[50,50] });
}

/* ============================================================================
   6) RENDER — 把資料變成畫面 / Turn data into HTML
   ----------------------------------------------------------------------------
   render() 依「目前狀態」決定要產生哪一段 HTML，再塞進側欄與抽屜。
   ============================================================================ */
function render() {
  const html = buildHTML();
  const sb = document.getElementById('sbBody'); if (sb) sb.innerHTML = html;   // 桌機側欄
  const bs = document.getElementById('bsBody'); if (bs) bs.innerHTML = html;   // 手機抽屜
}

// 依狀態挑選要顯示的內容；選了站就顯示到站時刻頁。
function buildHTML() {
  if ((activeTab === 'nearby' || activeTab === 'stops') && selStop !== null) return etaHTML();
  if (activeTab === 'nearby')    return nearbyHTML();
  if (activeTab === 'stops')     return stopsHTML();
  if (activeTab === 'routes')    return routesHTML();
  if (activeTab === 'favorites') return favsHTML();
  return '';
}

// 小標籤 / Section label。
const sectionLabel = t => `<p class="mt-3.5 mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted first:mt-0">${t}</p>`;

// 「附近」頁：兩張快捷卡 + 最近 5 站。
function nearbyHTML() {
  return `${sectionLabel('Quick Access')}
  <div class="mb-1 grid grid-cols-2 gap-2.5">
    <div onclick="switchTab('favorites')" class="flex cursor-pointer flex-col items-center gap-2.5 rounded-xl border-[1.5px] border-transparent bg-canvas p-4 transition hover:border-brand-blue hover:shadow-tiny">
      <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-[#eef2ff] text-brand-purple"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></div>
      <span class="text-[13px] font-semibold">My Favorites</span>
    </div>
    <div onclick="switchTab('routes')" class="flex cursor-pointer flex-col items-center gap-2.5 rounded-xl border-[1.5px] border-transparent bg-canvas p-4 transition hover:border-brand-blue hover:shadow-tiny">
      <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-[#fff1f2] text-brand-red"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 17h2a2 2 0 0 0 0-4H5l-2-6h14l1 3"/><path d="M14 17h6"/><circle cx="7.5" cy="17" r="1.5"/><circle cx="17.5" cy="17" r="1.5"/></svg></div>
      <span class="text-[13px] font-semibold">All Routes</span>
    </div>
  </div>
  ${sectionLabel('Nearby Stops')}
  ${STOPS.slice(0,5).map((s,i) => stopCard(s, `${(i*.11+.08).toFixed(2)} km`)).join('')}`;
}

// 「站牌」頁：可搜尋的完整站牌清單。
function stopsHTML() {
  const q = searchQuery.toLowerCase();
  const list = q
    ? STOPS.filter(s => String(s.id).includes(q) || s.name.toLowerCase().includes(q) || s.routes.some(r => r.toLowerCase().includes(q)))
    : STOPS;
  if (!list.length) return emptyState('search', 'No stops found', 'Try a different stop number or name.');
  return `${sectionLabel(`All Stops (${list.length})`)}${list.map(s => stopCard(s)).join('')}`;
}

// 單張站牌卡。
function stopCard(s, dist = '') {
  const isSel = selStop === s.id, isFav = favs.has(s.id);
  return `<div onclick="selectStop(${s.id})"
    class="mb-2 flex cursor-pointer items-start gap-3 rounded-xl border-[1.5px] ${isSel ? 'border-navy shadow-tiny' : 'border-line'} bg-white p-3 transition hover:border-navy hover:shadow-tiny">
    <div class="flex h-9 w-9 min-w-9 items-center justify-center rounded-full bg-navy text-white">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><circle cx="7" cy="17" r="1"/><circle cx="17" cy="17" r="1"/></svg>
    </div>
    <div class="flex-1">
      <div class="text-[13px] font-bold text-navy">Stop ${s.id}</div>
      <div class="mt-0.5 text-xs leading-snug text-muted">${s.name}</div>
      <div class="mt-1.5 flex flex-wrap gap-1">
        ${s.routes.slice(0,5).map(r => `<span class="rounded-full border border-line bg-canvas px-1.5 py-0.5 text-[10px] font-semibold">${r}</span>`).join('')}
        ${s.routes.length > 5 ? `<span class="rounded-full border border-line bg-canvas px-1.5 py-0.5 text-[10px] font-semibold">+${s.routes.length-5}</span>` : ''}
      </div>
      ${dist ? `<div class="mt-1 text-[11px] font-semibold text-brand-blue">${dist} away</div>` : ''}
    </div>
    <button onclick="event.stopPropagation();toggleFav(${s.id})" aria-label="Favorite" class="shrink-0 p-1">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="${isFav ? '#f59f00' : 'none'}" stroke="${isFav ? '#f59f00' : '#d1d5db'}" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
    </button>
  </div>`;
}

// 「路線」頁。
function routesHTML() {
  return `${sectionLabel('All Routes')}
  ${ROUTES.map(r => `<div onclick="highlightRoute('${r.id}')" class="mb-2 flex cursor-pointer items-center gap-3 rounded-xl border-[1.5px] border-line bg-white p-3 transition hover:border-navy">
    <div class="flex h-11 w-11 items-center justify-center rounded-[10px] text-sm font-bold text-white" style="background:${r.color}">${r.id}</div>
    <div class="flex-1"><div class="text-[13px] font-semibold">${r.name}</div><div class="mt-0.5 text-[11px] text-muted">${r.stopIds.length} stops</div></div>
    <div class="text-right text-[11px] text-muted">Every <strong class="text-navy">${r.freq}</strong> min</div>
  </div>`).join('')}`;
}

// 「收藏」頁。
function favsHTML() {
  if (!favs.size) return emptyState('star', 'No favorites yet', 'Tap the star on any stop to save it here.');
  return `${sectionLabel('Saved Stops')}${STOPS.filter(s => favs.has(s.id)).map(s => stopCard(s)).join('')}`;
}

// 空狀態畫面。
function emptyState(icon, title, desc) {
  const svg = icon === 'search'
    ? `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`
    : `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
  return `<div class="px-5 py-10 text-center text-muted">
    <div class="mb-3 flex justify-center text-line">${svg}</div>
    <h3 class="mb-1 text-sm font-semibold text-ink">${title}</h3>
    <p class="text-xs">${desc}</p>
  </div>`;
}

// 「到站時刻」頁：選了某站後顯示「哪些車、還有幾分鐘」。
function etaHTML() {
  const s = stopById(selStop); if (!s) return '';
  const arrivals = [];
  BUSES.forEach(bus => {
    if (!bus.route.stopIds.includes(s.id)) return;
    const eta = etaMin(bus, s.id); if (eta === null) return;
    const pos = busPos(bus);
    arrivals.push({ bus, eta, route:bus.route, toStop: pos ? pos.toStop : null });
  });
  arrivals.sort((a,b) => a.eta - b.eta);

  const rows = arrivals.map(a => etaRow(a)).join('') ||
    `<div class="p-4 text-center text-[13px] text-muted">No buses approaching</div>`;

  const routeItems = s.routes.map(rid => {
    const r = routeById(rid);
    return `<div onclick="${r ? `highlightRoute('${rid}')` : ''}" class="mb-2 flex cursor-pointer items-center gap-3 rounded-xl border-[1.5px] border-line bg-white p-3 transition hover:border-navy">
      <div class="flex h-11 w-11 items-center justify-center rounded-[10px] text-sm font-bold text-white" style="background:${r ? r.color : '#9ca3af'}">${rid}</div>
      <div class="flex-1"><div class="text-[13px] font-semibold">${r ? r.name : 'Route '+rid}</div><div class="mt-0.5 text-[11px] text-muted">${r ? r.stopIds.length+' stops' : '—'}</div></div>
    </div>`;
  }).join('');

  return `
  <div class="mb-2.5 flex items-center gap-2">
    <button onclick="clearStop()" class="flex items-center gap-1.5 rounded-lg border-[1.5px] border-line bg-canvas px-2.5 py-1.5 text-xs font-medium text-muted hover:text-ink">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m15 18-6-6 6-6"/></svg>Back
    </button>
    <span class="text-xs font-medium text-muted">Stop ${s.id}</span>
  </div>
  <div class="mb-3 overflow-hidden rounded-xl border-[1.5px] border-line bg-white">
    <div class="flex items-center gap-2.5 bg-navy px-4 py-3.5">
      <div><div class="text-[15px] font-bold text-white">Stop ${s.id}</div><div class="mt-0.5 text-[11px] text-white/70">${s.name}</div></div>
      <button onclick="toggleFav(${s.id})" class="ml-auto flex h-7 w-7 items-center justify-center rounded-lg bg-white/15" style="color:${favs.has(s.id) ? '#f59f00' : '#fff'}">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="${favs.has(s.id) ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
      </button>
    </div>
    <div id="etaList" class="py-1">${rows}</div>
  </div>
  ${sectionLabel('Routes at this stop')}
  ${routeItems}`;
}

// 單列到站資訊（liveETA 也會用到）。
function etaRow({ bus, eta, route, toStop }) {
  return `<div class="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0">
    <div class="min-w-10 rounded-md px-1.5 py-1 text-center text-xs font-bold text-white" style="background:${route.color}">${route.id}</div>
    <div class="flex-1">
      <div class="text-[13px] font-medium">${route.name}</div>
      <div class="mt-px text-[11px] text-muted">Bus ${bus.id}${toStop ? ` · toward ${toStop.name.split(',')[0]}` : ''}</div>
    </div>
    <div class="min-w-10 text-right">${
      eta <= 1
        ? `<div class="text-xs font-bold text-brand-red">Due</div>`
        : `<div class="text-[19px] font-bold leading-none text-navy">${eta}</div><div class="text-[10px] text-muted">min</div>`
    }</div>
  </div>`;
}

// 只更新到站秒數、不重畫整頁。
function liveETA() {
  const lists = document.querySelectorAll('#etaList');
  if (!lists.length || selStop === null) return;
  const s = stopById(selStop); if (!s) return;
  const arrivals = [];
  BUSES.forEach(bus => {
    if (!bus.route.stopIds.includes(s.id)) return;
    const eta = etaMin(bus, s.id); if (eta === null) return;
    const pos = busPos(bus);
    arrivals.push({ bus, eta, route:bus.route, toStop: pos ? pos.toStop : null });
  });
  arrivals.sort((a,b) => a.eta - b.eta);
  const rows = arrivals.map(a => etaRow(a)).join('') ||
    `<div class="p-4 text-center text-[13px] text-muted">No buses approaching</div>`;
  lists.forEach(el => el.innerHTML = rows);
}

/* ============================================================================
   7) UI 事件綁定 / Wire up interactions
   ============================================================================ */
function setupToggle() {
  document.getElementById('openSb').onclick  = openDrawer;   // 漢堡 → 開
  document.getElementById('closeSb').onclick = closeDrawer;  // X → 關
  document.getElementById('overlay').onclick = closeDrawer;  // 點遮罩 → 關
}

function setupSheet() {
  const sh = document.getElementById('bsheet');
  const h  = document.getElementById('bsHandle');
  if (!sh || !h) return;
  h.addEventListener('click', () => sh.classList.toggle('exp'));
  let sy = 0;
  h.addEventListener('touchstart', e => { sy = e.touches[0].clientY; }, { passive:true });
  h.addEventListener('touchend', e => {
    const dy = e.changedTouches[0].clientY - sy;
    if (dy < -30) sh.classList.add('exp');
    else if (dy > 30) sh.classList.remove('exp');
  }, { passive:true });
}

// 分頁鈕事件（桌機 + 手機共用）。
function setupTabs() {
  document.querySelectorAll('.tab-btn,.bn-btn').forEach(b => {
    b.addEventListener('click', () => switchTab(b.dataset.tab));
  });
}

/* ============================================================================
   啟動 / Boot：等 HTML 載入完成後依序初始化。
   ============================================================================ */
document.addEventListener('DOMContentLoaded', () => {
  initMap();                    // 地圖 + 站牌 + 公車
  setupToggle();                // 側欄抽屜（漢堡）
  setupSheet();                 // 底部抽屜
  setupTabs();                  // 分頁
  render();                     // 第一次畫面
  requestAnimationFrame(tick);  // 啟動動畫
});
