// ====== Helpers & Safe JSON ======
function safeGet(key, fallback){
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch(e){ return fallback; }
}
function safeSet(key, val){ try { localStorage.setItem(key, JSON.stringify(val)); } catch(e){} }

// ====== Storage Keys ======
const LS = {
  PRODUCTS: 'ark_products_v5_1',
  CART: 'ark_cart_v5_1',
  ORDERS: 'ark_orders_v5_1',
  SETTINGS: 'ark_settings_v5_1',
  ADMIN_UNLOCK: 'ark_admin_unlocked_v5_1',
  PROFILE: 'ark_profile_v5_1',
  NOTIFS: 'ark_notifs_v5_1',
  CHATS: 'ark_chats_v5_1'
};

// Settings
let settings = safeGet(LS.SETTINGS, { pin:'1111', sync:'' });
safeSet(LS.SETTINGS, settings);

const el = (s)=>document.querySelector(s);
const els = (s)=>document.querySelectorAll(s);
const fmt = (n)=> (n||0).toLocaleString('ar-IQ');
function toast(t){ const box = el('#toast'); if(!box) return; box.querySelector('.box').textContent = t; box.classList.remove('hidden'); setTimeout(()=>box.classList.add('hidden'), 1600); }

// Install button visibility
const btnInstall = el('#btnInstall');
function hideInstallIfStandalone(){
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone || localStorage.getItem('ark_installed')==='1';
  if (isStandalone && btnInstall) btnInstall.classList.add('hidden');
}
hideInstallIfStandalone();
window.addEventListener('appinstalled', ()=>{ localStorage.setItem('ark_installed','1'); if(btnInstall) btnInstall.classList.add('hidden'); });
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e)=>{ e.preventDefault(); deferredPrompt = e; if (!localStorage.getItem('ark_installed') && btnInstall) btnInstall.classList.remove('hidden'); });
if (btnInstall) btnInstall.addEventListener('click', async ()=>{ if (!deferredPrompt) return; deferredPrompt.prompt(); const choice = await deferredPrompt.userChoice; if (choice.outcome==='accepted'){ localStorage.setItem('ark_installed','1'); btnInstall.classList.add('hidden'); } deferredPrompt=null; });

// UI Refs
const productsEl = el('#products');
const cartBtn = el('#cartBtn');
const cartCountEl = el('#cartCount');
const cartModal = el('#cartModal');
const closeCart = el('#closeCart');

const listCart = el('#cartItems');
const totalEl = el('#total');
const clearBtn = el('#clearCart');
const checkoutBtn = el('#checkout');

const custName = el('#custName');
const custPhone = el('#custPhone');
const custAddr = el('#custAddr');

const brand = el('#brand');
const adminModal = el('#adminModal');

const notif = el('#notif');
const notifBody = el('#notifBody');
const notifBtn = el('#notifyBtn');
const notifClose = el('#notifClose');

// Chat
const openChatBtn = el('#openChat');
const chat = el('#chat');
const chatClose = el('#chatClose');
const chatMsgs = el('#chatMsgs');
const chatInput = el('#chatInput');
const chatSend = el('#chatSend');

// Tabs
const tabProducts = el('#tabProducts');
const tabOrders = el('#tabOrders');
const tabChat = el('#tabChat');
const tabSettings = el('#tabSettings');
els('#adminModal [data-tab]').forEach(b=>b.addEventListener('click',()=>{
  const id = b.getAttribute('data-tab');
  [tabProducts, tabOrders, tabChat, tabSettings].forEach(t=> t && t.classList.add('hidden'));
  const target = el('#'+id); if (target) target.classList.remove('hidden');
  if (id==='tabOrders') renderOrders();
  if (id==='tabChat') renderChats();
  if (id==='tabProducts') renderAdminProducts();
  if (id==='tabSettings') renderSettings();
}));

// Data
let PRODUCTS = [];
let CART = safeGet(LS.CART, []);
let ORDERS = safeGet(LS.ORDERS, []);
let NOTIFS = safeGet(LS.NOTIFS, []);
let CHATS = safeGet(LS.CHATS, []); // [{userId, name, phone, msgs:[{me:boolean,text,ts}], unread:int}]

