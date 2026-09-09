# Blacklist Checker — Implementation Plan

## Goal

Hệ thống kiểm tra blacklist khách hàng cho shop online (TikTok Shop, Shopee, Sapo).
- Backend API: lưu trữ và tra cứu blacklist
- Browser Extension: inject vào seller UI, tự động highlight đơn hàng có thông tin trong blacklist
- Popup: tra cứu thủ công

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Browser Extension                   │
│                                                      │
│  content.js          popup.html / popup.js           │
│  ├─ inject vào       ├─ input: phone/name/address    │
│  │  TikTok/Shopee/   ├─ nút Tra cứu                 │
│  │  Sapo UI          └─ hiển thị kết quả             │
│  └─ highlight red                                    │
│       border + badge                                 │
└──────────────────┬──────────────────────────────────┘
                   │ HTTP (fetch)
                   ▼
┌─────────────────────────────────────────────────────┐
│              Backend API (Node.js/Express)           │
│                                                      │
│  POST /api/check     — tra cứu 1 hoặc nhiều fields  │
│  GET  /api/blacklist — list toàn bộ                 │
│  POST /api/blacklist — thêm entry                   │
│  DELETE /api/blacklist/:id — xóa entry              │
│  GET  /api/blacklist/export — export CSV            │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│              SQLite (better-sqlite3)                 │
│                                                      │
│  table: blacklist                                    │
│  ├─ id, phone, name, address, email                 │
│  ├─ reason, severity (low/medium/high)              │
│  └─ created_at, added_by                            │
└─────────────────────────────────────────────────────┘
```

---

## Stack

| Layer | Tech |
|---|---|
| Backend | Node.js + Express + TypeScript |
| DB | SQLite via better-sqlite3 (zero-dep, file-based) |
| Extension | Vanilla JS + Manifest V3 (Chrome/Edge) |
| Popup UI | HTML + CSS + vanilla JS |
| Deploy | Docker, port 7070, data tại /mnt/blockstore/blacklist-checker/data/ |

---

## Data Model

```typescript
interface BlacklistEntry {
  id: number;
  phone: string | null;       // normalized: digits only
  name: string | null;        // lowercase, trim
  address: string | null;     // lowercase, trim
  email: string | null;       // lowercase
  reason: string;
  severity: 'low' | 'medium' | 'high';
  created_at: string;         // ISO8601
  added_by: string;           // 'manual' | 'extension' | 'import'
}

interface CheckRequest {
  phone?: string;
  name?: string;
  address?: string;
  email?: string;
}

interface CheckResult {
  matched: boolean;
  matches: Array<{
    entry: BlacklistEntry;
    matched_fields: string[];  // ['phone', 'name']
  }>;
}
```

---

## API Endpoints

### `POST /api/check`
```json
// Request
{ "phone": "0901234567", "name": "Nguyen Van A" }

