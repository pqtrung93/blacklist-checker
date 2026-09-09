# Blacklist Checker

Kiểm tra blacklist khách hàng tự động trên TikTok Shop, Shopee, Sapo.

## Thành phần

- **API** — Node.js/Express + SQLite, port 7070
- **Extension** — Chrome/Edge MV3, inject vào seller pages, highlight red border
- **Popup** — tra cứu thủ công, thêm entry, export CSV

---

## Cài đặt API

### Option 1: Chạy trực tiếp (Node.js)

```bash
cd /mnt/blockstore/blacklist-checker/api
npm install
npm run build
node dist/index.js
```

### Option 2: Docker

```bash
cd /mnt/blockstore/blacklist-checker
docker compose up -d
```

API chạy tại `http://localhost:7070`. DB lưu tại `./data/blacklist.db`.

---

## Cài đặt Extension

1. Mở Chrome → `chrome://extensions/`
2. Bật **Developer mode** (góc trên phải)
3. Click **Load unpacked**
4. Chọn thư mục `/mnt/blockstore/blacklist-checker/extension`
5. Extension xuất hiện trên toolbar

> Extension chỉ hoạt động khi API đang chạy tại `http://localhost:7070`.
> Có thể đổi API URL trong popup → tab **Cài đặt**.

---

## API Endpoints

| Method | Path | Mô tả |
|--------|------|-------|
| `GET` | `/health` | Health check |
| `POST` | `/api/check` | Tra cứu blacklist |
| `GET` | `/api/blacklist` | Danh sách (có phân trang, tìm kiếm) |
| `POST` | `/api/blacklist` | Thêm entry |
| `DELETE` | `/api/blacklist/:id` | Xóa entry |
| `GET` | `/api/blacklist/export` | Export CSV |

### POST /api/check

```json
// Request
{ "phone": "0901234567", "name": "Nguyen Van A" }

// Response — matched
{
  "matched": true,
  "matches": [{
    "entry": { "id": 1, "phone": "0901234567", "reason": "Bom hang", "severity": "high", ... },
    "matched_fields": ["phone"]
  }]
}

// Response — clean
{ "matched": false, "matches": [] }
```

### POST /api/blacklist

```json
{
  "phone": "0901234567",
  "name": "Nguyen Van A",
  "address": "123 Le Loi Q1",
  "email": "test@email.com",
  "reason": "Bom hang nhieu lan",
  "severity": "high"
}
```

---

## Matching Logic

| Field | Cách so sánh |
|-------|-------------|
| `phone` | Exact match sau khi normalize (chỉ giữ digits) |
| `name` | Partial match, case-insensitive |
| `address` | Partial match, case-insensitive |
| `email` | Exact match, case-insensitive |

---

## Platforms được hỗ trợ

| Platform | URL |
|----------|-----|
| TikTok Shop | `seller-vn.tiktok.com/order*` |
| Shopee | `banhang.shopee.vn/portal/sale/order*` |
| Sapo | `*.mysapo.net/orders*`, `app.sapo.vn/orders*` |

Extension dùng MutationObserver để detect SPA navigation — tự động check khi mở order detail.

---

## Cấu trúc project

```
blacklist-checker/
├── api/                  # Backend TypeScript
│   ├── src/
│   │   ├── index.ts      # Express entry
│   │   ├── db.ts         # SQLite setup
│   │   ├── types.ts      # Shared types
│   │   └── routes/
│   │       ├── check.ts
│   │       └── blacklist.ts
│   └── Dockerfile
├── extension/            # Chrome Extension MV3
│   ├── manifest.json
│   ├── background.js
│   ├── content/
│   │   ├── content.js    # Inject + highlight logic
│   │   └── styles.css
│   └── popup/
│       ├── popup.html
│       └── popup.js
├── data/                 # SQLite DB (persistent)
└── docker-compose.yml
```
