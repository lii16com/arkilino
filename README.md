# Arkilino Sync Server — Fixed v4

## Quick Start (Render)
- Build Command: `npm install`
- Start Command: `npm start`
- Root Directory: (leave empty)
- Environment Variables (optional): `ADMIN_PIN=1111`

## Test
- `GET /health` → `{ ok: true }`
- `GET /products` → `[]`
- `POST /orders` with JSON:
```json
{
  "id": "12345678",
  "items": [{ "title":"أركيلة كلاسيك", "qty":1, "price":8000 }],
  "total": 8000,
  "customer": { "name":"محمد", "phone":"9647xxxxxxxx", "addr":"..." }
}
```
- `POST /chat` with JSON:
```json
{
  "userId": "u123",
  "name": "محمد",
  "phone": "9647xxxxxxxx",
  "msg": { "text": "مرحبا", "me": false }
}
```

CORS is enabled for all origins by default.
