// Arkilino Sync Server — Fixed v4
// Works on Render. Endpoints:
//  GET  /health              -> {ok:true}
//  GET  /products            -> [ ... ]
//  POST /products            -> overwrite products (array)
//  GET  /orders              -> [ ... ] (optional auth)
//  POST /orders              -> append order {id, ts, items, total, customer, status}
//  GET  /chat?userId=...     -> thread for user, or all threads
//  POST /chat                -> { userId, msg:{me?,text,ts?}, name?, phone? }
//
// Notes:
//  - Uses process.env.PORT (Render) and CORS enabled.
//  - ADMIN_PIN optional: if set, required for POST /products, GET /orders, GET /chat (admin views).
//  - Stores in data.json safely (atomic write).

const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data.json');
const ADMIN_PIN = process.env.ADMIN_PIN || '';

app.use(cors({ origin: '*', methods: ['GET','POST','OPTIONS'], allowedHeaders: ['Content-Type','x-admin-pin'] }));
app.use(express.json({ limit: '2mb' }));
app.use((req,res,next)=>{ if (req.method==='OPTIONS') return res.sendStatus(200); next(); });

// ---- tiny JSON store helpers ----
function load(){
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (e){
    return { products: [], orders: [], chats: {} };
  }
}
function saveAtomic(obj){
  const tmp = DB_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), 'utf8');
  fs.renameSync(tmp, DB_PATH);
}
function requireAdmin(req,res,next){
  if (!ADMIN_PIN) return next();
  if (req.headers['x-admin-pin'] === ADMIN_PIN) return next();
  return res.status(401).json({ error:'unauthorized' });
}

// ---- basic ----
app.get('/health', (_req,res)=> res.json({ ok:true }));
app.get('/', (_req,res)=> res.json({ ok:true, service:'arkilino-sync', endpoints:['/products','/orders','/chat'] }));

// ---- products ----
app.get('/products', (_req,res)=>{
  const db = load();
  res.json(db.products || []);
});
app.post('/products', requireAdmin, (req,res)=>{
  const arr = Array.isArray(req.body) ? req.body : null;
  if (!arr) return res.status(400).json({ error:'expected array body' });
  const db = load();
  db.products = arr;
  saveAtomic(db);
  res.json({ ok:true, count: db.products.length });
});

// ---- orders ----
app.get('/orders', requireAdmin, (_req,res)=>{
  const db = load();
  const out = Array.isArray(db.orders) ? db.orders.slice().sort((a,b)=>(b.ts||0)-(a.ts||0)) : [];
  res.json(out);
});
app.post('/orders', (req,res)=>{
  const o = req.body || {};
  if (!o || !o.id || !o.items || !o.customer) {
    return res.status(400).json({ error:'invalid order payload' });
  }
  const db = load();
  db.orders = db.orders || [];
  // ensure ts/status
  o.ts = o.ts || new Date().toISOString();
  o.status = o.status || 'تم استلام طلبك';
  db.orders.push(o);
  saveAtomic(db);
  res.json({ ok:true });
});

// ---- chat ----
app.get('/chat', requireAdmin, (req,res)=>{
  const db = load();
  const uid = req.query.userId;
  if (uid){
    return res.json(db.chats?.[uid] || { userId: uid, msgs: [] });
  }
  const out = Object.entries(db.chats || {}).map(([userId, t])=> ({
    userId, name: t.name||'', phone: t.phone||'', msgs: t.msgs||[]
  }));
  res.json(out);
});
app.post('/chat', (req,res)=>{
  const { userId, msg, name, phone } = req.body || {};
  if (!userId || !msg || typeof msg.text !== 'string'){
    return res.status(400).json({ error:'invalid payload' });
  }
  const db = load();
  db.chats = db.chats || {};
  const thread = db.chats[userId] || { userId, name: name||'', phone: phone||'', msgs: [] };
  // update name/phone if newly provided
  if (name && !thread.name) thread.name = name;
  if (phone && !thread.phone) thread.phone = phone;
  thread.msgs.push({ me: !!msg.me, text: msg.text, ts: msg.ts || Date.now() });
  db.chats[userId] = thread;
  saveAtomic(db);
  res.json({ ok:true });
});

// ---- start ----
app.listen(PORT, ()=> console.log('Arkilino sync server running on :' + PORT));
