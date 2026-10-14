/* =========================================================
   Dados de demonstração — PC Papelaria Contacto
   Todos os nomes, telefones e valores são fictícios.
   ========================================================= */

const CATEGORIES = [
  { id: 'cadernos',   name: 'Cadernos',         color: '#1957A4', icon: 'notebook' },
  { id: 'escrita',    name: 'Escrita',          color: '#2E3097', icon: 'pen' },
  { id: 'arte',       name: 'Arte',             color: '#D96A0B', icon: 'palette' },
  { id: 'escritorio', name: 'Escritório',       color: '#252668', icon: 'paperclip' },
  { id: 'mochilas',   name: 'Mochilas',         color: '#0B7FB5', icon: 'backpack' },
  { id: 'servicos',   name: 'Serviços',         color: '#B4500A', icon: 'printer' },
];

const PAYMENT_METHODS = [
  { id: 'pix',      name: 'Pix',      icon: 'pix' },
  { id: 'credito',  name: 'Crédito',  icon: 'card' },
  { id: 'debito',   name: 'Débito',   icon: 'card' },
  { id: 'dinheiro', name: 'Dinheiro', icon: 'cash' },
];

const ORDER_STATUS = [
  { id: 'recebido', name: 'Recebido' },
  { id: 'producao', name: 'Em produção' },
  { id: 'pronto',   name: 'Pronto p/ retirada' },
  { id: 'entregue', name: 'Entregue' },
];

const SERVICE_TYPES = ['Impressão', 'Encadernação', 'Plastificação', 'Personalizados', 'Lista escolar', 'Cópias'];

const SCHOOL_LISTS = [
  {
    id: 'infantil',
    name: 'Educação Infantil',
    school: 'Colégio Monteiro Lobato',
    items: [['p17', 1], ['p14', 1], ['p20', 2], ['p21', 1], ['p16', 1], ['p18', 1], ['p19', 1], ['p03', 1]],
  },
  {
    id: 'fund1',
    name: 'Fundamental I (1º ao 5º ano)',
    school: 'E. M. Pequeno Príncipe',
    items: [['p02', 4], ['p09', 6], ['p12', 2], ['p14', 1], ['p15', 1], ['p20', 1], ['p21', 1], ['p28', 1]],
  },
  {
    id: 'fund2',
    name: 'Fundamental II e Médio',
    school: 'Colégio Monteiro Lobato',
    items: [['p01', 1], ['p07', 4], ['p08', 2], ['p10', 1], ['p11', 1], ['p13', 1], ['p12', 1], ['p25', 1]],
  },
];

