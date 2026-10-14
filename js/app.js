/* =========================================================
   PC Papelaria · Gestão — protótipo em HTML, CSS e JS puro
   Dados ficam salvos no navegador (localStorage).
   ========================================================= */
'use strict';

const STORE_KEY = 'pcpapelaria:v1';
const THEME_KEY = 'pcpapelaria:theme';
const AUTH_KEY = 'pcpapelaria:auth';

// Crédito exibido no login e em Configurações — ajuste à vontade
const AUTHOR = { name: 'Brayan Rodrigues', url: '' };

/* ---------- utilitários ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const brl = n => BRL.format(n || 0);
const brlShort = n => Math.abs(n) >= 1000 ? 'R$ ' + (n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil' : 'R$ ' + Math.round(n);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sum = (arr, f) => arr.reduce((s, x) => s + (typeof f === 'function' ? f(x) : x[f]), 0);
const pctChange = (a, b) => (b ? ((a - b) / b) * 100 : null);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const DAY = 864e5;

function store(key, val) { try { val === undefined ? localStorage.removeItem(key) : localStorage.setItem(key, val); } catch (e) { /* modo privado */ } }
function read(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
function session(key, val) { try { if (val === undefined) return sessionStorage.getItem(key); val === null ? sessionStorage.removeItem(key) : sessionStorage.setItem(key, val); } catch (e) { return null; } }

const fmtDate = iso => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
const fmtTime = iso => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
function daysFromToday(iso) {
  const a = new Date(dayKey(new Date()) + 'T12:00'), b = new Date(dayKey(iso) + 'T12:00');
  return Math.round((b - a) / DAY);
}
function relDay(iso) {
  const d = daysFromToday(iso);
  if (d === 0) return 'Hoje';
  if (d === -1) return 'Ontem';
  if (d === 1) return 'Amanhã';
  return fmtDate(iso);
}
function toLocalInput(iso, withTime = true) {
  const d = new Date(iso), p = n => String(n).padStart(2, '0');
  const date = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  return withTime ? `${date}T${p(d.getHours())}:${p(d.getMinutes())}` : date;
}
function initials(name) {
  const parts = name.replace(/[^\p{L}\s&]/gu, ' ').split(/\s+/).filter(w => w.length > 2 || /^[A-ZÀ-Ú]/.test(w)).filter(w => !['de', 'da', 'do', 'dos', 'das', '&'].includes(w.toLowerCase()));
  return ((parts[0] || '?')[0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
}

/* ---------- banco de dados local ---------- */
let db = loadDb();

function loadDb() {
  let d = null;
  try { d = JSON.parse(read(STORE_KEY)); } catch (e) { d = null; }
  if (!d || d.version !== 1 || !Array.isArray(d.products)) d = seedDatabase();

  // Mantém a demonstração "viva": desloca as datas para que o último dia gerado seja hoje
  const today = dayKey(new Date());
  if (d.seedDay !== today) {
    const delta = Math.round((new Date(today + 'T12:00') - new Date(d.seedDay + 'T12:00')) / DAY);
    if (delta > 0 && delta < 365) {
      const shift = iso => new Date(new Date(iso).getTime() + delta * DAY).toISOString();
      d.sales.forEach(s => (s.date = shift(s.date)));
      d.orders.forEach(o => { o.due = shift(o.due); o.createdAt = shift(o.createdAt); });
      d.expenses.forEach(e => (e.due = shift(e.due)));
      d.seedDay = today;
    } else {
      d = seedDatabase();
    }
  }
  store(STORE_KEY, JSON.stringify(d));
  return d;
}
function save() { store(STORE_KEY, JSON.stringify(db)); }

const catOf = id => CATEGORIES.find(c => c.id === id) || CATEGORIES[0];
const prodOf = id => db.products.find(p => p.id === id);
const custOf = id => db.customers.find(c => c.id === id);
const payOf = id => PAYMENT_METHODS.find(p => p.id === id) || PAYMENT_METHODS[0];
const isLow = p => p.stock !== null && p.stock <= p.min;
const lowStock = () => db.products.filter(isLow).sort((a, b) => a.stock / (a.min || 1) - b.stock / (b.min || 1));
const openOrders = () => db.orders.filter(o => o.status !== 'entregue');
const salesOn = key => db.sales.filter(s => dayKey(s.date) === key);
const salesSince = days => { const from = Date.now() - days * DAY; return db.sales.filter(s => new Date(s.date).getTime() >= from); };

function catTile(catId, extra = '') {
  const c = catOf(catId);
  return `<span class="tile cat ${extra}" style="--c:${c.color}">${icon(c.icon)}</span>`;
}

/* ---------- estado de interface ---------- */
const ui = {
  route: 'inicio',
  cart: [],
  pos: { q: '', cat: 'all', payment: 'pix', discount: '', received: '', customerId: '' },
  stock: { q: '', cat: 'all', low: false },
  cust: { q: '', type: 'all' },
  chartRange: 7,
  redraw: [],
};

/* ---------- rotas ---------- */
const ROUTES = {
  inicio:     { title: 'Início',        icon: 'home',     render: renderInicio },
  vender:     { title: 'Vender',        icon: 'cart',     render: renderVender },
  estoque:    { title: 'Estoque',       icon: 'box',      render: renderEstoque },
  servicos:   { title: 'Serviços',      icon: 'printer',  render: renderServicos },
  clientes:   { title: 'Clientes',      icon: 'users',    render: renderClientes },
  financeiro: { title: 'Financeiro',    icon: 'wallet',   render: renderFinanceiro },
  config:     { title: 'Configurações', icon: 'settings', render: renderConfig },
};

function go(route) {
  if (location.hash === '#/' + route) render();
  else location.hash = '#/' + route;
}

function onRoute() {
  const r = location.hash.replace(/^#\/?/, '');
  ui.route = ROUTES[r] ? r : 'inicio';
  closeModal();
  hidePopover();
  render();
  window.scrollTo(0, 0);
}

function render() {
  const r = ROUTES[ui.route];
  document.title = `${r.title} · PC Papelaria`;
  $('#topTitle').textContent = r.title;
  ui.redraw = [];
  $('#view').innerHTML = r.render();
  renderNav();
  ui.redraw.forEach(fn => fn());
  if (ui.route === 'servicos') bindKanban();
}

function renderNav() {
  const low = lowStock().length;
  const open = openOrders().length;
  const link = (id, extra = '') => {
    const r = ROUTES[id];
    return `<a class="side-link ${ui.route === id ? 'active' : ''}" href="#/${id}">${icon(r.icon)}<span class="side-label">${r.title}</span>${extra}</a>`;
  };
  $('#sideNav').innerHTML = `
    <a class="side-link cta" href="#/vender">${icon('plus')}<span class="side-label">Nova venda</span></a>
    ${link('inicio')}
    ${link('estoque', low ? `<span class="side-badge">${low}</span>` : '')}
    ${link('servicos', open ? `<span class="side-badge">${open}</span>` : '')}
    ${link('clientes')}
    ${link('financeiro')}
    ${link('config')}`;

  const more = ['clientes', 'financeiro', 'config'].includes(ui.route);
  const bn = (id, label, ic) => `<a class="bn-item ${ui.route === id ? 'active' : ''}" href="#/${id}">${icon(ic)}<span>${label}</span></a>`;
  $('#bottomNav').innerHTML = `
    ${bn('inicio', 'Início', 'home')}
    ${bn('estoque', 'Estoque', 'box')}
    <a class="bn-item bn-fab ${ui.route === 'vender' ? 'active' : ''}" href="#/vender" aria-label="Vender"><span class="fab">${icon('cart')}</span><span>Vender</span></a>
    ${bn('servicos', 'Serviços', 'printer')}
    <button class="bn-item ${more ? 'active' : ''}" data-action="more">${icon('grid')}<span>Mais</span></button>`;

  const alerts = notifications().length;
  $('#notifBtn').innerHTML = icon('bell') + (alerts ? `<span class="dot">${alerts}</span>` : '');
  $('#themeBtn').innerHTML = icon(isDark() ? 'sun' : 'moon');
}

/* =========================================================
   INÍCIO (dashboard)
   ========================================================= */
function renderInicio() {
  const now = new Date();
  const yd = new Date(now); yd.setDate(now.getDate() - 1);
  const minutes = iso => { const d = new Date(iso); return d.getHours() * 60 + d.getMinutes(); };
  const today = salesOn(dayKey(now));
  // compara com ontem na mesma janela de horário
  const cutoff = Math.max(now.getHours() * 60 + now.getMinutes(), ...today.map(s => minutes(s.date)));
  const ydUntil = salesOn(dayKey(yd)).filter(s => minutes(s.date) <= cutoff);
  const tTotal = sum(today, 'total'), yTotal = sum(ydUntil, 'total');
  const tTicket = today.length ? tTotal / today.length : 0, yTicket = ydUntil.length ? yTotal / ydUntil.length : 0;
  const low = lowStock();
  const out = low.filter(p => p.stock === 0).length;

  const hour = now.getHours();
  const greet = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const dateStr = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  const orders = openOrders();
  const dueToday = orders.filter(o => daysFromToday(o.due) <= 0).length;
  const ready = orders.filter(o => o.status === 'pronto').length;

  // ranking dos mais vendidos (30 dias)
  const agg = {};
  salesSince(30).forEach(s => s.items.forEach(it => { agg[it.pid] = (agg[it.pid] || 0) + it.qty * it.price; }));
  const top = Object.entries(agg).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([pid, value]) => ({ label: prodOf(pid)?.name || pid, value }));

  const recent = db.sales.slice(-6).reverse();

  ui.redraw.push(drawRevenueChart);

  return `
  <section class="page-head">
    <div>
      <p class="eyebrow">${esc(dateStr)}</p>
      <h1>${greet}, equipe Contacto!</h1>
      <p class="sub">Aqui está o resumo da loja hoje.</p>
    </div>
    <div class="head-actions">
      <button class="btn btn-ghost" data-action="school-list">${icon('clipboard')}<span class="hide-m">Lista escolar</span></button>
      <a class="btn btn-primary" href="#/vender">${icon('plus')}Nova venda</a>
    </div>
  </section>

  <section class="kpis">
    ${kpi('Vendas hoje', brl(tTotal), 'tone-blue', 'cash', deltaHtml(pctChange(tTotal, yTotal)), 'vs. ontem')}
    ${kpi('Atendimentos', today.length, 'tone-sky', 'receipt', deltaHtml(pctChange(today.length, ydUntil.length)), 'vs. ontem')}
    ${kpi('Ticket médio', brl(tTicket), 'tone-orange', 'tag', deltaHtml(pctChange(tTicket, yTicket)), 'vs. ontem')}
    ${kpi('Repor estoque', plural(low.length, 'item', 'itens'), 'tone-bad', 'alert', out ? `<span class="badge bad">${plural(out, 'esgotado', 'esgotados')}</span>` : '', `<a class="link-btn" href="#/estoque" data-low="1">Ver lista ${icon('chevronRight')}</a>`)}
  </section>

  <section class="dash-a">
    <div class="card">
      <div class="card-head">
        <div><h3>Faturamento</h3><div class="sub">Vendas no balcão e serviços</div></div>
        <div class="seg" role="tablist" aria-label="Período">
          <button class="${ui.chartRange === 7 ? 'active' : ''}" data-action="chart-range" data-range="7">7 dias</button>
          <button class="${ui.chartRange === 30 ? 'active' : ''}" data-action="chart-range" data-range="30">30 dias</button>
        </div>
      </div>
      <div class="chart-summary" id="chartSummary"></div>
      <div class="chart" id="revChart" role="img" aria-label="Gráfico de barras do faturamento diário"></div>
      <div class="legend"><span><i style="background:var(--chart-bar)"></i>Dias anteriores</span><span><i style="background:var(--chart-hi)"></i>Hoje</span></div>
    </div>

    <div class="card hello">
      <div>
        <h3>Atalhos do balcão</h3>
        <p>${plural(orders.length, 'ordem de serviço aberta', 'ordens de serviço abertas')} · ${plural(ready, 'pronta', 'prontas')} para retirada${dueToday ? ` · <strong>${dueToday} para hoje</strong>` : ''}</p>
      </div>
      <div class="quick">
        <button data-go="vender"><span class="q-ico orange">${icon('cart')}</span>Nova venda</button>
        <button data-action="school-list"><span class="q-ico">${icon('clipboard')}</span>Lista escolar</button>
        <button data-action="new-os"><span class="q-ico">${icon('printer')}</span>Nova OS</button>
        <button data-action="new-product"><span class="q-ico">${icon('box')}</span>Novo produto</button>
      </div>
    </div>
  </section>

  <section class="dash-b">
    <div class="card">
      <div class="card-head"><div><h3>Mais vendidos</h3><div class="sub">Receita nos últimos 30 dias</div></div></div>
      ${hbars(top)}
    </div>
    <div class="card">
      <div class="card-head"><div><h3>Estoque baixo</h3><div class="sub">Abaixo do mínimo definido</div></div><a class="link-btn" href="#/estoque" data-low="1">Ver tudo ${icon('chevronRight')}</a></div>
      <div class="list">
        ${low.slice(0, 5).map(p => `
          <div class="list-row">
            ${catTile(p.cat)}
            <div class="grow"><div class="title">${esc(p.name)}</div><div class="meta">${p.stock === 0 ? 'Esgotado' : `Restam ${p.stock}`} · mínimo ${p.min}</div></div>
            <button class="btn btn-sm btn-soft" data-action="restock" data-id="${p.id}">Repor</button>
          </div>`).join('') || empty('check', 'Tudo em dia por aqui!')}
      </div>
    </div>
    <div class="card">
      <div class="card-head"><div><h3>Últimas vendas</h3><div class="sub">Atualizado agora</div></div></div>
      <div class="list">${recent.map(saleRow).join('')}</div>
    </div>
  </section>`;
}

function kpi(label, value, tone, ic, delta, foot) {
  return `<div class="card kpi curl">
    <div class="kpi-top"><span class="kpi-ico ${tone}">${icon(ic)}</span>${label}</div>
    <div class="kpi-value">${value}</div>
    <div class="kpi-foot">${delta}<span>${foot}</span></div>
  </div>`;
}
function deltaHtml(p) {
  if (p === null || !isFinite(p)) return '';
  const up = p >= 0;
  return `<span class="delta ${up ? 'up' : 'down'}">${icon(up ? 'trendUp' : 'trendDown')}${up ? '+' : '−'}${Math.abs(p).toFixed(0)}%</span>`;
}
function hbars(rows, fmt = brl) {
  if (!rows.length) return empty('trendUp', 'Sem dados no período');
  const max = Math.max(...rows.map(r => r.value), 1);
  return `<div class="hbars">${rows.map((r, i) => `
    <div class="hbar-row">
      <div class="hbar-top"><span>${esc(r.label)}</span><span>${r.display ?? fmt(r.value)}</span></div>
      <div class="hbar-track"><div class="hbar-fill" style="width:${(r.value / max) * 100}%;animation-delay:${i * 60}ms"></div></div>
    </div>`).join('')}</div>`;
}
function empty(ic, text) { return `<div class="empty">${icon(ic)}<div>${text}</div></div>`; }
function saleRow(s, byId = false) {
  const c = s.customerId ? custOf(s.customerId) : null;
  const pm = payOf(s.payment);
  const n = sum(s.items, 'qty');
  return `<div class="list-row">
    <span class="tile tone-blue">${icon(pm.icon)}</span>
    <div class="grow"><div class="title">${byId ? `Venda nº ${s.id}` : esc(c ? c.name : 'Consumidor final')}</div><div class="meta">${relDay(s.date)} ${fmtTime(s.date)} · ${plural(n, 'item', 'itens')} · ${pm.name}</div></div>
    <span class="amount">${brl(s.total)}</span>
  </div>`;
}

/* ---------- gráfico de barras (SVG próprio) ---------- */
function dailySeries(days) {
  const out = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now); d.setDate(now.getDate() - i);
    const list = salesOn(dayKey(d));
    out.push({
      date: d,
      value: sum(list, 'total'),
      count: list.length,
      label: days <= 7 ? d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '') : String(d.getDate()),
      sub: d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }),
      hi: i === 0,
    });
  }
  return out;
}