// Profile (for chat first time)
let PROFILE = safeGet(LS.PROFILE, null);

function saveProducts(){ safeSet(LS.PRODUCTS, PRODUCTS); }
function saveCart(){ safeSet(LS.CART, CART); }
function saveOrders(){ safeSet(LS.ORDERS, ORDERS); }
function saveSettings(){ safeSet(LS.SETTINGS, settings); }
function saveNotifs(){ safeSet(LS.NOTIFS, NOTIFS); }
function saveChats(){ safeSet(LS.CHATS, CHATS); }

// ---------- Sync (optional) ----------
async function syncFetchProducts(){
  const local = safeGet(LS.PRODUCTS, []);
  if (settings.sync){
    try{
      const r = await fetch(settings.sync + '/products', { cache:'no-store' });
      if (r.ok){ PRODUCTS = await r.json(); saveProducts(); }
      else { PRODUCTS = local.length ? local : seedDefaults(); }
    }catch(e){ PRODUCTS = local.length ? local : seedDefaults(); }
  } else {
    PRODUCTS = local.length ? local : seedDefaults();
  }
  renderProducts();
}
function seedDefaults(){
  const p = [
    { id: 'h1', title: 'أركيلة كلاسيك', price: 10000, img: 'images/h1.jpg', cat:'كلاسيك', extras:[{name:'فحم زيادة', price:2000}] },
    { id: 'h2', title: 'أركيلة ستيل PRO', price: 15000, img: 'images/h2.jpg', cat:'ستيل', extras:[{name:'خرطوم إضافي', price:3000}] },
    { id: 'h3', title: 'طقم فحم + ملقط', price: 3000, img: 'images/h3.jpg', cat:'مستلزمات', extras:[] },
    { id: 'h4', title: 'نكات ومعسّل مختار', price: 4000, img: 'images/h4.jpg', cat:'نكهات', extras:[{name:'نكة إضافية', price:1500}] }
  ];
  safeSet(LS.PRODUCTS, p);
  return p;
}
async function syncPushProducts(){
  if (!settings.sync) return;
  try{ await fetch(settings.sync + '/products', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(PRODUCTS) }); }catch(e){}
}
async function syncPushOrder(o){
  if (!settings.sync) return;
  try{ await fetch(settings.sync + '/orders', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(o) }); }catch(e){}
}
async function syncPushChat(userId, msg){
  if (!settings.sync) return;
  try{ await fetch(settings.sync + '/chat', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ userId, msg }) }); }catch(e){}
}

// BroadcastChannel for same-device multi-tabs sync
const bc = ('BroadcastChannel' in window) ? new BroadcastChannel('arkilino-sync') : null;
if (bc){
  bc.onmessage = (ev)=>{
    const { type, payload } = ev.data || {};
    if (type==='products:update'){ PRODUCTS = payload; saveProducts(); renderProducts(); }
    if (type==='orders:new'){ ORDERS.unshift(payload); saveOrders(); note(`طلب جديد #${payload.id}`); }
    if (type==='chat:msg'){ receiveChat(payload.userId, payload.msg); }
  };
}
function bcPost(type, payload){ if (bc) bc.postMessage({ type, payload }); }

// ---------- Products UI (2x2, no date) ----------
function renderProducts(){
  if (!productsEl) return;
  productsEl.innerHTML = '';
  PRODUCTS.forEach(p=>{
    const card = document.createElement('div');
    card.className = 'card';
    const extrasHtml = (p.extras||[]).map((e,i)=>`
      <label style="display:flex;gap:6px;align-items:center">
        <input type="checkbox" data-extra="${i}"> ${e.name} (+${fmt(e.price)})
      </label>`).join('');
    card.innerHTML = `
      <img src="${p.img}" alt="${p.title}">
      <div class="p">
        <h3 class="title">${p.title}</h3>
        <p class="muted">الصنف: ${p.cat||'-'}</p>
        <p class="muted">السعر/يوم: ${fmt(p.price)} د.ع</p>
        <details class="muted" style="margin:8px 0"><summary>إضافات</summary>${extrasHtml||'<span class="muted">لا توجد إضافات</span>'}</details>
        <div class="row" style="gap:8px">
          <button data-id="${p.id}">إضافة للسلة</button>
        </div>
      </div>`;
    card.querySelector('button').addEventListener('click', (e)=>{
      const id = e.currentTarget.dataset.id;
      const extrasIdx = [...card.querySelectorAll('[data-extra]:checked')].map(x=>parseInt(x.dataset.extra));
      addToCart(id, extrasIdx);
      openCart(true);
    });
    productsEl.appendChild(card);
  });
}

