# 🗳️ Bà Miên – Trang Vote Thời Gian Thực

Hệ thống vote cảng theo khung giờ, hiển thị **thời gian thực** (real-time) – không cần reload trình duyệt.

---

## 📌 Tổng quan

Trang web cho phép người dùng:
- Nhập tên → vote cho các cảng theo từng khung giờ (10h, 12h, 14h30, 16h30, 19h, 21h)
- Xem kết quả vote **cập nhật real-time** (không cần F5)
- Đánh dấu "Bán hết" cho từng cảng
- Admin có thể xóa toàn bộ vote

---

## 🏗️ Tech Stack

| Thành phần | Công nghệ | Lý do chọn |
|---|---|---|
| **Runtime** | [Bun](https://bun.sh) | Nhanh hơn Node.js, built-in TypeScript, built-in SQLite, built-in WebSocket |
| **Ngôn ngữ** | TypeScript | Type-safe, dễ maintain, Bun hỗ trợ native (không cần build step) |
| **Framework** | [Hono](https://hono.dev) | Micro web framework – routing gọn, middleware, type-safe, tối ưu cho Bun |
| **Frontend** | [HTMX](https://htmx.org) | Cập nhật DOM không cần viết JS phức tạp, tích hợp WebSocket cho real-time |
| **Real-time** | WebSocket (built-in Bun) | Real-time 2 chiều, latency thấp, vote cập nhật tức thì không cần reload |
| **Database** | SQLite (`bun:sqlite`) | Built-in Bun, concurrent-safe, query nhanh, không lo race condition như JSON file |
| **Reverse Proxy** | Nginx | Proxy từ domain → `localhost:3005`, hỗ trợ WebSocket upgrade |

---

## 📁 Cấu trúc thư mục

```
htdocs/
├── bamien-old/                # ⚠️ Code PHP cũ (giữ lại để tham khảo)
│   ├── index.php              #   Trang vote chính (PHP)
│   ├── admin.php              #   Trang admin xóa vote (PHP)
│   └── datav2/                #   Dữ liệu vote theo khung giờ
│       ├── 10h.json
│       ├── 12h.json
│       ├── 14h30.json
│       ├── 16h30.json
│       ├── 19h.json
│       └── 21h.json
│
├── bamien.mayddns.com/         # Domain chính (nginx serve)
│   └── .well-known/
│
├── src/                        # 🆕 Source code mới (Bun + TypeScript)
│   ├── index.ts                #   Entry point – HTTP server + WebSocket
│   ├── routes/                 #   Route handlers
│   ├── views/                  #   HTMX templates (HTML)
│   ├── public/                 #   Static files (CSS, JS client)
│   └── data/                   #   JSON data (migrate từ bamien-old/datav2)
│
├── package.json
├── tsconfig.json
├── bunfig.toml
├── .gitignore
└── README.md                   # ← Bạn đang đọc file này
```

---

## 🚀 Chạy local

### Yêu cầu

- [Bun](https://bun.sh) >= 1.0

### Cài đặt & chạy

```bash
# Cài dependencies
bun install

# Chạy dev server trên port 3005
bun run dev
```

Server sẽ chạy tại: `http://localhost:3005`

---

## 🌐 Cấu hình Nginx (Reverse Proxy)

Bun chạy trên port `3005`, Nginx proxy từ domain `bamien.mayddns.com`:

```nginx
server {
    listen 80;
    server_name bamien.mayddns.com;

    location / {
        proxy_pass http://127.0.0.1:3005;
        proxy_http_version 1.1;

        # WebSocket support (cho real-time)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE support (nếu dùng Server-Sent Events)
        proxy_buffering off;
        proxy_cache off;
    }
}
```

---

## 📂 Code PHP cũ (`bamien-old/`)

Code PHP gốc nằm trong thư mục `bamien-old/`, bao gồm:

| File | Mô tả |
|---|---|
| `index.php` | Trang vote chính – nhập tên, chọn khung giờ, vote/unvote cảng, đánh dấu bán hết |
| `admin.php` | Trang admin – xóa toàn bộ vote (yêu cầu mật khẩu) |
| `datav2/*.json` | Dữ liệu vote, mỗi file tương ứng 1 khung giờ |

### Cấu trúc JSON (`datav2/*.json`)

```json
{
  "options": [
    {
      "id": 1,
      "text": "Tên cảng",
      "sold_out": false
    }
  ],
  "votes": [
    {
      "id": 1,
      "user_id": "Tên người vote",
      "option_id": 1,
      "created_at": "2026-06-14 10:00:00"
    }
  ]
}
```

### Quy tắc nghiệp vụ (giữ nguyên từ PHP)

- Mỗi cảng tối đa **2 vote**
- User nhận diện qua **cookie** (lưu tên, hết hạn sau 2 ngày)
- Tự động chọn khung giờ gần nhất theo **UTC+7**
- Sắp xếp cảng theo **A-Z**
- Admin xóa vote cần nhập mật khẩu

---

## 🔄 Kế hoạch migrate PHP → Bun

1. **Phase 1**: Setup Bun project, tạo HTTP server trên port 3005
2. **Phase 2**: Render HTML bằng HTMX templates (chuyển từ PHP sang)
3. **Phase 3**: Thêm real-time với WebSocket/SSE (vote cập nhật không cần reload)
4. **Phase 4**: Cấu hình Nginx proxy, test production
5. **Phase 5**: (Tùy chọn) Migrate JSON → SQLite

---

## 📝 Ghi chú

- Code PHP cũ trong `bamien-old/` **không được xóa** – giữ lại để đối chiếu
- Bun server chạy trên port **3005** → Nginx reverse proxy
- Dữ liệu JSON tương thích ngược với code PHP cũ
