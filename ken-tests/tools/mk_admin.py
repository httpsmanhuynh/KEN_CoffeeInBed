import sys; sys.path.insert(0, 'tools')
from common import *; from xl2 import build
C = load_manual('tools/admin_xlsx.py', "A='Đăng nhập Admin", "n,m=build(")
GR = {'Đăng nhập': 'LG', 'Phân quyền': 'PQ', 'Booking': 'BK', 'Dashboard': 'DB', 'Khách hàng': 'KH'}
def gm(m, c, t):
    if c == 'Phân quyền UI': return 'Phân quyền'
    return {'Auth': 'Đăng nhập', 'Booking': 'Booking', 'Dashboard': 'Dashboard', 'Customer': 'Khách hàng'}[m]
rules = [('Đăng nhập Admin hợp lệ', 'AD-B01'), ('Sai mật khẩu', 'AD-B02'), ('Để trống email', 'AD-B03'), ('Tài khoản bị khóa', 'AD-B04'), ('Customer không vào', 'AD-B05; AD-B06'), ('Truy cập khi chưa đăng nhập', 'AD-B05'),
 ('Đăng xuất', 'AD-B17'), ('Token hết hạn', 'AD-B17'), ('Xem danh sách booking', 'AD-B07'), ('Lọc theo trạng thái', 'AD-B07'), ('Tìm theo tên', 'AD-B07'), ('Lọc theo khoảng ngày', 'AD-B07; AD-B08'),
 ('Xem chi tiết booking', 'AD-B09'), ('PENDING → CONFIRMED', 'AD-B10'), ('Không cho phép chuyển', 'AD-B11'), ('Hủy booking đã thanh toán', 'AD-B10; AD-B15'), ('Bấm "Hủy" ở hộp thoại', 'AD-B10'),
 ('khớp danh sách', 'AD-B14'), ('Doanh thu đúng', 'AD-B14'), ('cập nhật sau khi đổi', 'AD-B15'), ('Biểu đồ', 'AD-B18'), ('chưa có booking', 'AD-B18'), ('Xem thông tin khách', 'AD-B16'), ('Khóa / mở khóa', 'AD-B16; AD-B04')]