// ---------- Cart Fullscreen ----------
function openCart(on){
  if (!cartModal) return;
  cartModal.classList.toggle('open', !!on);
  document.body.style.overflow = on? 'hidden':'auto';
  const main = document.querySelector('main'); const header = document.querySelector('header');
  if (main) main.classList.toggle('disabled', !!on);
  if (header) header.classList.toggle('disabled', !!on);
}
if (cartBtn) cartBtn.addEventListener('click', ()=> openCart(true));
if (closeCart) closeCart.addEventListener('click', ()=> openCart(false));

function addToCart(id, extrasIdx=[]){
  const prod = PRODUCTS.find(x=>x.id===id);
  if (!prod) return;
  const extras = (prod.extras||[]).filter((e,i)=> extrasIdx.includes(i));
  const item = { pid: id, title: prod.title, price: prod.price, img: prod.img, qty: 1, extras };
  CART.push(item);
  saveCart();
  renderCart();
  toast('انضاف للسلة');
}

function removeItem(i){
  CART.splice(i,1);
  saveCart();
  renderCart();
}

function renderCart(){
  if (!listCart) return;
  listCart.innerHTML = '';
  let sum = 0;
  CART.forEach((it, i)=>{
    const extrasTotal = (it.extras||[]).reduce((a,b)=>a+(b.price||0),0);
    const lineTotal = (it.price + extrasTotal) * (it.qty||1);
    sum += lineTotal;
    const wrap = document.createElement('div');
    wrap.className = 'line';
    wrap.innerHTML = `
      <img src="${it.img}" alt="${it.title}">
      <div style="flex:1">
        <div class="row">
          <strong>${it.title}</strong>
          <button class="danger" data-i="${i}">حذف</button>
        </div>
        <div class="muted">${(it.extras||[]).map(e=>`• ${e.name} (+${fmt(e.price)})`).join(' ')||'بدون إضافات'}</div>
        <div class="row" style="gap:8px;margin-top:6px">
          <button class="ghost minus" data-i="${i}">−</button>
          <span>${it.qty||1}</span>
          <button class="ghost plus" data-i="${i}">+</button>
          <div class="spacer"></div>
          <div><strong>${fmt(lineTotal)}</strong> د.ع</div>
        </div>
      </div>`;
    wrap.querySelector('.danger').addEventListener('click', (e)=> removeItem(parseInt(e.currentTarget.dataset.i)));
    wrap.querySelector('.minus').addEventListener('click', (e)=>{
      const idx = parseInt(e.currentTarget.dataset.i);
      CART[idx].qty = Math.max(1, (CART[idx].qty||1)-1);
      saveCart(); renderCart();
    });
    wrap.querySelector('.plus').addEventListener('click', (e)=>{
      const idx = parseInt(e.currentTarget.dataset.i);
      CART[idx].qty = (CART[idx].qty||1)+1;
      saveCart(); renderCart();
    });
    listCart.appendChild(wrap);
  });
  if (totalEl) totalEl.textContent = fmt(sum);
  if (cartCountEl) cartCountEl.textContent = CART.length;
}

// Clear cart
if (clearBtn) clearBtn.addEventListener('click', ()=>{ CART = []; saveCart(); renderCart(); toast('انمسحت السلة'); });

