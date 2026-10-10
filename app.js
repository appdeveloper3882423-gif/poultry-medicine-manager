/* Poultry Medicine Manager — browser-based Firebase business manager.
   Setup: paste your Firebase Web App config into FIREBASE_CONFIG below. */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, sendPasswordResetEmail, updateProfile, signOut, setPersistence, browserLocalPersistence } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, collection, onSnapshot, serverTimestamp, runTransaction, query, orderBy, where } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

const FIREBASE_CONFIG = {
  // IMPORTANT: In Firebase Console -> Project settings -> General -> Your apps,
  // copy the Web App config for poultry-medicine-manager-93b79 and paste exact values here.
  apiKey: 'AIzaSyCkyj91iDkxfyFq3ErGucMykxB6h0trplM',
  authDomain: 'poultry-medicine-manager-93b79.firebaseapp.com',
  projectId: 'poultry-medicine-manager-93b79',
  storageBucket: 'poultry-medicine-manager-93b79.firebasestorage.app',
  messagingSenderId: '623127969077',
  appId: '1:623127969077:web:e7e4b8a2e25fc4e249607c'
};

const configReady = FIREBASE_CONFIG.apiKey && !FIREBASE_CONFIG.apiKey.includes('PASTE_') && FIREBASE_CONFIG.projectId && FIREBASE_CONFIG.projectId !== 'YOUR_PROJECT_ID' && FIREBASE_CONFIG.appId && !FIREBASE_CONFIG.appId.includes('PASTE_');
let auth = null, db = null, currentUser = null, business = { name: 'Poultry Medicine Manager', type: 'general', currency: 'PKR', timezone: 'Asia/Karachi' };
let unsubs = [], authMode = 'login', activePage = 'dashboard', searchText = '', toastTimer = null, chartRange = 30, copilotMessages = [], copilotBusy = false, inventoryFilter = 'all';
const rangeLabels = {7:'1W',30:'1M',90:'3M',180:'6M',365:'1Y'};
const data = { products: [], sales: [], purchases: [], customers: [], suppliers: [], expenses: [], deliveries: [], returns: [], ledger: [] };
const pageNames = { dashboard: 'Dashboard', inventory: 'Medicine Stock', sales: 'Sales & POS', purchases: 'Purchases', ledger: 'Ledger', customers: 'Customers & Khata', suppliers: 'Suppliers', expenses: 'Expenses', deliveries: 'Deliveries', returns: 'Returns', reports: 'Reports', settings: 'Settings', copilot: 'AI Business Copilot' };
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const num = value => Number(value || 0);
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const money = value => { try { return new Intl.NumberFormat('en-PK',{style:'currency',currency:business.currency || 'PKR',maximumFractionDigits:2}).format(num(value)); } catch { return `${business.currency || 'PKR'} ${num(value).toFixed(2)}`; } };
const uid = () => currentUser?.uid;
const storedCollection = name => name === 'products' ? 'inventory' : name; // keep the existing users/{uid}/inventory records
const col = name => collection(db, 'users', uid(), storedCollection(name));
const docRef = (name, id) => doc(db, 'users', uid(), storedCollection(name), id);
const sum = (items, field) => items.reduce((n, x) => n + num(x[field]), 0);
const dateOf = x => { if (x?.date) return String(x.date).slice(0,10); const c=x?.createdAt; if (typeof c==='string') return c.slice(0,10); if (c?.toDate) return c.toDate().toISOString().slice(0,10); if (c?.seconds) return new Date(c.seconds*1000).toISOString().slice(0,10); return ''; };
const invoiceNo = () => `PMM-${Date.now().toString().slice(-8)}-${Math.random().toString(36).slice(2,5).toUpperCase()}`;

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
    const q = col(name); // include legacy records that do not have createdAt yet
    const unsub = onSnapshot(q, snap => {
      data[name] = snap.docs.map(d => normalizeLegacyRecord(name, d.data(), d.id));
      $('syncStatus').textContent = 'Synced just now';
      renderCurrent(); updateAlertChrome();
    }, err => {
      // Legacy documents may not contain createdAt; fall back to a full collection read.
      if (err.code === 'failed-precondition' || err.code === 'invalid-argument') {
        const fallback = onSnapshot(col(name), fallbackSnap => {
          data[name] = fallbackSnap.docs.map(d => normalizeLegacyRecord(name, d.data(), d.id));
          $('syncStatus').textContent = 'Synced'; renderCurrent(); updateAlertChrome();
        }, fallbackErr => { console.error(fallbackErr); toast(`Could not load ${name}: ${fallbackErr.message}`, true); });
        unsubs.push(fallback);
      } else { console.error(err); toast(`Could not load ${name}: ${err.message}`, true); }
    });
    unsubs.push(unsub);
  });
}
async function add(name, payload) { requireConfig(); return addDoc(col(name), { ...payload, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }); }
async function update(name, id, payload) { return updateDoc(docRef(name,id), { ...payload, updatedAt: serverTimestamp() }); }
async function remove(name,id) { return deleteDoc(docRef(name,id)); }