tcs = manual_rows(C, gm, 'Admin Dashboard (Angular)', rules)
BK, ST = '/api/admin/bookings', '/api/admin/bookings/:id/status'
LG = '/api/auth/login'
tcs += [
 A('Đăng nhập', f'POST {LG}', 'Positive', 'Đăng nhập Admin đúng thông tin trả token, role ADMIN', 'Có tài khoản Admin.', '{"email": "admin@ken.vn", "password": "Admin@123"}', f'1) POST {LG}\n2) Kiểm tra body', '200; có token, user.role = ADMIN; body không chứa mật khẩu', '200', 'AD-B01', 'TC-ADM-001'),
 A('Đăng nhập', f'POST {LG}', 'Negative', 'Đăng nhập sai mật khẩu', 'Có tài khoản Admin.', '{"email": "admin@ken.vn", "password": "sai"}', f'1) POST {LG} mật khẩu sai', '401; thông báo chung, không cấp token', '401', 'AD-B02', 'TC-ADM-002'),
 A('Đăng nhập', f'POST {LG}', 'Negative', 'Đăng nhập thiếu mật khẩu', '—', '{"email": "admin@ken.vn"}', f'1) POST {LG} thiếu password', '422 Validation Error', '422', 'AD-B03', 'TC-ADM-003'),
 A('Đăng nhập', f'POST {LG}', 'Negative', 'Tài khoản bị khóa không được cấp token', 'Có tài khoản bị khóa.', '{"email": "khoa@ken.vn", "password": "Lock@123"}', f'1) POST {LG} bằng tài khoản bị khóa', '403; body không có token', '403', 'AD-B04', 'TC-ADM-004'),
 A('Đăng nhập', f'POST {LG}', 'Positive', 'Đăng nhập Customer nhận role CUSTOMER', 'Có tài khoản Customer.', '{"email": "an@ken.vn", "password": "Cust@123"}', f'1) POST {LG}', '200; user.role = CUSTOMER (không phải ADMIN)', '200', 'AD-B01', 'TC-ADM-005'),
 A('Phân quyền', f'GET | PATCH /api/admin/*', 'Security', 'Guest gọi API quản trị (bookings, dashboard, customers) bị 401', 'Chưa đăng nhập.', '—', f'1) Guest GET {BK}\n2) GET /api/admin/dashboard\n3) GET /api/admin/bookings/:id\n4) PATCH {ST}\n5) GET /api/admin/customers/:id', 'Cả 5 request trả 401', '401', 'AD-B05', 'TC-ADM-006'),
 A('Phân quyền', f'GET | PATCH /api/admin/*', 'Security', 'Customer gọi API quản trị bị 403', 'Có token Customer.', '—', 'Lặp 5 request như trên với Bearer customer-token', 'Cả 5 request trả 403', '403', 'AD-B06', 'TC-ADM-007'),
 A('Phân quyền', f'PATCH {ST}', 'Security', 'Customer không đổi được trạng thái, dữ liệu giữ nguyên', 'Customer có 1 booking PENDING.', '{"status": "CANCELLED"}', f'1) Customer PATCH {ST}\n2) Admin GET /api/admin/bookings/:id', '403; booking vẫn PENDING', '403', 'AD-B06', 'TC-ADM-008'),
 A('Booking', f'GET {BK}', 'Positive', 'Admin xem booking của nhiều khách kèm thông tin khách', '2 khách mỗi người có 1 booking.', '—', f'1) Admin GET {BK}', '200; có cả 2 booking; mỗi dòng có customer.name đúng', '200', 'AD-B07', 'TC-ADM-009'),
 A('Booking', f'GET {BK}?status=', 'Positive', 'Lọc booking theo status chỉ trả đúng trạng thái', 'Có booking CONFIRMED.', '?status=CONFIRMED', f'1) GET {BK}?status=CONFIRMED', '200; mọi dòng status = CONFIRMED, chứa booking đã xác nhận', '200', 'AD-B07', 'TC-ADM-010'),
 A('Booking', f'GET {BK}?q=', 'Positive', 'Tìm theo tên khách không phân biệt hoa/thường', 'Có booking của "Trần Thị Bình".', '?q=trần thị bình', f'1) GET {BK}?q=trần thị bình', '200; mọi dòng thuộc đúng khách đó', '200', 'AD-B07', 'TC-ADM-011'),
 A('Booking', f'GET {BK}?q=', 'Boundary', 'Tìm không có kết quả trả danh sách rỗng', '—', '?q=khong-ton-tai-xyz', f'1) GET {BK}?q=khong-ton-tai-xyz', '200; data = [] (không lỗi)', '200', 'AD-B07', 'TC-ADM-012'),
 A('Booking', f'GET {BK}?status=', 'Negative', 'Lọc với status không hợp lệ', '—', '?status=ABC', f'1) GET {BK}?status=ABC', '422', '422', 'AD-B08', 'TC-ADM-013'),
 A('Booking', f'GET {BK}/:id', 'Security', 'Chi tiết booking không lộ trường nhạy cảm; id lạ trả 404', 'Có booking.', '—', f'1) GET {BK}/:id → tìm "password", "passwordHash", "otp" trong body\n2) GET {BK}/khong-co', '200 không chứa trường nhạy cảm; id lạ trả 404', '200/404', 'AD-B09', 'TC-ADM-015'),
 A('Khách hàng', 'GET /api/admin/customers/:id', 'Positive', 'Admin xem thông tin khách kèm số booking', 'Khách có ≥ 1 booking.', '—', '1) Admin GET /api/admin/customers/u-an', '200; có bookingCount ≥ 1; không có password', '200', 'AD-B16', 'TC-ADM-016'),
 A('Booking', f'PATCH {ST}', 'Positive', 'Chuyển PENDING → CONFIRMED hợp lệ và được lưu', 'Booking PENDING.', '{"status": "CONFIRMED"}', f'1) PATCH {ST}\n2) GET /api/admin/bookings/:id', '200; GET trả CONFIRMED', '200', 'AD-B10', 'TC-ADM-017'),
 A('Booking', f'PATCH {ST}', 'Positive', 'Chuyển CONFIRMED → COMPLETED hợp lệ', 'Booking CONFIRMED.', '{"status": "COMPLETED"}', f'1) PATCH {ST}', '200', '200', 'AD-B10', 'TC-ADM-018'),
 A('Booking', f'PATCH {ST}', 'Negative', 'Chuyển trạng thái sai luồng bị từ chối', 'Lần lượt: CONFIRMED→PENDING; PENDING→COMPLETED; COMPLETED→CONFIRMED; CANCELLED→CONFIRMED.', '{"status": "PENDING"}', f'1) Tạo booking ở từng trạng thái đầu\n2) PATCH {ST} sang trạng thái không hợp lệ\n3) GET kiểm tra trạng thái cũ', '409 Conflict ở cả 4 trường hợp; trạng thái không đổi', '409', 'AD-B11', 'TC-ADM-019'),
 A('Booking', f'PATCH {ST}', 'Negative', 'Cập nhật với trạng thái lạ hoặc thiếu status', 'Booking PENDING.', '{"status": "DELETED"}', f'1) PATCH {ST} status="DELETED"\n2) PATCH với body rỗng', '422 cho cả hai', '422', 'AD-B12', 'TC-ADM-020'),
 A('Booking', f'PATCH {ST}', 'Negative', 'Cập nhật booking không tồn tại', '—', '{"status": "CONFIRMED"}', f'1) PATCH /api/admin/bookings/khong-co/status', '404', '404', 'AD-B09', 'TC-ADM-021'),
 A('Booking', f'PATCH {ST}', 'Security', 'Over-posting: total, customerId, paymentStatus gửi kèm bị bỏ qua', 'Booking PENDING, total 100000, UNPAID.', '{"status": "CONFIRMED", "total": 1, "customerId": "u-binh", "paymentStatus": "PAID"}', f'1) PATCH {ST} với body trên\n2) Kiểm tra body trả về', '200; total vẫn 100000; customer.id không đổi; paymentStatus vẫn UNPAID', '200', 'AD-B13', 'TC-ADM-022'),
 A('Dashboard', 'GET /api/admin/dashboard', 'Positive', 'Tổng booking Dashboard bằng số dòng danh sách', 'Có booking.', '—', f'1) GET /api/admin/dashboard\n2) GET {BK}\n3) So sánh', 'totalBookings = số dòng trong danh sách', '200', 'AD-B14', 'TC-ADM-023'),
 A('Dashboard', 'GET /api/admin/dashboard', 'Positive', 'Số lượng theo trạng thái khớp danh sách', 'Có booking nhiều trạng thái.', '—', '1) Đếm theo từng status từ danh sách\n2) So với byStatus', 'Từng byStatus khớp; tổng các trạng thái = totalBookings', '200', 'AD-B14', 'TC-ADM-024'),
 A('Dashboard', 'GET /api/admin/dashboard', 'Positive', 'Doanh thu chỉ tính booking đã thanh toán chưa hủy', 'Booking PAID 300000, CONFIRMED.', '—', '1) Ghi doanh thu\n2) Admin hủy booking\n3) GET dashboard lại', 'Doanh thu giảm đúng 300000 sau khi hủy', '200', 'AD-B14; AD-B15', 'TC-ADM-025 (chỉ chạy với mock)'),
 A('Dashboard', 'GET /api/admin/dashboard', 'Positive', 'Dashboard cập nhật ngay sau khi đổi trạng thái', 'Có booking PENDING.', '—', '1) Ghi byStatus\n2) PATCH PENDING → CONFIRMED\n3) GET dashboard', 'CONFIRMED +1, PENDING −1', '200', 'AD-B15', 'TC-ADM-026'),
 A('Dashboard', 'GET /api/admin/dashboard', 'Boundary', 'Số liệu Dashboard không âm và là số hữu hạn', '—', '—', '1) GET dashboard\n2) Kiểm tra totalBookings, revenue, byStatus', 'Mọi giá trị là số hữu hạn ≥ 0', '200', 'AD-B14', 'TC-ADM-027')]