// ---------- Checkout (internal notify only) ----------
if (checkoutBtn) checkoutBtn.addEventListener('click', async ()=>{
  if (CART.length===0) return toast('السلة فارغة');
  if (!custName.value || !custPhone.value || !custAddr.value) return toast('كمّل معلومات الزبون');
  const orderId = Date.now().toString().slice(-8);
  const order = {
    id: orderId,
    ts: new Date().toISOString(),
    items: CART.map(x=>({ title:x.title, qty:x.qty||1, price:x.price, extras:x.extras||[] })),
    total: CART.reduce((a,b)=> a + (b.price + (b.extras||[]).reduce((aa,bb)=>aa+bb.price,0))*(b.qty||1), 0),
    customer: { name:custName.value, phone:custPhone.value, addr:custAddr.value },
    status: 'تم استلام طلبك'
  };
  ORDERS.unshift(order); saveOrders();
  note(`طلب جديد #${order.id} بقيمة ${fmt(order.total)} د.ع`);
  // Broadcast + optional sync
  bcPost('orders:new', order);
  syncPushOrder(order);
  CART = []; saveCart(); renderCart(); openCart(false);
});

// ---------- Notifications Center ----------
function note(text){ NOTIFS.unshift({ text, ts: Date.now() }); saveNotifs(); if (notifBtn) notifBtn.classList.add('has'); }
function renderNotifs(){
  if (!notifBody) return;
  notifBody.innerHTML = NOTIFS.map(n=>`<div class="line"><div>${n.text}</div><div class="spacer"></div><span class="muted">${new Date(n.ts).toLocaleString('ar-IQ')}</span></div>`).join('') || '<div class="line"><div>لا توجد إشعارات</div></div>';
}
if (notifBtn) notifBtn.addEventListener('click', ()=>{ renderNotifs(); if (notif) notif.classList.add('open'); notifBtn.classList.remove('has'); });
if (notifClose) notifClose.addEventListener('click', ()=> notif && notif.classList.remove('open'));

// ---------- Admin Hidden Entry ----------
let taps = 0; let tapTimer;
if (brand) brand.addEventListener('click', ()=>{
  taps++; clearTimeout(tapTimer);
  tapTimer = setTimeout(()=>taps=0, 1200);
  if (taps >= 5){
    taps = 0;
    const pin = prompt('PIN الإدارة؟');
    if (pin === settings.pin){
      localStorage.setItem(LS.ADMIN_UNLOCK,'1');
      openAdmin(true);
    } else { toast('PIN خطأ'); }
  }
});
if (el('#closeAdmin')) el('#closeAdmin').addEventListener('click', ()=> openAdmin(false));
function openAdmin(on){
  if (!adminModal) return;
  adminModal.style.display = on? 'flex':'none';
  if (on){ renderAdminProducts(); renderOrders(); renderChats(); renderSettings(); }
}