function seedDatabase() {
  const rng = mulberry32(2003); // "desde 2003"
  const now = new Date();

  const products = [
    // id, nome, categoria, preço, custo, estoque, mínimo
    ['p01', 'Caderno Universitário 10 Matérias', 'cadernos', 32.9, 18.5, 46, 15],
    ['p02', 'Caderno Brochura Capa Dura 96 fls', 'cadernos', 12.9, 6.2, 80, 20],
    ['p03', 'Caderno de Desenho A4 48 fls', 'cadernos', 14.5, 7.1, 22, 10],
    ['p04', 'Caderno Inteligente Argolado', 'cadernos', 89.9, 52, 8, 5],
    ['p05', 'Agenda 2027 Executiva', 'cadernos', 39.9, 21, 6, 8],
    ['p06', 'Bloco Adesivo 76x76 mm', 'cadernos', 7.9, 3.2, 120, 30],
    ['p07', 'Caneta Esferográfica Azul', 'escrita', 2.5, 0.9, 340, 100],
    ['p08', 'Caneta Gel 0.7 Preta', 'escrita', 6.9, 2.8, 95, 30],
    ['p09', 'Lápis Grafite HB', 'escrita', 1.8, 0.55, 210, 80],
    ['p10', 'Lapiseira 0.7 + Grafites', 'escrita', 15.9, 7.4, 18, 10],
    ['p11', 'Marca-texto Pastel (kit 6)', 'escrita', 24.9, 12.3, 4, 10],
    ['p12', 'Borracha Branca Macia', 'escrita', 2.2, 0.7, 150, 50],
    ['p13', 'Corretivo em Fita', 'escrita', 8.9, 3.9, 37, 15],
    ['p14', 'Lápis de Cor 24 Cores', 'arte', 29.9, 15.8, 31, 12],
    ['p15', 'Canetinha Hidrográfica 12 Cores', 'arte', 13.9, 6.5, 27, 12],
    ['p16', 'Tinta Guache 6 Cores', 'arte', 11.5, 5.2, 3, 10],
    ['p17', 'Giz de Cera 12 Cores', 'arte', 7.9, 3.1, 40, 15],
    ['p18', 'Pincel Escolar (kit 3)', 'arte', 9.9, 4, 25, 10],
    ['p19', 'Papel Color Set A4 (50 fls)', 'arte', 12, 5.5, 19, 10],
    ['p20', 'Cola Branca 90 g', 'arte', 4.5, 1.8, 88, 30],
    ['p21', 'Tesoura Escolar sem Ponta', 'arte', 6.9, 2.9, 45, 15],
    ['p22', 'Papel Sulfite A4 (resma 500 fls)', 'escritorio', 34.9, 24, 28, 15],
    ['p23', 'Grampeador 26/6', 'escritorio', 27.9, 13.5, 12, 5],
    ['p24', 'Clips nº 2/0 (caixa 100)', 'escritorio', 5.9, 2.1, 60, 20],
    ['p25', 'Pasta Catálogo 50 Plásticos', 'escritorio', 19.9, 9.8, 14, 8],
    ['p26', 'Envelope Pardo A4', 'escritorio', 1.2, 0.4, 400, 100],
    ['p27', 'Calculadora de Mesa 12 Dígitos', 'escritorio', 45.9, 24, 9, 4],
    ['p28', 'Estojo Duplo com Zíper', 'mochilas', 34.9, 16, 15, 6],
    ['p29', 'Mochila Escolar Reforçada', 'mochilas', 149.9, 78, 7, 4],
    ['p30', 'Lancheira Térmica', 'mochilas', 59.9, 29, 2, 4],
    ['s01', 'Impressão P&B (folha)', 'servicos', 0.5, 0.12, null, 0],
    ['s02', 'Impressão Colorida (folha)', 'servicos', 2, 0.6, null, 0],
    ['s03', 'Cópia / Xerox', 'servicos', 0.4, 0.1, null, 0],
    ['s04', 'Plastificação A4', 'servicos', 5, 1.2, null, 0],
    ['s05', 'Encadernação Espiral', 'servicos', 8, 2.5, null, 0],
  ].map(([id, name, cat, price, cost, stock, min], i) => ({
    id, name, cat, price, cost, stock, min,
    sku: '789' + String(1020304050 + i * 7919).slice(0, 10),
  }));

  const customers = [
    ['c01', 'Colégio Monteiro Lobato', 'escola', '(11) 3456-7012', 'compras@monteirolobato.edu.br'],
    ['c02', 'Andrade & Lima Advocacia', 'empresa', '(11) 3201-4488', 'financeiro@andradelima.adv.br'],
    ['c03', 'Mariana Souza', 'varejo', '(11) 98812-3304', 'mari.souza@email.com'],
    ['c04', 'Carlos Henrique Alves', 'varejo', '(11) 99701-2245', 'carlos.h@email.com'],
    ['c05', 'E. M. Pequeno Príncipe', 'escola', '(11) 3377-9010', 'secretaria@pequenoprincipe.sp.gov.br'],
    ['c06', 'Juliana Pereira', 'varejo', '(11) 97455-1820', 'ju.pereira@email.com'],
    ['c07', 'Clínica Bem Viver', 'empresa', '(11) 3090-6611', 'adm@clinicabemviver.com.br'],
    ['c08', 'Rafael Martins', 'varejo', '(11) 98233-7741', 'rafa.martins@email.com'],
    ['c09', 'Ana Beatriz Costa', 'varejo', '(11) 99610-5582', 'anabia@email.com'],
    ['c10', 'Construtora Horizonte', 'empresa', '(11) 3122-8800', 'suprimentos@horizonte.com.br'],
  ].map(([id, name, type, phone, email]) => ({ id, name, type, phone, email }));

  // ---- vendas dos últimos 30 dias ----
  const sales = [];
  const goods = products.filter(p => p.cat !== 'servicos');
  const services = products.filter(p => p.cat === 'servicos');
  const popular = ['p07', 'p09', 'p02', 'p12', 'p20', 'p06', 'p08', 'p01', 'p22', 'p26'];
  let saleId = 4800;
  for (let d = 29; d >= 0; d--) {
    const day = new Date(now);
    day.setDate(now.getDate() - d);
    if (day.getDay() === 0) continue; // fechado aos domingos
    const growth = 1 + (29 - d) * 0.012;
    let n = Math.round((day.getDay() === 6 ? 9 : 15 + rng() * 9) * growth);
    let maxHour = 18;
    if (d === 0) {
      // dia em andamento: pelo menos a manhã já movimentada, para a demo nunca abrir "vazia"
      maxHour = Math.min(18, Math.max(11, now.getHours()));
      n = Math.max(8, Math.round(n * (maxHour - 8) / 10));
    }
    for (let i = 0; i < n; i++) {
      const items = [];
      const k = 1 + Math.floor(rng() * 3.4);
      for (let j = 0; j < k; j++) {
        let p;
        const r = rng();
        if (r < 0.28) p = services[Math.floor(rng() * services.length)];
        else if (r < 0.65) { const pid = popular[Math.floor(rng() * popular.length)]; p = products.find(x => x.id === pid); }
        else p = goods[Math.floor(rng() * goods.length)];
        if (items.some(it => it.pid === p.id)) continue;
        const qty = p.cat === 'servicos' ? 1 + Math.floor(rng() * (p.price < 1 ? 40 : 6)) : 1 + Math.floor(rng() * rng() * 4);
        items.push({ pid: p.id, name: p.name, qty, price: p.price, cost: p.cost });
      }
      const date = new Date(day);
      date.setHours(8 + Math.floor(rng() * (maxHour - 8)), Math.floor(rng() * 60), 0, 0);
      const subtotal = items.reduce((s, it) => s + it.qty * it.price, 0);
      const discount = rng() < 0.12 ? round2(subtotal * 0.05) : 0;
      const pr = rng();
      const payment = pr < 0.46 ? 'pix' : pr < 0.7 ? 'credito' : pr < 0.86 ? 'debito' : 'dinheiro';
      const customerId = rng() < 0.32 ? customers[Math.floor(rng() * customers.length)].id : null;
      sales.push({ id: ++saleId, date: date.toISOString(), items, subtotal: round2(subtotal), discount, total: round2(subtotal - discount), payment, customerId });
    }
  }
  sales.sort((a, b) => a.date.localeCompare(b.date));

  // ---- ordens de serviço ----
  const rel = (days, h = 10) => { const x = new Date(now); x.setDate(now.getDate() + days); x.setHours(h, 0, 0, 0); return x.toISOString(); };
  const orders = [
    { id: 312, customerId: 'c01', type: 'Impressão', desc: 'Apostilas do 3º bimestre — 120 cópias frente e verso', qty: 120, price: 1.6, status: 'producao', due: rel(1, 17), createdAt: rel(-1) },
    { id: 313, customerId: 'c03', type: 'Encadernação', desc: 'TCC — 3 vias, capa transparente e contracapa preta', qty: 3, price: 12, status: 'pronto', due: rel(0, 16), createdAt: rel(-2) },
    { id: 314, customerId: 'c02', type: 'Cópias', desc: 'Processo digitalizado — impressão de 480 páginas', qty: 480, price: 0.4, status: 'recebido', due: rel(2, 12), createdAt: rel(0, 9) },
    { id: 315, customerId: 'c05', type: 'Lista escolar', desc: 'Separação de 18 kits do Fundamental I', qty: 18, price: 6, status: 'producao', due: rel(3, 18), createdAt: rel(-1) },
    { id: 316, customerId: 'c06', type: 'Personalizados', desc: 'Etiquetas escolares com nome (2 cartelas)', qty: 2, price: 22, status: 'recebido', due: rel(-1, 15), createdAt: rel(-3) },
    { id: 317, customerId: 'c07', type: 'Plastificação', desc: 'Plastificar 25 crachás e 4 placas A4', qty: 29, price: 4, status: 'pronto', due: rel(0, 12), createdAt: rel(-1) },
    { id: 318, customerId: 'c08', type: 'Impressão', desc: 'Currículos coloridos — papel 120 g', qty: 10, price: 2.5, status: 'entregue', due: rel(-2), createdAt: rel(-3) },
    { id: 319, customerId: 'c10', type: 'Impressão', desc: 'Plantas A3 coloridas para obra', qty: 14, price: 9, status: 'entregue', due: rel(-1), createdAt: rel(-4) },
    { id: 320, customerId: 'c09', type: 'Encadernação', desc: 'Receitas da família — capa personalizada', qty: 1, price: 35, status: 'recebido', due: rel(4, 17), createdAt: rel(0, 8) },
  ];

  // ---- contas a pagar ----
  const expenses = [
    { id: 'e1', desc: 'Aluguel da loja', cat: 'Fixas', amount: 3200, due: rel(-4), paid: true },
    { id: 'e2', desc: 'Distribuidora Escolar Sul — NF 8812', cat: 'Fornecedores', amount: 2870.4, due: rel(-2), paid: true },
    { id: 'e3', desc: 'Energia elétrica', cat: 'Fixas', amount: 486.32, due: rel(3), paid: false },
    { id: 'e4', desc: 'Papéis & Cia Atacado — NF 4471', cat: 'Fornecedores', amount: 1940, due: rel(5), paid: false },
    { id: 'e5', desc: 'Folha de pagamento', cat: 'Pessoal', amount: 6800, due: rel(-9), paid: true },
    { id: 'e6', desc: 'Internet fibra 500 MB', cat: 'Fixas', amount: 129.9, due: rel(8), paid: false },
    { id: 'e7', desc: 'Manutenção da impressora laser', cat: 'Serviços', amount: 380, due: rel(-1), paid: false },
    { id: 'e8', desc: 'Toner e cilindro', cat: 'Fornecedores', amount: 1120, due: rel(12), paid: false },
  ];

  return {
    version: 1,
    seedDay: dayKey(now),
    products, customers, sales, orders, expenses,
    nextSaleId: saleId + 1,
    nextOrderId: 321,
  };
}

/* gerador pseudoaleatório determinístico */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function round2(n) { return Math.round(n * 100) / 100; }
function dayKey(d) { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; }