function updateAlertChrome() {
  const low = data.products.filter(p => num(p.stock) <= num(p.reorderLevel));
  const expiredOrSoon = data.products.filter(p => p.expiryDate && (new Date(`${p.expiryDate}T23:59:59`).getTime() - Date.now()) <= 30*86400000);
  $('lowStockBadge').textContent = low.length; $('lowStockBadge').classList.toggle('hidden', !low.length);
  $('alertDot').classList.toggle('hidden', !(low.length || expiredOrSoon.length));
  const alerts = [];
  low.slice(0,5).forEach(p => alerts.push(`<div class="alert-row"><span class="alert-symbol red">!</span><div><b>${esc(p.name)} — low stock</b><small>${num(p.stock)} ${esc(p.unit || 'units')} left; alert at ${num(p.reorderLevel)}.</small></div></div>`));
  expiredOrSoon.slice(0,5).forEach(p => { const days = Math.ceil((new Date(`${p.expiryDate}T23:59:59`).getTime()-Date.now())/86400000); alerts.push(`<div class="alert-row"><span class="alert-symbol ${days < 0 ? 'red' : ''}">⌛</span><div><b>${esc(p.name)} — ${days < 0 ? 'expiry date passed' : 'expiry approaching'}</b><small>Expiry date: ${esc(p.expiryDate)}${days >= 0 ? ` (${days} days)` : ''}.</small></div></div>`); });
  $('alertStrip').innerHTML = alerts.length ? `<div class="notice warning">Stock and expiry alerts are based on the dates and quantities entered in your workspace.</div>` : '';
  $('alertStrip').classList.toggle('hidden', !alerts.length);
}
function navigate(page) {
  activePage = page; document.querySelectorAll('.nav-link[data-page]').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  $('pageTitle').textContent = pageNames[page] || 'Dashboard'; $('breadcrumbTitle').textContent = pageNames[page] || 'Dashboard';
  $('sidebar').classList.remove('open'); $('scrim').classList.add('hidden'); renderCurrent();
}
function pageHead(title, desc, actions = '') { return `<div class="page-heading"><div><h2>${title}</h2><p>${desc}</p></div><div class="heading-actions">${actions}</div></div>`; }
function button(label, action, cls = 'btn btn-primary', icon = '+') { return `<button class="${cls}" data-action="${action}"><span>${icon}</span>${label}</button>`; }
function metric(label, value, foot, icon, tone = '', action = '') { return `<article class="metric-card ${action?'metric-clickable':''}" ${action?`role="button" tabindex="0" data-alert-filter="${action}" title="Click to view records"`:''}><div class="metric-top"><span class="metric-icon ${tone}">${icon}</span><span class="metric-trend">${action?'View details →':'Live totals'}</span></div><span class="metric-label">${label}</span><strong class="metric-value">${value}</strong><small class="metric-foot">${foot}</small></article>`; }
function table(headers, rows, empty = 'No records yet.') {
  if (!rows.length) return `<div class="empty-state"><strong>Nothing here yet</strong>${esc(empty)}</div>`;
  return `<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
}
function tr(cells) { return `<tr>${cells.map(c=>`<td>${c ?? '—'}</td>`).join('')}</tr>`; }
function productName(id) { return data.products.find(p=>p.id===id)?.name || 'Deleted product'; }
function filterItems(items, fields) { const s = searchText.trim().toLowerCase(); return !s ? items : items.filter(item => fields.some(f => String(item[f] ?? '').toLowerCase().includes(s))); }
function currentSales() { return data.sales.filter(s => dateOf(s) === today()); }
function netProfit() { return sum(data.sales,'profit') - sum(data.expenses,'amount') - sum(data.returns,'profitLoss'); }
function salesThisMonth() { const month = today().slice(0,7); return data.sales.filter(s => dateOf(s).startsWith(month)); }
function chartSeries(days = chartRange) {
  const now = new Date(); now.setHours(0,0,0,0);
  const rows = [];
  for (let i=days-1;i>=0;i--) {
    const d = new Date(now); d.setDate(now.getDate()-i);
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
  const grid=[0,1,2,3].map(i=>{const yy=T+ih*i/3;return `<line x1="${L}" y1="${yy}" x2="${W-R}" y2="${yy}" stroke="#24334b" stroke-dasharray="4 7"/><text x="${L+2}" y="${yy-5}" fill="#70829f" font-size="10">${esc(money(max*(1-i/3)))}</text>`}).join('');
  const dots=rows.map((r,i)=>`<circle class="trade-point" cx="${x(i).toFixed(1)}" cy="${y(r.value).toFixed(1)}" r="${rows.length<=31?3.2:1.8}" fill="#5aa8ff"><title>${esc(r.label)} · ${esc(money(r.value))}</title></circle>`).join('');
  const labelIndices=[0,Math.floor((rows.length-1)/3),Math.floor((rows.length-1)*2/3),rows.length-1].filter((v,i,a)=>a.indexOf(v)===i);
  const labels=labelIndices.map(i=>`<text x="${x(i)}" y="${H-9}" fill="#8292ad" font-size="10" text-anchor="${i===0?'start':i===rows.length-1?'end':'middle'}">${esc(rows[i].label)}</text>`).join('');
  const total=rows.reduce((n,r)=>n+r.value,0), previous=data.sales.filter(s=>{const d=dateOf(s);if(!d)return false;const dt=new Date(`${d}T00:00:00`);const now=new Date();now.setHours(0,0,0,0);return dt>=new Date(now.getTime()-(chartRange*2)*86400000)&&dt<new Date(now.getTime()-chartRange*86400000)}).reduce((n,s)=>n+num(s.total),0);
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
  const rows = items.map(s=>tr([`<span class="td-strong">${esc(s.invoiceNo)}</span>`,esc(s.customerName||'Walk-in'),esc(s.customerPhone||'—'),esc(dateOf(s)),(s.items||[]).map(i=>`<span class="td-strong">${esc(i.name||productName(i.productId))}</span> × ${num(i.quantity)}`).join('<br>'),money(s.total),money(s.paid),money(Math.max(0,num(s.total)-num(s.paid))),`<button class="mini-btn" data-action="view-sale" data-id="${s.id}">Details</button>`]));
  return `${pageHead('Sales & POS','Create multi-item invoices and track payments, stock movement and margins.',button('New sale','new-sale','btn btn-primary','＋'))}<div class="metric-grid">${metric('Total sales',money(sum(data.sales,'total')),'All recorded invoices','↗')}${metric('Collected',money(sum(data.sales,'paid')),'Payments recorded','✓','blue')}${metric('Customer dues',money(data.sales.reduce((n,s)=>n+Math.max(0,num(s.total)-num(s.paid)),0)),'Unpaid invoice balances','◷','orange')}${metric('Gross margin',money(sum(data.sales,'profit')),'Based on stored item costs','◈','purple')}</div><section class="panel table-panel"><div class="panel-head"><div><h3>Sales history</h3><p>Each sale adjusts stock using a Firestore transaction.</p></div><div class="table-tools"><input data-search placeholder="Search invoices…" value="${esc(searchText)}"><button class="btn btn-light" data-action="export-sales">Export CSV</button></div></div>${table(['Invoice','Customer name','Contact number','Date','Product name / quantity','Total','Paid','Due',''],rows,'No sales recorded yet.')}</section>`;
}
function renderPurchases() {
  const items = filterItems(data.purchases,['supplierName','supplierPhone','reference']);
  const rows = items.map(p=>tr([esc(p.reference||'Purchase'),esc(p.supplierName||'Supplier'),esc(p.supplierPhone||'—'),esc(dateOf(p)),(p.items||[]).map(i=>`${esc(i.name)} × ${num(i.quantity)}`).join('<br>'),money(p.total),esc(p.paymentStatus||'Recorded')]));
  return `${pageHead('Purchases','Record stock received from suppliers and update inventory automatically.',button('Record purchase','new-purchase','btn btn-primary','＋'))}<div class="metric-grid">${metric('Purchase total',money(sum(data.purchases,'total')),'All recorded purchases','⇩')}${metric('Purchase entries',data.purchases.length,'Stock-in transactions','▤','blue')}${metric('Products stocked',new Set(data.purchases.flatMap(p=>(p.items||[]).map(i=>i.productId))).size,'Unique products purchased','◈','purple')}${metric('Supplier records',data.suppliers.length,'Saved suppliers','♧','orange')}</div><section class="panel table-panel"><div class="panel-head"><div><h3>Purchase history</h3><p>Stock quantities increase after a successful purchase.</p></div><div class="table-tools"><input data-search placeholder="Search purchases…" value="${esc(searchText)}"><button class="btn btn-light" data-action="export-purchases">Export CSV</button></div></div>${table(['Reference','Supplier','Supplier contact number','Date','Product name / quantity','Total','Status'],rows,'No purchases recorded yet.')}</section>`;
}
function renderContacts(type) {
  const isCustomer = type==='customers', name = isCustomer?'Customer':'Supplier', items = filterItems(data[type],['name','phone','email']);
  const rows = items.map(x=>tr([`<span class="td-strong">${esc(x.name)}</span>`,esc(x.phone||'—'),esc(x.email||'—'),money(x.openingBalance),esc(x.address||'—'),`<div class="row-actions"><button class="mini-btn" data-action="edit" data-type="${type.slice(0,-1)}" data-id="${x.id}">Edit</button><button class="mini-btn text-danger" data-action="delete" data-type="${type.slice(0,-1)}" data-id="${x.id}">Delete</button></div>`]));
  return `${pageHead(isCustomer?'Customers & Khata':'Suppliers',isCustomer?'Keep customer contact details and opening balances for your khata.':'Maintain supplier contacts and opening balances.',button(`Add ${name.toLowerCase()}`,'new-'+(isCustomer?'customer':'supplier'),'btn btn-primary','＋'))}<div class="metric-grid">${metric(`${name}s`,items.length,'Saved contacts','♙')}${metric('Opening balances',money(sum(items,'openingBalance')),'Balances entered manually','◈','blue')}${metric('With phone',items.filter(x=>x.phone).length,'Contact details available','☎','purple')}${metric('With email',items.filter(x=>x.email).length,'Email addresses saved','✉','orange')}</div><section class="panel table-panel"><div class="panel-head"><div><h3>${name} directory</h3><p>Search and edit saved contact details.</p></div><div class="table-tools"><input data-search placeholder="Search ${name.toLowerCase()}s…" value="${esc(searchText)}"><button class="btn btn-light" data-action="export-${type}">Export CSV</button></div></div>${table([name,isCustomer?'Contact number':'Supplier contact number','Email','Opening balance','Address','Actions'],rows,`No ${name.toLowerCase()} records yet.`)}</section>`;
}
function renderExpenses() {
  const items = filterItems(data.expenses,['title','category','note']);
  const rows = items.map(x=>tr([`<span class="td-strong">${esc(x.title)}</span>`,esc(x.category||'Other'),esc(dateOf(x)),esc(x.note||'—'),money(x.amount),`<div class="row-actions"><button class="mini-btn" data-action="edit" data-type="expense" data-id="${x.id}">Edit</button><button class="mini-btn text-danger" data-action="delete" data-type="expense" data-id="${x.id}">Delete</button></div>`]));
  return `${pageHead('Expenses','Record rent, salaries, utilities, transport and other operating costs.',button('Add expense','new-expense','btn btn-primary','＋'))}<div class="metric-grid">${metric('Total expenses',money(sum(data.expenses,'amount')),'All saved expenses','↗','orange')}${metric('This month',money(data.expenses.filter(x=>dateOf(x).startsWith(today().slice(0,7))).reduce((n,x)=>n+num(x.amount),0)),'Expenses this month','◷','blue')}${metric('Expense entries',items.length,'Saved records','▤')}${metric('Net estimate',money(netProfit()),'Sales profit less expenses and returns','◈','purple')}</div><section class="panel table-panel"><div class="panel-head"><div><h3>Expense ledger</h3><p>Expenses reduce the estimated net profit.</p></div><div class="table-tools"><input data-search placeholder="Search expenses…" value="${esc(searchText)}"><button class="btn btn-light" data-action="export-expenses">Export CSV</button></div></div>${table(['Expense','Category','Date','Note','Amount','Actions'],rows,'No expenses recorded yet.')}</section>`;
}
function renderDeliveries() {
  const items = filterItems(data.deliveries,['customerName','details','salesperson','status']);
  const rows = items.map(d=>tr([`<span class="td-strong">${esc(d.customerName)}</span>`,esc(d.details),esc(d.salesperson),esc(dateOf(d)),`<span class="pill ${d.status==='Delivered'?'green':d.status==='Failed'?'red':'orange'}">${esc(d.status||'Pending')}</span>`,`<div class="row-actions"><button class="mini-btn" data-action="edit" data-type="delivery" data-id="${d.id}">Edit</button><button class="mini-btn text-danger" data-action="delete" data-type="delivery" data-id="${d.id}">Delete</button></div>`]));
  return `${pageHead('Deliveries','Track which products and quantities were sent, by whom and on what date.',button('Add delivery','new-delivery','btn btn-primary','＋'))}<div class="metric-grid">${metric('All deliveries',data.deliveries.length,'Delivery records','⇢')}${metric('Pending',data.deliveries.filter(d=>d.status==='Pending').length,'Awaiting dispatch','◷','orange')}${metric('Dispatched',data.deliveries.filter(d=>d.status==='Dispatched').length,'On the way','⇢','blue')}${metric('Delivered',data.deliveries.filter(d=>d.status==='Delivered').length,'Marked complete','✓')}</div><section class="panel table-panel"><div class="panel-head"><div><h3>Delivery register</h3><p>Record customer, item details, salesperson and delivery status.</p></div><div class="table-tools"><input data-search placeholder="Search deliveries…" value="${esc(searchText)}"><button class="btn btn-light" data-action="export-deliveries">Export CSV</button></div></div>${table(['Customer','Items / quantity','Salesperson','Date','Status','Actions'],rows,'No deliveries recorded yet.')}</section>`;
}
function renderReturns() {
  const rows = filterItems(data.returns,['invoiceNo','customerName','reason']).map(r=>tr([esc(r.invoiceNo||'—'),esc(r.customerName||'—'),esc(dateOf(r)),esc(r.items?.map(i=>`${i.name} × ${i.quantity}`).join(', ')||'—'),money(r.amount),money(r.profitLoss),esc(r.reason||'—')]));
  return `${pageHead('Returns & refunds','Record returned items and refund amounts. Returned quantities are added back to stock.',button('Record return','new-return','btn btn-primary','＋'))}<div class="metric-grid">${metric('Return records',data.returns.length,'Saved return transactions','↶','orange')}${metric('Refund amount',money(sum(data.returns,'amount')),'Recorded refund values','↗','red')}${metric('Profit adjustment',money(sum(data.returns,'profitLoss')),'Return margin reversal','◈','purple')}${metric('Net estimate',money(netProfit()),'After expenses and returns','▤','blue')}</div><section class="panel table-panel"><div class="panel-head"><div><h3>Returns history</h3><p>For audit accuracy, the return is stored separately from the original sale.</p></div><div class="table-tools"><input data-search placeholder="Search returns…" value="${esc(searchText)}"><button class="btn btn-light" data-action="export-returns">Export CSV</button></div></div>${table(['Invoice','Customer','Date','Returned items','Refund','Profit adjustment','Reason'],rows,'No returns recorded yet.')}</section>`;
}
function renderLedger() {
  const rows = [];
  data.sales.forEach(s => rows.push({date:dateOf(s), type:'Sale', reference:s.invoiceNo||'Sale', party:s.customerName||'Walk-in', details:(s.items||[]).map(i=>`${i.name||productName(i.productId)} × ${num(i.quantity)}`).join(', '), incoming:num(s.paid), outgoing:0, note:num(s.total)>num(s.paid)?`Outstanding due ${money(num(s.total)-num(s.paid))}`:''}));
  data.purchases.forEach(p => rows.push({date:dateOf(p), type:'Purchase', reference:p.reference||'Purchase', party:p.supplierName||'Supplier', details:(p.items||[]).map(i=>`${i.name||productName(i.productId)} × ${num(i.quantity)}`).join(', '), incoming:0, outgoing:num(p.paid), note:num(p.total)>num(p.paid)?`Supplier balance ${money(num(p.total)-num(p.paid))}`:''}));
  data.expenses.forEach(x => rows.push({date:dateOf(x), type:'Expense', reference:x.title||'Expense', party:x.category||'Business', details:x.note||'', incoming:0, outgoing:num(x.amount), note:''}));
  data.returns.forEach(x => rows.push({date:dateOf(x), type:'Return / refund', reference:x.invoiceNo||'Return', party:x.customerName||'Customer', details:(x.items||[]).map(i=>`${i.name||productName(i.productId)} × ${num(i.quantity)}`).join(', '), incoming:0, outgoing:num(x.amount), note:x.reason||''}));
  data.ledger.filter(x=>x.type==='customer_due').forEach(x => rows.push({date:dateOf(x),type:'Customer due',reference:x.note||'Outstanding',party:x.customerName||'Customer',details:'Credit sale outstanding; not cash received',incoming:0,outgoing:0,note:`Receivable ${money(x.amount)}`}));
  rows.sort((a,b)=>(a.date||'').localeCompare(b.date||''));
  let balance=0;
  rows.forEach(x=>{balance+=x.incoming-x.outgoing;x.balance=balance;});
  const q=searchText.trim().toLowerCase();
  const tableRows=rows.filter(x=>!q||[x.date,x.type,x.reference,x.party,x.details,x.note].join(' ').toLowerCase().includes(q)).map(x=>tr([esc(x.date||'—'),`<span class="pill ${x.type==='Sale'?'green':x.type==='Purchase'||x.type==='Expense'||x.type==='Return / refund'?'orange':'blue'}">${esc(x.type)}</span>`,esc(x.reference),esc(x.party),esc(x.details||'—'),money(x.incoming),money(x.outgoing),`<b>${money(x.balance)}</b>`,esc(x.note||'—')]));
  const cashIn=rows.reduce((n,x)=>n+x.incoming,0), cashOut=rows.reduce((n,x)=>n+x.outgoing,0), due=data.sales.reduce((n,x)=>n+Math.max(0,num(x.total)-num(x.paid)),0), supplierDue=data.purchases.reduce((n,x)=>n+Math.max(0,num(x.total)-num(x.paid)),0);
  return `${pageHead('Ledger','A date-wise register of cash received, payments, purchases, expenses and outstanding balances.',`<button class="btn btn-light" data-action="export-ledger">Export ledger CSV</button>`)}<div class="metric-grid">${metric('Cash received',money(cashIn),'Recorded customer payments','↗','blue')}${metric('Cash paid',money(cashOut),'Purchases, expenses and refunds','↘','orange')}${metric('Cash balance',money(cashIn-cashOut),'Cash in minus cash out','◈','purple')}${metric('Outstanding sales',money(due),`Supplier balances: ${money(supplierDue)}`,'◷')}</div><section class="panel table-panel section-gap"><div class="panel-head"><div><h3>Transaction ledger</h3><p>Balance is calculated from recorded payments, not unpaid invoice totals.</p></div><div class="table-tools"><input data-search placeholder="Search ledger…" value="${esc(searchText)}"></div></div>${table(['Date','Type','Reference','Customer / supplier','Product / details','Money in','Money out','Running balance','Notes'],tableRows,'No transactions recorded yet.')}</section>`;
}

function renderReports() {
  const totalSales = sum(data.sales,'total'), gross = sum(data.sales,'profit'), expenses = sum(data.expenses,'amount'), refunds = sum(data.returns,'amount');
  const products = data.products.slice().sort((a,b)=>num(b.stock)*num(b.costPrice)-num(a.stock)*num(a.costPrice));
  const productRows = products.map(p=>tr([esc(p.name),`${num(p.stock)} ${esc(p.unit||'units')}`,money(p.costPrice),money(num(p.stock)*num(p.costPrice))]));
  return `${pageHead('Reports & insights','Export your records and review sales, margins, expenses and stock value.',`<button class="btn btn-light" data-action="export-all">Export business CSVs</button>`)}<div class="metric-grid">${metric('Sales revenue',money(totalSales),'All recorded sales','↗')}${metric('Gross profit',money(gross),'Sales margin before expenses','◈','blue')}${metric('Operating expenses',money(expenses),'Saved expense records','↘','orange')}${metric('Net estimate',money(gross-expenses-sum(data.returns,'profitLoss')),'Profit − expenses − return margin','▥','purple')}</div><div class="report-grid"><section class="panel"><div class="panel-head"><div><h3>Financial summary</h3><p>Based on the transactions recorded in Poultry Medicine Manager.</p></div></div><div class="report-total">${money(totalSales)}</div><div class="report-sub">Total sales revenue</div><div class="progress-track"><span style="width:${totalSales?Math.min(100,gross/totalSales*100):0}%"></span></div><p class="report-sub">Gross margin: ${totalSales?(gross/totalSales*100).toFixed(1):'0.0'}% of sales · Expenses: ${money(expenses)} · Refunds: ${money(refunds)}</p><div class="notice info">This is a management estimate, not a tax filing or audited accounting statement. Accuracy depends on complete and correct records.</div><button class="btn btn-primary" data-action="export-sales">Export sales CSV</button></section><section class="panel"><div class="panel-head"><div><h3>Sales by month</h3><p>Last six calendar months</p></div></div>${tradingChart()}</section></div><section class="panel table-panel section-gap"><div class="panel-head"><div><h3>Inventory valuation</h3><p>Current stock × recorded purchase cost.</p></div><button class="btn btn-light" data-action="export-products">Export inventory</button></div>${table(['Product','Quantity on hand','Unit cost','Stock value'],productRows,'No inventory to value.')}</section>`;
}
function renderSettings() {
  return `${pageHead('Settings','Update business preferences and export a copy of your records.')}<div class="settings-grid"><section class="panel"><div class="panel-head"><div><h3>Business preferences</h3><p>These settings are saved to this business workspace.</p></div></div><form id="settingsForm" class="settings-form"><label class="field-label full-field">Business name<input class="field-control" name="name" value="${esc(business.name||'')}" required></label><label class="field-label">Business type<select class="field-control" name="type"><option value="general" ${business.type==='general'?'selected':''}>Poultry medicine store</option><option value="medical" ${business.type==='medical'?'selected':''}>Poultry medicine distributor</option><option value="wholesale" ${business.type==='wholesale'?'selected':''}>Poultry wholesale / distribution</option></select></label><label class="field-label">Currency<select class="field-control" name="currency">${[['PKR','PKR — Pakistani Rupee'],['USD','USD — US Dollar'],['GBP','GBP — Pound Sterling'],['EUR','EUR — Euro'],['AED','AED — UAE Dirham'],['SAR','SAR — Saudi Riyal']].map(([v,l])=>`<option value="${v}" ${business.currency===v?'selected':''}>${l}</option>`).join('')}</select></label><label class="field-label full-field">Timezone<input class="field-control" name="timezone" value="${esc(business.timezone||'Asia/Karachi')}" placeholder="Asia/Karachi"></label><div class="full-field"><button class="btn btn-primary" type="submit">Save preferences</button></div></form></section><section class="panel"><div class="panel-head"><div><h3>Account & data</h3><p>Your sign-in and workspace information.</p></div></div><div class="account-card"><span class="account-avatar">${esc((currentUser?.displayName||currentUser?.email||'U').slice(0,1).toUpperCase())}</span><div><b>${esc(currentUser?.displayName||'Poultry Medicine Manager user')}</b><small>${esc(currentUser?.email||'')}</small></div></div><div class="notice info">Each signed-in account has its own business path in Firestore. Keep your Firebase security rules enabled before entering real business data.</div><div class="notice warning">Before using this for critical business records, configure Firebase backups and test your accounting workflow. Client-side code is not a substitute for server-side validation or a professional audit.</div><div class="heading-actions"><button class="btn btn-light" data-action="export-all">Export CSV backups</button><button class="btn btn-light" data-action="logout">Log out</button></div></section></div>`;
}
function renderCopilot() {
  const messages = copilotMessages.map(m=>`<div class="copilot-message ${m.role==='user'?'user-message':'assistant-message'}"><div class="copilot-avatar">${m.role==='user'?'U':'✦'}</div><div class="copilot-bubble"><small>${m.role==='user'?'YOU':'POULTRY MEDICINE MANAGER COPILOT'}</small><div>${esc(m.text).replace(/\n/g,'<br>')}</div></div></div>`).join('');
  return `${pageHead('AI Business Copilot','Ask questions about your recorded sales, stock, customer dues and expenses. The Copilot can analyse records but will not change them.', '<span class="pill blue">Read-only AI</span>')}<div class="copilot-layout"><section class="copilot-main"><div class="copilot-banner"><div class="copilot-orb">✦</div><div><span class="trade-kicker">YOUR BUSINESS, EXPLAINED</span><h2>Make the next decision with clarity.</h2><p>Get practical answers grounded in your workspace records—not made-up figures.</p></div></div><div id="copilotMessages" class="copilot-messages">${messages||'<div class="copilot-welcome"><div class="copilot-welcome-icon">✦</div><h3>What would you like to know?</h3><p>Choose a prompt or ask a question in your own words.</p><div class="copilot-prompts"><button data-copilot-prompt="Summarise my business performance and profit based on the records available.">📈 Summarise performance</button><button data-copilot-prompt="Which products need restocking and why? Use my current stock levels.">📦 Stock recommendations</button><button data-copilot-prompt="Review my customer outstanding balances and suggest a sensible follow-up order.">👥 Customer dues</button><button data-copilot-prompt="Analyse my expenses and point out practical areas to review.">💸 Expense review</button></div></div>'}</div><form id="copilotForm" class="copilot-form"><textarea id="copilotInput" rows="2" maxlength="1500" placeholder="Ask about sales, profit, stock, expenses…" required></textarea><button id="copilotSend" class="btn btn-primary" type="submit" ${copilotBusy?'disabled':''}>${copilotBusy?'Thinking…':'Ask Copilot'} <span>↑</span></button></form><div class="copilot-disclaimer">AI responses can be wrong. Verify important accounting decisions. Copilot is read-only and never edits your records.</div></section><aside class="copilot-side"><section class="panel"><div class="panel-head"><div><h3>Live workspace snapshot</h3><p>Calculated from currently synced records</p></div><span class="pill blue">LIVE</span></div><div class="copilot-stat"><span>Sales recorded</span><b>${esc(money(sum(data.sales,'total')))}</b></div><div class="copilot-stat"><span>Gross profit recorded</span><b>${esc(money(sum(data.sales,'profit')))}</b></div><div class="copilot-stat"><span>Expenses</span><b>${esc(money(sum(data.expenses,'amount')))}</b></div><div class="copilot-stat"><span>Products at/below reorder level</span><b>${data.products.filter(p=>num(p.stock)<=num(p.reorderLevel)).length}</b></div><div class="copilot-stat"><span>Outstanding sales balance</span><b>${esc(money(data.sales.reduce((n,s)=>n+Math.max(0,num(s.total)-num(s.paid)),0)))}</b></div><div class="notice info">Snapshot uses the records loaded in this signed-in workspace. Missing or incorrect entries affect the analysis.</div></section></aside></div>`;
}
function renderCurrent() {
  if (!currentUser) return;
  const renderer = { dashboard:renderDashboard, inventory:renderInventory, sales:renderSales, purchases:renderPurchases, ledger:renderLedger, customers:()=>renderContacts('customers'), suppliers:()=>renderContacts('suppliers'), expenses:renderExpenses, deliveries:renderDeliveries, returns:renderReturns, reports:renderReports, settings:renderSettings, copilot:renderCopilot }[activePage];
  $('pageContent').innerHTML = renderer ? renderer() : renderDashboard();
}

const field = (name,label,type='text',opts={}) => ({name,label,type,...opts});
function makeField(f, value = '') {
  const v = value ?? ''; const cls = f.wide ? 'wide-field' : '';
  let input = '';
  if (f.type === 'select') input = `<select name="${f.name}" ${f.required===false?'':'required'}>${(f.options||[]).map(o=>{const val=typeof o==='string'?o:o.value, lab=typeof o==='string'?o:o.label; return `<option value="${esc(val)}" ${String(v)===String(val)?'selected':''}>${esc(lab)}</option>`;}).join('')}</select>`;
  else if (f.type === 'textarea') input = `<textarea name="${f.name}" placeholder="${esc(f.placeholder||'')}" ${f.required===false?'':'required'}>${esc(v)}</textarea>`;
  else input = `<input name="${f.name}" ${f.name==='supplierName'?'list="savedSuppliersList" autocomplete="off"':''} type="${f.type||'text'}" value="${esc(v)}" placeholder="${esc(f.placeholder||'')}" ${f.min!==undefined?`min="${f.min}"`:''} ${f.step?`step="${f.step}"`:''} ${f.required===false?'':'required'} ${f.maxLength?`maxlength="${f.maxLength}"`:''}>`;
  if(f.name==='supplierName') input += `<datalist id="savedSuppliersList">${data.suppliers.map(x=>`<option value="${esc(x.name)}"></option>`).join('')}</datalist>`;
  return `<label class="${cls}">${esc(f.label)}${input}</label>`;
}
const schema = {
 product: [field('name','Product / medicine name','text',{wide:true,placeholder:'Enter product name (required)'}),field('sku','SKU / barcode','text',{required:false}),field('medicineType','Type of medicine','select',{options:['Antibiotic','Vaccine','Vitamin & mineral','Pain relief','Antiparasitic / dewormer','Anticoccidial','Electrolyte','Probiotic / enzyme','Disinfectant','Feed supplement','Respiratory medicine','Digestive medicine','Other']}),field('category','Category / brand','text',{required:false,placeholder:'Optional category or brand'}),field('unit','Unit','select',{options:['piece','pack','box','carton','kg','gram','liter','bottle','strip','tablet','vial','sachet','dose','bag','dozen']}),field('costPrice','Purchase cost','number',{min:0,step:'0.01'}),field('salePrice','Retail sale price','number',{min:0,step:'0.01'}),field('wholesalePrice','Wholesale price','number',{min:0,step:'0.01',required:false}),field('stock','Opening stock','number',{min:0,step:'0.001'}),field('reorderLevel','Low-stock alert at','number',{min:0,step:'0.001'}),field('batch','Batch / lot number','text',{required:false}),field('expiryDate','Expiry date','date',{required:false}),field('supplierName','Supplier name','text',{required:false,placeholder:'Supplier name'}),field('supplierPhone','Supplier contact number','tel',{required:false,placeholder:'03XXXXXXXXX'}),field('notes','Notes','textarea',{required:false,wide:true})],
 customer: [field('name','Customer name'),field('phone','Phone','tel',{required:false}),field('email','Email','email',{required:false}),field('openingBalance','Opening balance','number',{min:0,step:'0.01'}),field('address','Address','text',{required:false}),field('notes','Notes','textarea',{required:false,wide:true})],
 supplier: [field('name','Supplier name'),field('phone','Supplier contact number','tel',{placeholder:'e.g. 03XXXXXXXXX'}),field('email','Email','email',{required:false}),field('openingBalance','Opening balance','number',{min:0,step:'0.01'}),field('address','Address','text',{required:false}),field('notes','Notes','textarea',{required:false,wide:true})],
 expense: [field('title','Expense title'),field('category','Category','select',{options:['Rent','Utilities','Transport','Salaries','Packaging','Maintenance','Tax / fees','Other']}),field('amount','Amount','number',{min:0.01,step:'0.01'}),field('date','Date','date'),field('note','Note','textarea',{required:false,wide:true})],
 delivery: [field('customerName','Customer name'),field('salesperson','Salesperson / delivered by'),field('details','Items and quantities','textarea',{placeholder:'e.g. Rice 5kg × 2, Oil 1L × 3',wide:true}),field('date','Delivery date','date'),field('status','Delivery status','select',{options:['Pending','Dispatched','Delivered','Partially delivered','Failed']}),field('phone','Customer phone','tel',{required:false}),field('note','Notes','textarea',{required:false,wide:true})]
};
let editRecord = null, activeFormType = null, saleCart = [];
function openDialog(title, type, existing = null) {
  activeFormType = type; editRecord = existing; $('dialogTitle').textContent = `${existing?'Edit':'Add'} ${title}`; $('dialogError').textContent = ''; $('dialogCancel').textContent = 'Cancel'; $('dialogSave').classList.remove('hidden');
  if (type === 'product') title = 'stock';
  if (type === 'sale') { saleCart = [{productId:data.products[0]?.id||'',quantity:1,unitPrice:num(data.products[0]?.salePrice)}]; renderSaleForm(existing); }
  else if (type === 'purchase') renderPurchaseForm(existing);
  else if (type === 'return') renderReturnForm();
  else { const fields = schema[type] || []; $('dialogFields').innerHTML = fields.map(f=>makeField(f, existing ? existing[f.name] : (f.name==='date'?today():f.name==='unit'?'piece':f.name==='reorderLevel'?5:f.name==='status'?'Pending':f.name==='openingBalance'||f.name==='amount'||['stock','costPrice','salePrice','wholesalePrice'].includes(f.name)?0:''))).join(''); if(type==='product'){const sn=$('dialogFields').querySelector('[name="supplierName"]'),sp=$('dialogFields').querySelector('[name="supplierPhone"]');sn?.addEventListener('change',()=>{const found=data.suppliers.find(x=>String(x.name||'').toLowerCase()===sn.value.trim().toLowerCase());if(found&&sp)sp.value=found.phone||'';});} }
  $('dialogSave').textContent = existing ? 'Save changes' : (type==='sale'?'Complete sale':type==='purchase'?'Save purchase':type==='return'?'Record return':'Save record');
  $('recordDialog').showModal();
}
function renderSaleForm() {
  $('dialogFields').innerHTML = `<label>Customer name<input id="saleCustomer" list="savedCustomersList" placeholder="Enter customer name" autocomplete="off"><datalist id="savedCustomersList">${data.customers.map(c=>`<option value="${esc(c.name)}"></option>`).join('')}</datalist></label><label>Customer contact number<input id="saleCustomerPhone" type="tel" placeholder="Customer phone number"></label><label>Payment method<select id="salePayment"><option>Cash</option><option>Bank transfer</option><option>Card</option><option>Mobile wallet</option><option>Credit</option><option>Mixed</option></select></label><label class="wide-field">Invoice note<input id="saleNote" placeholder="Optional note"></label><div class="wide-field"><div class="panel-head"><div><h3>Items in sale</h3><p>Choose products, quantity and selling price.</p></div></div><div id="saleCartRows">${saleCart.map((x,i)=>cartRow(x,i)).join('')}</div><button type="button" id="addCartRow" class="cart-add">＋ Add another item</button><div class="cart-total"><span>Invoice total</span><strong id="cartTotal">${money(cartTotal())}</strong></div></div><label>Amount paid<input id="salePaid" type="number" min="0" step="0.01" value="${cartTotal()}" required></label><label>Payment status<select id="salePayStatus"><option value="auto">Automatic from paid amount</option><option value="paid">Mark fully paid</option></select></label>`;
  $('saleCustomer').addEventListener('change',()=>{const c=data.customers.find(x=>x.name.toLowerCase()===$('saleCustomer').value.trim().toLowerCase());if(c && !$('saleCustomerPhone').value.trim())$('saleCustomerPhone').value=c.phone||'';});
  $('addCartRow').addEventListener('click',()=>{saleCart.push({productId:data.products[0]?.id||'',quantity:1,unitPrice:num(data.products[0]?.salePrice)}); updateCartRows();});
  $('saleCartRows').addEventListener('input', cartChange); $('saleCartRows').addEventListener('change', cartChange);
  $('salePaid').addEventListener('input',()=>{});
  updateCartTotal();
}
function cartRow(item,i) { return `<div class="cart-row" data-cart-index="${i}"><select data-cart-field="productId"><option value="">Select product</option>${data.products.map(p=>`<option value="${p.id}" ${p.id===item.productId?'selected':''}>${esc(p.name)} (${num(p.stock)} available)</option>`).join('')}</select><input data-cart-field="quantity" type="number" min="0.001" step="0.001" value="${num(item.quantity)||1}" title="Quantity"><input data-cart-field="unitPrice" type="number" min="0" step="0.01" value="${num(item.unitPrice)}" title="Unit price"><button type="button" data-remove-cart="${i}" aria-label="Remove item">×</button></div>`; }
function cartChange(e) {
  const row=e.target.closest('[data-cart-index]'); if(!row)return; const i=Number(row.dataset.cartIndex), f=e.target.dataset.cartField; if(!f)return;
  if(f==='productId'){const p=data.products.find(x=>x.id===e.target.value);saleCart[i].productId=e.target.value;saleCart[i].unitPrice=num(p?.salePrice);updateCartRows();}
  else {saleCart[i][f]=num(e.target.value);updateCartTotal();}
}
function updateCartRows() { const el=$('saleCartRows'); if(el){el.innerHTML=saleCart.map((x,i)=>cartRow(x,i)).join('');} updateCartTotal(); }
function updateCartTotal() { const total=cartTotal(); if($('cartTotal'))$('cartTotal').textContent=money(total); if($('salePaid') && !$('salePaid').dataset.touched) $('salePaid').value=total.toFixed(2); }
function cartTotal() { return saleCart.reduce((n,x)=>n+num(x.quantity)*num(x.unitPrice),0); }
function renderPurchaseForm(existing=null) {
  $('dialogFields').innerHTML = `<label class="wide-field">Product<select name="productId" required>${data.products.map(p=>`<option value="${p.id}">${esc(p.name)} — current stock ${num(p.stock)}</option>`).join('')}</select></label><label>Quantity received<input name="quantity" type="number" min="0.001" step="0.001" value="1" required></label><label>Unit purchase cost<input name="unitPrice" type="number" min="0" step="0.01" value="0" required></label><label>Supplier<select name="supplierId" id="purchaseSupplier"><option value="">Select supplier</option>${data.suppliers.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></label><label>Supplier contact number<input name="supplierPhone" id="purchaseSupplierPhone" type="tel" placeholder="Supplier phone number" readonly></label><label>Purchase date<input name="date" type="date" value="${today()}" required></label><label>Reference / bill no.<input name="reference" placeholder="Optional bill number"></label><label>Amount paid<input name="paid" type="number" min="0" step="0.01" value="0"></label><label>Payment status<select name="paymentStatus"><option>Unpaid</option><option>Partial</option><option>Paid</option></select></label><label class="wide-field">Notes<textarea name="note" placeholder="Optional"></textarea></label>`;
  const productSelect=$('dialogFields').querySelector('[name="productId"]'); const cost=$('dialogFields').querySelector('[name="unitPrice"]'); const supplierSelect=$('purchaseSupplier'); const supplierPhone=$('purchaseSupplierPhone');
  const syncSupplierPhone=()=>{const supplier=data.suppliers.find(x=>x.id===supplierSelect?.value);if(supplierPhone)supplierPhone.value=supplier?.phone||'';}; supplierSelect?.addEventListener('change',syncSupplierPhone);
  const quantity=$('dialogFields').querySelector('[name="quantity"]'); const paid=$('dialogFields').querySelector('[name="paid"]'); const status=$('dialogFields').querySelector('[name="paymentStatus"]');
  const syncPaymentStatus=()=>{const total=num(quantity?.value)*num(cost?.value),received=num(paid?.value);if(status)status.value=received>=total&&total>0?'Paid':received>0?'Partial':'Unpaid';};
  productSelect?.addEventListener('change',()=>{const p=data.products.find(x=>x.id===productSelect.value);cost.value=String(num(p?.costPrice));syncPaymentStatus();});
  [quantity,cost,paid].forEach(el=>el?.addEventListener('input',syncPaymentStatus));
  if(data.products[0])cost.value=String(num(data.products[0].costPrice));syncPaymentStatus();
}
function renderReturnForm() {
  const sales=data.sales.filter(s=>(s.items||[]).length);
  $('dialogFields').innerHTML = `<label class="wide-field">Original invoice<select id="returnSale" required><option value="">Choose invoice</option>${sales.map(s=>`<option value="${s.id}">${esc(s.invoiceNo)} — ${esc(s.customerName||'Walk-in')} — ${money(s.total)}</option>`).join('')}</select></label><div id="returnItems" class="wide-field"><p class="muted-text">Choose an invoice to select returned items.</p></div><label>Refund amount<input id="returnAmount" type="number" min="0" step="0.01" value="0" required></label><label>Refund method<select id="returnMethod"><option>Cash</option><option>Bank transfer</option><option>Store credit</option><option>Not refunded yet</option></select></label><label class="wide-field">Reason<input id="returnReason" placeholder="Damaged, expired, customer return…" required></label>`;
  $('returnSale').addEventListener('change',()=>{const s=data.sales.find(x=>x.id===$('returnSale').value);$('returnItems').innerHTML=s?`<div class="notice info">Select the quantity being returned. Do not enter more than was sold.</div>${s.items.map((it,i)=>`<label class="field-label">${esc(it.name)} — sold ${num(it.quantity)}<input class="field-control" type="number" min="0" max="${num(it.quantity)}" step="0.001" value="0" data-return-index="${i}"></label>`).join('')}`:'<p class="muted-text">Choose an invoice to select returned items.</p>';});
}
function formValues(form) { const out={}; new FormData(form).forEach((v,k)=>{out[k]=String(v).trim();}); return out; }
function validateNonnegative(obj, keys) { for(const k of keys) if(obj[k]!==undefined && (!Number.isFinite(Number(obj[k])) || Number(obj[k])<0)) throw new Error(`${k} must be zero or greater.`); }
async function saveGeneric(type, form) {
  const values=formValues(form); const numeric={openingBalance:1,amount:1,stock:1,reorderLevel:1,costPrice:1,salePrice:1,wholesalePrice:1};
  Object.keys(values).forEach(k=>{if(numeric[k])values[k]=Number(values[k]||0);});
  if(type==='product') { validateNonnegative(values,['stock','reorderLevel','costPrice','salePrice','wholesalePrice']); if(!values.name?.trim())throw new Error('Enter the product / medicine name.'); if(!values.medicineType)throw new Error('Select a type of medicine.'); }
  if(type==='expense' && num(values.amount)<=0)throw new Error('Expense amount must be greater than zero.');
  const collectionName=type==='customer'?'customers':type==='supplier'?'suppliers':type==='delivery'?'deliveries':type==='expense'?'expenses':'products';
  if(type==='product' && values.supplierName?.trim()) { const sn=values.supplierName.trim(), sp=(values.supplierPhone||'').trim(); const old=data.suppliers.find(x=>String(x.name||'').trim().toLowerCase()===sn.toLowerCase()); if(old) { if(sp && sp!==old.phone) await update('suppliers',old.id,{...old,name:sn,phone:sp}); } else await add('suppliers',{name:sn,phone:sp,email:'',openingBalance:0,address:'',notes:'Saved from medicine stock entry'}); }
  if(editRecord) await update(collectionName,editRecord.id,values); else await add(collectionName,values);
  if(type==='product' && !editRecord && num(values.stock)>0) { /* opening stock is part of the product record */ }
  toast(`${type[0].toUpperCase()+type.slice(1)} ${editRecord?'updated':'saved'} successfully.`); closeDialog();
}
async function saveSale() {
  requireConfig(); const typedCustomerName=$('saleCustomer').value.trim(), selectedCustomer=data.customers.find(c=>c.name.toLowerCase()===typedCustomerName.toLowerCase()); const customerName=typedCustomerName || 'Walk-in customer', customerPhone=$('saleCustomerPhone').value.trim() || selectedCustomer?.phone || '', customerId=selectedCustomer?.id || '', paymentMethod=$('salePayment').value, paid=num($('salePaid').value), total=cartTotal();
  const items=saleCart.map(item=>{if(!item.productId || num(item.quantity)<=0 || num(item.unitPrice)<0)throw new Error('Choose each product and enter a valid quantity and price.');const p=data.products.find(y=>y.id===item.productId);if(!p)throw new Error('A selected product no longer exists.');return {productId:p.id,name:p.name,quantity:num(item.quantity),unitPrice:num(item.unitPrice),costPrice:num(p.costPrice)};});
  if(!items.length)throw new Error('Add at least one product to the sale.'); if(paid<0 || paid>total)throw new Error('Amount paid must be between zero and the invoice total.');
  if(typedCustomerName && !selectedCustomer) { const found=data.customers.find(c=>String(c.name||'').trim().toLowerCase()===typedCustomerName.toLowerCase()); if(found) { if(customerPhone && customerPhone!==found.phone) await update('customers',found.id,{...found,phone:customerPhone}); } else await add('customers',{name:typedCustomerName,phone:customerPhone,email:'',openingBalance:0,address:'',notes:'Saved automatically from sale'}); }
  const paidFinal=$('salePayStatus').value==='paid'?total:paid;
  const requiredByProduct=new Map();items.forEach(i=>requiredByProduct.set(i.productId,(requiredByProduct.get(i.productId)||0)+i.quantity));
  const sale={invoiceNo:invoiceNo(),customerId,customerName,customerPhone,paymentMethod,note:$('saleNote').value.trim(),total,paid:paidFinal,profit:items.reduce((n,i)=>n+i.quantity*(i.unitPrice-i.costPrice),0),items,date:today(),createdAt:new Date().toISOString()};
  await runTransaction(db,async tx=>{
    const productIds=[...requiredByProduct.keys()]; const refs=productIds.map(id=>docRef('products',id)); const snaps=[]; for(const r of refs) snaps.push(await tx.get(r));
    snaps.forEach((snap,i)=>{const id=productIds[i], product=data.products.find(p=>p.id===id);if(!snap.exists())throw new Error(`Product not found: ${product?.name||id}`);const stock=num(snap.data().stock ?? snap.data().quantity ?? snap.data().currentStock), needed=requiredByProduct.get(id);if(stock<needed)throw new Error(`Insufficient stock for ${product?.name||'product'}. Available: ${stock}, required: ${needed}.`);});
    const saleRef=doc(col('sales')); tx.set(saleRef,{...sale,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
    snaps.forEach((snap,i)=>{const next=num(snap.data().stock ?? snap.data().quantity ?? snap.data().currentStock)-requiredByProduct.get(productIds[i]);const patch={stock:next,updatedAt:serverTimestamp()};if('quantity' in snap.data())patch.quantity=next;if('currentStock' in snap.data())patch.currentStock=next;tx.update(refs[i],patch);});
    if(paidFinal<total && customerName!=='Walk-in customer') { const ledgerRef=doc(col('ledger')); tx.set(ledgerRef,{type:'customer_due',customerName,saleId:saleRef.id,amount:total-paidFinal,note:`Due from invoice ${sale.invoiceNo}`,createdAt:serverTimestamp(),updatedAt:serverTimestamp()}); }
  });
  toast(`Sale ${sale.invoiceNo} saved; stock updated.`); closeDialog();
}
async function savePurchase(form) {
  requireConfig(); const v=formValues(form), product=data.products.find(p=>p.id===v.productId), quantity=num(v.quantity), unitPrice=num(v.unitPrice), paid=num(v.paid);
  const total=quantity*unitPrice;
  if(!product)throw new Error('Choose a product first.'); if(quantity<=0||unitPrice<0||paid<0||paid>total)throw new Error('Enter a valid quantity, cost and payment (paid amount cannot exceed purchase total).');
  const paymentStatus=paid>=total?'Paid':paid>0?'Partial':'Unpaid';
  const selectedSupplier=data.suppliers.find(x=>x.id===v.supplierId); const purchase={reference:v.reference||`PUR-${Date.now().toString().slice(-6)}`,supplierId:selectedSupplier?.id||'',supplierName:selectedSupplier?.name||'Supplier',supplierPhone:v.supplierPhone||selectedSupplier?.phone||'',date:v.date||today(),total,paid,paymentStatus,note:v.note||'',items:[{productId:product.id,name:product.name,quantity,unitPrice,costPrice:unitPrice}]};
  await runTransaction(db,async tx=>{const pr=docRef('products',product.id),snap=await tx.get(pr);if(!snap.exists())throw new Error('Product no longer exists.');const purchaseRef=doc(col('purchases'));tx.set(purchaseRef,{...purchase,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});const next=num(snap.data().stock ?? snap.data().quantity ?? snap.data().currentStock)+quantity;const patch={stock:next,costPrice:unitPrice,updatedAt:serverTimestamp()};if('quantity' in snap.data())patch.quantity=next;if('currentStock' in snap.data())patch.currentStock=next;tx.update(pr,patch);});
  toast('Purchase saved and inventory updated.');closeDialog();
}
async function saveReturn() {
  requireConfig(); const sale=data.sales.find(s=>s.id===$('returnSale').value); if(!sale)throw new Error('Choose the original invoice.');
  const inputs=[...document.querySelectorAll('[data-return-index]')]; const items=inputs.map(input=>{const original=sale.items[Number(input.dataset.returnIndex)];return {...original,quantity:num(input.value)};}).filter(i=>i.quantity>0);
  if(!items.length)throw new Error('Enter at least one returned quantity.');
  const priorReturned = new Map(); data.returns.filter(r=>r.originalSaleId===sale.id).flatMap(r=>r.items||[]).forEach(i=>priorReturned.set(i.productId,(priorReturned.get(i.productId)||0)+num(i.quantity)));
  const soldByProduct = new Map(); sale.items.forEach(i=>soldByProduct.set(i.productId,(soldByProduct.get(i.productId)||0)+num(i.quantity)));
  const returnByProduct = new Map(); items.forEach(i=>returnByProduct.set(i.productId,(returnByProduct.get(i.productId)||0)+num(i.quantity)));
  for (const [productId, quantity] of returnByProduct) { const remaining=num(soldByProduct.get(productId))-num(priorReturned.get(productId)); if(quantity>remaining)throw new Error(`Return quantity for ${productName(productId)} exceeds the remaining quantity on the invoice (${remaining}).`); }
  const amount=num($('returnAmount').value); const returnedValue=items.reduce((n,i)=>n+i.quantity*num(i.unitPrice),0); if(amount<0||amount>returnedValue)throw new Error(`Refund must be between zero and ${money(returnedValue)} for the selected quantities.`); const profitLoss=items.reduce((n,i)=>n+i.quantity*(num(i.unitPrice)-num(i.costPrice)),0);
  await runTransaction(db,async tx=>{
    const productIds=[...returnByProduct.keys()];
    const refs=productIds.map(id=>docRef('products',id));
    const snaps=[];
    for(const r of refs) snaps.push(await tx.get(r));
    // Re-check prior returns inside the transaction so two devices cannot over-return the same invoice.
    const priorQuery=query(col('returns'),where('originalSaleId','==',sale.id));
    const priorSnap=await tx.get(priorQuery);
    const alreadyReturned=new Map();
    priorSnap.docs.forEach(d=>(d.data().items||[]).forEach(i=>alreadyReturned.set(i.productId,(alreadyReturned.get(i.productId)||0)+num(i.quantity))));
    const soldByProduct=new Map();
    (sale.items||[]).forEach(i=>soldByProduct.set(i.productId,(soldByProduct.get(i.productId)||0)+num(i.quantity)));
    for(const [productId,quantity] of returnByProduct){
      const remaining=num(soldByProduct.get(productId))-num(alreadyReturned.get(productId));
      if(quantity>remaining) throw new Error(`Return quantity for ${productName(productId)} exceeds the remaining quantity on the invoice (${remaining}).`);
    }
    snaps.forEach((s,i)=>{if(!s.exists())throw new Error(`Product not found: ${productName(productIds[i])}`);});
    const retRef=doc(col('returns'));
    tx.set(retRef,{invoiceNo:sale.invoiceNo,originalSaleId:sale.id,customerName:sale.customerName,items,amount,method:$('returnMethod').value,reason:$('returnReason').value.trim(),profitLoss,date:today(),createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
    snaps.forEach((s,i)=>tx.update(refs[i],{stock:num(s.data().stock)+returnByProduct.get(productIds[i]),updatedAt:serverTimestamp()}));
  });
  toast('Return recorded and returned stock added back.');closeDialog();
}
function closeDialog() { if($('recordDialog').open)$('recordDialog').close(); editRecord=null;activeFormType=null; }
function findRecord(type,id) { const name=type==='product'?'products':type==='customer'?'customers':type==='supplier'?'suppliers':type==='expense'?'expenses':type==='delivery'?'deliveries':type;return data[name]?.find(x=>x.id===id); }
async function deleteRecord(type,id) {
  const map={product:'products',customer:'customers',supplier:'suppliers',expense:'expenses',delivery:'deliveries'}; const name=map[type]; if(!name)return;
  const record=findRecord(type,id); if(type==='product' && (num(record?.stock)!==0 || data.sales.some(s=>(s.items||[]).some(i=>i.productId===id)))) { if(!confirm('This product has stock or transaction history. Deleting it can make reports harder to audit. Delete anyway?'))return; }
  if(!confirm(`Delete this ${type} record? This action cannot be undone.`))return;
  try { await remove(name,id);toast(`${type[0].toUpperCase()+type.slice(1)} deleted.`); } catch(e){toast(e.message||'Delete failed.',true);}
}
function downloadCsv(filename, rows) {
  const escapeCsv=v=>`"${String(v??'').replaceAll('"','""')}"`;const csv=rows.map(row=>row.map(escapeCsv).join(',')).join('\r\n');const blob=new Blob(['\ufeff',csv],{type:'text/csv;charset=utf-8;'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function exportCollection(name, fields, filename) { const rows=[fields.map(x=>x[1]),...data[name].map(item=>fields.map(([key])=>Array.isArray(item[key])?item[key].map(i=>`${i.name} x ${i.quantity}`).join('; '):item[key]??''))];downloadCsv(filename,rows);toast('CSV export started.'); }
function exportCollectionFromRows(filename,headers,rows){downloadCsv(filename,[headers,...rows]);toast('Ledger CSV export started.');}
function exportAll() { exportCollection('products',[['name','Product'],['sku','SKU'],['medicineType','Medicine type'],['category','Category'],['costPrice','Cost'],['salePrice','Sale price'],['stock','Stock'],['expiryDate','Expiry']], 'poultry-medicine-inventory.csv'); setTimeout(()=>exportCollection('sales',[['invoiceNo','Invoice'],['customerName','Customer'],['date','Date'],['total','Total'],['paid','Paid'],['profit','Profit']], 'poultry-medicine-sales.csv'),400);setTimeout(()=>exportCollection('expenses',[['title','Expense'],['category','Category'],['date','Date'],['amount','Amount']], 'poultry-medicine-expenses.csv'),800); }
function viewSale(id) {
  const s=data.sales.find(x=>x.id===id); if(!s)return;
  const rows=(s.items||[]).map(i=>tr([`<span class="td-strong">${esc(i.name)}</span>`,num(i.quantity),money(i.unitPrice),money(i.quantity*i.unitPrice)]));
  $('dialogTitle').textContent=`Invoice ${s.invoiceNo}`;
  $('dialogFields').innerHTML=`<div class="notice info wide-field">Customer: ${esc(s.customerName||'Walk-in customer')} · Contact: ${esc(s.customerPhone||'—')} · Date: ${esc(dateOf(s))} · Payment: ${esc(s.paymentMethod||'Cash')}</div><div class="wide-field">${table(['Product','Qty','Unit price','Line total'],rows)}</div><div class="cart-total wide-field"><span>Total · Paid · Due</span><strong>${money(s.total)} · ${money(s.paid)} · ${money(Math.max(0,num(s.total)-num(s.paid)))}</strong></div><p class="wide-field muted-text">${esc(s.note||'No invoice note.')}</p><div class="wide-field"><button type="button" class="btn btn-primary" data-action="print-sale" data-id="${s.id}">Print customer bill</button></div>`;
  $('dialogSave').classList.add('hidden'); $('dialogCancel').textContent='Close'; $('recordDialog').showModal(); activeFormType='view';
}
function printSale(id) {
  const s=data.sales.find(x=>x.id===id); if(!s)return;
  const itemRows=(s.items||[]).map(i=>`<tr><td>${esc(i.name)}</td><td>${num(i.quantity)}</td><td>${money(i.unitPrice)}</td><td>${money(num(i.quantity)*num(i.unitPrice))}</td></tr>`).join('');
  const w=window.open('','_blank','width=800,height=900'); if(!w){toast('Allow pop-ups to print the bill.',true);return;}
  w.document.write(`<!doctype html><html><head><title>Bill ${esc(s.invoiceNo)}</title><meta charset="utf-8"><style>body{font:14px Arial,sans-serif;color:#111;padding:28px}h1{text-align:center;margin-bottom:4px}p{text-align:center;margin:4px}hr{margin:22px 0}table{width:100%;border-collapse:collapse;margin:20px 0}th,td{border:1px solid #ccc;padding:10px;text-align:left}th{background:#f1f4f8}.totals{margin-left:auto;width:280px}.totals div{display:flex;justify-content:space-between;padding:6px 0}.grand{font-size:18px;font-weight:bold;border-top:2px solid #111;margin-top:6px;padding-top:10px}.thanks{text-align:center;margin-top:36px}</style></head><body><h1>${esc(business.name||'Poultry Medicine Manager')}</h1><p>Customer Bill</p><hr><p style="text-align:left"><b>Invoice:</b> ${esc(s.invoiceNo)}<br><b>Date:</b> ${esc(dateOf(s))}<br><b>Customer:</b> ${esc(s.customerName||'Walk-in customer')}<br><b>Contact:</b> ${esc(s.customerPhone||'—')}</p><table><thead><tr><th>Product</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>${itemRows}</tbody></table><div class="totals"><div><span>Total</span><b>${money(s.total)}</b></div><div><span>Paid</span><b>${money(s.paid)}</b></div><div><span>Due</span><b>${money(Math.max(0,num(s.total)-num(s.paid)))}</b></div></div><p class="thanks">Thank you for your business.</p><script>window.onload=()=>window.print();<\/script></body></html>`);
  w.document.close();
}

$('authForm').addEventListener('submit',async e=>{
  e.preventDefault();setAuthError('');setAuthBusy(true);
  try { requireConfig(); const email=$('email').value.trim(), password=$('password').value;
    if(authMode==='signup') { const name=$('fullName').value.trim(), businessName=$('businessName').value.trim(); if(!name||!businessName)throw new Error('Enter your name and business name.');const result=await createUserWithEmailAndPassword(auth,email,password);await updateProfile(result.user,{displayName:name});await ensureBusiness(result.user,{name:businessName,type:$('businessType').value}); }
    else await signInWithEmailAndPassword(auth,email,password);
  } catch(err) { setAuthError(err.message||'Authentication failed.'); } finally { setAuthBusy(false); }
});
$('switchMode').addEventListener('click',()=>authModeSet(authMode==='login'?'signup':'login'));
$('forgotBtn').addEventListener('click',async()=>{try{requireConfig();const email=$('email').value.trim();if(!email)throw new Error('Enter your email address first.');await sendPasswordResetEmail(auth,email);toast('If that account exists, a password reset email has been sent.');}catch(e){setAuthError(e.message);}});
$('googleBtn').addEventListener('click',async()=>{try{requireConfig();setAuthError('');$('googleBtn').disabled=true;const result=await signInWithPopup(auth,new GoogleAuthProvider());await ensureBusiness(result.user);}catch(e){setAuthError(e.message||'Google sign-in failed.');}finally{$('googleBtn').disabled=false;}});
$('logoutBtn').addEventListener('click',async()=>{try{stopWatchers();await signOut(auth);toast('Signed out.');}catch(e){toast(e.message,true);}});
$('menuBtn').addEventListener('click',()=>{$('sidebar').classList.add('open');$('scrim').classList.remove('hidden');});$('closeMenu').addEventListener('click',()=>{$('sidebar').classList.remove('open');$('scrim').classList.add('hidden');});$('scrim').addEventListener('click',()=>{$('sidebar').classList.remove('open');$('scrim').classList.add('hidden');});
$('mainNav').addEventListener('click',e=>{const b=e.target.closest('[data-page]');if(b)navigate(b.dataset.page);});
$('globalSearch').addEventListener('input',e=>{searchText=e.target.value;renderCurrent();const local=$('pageContent').querySelector('[data-search]');if(local){local.value=searchText;local.focus();local.setSelectionRange(searchText.length,searchText.length);}});
$('pageContent').addEventListener('input',e=>{if(e.target.matches('[data-search]')){searchText=e.target.value;const pos=e.target.selectionStart;renderCurrent();const next=$('pageContent').querySelector('[data-search]');if(next){next.focus();next.setSelectionRange(pos,pos);}}});
$('pageContent').addEventListener('click',async e=>{
  const rangeBtn=e.target.closest('[data-chart-range]'); if(rangeBtn){chartRange=Number(rangeBtn.dataset.chartRange)||30;renderCurrent();return;}
  const promptBtn=e.target.closest('[data-copilot-prompt]'); if(promptBtn){const input=$('copilotInput');if(input){input.value=promptBtn.dataset.copilotPrompt;input.focus();}return;}
  const alertFilter=e.target.closest('[data-alert-filter]'); if(alertFilter){inventoryFilter=alertFilter.dataset.alertFilter||'all';searchText='';navigate('inventory');return;}
  const pageLink=e.target.closest('[data-page-link]');if(pageLink){navigate(pageLink.dataset.pageLink);return;}
  const b=e.target.closest('[data-action]');if(!b)return;const action=b.dataset.action;
  try {
    if(action==='new-product')openDialog('product','product'); else if(action==='new-sale') {if(!data.products.length)throw new Error('Add at least one product before recording a sale.');openDialog('sale','sale');}
    else if(action==='new-purchase'){if(!data.products.length)throw new Error('Add at least one product before recording a purchase.');openDialog('purchase','purchase');}
    else if(action==='new-customer')openDialog('customer','customer');else if(action==='new-supplier')openDialog('supplier','supplier');else if(action==='new-expense')openDialog('expense','expense');else if(action==='new-delivery')openDialog('delivery','delivery');else if(action==='new-return'){if(!data.sales.length)throw new Error('Record a sale before recording a return.');openDialog('return','return');}
    else if(action==='edit'){const type=b.dataset.type, record=findRecord(type,b.dataset.id);if(record)openDialog(type,type,record);}
    else if(action==='delete')await deleteRecord(b.dataset.type,b.dataset.id);else if(action==='view-sale')viewSale(b.dataset.id);else if(action==='print-sale')printSale(b.dataset.id);
    else if(action==='export-products')exportCollection('products',[['name','Product'],['sku','SKU'],['medicineType','Medicine type'],['category','Category'],['costPrice','Cost'],['salePrice','Sale price'],['wholesalePrice','Wholesale price'],['stock','Stock'],['reorderLevel','Reorder level'],['batch','Batch'],['expiryDate','Expiry']], 'poultry-medicine-inventory.csv');
    else if(action==='export-sales')exportCollection('sales',[['invoiceNo','Invoice'],['customerName','Customer'],['date','Date'],['paymentMethod','Payment'],['total','Total'],['paid','Paid'],['profit','Profit']], 'poultry-medicine-sales.csv');
    else if(action==='export-purchases')exportCollection('purchases',[['reference','Reference'],['supplierName','Supplier'],['date','Date'],['total','Total'],['paid','Paid'],['paymentStatus','Status']], 'poultry-medicine-purchases.csv');
    else if(action==='export-customers')exportCollection('customers',[['name','Name'],['phone','Phone'],['email','Email'],['openingBalance','Opening balance'],['address','Address']], 'poultry-medicine-customers.csv');
    else if(action==='export-suppliers')exportCollection('suppliers',[['name','Name'],['phone','Phone'],['email','Email'],['openingBalance','Opening balance'],['address','Address']], 'poultry-medicine-suppliers.csv');
    else if(action==='export-expenses')exportCollection('expenses',[['title','Expense'],['category','Category'],['date','Date'],['amount','Amount'],['note','Note']], 'poultry-medicine-expenses.csv');
    else if(action==='export-deliveries')exportCollection('deliveries',[['customerName','Customer'],['details','Items'],['salesperson','Salesperson'],['date','Date'],['status','Status'],['phone','Phone']], 'poultry-medicine-deliveries.csv');
    else if(action==='export-returns')exportCollection('returns',[['invoiceNo','Invoice'],['customerName','Customer'],['date','Date'],['amount','Refund'],['profitLoss','Profit adjustment'],['reason','Reason']], 'poultry-medicine-returns.csv');
    else if(action==='export-ledger'){const all=[];data.sales.forEach(x=>all.push([dateOf(x),'Sale',x.invoiceNo||'',x.customerName||'Walk-in',(x.items||[]).map(i=>`${i.name} x ${i.quantity}`).join('; '),x.paid||0,0]));data.purchases.forEach(x=>all.push([dateOf(x),'Purchase',x.reference||'',x.supplierName||'Supplier',(x.items||[]).map(i=>`${i.name} x ${i.quantity}`).join('; '),0,x.paid||0]));data.expenses.forEach(x=>all.push([dateOf(x),'Expense',x.title||'',x.category||'',x.note||'',0,x.amount||0]));data.returns.forEach(x=>all.push([dateOf(x),'Return',x.invoiceNo||'',x.customerName||'',x.reason||'',0,x.amount||0]));exportCollectionFromRows('poultry-medicine-ledger.csv',['Date','Type','Reference','Party','Details','Money in','Money out'],all);} else if(action==='export-all')exportAll(); else if(action==='logout')$('logoutBtn').click();
  } catch(err){toast(err.message||'Action could not be completed.',true);}
});
$('recordForm').addEventListener('submit',async e=>{
  e.preventDefault();$('dialogError').textContent='';$('dialogSave').disabled=true;$('dialogSave').textContent='Saving…';
  try { if(activeFormType==='view'){closeDialog();return;} if(activeFormType==='sale')await saveSale();else if(activeFormType==='purchase')await savePurchase(e.currentTarget);else if(activeFormType==='return')await saveReturn();else await saveGeneric(activeFormType,e.currentTarget); }
  catch(err){$('dialogError').textContent=err.message||'Could not save this record.';}
  finally{$('dialogSave').disabled=false;$('dialogSave').classList.remove('hidden');$('dialogSave').textContent=editRecord?'Save changes':(activeFormType==='sale'?'Complete sale':activeFormType==='purchase'?'Save purchase':activeFormType==='return'?'Record return':'Save record');}
});
$('dialogClose').addEventListener('click',closeDialog);$('dialogCancel').addEventListener('click',closeDialog);$('recordDialog').addEventListener('click',e=>{if(e.target===$('recordDialog'))closeDialog();});
$('recordDialog').addEventListener('click',e=>{const printBtn=e.target.closest('[data-action="print-sale"]');if(printBtn){printSale(printBtn.dataset.id);return;}const b=e.target.closest('[data-remove-cart]');if(b){saleCart.splice(Number(b.dataset.removeCart),1);if(!saleCart.length)saleCart.push({productId:data.products[0]?.id||'',quantity:1,unitPrice:num(data.products[0]?.salePrice)});updateCartRows();}});
$('recordDialog').addEventListener('input',e=>{if(e.target.id==='salePaid')e.target.dataset.touched='1';});
$('pageContent').addEventListener('submit',async e=>{
  if(e.target.id!=='copilotForm')return;
  e.preventDefault(); if(copilotBusy)return;
  const input=$('copilotInput'); const prompt=input.value.trim(); if(!prompt)return;
  copilotBusy=true; copilotMessages.push({role:'user',text:prompt}); copilotMessages.push({role:'assistant',text:'Reviewing your business records…'}); renderCurrent();
  try {
    requireConfig(); const token=await currentUser.getIdToken();
    const response=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({question:prompt})});
    const result=await response.json(); if(!response.ok)throw new Error(result.error||'AI service is not configured yet.');
    copilotMessages[copilotMessages.length-1]={role:'assistant',text:result.answer||'No answer was returned.'};
  } catch(err) { copilotMessages[copilotMessages.length-1]={role:'assistant',text:`I could not connect to the AI service. ${err.message||'Please try again.'}\n\nSetup note: deploy the /api/ai.js function and configure OPENAI_API_KEY plus FIREBASE_SERVICE_ACCOUNT in Vercel Environment Variables.`}; }
  finally { copilotBusy=false; renderCurrent(); const messagesEl=$('copilotMessages'); if(messagesEl)messagesEl.scrollTop=messagesEl.scrollHeight; }
});
$('pageContent').addEventListener('submit',async e=>{if(e.target.id!=='settingsForm')return;e.preventDefault();const v=formValues(e.target);try{await updateDoc(doc(db,'businesses',uid()),{name:v.name,type:v.type,currency:v.currency,timezone:v.timezone,updatedAt:serverTimestamp()});business={...business,...v};updateBusinessChrome();renderCurrent();toast('Business preferences saved.');}catch(err){toast(err.message||'Could not save settings.',true);}});
$('alertsBtn').addEventListener('click',()=>{const low=data.products.filter(p=>num(p.stock)<=num(p.reorderLevel));const exp=data.products.filter(p=>p.expiryDate&&(new Date(`${p.expiryDate}T23:59:59`).getTime()-Date.now())<=30*86400000);const list=[...low.map(p=>`${p.name}: LOW STOCK (${p.stock} left)`),...exp.map(p=>`${p.name}: expiry ${p.expiryDate}`)];toast(list.length?list.slice(0,4).join(' · '):'No current stock or expiry alerts.');});
$('yearNow').textContent=String(new Date().getFullYear());

if(configReady) {
  try { const app=initializeApp(FIREBASE_CONFIG);auth=getAuth(app);db=getFirestore(app);setPersistence(auth,browserLocalPersistence).catch(console.error); }
  catch(e){console.error(e);}
}
if(!configReady) { setAuthError('Setup required: open app.js and replace FIREBASE_CONFIG placeholders with your Firebase Web App values.'); }
if(auth) onAuthStateChanged(auth,async user=>{
  currentUser=user;
  if(!user){stopWatchers();showAuth();return;}
  try { await ensureBusiness(user);await loadBusiness();showApp();$('userDisplayName').textContent=user.displayName||'Poultry Medicine Manager user';$('userEmail').textContent=user.email||'';$('userAvatar').textContent=(user.displayName||user.email||'U').slice(0,1).toUpperCase();startWatchers();navigate(activePage); }
  catch(e){console.error(e);toast(e.message||'Could not open business workspace.',true);showAuth();}
});