br = [('AD-B01','Đăng nhập','POST /api/auth/login thành công: cấp token, role đúng, không lộ mật khẩu'),('AD-B02','Đăng nhập','Sai thông tin đăng nhập → 401 (thông báo chung)'),
 ('AD-B03','Đăng nhập','Thiếu email/mật khẩu → 422'),('AD-B04','Đăng nhập','Tài khoản bị khóa → 403, không cấp token'),
 ('AD-B05','Phân quyền','Middleware xác thực: thiếu JWT → 401 trên mọi /api/admin/*'),('AD-B06','Phân quyền','Middleware phân quyền ADMIN: Customer → 403 (BR-A04, BR-A05)'),
 ('AD-B07','Booking','GET danh sách booking: lọc status, tìm theo tên/mã, lọc ngày; rỗng không lỗi'),('AD-B08','Booking','Tham số lọc không hợp lệ → 422'),
 ('AD-B09','Booking','GET chi tiết: không lộ trường nhạy cảm; id không tồn tại → 404'),('AD-B10','Booking','PATCH status hợp lệ theo state machine và được lưu'),
 ('AD-B11','Booking','PATCH status sai luồng (vd COMPLETED → CONFIRMED) → 409, giữ nguyên'),('AD-B12','Booking','PATCH status lạ/thiếu → 422'),
 ('AD-B13','Booking','Over-posting: chỉ lấy trường "status", bỏ qua total/customerId/paymentStatus'),('AD-B14','Dashboard','Tổng hợp totalBookings, byStatus, revenue khớp dữ liệu nguồn'),
 ('AD-B15','Dashboard','Dashboard cập nhật theo đổi trạng thái / hủy booking'),('AD-B16','Khách hàng','Xem thông tin khách (bookingCount), khóa/mở khóa tài khoản'),
 ('AD-B17','Đăng nhập','Phiên đăng nhập phía Angular: guard route, đăng xuất, token hết hạn'),('AD-B18','Dashboard','Hiển thị biểu đồ, responsive và trạng thái rỗng')]
