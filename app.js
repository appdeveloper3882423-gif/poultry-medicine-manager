/* Poultry Medicine Manager — browser-based Firebase business manager.
   Setup: paste your Firebase Web App config into FIREBASE_CONFIG below. */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, sendPasswordResetEmail, updateProfile, signOut, setPersistence, browserLocalPersistence } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, collection, onSnapshot, serverTimestamp, runTransaction, query, orderBy, where } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-functions.js';

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCkyj91iDkxfyFq3ErGucMykxB6h0trplM',
  authDomain: 'poultry-medicine-manager-93b79.firebaseapp.com',
  projectId: 'poultry-medicine-manager-93b79',
  storageBucket: 'poultry-medicine-manager-93b79.firebasestorage.app',
  messagingSenderId: '623127969077',
  appId: '1:623127969077:web:e7e4b8a2e25fc4e249607c'
};

const configReady = FIREBASE_CONFIG.apiKey && !FIREBASE_CONFIG.apiKey.includes('PASTE_') && FIREBASE_CONFIG.projectId && FIREBASE_CONFIG.projectId !== 'YOUR_PROJECT_ID' && FIREBASE_CONFIG.appId && !FIREBASE_CONFIG.appId.includes('PASTE_');
let auth = null, db = null, currentUser = null, tenantUid = null, business = { name: 'Poultry Medicine Manager', type: 'general', currency: 'PKR', timezone: 'Asia/Karachi' };
let unsubs = [], authMode = 'login', activePage = 'dashboard', searchText = '', toastTimer = null, chartRange = 30, inventoryFilter = 'all';
const rangeLabels = {7:'1W',30:'1M',90:'3M',180:'6M',365:'1Y'};
const data = { products: [], sales: [], purchases: [], customers: [], suppliers: [], expenses: [], deliveries: [], returns: [], ledger: [], batches: [], stockMovements: [], auditLogs: [] };
const pageNames = { dashboard: 'Dashboard', inventory: 'Medicine Stock', sales: 'Sales & POS', purchases: 'Purchases', ledger: 'Ledger', customers: 'Customers & Khata', suppliers: 'Suppliers', expenses: 'Expenses', deliveries: 'Deliveries', returns: 'Returns', reports: 'Reports', settings: 'Settings' };
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const num = value => Number(value || 0);
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const money = value => { try { return new Intl.NumberFormat('en-PK',{style:'currency',currency:business.currency || 'PKR',maximumFractionDigits:2}).format(num(value)); } catch { return `${business.currency || 'PKR'} ${num(value).toFixed(2)}`; } };
const uid = () => tenantUid || currentUser?.uid;
const storedCollection = name => name === 'products' ? 'inventory' : name;
const col = name => collection(db, 'users', uid(), storedCollection(name));
const docRef = (name, id) => doc(db, 'users', uid(), storedCollection(name), id);
const sum = (items, field) => items.reduce((n, x) => n + num(x[field]), 0);
const dateOf = x => { if (x?.date) return String(x.date).slice(0,10); const c=x?.createdAt; if (typeof c==='string') return c.slice(0,10); if (c?.toDate) return c.toDate().toISOString().slice(0,10); if (c?.seconds) return new Date(c.seconds*1000).toISOString().slice(0,10); return ''; };
const invoiceNo = () => `PMM-${Date.now().toString().slice(-8)}-${Math.random().toString(36).slice(2,5).toUpperCase()}`;
const batchCol = () => col('batches');
const movementCol = () => col('stockMovements');
async function writeMovement(transaction, payload) {
  const ref = doc(movementCol());
  transaction.set(ref, { ...payload, branchId:payload.branchId||pmActiveBranch||'main', createdAt: serverTimestamp(), createdBy: uid() });
}
async function writeAudit(action, entity, entityId, details = {}) {
  try { await add('auditLogs', { action, entity, entityId, details, branchId:pmActiveBranch||'main', actorUid: uid(), actorEmail: currentUser?.email || '' }); }
  catch (e) { console.warn('Audit log could not be written:', e); }
}
const safeDate = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : '9999-12-31';


function toast(message, bad = false) {
  const el = $('toast'); el.textContent = message; el.style.background = bad ? '#a72e3d' : '#142540'; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}
function setAuthError(message = '') { $('authError').textContent = message; }
function setAuthBusy(busy) { $('authSubmit').disabled = busy; $('googleBtn').disabled = busy; $('authSubmit').textContent = busy ? (authMode === 'login' ? 'Logging in…' : 'Creating…') : (authMode === 'login' ? 'Sign in' : 'Create account'); }
function showAuth() { $('authView').classList.remove('hidden'); $('appView').classList.add('hidden'); }
function showApp() { $('authView').classList.add('hidden'); $('appView').classList.remove('hidden'); }
function authModeSet(mode) {
  authMode = mode; const signup = mode === 'signup'; $('signupFields').classList.toggle('hidden', !signup);
  $('authEyebrow').textContent = signup ? 'START YOUR BUSINESS WORKSPACE' : 'YOUR WORKSPACE AWAITS';
  $('authTitle').textContent = signup ? 'Create your workspace' : 'Welcome back';
  $('authSubtitle').textContent = signup ? 'Create a free account to get started.' : 'Sign in to continue to your business.';
  $('authSubmit').textContent = signup ? 'Create account' : 'Sign in'; $('forgotBtn').classList.toggle('hidden', signup);
  $('switchText').textContent = signup ? 'Already have an account?' : 'New to Poultry Medicine Manager?'; $('switchMode').textContent = signup ? 'Sign in' : 'Create account'; $('password').autocomplete = signup ? 'new-password' : 'current-password'; setAuthError('');
}
function requireConfig() { if (!configReady || !auth || !db) throw new Error('Firebase config missing. Open app.js and replace the six FIREBASE_CONFIG values with your Firebase Web App config.'); }

