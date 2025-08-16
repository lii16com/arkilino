# Arkilino Sync Server v3

خادم Node.js + Express بسيط يخزّن المنتجات / الطلبات / الدردشة في `data.json`.
جاهز للنشر على Render.

## تشغيل محلي
```bash
npm install
npm start
```
المنفذ يُقرأ من `PORT` أو 8080 افتراضيًا.

## متغيرات البيئة (اختيارية)
- `PORT` منفذ التشغيل
- `DB_PATH` مسار ملف التخزين (افتراضي `data.json`)
- `ADMIN_PIN` رقم سري بسيط لحماية بعض المسارات (أرسل الهيدر `x-admin-pin` بنفس القيمة)

## المسارات
- `GET /`          → معلومات عامة
- `GET /health`    → `{ ok: true }`
- `GET /products`  → يرجّع المنتجات
- `POST /products` → يستقبل **مصفوفة** منتجات ويستبدلها (يتطلب `x-admin-pin` إذا تم ضبط `ADMIN_PIN`)
- `GET /orders`    → يرجّع الطلبات (يتطلب `x-admin-pin` إذا تم ضبط `ADMIN_PIN`)
- `POST /orders`   → يضيف طلب جديد
- `GET /chat`      → قائمة كل الدردشات أو دردشة مستخدم إذا حدّدت `?userId=` (يتطلب `x-admin-pin` إذا تم ضبط `ADMIN_PIN`)
- `POST /chat`     → يضيف رسالة `{ userId, msg:{ me, text, ts? }, name?, phone? }`