flows = [
 ('Luồng xử lý booking: Khách tạo → Admin xác nhận → Hoàn thành → Dashboard', [
  ('POST /api/auth/login (Admin)', '{"email": "admin@ken.vn", "password": "Admin@123"}', '200 + token ADMIN', ['Đăng nhập Admin đúng']),
  ('GET /api/admin/bookings?status=PENDING', '—', '200; thấy booking mới của khách', ['Lọc booking theo status']),
  ('PATCH /api/admin/bookings/:id/status', '{"status": "CONFIRMED"}', '200; trạng thái CONFIRMED', ['PENDING → CONFIRMED hợp lệ']),
  ('PATCH /api/admin/bookings/:id/status', '{"status": "COMPLETED"}', '200; trạng thái COMPLETED', ['CONFIRMED → COMPLETED']),
  ('GET /api/admin/dashboard', '—', 'Số theo trạng thái cập nhật (COMPLETED +1)', ['cập nhật ngay sau khi đổi'])]),
 ('Luồng phân quyền: Customer cố truy cập khu quản trị', [
  ('POST /api/auth/login (Customer)', '{"email": "an@ken.vn", "password": "Cust@123"}', '200; role CUSTOMER', ['Đăng nhập Customer']),
  ('Angular: nhập URL /admin/dashboard', '—', 'Bị chặn, chuyển về trang chủ', ['Customer không vào được']),
  ('GET /api/admin/dashboard (Customer)', '—', '403', ['Customer gọi API quản trị']),
  ('PATCH /api/admin/bookings/:id/status (Customer)', '{"status": "CANCELLED"}', '403; booking không đổi', ['Customer không đổi được'])]),
 ('Luồng hủy booking đã thanh toán: Hủy → Doanh thu giảm', [
  ('Admin Dashboard: ghi lại doanh thu hiện tại', '—', 'Doanh thu = tổng booking PAID chưa hủy', ['Doanh thu đúng']),
  ('Admin Dashboard: hủy booking CONFIRMED đã PAID, nhập lý do', 'Lý do: Khách yêu cầu', 'Booking → CANCELLED', ['Hủy booking đã thanh toán']),
  ('GET /api/admin/dashboard', '—', 'Doanh thu giảm đúng số tiền booking', ['Doanh thu chỉ tính'])])]
notes = ['1. Phạm vi: đăng nhập Admin, phân quyền, quản lý Booking, Dashboard, quản lý khách hàng (UC-20, UC-21; BR-A04, BR-A05). Ca API ghi mã test tự động ở cột Ghi chú.',
 '2. Chạy tự động: npm run test:admin. Backend thật: ADMIN_BASE_URL, ADMIN_TOKEN, CUSTOMER_TOKEN.',
 '3. Máy trạng thái booking giả định: PENDING → CONFIRMED/CANCELLED/EXPIRED; CONFIRMED → COMPLETED/CANCELLED; còn lại là trạng thái cuối. Cần đối chiếu lại với đặc tả thật.',
 '4. Toàn bộ TC đang "Chưa chạy" – automation chỉ đạt trên server mô phỏng; QA chạy lại trên hệ thống thật và ghi kết quả.']
d = dict(title='BỘ TEST CASE – ADMIN: ĐĂNG NHẬP, PHÂN QUYỀN, BOOKING & DASHBOARD (ĐỒ ÁN KÉN)', scope='Admin Management & Dashboard (UC-20, UC-21; BR-A04, BR-A05): /api/auth/login, /api/admin/*, Angular Admin Dashboard',
 tools='VS Code + Node.js ≥ 20 (node:test), Postman (tùy chọn), trình duyệt + DevTools, MongoDB Compass', base='http://localhost:3000 (API /api/admin/*) – Admin Dashboard: http://localhost:4200/admin (điều chỉnh theo môi trường)',
 groups=GR, tcs=tcs, flows=flows, branches=br, notes=notes)
print(build('KEN_TestCase_Admin.xlsx', d))