async function ensureBusiness(user, proposed = {}) {
  requireConfig(); const ref = doc(db, 'users', user.uid); const snap = await getDoc(ref);
  if (!snap.exists()) {
    const profile = { name: proposed.name || (user.displayName ? `${user.displayName}'s Business` : 'Poultry Medicine Manager'), type: proposed.type || 'general', currency: 'PKR', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Karachi', ownerUid: user.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    await setDoc(ref, profile);
  }
}
async function loadBusiness() {
  const snap = await getDoc(doc(db, 'users', uid()));
  if (snap.exists()) business = { ...business, ...snap.data() };
  updateBusinessChrome();
}
function updateBusinessChrome() {
  $('sideBusinessName').textContent = business.name || 'Poultry Medicine Manager';
  $('sideBusinessType').textContent = ({ general:'Retail business', medical:'Medical store', wholesale:'Wholesale business' })[business.type] || 'Business workspace';
}
function stopWatchers() { unsubs.forEach(fn => fn()); unsubs = []; }
function normalizeLegacyRecord(name, raw, id) {
  const x = { id, ...raw };
  if (name === 'products') {
    x.name = x.name || x.medicineName || x.productName || '';
    x.stock = x.stock ?? x.quantity ?? x.currentStock ?? 0;
    x.costPrice = x.costPrice ?? x.purchasePrice ?? x.buyPrice ?? 0;
    x.salePrice = x.salePrice ?? x.defaultSalePrice ?? x.sellingPrice ?? 0;
    x.medicineType = x.medicineType || x.typeOfMedicine || x.category || 'Other';
    x.unit = x.unit || x.stockUnit || 'piece';
    x.reorderLevel = x.reorderLevel ?? x.lowStockThreshold ?? 5;
    x.expiryDate = x.expiryDate || x.expiry || '';
    x.batch = x.batch || x.batchNo || x.batchNumber || '';
  }
  if (name === 'sales') {
    x.invoiceNo = x.invoiceNo || x.deliveryNumber || x.saleNumber || `SALE-${id.slice(0,6)}`;
    x.date = x.date || x.saleDate || x.createdAt || '';
    x.total = x.total ?? x.totalSale ?? x.totalAmount ?? x.grossAmount ?? 0;
    x.paid = x.paid ?? (String(x.paymentStatus || '').toLowerCase() === 'paid' ? x.total : 0);
    if (!Array.isArray(x.items)) x.items = [{ productId:x.inventoryId || '', name:x.medicineName || x.productName || x.itemName || 'Medicine', quantity:num(x.quantity), unitPrice:num(x.unitSalePrice ?? x.salePrice), costPrice:num(x.unitCost ?? x.purchasePrice) }];
    x.profit = x.profit ?? x.profitAmount ?? x.totalProfit ?? 0;
    x.customerPhone = x.customerPhone || x.customerContact || x.phone || '';
  }
  return x;
}
function startWatchers() {
  stopWatchers(); const names = Object.keys(data);
  names.forEach(name => {
    let q = col(name);
    if (currentUser?.uid !== uid() && Array.isArray(pmAllowedBranches) && pmAllowedBranches.length) q = query(q, where('branchId','in',pmAllowedBranches));
    const unsub = onSnapshot(q, snap => {
      data[name] = snap.docs.map(d => normalizeLegacyRecord(name, d.data(), d.id));
      if($('syncStatus')) $('syncStatus').textContent='Live sync · '+new Date().toLocaleTimeString();
      if(name==='products') updateAlertChrome();
      if (activePage) renderCurrent();
    }, err => { console.error(`Firestore ${name} listener:`, err); toast(`Could not sync ${name}. Check Firestore rules.`, true); });
    unsubs.push(unsub);
  });
}
async function add(name, payload) {
  requireConfig();
  return addDoc(col(name), { ...payload, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
}
async function update(name, id, payload) {
  return updateDoc(docRef(name,id), { ...payload, updatedAt: serverTimestamp() });
}
async function remove(name,id) {
  return deleteDoc(docRef(name,id));
}

function updateAlertChrome() {
  const low = data.products.filter(p => num(p.stock) <= num(p.reorderLevel));
  const expiredOrSoon = data.products.filter(p => p.expiryDate && (new Date(`${p.expiryDate}T23:59:59`).getTime() - Date.now()) <= 30*86400000);
  $('lowStockBadge').textContent = low.length;
  $('lowStockBadge').classList.toggle('hidden', !low.length);
  $('alertDot').classList.toggle('hidden', !(low.length || expiredOrSoon.length));
  const alerts = [];
  low.slice(0,5).forEach(p => alerts.push(`<div class="alert-row"><span class="alert-symbol red">!</span><div><b>${esc(p.name)} — low stock</b><small>${num(p.stock)} ${esc(p.unit || 'units')} left; alert at ${num(p.reorderLevel)}.</small></div></div>`));
  expiredOrSoon.slice(0,5).forEach(p => {
    const days = Math.ceil((new Date(`${p.expiryDate}T23:59:59`).getTime()-Date.now())/86400000);
    alerts.push(`<div class="alert-row"><span class="alert-symbol ${days < 0 ? 'red' : ''}">⌛</span><div><b>${esc(p.name)} — ${days < 0 ? 'expiry date passed' : 'expiry approaching'}</b><small>Expiry date: ${esc(p.expiryDate)}${days >= 0 ? ` (${days} days)` : ''}.</small></div></div>`);
  });
  $('alertStrip').innerHTML = alerts.length ? `<div class="notice warning">Stock and expiry alerts are based on the dates and quantities entered in your workspace.</div>` : '';
  $('alertStrip').classList.toggle('hidden', !alerts.length);
}
function navigate(page) {
  activePage = page;
  document.querySelectorAll('.nav-link[data-page]').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  $('pageTitle').textContent = pageNames[page] || 'Dashboard';
  $('breadcrumbTitle').textContent = pageNames[page] || 'Dashboard';
  $('sidebar').classList.remove('open');
  $('scrim').classList.add('hidden');
  renderCurrent();
}
function pageHead(title, desc, actions = '') {
  return `<div class="page-heading"><div><h2>${title}</h2><p>${desc}</p></div><div class="heading-actions">${actions}</div></div>`;
}
function button(label, action, cls = 'btn btn-primary', icon = '+') {
  return `<button class="${cls}" data-action="${action}"><span>${icon}</span>${label}</button>`;
}
function metric(label, value, foot, icon, tone = '', action = '') {
  return `<article class="metric-card ${action?'metric-clickable':''}" ${action?`role="button" tabindex="0" data-alert-filter="${action}" title="Click to view records"`:''}><div class="metric-top"><span class="metric-icon ${tone}">${icon}</span><span class="metric-trend">${action?'View details →':'Live totals'}</span></div><span class="metric-label">${label}</span><strong class="metric-value">${value}</strong><small class="metric-foot">${foot}</small></article>`;
}
function table(headers, rows, empty = 'No records yet.') {
  if (!rows.length) return `<div class="empty-state"><strong>Nothing here yet</strong>${esc(empty)}</div>`;
  return `<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
}
function tr(cells) {
  return `<tr>${cells.map(c=>`<td>${c ?? '—'}</td>`).join('')}</tr>`;
}
function productName(id) {
  return data.products.find(p=>p.id===id)?.name || 'Deleted product';
}
function filterItems(items, fields) {
  const s=searchText.trim().toLowerCase();
  return !s ? items : items.filter(item => fields.some(f => String(item[f] ?? '').toLowerCase().includes(s)));
}
function currentSales() {
  return data.sales.filter(s => dateOf(s) === today());
}
function netProfit() {
  return sum(data.sales,'profit') - sum(data.expenses,'amount') - sum(data.returns,'profitLoss');
}
function salesThisMonth() {
  const month = today().slice(0,7);
  return data.sales.filter(s => dateOf(s).startsWith(month));
}
function chartSeries(days = chartRange) {
  const now = new Date();
  now.setHours(0,0,0,0);
  const rows = [];
  for (let i=days-1;i>=0;i--) {
    const d = new Date(now);
    d.setDate(now.getDate()-i);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const value = data.sales.filter(s=>dateOf(s)===key).reduce((n,s)=>n+num(s.total),0);
    rows.push({key, label:d.toLocaleDateString('en',{month:'short',day:'numeric'}), value});
  }
  return rows;
}
function tradingChart() {
  const rows = chartSeries();
  const W=820,H=270,L=18,R=18,T=18,B=34, iw=W-L-R, ih=H-T-B;
  const max=Math.max(1,...rows.map(r=>r.value));
  const x=i=>L+(rows.length<2?iw/2:i/(rows.length-1)*iw);
  const y=v=>T+ih-(v/max)*ih;
  const points=rows.map((r,i)=>`${x(i).toFixed(1)},${y(r.value).toFixed(1)}`);
  const line=points.length?`M ${points.join(' L ')}`:'';
  const area=points.length?`${line} L ${x(rows.length-1).toFixed(1)},${(T+ih).toFixed(1)} L ${x(0).toFixed(1)},${(T+ih).toFixed(1)} Z`:'';
  const grid=[0,1,2,3].map(i=>{
    const yy=T+ih*i/3;
    return `<line x1="${L}" y1="${yy}" x2="${W-R}" y2="${yy}" stroke="#24334b" stroke-dasharray="4 7"/><text x="${L+2}" y="${yy-5}" fill="#70829f" font-size="10">${esc(money(max*(1-i/3)))}</text>`;
  }).join('');
  const dots=rows.map((r,i)=>`<circle class="trade-point" cx="${x(i).toFixed(1)}" cy="${y(r.value).toFixed(1)}" r="${rows.length<=31?3.2:1.8}" fill="#5aa8ff"><title>${esc(r.label)} · ${esc(money(r.value))}</title></circle>`).join('');
  const labelIndices=[0,Math.floor((rows.length-1)/3),Math.floor((rows.length-1)*2/3),rows.length-1].filter((v,i,a)=>a.indexOf(v)===i);
  const labels=labelIndices.map(i=>`<text x="${x(i)}" y="${H-9}" fill="#8292ad" font-size="10" text-anchor="${i===0?'start':i===rows.length-1?'end':'middle'}">${esc(rows[i].label)}</text>`).join('');
  const total=rows.reduce((n,r)=>n+r.value,0);
  const previous=data.sales.filter(s=>{
    const d=dateOf(s);
    if(!d)return false;
    const dt=new Date(`${d}T00:00:00`);
    const now=new Date();
    now.setHours(0,0,0,0);
    return dt>=new Date(now.getTime()-(chartRange*2)*86400000)&&dt<new Date(now.getTime()-chartRange*86400000);
  }).reduce((n,s)=>n+num(s.total),0);
  const change=previous?((total-previous)/previous*100):null;
  const activeCount=rows.filter(r=>r.value>0).length;
  return `<section class="trade-panel"><div class="trade-head"><div><div class="trade-kicker"><i></i> BUSINESS MARKET VIEW</div><h3>Sales performance</h3><p>Actual recorded revenue · ${chartRange===7?'last 7 days':chartRange===30?'last 30 days':chartRange===90?'last 90 days':chartRange===180?'last 6 months':'last 12 months'}</p></div><div class="trade-total"><small>PERIOD REVENUE</small><strong>${esc(money(total))}</strong><span class="${change===null?'trade-neutral':change>=0?'trade-up':'trade-down'}">${change===null?'No comparison yet':`${change>=0?'↑':'↓'} ${Math.abs(change).toFixed(1)}% vs previous period`}</span></div></div><div class="trade-controls">${Object.entries(rangeLabels).map(([d,label])=>`<button class="trade-range ${chartRange===Number(d)?'active':''}" data-chart-range="${d}">${label}</button>`).join('')}<span class="trade-legend"><i></i> Sales revenue</span></div><div class="trade-svg-wrap"><svg class="trade-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Recorded sales revenue line chart" preserveAspectRatio="none"><defs><linearGradient id="tradeFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#278bff" stop-opacity=".28"/><stop offset="100%" stop-color="#278bff" stop-opacity="0"/></linearGradient><filter id="tradeGlow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>${grid}<path d="${area}" fill="url(#tradeFill)"/><path d="${line}" fill="none" stroke="#278bff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" filter="url(#tradeGlow)"/>${dots}${labels}</svg>${activeCount===0?'<div class="trade-empty">No sales recorded in this period yet. Add a sale to start building your live chart.</div>':''}</div><div class="trade-foot"><span><i class="trade-live-dot"></i> Synced to your workspace</span><span>${activeCount} days with sales</span><span>Currency: ${esc(business.currency||'PKR')}</span></div></section>`;
}
function renderDashboard() {
  const low = data.products.filter(p=>num(p.stock)<=num(p.reorderLevel));
  const expiryDays = p => p.expiryDate ? Math.ceil((new Date(`${p.expiryDate}T23:59:59`).getTime()-Date.now())/86400000) : null;
  const expired = data.products.filter(p=>expiryDays(p)!==null && expiryDays(p)<0);
  const soon = data.products.filter(p=>expiryDays(p)!==null && expiryDays(p)>=0 && expiryDays(p)<=30);
  const alerts = [...low.slice(0,4).map(p=>`<button class="alert-row alert-clickable" data-alert-filter="low"><span class="alert-symbol red">!</span><div><b>${esc(p.name)}</b><small>Low stock: ${num(p.stock)} ${esc(p.unit||'units')} remaining.</small></div></button>`),...expired.slice(0,4).map(p=>`<button class="alert-row alert-clickable" data-alert-filter="expired"><span class="alert-symbol red">⌛</span><div><b>${esc(p.name)} — expired</b><small>Expiry: ${esc(p.expiryDate)}.</small></div></button>`),...soon.slice(0,4).map(p=>`<button class="alert-row alert-clickable" data-alert-filter="soon"><span class="alert-symbol">⌛</span><div><b>${esc(p.name)} — expiry soon</b><small>Expiry: ${esc(p.expiryDate)} (${expiryDays(p)} days).</small></div></button>`)];
  const recent = [...data.sales].slice(0,6).map(s=>tr([`<span class="td-strong">${esc(s.invoiceNo||'Sale')}</span>`,esc(s.customerName||'Walk-in'),esc(dateOf(s)),money(s.total),`<span class="pill ${num(s.paid)>=num(s.total)?'green':'orange'}">${num(s.paid)>=num(s.total)?'Paid':'Due'}</span>`]));
  return `${pageHead(`Good ${new Date().getHours()<12?'morning':new Date().getHours()<18?'afternoon':'evening'}, ${esc((currentUser?.displayName||'there').split(' ')[0])}`, 'Here is the latest overview of your business.', button('New sale','new-sale','btn btn-primary','＋'))}
    <div class="metric-grid">${metric('Sales today',money(currentSales().reduce((n,s)=>n+num(s.total),0)),`${currentSales().length} invoices today`,'↗')}${metric('Sales this month',money(salesThisMonth().reduce((n,s)=>n+num(s.total),0)),`${salesThisMonth().length} invoices this month`,'▣','blue')}${metric('Estimated net profit',money(netProfit()),'Sales margin − expenses − returns','◈','purple')}${metric('Stock items',data.products.length,`${low.length} low-stock alerts`,'▤','orange')} ${metric('Expired medicines',expired.length,'Expiry date has passed','⌛','red','expired')} ${metric('Expiry soon',soon.length,'Expiring within 30 days','⌛','orange','soon')} ${metric('Low stock',low.length,'At or below reorder level','!','orange','low')}</div>
    <div class="dashboard-grid"><div>${tradingChart()}</div><section class="panel"><div class="panel-head"><div><h3>Quick actions</h3><p>Common tasks in one tap</p></div></div><div class="quick-grid"><button class="quick-action" data-action="new-product"><span>＋</span><b>Add stock</b><small>Add medicine to inventory</small></button><button class="quick-action" data-action="new-sale"><span>▣</span><b>Record sale</b><small>Create invoice</small></button><button class="quick-action" data-action="new-purchase"><span>⇩</span><b>Receive stock</b><small>Record purchase</small></button><button class="quick-action" data-action="new-expense"><span>↗</span><b>Add expense</b><small>Track spending</small></button></div></section></div>
    <div class="dashboard-grid section-gap"><section class="panel table-panel"><div class="panel-head"><div><h3>Recent sales</h3><p>Latest recorded invoices</p></div><button class="btn btn-light" data-page-link="sales">View all →</button></div>${table(['Invoice','Customer','Date','Total','Payment'],recent,'Your latest sales will appear here.')}</section><section class="panel"><div class="panel-head"><div><h3>Attention needed</h3><p>Stock and expiry checks</p></div><span class="pill ${alerts.length?'orange':'green'}">${alerts.length} alerts</span></div><div class="alert-list">${alerts.length?alerts.join(''):'<div class="empty-state"><strong>All clear</strong>No low-stock or upcoming expiry alerts.</div>'}</div></section></div>`;
}
function renderInventory() {
  let items = filterItems(data.products,['name','sku','medicineType','category','batch']);
  const daysToExpiry = p => p.expiryDate ? Math.ceil((new Date(`${p.expiryDate}T23:59:59`).getTime()-Date.now())/86400000) : null;
  if(inventoryFilter==='low') items=items.filter(p=>num(p.stock)<=num(p.reorderLevel));
  if(inventoryFilter==='expired') items=items.filter(p=>daysToExpiry(p)!==null&&daysToExpiry(p)<0);
  if(inventoryFilter==='soon') items=items.filter(p=>daysToExpiry(p)!==null&&daysToExpiry(p)>=0&&daysToExpiry(p)<=30);
  if(inventoryFilter==='all-alerts') items=items.filter(p=>num(p.stock)<=num(p.reorderLevel)||(daysToExpiry(p)!==null&&daysToExpiry(p)<=30));
  const rows = items.map(p=>tr([`<span class="td-strong">${esc(p.name)}</span><br><span class="muted-text">${esc(p.sku||'No SKU')}</span>`,esc(p.medicineType||p.category||'Other'),money(p.costPrice),money(p.salePrice),`${num(p.stock)} ${esc(p.unit||'units')}`,num(p.stock)<=num(p.reorderLevel)?'<span class="pill red">Low stock</span>':'<span class="pill green">In stock</span>',esc(p.expiryDate||'—'),`<div class="row-actions"><button class="mini-btn" data-action="edit" data-type="product" data-id="${p.id}">Edit</button><button class="mini-btn text-danger" data-action="delete" data-type="product" data-id="${p.id}">Delete</button></div>`]));
  return `${pageHead('Medicine Stock','Add medicines, purchase/sale prices, quantity, batch numbers and expiry dates.',button('Add stock','new-product','btn btn-primary','＋'))}<div class="metric-grid">${metric('Products',data.products.length,'All catalog items','▤')}${metric('Stock value',money(data.products.reduce((n,p)=>n+num(p.stock)*num(p.costPrice),0)),'Quantity × purchase cost','◈','blue')}${metric('Low stock',data.products.filter(p=>num(p.stock)<=num(p.reorderLevel)).length,'Below or at reorder level','!','orange')}${metric('Expiry alerts',data.products.filter(p=>p.expiryDate && (new Date(`${p.expiryDate}T23:59:59`).getTime()-Date.now())<=30*86400000).length,'Expired or within 30 days','⌛','red')}</div><section class="panel table-panel"><div class="panel-head"><div><h3>Product catalogue${inventoryFilter!=='all'?` · ${({low:'Low stock',expired:'Expired medicines',soon:'Expiry soon','all-alerts':'Stock & expiry alerts'})[inventoryFilter]||''}`:''}</h3><p>${items.length} matching products</p></div><div class="table-tools"><button class="btn btn-light" data-alert-filter="all">Show all</button><input data-search placeholder="Filter products…" value="${esc(searchText)}"><button class="btn btn-light" data-action="export-products">Export CSV</button></div></div>${table(['Product name / SKU','Medicine type','Buy price','Sale price','Stock','Status','Expiry','Actions'],rows,'Add your first medicine to start tracking stock.')}</section>`;
}
function renderSales() {
  const items = filterItems(data.sales,['invoiceNo','customerName','customerPhone','paymentMethod']);
  const rows = items.map(s => tr([
    `<span class="td-strong">${esc(s.invoiceNo||'Sale')}</span>`,
    esc(s.customerName||'Walk-in customer'),
    esc(dateOf(s)),
    money(s.total),
    money(s.paid),
    money(Math.max(0,num(s.total)-num(s.paid))),
    `<span class="pill ${num(s.paid)>=num(s.total)?'green':'orange'}">${num(s.paid)>=num(s.total)?'Paid':'Due'}</span>`,
    `<div class="row-actions"><button class="mini-btn" data-action="view-sale" data-id="${s.id}">View</button><button class="mini-btn" data-action="print-sale" data-id="${s.id}">Print</button></div>`
  ]));
  const total = items.reduce((n,s)=>n+num(s.total),0);
  const paid = items.reduce((n,s)=>n+num(s.paid),0);
  return `${pageHead('Sales & POS','Record medicine sales, customer payments and invoices.',button('New sale','new-sale','btn btn-primary','＋'))}
    <div class="metric-grid">
      ${metric('Invoices',items.length,'Matching records','▣')}
      ${metric('Sales value',money(total),'Total invoice value','↗','blue')}
      ${metric('Payments received',money(paid),'Amount collected','✓','green')}
      ${metric('Outstanding',money(Math.max(0,total-paid)),'Customer balances due','◷','orange')}
    </div>
    <section class="panel table-panel">
      <div class="panel-head"><div><h3>Sales history</h3><p>Recorded invoices and payment status</p></div>
      <div class="table-tools"><input data-search placeholder="Search invoices or customers…" value="${esc(searchText)}"><button class="btn btn-light" data-action="export-sales">Export CSV</button></div></div>
      ${table(['Invoice','Customer','Date','Total','Paid','Balance','Status','Actions'],rows,'No sales have been recorded yet.')}
    </section>`;
}
function renderPurchases() {
  const items = filterItems(data.purchases,['invoiceNo','supplierName','reference','notes']);
  const rows = items.map(p => tr([
    `<span class="td-strong">${esc(p.invoiceNo||p.reference||'Purchase')}</span>`,
    esc(p.supplierName||'—'),esc(dateOf(p)),money(p.total||p.amount),
    `<span class="pill">${esc(p.status||'Received')}</span>`,
    `<div class="row-actions"><button class="mini-btn" data-action="view-purchase" data-id="${p.id}">View</button><button class="mini-btn" data-action="edit" data-type="purchase" data-id="${p.id}">Edit</button></div>`
  ]));
  return `${pageHead('Purchases','Record supplier purchases and incoming medicine stock.',button('Record purchase','new-purchase','btn btn-primary','＋'))}
    <div class="metric-grid">${metric('Purchase records',items.length,'Matching records','⇩')}${metric('Purchase value',money(items.reduce((n,p)=>n+num(p.total||p.amount),0)),'Recorded purchase value','◈','blue')}${metric('Suppliers',data.suppliers.length,'Saved suppliers','♙')}</div>
    <section class="panel table-panel"><div class="panel-head"><div><h3>Purchase history</h3><p>Supplier invoices and received stock</p></div><div class="table-tools"><input data-search placeholder="Search purchases…" value="${esc(searchText)}"><button class="btn btn-light" data-action="export-purchases">Export CSV</button></div></div>
    ${table(['Reference','Supplier','Date','Total','Status','Actions'],rows,'No purchases recorded yet.')}</section>`;
}
function renderCustomers() {
  const items = filterItems(data.customers,['name','phone','email','address']);
  const rows = items.map(c => {
    const sales = data.sales.filter(s=>s.customerId===c.id || (s.customerName||'').toLowerCase()===(c.name||'').toLowerCase());
    const billed = sales.reduce((n,s)=>n+num(s.total),0);
    const paid = sales.reduce((n,s)=>n+num(s.paid),0);
    return tr([
      `<span class="td-strong">${esc(c.name||'Customer')}</span>`,
      esc(c.phone||'—'),esc(c.email||'—'),money(billed),money(Math.max(0,billed-paid)),
      `<div class="row-actions"><button class="mini-btn" data-action="view-customer" data-id="${c.id}">Ledger</button><button class="mini-btn" data-action="edit" data-type="customer" data-id="${c.id}">Edit</button></div>`
    ]);
  });
  return `${pageHead('Customers & Khata','Customer profiles, purchase history and outstanding balances.',button('Add customer','new-customer','btn btn-primary','＋'))}
    <div class="metric-grid">${metric('Customers',data.customers.length,'Saved customer profiles','♙')}${metric('Total receivable',money(data.sales.reduce((n,s)=>n+Math.max(0,num(s.total)-num(s.paid)),0)),'Outstanding invoice balances','◷','orange')}</div>
    <section class="panel table-panel"><div class="panel-head"><div><h3>Customer directory</h3><p>Customer contact details and balances</p></div><input data-search placeholder="Search customers…" value="${esc(searchText)}"></div>
    ${table(['Customer','Phone','Email','Total billed','Balance due','Actions'],rows,'Add a customer to maintain their purchase history.')}</section>`;
}
function renderSuppliers() {
  const items = filterItems(data.suppliers,['name','phone','email','address','company']);
  const rows = items.map(s => {
    const purchases = data.purchases.filter(p=>p.supplierId===s.id || (p.supplierName||'').toLowerCase()===(s.name||'').toLowerCase());
    return tr([
      `<span class="td-strong">${esc(s.name||s.company||'Supplier')}</span>`,
      esc(s.phone||'—'),esc(s.email||'—'),purchases.length,
      money(purchases.reduce((n,p)=>n+num(p.total||p.amount),0)),
      `<div class="row-actions"><button class="mini-btn" data-action="view-supplier" data-id="${s.id}">History</button><button class="mini-btn" data-action="edit" data-type="supplier" data-id="${s.id}">Edit</button></div>`
    ]);
  });
  return `${pageHead('Suppliers','Manage medicine suppliers and purchase history.',button('Add supplier','new-supplier','btn btn-primary','＋'))}
    <div class="metric-grid">${metric('Suppliers',data.suppliers.length,'Saved suppliers','♙')}${metric('Purchases',data.purchases.length,'Linked purchase records','⇩')}</div>
    <section class="panel table-panel"><div class="panel-head"><div><h3>Supplier directory</h3><p>Contact information and purchase totals</p></div><input data-search placeholder="Search suppliers…" value="${esc(searchText)}"></div>
    ${table(['Supplier','Phone','Email','Orders','Purchase total','Actions'],rows,'Add your first supplier.')}</section>`;
}
function renderExpenses() {
  const items = filterItems(data.expenses,['title','category','description','paymentMethod']);
  const rows = items.map(e => tr([
    `<span class="td-strong">${esc(e.title||e.category||'Expense')}</span>`,
    esc(e.category||'Other'),esc(dateOf(e)),esc(e.paymentMethod||'—'),money(e.amount),
    `<div class="row-actions"><button class="mini-btn" data-action="edit" data-type="expense" data-id="${e.id}">Edit</button><button class="mini-btn text-danger" data-action="delete" data-type="expense" data-id="${e.id}">Delete</button></div>`
  ]));
  return `${pageHead('Expenses','Record business operating costs and other expenses.',button('Add expense','new-expense','btn btn-primary','＋'))}
    <div class="metric-grid">${metric('Expense records',items.length,'Matching records','▤')}${metric('Total expenses',money(items.reduce((n,e)=>n+num(e.amount),0)),'Recorded expense value','↗','orange')}</div>
    <section class="panel table-panel"><div class="panel-head"><div><h3>Expense history</h3><p>Business spending records</p></div><input data-search placeholder="Search expenses…" value="${esc(searchText)}"></div>
    ${table(['Expense','Category','Date','Payment method','Amount','Actions'],rows,'No expenses recorded yet.')}</section>`;
}
function renderLedger() {
  const rows = filterItems(data.ledger,['title','description','type','account','reference']).map(l=>tr([
    `<span class="td-strong">${esc(l.title||l.description||'Entry')}</span>`,
    esc(l.type||'—'),esc(l.account||l.paymentMethod||'—'),esc(dateOf(l)),
    money(l.debit),money(l.credit),esc(l.reference||'—')
  ]));
  const debit = sum(data.ledger,'debit'), credit = sum(data.ledger,'credit');
  return `${pageHead('Business Ledger','Recorded financial entries and transaction references.')}
    <div class="metric-grid">${metric('Ledger entries',data.ledger.length,'Recorded entries','▤')}${metric('Debit total',money(debit),'Recorded debits','↗','blue')}${metric('Credit total',money(credit),'Recorded credits','⇩','green')}</div>
    <section class="panel table-panel"><div class="panel-head"><div><h3>Ledger entries</h3><p>Review recorded financial activity</p></div><input data-search placeholder="Search ledger…" value="${esc(searchText)}"></div>
    ${table(['Description','Type','Account','Date','Debit','Credit','Reference'],rows,'Ledger entries will appear as transactions are recorded.')}</section>`;
}
function renderDeliveries() {
  const items = filterItems(data.deliveries,['deliveryNo','customerName','staffName','status','address','phone']);
  const rows = items.map(d=>tr([
    `<span class="td-strong">${esc(d.deliveryNo||d.reference||'Delivery')}</span>`,
    esc(d.customerName||'—'),esc(d.staffName||d.deliveryPerson||'—'),
    esc(dateOf(d)),esc(d.status||'Pending'),
    `<div class="row-actions"><button class="mini-btn" data-action="edit" data-type="delivery" data-id="${d.id}">Update</button><button class="mini-btn" data-action="delete" data-type="delivery" data-id="${d.id}">Delete</button></div>`
  ]));
  const pending=data.deliveries.filter(d=>!['delivered','complete','completed'].includes(String(d.status||'pending').toLowerCase())).length;
  return `${pageHead('Deliveries','Track customer orders, dispatch status and delivery staff.',button('New delivery','new-delivery','btn btn-primary','＋'))}
    <div class="metric-grid">${metric('Delivery records',data.deliveries.length,'All dispatch records','▣')}${metric('Pending deliveries',pending,'Not marked completed','◷','orange')}${metric('Completed',data.deliveries.length-pending,'Marked delivered','✓','green')}</div>
    <section class="panel table-panel"><div class="panel-head"><div><h3>Delivery register</h3><p>Dispatch and delivery tracking</p></div><input data-search placeholder="Search deliveries…" value="${esc(searchText)}"></div>
    ${table(['Delivery ref.','Customer','Delivery staff','Date','Status','Actions'],rows,'No deliveries have been entered.')}</section>`;
}
function renderReturns() {
  const items=filterItems(data.returns,['reference','invoiceNo','customerName','reason','status']);
  const rows=items.map(r=>tr([
    `<span class="td-strong">${esc(r.reference||r.invoiceNo||'Return')}</span>`,
    esc(r.customerName||'—'),esc(dateOf(r)),esc(r.reason||'—'),
    money(r.amount||r.total||0),esc(r.status||'Recorded'),
    `<div class="row-actions"><button class="mini-btn" data-action="view-return" data-id="${r.id}">View</button><button class="mini-btn" data-action="edit" data-type="return" data-id="${r.id}">Edit</button></div>`
  ]));
  return `${pageHead('Returns & Refunds','Review returned goods, customer refunds and return reasons.',button('Record return','new-return','btn btn-primary','＋'))}
    <div class="metric-grid">${metric('Return records',items.length,'Matching records','↩')}${metric('Return value',money(items.reduce((n,r)=>n+num(r.amount||r.total),0)),'Recorded value of returns','↗','orange')}</div>
    <section class="panel table-panel"><div class="panel-head"><div><h3>Return history</h3><p>Recorded customer returns</p></div><input data-search placeholder="Search returns…" value="${esc(searchText)}"></div>
    ${table(['Reference','Customer','Date','Reason','Value','Status','Actions'],rows,'No returns recorded yet.')}</section>`;
}
function renderReports() {
  const sales=data.sales;
  const purchases=data.purchases;
  const expenses=data.expenses;
  const revenue=sum(sales,'total');
  const cost=sales.reduce((n,s)=>n+num(s.costTotal ?? s.cost ?? (s.items||[]).reduce((a,i)=>a+num(i.costPrice)*num(i.quantity),0)),0);
  const gross=revenue-cost;
  const expenseTotal=sum(expenses,'amount');
  const net=gross-expenseTotal;
  const topProducts={};
  sales.forEach(s=>(s.items||[]).forEach(i=>{
    const name=i.name||productName(i.productId);
    topProducts[name]=(topProducts[name]||0)+num(i.quantity);
  }));
  const topRows=Object.entries(topProducts).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([name,qty])=>tr([esc(name),qty]));
  const stockRows=data.products.slice().sort((a,b)=>num(b.stock)*num(b.costPrice)-num(a.stock)*num(a.costPrice)).slice(0,8).map(p=>tr([esc(p.name),num(p.stock),money(num(p.stock)*num(p.costPrice))]));
  return `${pageHead('Reports & Analytics','A summary of the records currently saved in your business workspace.',`<button class="btn btn-light" data-action="export-report">Export report CSV</button>`)}
    <div class="metric-grid">
      ${metric('Recorded revenue',money(revenue),'All saved sales invoices','↗','blue')}
      ${metric('Estimated gross profit',money(gross),'Revenue less available item cost','◈','green')}
      ${metric('Expenses',money(expenseTotal),'Recorded expense entries','▤','orange')}
      ${metric('Estimated net result',money(net),'Gross profit less recorded expenses','∑','purple')}
    </div>
    <div class="dashboard-grid section-gap">
      <section class="panel table-panel"><div class="panel-head"><div><h3>Best-selling products</h3><p>Units recorded in saved sale items</p></div></div>
      ${table(['Medicine / Product','Units sold'],topRows,'No item-level sales data available yet.')}</section>
      <section class="panel table-panel"><div class="panel-head"><div><h3>Stock valuation</h3><p>Current quantity × saved purchase cost</p></div></div>
      ${table(['Product','Stock units','Estimated value'],stockRows,'No inventory records available.')}</section>
    </div>
    <div class="notice warning section-gap">These are summaries of the records currently stored in this workspace, not audited financial statements. Missing purchase costs, batch costs, unpaid balances or unrecorded transactions can affect the totals.</div>`;
}
function renderSettings() {
  return `${pageHead('Business Settings','Manage your workspace profile and display preferences.')}
    <div class="settings-grid">
      <section class="panel settings-card"><div class="panel-head"><div><h3>Business profile</h3><p>Information shown in your workspace</p></div></div>
        <form id="settingsForm" class="form-grid">
          <label class="field full"><span>Business name</span><input name="name" required maxlength="100" value="${esc(business.name||'')}"></label>
          <label class="field"><span>Business type</span><select name="type"><option value="general" ${business.type==='general'?'selected':''}>General business</option><option value="medical" ${business.type==='medical'?'selected':''}>Medical store</option><option value="wholesale" ${business.type==='wholesale'?'selected':''}>Wholesale</option></select></label>
          <label class="field"><span>Currency</span><select name="currency">${['PKR','USD','AED','SAR','GBP','EUR'].map(c=>`<option value="${c}" ${business.currency===c?'selected':''}>${c}</option>`).join('')}</select></label>
          <div class="form-actions full"><button class="btn btn-primary" type="submit">Save settings</button></div>
        </form>
      </section>
      <section class="panel settings-card"><div class="panel-head"><div><h3>Account</h3><p>Signed-in account details</p></div></div>
        <div class="account-detail"><span>Account name</span><b>${esc(currentUser?.displayName||'—')}</b></div>
        <div class="account-detail"><span>Email address</span><b>${esc(currentUser?.email||'—')}</b></div>
        <div class="account-detail"><span>Firebase user ID</span><small>${esc(currentUser?.uid||'—')}</small></div>
        <div class="form-actions"><button class="btn btn-light" data-action="logout">Sign out</button></div>
      </section>
    </div>
    <div class="notice warning section-gap">Changing the displayed currency does not convert historical amounts. Existing transaction values remain unchanged.</div>`;
}
function renderCurrent() {
  if (!currentUser || !db) return;
  updateAlertChrome();
  const renderers={
    dashboard:renderDashboard,inventory:renderInventory,sales:renderSales,
    purchases:renderPurchases,ledger:renderLedger,customers:renderCustomers,
    suppliers:renderSuppliers,expenses:renderExpenses,deliveries:renderDeliveries,
    returns:renderReturns,reports:renderReports,settings:renderSettings,
  };
  const render=renderers[activePage]||renderDashboard;
  $('pageContent').innerHTML=render();
  $('syncStatus').textContent='Synced';
}
const field = (label,name,type='text',value='',required=false,options=null,extra='') => {
  const req=required?'required':'';
  let control='';
  if(type==='select') {
    control=`<select name="${name}" ${req}>${(options||[]).map(o=>`<option value="${esc(o.value)}" ${String(o.value)===String(value)?'selected':''}>${esc(o.label)}</option>`).join('')}</select>`;
  } else if(type==='textarea') {
    control=`<textarea name="${name}" rows="3" ${req} ${extra}>${esc(value)}</textarea>`;
  } else {
    control=`<input name="${name}" type="${type}" value="${esc(value)}" ${req} ${extra}>`;
  }
  return `<label class="field"><span>${label}${required?' *':''}</span>${control}</label>`;
};
const selectOptions = (items, labelKey='name') => items.map(x=>({value:x.id,label:x[labelKey]||x.name||'Unnamed'}));
const paymentOptions = [
  {value:'Cash',label:'Cash'},
  {value:'Bank',label:'Bank'},
  {value:'JazzCash',label:'JazzCash'},
  {value:'Easypaisa',label:'Easypaisa'},
  {value:'Credit',label:'Credit / Due'}
];
function dialogOpen(title,content,submitLabel='Save record') {
  const save=$('dialogSave'); if(save){save.type='submit';save.disabled=false;save.textContent=submitLabel;save.onclick=null;}
  $('dialogTitle').textContent=title;
  $('dialogFields').innerHTML=content;
  $('dialogSave').textContent=submitLabel;
  $('recordDialog').showModal();
}
function dialogClose() {
  if($('recordDialog').open) $('recordDialog').close();
  $('recordForm').onsubmit=null;
  $('recordForm').dataset.type='';
  $('recordForm').dataset.id='';
}
function openRecordForm(type,id=null) {
  const old=id?data[type==='product'?'products':type==='sale'?'sales':type==='purchase'?'purchases':`${type}s`]?.find(x=>x.id===id):null;
  const v=(key,def='')=>old?.[key]??def;
  let title='Add record',content='',saveLabel='Save record';
  const customerOpts=[{value:'',label:'Walk-in customer'},...selectOptions(data.customers)];
  const supplierOpts=[{value:'',label:'Select supplier'},...selectOptions(data.suppliers)];
  const productOpts=[{value:'',label:'Select medicine'},...selectOptions(data.products)];
  if(type==='product') {
    title=id?'Edit medicine':'Add medicine / stock';
    content=`<div class="form-grid">
      ${field('Medicine / product name','name','text',v('name'),true)}
      ${field('SKU / product code','sku','text',v('sku'))}
      ${field('Medicine type / category','medicineType','text',v('medicineType','Other'))}
      ${field('Unit','unit','select',v('unit','piece'),true,['piece','bottle','vial','pack','box','bag','kg','gram','litre','ml'].map(x=>({value:x,label:x})))}
      ${field('Purchase price per unit','costPrice','number',v('costPrice',0),true,null,'min="0" step="0.01"')}
      ${field('Sale price per unit','salePrice','number',v('salePrice',0),true,null,'min="0" step="0.01"')}
      ${field(id?'Current stock quantity':'Opening stock quantity','stock','number',v('stock',0),true,null,'min="0" step="0.001"')}
      ${field('Low stock alert level','reorderLevel','number',v('reorderLevel',5),false,null,'min="0" step="0.001"')}
      ${field('Batch number','batch','text',v('batch'))}
      ${field('Expiry date','expiryDate','date',v('expiryDate'))}
      ${field('Supplier','supplierName','text',v('supplierName'))}
      ${field('Description / notes','description','textarea',v('description'))}
    </div><div class="notice">For new stock deliveries, use Purchases so each delivery is recorded as a separate batch with its own expiry date. Editing stock here creates an adjustment record.</div>`;
  } else if(type==='customer') {
    title=id?'Edit customer':'Add customer';
    content=`<div class="form-grid">
      ${field('Customer name','name','text',v('name'),true)}
      ${field('Phone number','phone','tel',v('phone'))}
      ${field('Email','email','email',v('email'))}
      ${field('Address','address','text',v('address'))}
      ${field('Credit limit','creditLimit','number',v('creditLimit',0),false,null,'min="0" step="0.01"')}
      ${field('Notes','notes','textarea',v('notes'))}
    </div>`;
  } else if(type==='supplier') {
    title=id?'Edit supplier':'Add supplier';
    content=`<div class="form-grid">
      ${field('Supplier / company name','name','text',v('name'),true)}
      ${field('Phone number','phone','tel',v('phone'))}
      ${field('Email','email','email',v('email'))}
      ${field('Address','address','text',v('address'))}
      ${field('Contact person','contactPerson','text',v('contactPerson'))}
      ${field('Notes','notes','textarea',v('notes'))}
    </div>`;
  } else if(type==='expense') {
    title=id?'Edit expense':'Add business expense';
    content=`<div class="form-grid">
      ${field('Expense title','title','text',v('title'),true)}
      ${field('Category','category','select',v('category','General'),true,['General','Rent','Electricity','Transport','Salary','Packaging','Utilities','Other'].map(x=>({value:x,label:x})))}
      ${field('Amount','amount','number',v('amount',0),true,null,'min="0" step="0.01"')}
      ${field('Date','date','date',v('date',today()),true)}
      ${field('Payment method','paymentMethod','select',v('paymentMethod','Cash'),true,paymentOptions)}
      ${field('Description','description','textarea',v('description'))}
    </div>`;
  } else if(type==='purchase') {
    title=id?'Edit purchase':'Record purchase';
    content=`<div class="form-grid">
      ${field('Supplier','supplierId','select',v('supplierId',''),false,supplierOpts)}
      ${field('Supplier invoice / reference','invoiceNo','text',v('invoiceNo',invoiceNo()))}
      ${field('Purchase date','date','date',v('date',today()),true)}
      ${field('Medicine','productId','select',v('productId',''),true,productOpts)}
      ${field('Quantity received','quantity','number',v('quantity',1),true,null,'min="0.001" step="0.001"')}
      ${field('Purchase price per unit','unitCost','number',v('unitCost',0),true,null,'min="0" step="0.01"')}
      ${field('Amount paid','paid','number',v('paid',0),false,null,'min="0" step="0.01"')}
      ${field('Payment method','paymentMethod','select',v('paymentMethod','Cash'),true,paymentOptions)}
      ${field('Batch number','batch','text',v('batch'))}
      ${field('Expiry date','expiryDate','date',v('expiryDate'))}
      ${field('Notes','notes','textarea',v('notes'))}
    </div>`;
  } else if(type==='sale') {
    title='New sale / POS invoice';
    saveLabel='Complete sale';
    content=`<div class="form-grid">
      ${field('Customer','customerId','select',v('customerId',''),false,customerOpts)}
      ${field('Customer name (optional)','customerName','text',v('customerName'))}
      ${field('Customer phone','customerPhone','tel',v('customerPhone'))}
      ${field('Invoice number','invoiceNo','text',v('invoiceNo',invoiceNo()))}
      ${field('Sale date','date','date',v('date',today()),true)}
      ${field('Medicine','productId','select',v('productId',''),true,productOpts)}
      ${field('Quantity','quantity','number',v('quantity',1),true,null,'min="0.001" step="0.001"')}
      ${field('Sale price per unit','unitPrice','number',v('unitPrice',0),true,null,'min="0" step="0.01"')}
      ${field('Discount amount','discount','number',v('discount',0),false,null,'min="0" step="0.01"')}
      ${field('Amount received','paid','number',v('paid',0),false,null,'min="0" step="0.01"')}
      ${field('Payment method','paymentMethod','select',v('paymentMethod','Cash'),true,paymentOptions)}
      ${field('Notes','notes','textarea',v('notes'))}
    </div>
    <div class="notice warning">This simple POS form records one medicine per invoice. A multi-item cart and batch-level FEFO allocation require a separate expanded POS workflow.</div>`;
  } else if(type==='delivery') {
    title=id?'Edit delivery':'Add delivery';
    content=`<div class="form-grid">
      ${field('Delivery reference','deliveryNo','text',v('deliveryNo',invoiceNo()))}
      ${field('Customer name','customerName','text',v('customerName'),true)}
      ${field('Phone','phone','tel',v('phone'))}
      ${field('Delivery address','address','text',v('address'))}
      ${field('Delivery staff','staffName','text',v('staffName'))}
      ${field('Delivery date','date','date',v('date',today()),true)}
      ${field('Status','status','select',v('status','Pending'),true,['Pending','Dispatched','In transit','Delivered','Cancelled'].map(x=>({value:x,label:x})))}
      ${field('Notes','notes','textarea',v('notes'))}
    </div>`;
  } else if(type==='return') {
    title=id?'Edit return':'Record return';
    content=`<div class="form-grid">
      ${field('Invoice number (if known)','invoiceNo','text',v('invoiceNo'))}
      ${field('Customer name','customerName','text',v('customerName'))}
      ${field('Return date','date','date',v('date',today()),true)}
      ${field('Medicine','productId','select',v('productId',''),false,productOpts)}
      ${field('Quantity returned','quantity','number',v('quantity',1),true,null,'min="0.001" step="0.001"')}
      ${field('Refund / return value','amount','number',v('amount',0),false,null,'min="0" step="0.01"')}
      ${field('Reason','reason','select',v('reason','Other'),true,['Damaged','Wrong item','Expired','Customer changed mind','Other'].map(x=>({value:x,label:x})))}
      ${field('Status','status','select',v('status','Pending review'),true,['Pending review','Approved','Rejected','Refunded'].map(x=>({value:x,label:x})))}
      ${field('Notes','notes','textarea',v('notes'))}
    </div>`;
  } else {
    toast('This form is not available yet.',true);
    return;
  }
  $('recordForm').dataset.type=type;
  $('recordForm').dataset.id=id||'';
  dialogOpen(title,content,saveLabel);
}
function formObject(form) {
  return Object.fromEntries(new FormData(form).entries());
}
function cleanNumberFields(obj, fields) {
  fields.forEach(k => { if (obj[k] !== undefined) obj[k] = num(obj[k]); });
  return obj;
}
function getProduct(id) {
  return data.products.find(p=>p.id===id);
}
function findCustomer(id) {
  return data.customers.find(c=>c.id===id);
}
function findSupplier(id) {
  return data.suppliers.find(s=>s.id===id);
}
async function saveSimpleRecord(type, id, payload) {
  if(id) await update(type,id,payload);
  else await add(type,{...payload,branchId:payload.branchId||pmActiveBranch||'main'});
}
async function handleRecordSubmit(event) {
  event.preventDefault();
  const form=event.currentTarget;
  const type=form.dataset.type;
  const id=form.dataset.id||'';
  const payload=formObject(form);
  try {
    $('dialogSave').disabled=true;
    $('dialogSave').textContent='Saving…';

    if(type==='product') {
      cleanNumberFields(payload,['stock','costPrice','salePrice','reorderLevel']);
      if(payload.stock<0 || payload.costPrice<0 || payload.salePrice<0) throw new Error('Quantity and prices cannot be negative.');
      if(id) {
        const before = getProduct(id);
        await update('products',id,payload);
        const delta = num(payload.stock) - num(before?.stock);
        if (delta) {
          await add('stockMovements',{ productId:id, productName:payload.name, branchId:pmActiveBranch||'main', type:delta>0?'ADJUSTMENT_IN':'ADJUSTMENT_OUT', quantity:Math.abs(delta), before:num(before?.stock), after:num(payload.stock), note:'Manual stock adjustment', date:today() });
        }
      } else {
        const created = await add('products',{...payload,stock:num(payload.stock),branchId:pmActiveBranch||'main',createdFrom:'manual'});
        if (num(payload.stock) > 0) {
          await add('batches',{ productId:created.id, productName:payload.name, branchId:pmActiveBranch||'main', batch:payload.batch||'OPENING', expiryDate:payload.expiryDate||'', quantityReceived:num(payload.stock), quantityRemaining:num(payload.stock), unitCost:num(payload.costPrice), supplierName:payload.supplierName||'', receivedDate:today(), source:'opening-stock' });
          await add('stockMovements',{ productId:created.id, productName:payload.name, branchId:pmActiveBranch||'main', type:'OPENING', quantity:num(payload.stock), before:0, after:num(payload.stock), note:'Opening stock', date:today() });
        }
      }
      await writeAudit(id?'UPDATE':'CREATE','product',id||'new',{name:payload.name});
    }

    else if(type==='customer') {
      cleanNumberFields(payload,['creditLimit']);
      await saveSimpleRecord('customers',id,payload);
    }

    else if(type==='supplier') {
      await saveSimpleRecord('suppliers',id,payload);
    }

    else if(type==='expense') {
      cleanNumberFields(payload,['amount']);
      if(payload.amount<=0) throw new Error('Enter an expense amount greater than zero.');
      await saveSimpleRecord('expenses',id,{...payload,branchId:pmActiveBranch||'main'});
      if(!id) await pmPostJournal(`Expense: ${payload.category||payload.description||'Operating expense'}`,`EXP-${Date.now()}`,[{account:'OperatingExpenses',debit:num(payload.amount),credit:0},{account:pmPaymentAccount(payload.paymentMethod),debit:0,credit:num(payload.amount)}]);
    }

    else if(type==='purchase') {
      if(id) {
        // Editing a historical purchase does not silently rewrite stock.
        cleanNumberFields(payload,['quantity','unitCost','paid']);
        payload.total=num(payload.quantity)*num(payload.unitCost);
        await update('purchases',id,payload);
      } else {
        cleanNumberFields(payload,['quantity','unitCost','paid']);
        if(!payload.productId) throw new Error('Select a medicine.');
        if(payload.quantity<=0 || payload.unitCost<0) throw new Error('Enter a valid quantity and purchase price.');
        const product=getProduct(payload.productId);
        if(!product) throw new Error('Selected medicine could not be found. Refresh and try again.');
        const total=payload.quantity*payload.unitCost;
        const purchaseData={
          ...payload,
          branchId:pmActiveBranch||'main',
          supplierName:findSupplier(payload.supplierId)?.name || payload.supplierName || '',
          productName:product.name,
          total,
          amount:total,
          status:'Received'
        };
        await runTransaction(db,async transaction=>{
          const productRef=docRef('products',product.id);
          const productSnap=await transaction.get(productRef);
          if(!productSnap.exists()) throw new Error('Medicine no longer exists.');
          const oldStock=num(productSnap.data().stock);
          transaction.update(productRef,{
            stock:oldStock+payload.quantity,
            costPrice:payload.unitCost,
            batch:payload.batch||productSnap.data().batch||'',
            expiryDate:payload.expiryDate||productSnap.data().expiryDate||'',
            updatedAt:serverTimestamp()
          });
          const batchRef=doc(batchCol());
          transaction.set(batchRef,{ productId:product.id, productName:product.name, branchId:pmActiveBranch||'main', batch:payload.batch||'UNSPECIFIED', expiryDate:payload.expiryDate||'', quantityReceived:payload.quantity, quantityRemaining:payload.quantity, unitCost:payload.unitCost, supplierId:payload.supplierId||'', supplierName:purchaseData.supplierName, receivedDate:payload.date||today(), purchaseId:'', createdAt:serverTimestamp(), updatedAt:serverTimestamp() });
          const purchaseRef=doc(col('purchases'));
          transaction.set(purchaseRef,{...purchaseData,batchId:batchRef.id,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
          const purchaseJournalRef=doc(pmCol('journal'));
          const paidAmount=Math.min(Math.max(0,num(payload.paid)),total);
          const purchaseLines=[{account:'Inventory',debit:total,credit:0}];
          if(paidAmount) purchaseLines.push({account:pmPaymentAccount(payload.paymentMethod),debit:0,credit:paidAmount});
          if(total-paidAmount) purchaseLines.push({account:'AccountsPayable',debit:0,credit:total-paidAmount});
          transaction.set(purchaseJournalRef,{date:payload.date||today(),description:`Purchase ${purchaseData.invoiceNo||product.name}`,reference:purchaseData.invoiceNo||'',branchId:pmActiveBranch||'main',lines:purchaseLines,status:'Posted',createdBy:uid(),createdAt:serverTimestamp()});
          await writeMovement(transaction,{ productId:product.id, productName:product.name, type:'PURCHASE_IN', quantity:payload.quantity, before:oldStock, after:oldStock+payload.quantity, batchId:batchRef.id, batch:payload.batch||'UNSPECIFIED', reference:payload.invoiceNo||'', date:payload.date||today() });
        });
      }
    }

    else if(type==='sale') {
      cleanNumberFields(payload,['quantity','unitPrice','discount','paid']);
      if(!payload.productId) throw new Error('Select a medicine.');
      if(payload.quantity<=0 || payload.unitPrice<0 || payload.discount<0 || payload.paid<0) throw new Error('Enter valid sale values.');
      const product=getProduct(payload.productId);
      if(!product) throw new Error('Selected medicine could not be found.');
      const totalBeforeDiscount=payload.quantity*payload.unitPrice;
      if(payload.discount>totalBeforeDiscount) throw new Error('Discount cannot exceed the sale amount.');
      const total=totalBeforeDiscount-payload.discount;
      if(payload.paid>total) throw new Error('Amount received cannot exceed the invoice total.');
      const customer=findCustomer(payload.customerId);
      const saleData={
        ...payload,
        branchId:pmActiveBranch||'main',
        customerName:payload.customerName||customer?.name||'Walk-in customer',
        customerPhone:payload.customerPhone||customer?.phone||'',
        productName:product.name,
        items:[{
          productId:product.id,
          name:product.name,
          quantity:payload.quantity,
          unitPrice:payload.unitPrice,
          costPrice:num(product.costPrice)
        }],
        subtotal:totalBeforeDiscount,
        total,
        costTotal:payload.quantity*num(product.costPrice),
        profit:total-payload.quantity*num(product.costPrice),
        status:payload.paid>=total?'Paid':'Due'
      };
      await runTransaction(db,async transaction=>{
        const productRef=docRef('products',product.id);
        const productSnap=await transaction.get(productRef);
        if(!productSnap.exists()) throw new Error('Medicine no longer exists.');
        const currentStock=num(productSnap.data().stock);
        if(currentStock<payload.quantity) throw new Error(`Insufficient stock. Available: ${currentStock}.`);
        const batchQuery=query(batchCol(),where('productId','==',product.id),orderBy('expiryDate','asc'));
        const batchSnap=await transaction.get(batchQuery);
        let remaining=payload.quantity;
        const allocations=[];
        for (const batchDoc of batchSnap.docs) {
          if (remaining<=0) break;
          const b=batchDoc.data();
          const expiry=safeDate(b.expiryDate);
          if (expiry!=='9999-12-31' && expiry<today()) continue;
          const available=num(b.quantityRemaining);
          if (available<=0) continue;
          const take=Math.min(available,remaining);
          if(take>0){ allocations.push({ref:batchDoc.ref,id:batchDoc.id,take,batch:b}); remaining-=take; }
        }
        // Older records may only have aggregate stock and no batch documents.
        const allocated=payload.quantity-remaining;
        if(remaining>0 && batchSnap.empty && currentStock>=payload.quantity){
          allocations.push({ref:null,id:'legacy-stock',take:payload.quantity,batch:{batch:product.batch||'LEGACY',expiryDate:product.expiryDate||'',unitCost:num(product.costPrice)}});
          remaining=0;
        }
        if(remaining>0) throw new Error(`Usable batch stock is short by ${remaining}. Check batch records or expiry dates.`);
        for(const a of allocations){ if(a.ref) transaction.update(a.ref,{quantityRemaining:num(a.batch.quantityRemaining)-a.take,updatedAt:serverTimestamp()}); }
        transaction.update(productRef,{stock:currentStock-payload.quantity,updatedAt:serverTimestamp()});
        const saleRef=doc(col('sales'));
        const finalItems=[{...saleData.items[0],allocations:allocations.map(a=>({batchId:a.id,batch:a.batch.batch||'',expiryDate:a.batch.expiryDate||'',quantity:a.take,unitCost:num(a.batch.unitCost||a.batch.costPrice||product.costPrice)}))}];
        const actualCost=finalItems[0].allocations.reduce((n,a)=>n+a.quantity*num(a.unitCost),0);
        transaction.set(saleRef,{...saleData,items:finalItems,costTotal:actualCost,profit:total-actualCost,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
        const saleJournalRef=doc(pmCol('journal'));
        const saleLines=[];if(num(payload.paid))saleLines.push({account:pmPaymentAccount(payload.paymentMethod),debit:num(payload.paid),credit:0});if(total-num(payload.paid)>0)saleLines.push({account:'AccountsReceivable',debit:total-num(payload.paid),credit:0});saleLines.push({account:'SalesRevenue',debit:0,credit:total});if(actualCost){saleLines.push({account:'CostOfGoodsSold',debit:actualCost,credit:0});saleLines.push({account:'Inventory',debit:0,credit:actualCost});}
        transaction.set(saleJournalRef,{date:saleData.date||today(),description:`POS sale ${saleData.invoiceNo}`,reference:saleData.invoiceNo,branchId:pmActiveBranch||'main',lines:saleLines,status:'Posted',createdBy:uid(),createdAt:serverTimestamp()});
        await writeMovement(transaction,{productId:product.id,productName:product.name,type:'SALE_OUT',quantity:payload.quantity,before:currentStock,after:currentStock-payload.quantity,allocations:finalItems[0].allocations,reference:saleData.invoiceNo,date:saleData.date||today()});
      });
      await writeAudit('CREATE','sale',payload.invoiceNo,{total,product:product.name,quantity:payload.quantity});
    }

    else if(type==='delivery') {
      await saveSimpleRecord('deliveries',id,payload);
    }

    else if(type==='return') {
      cleanNumberFields(payload,['quantity','amount']);
      if(payload.quantity<=0) throw new Error('Enter a valid return quantity.');
      if(id) throw new Error('Saved return records are locked to prevent duplicate stock restoration. Create a new return correction record instead.');
      const product=getProduct(payload.productId);
      if(!product) throw new Error('Select a valid medicine for this return.');
      const restockable=!['Damaged','Expired'].includes(payload.reason);
      const approved=payload.status==='Approved' || payload.status==='Refunded';
      await runTransaction(db,async transaction=>{
        const productRef=docRef('products',product.id);
        const productSnap=await transaction.get(productRef);
        if(!productSnap.exists()) throw new Error('Medicine no longer exists.');
        const current=num(productSnap.data().stock);
        const returnRef=doc(col('returns'));
        const returnData={...payload,branchId:pmActiveBranch||'main',productName:product.name,stockRestored:approved&&restockable,createdAt:serverTimestamp(),updatedAt:serverTimestamp()};
        transaction.set(returnRef,returnData);
        if(approved&&restockable){
          transaction.update(productRef,{stock:current+payload.quantity,updatedAt:serverTimestamp()});
          const batchRef=doc(batchCol());
          transaction.set(batchRef,{productId:product.id,productName:product.name,branchId:pmActiveBranch||'main',batch:'RETURN-'+returnRef.id.slice(0,6),expiryDate:product.expiryDate||'',quantityReceived:payload.quantity,quantityRemaining:payload.quantity,unitCost:num(product.costPrice),receivedDate:payload.date||today(),source:'customer-return',returnId:returnRef.id,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
          await writeMovement(transaction,{productId:product.id,productName:product.name,type:'RETURN_IN',quantity:payload.quantity,before:current,after:current+payload.quantity,reference:payload.invoiceNo||returnRef.id,date:payload.date||today(),note:'Approved customer return'});
        }
      });
      await writeAudit('CREATE','return','new',{product:product.name,quantity:payload.quantity,restocked:approved&&restockable});
    }

    dialogClose();
    toast(id?'Record updated successfully.':'Record saved successfully.');
    renderCurrent();
  } catch(error) {
    console.error('Save error:',error);
    toast(error.message||'Could not save this record.',true);
  } finally {
    $('dialogSave').disabled=false;
    $('dialogSave').textContent='Save record';
  }
}

async function saveSettings(event) {
  event.preventDefault();
  const payload=formObject(event.currentTarget);
  try {
    if(!payload.name?.trim()) throw new Error('Enter your business name.');
    await setDoc(doc(db,'users',uid()),{
      ...business,
      name:payload.name.trim(),
      type:payload.type||'general',
      currency:payload.currency||'PKR',
      updatedAt:serverTimestamp()
    },{merge:true});
    business={...business,...payload};
    updateBusinessChrome();
    toast('Business settings saved.');
    renderCurrent();
  } catch(error) {
    console.error(error);
    toast(error.message||'Could not save settings.',true);
  }
}

function csvCell(value) {
  const text=String(value??'');
  return `"${text.replace(/"/g,'""')}"`;
}
function downloadCSV(filename,headers,rows) {
  const csv=[headers,...rows].map(row=>row.map(csvCell).join(',')).join('\r\n');
  const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download=filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
function exportProducts() {
  downloadCSV('poultrymed-inventory.csv',
    ['Name','SKU','Category','Unit','Stock','Purchase price','Sale price','Batch','Expiry'],
    data.products.map(p=>[p.name,p.sku,p.medicineType,p.unit,p.stock,p.costPrice,p.salePrice,p.batch,p.expiryDate]));
}
function exportSales() {
  downloadCSV('poultrymed-sales.csv',
    ['Invoice','Date','Customer','Phone','Total','Paid','Balance','Payment method'],
    data.sales.map(s=>[s.invoiceNo,dateOf(s),s.customerName,s.customerPhone,s.total,s.paid,num(s.total)-num(s.paid),s.paymentMethod]));
}
function exportPurchases() {
  downloadCSV('poultrymed-purchases.csv',
    ['Reference','Date','Supplier','Product','Quantity','Unit cost','Total','Paid'],
    data.purchases.map(p=>[p.invoiceNo,dateOf(p),p.supplierName,p.productName||p.productId,p.quantity,p.unitCost,p.total,p.paid]));
}
function exportReport() {
  downloadCSV('poultrymed-report.csv',
    ['Report','Value'],
    [
      ['Revenue',sum(data.sales,'total')],
      ['Sales cost',data.sales.reduce((n,s)=>n+num(s.costTotal),0)],
      ['Recorded expenses',sum(data.expenses,'amount')],
      ['Inventory item count',data.products.length],
      ['Stock units',sum(data.products,'stock')],
      ['Purchases',sum(data.purchases,'total')]
    ]);
}

function printSale(id) {
  const sale=data.sales.find(s=>s.id===id);
  if(!sale) return toast('Invoice not found.',true);
  const rows=(sale.items||[]).map(item=>`
    <tr>
      <td>${esc(item.name||productName(item.productId))}</td>
      <td>${num(item.quantity)}</td>
      <td>${money(item.unitPrice)}</td>
      <td>${money(num(item.quantity)*num(item.unitPrice))}</td>
    </tr>`).join('');
  const w=window.open('','_blank','width=850,height=700');
  if(!w) return toast('Allow pop-ups to print the invoice.',true);
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${esc(sale.invoiceNo)}</title>
  <style>
  body{font:14px Arial,sans-serif;color:#17243a;padding:30px}
  h1{margin:0 0 5px}small{color:#68758a}
  .head{display:flex;justify-content:space-between;border-bottom:2px solid #1eae91;padding-bottom:18px}
  table{width:100%;border-collapse:collapse;margin-top:28px}
  th,td{padding:12px;border-bottom:1px solid #ddd;text-align:left}
  .total{margin:24px 0 0 auto;width:260px}
  .total div{display:flex;justify-content:space-between;padding:7px}
  .grand{font-weight:bold;border-top:2px solid #17243a}
  @media print{button{display:none}}
  </style></head><body>
  <div class="head"><div><h1>${esc(business.name)}</h1><small>Sales invoice</small></div><div><b>${esc(sale.invoiceNo)}</b><br>${esc(dateOf(sale))}</div></div>
  <p><b>Customer:</b> ${esc(sale.customerName||'Walk-in customer')}<br><b>Phone:</b> ${esc(sale.customerPhone||'—')}</p>
  <table><thead><tr><th>Item</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table>
  <div class="total">
    <div><span>Subtotal</span><b>${money(sale.subtotal||sale.total)}</b></div>
    <div><span>Discount</span><b>${money(sale.discount)}</b></div>
    <div class="grand"><span>Total</span><b>${money(sale.total)}</b></div>
    <div><span>Paid</span><b>${money(sale.paid)}</b></div>
    <div><span>Balance</span><b>${money(Math.max(0,num(sale.total)-num(sale.paid)))}</b></div>
  </div>
  <p style="margin-top:50px;text-align:center">Thank you for your business.</p>
  <button onclick="window.print()">Print invoice</button>
  </body></html>`);
  w.document.close();
}
function viewSale(id) {
  const s=data.sales.find(x=>x.id===id);
  if(!s) return toast('Sale not found.',true);
  const items=(s.items||[]).map(i=>`${i.name||productName(i.productId)} × ${i.quantity} — ${money(num(i.quantity)*num(i.unitPrice))}`).join('\n');
  dialogOpen(`Invoice ${s.invoiceNo||''}`,
    `<div class="detail-list">
      <div><b>Customer</b><span>${esc(s.customerName||'Walk-in')}</span></div>
      <div><b>Date</b><span>${esc(dateOf(s))}</span></div>
      <div><b>Items</b><span>${esc(items)}</span></div>
      <div><b>Total</b><span>${esc(money(s.total))}</span></div>
      <div><b>Paid</b><span>${esc(money(s.paid))}</span></div>
      <div><b>Balance</b><span>${esc(money(Math.max(0,num(s.total)-num(s.paid))))}</span></div>
      <div><b>Payment</b><span>${esc(s.paymentMethod||'—')}</span></div>
    </div>`,
    'Close');
  $('dialogSave').type='button';
  $('dialogSave').onclick=dialogClose;
}

function showDetail(title,lines) {
  dialogOpen(title,`<div class="detail-list">${lines.map(([label,value])=>`<div><b>${esc(label)}</b><span>${esc(value??'—')}</span></div>`).join('')}</div>`,'Close');
  $('dialogSave').type='button';
  $('dialogSave').onclick=dialogClose;
}
function viewPurchase(id) {
  const p=data.purchases.find(x=>x.id===id);
  if(!p) return toast('Purchase not found.',true);
  showDetail('Purchase details',[
    ['Reference',p.invoiceNo],
    ['Supplier',p.supplierName],
    ['Product',p.productName||productName(p.productId)],
    ['Quantity',p.quantity],
    ['Unit cost',money(p.unitCost)],
    ['Total',money(p.total)],
    ['Paid',money(p.paid)],
    ['Date',dateOf(p)],
    ['Batch',p.batch],
    ['Expiry',p.expiryDate]
  ]);
}
function viewCustomer(id) {
  const c=data.customers.find(x=>x.id===id);
  if(!c) return toast('Customer not found.',true);
  const sales=data.sales.filter(s=>s.customerId===id || (s.customerName||'').toLowerCase()===(c.name||'').toLowerCase());
  const billed=sales.reduce((n,s)=>n+num(s.total),0);
  const paid=sales.reduce((n,s)=>n+num(s.paid),0);
  showDetail('Customer ledger',[
    ['Name',c.name],['Phone',c.phone],['Email',c.email],
    ['Invoices',sales.length],['Total billed',money(billed)],
    ['Payments received',money(paid)],['Outstanding balance',money(Math.max(0,billed-paid))]
  ]);
}
function viewSupplier(id) {
  const s=data.suppliers.find(x=>x.id===id);
  if(!s) return toast('Supplier not found.',true);
  const purchases=data.purchases.filter(p=>p.supplierId===id || (p.supplierName||'').toLowerCase()===(s.name||'').toLowerCase());
  showDetail('Supplier purchase history',[
    ['Supplier',s.name],['Phone',s.phone],['Email',s.email],
    ['Purchase records',purchases.length],
    ['Purchase total',money(purchases.reduce((n,p)=>n+num(p.total),0))]
  ]);
}
function viewReturn(id) {
  const r=data.returns.find(x=>x.id===id);
  if(!r) return toast('Return not found.',true);
  showDetail('Return details',[
    ['Reference',r.reference||r.invoiceNo],['Customer',r.customerName],
    ['Date',dateOf(r)],['Product',productName(r.productId)],
    ['Quantity',r.quantity],['Value',money(r.amount)],
    ['Reason',r.reason],['Status',r.status]
  ]);
}

async function deleteRecord(type,id) {
  const labels={product:'medicine',expense:'expense',delivery:'delivery'};
  const label=labels[type]||'record';
  if(!confirm(`Delete this ${label}? This cannot be undone from the app.`)) return;
  try {
    await remove(type==='product'?'products':`${type}s`,id);
    toast(`${label[0].toUpperCase()+label.slice(1)} deleted.`);
  } catch(error) {
    console.error(error);
    toast(error.message||'Could not delete record.',true);
  }
}
function handleAction(action,buttonEl) {
  const id=buttonEl.dataset.id;
  const type=buttonEl.dataset.type;
  if(action.startsWith('new-')) {
    const map={'new-product':'product','new-sale':'sale','new-purchase':'purchase','new-customer':'customer','new-supplier':'supplier','new-expense':'expense','new-delivery':'delivery','new-return':'return'};
    return openRecordForm(map[action]);
  }
  if(action==='edit') return openRecordForm(type,id);
  if(action==='delete') return deleteRecord(type,id);
  if(action==='view-sale') return viewSale(id);
  if(action==='print-sale') return printSale(id);
  if(action==='view-purchase') return viewPurchase(id);
  if(action==='view-customer') return viewCustomer(id);
  if(action==='view-supplier') return viewSupplier(id);
  if(action==='view-return') return viewReturn(id);
  if(action==='logout') return logout();
  if(action==='export-products') return exportProducts();
  if(action==='export-sales') return exportSales();
  if(action==='export-purchases') return exportPurchases();
  if(action==='export-report') return exportReport();
}
async function loginWithEmail(event) {
  event.preventDefault();
  setAuthError('');
  try {
    requireConfig();
    setAuthBusy(true);
    const email=$('email').value.trim();
    const password=$('password').value;
    if(authMode==='signup') {
      const name=$('fullName').value.trim();
      const businessName=$('businessName').value.trim();
      const businessType=$('businessType').value;
      if(!name||!businessName) throw new Error('Enter your name and business name.');
      const credential=await createUserWithEmailAndPassword(auth,email,password);
      await updateProfile(credential.user,{displayName:name});
      await ensureBusiness(credential.user,{name:businessName,type:businessType});
    } else {
      await signInWithEmailAndPassword(auth,email,password);
    }
  } catch(error) {
    console.error('Authentication error:',error);
    const messages={
      'auth/invalid-credential':'Incorrect email or password.',
      'auth/email-already-in-use':'This email already has an account. Please sign in.',
      'auth/weak-password':'Please choose a stronger password.',
      'auth/invalid-email':'Please enter a valid email address.',
      'auth/network-request-failed':'Network error. Check your internet connection.',
      'auth/popup-closed-by-user':'The Google sign-in window was closed.'
    };
    setAuthError(messages[error.code]||error.message||'Could not authenticate.');
  } finally {
    setAuthBusy(false);
  }
}
async function loginWithGoogle() {
  setAuthError('');
  try {
    requireConfig();
    $('googleBtn').disabled=true;
    $('googleBtn').textContent='Connecting…';
    const provider=new GoogleAuthProvider();
    const result=await signInWithPopup(auth,provider);
    await ensureBusiness(result.user);
  } catch(error) {
    console.error(error);
    setAuthError(error.message||'Google sign-in failed.');
  } finally {
    $('googleBtn').disabled=false;
    $('googleBtn').textContent='Continue with Google';
  }
}
async function resetPassword() {
  const email=$('email').value.trim();
  if(!email) {
    setAuthError('Enter your email address first.');
    $('email').focus();
    return;
  }
  try {
    requireConfig();
    await sendPasswordResetEmail(auth,email);
    setAuthError('If this email is registered, Firebase will send a password reset message.');
  } catch(error) {
    setAuthError(error.message||'Could not send the reset email.');
  }
}
async function logout() {
  if(!auth)return;
  try {
    stopWatchers();
    await signOut(auth);
    toast('Signed out successfully.');
  } catch(error) {
    console.error(error);
    toast(error.message||'Sign out failed.',true);
  }
}

function handlePageClick(event) {
  const pageButton=event.target.closest('[data-page]');
  if(pageButton) {
    navigate(pageButton.dataset.page);
    return;
  }
  const pageLink=event.target.closest('[data-page-link]');
  if(pageLink) {
    navigate(pageLink.dataset.pageLink);
    return;
  }
  const actionButton=event.target.closest('[data-action]');
  if(actionButton) {
    handleAction(actionButton.dataset.action,actionButton);
    return;
  }
  const filterButton=event.target.closest('[data-alert-filter]');
  if(filterButton) {
    inventoryFilter=filterButton.dataset.alertFilter;
    searchText='';
    navigate('inventory');
    return;
  }
  const rangeButton=event.target.closest('[data-chart-range]');
  if(rangeButton) {
    chartRange=Number(rangeButton.dataset.chartRange)||30;
    renderCurrent();
    return;
  }
  if(event.target.closest('#menuBtn')) { $('sidebar').classList.toggle('open'); $('scrim').classList.toggle('hidden'); }
  if(event.target.closest('#closeMenu')) { $('sidebar').classList.remove('open'); $('scrim').classList.add('hidden'); }
  if(event.target.closest('#alertsBtn')) { inventoryFilter='all-alerts'; navigate('inventory'); }
  if(event.target.closest('#logoutBtn')) logout();
  if(event.target.closest('#scrim')) {
    $('sidebar').classList.remove('open');
    $('scrim').classList.add('hidden');
  }
}
function handleSearchInput(event) {
  if(!event.target.matches('[data-search],#globalSearch'))return;
  searchText=event.target.value;
  const selectionStart=event.target.selectionStart;
  const id=event.target.id;
  renderCurrent();
  const next=id?$(id):document.querySelector('[data-search]');
  if(next) {
    next.focus();
    try { next.setSelectionRange(selectionStart,selectionStart); } catch {}
  }
}
function handleGeneralSubmit(event) {
  if(event.target.id==='authForm') {
    loginWithEmail(event);
    return;
  }
  if(event.target.id==='settingsForm') {
    saveSettings(event);
    return;
  }
}
function handleProductSelect(event) {
  if(event.target.name!=='productId')return;
  const product=getProduct(event.target.value);
  if(!product)return;
  const form=event.target.closest('form');
  if(!form)return;
  const priceInput=form.elements.unitPrice;
  const costInput=form.elements.unitCost;
  if(priceInput) priceInput.value=product.salePrice||0;
  if(costInput) costInput.value=product.costPrice||0;
}

function initializeFirebase() {
  if(!configReady) {
    console.error('Firebase configuration is incomplete.');
    setAuthError('Firebase configuration is incomplete. Check FIREBASE_CONFIG in app.js.');
    return;
  }
  try {
    const app=initializeApp(FIREBASE_CONFIG);
    auth=getAuth(app);
    db=getFirestore(app);
    setPersistence(auth,browserLocalPersistence).catch(error=>console.error('Persistence:',error));
    onAuthStateChanged(auth,async user=>{
      stopWatchers();
      currentUser=user||null;
      tenantUid=null;
      if(!user) {
        showAuth();
        return;
      }
      try {
        const tokenInfo=await user.getIdTokenResult();
        tenantUid=tokenInfo.claims.ownerUid || user.uid;
        pmAllowedBranches=tokenInfo.claims.ownerUid ? (Array.isArray(tokenInfo.claims.branchIds)?tokenInfo.claims.branchIds:['main']) : null;
        if(pmAllowedBranches?.length && !pmAllowedBranches.includes(pmActiveBranch)) pmActiveBranch=pmAllowedBranches[0];
        if(!tokenInfo.claims.ownerUid) await ensureBusiness(user);
        await loadBusiness();
        const display=user.displayName || user.email?.split('@')[0] || 'User';
        if($('userDisplayName')) $('userDisplayName').textContent=display;
        if($('userEmail')) $('userEmail').textContent=user.email||'';
        if($('userAvatar')) $('userAvatar').textContent=display.slice(0,1).toUpperCase();
        if($('yearNow')) $('yearNow').textContent=new Date().getFullYear();
        showApp();
        startWatchers();
        navigate(activePage||'dashboard');
      } catch(error) {
        console.error('Workspace loading error:',error);
        toast(error.message||'Could not load your workspace.',true);
      }
    });
  } catch(error) {
    console.error('Firebase initialization failed:',error);
    setAuthError(error.message||'Firebase initialization failed.');
  }
}

document.addEventListener('click',handlePageClick);
document.addEventListener('input',handleSearchInput);
document.addEventListener('submit',handleGeneralSubmit);
document.addEventListener('change',handleProductSelect);

if($('switchMode')) {
  $('switchMode').addEventListener('click',()=>{
    authModeSet(authMode==='login'?'signup':'login');
  });
}
if($('forgotBtn')) $('forgotBtn').addEventListener('click',resetPassword);
if($('googleBtn')) $('googleBtn').addEventListener('click',loginWithGoogle);
if($('recordDialog')) {
  $('recordDialog').addEventListener('click',event=>{
    if(event.target===$('recordDialog')) dialogClose();
  });
  $('recordDialog').addEventListener('close',()=>{
    $('recordForm').onsubmit=null;
  });
}
if($('recordForm')) {
  $('recordForm').addEventListener('submit',handleRecordSubmit);
}
if($('recordForm')) {
  $('recordForm').addEventListener('click',event=>{
    if(event.target.matches('[data-dialog-close]')) dialogClose();
  });
}
if($('authForm')) authModeSet('login');
initializeFirebase();


/* ================= POULTRYMED ADVANCED ERP MODULES =================
   Multi-item POS, branch-tagged inventory, staff invitations, double-entry
   journal, and callable Cloud Functions. Existing users/{uid}/inventory path
   remains the source for legacy product records. */
let pmFunctions=null, pmCart=[], pmBranches=[], pmMembers=[], pmJournal=[], pmActiveBranch='main', pmAllowedBranches=null;
let pmExtraUnsubs=[];
const pmMember=()=>pmMembers.find(m=>m.uid===currentUser?.uid && m.active!==false);
const pmIsOwner=()=>!!currentUser && currentUser.uid===uid();
const pmCanManageBusiness=()=>pmIsOwner() || ['admin','manager'].includes(pmMember()?.role);
const pmCanManageStaff=()=>pmIsOwner() || pmMember()?.role==='admin';
const pmCanSell=()=>pmIsOwner() || ['admin','manager','cashier'].includes(pmMember()?.role);
const pmBranchName=()=>pmBranches.find(b=>b.id===pmActiveBranch)?.name || (pmActiveBranch==='main'?'Main Branch':'Selected Branch');
const pmRef=(name,id)=>doc(db,'users',uid(),name,id);
const pmCol=name=>collection(db,'users',uid(),name);
const pmBranchProducts=()=>data.products.filter(p=>(p.branchId||'main')===pmActiveBranch && (!pmAllowedBranches || pmAllowedBranches.includes(pmActiveBranch)));
const pmJournalTotals=()=>{
  const sums={}; pmJournal.forEach(j=>(j.lines||[]).forEach(l=>{sums[l.account]=(sums[l.account]||0)+num(l.debit)-num(l.credit)})); return sums;
};
function pmStartWatchers(){
  pmExtraUnsubs.forEach(fn=>fn()); pmExtraUnsubs=[];
  [['branches',v=>pmBranches=v],['members',v=>pmMembers=v],['journal',v=>pmJournal=v]].forEach(([name,setter])=>{
    let ref=pmCol(name);if(name==='journal' && currentUser?.uid!==uid() && pmAllowedBranches?.length) ref=query(ref,where('branchId','in',pmAllowedBranches));
    pmExtraUnsubs.push(onSnapshot(ref,snap=>{setter(snap.docs.map(d=>({id:d.id,...d.data()}))); if(['branches','team','accounting'].includes(activePage))renderCurrent();},err=>{console.error(name,err);toast(`Could not sync ${name}: ${err.message}`,true);}));
  });
}
const pmOriginalStartWatchers=startWatchers;
startWatchers=function(){pmOriginalStartWatchers();pmStartWatchers();};
const pmOriginalStopWatchers=stopWatchers;
stopWatchers=function(){pmOriginalStopWatchers();pmExtraUnsubs.forEach(fn=>fn());pmExtraUnsubs=[];};
function pmAddNav(){
  const nav=$('mainNav'); if(!nav||nav.querySelector('[data-page="pos"]'))return;
  const entries=[['pos','▣','Multi-item POS'],['branches','⌂','Branches'],['team','♙','Staff & Permissions'],['accounting','▤','Accounting']];
  entries.forEach(([page,icon,label])=>{const b=document.createElement('button');b.className='nav-link';b.dataset.page=page;b.innerHTML=`<span>${icon}</span>${label}`;nav.appendChild(b);});
  pageNames.pos='Multi-item POS';pageNames.branches='Branch Management';pageNames.team='Staff & Permissions';pageNames.accounting='Full Accounting';
}
function pmBranchPicker(){const visible=[{id:'main',name:'Main Branch'},...pmBranches].filter(b=>b.active!==false && (!pmAllowedBranches||pmAllowedBranches.includes(b.id)));return `<label class="pm-branch-picker"><span>Active branch</span><select id="pmBranchSelect">${visible.map(b=>`<option value="${esc(b.id)}" ${b.id===pmActiveBranch?'selected':''}>${esc(b.name)}</option>`).join('')}</select></label>`;}
function pmRenderPOS(){
 const products=pmBranchProducts().filter(p=>num(p.stock)>0);
 const subtotal=pmCart.reduce((n,x)=>n+x.qty*x.price,0), discount=pmCart.reduce((n,x)=>n+x.discount,0), total=Math.max(0,subtotal-discount);
 const cartRows=pmCart.map((x,i)=>`<tr><td><b>${esc(x.name)}</b><small class="muted-text">${esc(x.sku||'')}</small></td><td><input class="pm-qty" type="number" min="1" max="${x.available}" value="${x.qty}" data-cart-qty="${i}"></td><td><input class="pm-price" type="number" min="0" step="0.01" value="${x.price}" data-cart-price="${i}"></td><td>${money(x.qty*x.price)}</td><td><button class="mini-btn text-danger" data-cart-remove="${i}">Remove</button></td></tr>`).join('');
 return `${pageHead('Multi-item POS','Build one invoice with multiple medicines, quantities, discounts and payment allocation.',pmBranchPicker())}<div class="pm-pos-grid"><section class="panel"><div class="panel-head"><div><h3>Add medicines</h3><p>${esc(pmBranchName())} · available stock only</p></div></div><div class="pm-product-grid">${products.map(p=>`<button class="pm-product-tile" data-cart-add="${p.id}"><b>${esc(p.name)}</b><small>${esc(p.sku||p.medicineType||'Medicine')}</small><span>${money(p.salePrice)} · ${num(p.stock)} ${esc(p.unit||'units')}</span></button>`).join('')||'<p class="empty-state">No available products in this branch. Add branch-specific stock first.</p>'}</div></section><section class="panel"><div class="panel-head"><div><h3>Current invoice</h3><p>${pmCart.length} line items</p></div><button class="btn btn-light" data-cart-clear>Clear cart</button></div>${pmCart.length?`<div class="table-wrap"><table><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th><th></th></tr></thead><tbody>${cartRows}</tbody></table></div>`:'<div class="empty-state">Add items from the product list to start an invoice.</div>'}<div class="pm-checkout"><label>Customer<select id="pmCustomer"><option value="">Walk-in customer</option>${data.customers.map(c=>`<option value="${c.id}">${esc(c.name)} · ${esc(c.phone||'')}</option>`).join('')}</select></label><label>Discount (PKR)<input id="pmDiscount" type="number" min="0" step="0.01" value="0"></label><label>Amount received<input id="pmPaid" type="number" min="0" step="0.01" value="${total}"></label><label>Payment method<select id="pmPayment"><option>Cash</option><option>Bank</option><option>JazzCash</option><option>Easypaisa</option><option>Credit</option></select></label><div class="pm-total-line"><span>Subtotal</span><b>${money(subtotal)}</b></div><div class="pm-total-line"><span>Discount</span><b id="pmDiscountView">${money(discount)}</b></div><div class="pm-total-line pm-grand"><span>Invoice total</span><b id="pmGrandTotal">${money(total)}</b></div><button class="btn btn-primary btn-block" data-pos-checkout ${(!pmCart.length||!pmCanSell())?'disabled':''}>Complete sale</button></div></section></div>`;
}
function pmRenderBranches(){
 const rows=pmBranches.map(b=>tr([`<b>${esc(b.name)}</b>`,esc(b.code||'—'),esc(b.address||'—'),b.active===false?'<span class="pill red">Inactive</span>':'<span class="pill green">Active</span>',pmCanManageBusiness()?`<button class="mini-btn" data-branch-toggle="${b.id}">${b.active===false?'Activate':'Deactivate'}</button>`:'—']));
 return `${pageHead('Branch management','Create branches and tag new stock and sales to the selected branch.',pmCanManageBusiness()?`<button class="btn btn-primary" data-branch-new>Add branch</button>`:'')}<div class="metric-grid">${metric('Branches',pmBranches.length+1,'Including Main Branch','⌂')}${metric('Current branch',esc(pmBranchName()),'Selected workspace','◈')}</div><section class="panel table-panel"><div class="panel-head"><div><h3>Business locations</h3><p>Main Branch contains your existing untagged records.</p></div></div>${table(['Branch','Code','Address','Status','Action'],rows,'Create additional branches when needed.')}</section><div class="notice warning">Existing records are kept in Main Branch. Run the one-time branch-tagging step as the owner before inviting staff, so legacy records receive a Main Branch tag without changing their business values. Branch stock is tracked by separate product records; automatic stock transfer is not included.</div>${pmIsOwner()?'<button class="btn btn-light" data-branch-migrate>Tag existing records as Main Branch</button>':''}`;
}
function pmRenderTeam(){
 const canManage=pmCanManageStaff();
 const rows=pmMembers.map(m=>tr([esc(m.email||m.uid),`<span class="pill">${esc(m.role||'staff')}</span>`,esc((m.branchIds||[]).map(id=>id==='main'?'Main Branch':(pmBranches.find(b=>b.id===id)?.name||id)).join(', ')||'All branches'),m.active===false?'<span class="pill red">Disabled</span>':'<span class="pill green">Active</span>',canManage?`<button class="mini-btn" data-staff-role="${m.uid}">Change role</button><button class="mini-btn text-danger" data-staff-remove="${m.uid}">Revoke</button>`:'—']));
 return `${pageHead('Staff & permissions','Invite existing Firebase users and assign role-based workspace access.',canManage?`<button class="btn btn-primary" data-staff-invite>Invite staff</button>`:'')}<div class="notice">Owner account: full access. Admin: manage business records and staff. Manager: sales, purchases, inventory and reports. Cashier: POS and customer records. Viewer: read-only access.</div><section class="panel table-panel"><div class="panel-head"><div><h3>Workspace members</h3><p>Staff invitations require the Cloud Functions deployment and an existing Firebase Auth account.</p></div></div>${table(['Staff email','Role','Branch access','Status','Action'],rows,'No staff members invited yet.')}</section>`;
}
function pmRenderAccounting(){
 const totals=pmJournalTotals(), assets=(totals.Cash||0)+(totals.Bank||0)+(totals.AccountsReceivable||0)+(totals.Inventory||0), liabilities=-(totals.AccountsPayable||0), equity=-(totals.Capital||0), revenue=-(totals.SalesRevenue||0), expenses=(totals.CostOfGoodsSold||0)+(totals.OperatingExpenses||0);
 const rows=pmJournal.slice().sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))).slice(0,100).map(j=>tr([esc(j.date||'—'),esc(j.reference||'Journal'),esc(j.description||''),money((j.lines||[]).reduce((n,l)=>n+num(l.debit),0)),`<span class="pill">${esc(j.status||'Posted')}</span>`]));
 return `${pageHead('Accounting & financial statements','Double-entry journal, account balances, trial balance and posted business transactions.',pmCanManageBusiness()?`<button class="btn btn-primary" data-journal-new>New journal entry</button>`:'')}<div class="metric-grid">${metric('Assets',money(assets),'Cash, bank, receivables & inventory','◈','blue')}${metric('Liabilities',money(liabilities),'Recorded payables','⇩','orange')}${metric('Revenue',money(revenue),'Posted sales revenue','↗','green')}${metric('Expenses',money(expenses),'COGS + operating expenses','▤','red')}</div><section class="panel"><div class="panel-head"><div><h3>Trial balance</h3><p>Debit-positive balances from posted journal entries.</p></div></div><div class="pm-account-grid">${['Cash','Bank','AccountsReceivable','Inventory','AccountsPayable','Capital','SalesRevenue','CostOfGoodsSold','OperatingExpenses'].map(a=>`<div class="pm-account"><small>${esc(a.replace(/([A-Z])/g,' $1'))}</small><b>${money(totals[a]||0)}</b></div>`).join('')}</div></section><section class="panel table-panel"><div class="panel-head"><div><h3>Journal entries</h3><p>Latest 100 posted entries</p></div><button class="btn btn-light" data-account-export>Export journal CSV</button></div>${table(['Date','Reference','Description','Debit total','Status'],rows,'No accounting entries yet.')}</section><div class="notice warning">Financial statements are based on journal entries created by this app after deployment. Historical records are not automatically converted into audited opening balances; opening balances must be entered through a balanced journal entry.</div>`;
}
const pmOriginalRenderCurrent=renderCurrent;
renderCurrent=function(){
 if(['pos','branches','team','accounting'].includes(activePage)){
  if(!currentUser||!db)return;updateAlertChrome();pmAddNav();
  $('pageContent').innerHTML=activePage==='pos'?pmRenderPOS():activePage==='branches'?pmRenderBranches():activePage==='team'?pmRenderTeam():pmRenderAccounting();$('syncStatus').textContent='Synced';return;
 }
 pmOriginalRenderCurrent();pmAddNav();
};
const pmOriginalNavigate=navigate;
navigate=function(page){pmOriginalNavigate(page);pmAddNav();};
function pmPaymentAccount(method){return ['Bank','JazzCash','Easypaisa'].includes(method)?method:'Cash';}
function pmJournalLines(entries){return entries.filter(x=>num(x.debit)||num(x.credit));}
async function pmPostJournal(description,reference,lines,branchId=pmActiveBranch){
 const valid=pmJournalLines(lines);const debit=valid.reduce((n,x)=>n+num(x.debit),0),credit=valid.reduce((n,x)=>n+num(x.credit),0);
 if(!valid.length||Math.abs(debit-credit)>0.005)throw new Error('Journal entry must have equal debit and credit totals.');
 await addDoc(pmCol('journal'),{date:today(),description,reference,branchId,lines:valid,status:'Posted',createdBy:uid(),createdAt:serverTimestamp()});
}
async function pmCheckout(){
 if(!pmCanSell())throw new Error('Your staff role does not have POS permission.');
 if(!pmCart.length)throw new Error('Add at least one product to the cart.');
 const customerId=$('pmCustomer')?.value||'',customer=findCustomer(customerId),discount=num($('pmDiscount')?.value),paid=num($('pmPaid')?.value),paymentMethod=$('pmPayment')?.value||'Cash';
 const subtotal=pmCart.reduce((n,x)=>n+x.qty*x.price,0),total=subtotal-discount;
 if(discount<0||discount>subtotal||paid<0||paid>total)throw new Error('Check discount and received amount.');
 const cart=pmCart.map(x=>({...x}));const saleRef=doc(pmCol('sales'));const journalRef=doc(pmCol('journal'));
 await runTransaction(db,async tx=>{
  const refs=cart.map(x=>docRef('products',x.productId));const snaps=[];for(const ref of refs)snaps.push(await tx.get(ref));
  const batchSnaps=[];for(const item of cart){const bq=query(batchCol(),where('productId','==',item.productId),orderBy('expiryDate','asc'));batchSnaps.push(await tx.get(bq));}
  const updates=[];let costTotal=0;const allocationsByProduct=[];
  snaps.forEach((snap,i)=>{
   if(!snap.exists())throw new Error(`${cart[i].name} no longer exists.`);
   const p=snap.data();if((p.branchId||'main')!==pmActiveBranch)throw new Error(`${cart[i].name} belongs to another branch.`);
   const stock=num(p.stock);if(stock<cart[i].qty)throw new Error(`Insufficient stock for ${cart[i].name}. Available ${stock}.`);
   const cost=num(p.costPrice);updates.push({ref:refs[i],stock:stock-cart[i].qty});
   const docs=batchSnaps[i].docs.filter(d=>num(d.data().quantityRemaining)>0 && safeDate(d.data().expiryDate)>=today());
   if(docs.length){let remaining=cart[i].qty;const allocations=[];for(const d of docs){if(!remaining)break;const available=num(d.data().quantityRemaining),take=Math.min(available,remaining);if(take>0){allocations.push({batchId:d.id,batch:d.data().batch||'',quantity:take,unitCost:num(d.data().unitCost)});remaining-=take;}}if(remaining>0)throw new Error(`Batch stock is short for ${cart[i].name}. Remaining unbatched stock is not used when valid batches exist.`);allocationsByProduct.push(allocations);}else{if(stock>0 && batchSnaps[i].empty) allocationsByProduct.push([{batchId:'LEGACY',batch:'Legacy stock',quantity:cart[i].qty,unitCost:cost}]);else if(batchSnaps[i].empty)allocationsByProduct.push([{batchId:'LEGACY',batch:'Legacy stock',quantity:cart[i].qty,unitCost:cost}]);else throw new Error(`No unexpired batch stock is available for ${cart[i].name}.`);}
   costTotal+=allocationsByProduct[i].reduce((n,a)=>n+a.quantity*num(a.unitCost),0);
  });
  updates.forEach(u=>tx.update(u.ref,{stock:u.stock,updatedAt:serverTimestamp()}));
  cart.forEach((item,i)=>{const docs=batchSnaps[i].docs;for(const allocation of allocationsByProduct[i]){if(allocation.batchId!=='LEGACY'){const snap=docs.find(d=>d.id===allocation.batchId);tx.update(snap.ref,{quantityRemaining:num(snap.data().quantityRemaining)-allocation.quantity,updatedAt:serverTimestamp()});}}});
  const items=cart.map((x,i)=>({productId:x.productId,name:x.name,sku:x.sku||'',quantity:x.qty,unitPrice:x.price,costPrice:allocationsByProduct[i].reduce((n,a)=>n+a.quantity*num(a.unitCost),0)/x.qty,discount:0,allocations:allocationsByProduct[i]}));
  const sale={invoiceNo:invoiceNo(),date:today(),branchId:pmActiveBranch,customerId,customerName:customer?.name||'Walk-in customer',customerPhone:customer?.phone||'',items,subtotal,discount,total,paid,paymentMethod,costTotal,profit:total-costTotal,status:paid>=total?'Paid':'Due',createdBy:uid(),createdAt:serverTimestamp(),updatedAt:serverTimestamp()};
  tx.set(saleRef,sale);
  cart.forEach((item,i)=>{const prior=num(snaps[i].data().stock);writeMovement(tx,{productId:item.productId,productName:item.name,type:'SALE_OUT',quantity:item.qty,before:prior,after:prior-item.qty,allocations:allocationsByProduct[i],reference:sale.invoiceNo,date:today(),branchId:pmActiveBranch});});
  const lines=[];if(paid)lines.push({account:pmPaymentAccount(paymentMethod),debit:paid,credit:0});if(total-paid)lines.push({account:'AccountsReceivable',debit:total-paid,credit:0});lines.push({account:'SalesRevenue',debit:0,credit:total});if(costTotal){lines.push({account:'CostOfGoodsSold',debit:costTotal,credit:0});lines.push({account:'Inventory',debit:0,credit:costTotal});}
  const balanced=lines.reduce((n,l)=>n+l.debit,0)-lines.reduce((n,l)=>n+l.credit,0);if(Math.abs(balanced)>0.01)throw new Error('Accounting validation failed.');
  tx.set(journalRef,{date:today(),description:`POS sale ${sale.invoiceNo}`,reference:sale.invoiceNo,branchId:pmActiveBranch,lines,status:'Posted',createdBy:uid(),createdAt:serverTimestamp()});
 });
 pmCart=[];toast('Multi-item sale completed. Open Sales & POS history to view or print the invoice.');renderCurrent();
}
function pmOpenBranchDialog(){
 const name=prompt('Enter branch name:');if(!name?.trim())return;const code=prompt('Branch code (optional):')||'';const address=prompt('Branch address (optional):')||'';
 addDoc(pmCol('branches'),{name:name.trim(),code,address,active:true,createdAt:serverTimestamp(),createdBy:uid()}).then(()=>toast('Branch created.')).catch(e=>toast(e.message,true));
}
async function pmInviteStaff(){
 const email=prompt('Staff Firebase Auth email (the user must already have an account):');if(!email?.trim())return;const role=prompt('Role: admin, manager, cashier, viewer','cashier')||'cashier';if(!['admin','manager','cashier','viewer'].includes(role))return toast('Invalid role.',true);const available=[{id:'main',name:'Main Branch'},...pmBranches];const branchText=prompt(`Allowed branch names (comma separated):\n${available.map(b=>b.name).join(', ')}`,pmBranchName())||pmBranchName();const branchIds=branchText.split(',').map(v=>available.find(b=>b.name.toLowerCase()===v.trim().toLowerCase())?.id).filter(Boolean);if(!branchIds.length)return toast('No valid branch names selected.',true);
 try{if(!pmFunctions)pmFunctions=getFunctions(undefined,'us-central1');const invite=httpsCallable(pmFunctions,'inviteStaff');await invite({email:email.trim(),role,branchIds});toast('Staff access granted. Ask the user to sign out and sign in again.');}catch(e){toast(e.message||'Staff invitation failed. Deploy Cloud Functions first.',true);}
}
async function pmRevokeStaff(targetUid){if(!confirm('Revoke this staff member access?'))return;try{if(!pmFunctions)pmFunctions=getFunctions(undefined,'us-central1');await httpsCallable(pmFunctions,'removeStaff')({targetUid});toast('Staff access revoked.');}catch(e){toast(e.message||'Could not revoke staff access.',true);}}
function pmJournalDialog(){
 const desc=prompt('Journal description:');if(!desc?.trim())return;const debitAccount=prompt('Debit account (e.g. Cash, Bank, Inventory, Capital):','Cash');const creditAccount=prompt('Credit account (e.g. Capital, AccountsPayable):','Capital');const amount=num(prompt('Amount (PKR):','0'));if(!debitAccount||!creditAccount||amount<=0)return toast('Enter valid journal details.',true);
 pmPostJournal(desc.trim(),'MANUAL-'+Date.now(),[{account:debitAccount.trim(),debit:amount,credit:0},{account:creditAccount.trim(),debit:0,credit:amount}]).then(()=>toast('Journal entry posted.')).catch(e=>toast(e.message,true));
}
function pmExportJournal(){downloadCSV('poultrymed-journal.csv',['Date','Reference','Description','Account','Debit','Credit'],pmJournal.flatMap(j=>(j.lines||[]).map(l=>[j.date,j.reference,j.description,l.account,l.debit,l.credit])));}
document.addEventListener('click',async e=>{
 const add=e.target.closest('[data-cart-add]');if(add){const p=getProduct(add.dataset.cartAdd);if(!p)return;const found=pmCart.find(x=>x.productId===p.id);if(found){if(found.qty>=num(p.stock))return toast('No more stock available.',true);found.qty++;}else pmCart.push({productId:p.id,name:p.name,sku:p.sku,qty:1,available:num(p.stock),price:num(p.salePrice),costPrice:num(p.costPrice),discount:0});renderCurrent();return;}
 const rm=e.target.closest('[data-cart-remove]');if(rm){pmCart.splice(Number(rm.dataset.cartRemove),1);renderCurrent();return;}
 if(e.target.closest('[data-cart-clear]')){pmCart=[];renderCurrent();return;}
 if(e.target.closest('[data-pos-checkout]')){try{await pmCheckout();}catch(err){toast(err.message||'Sale failed.',true);}return;}
 if(e.target.closest('[data-branch-new]')){pmOpenBranchDialog();return;}
 if(e.target.closest('[data-branch-migrate]')){try{if(!pmFunctions)pmFunctions=getFunctions(undefined,'us-central1');const result=await httpsCallable(pmFunctions,'initializeMainBranch')({});toast(`Main Branch tagging complete. Updated ${result.data.updated} records.`); }catch(err){toast(err.message||'Branch initialization failed.',true);}return;}
 const toggle=e.target.closest('[data-branch-toggle]');if(toggle){const b=pmBranches.find(x=>x.id===toggle.dataset.branchToggle);if(b)updateDoc(pmRef('branches',b.id),{active:b.active===false,updatedAt:serverTimestamp()}).then(()=>toast('Branch status updated.')).catch(x=>toast(x.message,true));return;}
 if(e.target.closest('[data-staff-invite]')){pmInviteStaff();return;}
 const roleBtn=e.target.closest('[data-staff-role]');if(roleBtn){const role=prompt('New role: admin, manager, cashier, viewer','cashier');if(role&&['admin','manager','cashier','viewer'].includes(role)){const available=[{id:'main',name:'Main Branch'},...pmBranches];const branchText=prompt(`Allowed branch names (comma separated):\n${available.map(b=>b.name).join(', ')}`,pmBranchName())||pmBranchName();const branchIds=branchText.split(',').map(v=>available.find(b=>b.name.toLowerCase()===v.trim().toLowerCase())?.id).filter(Boolean);if(!branchIds.length)return toast('No valid branch names selected.',true);try{if(!pmFunctions)pmFunctions=getFunctions(undefined,'us-central1');await httpsCallable(pmFunctions,'updateStaffRole')({targetUid:roleBtn.dataset.staffRole,role,branchIds});toast('Staff role updated. Ask them to sign out and sign in again.');}catch(err){toast(err.message,true);}}return;}
 const revoke=e.target.closest('[data-staff-remove]');if(revoke){pmRevokeStaff(revoke.dataset.staffRemove);return;}
 if(e.target.closest('[data-journal-new]')){pmJournalDialog();return;}
 if(e.target.closest('[data-account-export]')){pmExportJournal();return;}
});
document.addEventListener('change',e=>{
 if(e.target.id==='pmBranchSelect'){if(pmAllowedBranches&&!pmAllowedBranches.includes(e.target.value)){toast('You do not have access to this branch.',true);renderCurrent();return;}pmActiveBranch=e.target.value;pmCart=[];renderCurrent();return;}
 const q=e.target.closest('[data-cart-qty]');if(q){const i=Number(q.dataset.cartQty),x=pmCart[i];if(x){const v=Math.floor(num(q.value));if(v<1||v>x.available){toast(`Quantity must be between 1 and ${x.available}.`,true);renderCurrent();}else{x.qty=v;renderCurrent();}}return;}
 const p=e.target.closest('[data-cart-price]');if(p){const i=Number(p.dataset.cartPrice),x=pmCart[i];if(x){const v=num(p.value);if(v<0){toast('Price cannot be negative.',true);renderCurrent();}else{x.price=v;renderCurrent();}}}
});
document.addEventListener('input',e=>{if(e.target.id==='pmDiscount'||e.target.id==='pmPaid'){const subtotal=pmCart.reduce((n,x)=>n+x.qty*x.price,0),discount=Math.min(subtotal,Math.max(0,num($('pmDiscount')?.value))),total=subtotal-discount;if($('pmDiscountView'))$('pmDiscountView').textContent=money(discount);if($('pmGrandTotal'))$('pmGrandTotal').textContent=money(total);}});
setTimeout(pmAddNav,0);
