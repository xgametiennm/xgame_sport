# XGame Sports Platform (Pickleball & Badminton DUPR Engine)

Hệ thống quản lý câu lạc bộ thể thao chuyên nghiệp với công thức chuẩn **DUPR Rating**, lưu trữ **PostgreSQL**, kiến trúc **Service-Oriented** và đóng gói hoàn chỉnh bằng **Docker & Docker Compose**.

---

## 🏛️ Kiến Trúc Hệ Thống (Architecture & Services)

Hệ thống được module hóa thành các Service độc lập, giao tiếp qua REST API và mạng nội bộ Docker:

```mermaid
graph TD
    Client["Client (Browser / Mobile / Desktop)"]
    Frontend["Service: Frontend SPA (Nginx :80 -> :3088)"]
    Backend["Service: Backend REST API (Node.js Express :5000 -> :5088)"]
    DUPR["DUPR Calculation Engine (Mathematical Model)"]
    Postgres[("Service: Database (PostgreSQL 16 :5432 -> :5438)")]

    Client -->|HTTP :3088| Frontend
    Frontend -->|Reverse Proxy /api| Backend
    Backend -->|Calculate Ratings| DUPR
    DUPR -->|Updated Deltas| Backend
    Backend -->|Connection Pool| Postgres
```

### 1. `database` (PostgreSQL 16)
- **Database Name**: `xgame_db`
- **Port Host**: `5438` (Container: `5432` - Đã đổi tránh xung đột cổng PostgreSQL mặc định trên server)
- **Tables**:
  - `clubs`: Lưu thông tin các CLB (`c-pickleball`, `c-badminton`,...).
  - `users`: Tài khoản thành viên với xác thực bảo mật **Email + Password (Bcrypt Hash)** và JWT Token.
  - `players`: Hồ sơ vận động viên, điểm DUPR Đôi/Đơn, số trận, tỉ lệ thắng, chuỗi thắng/thua, form 5 trận gần nhất.
  - `matches`: Lịch sử các trận đấu, điểm số từng set, tỉ lệ thắng kỳ vọng, điểm chênh lệch và lịch sử thay đổi rating.
