// Arkilino Sync Server v3 (Express + File JSON storage)
//
// Endpoints:
//   GET  /            -> info
//   GET  /health      -> { ok: true }
//   GET  /products    -> [ ... ]
//   POST /products    -> overwrite products array (requires x-admin-pin if ADMIN_PIN is set)
//   GET  /orders      -> [ ... ] (requires x-admin-pin if ADMIN_PIN is set)
//   POST /orders      -> append order { id?, ts, items, total, customer, status }
//   GET  /chat        -> all chats overview (requires x-admin-pin if ADMIN_PIN is set)
//   GET  /chat?userId=U -> chat thread for specific user (requires x-admin-pin if ADMIN_PIN is set)
//   POST /chat        -> { userId, msg:{ me, text, ts? }, name?, phone? } -> append to thread
//
// Notes:
// - Uses a simple write queue to avoid concurrent file writes.
// - CORS is open for simplicity. Add your domain if you want to restrict it.
// - Set ADMIN_PIN to enable simple admin protection for GET /orders and GET /chat.
//
// Start: `node server.js`
// Port is provided by Render via process.env.PORT automatically.

const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data.json');
const ADMIN_PIN = process.env.ADMIN_PIN || '';

// --------------- Middleware ---------------
app.use(express.json({ limit: '3mb' }));

// CORS (open)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-pin');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

function requireAdmin(req, res, next){
  if (!ADMIN_PIN) return next();
  if (req.headers['x-admin-pin'] === ADMIN_PIN) return next();
  return res.status(401).json({ error: 'unauthorized' });
}

// --------------- Storage Helpers ---------------
function ensureDb(){
  try {
    if (!fs.existsSync(DB_PATH)){
      const init = { products: [], orders: [], chats: {} };
      fs.writeFileSync(DB_PATH, JSON.stringify(init, null, 2), 'utf8');
    }
  } catch (e){ console.error('ensureDb error:', e); }
}
ensureDb();

function load(){
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (e){
    console.error('load error:', e);
    return { products: [], orders: [], chats: {} };
  }
}

// Simple write queue to avoid concurrent writes
let queue = Promise.resolve();
function save(mutator){
  queue = queue.then(() => new Promise((resolve) => {
    try {
      const db = load();
      const out = mutator(db) || db;
      fs.writeFileSync(DB_PATH, JSON.stringify(out, null, 2), 'utf8');
      resolve();
    } catch (e){
      console.error('save error:', e);
      resolve();
    }
  }));
  return queue;
}

// --------------- Endpoints ---------------
app.get('/', (req,res)=>{
  res.json({ ok:true, service:'arkilino-sync-v3', endpoints:['/health','/products','/orders','/chat'] });
});
app.get('/health', (req,res)=> res.json({ ok:true }));

// Products
app.get('/products', (req,res)=>{
  const db = load();
  res.json(Array.isArray(db.products) ? db.products : []);
});
app.post('/products', requireAdmin, (req,res)=>{
  const arr = Array.isArray(req.body) ? req.body : null;
  if (!arr) return res.status(400).json({ error:'expected array body' });
  save(db => { db.products = arr; return db; })
    .then(()=> res.json({ ok:true, count: arr.length }));
});

// Orders
app.get('/orders', requireAdmin, (req,res)=>{
  const db = load();
  const list = Array.isArray(db.orders) ? db.orders : [];
  list.sort((a,b)=> (new Date(b.ts||0)) - (new Date(a.ts||0)));
  res.json(list);
});
app.post('/orders', (req,res)=>{
  const o = req.body || {};
  if (!o.id) o.id = String(Date.now()).slice(-8);
  if (!o.ts) o.ts = new Date().toISOString();
  save(db => { db.orders = db.orders || []; db.orders.push(o); return db; })
    .then(()=> res.json({ ok:true, id:o.id }));
});

// Chat
app.get('/chat', requireAdmin, (req,res)=>{
  const db = load();
  const userId = req.query.userId;
  if (userId){
    return res.json(db.chats?.[userId] || { userId, name:'', phone:'', msgs:[] });
  }
  const out = Object.entries(db.chats || {}).map(([uid, thread]) => ({
    userId: uid,
    name: thread.name || '',
    phone: thread.phone || '',
    last: (thread.msgs || []).slice(-1)[0] || null,
    count: (thread.msgs || []).length
  }));
  res.json(out);
});
app.post('/chat', (req,res)=>{
  const { userId, msg, name, phone } = req.body || {};
  if (!userId || !msg || typeof msg.text !== 'string'){
    return res.status(400).json({ error:'invalid payload' });
  }
  const message = { me: !!msg.me, text: String(msg.text), ts: msg.ts || Date.now() };
  save(db => {
    db.chats = db.chats || {};
    const thread = db.chats[userId] || { userId, name: name || '', phone: phone || '', msgs: [] };
    if (name && !thread.name) thread.name = name;
    if (phone && !thread.phone) thread.phone = phone;
    thread.msgs.push(message);
    db.chats[userId] = thread;
    return db;
  }).then(()=> res.json({ ok:true }));
});

// --------------- Start ---------------
app.listen(PORT, () => {
  console.log('Arkilino sync server v3 running on :' + PORT);
});