// ---------- Admin: Products (Add/Delete with extras UI) ----------
function renderAdminProducts(){
  const extrasBox = el('#extrasBox'); if (!extrasBox) return;
  extrasBox.innerHTML = '';
  function addExtraRow(name='', price=''){
    const row = document.createElement('div');
    row.className = 'row';
    row.style.gap='8px';
    row.innerHTML = `<input class="input ex-name" placeholder="اسم الإضافة" value="${name}"><input class="input ex-price" type="number" placeholder="السعر" value="${price}"><button class="danger ex-del">حذف</button>`;
    row.querySelector('.ex-del').addEventListener('click', ()=> row.remove());
    extrasBox.appendChild(row);
  }
  addExtraRow();
  const addExtraBtn = el('#addExtra'); if (addExtraBtn) addExtraBtn.onclick = ()=> addExtraRow();

  const box = el('#adminProdList'); if (!box) return;
  box.innerHTML = '';
  PRODUCTS.forEach((p,idx)=>{
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <img src="${p.img}" alt="${p.title}">
      <div class="p">
        <div class="row"><strong>${p.title}</strong><button class="danger" data-i="${idx}">حذف</button></div>
        <div class="muted">السعر: ${fmt(p.price)} | الصنف: ${p.cat||'-'}</div>
        <div class="muted">إضافات: ${(p.extras||[]).map(e=>e.name).join(',')||'—'}</div>
      </div>`;
    card.querySelector('button.danger').addEventListener('click', ()=>{
      if (!confirm('حذف المنتج؟')) return;
      PRODUCTS.splice(idx,1); saveProducts(); renderProducts(); renderAdminProducts(); syncPushProducts(); bcPost('products:update', PRODUCTS);
    });
    box.appendChild(card);
  });

  const addProductBtn = el('#addProduct');
  if (addProductBtn) addProductBtn.onclick = ()=>{
    const t = el('#pTitle').value.trim();
    const pr = parseInt(el('#pPrice').value||'0');
    const cat = el('#pCat').value.trim();
    let img = el('#pImg').value.trim();
    const file = el('#pImgFile').files[0];
    const extras = [...document.querySelectorAll('#extrasBox .row')].map(r=>{
      const name = r.querySelector('.ex-name').value.trim();
      const price = parseInt(r.querySelector('.ex-price').value||'0');
      if (!name) return null;
      return { name, price: price||0 };
    }).filter(Boolean);

    function saveProd(){
      if (!t || !pr){ toast('أكمل الاسم والسعر'); return; }
      const id = 'p' + Date.now().toString().slice(-6);
      PRODUCTS.push({ id, title:t, price:pr, img: img||'icons/icon-192.png', cat, extras });
      saveProducts(); renderProducts(); renderAdminProducts(); syncPushProducts(); bcPost('products:update', PRODUCTS);
      el('#pTitle').value=''; el('#pPrice').value=''; el('#pCat').value=''; el('#pImg').value=''; el('#pImgFile').value=''; extrasBox.innerHTML='';
      toast('انضاف المنتج');
    }

    if (file){
      const reader = new FileReader();
      reader.onload = ()=>{ img = reader.result; saveProd(); };
      reader.readAsDataURL(file);
    } else saveProd();
  };
}

// ---------- Admin: Orders & Status change ----------
function renderOrders(){
  const list = el('#ordersList'); if (!list) return;
  list.innerHTML='';
  ORDERS.forEach((o,idx)=>{
    const div = document.createElement('div');
    div.className = 'line';
    div.innerHTML = `
      <div style="flex:1">
        <div class="row"><strong>طلب #${o.id}</strong><span class="muted">${new Date(o.ts).toLocaleString('ar-IQ')}</span></div>
        <div class="muted">العميل: ${o.customer.name} (${o.customer.phone}) — ${o.customer.addr}</div>
        <div class="muted">${o.items.map(i=>`• ${i.title} × ${i.qty} | إضافات: ${(i.extras||[]).map(e=>e.name).join('+')||'لا يوجد'}`).join('<br>')}</div>
        <div class="row" style="margin-top:8px">
          <span class="badge">الحالة: ${o.status}</span>
          <div class="spacer"></div>
          <button class="ghost st" data-st="تم استلام طلبك" data-i="${idx}">استلام</button>
          <button class="ghost st" data-st="تم تجهيز طلبك" data-i="${idx}">تجهيز</button>
          <button class="ghost st" data-st="طلبك قيد التوصيل" data-i="${idx}">بالتوصيل</button>
          <button class="ghost st" data-st="تم التسليم" data-i="${idx}">تسليم</button>
        </div>
      </div>`;
    list.appendChild(div);
  });
  list.querySelectorAll('.st').forEach(b=> b.addEventListener('click', (e)=>{
    const st = e.currentTarget.getAttribute('data-st');
    const i = parseInt(e.currentTarget.getAttribute('data-i'));
    ORDERS[i].status = st; saveOrders(); renderOrders();
    note(`${st} (#${ORDERS[i].id})`);
  }));
}