- **Tự động khởi tạo**: File [server/db/init.sql](file:///d:/XGame/xgame_pickleball/server/db/init.sql) tự động tạo bảng, thiết lập Index hiệu năng cao và nạp sẵn dữ liệu mẫu cho cả 2 CLB: **XGame Pickleball** và **XGame Badminton**.

### 2. `backend` (Node.js Express Service)
- **Port Host**: `5088` (Container: `5000`)
- **Cấu trúc Thư mục**:
  - `src/config/db.js`: Quản lý PostgreSQL Connection Pool (`pg`).
  - `src/services/duprEngine.js`: Thuật toán tính điểm DUPR chuẩn (logistic curve, margin of victory, half-life weighting).
  - `src/controllers/`: Bộ điều khiển phân tách chuyên nghiệp:
    - `clubController.js`: Lấy danh sách CLB, chuyển đổi CLB.
    - `playerController.js`: Lấy danh sách VĐV, lọc theo CLB, bảng xếp hạng DUPR.
    - `matchController.js`: Ghi nhận trận đấu trong Transaction, tự động cập nhật DUPR cho cả 4 VĐV.
    - `authController.js`: Đăng ký, đăng nhập chuẩn Email + Mật khẩu với JWT.
  - `src/routes/api.js`: Tổng hợp các endpoint RESTful chuẩn.
  - `src/middleware/auth.js`: Xác thực JWT Bearer Token.

### 3. `frontend` (React + TypeScript + Vite + Nginx)
- **Port Host**: `3088` (Container: `80`)
- **Web Server**: Nginx Alpine siêu nhẹ, tối ưu nén Gzip, cache static files và Reverse Proxy toàn bộ `/api` về `backend:5000`.
- **UI & Components**:
  - Đầy đủ 2 chế độ hiển thị: **Desktop Dashboard** & **Mobile App View**.
  - Dropdown chuyển đổi mượt mà giữa **XGame Pickleball** và **XGame Badminton**.
  - Tính năng **Bảng Xếp Hạng CLB**, **Hồ sơ VĐV**, **Ghi nhận trận đấu trực tiếp**, **DUPR Calculator**, **Bảng điểm sân đấu**.
  - Đăng nhập/Đăng ký chuẩn bằng **Email + Mật khẩu**.

---

## 🚀 Hướng Dẫn Khởi Chạy (Deployment Guide)

### Cách 1: Khởi Chạy Nhanh Bằng Docker Compose (Khuyên Dùng)

Chỉ cần 1 câu lệnh duy nhất tại thư mục gốc:

```bash
docker compose up --build -d
```

Sau khi khởi chạy thành công:
- 🌐 **Frontend Web App**: [http://localhost:3088](http://localhost:3088)
- 🔌 **Backend REST API**: [http://localhost:5088/api](http://localhost:5088/api)
- 🏥 **API Health Check**: [http://localhost:5088/api/health](http://localhost:5088/api/health)
- 🗄️ **PostgreSQL Port**: `localhost:5438`

Để xem logs của toàn bộ hệ thống:
```bash
docker compose logs -f
```

Để dừng hệ thống:
```bash
docker compose down
```

---

### Cách 2: Chạy Môi Trường Phát Triển Thủ Công (Local Dev)

#### 1. Khởi động Backend:
```bash
cd server
npm install
npm run dev
```

#### 2. Khởi động Frontend:
```bash
# Tại thư mục gốc xgame_pickleball
npm install
npm run dev
```
Truy cập Frontend Vite tại: [http://localhost:5173](http://localhost:5173)

---

## 🔐 Tài Khoản Đăng Nhập Mẫu

Bạn có thể đăng ký tài khoản mới bằng Email bất kỳ hoặc sử dụng các tài khoản có sẵn trong hệ thống:
- **Email**: `nguyen.anh@xgame.vn` | **Mật khẩu**: `pickleball2026`
- **Email**: `tran.binh@xgame.vn` | **Mật khẩu**: `pickleball2026`
- **Email**: `le.cuong@xgame.vn` | **Mật khẩu**: `pickleball2026`

---

## 🛠️ Vận Hành & Xử Lý Sự Cố

### Lấy lại quyền Chủ CLB

Một CLB có thể có **nhiều chủ CLB**. Chỉ chủ CLB mới cấp hoặc thu hồi được quyền chủ CLB, và CLB luôn phải còn ít nhất một chủ. Quản trị viên **không tự nâng mình lên chủ CLB được**.

Trường hợp hay gặp: bạn đã trao quyền chủ CLB cho người khác ở bản cũ (khi đó mỗi CLB chỉ có một chủ, người trao bị hạ xuống Quản trị viên), giờ muốn lấy lại.

#### Cách 1 (nên dùng): nhờ chủ CLB hiện tại cấp lại

Người đang là chủ CLB vào **Cài đặt CLB → Danh sách thành viên**, ở dòng tên bạn chọn quyền **Chủ CLB** (hoặc **⋮ → Đặt làm chủ CLB**). Cả hai cùng là chủ CLB, không ai bị hạ quyền. Sau đó, nếu cần, bạn có thể đổi quyền của người kia ở cùng chỗ.

#### Cách 2: sửa trực tiếp trong database (khi không liên lạc được chủ CLB hiện tại)

Chạy trên server có container `xgame_postgres`. Tên database và user lấy theo file `.env` (mặc định `xgame_db` / `xgame_admin`):

```bash
docker exec -it xgame_postgres psql -U xgame_admin -d xgame_db
```

Trong `psql`:

```sql
-- 1. Tìm id của CLB
SELECT id, name FROM clubs;

-- 2. Xem các thành viên có tài khoản của CLB đó, tìm dòng của bạn theo email
SELECT p.id, p.name, p.role, u.email
FROM players p JOIN users u ON u.id = p.user_id
WHERE p.club_id = '<id CLB>' AND p.removed_at IS NULL
ORDER BY p.role, p.name;

-- 3. Cấp lại quyền chủ CLB cho đúng dòng của bạn (cột id, dạng p-...)
UPDATE players SET role = 'owner', updated_at = NOW()
WHERE id = '<id dòng của bạn>' AND club_id = '<id CLB>';
```

- Bước 3 phải báo **`UPDATE 1`**. Nếu ra `UPDATE 0` thì id bị nhập sai, chưa có gì thay đổi.
- Chạy lại câu ở bước 2 để kiểm tra dòng của bạn đã là `owner`, rồi gõ `\q` để thoát và tải lại app.

> ⚠️ Kiểm tra kỹ id trước khi chạy `UPDATE`. Sửa trực tiếp trong database không để lại dấu vết trong app (chủ CLB hiện tại không nhận được thông báo), nên hãy báo cho họ biết.