// Response
{
  "matched": true,
  "matches": [
    {
      "entry": { "id": 1, "phone": "0901234567", "reason": "Fraud", "severity": "high", ... },
      "matched_fields": ["phone"]
    }
  ]
}
```

### `GET /api/blacklist?page=1&limit=50&q=keyword`
### `POST /api/blacklist` — thêm entry mới
### `DELETE /api/blacklist/:id`
### `GET /api/blacklist/export` — CSV download

---

## Browser Extension — Content Scripts

### Platform selectors

| Platform | URL match | Order info selectors |
|---|---|---|
| TikTok Shop | `seller-vn.tiktok.com/order*` | `.order-detail`, buyer name/phone fields |
| Shopee | `banhang.shopee.vn/portal/sale/order*` | `.order-info`, buyer section |
| Sapo | `*.mysapo.net/orders*` hoặc `app.sapo.vn/orders*` | `.order-detail-info` |

### Inject logic (content.js)

```
1. MutationObserver theo dõi DOM changes (SPA navigation)
2. Khi detect order detail page → extract phone/name/address
3. POST /api/check với data extracted
4. Nếu matched:
   - Wrap element với red border (outline: 2px solid #ef4444)
   - Inject badge "⚠️ BLACKLIST" màu đỏ kế bên field
   - Console.warn với details
5. Debounce 500ms để tránh spam API
```

### Highlight style
```css
.blacklist-warning-field {
  outline: 2px solid #ef4444 !important;
  background: #fef2f2 !important;
}
.blacklist-badge {
  display: inline-block;
  background: #ef4444;
  color: white;
  font-size: 11px;
  font-weight: bold;
  padding: 2px 6px;
  border-radius: 3px;
  margin-left: 6px;
}
```

---

## Extension Popup

- Input fields: Số điện thoại, Tên, Địa chỉ, Email
- Nút "Tra cứu" → POST /api/check
- Kết quả: hiển thị matched entries với severity badge
- Nút "Thêm vào blacklist" nếu chưa có
- Settings tab: cấu hình API URL (default: http://localhost:7070)

---

## Project Structure

```
/mnt/blockstore/blacklist-checker/
├── api/                        # Backend
│   ├── src/
│   │   ├── index.ts            # Express app entry
│   │   ├── db.ts               # SQLite setup + migrations
│   │   ├── routes/
│   │   │   ├── check.ts        # POST /api/check
│   │   │   └── blacklist.ts    # CRUD endpoints
│   │   └── types.ts            # Shared types
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
├── extension/                  # Browser Extension
│   ├── manifest.json           # MV3
│   ├── background.js           # Service worker (minimal)
│   ├── popup/
│   │   ├── popup.html
│   │   ├── popup.js
│   │   └── popup.css
│   ├── content/
│   │   ├── content.js          # Injected into seller pages
│   │   └── styles.css
│   └── icons/
│       ├── icon16.png
│       ├── icon48.png
│       └── icon128.png
├── data/                       # SQLite DB (mounted volume)
│   └── blacklist.db
├── docker-compose.yml
└── .hermes/plans/
```

---

## Build Steps

### Phase 1 — Backend API
1. Init Node.js/TypeScript project tại `api/`
2. Setup SQLite schema + migrations
3. Implement `/api/check` với fuzzy matching (normalize phone digits, lowercase name)
4. Implement CRUD `/api/blacklist`
5. CORS enabled cho extension origin
6. Docker + docker-compose với volume mount

### Phase 2 — Browser Extension
1. `manifest.json` MV3 với permissions: `storage`, `activeTab`, content_scripts cho 3 platforms
2. `content.js` cho TikTok Shop — extract + check + highlight
3. `content.js` cho Shopee — extract + check + highlight
4. `content.js` cho Sapo — extract + check + highlight
5. Popup UI — tra cứu thủ công

### Phase 3 — Polish
1. Extension settings: cấu hình API URL
2. Import CSV blacklist
3. Export CSV
4. Admin web UI đơn giản (optional, có thể dùng popup)

---

## Matching Logic

```typescript
// Phone: normalize về digits, so sánh exact
normalize_phone("090 123 4567") === "0901234567"

// Name: lowercase + trim, so sánh contains (partial match)
"nguyen van a".includes("van a") === true

// Address: lowercase + trim, so sánh contains
// Email: lowercase exact match
```

Severity escalation: nếu match nhiều fields → tự động upgrade severity hiển thị.

---

## Risks & Tradeoffs

| Risk | Mitigation |
|---|---|
| TikTok/Shopee thay đổi DOM selectors | Content script dùng nhiều fallback selectors, log khi không tìm thấy |
| CORS từ extension đến localhost | API set `Access-Control-Allow-Origin: *` hoặc check extension origin |
| Extension không được publish lên Chrome Web Store | Load unpacked (developer mode) — phù hợp internal tool |
| SQLite concurrent writes | better-sqlite3 synchronous, single writer — OK cho use case này |
| False positive matching | Require phone match (exact) trước khi flag, name match chỉ là warning phụ |

---

## Success Criteria

- [ ] `POST /api/check` trả về kết quả trong < 50ms
- [ ] Extension inject thành công vào TikTok Shop order detail page
- [ ] Red border + badge hiển thị đúng khi phone match
- [ ] Popup tra cứu hoạt động offline (chỉ cần API local)
- [ ] Docker compose up → API sẵn sàng, DB persistent