function drawRevenueChart() {
  const el = $('#revChart');
  if (!el) return;
  const data = dailySeries(ui.chartRange);
  const total = sum(data, 'value');
  const open = data.filter(d => d.count > 0);
  const best = open.reduce((a, b) => (b.value > a.value ? b : a), open[0] || { value: 0, sub: '—' });
  $('#chartSummary').innerHTML = `
    <div><small>Total no período</small><strong>${brl(total)}</strong></div>
    <div><small>Média por dia aberto</small><strong>${brl(open.length ? total / open.length : 0)}</strong></div>
    <div><small>Melhor dia</small><strong>${best.sub}</strong></div>`;
  drawBarChart(el, data);
}

// teto do eixo com 4 intervalos "redondos" (1, 2, 2.5, 5 × 10^n)
function niceMax(v) {
  if (v <= 0) return 100;
  const raw = v / 4, p = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map(k => k * p).find(s => s >= raw);
  return step * 4;
}

function drawBarChart(el, data) {
  const W = el.clientWidth || 600, H = el.clientHeight || 260;
  const m = { t: 10, r: 4, b: 26, l: 58 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const max = niceMax(Math.max(...data.map(d => d.value)));
  const y = v => m.t + ih - (v / max) * ih;
  const step = iw / data.length;
  const bw = Math.max(4, Math.min(40, step * 0.62));
  const every = data.length <= 10 ? 1 : data.length <= 20 ? 2 : 5;

  let grid = '';
  for (let i = 0; i <= 4; i++) {
    const v = (max / 4) * i, yy = y(v);
    grid += `<line class="grid-line" x1="${m.l}" x2="${W - m.r}" y1="${yy}" y2="${yy}"/><text class="axis-label" x="${m.l - 10}" y="${yy + 4}" text-anchor="end">${brlShort(v)}</text>`;
  }
  const cols = data.map((d, i) => {
    const cx = m.l + step * i + step / 2, x = cx - bw / 2, top = y(d.value), base = m.t + ih, h = base - top;
    const r = Math.min(4, bw / 2, h);
    const bar = h > 0.5 ? `<path class="bar ${d.hi ? 'hi' : ''}" d="M${x},${base} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${base} Z"/>` : '';
    const showLabel = d.hi || (data.length - 1 - i) % every === 0;
    const label = showLabel ? `<text class="axis-label" x="${cx}" y="${H - 6}" text-anchor="middle" ${d.hi ? 'font-weight="700"' : ''}>${d.hi && data.length <= 7 ? 'hoje' : d.label}</text>` : '';
    return `<g class="col" data-i="${i}">${bar}${label}<rect class="hit" x="${cx - step / 2}" y="${m.t}" width="${step}" height="${ih}" /></g>`;
  }).join('');

  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${grid}${cols}</svg>`;

  const tip = $('#chartTip');
  const show = g => {
    const d = data[+g.dataset.i];
    const bar = g.querySelector('.bar') || g.querySelector('.hit');
    const r = bar.getBoundingClientRect();
    $$('.col.focus', el).forEach(c => c.classList.remove('focus'));
    g.classList.add('focus');
    tip.innerHTML = `${d.sub}${d.hi ? ' · hoje' : ''}<strong>${d.count ? brl(d.value) : 'Loja fechada'}</strong>${d.count ? plural(d.count, 'venda', 'vendas') : ''}`;
    tip.hidden = false;
    tip.style.left = r.left + r.width / 2 + 'px';
    tip.style.top = (d.value > 0 ? r.top : el.getBoundingClientRect().bottom - 30) + 'px';
  };
  const hide = () => { tip.hidden = true; $$('.col.focus', el).forEach(c => c.classList.remove('focus')); };
  $$('.col', el).forEach(g => {
    g.addEventListener('mouseenter', () => show(g));
    g.addEventListener('click', () => show(g));
  });
  el.addEventListener('mouseleave', hide);
}
window.addEventListener('scroll', () => { const t = $('#chartTip'); if (t) t.hidden = true; }, { passive: true });

/* =========================================================
   VENDER (PDV)
   ========================================================= */
function renderVender() {
  return `
  <div class="pos">
    <section>
      <div class="page-head">
        <div><p class="eyebrow">Caixa 01 · Loja Centro</p><h1>Nova venda</h1><p class="sub">Toque nos produtos para adicionar ao carrinho.</p></div>
      </div>
      <div class="pos-tools">
        <label class="search">${icon('search')}<input class="input" id="posSearch" type="search" placeholder="Buscar por nome ou código de barras" value="${esc(ui.pos.q)}" autocomplete="off" enterkeyhint="search" /></label>
        <button class="btn btn-ghost" data-action="school-list" title="Montar lista escolar">${icon('clipboard')}<span>Lista escolar</span></button>
      </div>
      <div class="chips pos-cats" role="tablist">
        <button class="chip ${ui.pos.cat === 'all' ? 'active' : ''}" data-action="pos-cat" data-cat="all">${icon('grid')}Todos</button>
        ${CATEGORIES.map(c => `<button class="chip ${ui.pos.cat === c.id ? 'active' : ''}" data-action="pos-cat" data-cat="${c.id}">${icon(c.icon)}${c.name}</button>`).join('')}
      </div>
      <div class="prod-grid" id="prodGrid">${renderProdGrid()}</div>
      <div class="pos-pad"></div>
    </section>
    <aside class="card cart" id="cart" aria-label="Carrinho">${renderCart()}</aside>
  </div>
  <div class="sheet-backdrop" id="cartBackdrop" data-action="close-cart"></div>
  <button class="cart-fab" id="cartFab" data-action="open-cart" ${ui.cart.length ? '' : 'hidden'}>${cartFabInner()}</button>`;
}

function filteredProducts() {
  const q = ui.pos.q.trim().toLowerCase();
  return db.products.filter(p =>
    (ui.pos.cat === 'all' || p.cat === ui.pos.cat) &&
    (!q || p.name.toLowerCase().includes(q) || p.sku.includes(q)));
}

function renderProdGrid() {
  const list = filteredProducts();
  if (!list.length) return `<div style="grid-column:1/-1">${empty('search', 'Nenhum produto encontrado')}</div>`;
  return list.map(p => {
    const inCart = ui.cart.find(i => i.pid === p.id);
    const out = p.stock === 0;
    return `<button class="prod-card ${out ? 'out' : ''}" data-action="add" data-id="${p.id}" ${out ? 'aria-disabled="true"' : ''}>
      ${inCart ? `<span class="in-cart">${inCart.qty}</span>` : ''}
      ${catTile(p.cat)}
      <span class="p-name">${esc(p.name)}</span>
      <span class="p-foot"><span class="p-price">${brl(p.price)}</span><span class="p-stock ${isLow(p) ? 'low' : ''}">${p.stock === null ? 'serviço' : out ? 'esgotado' : p.stock + ' un'}</span></span>
    </button>`;
  }).join('');
}

function cartTotals() {
  const subtotal = sum(ui.cart, i => i.qty * prodOf(i.pid).price);
  const pct = Math.min(50, Math.max(0, parseFloat(String(ui.pos.discount).replace(',', '.')) || 0));
  const discount = round2(subtotal * pct / 100);
  const total = round2(subtotal - discount);
  const received = parseFloat(String(ui.pos.received).replace(',', '.')) || 0;
  return { subtotal, pct, discount, total, received, change: received - total, count: sum(ui.cart, 'qty') };
}

function renderCart() {
  const t = cartTotals();
  const items = ui.cart.map(i => {
    const p = prodOf(i.pid);
    return `<div class="cart-item">
      <div><div class="ci-name">${esc(p.name)}</div><div class="ci-unit">${brl(p.price)} / un</div></div>
      <div class="ci-total">${brl(p.price * i.qty)}</div>
      <div class="stepper">
        <button data-action="dec" data-id="${p.id}" aria-label="Diminuir">${icon(i.qty === 1 ? 'trash' : 'minus')}</button>
        <span>${i.qty}</span>
        <button data-action="inc" data-id="${p.id}" aria-label="Aumentar">${icon('plus')}</button>
      </div>
    </div>`;
  }).join('');

  return `
    <div class="cart-head">
      <h3>${icon('cart')} Carrinho ${t.count ? `<span class="badge info">${plural(t.count, 'item', 'itens')}</span>` : ''}</h3>
      ${t.count ? `<button class="link-btn" data-action="clear-cart">Limpar</button>` : ''}
    </div>
    <div class="cart-items">${items || empty('cart', 'Carrinho vazio.<br>Toque em um produto ou digite o código de barras.')}</div>
    <div class="cart-foot">
      <div class="mini-fields">
        <label class="field"><span>Cliente</span>
          <select id="posCustomer">
            <option value="">Consumidor final</option>
            ${db.customers.map(c => `<option value="${c.id}" ${ui.pos.customerId === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
          </select>
        </label>
        <label class="field"><span>Desconto (%)</span><input id="posDiscount" type="number" min="0" max="50" step="1" inputmode="decimal" placeholder="0" value="${esc(ui.pos.discount)}" /></label>
      </div>
      <div class="pay-grid" role="radiogroup" aria-label="Forma de pagamento">
        ${PAYMENT_METHODS.map(m => `<button class="pay-opt ${ui.pos.payment === m.id ? 'active' : ''}" data-action="pay" data-pay="${m.id}" role="radio" aria-checked="${ui.pos.payment === m.id}">${icon(m.icon)}${m.name}</button>`).join('')}
      </div>
      ${ui.pos.payment === 'dinheiro' ? `
        <div class="mini-fields">
          <label class="field"><span>Valor recebido</span><input id="posReceived" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0,00" value="${esc(ui.pos.received)}" /></label>
          <div class="field"><span>Troco</span><div class="change-line" id="changeLine" style="height:40px;display:flex;align-items:center"></div></div>
        </div>` : ''}
      <div id="cartTotals">${cartTotalsHtml(t)}</div>
      <button class="btn btn-orange btn-xl btn-block" data-action="checkout" id="checkoutBtn" ${t.count ? '' : 'disabled'}>${icon('check')}Finalizar venda</button>
    </div>`;
}

function cartTotalsHtml(t) {
  return `
    <div class="row-between sum-line"><span>Subtotal</span><span class="num">${brl(t.subtotal)}</span></div>
    ${t.discount ? `<div class="row-between sum-line"><span>Desconto (${t.pct}%)</span><span class="num">− ${brl(t.discount)}</span></div>` : ''}
    <div class="row-between" style="margin-top:4px"><span class="sum-line">Total</span><span class="sum-total">${brl(t.total)}</span></div>`;
}

function cartFabInner() {
  const t = cartTotals();
  return `${icon('cart')}<span class="count">${t.count}</span><span>Ver carrinho</span><span class="total">${brl(t.total)}</span>`;
}

function refreshCart({ grid = true } = {}) {
  const cart = $('#cart');
  if (!cart) return;
  cart.innerHTML = renderCart();
  updateCartTotals();
  if (grid) $('#prodGrid').innerHTML = renderProdGrid();
  const fab = $('#cartFab');
  fab.innerHTML = cartFabInner();
  fab.hidden = !ui.cart.length;
}

function updateCartTotals() {
  const t = cartTotals();
  const tot = $('#cartTotals'); if (tot) tot.innerHTML = cartTotalsHtml(t);
  const ch = $('#changeLine');
  if (ch) {
    ch.textContent = t.received ? (t.change >= 0 ? brl(t.change) : `Faltam ${brl(-t.change)}`) : '—';
    ch.style.color = t.change < 0 && t.received ? 'var(--bad)' : '';
  }
  const fab = $('#cartFab'); if (fab) fab.innerHTML = cartFabInner();
}

function addToCart(pid, qty = 1, quiet = false) {
  const p = prodOf(pid);
  if (!p) return false;
  const line = ui.cart.find(i => i.pid === pid);
  const current = line ? line.qty : 0;
  if (p.stock !== null && current + qty > p.stock) {
    if (!quiet) toast(p.stock === 0 ? `${p.name} está esgotado` : `Só há ${p.stock} un. de ${p.name} em estoque`, 'alert');
    return false;
  }
  if (line) line.qty += qty; else ui.cart.push({ pid, qty });
  return true;
}

function setCartOpen(open) {
  $('#cart')?.classList.toggle('open', open);
  $('#cartBackdrop')?.classList.toggle('show', open);
}

function checkout() {
  const t = cartTotals();
  if (!t.count) return;
  if (ui.pos.payment === 'dinheiro' && t.received && t.change < 0) { toast('O valor recebido é menor que o total', 'alert'); return; }
  if (ui.pos.payment === 'pix') { openPix(t.total); return; }
  finalizeSale();
}

function openPix(total) {
  openModal({
    title: 'Pagamento via Pix',
    body: `<div class="receipt-wrap">
      <p class="muted" style="text-align:center">Mostre o QR Code para o cliente escanear</p>
      <div style="background:#fff;padding:14px;border-radius:16px;border:1px solid var(--border)">${fakeQr(db.nextSaleId)}</div>
      <div style="text-align:center"><div class="muted" style="font-size:13px">Valor</div><div class="sum-total">${brl(total)}</div></div>
      <span class="badge orange">${icon('clock')}Aguardando pagamento…</span>
    </div>`,
    foot: `<button class="btn btn-ghost" data-action="close-modal">Cancelar</button><button class="btn btn-primary" data-action="pix-confirm">${icon('check')}Pagamento recebido</button>`,
  });
}

function fakeQr(seed) {
  const n = 25, cell = 7, rng = mulberry32(seed);
  const finder = (x, y) => `<rect x="${x * cell}" y="${y * cell}" width="${7 * cell}" height="${7 * cell}" fill="#252668"/><rect x="${(x + 1) * cell}" y="${(y + 1) * cell}" width="${5 * cell}" height="${5 * cell}" fill="#fff"/><rect x="${(x + 2) * cell}" y="${(y + 2) * cell}" width="${3 * cell}" height="${3 * cell}" fill="#252668"/>`;
  let rects = '';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const inFinder = (x < 8 && y < 8) || (x > n - 9 && y < 8) || (x < 8 && y > n - 9);
    if (!inFinder && rng() < 0.48) rects += `<rect x="${x * cell}" y="${y * cell}" width="${cell}" height="${cell}"/>`;
  }
  const s = n * cell;
  return `<svg viewBox="0 0 ${s} ${s}" width="190" height="190" aria-label="QR Code Pix ilustrativo"><g fill="#252668">${rects}</g>${finder(0, 0)}${finder(n - 7, 0)}${finder(0, n - 7)}<rect x="${s / 2 - 18}" y="${s / 2 - 18}" width="36" height="36" rx="8" fill="#fff"/><path transform="translate(${s / 2 - 12} ${s / 2 - 12})" d="m12 2.5 9.5 9.5-9.5 9.5L2.5 12z" fill="none" stroke="#E2620A" stroke-width="3" stroke-linejoin="round"/></svg>`;
}

function finalizeSale() {
  const t = cartTotals();
  const items = ui.cart.map(i => { const p = prodOf(i.pid); return { pid: p.id, name: p.name, qty: i.qty, price: p.price, cost: p.cost }; });
  const sale = {
    id: db.nextSaleId++, date: new Date().toISOString(), items,
    subtotal: round2(t.subtotal), discount: t.discount, total: t.total,
    payment: ui.pos.payment, customerId: ui.pos.customerId || null,
    received: ui.pos.payment === 'dinheiro' && t.received ? t.received : null,
  };
  const nowLow = [];
  items.forEach(it => {
    const p = prodOf(it.pid);
    if (p.stock !== null) {
      const wasLow = isLow(p);
      p.stock = Math.max(0, p.stock - it.qty);
      if (!wasLow && isLow(p)) nowLow.push(p.name);
    }
  });
  db.sales.push(sale);
  save();
  ui.cart = [];
  ui.pos.discount = ''; ui.pos.received = ''; ui.pos.customerId = '';
  setCartOpen(false);
  render();
  showReceipt(sale);
  if (nowLow.length) setTimeout(() => toast(`Estoque baixo: ${nowLow.join(', ')}`, 'alert'), 900);
}

function showReceipt(sale) {
  const c = sale.customerId ? custOf(sale.customerId) : null;
  const d = new Date(sale.date);
  openModal({
    title: 'Venda concluída',
    body: `<div class="receipt-wrap">
      <div class="success-ring">${icon('check')}</div>
      <div class="receipt" id="receipt">
        <img src="assets/logo.png" alt="PC Papelaria Contacto" />
        <div class="c">Rua das Papelarias, 2003 · Centro<br>(11) 3000-2003</div>
        <hr>
        <div class="r-line"><span>VENDA Nº ${sale.id}</span><span>${d.toLocaleDateString('pt-BR')} ${fmtTime(sale.date)}</span></div>
        <div>Cliente: ${esc(c ? c.name : 'Consumidor final')}</div>
        <hr>
        ${sale.items.map(it => `<div>${esc(it.name)}</div><div class="r-line"><span>${it.qty} x ${brl(it.price)}</span><span>${brl(it.qty * it.price)}</span></div>`).join('')}
        <hr>
        <div class="r-line"><span>Subtotal</span><span>${brl(sale.subtotal)}</span></div>
        ${sale.discount ? `<div class="r-line"><span>Desconto</span><span>− ${brl(sale.discount)}</span></div>` : ''}
        <div class="r-line r-total"><span>TOTAL</span><span>${brl(sale.total)}</span></div>
        <div class="r-line"><span>Pagamento</span><span>${payOf(sale.payment).name}</span></div>
        ${sale.received ? `<div class="r-line"><span>Recebido</span><span>${brl(sale.received)}</span></div><div class="r-line"><span>Troco</span><span>${brl(sale.received - sale.total)}</span></div>` : ''}
        <hr>
        <div class="c">Obrigado pela preferência!<br>Documento sem valor fiscal · demonstração</div>
      </div>
    </div>`,
    foot: `<button class="btn btn-ghost spacer" data-action="receipt-send">${icon('send')}WhatsApp</button><button class="btn btn-ghost" data-action="receipt-print">${icon('printer')}Imprimir</button><button class="btn btn-primary" data-action="close-modal">${icon('plus')}Nova venda</button>`,
  });
}

/* ---------- lista escolar ---------- */
const listItems = l => l.items.filter(([pid]) => prodOf(pid));
function openSchoolLists() {
  openModal({
    title: 'Lista escolar',
    body: `<p class="muted" style="margin-bottom:14px">Escolha a lista enviada pela escola. O sistema confere o estoque e monta o carrinho automaticamente.</p>
      <div class="sl-list">${SCHOOL_LISTS.map(l => {
        const total = sum(listItems(l), ([pid, q]) => prodOf(pid).price * q);
        return `<button class="sl-opt" data-action="school-pick" data-list="${l.id}">
          <span class="tile tone-orange">${icon('school')}</span>
          <span class="grow"><strong>${esc(l.name)}</strong><br><span class="muted" style="font-size:13px">${esc(l.school)} · ${plural(listItems(l).length, 'item', 'itens')}</span></span>
          <strong class="num">${brl(total)}</strong>${icon('chevronRight')}
        </button>`;
      }).join('')}</div>`,
  });
}

function openSchoolList(id) {
  const l = SCHOOL_LISTS.find(x => x.id === id);
  let total = 0, missing = 0;
  const rows = listItems(l).map(([pid, q]) => {
    const p = prodOf(pid);
    const ok = p.stock === null || p.stock >= q;
    if (ok) total += p.price * q; else missing++;
    return `<div class="sl-item">${catTile(p.cat)}<span class="grow">${q}× ${esc(p.name)}</span>
      ${ok ? `<span class="badge good">${icon('check')}Disponível</span>` : `<span class="badge bad">${icon('alert')}${p.stock ? `Só ${p.stock}` : 'Em falta'}</span>`}</div>`;
  }).join('');
  openModal({
    title: l.name,
    body: `<p class="muted">${esc(l.school)}</p>
      <div class="sl-items">${rows}</div>
      ${missing ? `<p class="badge warn" style="height:auto;padding:8px 12px;white-space:normal">${icon('alert')}${plural(missing, 'item ficará', 'itens ficarão')} de fora por falta de estoque.</p>` : ''}
      <div class="row-between" style="margin-top:14px"><span class="sum-line">Total da lista</span><span class="sum-total">${brl(total)}</span></div>`,
    foot: `<button class="btn btn-ghost" data-action="school-list">${icon('chevronLeft')}Voltar</button><button class="btn btn-orange" data-action="school-add" data-list="${l.id}">${icon('cart')}Adicionar ao carrinho</button>`,
  });
}

function addSchoolList(id) {
  const l = SCHOOL_LISTS.find(x => x.id === id);
  let added = 0;
  listItems(l).forEach(([pid, q]) => { if (addToCart(pid, q, true)) added++; });
  closeModal();
  toast(`${plural(added, 'item adicionado', 'itens adicionados')} da lista “${l.name}”`, 'clipboard');
  if (ui.route !== 'vender') go('vender'); else refreshCart();
}

/* =========================================================
   ESTOQUE
   ========================================================= */
function renderEstoque() {
  const goods = db.products.filter(p => p.stock !== null);
  const value = sum(goods, p => p.stock * p.cost);
  const low = lowStock().length;
  return `
  <section class="page-head">
    <div><p class="eyebrow">Produtos</p><h1>Estoque</h1><p class="sub">Controle de quantidades, preços e margens.</p></div>
    <div class="head-actions"><button class="btn btn-primary" data-action="new-product">${icon('plus')}Novo produto</button></div>
  </section>
  <section class="mini-stats">
    <div class="card mini-stat"><span class="tile tone-blue">${icon('box')}</span><div><strong>${goods.length}</strong><small>Produtos cadastrados</small></div></div>
    <div class="card mini-stat"><span class="tile tone-sky">${icon('wallet')}</span><div><strong>${brl(value)}</strong><small>Valor em estoque (custo)</small></div></div>
    <div class="card mini-stat"><span class="tile tone-bad">${icon('alert')}</span><div><strong>${low}</strong><small>Abaixo do mínimo</small></div></div>
  </section>
  <section class="toolbar">
    <label class="search">${icon('search')}<input class="input" id="stockSearch" type="search" placeholder="Buscar produto ou código" value="${esc(ui.stock.q)}" autocomplete="off" /></label>
    <select class="input" id="stockCat" aria-label="Categoria">
      <option value="all">Todas as categorias</option>
      ${CATEGORIES.map(c => `<option value="${c.id}" ${ui.stock.cat === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
    </select>
    <label class="toggle"><input type="checkbox" id="stockLow" ${ui.stock.low ? 'checked' : ''} />Só estoque baixo</label>
  </section>
  <section id="stockList">${renderStockList()}</section>`;
}

function stockBadge(p) {
  if (p.stock === null) return `<span class="badge neutral">${icon('printer')}Serviço</span>`;
  if (p.stock === 0) return `<span class="badge bad">${icon('x')}Esgotado</span>`;
  if (isLow(p)) return `<span class="badge warn">${icon('alert')}Baixo</span>`;
  return `<span class="badge good">${icon('check')}OK</span>`;
}

function renderStockList() {
  const q = ui.stock.q.trim().toLowerCase();
  const list = db.products.filter(p =>
    (ui.stock.cat === 'all' || p.cat === ui.stock.cat) &&
    (!ui.stock.low || isLow(p)) &&
    (!q || p.name.toLowerCase().includes(q) || p.sku.includes(q)));
  if (!list.length) return `<div class="card">${empty('search', 'Nenhum produto encontrado com esses filtros')}</div>`;

  const margin = p => Math.round(((p.price - p.cost) / p.price) * 100);
  const rows = list.map(p => {
    const pct = p.stock === null ? 0 : Math.min(100, (p.stock / Math.max(1, p.min * 3)) * 100);
    return `<tr>
      <td><div class="prod-cell">${catTile(p.cat)}<div><div class="title">${esc(p.name)}</div><div class="meta">${p.sku}</div></div></div></td>
      <td>${catOf(p.cat).name}</td>
      <td class="r num">${brl(p.price)}</td>
      <td class="r num">${margin(p)}%</td>
      <td>${p.stock === null ? stockBadge(p) : `<div class="stock-cell"><div class="row-between"><strong class="num">${p.stock} un</strong>${stockBadge(p)}</div><div class="stock-bar"><i class="${isLow(p) ? 'low' : ''}" style="width:${pct}%"></i></div></div>`}</td>
      <td><div class="row-actions">
        ${p.stock !== null ? `<button class="icon-btn sm" data-action="stock-adj" data-id="${p.id}" data-d="-1" aria-label="Retirar 1">${icon('minus')}</button>
        <button class="icon-btn sm" data-action="restock" data-id="${p.id}" aria-label="Entrada de estoque">${icon('plus')}</button>` : ''}
        <button class="icon-btn sm" data-action="edit-product" data-id="${p.id}" aria-label="Editar">${icon('pencil')}</button>
      </div></td>
    </tr>`;
  }).join('');

  const mobile = list.map(p => `
    <div class="card m-item" data-action="edit-product" data-id="${p.id}">
      ${catTile(p.cat)}
      <div><div class="title">${esc(p.name)}</div><div class="meta">${catOf(p.cat).name} · margem ${margin(p)}%</div><div style="margin-top:6px">${stockBadge(p)} ${p.stock !== null ? `<span class="muted num" style="font-size:12.5px;font-weight:600">${p.stock} un</span>` : ''}</div></div>
      <div class="right"><span class="price">${brl(p.price)}</span>${p.stock !== null ? `<button class="btn btn-sm btn-soft" data-action="restock" data-id="${p.id}">${icon('plus')}Entrada</button>` : ''}</div>
    </div>`).join('');

  return `<div class="card table-card"><table class="table">
      <thead><tr><th>Produto</th><th>Categoria</th><th class="r">Preço</th><th class="r">Margem</th><th>Estoque</th><th class="r">Ações</th></tr></thead>
      <tbody>${rows}</tbody></table></div>
    <div class="m-list">${mobile}</div>`;
}

function openProductForm(id) {
  const p = id ? prodOf(id) : { name: '', cat: 'cadernos', price: '', cost: '', stock: 0, min: 5, sku: '789' + Math.floor(1e9 + Math.random() * 9e9) };
  const isService = p.stock === null;
  openModal({
    title: id ? 'Editar produto' : 'Novo produto',
    body: `<form id="productForm" data-form="product" data-id="${id || ''}" class="form-grid">
      <label class="field full"><span>Nome do produto</span><input name="name" required value="${esc(p.name)}" placeholder="Ex.: Caderno Espiral 1 Matéria" /></label>
      <label class="field"><span>Categoria</span><select name="cat">${CATEGORIES.map(c => `<option value="${c.id}" ${p.cat === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}</select></label>
      <label class="field"><span>Código de barras</span><input name="sku" value="${esc(p.sku)}" inputmode="numeric" /></label>
      <label class="field"><span>Preço de venda (R$)</span><input name="price" type="number" step="0.01" min="0" required value="${p.price}" inputmode="decimal" /></label>
      <label class="field"><span>Custo (R$)</span><input name="cost" type="number" step="0.01" min="0" required value="${p.cost}" inputmode="decimal" /></label>
      ${isService ? '' : `
      <label class="field"><span>Estoque atual</span><input name="stock" type="number" step="1" min="0" required value="${p.stock}" inputmode="numeric" /></label>
      <label class="field"><span>Estoque mínimo</span><input name="min" type="number" step="1" min="0" required value="${p.min}" inputmode="numeric" /></label>`}
      <div class="full badge info" id="marginPreview" style="height:auto;padding:10px 12px;justify-content:flex-start"></div>
    </form>`,
    foot: `${id ? `<button class="btn btn-danger spacer" data-action="delete-product" data-id="${id}">${icon('trash')}Excluir</button>` : ''}
      <button class="btn btn-ghost" data-action="close-modal">Cancelar</button>
      <button class="btn btn-primary" type="submit" form="productForm">${icon('check')}Salvar</button>`,
    onMount: root => {
      const f = $('#productForm', root);
      const upd = () => {
        const price = parseFloat(f.price.value) || 0, cost = parseFloat(f.cost.value) || 0;
        $('#marginPreview', root).innerHTML = price ? `${icon('percent')}Margem de ${Math.round(((price - cost) / price) * 100)}% · lucro de ${brl(price - cost)} por unidade` : `${icon('percent')}Informe preço e custo para ver a margem`;
      };
      f.addEventListener('input', upd); upd();
    },
  });
}

function openRestock(id) {
  const p = prodOf(id);
  const suggestion = Math.max(1, p.min * 3 - p.stock);
  openModal({
    title: 'Entrada de estoque',
    body: `<form id="restockForm" data-form="restock" data-id="${id}" style="display:grid;gap:16px">
      <div class="list-row" style="padding:0">${catTile(p.cat)}<div class="grow"><div class="title">${esc(p.name)}</div><div class="meta">Atual: ${p.stock} un · mínimo ${p.min} un</div></div></div>
      <label class="field"><span>Quantidade recebida</span><input name="qty" type="number" min="1" step="1" required value="${suggestion}" inputmode="numeric" /></label>
      <div class="chips">${[6, 12, 24, 50].map(n => `<button type="button" class="chip" data-set-qty="${n}">+${n}</button>`).join('')}</div>
      <p class="muted" style="font-size:13px">Sugestão calculada para cobrir 3× o estoque mínimo.</p>
    </form>`,
    foot: `<button class="btn btn-ghost" data-action="close-modal">Cancelar</button><button class="btn btn-primary" type="submit" form="restockForm">${icon('check')}Confirmar entrada</button>`,
    onMount: root => $$('[data-set-qty]', root).forEach(b => b.addEventListener('click', () => { $('#restockForm', root).qty.value = b.dataset.setQty; })),
  });
}

/* =========================================================
   SERVIÇOS (ordens de serviço)
   ========================================================= */
const STATUS_COLOR = { recebido: 'var(--muted)', producao: 'var(--blue)', pronto: 'var(--orange)', entregue: 'var(--good)' };

function renderServicos() {
  const open = openOrders();
  const today = open.filter(o => daysFromToday(o.due) === 0).length;
  const late = open.filter(o => new Date(o.due) < new Date() && daysFromToday(o.due) < 0).length;
  const forecast = sum(open, o => o.qty * o.price);
  return `
  <section class="page-head">
    <div><p class="eyebrow">Balcão</p><h1>Ordens de serviço</h1><p class="sub">Impressões, encadernações, plastificações e encomendas.</p></div>
    <div class="head-actions"><button class="btn btn-primary" data-action="new-os">${icon('plus')}Nova OS</button></div>
  </section>
  <section class="kpis">
    ${kpiMini('Em aberto', open.length, 'tone-blue', 'layers')}
    ${kpiMini('Entrega hoje', today, 'tone-orange', 'clock')}
    ${kpiMini('Atrasadas', late, 'tone-bad', 'alert')}
    ${kpiMini('A faturar', brl(forecast), 'tone-sky', 'wallet')}
  </section>
  <p class="muted" style="font-size:13px;margin:-4px 0 12px"><span class="hide-m">Arraste os cartões entre as colunas ou use as setas para mudar o status.</span><span class="show-m">Deslize para o lado para ver todas as etapas. Use as setas para avançar a OS.</span></p>
  <section class="kanban">
    ${ORDER_STATUS.map((s, si) => {
      const list = db.orders.filter(o => o.status === s.id).sort((a, b) => a.due.localeCompare(b.due));
      return `<div class="k-col" data-status="${s.id}">
        <div class="k-head"><span class="k-dot" style="background:${STATUS_COLOR[s.id]}"></span>${s.name}<span class="count">${list.length}</span></div>
        <div class="k-cards">${list.map(o => osCard(o, si)).join('') || `<div class="empty" style="padding:18px 6px">Nenhuma OS</div>`}</div>
      </div>`;
    }).join('')}
  </section>`;
}

function kpiMini(label, value, tone, ic) {
  return `<div class="card kpi"><div class="kpi-top"><span class="kpi-ico ${tone}">${icon(ic)}</span>${label}</div><div class="kpi-value">${value}</div></div>`;
}

function dueBadge(o) {
  if (o.status === 'entregue') return `<span class="badge good">${icon('check')}Entregue</span>`;
  const d = daysFromToday(o.due);
  if (d < 0) return `<span class="badge bad">${icon('alert')}Atrasada</span>`;
  if (d === 0) return `<span class="badge orange">${icon('clock')}Hoje ${fmtTime(o.due)}</span>`;
  if (d === 1) return `<span class="badge info">${icon('calendar')}Amanhã</span>`;
  return `<span class="badge neutral">${icon('calendar')}${fmtDate(o.due)}</span>`;
}

function osCard(o, si) {
  const c = custOf(o.customerId);
  return `<article class="k-card" draggable="true" data-os="${o.id}" data-action="edit-os" data-id="${o.id}" tabindex="0">
    <div class="k-top"><span class="k-id">OS #${o.id}</span><span class="badge info">${esc(o.type)}</span></div>
    <div class="k-client">${esc(c ? c.name : o.customerName || 'Cliente avulso')}</div>
    <div class="k-desc">${esc(o.desc)}</div>
    <div class="k-foot">${dueBadge(o)}<span class="k-price">${brl(o.qty * o.price)}</span></div>
    <div class="k-foot">
      <span class="muted" style="font-size:12px">${o.qty} × ${brl(o.price)}</span>
      <span class="k-move">
        ${si > 0 ? `<button class="icon-btn sm" data-action="os-move" data-id="${o.id}" data-dir="-1" aria-label="Voltar etapa">${icon('chevronLeft')}</button>` : ''}
        ${si < ORDER_STATUS.length - 1 ? `<button class="icon-btn sm" data-action="os-move" data-id="${o.id}" data-dir="1" aria-label="Avançar etapa">${icon('chevronRight')}</button>` : ''}
      </span>
    </div>
  </article>`;
}

function setOrderStatus(id, status) {
  const o = db.orders.find(x => x.id === id);
  if (!o || o.status === status) return;
  o.status = status;
  save();
  render();
  const c = custOf(o.customerId);
  if (status === 'pronto') toast(`OS #${o.id} pronta — ${c ? c.name.split(' ')[0] : 'cliente'} avisado(a) por WhatsApp`, 'send');
  else if (status === 'entregue') toast(`OS #${o.id} entregue ao cliente`, 'check');
  else toast(`OS #${o.id} movida para “${ORDER_STATUS.find(s => s.id === status).name}”`, 'layers');
}

function bindKanban() {
  let dragId = null;
  $$('.k-card').forEach(card => {
    card.addEventListener('dragstart', e => { dragId = +card.dataset.os; card.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', card.dataset.os); });
    card.addEventListener('dragend', () => { card.classList.remove('dragging'); $$('.k-col').forEach(c => c.classList.remove('drag-over')); });
    card.addEventListener('keydown', e => { if (e.key === 'Enter') openOrderForm(+card.dataset.os); });
  });
  $$('.k-col').forEach(col => {
    col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('drag-over'); });
    col.addEventListener('dragleave', e => { if (!col.contains(e.relatedTarget)) col.classList.remove('drag-over'); });
    col.addEventListener('drop', e => { e.preventDefault(); col.classList.remove('drag-over'); if (dragId) setOrderStatus(dragId, col.dataset.status); dragId = null; });
  });
}

function openOrderForm(id) {
  const o = id ? db.orders.find(x => x.id === id) : { customerId: '', type: 'Impressão', desc: '', qty: 1, price: 0.5, status: 'recebido', due: new Date(Date.now() + DAY).toISOString() };
  openModal({
    title: id ? `OS #${id}` : 'Nova ordem de serviço',
    wide: true,
    body: `<form id="osForm" data-form="os" data-id="${id || ''}" class="form-grid">
      <label class="field"><span>Cliente</span><select name="customerId"><option value="">Cliente avulso</option>${db.customers.map(c => `<option value="${c.id}" ${o.customerId === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
      <label class="field"><span>Tipo de serviço</span><select name="type">${SERVICE_TYPES.map(t => `<option ${o.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      <label class="field full"><span>Descrição</span><textarea name="desc" required placeholder="Ex.: 50 cópias coloridas A4, frente e verso">${esc(o.desc)}</textarea></label>
      <label class="field"><span>Quantidade</span><input name="qty" type="number" min="1" step="1" required value="${o.qty}" inputmode="numeric" /></label>
      <label class="field"><span>Valor unitário (R$)</span><input name="price" type="number" min="0" step="0.01" required value="${o.price}" inputmode="decimal" /></label>
      <label class="field"><span>Entrega</span><input name="due" type="datetime-local" required value="${toLocalInput(o.due)}" /></label>
      <label class="field"><span>Status</span><select name="status">${ORDER_STATUS.map(s => `<option value="${s.id}" ${o.status === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}</select></label>
      <div class="full row-between" style="padding-top:4px"><span class="sum-line">Total da OS</span><span class="sum-total" id="osTotal"></span></div>
    </form>`,
    foot: `${id ? `<button class="btn btn-danger spacer" data-action="delete-os" data-id="${id}">${icon('trash')}Excluir</button>` : ''}
      <button class="btn btn-ghost" data-action="close-modal">Cancelar</button>
      <button class="btn btn-primary" type="submit" form="osForm">${icon('check')}Salvar OS</button>`,
    onMount: root => {
      const f = $('#osForm', root);
      const upd = () => { $('#osTotal', root).textContent = brl((parseFloat(f.qty.value) || 0) * (parseFloat(f.price.value) || 0)); };
      f.addEventListener('input', upd); upd();
    },
  });
}

/* =========================================================
   CLIENTES
   ========================================================= */
const CUST_TYPES = {
  escola:  { name: 'Escola',  color: '#1957A4', icon: 'school' },
  empresa: { name: 'Empresa', color: '#252668', icon: 'building' },
  varejo:  { name: 'Varejo',  color: '#B4500A', icon: 'user' },
};

function customerStats(id) {
  const list = db.sales.filter(s => s.customerId === id);
  return { list, total: sum(list, 'total'), count: list.length, last: list.length ? list[list.length - 1].date : null };
}

function renderClientes() {
  return `
  <section class="page-head">
    <div><p class="eyebrow">Relacionamento</p><h1>Clientes</h1><p class="sub">Escolas, empresas e clientes do balcão.</p></div>
    <div class="head-actions"><button class="btn btn-primary" data-action="new-customer">${icon('plus')}Novo cliente</button></div>
  </section>
  <section class="toolbar">
    <label class="search">${icon('search')}<input class="input" id="custSearch" type="search" placeholder="Buscar por nome, telefone ou e-mail" value="${esc(ui.cust.q)}" autocomplete="off" /></label>
    <div class="chips">
      ${[['all', 'Todos'], ['escola', 'Escolas'], ['empresa', 'Empresas'], ['varejo', 'Varejo']].map(([id, n]) => `<button class="chip ${ui.cust.type === id ? 'active' : ''}" data-action="cust-type" data-type="${id}">${n}</button>`).join('')}
    </div>
  </section>
  <section class="cust-grid" id="custGrid">${renderCustGrid()}</section>`;
}

function renderCustGrid() {
  const q = ui.cust.q.trim().toLowerCase();
  const list = db.customers
    .filter(c => (ui.cust.type === 'all' || c.type === ui.cust.type) && (!q || [c.name, c.phone, c.email].some(v => v.toLowerCase().includes(q))))
    .map(c => ({ c, s: customerStats(c.id) }))
    .sort((a, b) => b.s.total - a.s.total);
  if (!list.length) return `<div class="card" style="grid-column:1/-1">${empty('users', 'Nenhum cliente encontrado')}</div>`;
  return list.map(({ c, s }) => {
    const t = CUST_TYPES[c.type];
    return `<button class="card cust-card" data-action="open-customer" data-id="${c.id}">
      <div class="cust-top">
        <span class="initials" style="background:${t.color}">${initials(c.name)}</span>
        <div class="grow"><div class="cust-name">${esc(c.name)}</div><div class="cust-sub">${esc(c.phone)}</div></div>
        <span class="badge info">${icon(t.icon)}${t.name}</span>
      </div>
      <div class="cust-stats">
        <div><small>Total gasto</small><strong>${brl(s.total)}</strong></div>
        <div><small>Compras</small><strong>${s.count}</strong></div>
        <div><small>Última</small><strong>${s.last ? relDay(s.last) : '—'}</strong></div>
      </div>
    </button>`;
  }).join('');
}

function openCustomer(id) {
  const c = custOf(id), s = customerStats(id), t = CUST_TYPES[c.type];
  const orders = db.orders.filter(o => o.customerId === id && o.status !== 'entregue');
  openModal({
    title: 'Cliente',
    wide: true,
    body: `
      <div class="cust-top" style="margin-bottom:16px">
        <span class="initials" style="background:${t.color};width:56px;height:56px;font-size:18px">${initials(c.name)}</span>
        <div class="grow"><div class="cust-name" style="font-size:18px">${esc(c.name)}</div><span class="badge info">${icon(t.icon)}${t.name}</span></div>
      </div>
      <div class="list" style="margin-bottom:12px">
        <div class="list-row"><span class="tile tone-sky">${icon('phone')}</span><div class="grow"><div class="meta">Telefone / WhatsApp</div><div class="title">${esc(c.phone)}</div></div></div>
        <div class="list-row"><span class="tile tone-sky">${icon('mail')}</span><div class="grow"><div class="meta">E-mail</div><div class="title">${esc(c.email || '—')}</div></div></div>
      </div>
      <div class="cust-stats" style="margin-bottom:18px">
        <div><small>Total gasto</small><strong>${brl(s.total)}</strong></div>
        <div><small>Compras</small><strong>${s.count}</strong></div>
        <div><small>Ticket médio</small><strong>${brl(s.count ? s.total / s.count : 0)}</strong></div>
      </div>
      ${orders.length ? `<h4 style="font-size:14px;margin-bottom:8px">Serviços em andamento</h4><div class="list" style="margin-bottom:18px">${orders.map(o => `<div class="list-row"><span class="tile tone-orange">${icon('printer')}</span><div class="grow"><div class="title">OS #${o.id} · ${esc(o.type)}</div><div class="meta">${esc(o.desc)}</div></div>${dueBadge(o)}</div>`).join('')}</div>` : ''}
      <h4 style="font-size:14px;margin-bottom:8px">Últimas compras</h4>
      <div class="list">${s.list.slice(-6).reverse().map(x => saleRow(x, true)).join('') || empty('receipt', 'Ainda sem compras registradas')}</div>`,
    foot: `<button class="btn btn-ghost" data-action="close-modal">Fechar</button><button class="btn btn-orange" data-action="sell-to" data-id="${id}">${icon('cart')}Nova venda para este cliente</button>`,
  });
}

function openCustomerForm() {
  openModal({
    title: 'Novo cliente',
    body: `<form id="custForm" data-form="customer" class="form-grid">
      <label class="field full"><span>Nome ou razão social</span><input name="name" required placeholder="Ex.: Escola Estadual Primavera" /></label>
      <label class="field"><span>Tipo</span><select name="type"><option value="varejo">Varejo</option><option value="escola">Escola</option><option value="empresa">Empresa</option></select></label>
      <label class="field"><span>Telefone / WhatsApp</span><input name="phone" required inputmode="tel" placeholder="(11) 90000-0000" /></label>
      <label class="field full"><span>E-mail</span><input name="email" type="email" placeholder="contato@exemplo.com" /></label>
    </form>`,
    foot: `<button class="btn btn-ghost" data-action="close-modal">Cancelar</button><button class="btn btn-primary" type="submit" form="custForm">${icon('check')}Cadastrar</button>`,
  });
}

/* =========================================================
   FINANCEIRO
   ========================================================= */
function renderFinanceiro() {
  const sales = salesSince(30);
  const revenue = sum(sales, 'subtotal');
  const discounts = sum(sales, 'discount');
  const net = sum(sales, 'total');
  const cogs = sum(sales, s => sum(s.items, it => it.qty * it.cost));
  const gross = net - cogs;
  const from = Date.now() - 30 * DAY;
  const paid = db.expenses.filter(e => e.paid && new Date(e.due).getTime() >= from - 5 * DAY);
  const paidTotal = sum(paid, 'amount');
  const pending = db.expenses.filter(e => !e.paid);
  const result = gross - paidTotal;

  const byPay = PAYMENT_METHODS.map(m => {
    const v = sum(sales.filter(s => s.payment === m.id), 'total');
    return { label: m.name, value: v, display: `${brl(v)} · ${net ? Math.round((v / net) * 100) : 0}%` };
  }).sort((a, b) => b.value - a.value);

  const byCat = CATEGORIES.map(c => {
    const v = sum(sales, s => sum(s.items.filter(it => prodOf(it.pid)?.cat === c.id), it => it.qty * it.price));
    return { label: c.name, value: v };
  }).sort((a, b) => b.value - a.value);

  const expenses = [...db.expenses].sort((a, b) => (a.paid - b.paid) || a.due.localeCompare(b.due));

  return `
  <section class="page-head">
    <div><p class="eyebrow">Últimos 30 dias</p><h1>Financeiro</h1><p class="sub">Entradas, contas a pagar e resultado do período.</p></div>
    <div class="head-actions"><button class="btn btn-primary" data-action="new-expense">${icon('plus')}Nova despesa</button></div>
  </section>
  <section class="kpis">
    ${kpi('Entradas', brl(net), 'tone-good', 'trendUp', '', plural(sales.length, 'venda', 'vendas'))}
    ${kpi('Despesas pagas', brl(paidTotal), 'tone-bad', 'trendDown', '', plural(paid.length, 'lançamento', 'lançamentos'))}
    ${kpi('A pagar', brl(sum(pending, 'amount')), 'tone-orange', 'calendar', '', plural(pending.length, 'conta em aberto', 'contas em aberto'))}
    ${kpi('Margem bruta', `${net ? Math.round((gross / net) * 100) : 0}%`, 'tone-blue', 'percent', '', `${brl(gross)} de lucro bruto`)}
  </section>
  <section class="fin-a">
    <div class="card">
      <div class="card-head"><div><h3>Contas a pagar</h3><div class="sub">Fornecedores e despesas fixas</div></div></div>
      <div class="list">${expenses.map(expenseRow).join('')}</div>
    </div>
    <div class="card">
      <div class="card-head"><div><h3>Formas de pagamento</h3><div class="sub">Participação nas vendas</div></div></div>
      ${hbars(byPay)}
    </div>
  </section>
  <section class="fin-b">
    <div class="card">
      <div class="card-head"><div><h3>Vendas por categoria</h3><div class="sub">Receita por linha de produto</div></div></div>
      ${hbars(byCat)}
    </div>
    <div class="card">
      <div class="card-head"><div><h3>Resultado do período</h3><div class="sub">Demonstrativo simplificado</div></div></div>
      <div class="list">
        ${dreLine('Receita bruta', revenue)}
        ${dreLine('(−) Descontos concedidos', -discounts)}
        ${dreLine('(−) Custo das mercadorias', -cogs)}
        ${dreLine('= Lucro bruto', gross, true)}
        ${dreLine('(−) Despesas pagas', -paidTotal)}
        ${dreLine('= Resultado', result, true, true)}
      </div>
    </div>
  </section>`;
}

function dreLine(label, value, strong = false, highlight = false) {
  const color = highlight ? (value >= 0 ? 'var(--good)' : 'var(--bad)') : '';
  return `<div class="list-row"><div class="grow" style="${strong ? 'font-weight:700' : 'color:var(--text-2)'}">${label}</div><span class="amount" style="${color ? `color:${color};font-size:17px` : ''}">${value < 0 ? '− ' + brl(-value) : brl(value)}</span></div>`;
}

function expenseRow(e) {
  const d = daysFromToday(e.due);
  let badge;
  if (e.paid) badge = `<span class="badge good">${icon('check')}Pago</span>`;
  else if (d < 0) badge = `<span class="badge bad">${icon('alert')}Vencida</span>`;
  else if (d <= 3) badge = `<span class="badge warn">${icon('clock')}${d === 0 ? 'Vence hoje' : `Vence em ${d}d`}</span>`;
  else badge = `<span class="badge neutral">${icon('calendar')}${fmtDate(e.due)}</span>`;
  return `<div class="list-row">
    <span class="tile ${e.paid ? 'tone-good' : 'tone-orange'}">${icon(e.cat === 'Fornecedores' ? 'box' : e.cat === 'Pessoal' ? 'users' : 'receipt')}</span>
    <div class="grow"><div class="title">${esc(e.desc)}</div><div class="meta">${esc(e.cat)} · venc. ${fmtDate(e.due)}</div></div>
    <div style="display:grid;justify-items:end;gap:4px"><span class="amount">${brl(e.amount)}</span>${badge}</div>
    ${e.paid ? '' : `<button class="btn btn-sm btn-soft" data-action="pay-expense" data-id="${e.id}">Pagar</button>`}
  </div>`;
}

function openExpenseForm() {
  openModal({
    title: 'Nova despesa',
    body: `<form id="expForm" data-form="expense" class="form-grid">
      <label class="field full"><span>Descrição</span><input name="desc" required placeholder="Ex.: Fornecedor de cadernos — NF 1234" /></label>
      <label class="field"><span>Categoria</span><select name="cat">${['Fornecedores', 'Fixas', 'Pessoal', 'Serviços', 'Outros'].map(c => `<option>${c}</option>`).join('')}</select></label>
      <label class="field"><span>Valor (R$)</span><input name="amount" type="number" min="0.01" step="0.01" required inputmode="decimal" /></label>
      <label class="field"><span>Vencimento</span><input name="due" type="date" required value="${toLocalInput(new Date(Date.now() + 7 * DAY).toISOString(), false)}" /></label>
      <label class="field" style="align-content:end"><span class="toggle" style="height:46px"><input type="checkbox" name="paid" />Já está paga</span></label>
    </form>`,
    foot: `<button class="btn btn-ghost" data-action="close-modal">Cancelar</button><button class="btn btn-primary" type="submit" form="expForm">${icon('check')}Lançar</button>`,
  });
}

/* =========================================================
   CONFIGURAÇÕES
   ========================================================= */
function renderConfig() {
  const t = document.documentElement.dataset.theme || 'auto';
  return `
  <section class="page-head"><div><p class="eyebrow">Sistema</p><h1>Configurações</h1><p class="sub">Preferências da loja e desta demonstração.</p></div></section>
  <section class="settings">
    <div class="card">
      <div class="card-head"><h3>Aparência</h3></div>
      <div class="set-row"><div><strong>Tema</strong><small>Escolha como o sistema aparece</small></div>
        <div class="seg">${[['light', 'Claro'], ['dark', 'Escuro'], ['auto', 'Automático']].map(([id, n]) => `<button class="${t === id ? 'active' : ''}" data-action="theme-set" data-theme="${id}">${n}</button>`).join('')}</div>
      </div>
    </div>
    <div class="card">
      <div class="card-head"><h3>Loja</h3></div>
      <div class="set-row"><div><strong>PC Papelaria Contacto</strong><small>Nome fantasia</small></div><span class="badge info">Matriz</span></div>
      <div class="set-row"><div><strong>Caixa 01 · Loja Centro</strong><small>Ponto de venda deste dispositivo</small></div><span class="badge good">${icon('check')}Online</span></div>
    </div>
    <div class="card">
      <div class="card-head"><h3>Dados da demonstração</h3></div>
      <div class="set-row"><div><strong>Exportar dados</strong><small>Baixe um arquivo JSON com tudo que foi registrado</small></div><button class="btn btn-ghost btn-sm" data-action="export">${icon('download')}Exportar</button></div>
      <div class="set-row"><div><strong>Restaurar dados originais</strong><small>Apaga vendas e cadastros feitos neste navegador</small></div><button class="btn btn-danger btn-sm" data-action="reset">${icon('refresh')}Restaurar</button></div>
    </div>
    <div class="card">
      <div class="about-logo"><img src="assets/logo.png" alt="PC Papelaria Contacto — desde 2003" /></div>
      <p style="font-size:14px;color:var(--text-2)">Protótipo funcional de sistema de gestão para papelarias: PDV, estoque, ordens de serviço, clientes e financeiro. Feito em HTML, CSS e JavaScript puro, funciona no celular e no computador, sem instalação.</p>
      <p class="credit" style="text-align:left;margin-top:12px">${creditHtml()}</p>
    </div>
  </section>`;
}

function creditHtml() {
  const name = AUTHOR.url ? `<a href="${esc(AUTHOR.url)}" target="_blank" rel="noopener">${esc(AUTHOR.name)}</a>` : `<strong>${esc(AUTHOR.name)}</strong>`;
  return `Protótipo desenvolvido por ${name}`;
}

/* =========================================================
   Notificações, tema, modal, toast
   ========================================================= */
function notifications() {
  const out = [];
  db.orders.filter(o => o.status !== 'entregue' && daysFromToday(o.due) < 0).forEach(o => out.push({ ic: 'alert', tone: 'tone-bad', title: `OS #${o.id} atrasada`, sub: `${custOf(o.customerId)?.name || 'Cliente'} · ${o.type}`, go: 'servicos' }));
  db.orders.filter(o => o.status !== 'entregue' && daysFromToday(o.due) === 0).forEach(o => out.push({ ic: 'clock', tone: 'tone-orange', title: `OS #${o.id} para hoje às ${fmtTime(o.due)}`, sub: `${custOf(o.customerId)?.name || 'Cliente'} · ${o.type}`, go: 'servicos' }));
  lowStock().forEach(p => out.push({ ic: 'box', tone: 'tone-blue', title: p.stock === 0 ? `${p.name} esgotado` : `Estoque baixo: ${p.name}`, sub: `Restam ${p.stock} · mínimo ${p.min}`, go: 'estoque' }));
  db.expenses.filter(e => !e.paid && daysFromToday(e.due) <= 3).forEach(e => out.push({ ic: 'wallet', tone: 'tone-sky', title: daysFromToday(e.due) < 0 ? `Conta vencida: ${e.desc}` : `Conta a vencer: ${e.desc}`, sub: `${brl(e.amount)} · ${fmtDate(e.due)}`, go: 'financeiro' }));
  return out;
}

function togglePopover() {
  const pop = $('#notifPop');
  if (!pop.hidden) { hidePopover(); return; }
  const list = notifications();
  pop.innerHTML = `<div class="pop-title">Notificações</div>${list.map(n => `<button class="pop-item" data-go="${n.go}"><span class="tile ${n.tone}">${icon(n.ic)}</span><span><strong style="font-size:13.5px">${esc(n.title)}</strong><small>${esc(n.sub)}</small></span></button>`).join('') || empty('bell', 'Nenhuma notificação')}`;
  pop.hidden = false;
}
function hidePopover() { const p = $('#notifPop'); if (p) p.hidden = true; }

function isDark() {
  const t = document.documentElement.dataset.theme;
  if (t) return t === 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}
function setTheme(t) {
  if (t === 'auto') { delete document.documentElement.dataset.theme; store(THEME_KEY); }
  else { document.documentElement.dataset.theme = t; store(THEME_KEY, t); }
  $('meta[name="theme-color"]').setAttribute('content', isDark() ? '#0C0E28' : '#2E3097');
  render();
}

function openModal({ title, body, foot = '', wide = false, onMount }) {
  const root = $('#modalRoot');
  root.innerHTML = `<div class="modal-backdrop" data-backdrop>
    <div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="modal-head"><h2>${esc(title)}</h2><button class="icon-btn sm" data-action="close-modal" aria-label="Fechar">${icon('x')}</button></div>
      <div class="modal-body">${body}</div>
      ${foot ? `<div class="modal-foot">${foot}</div>` : ''}
    </div></div>`;
  document.body.style.overflow = 'hidden';
  onMount && onMount(root);
  const first = $('input:not([type=hidden]), select, textarea', root);
  if (first && window.matchMedia('(min-width: 901px)').matches) setTimeout(() => first.focus(), 60);
}
function closeModal() {
  const root = $('#modalRoot');
  if (root && root.innerHTML) { root.innerHTML = ''; document.body.style.overflow = ''; }
}

function confirmModal(title, text, okLabel, onOk) {
  ui.confirm = onOk;
  openModal({
    title,
    body: `<p style="color:var(--text-2)">${text}</p>`,
    foot: `<button class="btn btn-ghost" data-action="close-modal">Cancelar</button><button class="btn btn-danger" data-action="confirm-ok">${okLabel}</button>`,
  });
}

function toast(msg, ic = 'check') {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `${icon(ic)}<span>${esc(msg)}</span>`;
  const box = $('#toasts');
  while (box.children.length >= 2) box.firstElementChild.remove();
  box.appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 260); }, 3000);
}

/* =========================================================
   Eventos (delegação)
   ========================================================= */
document.addEventListener('click', e => {
  const tip = $('#chartTip');
  if (tip && !e.target.closest('.chart')) tip.hidden = true;

  if (e.target.matches('[data-backdrop]')) { closeModal(); return; }
  if (!e.target.closest('.notif-wrap')) hidePopover();

  const goEl = e.target.closest('[data-go]');
  if (goEl) { hidePopover(); closeModal(); go(goEl.dataset.go); return; }

  const lowLink = e.target.closest('[data-low]');
  if (lowLink) { ui.stock.low = true; ui.stock.cat = 'all'; ui.stock.q = ''; }

  const el = e.target.closest('[data-action]');
  if (!el) return;
  const { action, id } = el.dataset;

  switch (action) {
    case 'logout': session(AUTH_KEY, null); showLogin(); break;
    case 'toggle-theme': closeModal(); setTheme(isDark() ? 'light' : 'dark'); break;
    case 'theme-set': setTheme(el.dataset.theme); break;
    case 'toggle-notif': togglePopover(); break;
    case 'close-modal': closeModal(); break;
    case 'confirm-ok': { const fn = ui.confirm; ui.confirm = null; closeModal(); fn && fn(); break; }
    case 'more':
      openModal({
        title: 'Mais opções',
        body: `<div class="more-grid">
          ${[['clientes', 'Clientes', 'users', 'tone-blue'], ['financeiro', 'Financeiro', 'wallet', 'tone-good'], ['config', 'Ajustes', 'settings', 'tone-sky']].map(([r, n, ic, tone]) => `<button class="more-item" data-go="${r}"><span class="tile ${tone}">${icon(ic)}</span>${n}</button>`).join('')}
          <button class="more-item" data-action="school-list"><span class="tile tone-orange">${icon('clipboard')}</span>Lista escolar</button>
          <button class="more-item" data-action="toggle-theme"><span class="tile tone-blue">${icon(isDark() ? 'sun' : 'moon')}</span>${isDark() ? 'Tema claro' : 'Tema escuro'}</button>
          <button class="more-item" data-action="logout"><span class="tile tone-bad">${icon('logout')}</span>Sair</button>
        </div>
        <p class="credit" style="margin-top:18px">${creditHtml()}</p>`,
      });
      break;

    // dashboard
    case 'chart-range': ui.chartRange = +el.dataset.range; $$('.seg [data-action="chart-range"]').forEach(b => b.classList.toggle('active', b === el)); drawRevenueChart(); break;

    // PDV
    case 'pos-cat': ui.pos.cat = el.dataset.cat; $$('.pos-cats .chip').forEach(c => c.classList.toggle('active', c === el)); $('#prodGrid').innerHTML = renderProdGrid(); break;
    case 'add':
      if (addToCart(id)) {
        refreshCart();
        const fab = $('#cartFab');
        fab.classList.remove('bump'); void fab.offsetWidth; fab.classList.add('bump');
      }
      break;
    case 'inc': if (addToCart(id)) refreshCart(); break;
    case 'dec': {
      const line = ui.cart.find(i => i.pid === id);
      if (line) { line.qty--; if (line.qty <= 0) ui.cart = ui.cart.filter(i => i !== line); }
      refreshCart();
      if (!ui.cart.length) setCartOpen(false);
      break;
    }
    case 'clear-cart': ui.cart = []; refreshCart(); setCartOpen(false); break;
    case 'pay': ui.pos.payment = el.dataset.pay; refreshCart({ grid: false }); break;
    case 'open-cart': setCartOpen(true); break;
    case 'close-cart': setCartOpen(false); break;
    case 'checkout': checkout(); break;
    case 'pix-confirm': closeModal(); finalizeSale(); break;
    case 'receipt-print': window.print(); break;
    case 'receipt-send': toast('Cupom enviado por WhatsApp (demonstração)', 'send'); break;
    case 'school-list': hidePopover(); openSchoolLists(); break;
    case 'school-pick': openSchoolList(el.dataset.list); break;
    case 'school-add': addSchoolList(el.dataset.list); break;

    // estoque
    case 'new-product': openProductForm(); break;
    case 'edit-product': if (!e.target.closest('button[data-action="restock"]')) openProductForm(id); break;
    case 'restock': openRestock(id); break;
    case 'stock-adj': {
      const p = prodOf(id);
      p.stock = Math.max(0, p.stock + +el.dataset.d);
      save(); refreshStock(); renderNav();
      break;
    }
    case 'delete-product':
      confirmModal('Excluir produto', `Tem certeza que deseja excluir <strong>${esc(prodOf(id).name)}</strong>? O histórico de vendas é mantido.`, 'Excluir', () => {
        db.products = db.products.filter(p => p.id !== id);
        ui.cart = ui.cart.filter(i => i.pid !== id);
        save(); render(); toast('Produto excluído', 'trash');
      });
      break;

    // serviços
    case 'new-os': openOrderForm(); break;
    case 'edit-os': openOrderForm(+id); break;
    case 'os-move': {
      e.stopPropagation();
      const o = db.orders.find(x => x.id === +id);
      const idx = ORDER_STATUS.findIndex(s => s.id === o.status) + +el.dataset.dir;
      if (ORDER_STATUS[idx]) setOrderStatus(o.id, ORDER_STATUS[idx].id);
      break;
    }
    case 'delete-os':
      confirmModal('Excluir OS', `Deseja excluir a OS #${id}?`, 'Excluir', () => {
        db.orders = db.orders.filter(o => o.id !== +id);
        save(); render(); toast(`OS #${id} excluída`, 'trash');
      });
      break;

    // clientes
    case 'cust-type': ui.cust.type = el.dataset.type; $$('[data-action="cust-type"]').forEach(c => c.classList.toggle('active', c === el)); $('#custGrid').innerHTML = renderCustGrid(); break;
    case 'open-customer': openCustomer(id); break;
    case 'new-customer': openCustomerForm(); break;
    case 'sell-to': ui.pos.customerId = id; closeModal(); go('vender'); toast(`Venda para ${custOf(id).name}`, 'user'); break;

    // financeiro
    case 'pay-expense': {
      const ex = db.expenses.find(x => x.id === id);
      ex.paid = true; save(); render(); toast(`Pagamento registrado: ${brl(ex.amount)}`, 'check');
      break;
    }
    case 'new-expense': openExpenseForm(); break;

    // configurações
    case 'export': {
      const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `pc-papelaria-dados-${dayKey(new Date())}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      toast('Arquivo exportado', 'download');
      break;
    }
    case 'reset':
      confirmModal('Restaurar dados', 'Todas as vendas, produtos e cadastros feitos nesta demonstração serão substituídos pelos dados originais.', 'Restaurar', () => {
        db = seedDatabase(); save(); ui.cart = []; render(); toast('Dados de demonstração restaurados', 'refresh');
      });
      break;
  }
});

function refreshStock() { const el = $('#stockList'); if (el) el.innerHTML = renderStockList(); }

document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'posSearch') { ui.pos.q = t.value; $('#prodGrid').innerHTML = renderProdGrid(); }
  else if (t.id === 'posDiscount') { ui.pos.discount = t.value; updateCartTotals(); }
  else if (t.id === 'posReceived') { ui.pos.received = t.value; updateCartTotals(); }
  else if (t.id === 'stockSearch') { ui.stock.q = t.value; refreshStock(); }
  else if (t.id === 'custSearch') { ui.cust.q = t.value; $('#custGrid').innerHTML = renderCustGrid(); }
});

document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'posCustomer') ui.pos.customerId = t.value;
  else if (t.id === 'stockCat') { ui.stock.cat = t.value; refreshStock(); }
  else if (t.id === 'stockLow') { ui.stock.low = t.checked; refreshStock(); }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeModal(); hidePopover(); setCartOpen(false); }
  // leitor de código de barras: Enter na busca adiciona o produto
  if (e.key === 'Enter' && e.target.id === 'posSearch') {
    e.preventDefault();
    const q = e.target.value.trim().toLowerCase();
    const list = filteredProducts();
    const exact = db.products.find(p => p.sku === q);
    const pick = exact || (list.length === 1 ? list[0] : null);
    if (pick && addToCart(pick.id)) {
      ui.pos.q = ''; e.target.value = '';
      refreshCart();
      toast(`${pick.name} adicionado`, 'barcode');
    }
  }
});

document.addEventListener('submit', e => {
  const f = e.target;
  const kind = f.dataset.form;
  if (!kind) return;
  e.preventDefault();
  const v = Object.fromEntries(new FormData(f));
  const id = f.dataset.id;

  if (kind === 'product') {
    const data = { name: v.name.trim(), cat: v.cat, sku: v.sku.trim(), price: round2(+v.price), cost: round2(+v.cost) };
    if (v.stock !== undefined) { data.stock = Math.max(0, parseInt(v.stock, 10) || 0); data.min = Math.max(0, parseInt(v.min, 10) || 0); }
    if (id) Object.assign(prodOf(id), data);
    else db.products.push({ id: 'n' + Date.now().toString(36), stock: 0, min: 0, ...data });
    toast(id ? 'Produto atualizado' : 'Produto cadastrado', 'box');
  }
  if (kind === 'restock') {
    const p = prodOf(id), q = Math.max(1, parseInt(v.qty, 10) || 0);
    p.stock += q;
    toast(`+${q} un. de ${p.name}`, 'box');
  }
  if (kind === 'os') {
    const data = { customerId: v.customerId || null, type: v.type, desc: v.desc.trim(), qty: Math.max(1, parseInt(v.qty, 10) || 1), price: round2(+v.price), due: new Date(v.due).toISOString(), status: v.status };
    if (id) Object.assign(db.orders.find(o => o.id === +id), data);
    else { db.orders.push({ id: db.nextOrderId++, createdAt: new Date().toISOString(), ...data }); }
    toast(id ? `OS #${id} atualizada` : `OS #${db.nextOrderId - 1} criada`, 'printer');
  }
  if (kind === 'customer') {
    db.customers.push({ id: 'c' + Date.now().toString(36), name: v.name.trim(), type: v.type, phone: v.phone.trim(), email: v.email.trim() });
    toast('Cliente cadastrado', 'user');
  }
  if (kind === 'expense') {
    db.expenses.push({ id: 'e' + Date.now().toString(36), desc: v.desc.trim(), cat: v.cat, amount: round2(+v.amount), due: new Date(v.due + 'T12:00').toISOString(), paid: !!v.paid });
    toast('Despesa lançada', 'wallet');
  }
  save();
  closeModal();
  render();
});

let resizeTimer;
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => ui.redraw.forEach(fn => fn()), 150); });
window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { if (!document.documentElement.dataset.theme) renderNav(); });
window.addEventListener('hashchange', onRoute);

/* ---------- login / inicialização ---------- */
function showLogin() {
  closeModal();
  $('#app').hidden = true;
  $('#login').hidden = false;
  $('#loginCredit').innerHTML = creditHtml();
}
function showApp() {
  $('#login').hidden = true;
  $('#app').hidden = false;
  $$('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); });
  onRoute();
}
$('#loginForm').addEventListener('submit', e => {
  e.preventDefault();
  session(AUTH_KEY, '1');
  showApp();
  setTimeout(() => toast('Bem-vindo! Explore à vontade — os dados são fictícios.', 'sparkles'), 400);
});

// "?entrar" no link abre direto no painel (útil para compartilhar)
if (session(AUTH_KEY) || new URLSearchParams(location.search).has('entrar')) { session(AUTH_KEY, '1'); showApp(); } else showLogin();