// ---------- Admin: Chat per user ----------
function renderChats(){
  const list = el('#chatsList'); if (!list) return;
  list.innerHTML = '';
  CHATS.forEach((c,idx)=>{
    const div = document.createElement('div');
    div.className = 'line';
    div.innerHTML = `<div style="flex:1">
      <div class="row"><strong>${c.name||'مستخدم'}</strong><span class="muted">${c.phone||''}</span></div>
      <div class="muted">${(c.msgs||[]).slice(-3).map(m=> (m.me?'أنا: ':'هو: ')+m.text).join(' | ')}</div>
      <div class="row" style="margin-top:6px">
        <input class="input reply" placeholder="رد...">
        <button class="ghost send" data-i="${idx}">إرسال</button>
      </div>
    </div>`;
    div.querySelector('.send').addEventListener('click', ()=>{
      const inp = div.querySelector('.reply');
      const text = inp.value.trim(); if (!text) return;
      c.msgs.push({ me:true, text, ts: Date.now() });
      c.unread = 0; saveChats(); inp.value=''; renderChats();
      note('رسالة من المدير');
      syncPushChat(c.userId, { me:true, text, ts: Date.now() });
      bcPost('chat:msg', { userId:c.userId, msg:{ me:true, text, ts: Date.now() } });
    });
    list.appendChild(div);
  });
}

// receive chat via bc
function receiveChat(userId, msg){
  let c = CHATS.find(x=>x.userId===userId);
  if (!c) return;
  c.msgs.push(msg); saveChats();
}

// ---------- Chat FAB (user) ----------
if (openChatBtn) openChatBtn.addEventListener('click', ()=>{
  if (chat) chat.style.display = 'block';
  ensureProfile().then(()=> renderUserChat());
});
if (chatClose) chatClose.addEventListener('click', ()=> { if (chat) chat.style.display = 'none'; });

async function ensureProfile(){
  if (PROFILE) return;
  const name = prompt('اسمك الكامل؟'); if (!name) return;
  const phone = prompt('رقم هاتفك؟ (9647XXXXXXXX)'); if (!phone) return;
  PROFILE = { name, phone, userId: 'u'+(Math.random().toString(36).slice(2,8)) };
  safeSet(LS.PROFILE, PROFILE);
  // create chat session for admin
  let c = CHATS.find(x=>x.userId===PROFILE.userId);
  if (!c){ c = { userId: PROFILE.userId, name, phone, msgs:[], unread:0 }; CHATS.push(c); saveChats(); }
  note(`بدأ دردشة: ${name}`);
}

function renderUserChat(){
  let c = CHATS.find(x=>x.userId===PROFILE.userId);
  if (!c){ c = { userId: PROFILE.userId, name: PROFILE.name, phone: PROFILE.phone, msgs:[], unread:0 }; CHATS.push(c); saveChats(); }
  if (!chatMsgs) return;
  chatMsgs.innerHTML = (c.msgs||[]).map(m=>`<div class="msg ${m.me?'me':'them'}">${m.text}</div>`).join('');
  chatMsgs.scrollTop = chatMsgs.scrollHeight;
}
if (chatSend) chatSend.addEventListener('click', ()=>{
  if (!PROFILE){ return ensureProfile(); }
  const text = chatInput.value.trim(); if (!text) return;
  const c = CHATS.find(x=>x.userId===PROFILE.userId);
  c.msgs.push({ me:false, text, ts: Date.now() }); saveChats(); chatInput.value=''; renderUserChat();
  note(`رسالة جديدة من ${PROFILE.name}`);
  syncPushChat(PROFILE.userId, { me:false, text, ts: Date.now() });
  bcPost('chat:msg', { userId: PROFILE.userId, msg: { me:false, text, ts: Date.now() } });
});

// ---------- Settings UI ----------
function renderSettings(){
  const pin = el('#adminPIN'); const sync = el('#syncUrl');
  if (pin) pin.value = settings.pin||'';
  if (sync) sync.value = settings.sync||'';
}
if (el('#saveSettings')) el('#saveSettings').addEventListener('click', ()=>{
  const pin = el('#adminPIN'); const sync = el('#syncUrl');
  if (pin) settings.pin = pin.value.trim() || settings.pin;
  if (sync) settings.sync = sync.value.trim();
  saveSettings(); toast('انحفظت الإعدادات');
});

// ---------- Init ----------
function init(){
  syncFetchProducts();
  renderCart();
}
init();
