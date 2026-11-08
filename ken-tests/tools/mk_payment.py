import sys; sys.path.insert(0, 'tools')
from common import *; from xl2 import build
C = load_manual('tools/payment_xlsx.py', "K='Đăng nhập Customer", "n,m=build(")
GR = {'Tính tiền': 'TT', 'Thanh toán': 'TH', 'Webhook': 'WH', 'Chống trùng': 'CT', 'Hoàn tiền': 'HT', 'Lịch sử': 'LS'}
def gm(m, c, t):
    if c in ('Chống bấm trùng', 'Chống thanh toán trùng'): return 'Chống trùng'
    return m
rules = [('Tổng tiền = Package', 'PY-B01'), ('Đổi số lượng Add-on', 'PY-B01; PY-B03'), ('Sửa giá bằng DevTools', 'PY-B02'), ('Sửa request', 'PY-B02'), ('Giao diện chọn phương thức', 'PY-B07'),
 ('thành công qua cổng', 'PY-B08; PY-B12'), ('thất bại / hủy ở cổng', 'PY-B15'), ('Thử lại sau', 'PY-B15'), ('liên tiếp nhiều lần', 'PY-B19'), ('Mở thanh toán ở 2 tab', 'PY-B09; PY-B19'),
 ('Back / F5', 'PY-B19'), ('Đóng tab giữa chừng', 'PY-B12'), ('hết thời gian giữ chỗ', 'PY-B16'), ('booking của người khác', 'PY-B05'), ('khi chưa đăng nhập', 'PY-B04'),
 ('Responsive trang', 'PY-B20'), ('Thông báo lỗi mạng', 'PY-B20'), ('Admin hoàn tiền giao dịch', 'PY-B17'), ('Không hoàn tiền hai lần', 'PY-B18'), ('Customer không thấy nút', 'PY-B18'), ('lịch sử thanh toán', 'PY-B20')]
tcs = manual_rows(C, gm, 'Trang Thanh toán (Angular)', rules)
BKG, PAYU = '/api/bookings', '/api/payments'
CB = f'POST {PAYU}/:id/callback'
SIG = 'Header X-Signature = HMAC-SHA256(secret, raw body)'
tcs += [
 A('Tính tiền', f'POST {BKG}', 'Positive', 'Tổng booking = giá Package + Add-on × số lượng', 'Đăng nhập Customer.', '{"packageId": "pkg-pro", "addons": [{"id": "cafe", "qty": 2}, {"id": "banh", "qty": 1}]}', f'1) POST {BKG}\n2) Kiểm tra data.total', '201; total = 800000 + 60000 + 25000 = 885000', '201', 'PY-B01', 'TC-PAY-001'),
 A('Tính tiền', f'POST {BKG}', 'Security', 'Client gửi total/amount giả (1đ) bị bỏ qua', 'Đăng nhập Customer.', '{"packageId": "pkg-basic", "total": 1, "amount": 1}', f'1) POST {BKG}\n2) Kiểm tra data.total', '201; total = 500000 do server tính (NFR-03)', '201', 'PY-B02', 'TC-PAY-002'),
 A('Tính tiền', f'POST {BKG}', 'Boundary', 'Số lượng Add-on âm, bằng 0 hoặc thập phân', 'Đăng nhập Customer.', '{"packageId": "pkg-basic", "addons": [{"id": "cafe", "qty": -1}]}', f'1) POST {BKG} lần lượt qty = -1, 0, 1.5', '422 cho cả ba lần', '422', 'PY-B03', 'TC-PAY-003'),
 A('Tính tiền', f'POST {BKG}', 'Negative', 'Package hoặc Add-on không tồn tại', 'Đăng nhập Customer.', '{"packageId": "x"}', f'1) POST {BKG} packageId="x"\n2) POST với addon id="zzz"', '422 cho cả hai', '422', 'PY-B03', 'TC-PAY-004'),
 A('Tính tiền', f'POST {PAYU}', 'Security', 'Số tiền thanh toán lấy từ booking, không theo amount client', 'Booking total 500000.', '{"bookingId": "<id>", "method": "VNPAY", "amount": 1}', f'1) POST {PAYU} kèm amount=1\n2) Kiểm tra data.amount', '201; amount = 500000', '201', 'PY-B02; PY-B08', 'TC-PAY-005'),
 A('Thanh toán', f'POST {PAYU}', 'Security', 'Guest tạo thanh toán bị từ chối', 'Chưa đăng nhập; có booking.', '{"bookingId": "<id>", "method": "VNPAY"}', f'1) POST {PAYU} không JWT', '401', '401', 'PY-B04', 'TC-PAY-006'),
 A('Thanh toán', f'POST {PAYU}', 'Security', 'Thanh toán booking của người khác', 'Booking thuộc Customer A; đăng nhập Customer B.', '{"bookingId": "<id của A>", "method": "VNPAY"}', f'1) Customer B POST {PAYU}', '403', '403', 'PY-B05', 'TC-PAY-007'),
 A('Thanh toán', f'POST {PAYU}', 'Negative', 'Thanh toán booking không tồn tại', 'Đăng nhập Customer.', '{"bookingId": "khong-co", "method": "VNPAY"}', f'1) POST {PAYU}', '404', '404', 'PY-B06', 'TC-PAY-008'),
 A('Thanh toán', f'POST {PAYU}', 'Negative', 'Phương thức thanh toán không hợp lệ hoặc thiếu', 'Có booking PENDING.', '{"bookingId": "<id>", "method": "BITCOIN"}', f'1) POST {PAYU} method="BITCOIN"\n2) POST không có method', '422 cho cả hai', '422', 'PY-B07', 'TC-PAY-009'),
 A('Thanh toán', f'POST {PAYU}', 'Positive', 'Tạo giao dịch thành công: PENDING, có paymentUrl, booking vẫn PENDING', 'Booking PENDING còn hạn.', '{"bookingId": "<id>", "method": "MOMO"}', f'1) POST {PAYU}\n2) GET {BKG}/:id', '201; status PENDING; có paymentUrl; booking vẫn PENDING', '201', 'PY-B08', 'TC-PAY-010'),
 A('Thanh toán', f'GET {PAYU}/:id', 'Security', 'Chỉ chủ booking hoặc Admin xem được giao dịch', 'Có giao dịch của Customer A.', '—', f'1) Customer A GET → 200\n2) Admin GET → 200\n3) Customer B GET → 403\n4) Guest GET → 401', '200/200/403/401 đúng từng vai trò', '200/403', 'PY-B04; PY-B05', 'TC-PAY-011'),
 A('Thanh toán', f'POST {PAYU}', 'Boundary', 'Booking hết hạn giữ chỗ không được thanh toán', 'Booking PENDING đã quá hạn giữ chỗ.', '{"bookingId": "<id>", "method": "VNPAY"}', f'1) POST {PAYU}\n2) GET {BKG}/:id', '409; booking chuyển EXPIRED', '409', 'PY-B16', 'TC-PAY-027 (chỉ chạy với mock)'),
 A('Webhook', CB, 'Positive', 'Webhook SUCCESS hợp lệ: Payment PAID, Booking CONFIRMED + PAID', 'Có giao dịch PENDING.', '{"result": "SUCCESS", "amount": 500000}', f'1) POST callback kèm chữ ký đúng\n2) GET {BKG}/:id', '200; booking CONFIRMED, paymentStatus PAID', '200', 'PY-B12', 'TC-PAY-012'),
 A('Webhook', CB, 'Security', 'Webhook chữ ký sai hoặc thiếu chữ ký', 'Có giao dịch PENDING.', '{"result": "SUCCESS", "amount": 500000} + X-Signature: deadbeef', f'1) POST callback chữ ký sai\n2) POST callback không có chữ ký\n3) GET booking', '401 cả hai; booking vẫn PENDING', '401', 'PY-B11', 'TC-PAY-013, TC-PAY-014'),
 A('Webhook', CB, 'Security', 'Số tiền callback không khớp giao dịch', 'Giao dịch 500000.', '{"result": "SUCCESS", "amount": 1000}', '1) POST callback ký đúng nhưng amount=1000\n2) GET booking', '422; booking vẫn UNPAID', '422', 'PY-B13', 'TC-PAY-015'),
 A('Webhook', CB, 'Boundary', 'Callback SUCCESS lặp lại là idempotent', 'Giao dịch đã PAID.', '{"result": "SUCCESS", "amount": 500000}', '1) Gửi callback SUCCESS lần 2\n2) GET booking', '200; booking vẫn CONFIRMED (không xử lý hai lần)', '200', 'PY-B14', 'TC-PAY-016'),
 A('Webhook', CB, 'Positive', 'Webhook FAILED: Payment FAILED, booking giữ PENDING', 'Có giao dịch PENDING.', '{"result": "FAILED"}', f'1) POST callback FAILED\n2) GET {PAYU}/:id và booking', '200; payment FAILED; booking PENDING', '200', 'PY-B15', 'TC-PAY-017'),
 A('Webhook', CB, 'Negative', 'Callback đến sai thứ tự (FAILED sau PAID, SUCCESS sau FAILED)', 'Có giao dịch PAID và một giao dịch FAILED.', '{"result": "FAILED"} / {"result": "SUCCESS", "amount": 500000}', '1) Giao dịch PAID nhận FAILED\n2) Giao dịch FAILED nhận SUCCESS', '409 cả hai; trạng thái giao dịch không đổi', '409', 'PY-B14', 'TC-PAY-018, TC-PAY-019'),
 A('Webhook', CB, 'Negative', 'Kết quả callback lạ hoặc payment không tồn tại', 'Có giao dịch PENDING.', '{"result": "MAYBE"}', '1) Callback result="MAYBE"\n2) Callback tới id "khong-co"', '422 và 404', '422', 'PY-B14', 'TC-PAY-020'),
 A('Chống trùng', f'POST {PAYU}', 'Negative', 'Booking đã PAID không thanh toán lại', 'Booking đã PAID.', '{"bookingId": "<id>", "method": "VNPAY"}', f'1) POST {PAYU}', '409', '409', 'PY-B09', 'TC-PAY-021'),
 A('Chống trùng', f'POST {PAYU}', 'Negative', 'Đang có giao dịch PENDING, tạo thêm không có key', 'Đã có 1 giao dịch PENDING.', '{"bookingId": "<id>", "method": "VNPAY"}', f'1) POST {PAYU} lần 1 → 201\n2) POST lần 2', 'Lần 2: 409', '409', 'PY-B10', 'TC-PAY-022'),
 A('Chống trùng', f'POST {PAYU}', 'Positive', 'Cùng Idempotency-Key trả lại cùng giao dịch', 'Booking PENDING.', 'Header Idempotency-Key: k-123', f'1) POST {PAYU} key k-123 → 201\n2) POST lại cùng key', 'Lần 2: 200, cùng id giao dịch, không tạo mới', '200', 'PY-B10', 'TC-PAY-023'),
 A('Chống trùng', f'POST {PAYU}', 'Boundary', '5 request thanh toán song song chỉ tạo 1 giao dịch', 'Booking PENDING.', '5 request đồng thời', f'1) Gửi 5 POST {PAYU} đồng thời', 'Đúng 1 request 201, các request còn lại 409', '201/409', 'PY-B10', 'TC-PAY-024'),
 A('Chống trùng', f'POST {PAYU}', 'Positive', 'Thanh toán lỗi xong được thử lại bằng giao dịch mới', 'Giao dịch đầu đã FAILED.', '{"bookingId": "<id>", "method": "VNPAY"}', f'1) POST {PAYU} lần 2\n2) Callback SUCCESS cho giao dịch mới\n3) GET booking', '201 với id khác giao dịch cũ; booking CONFIRMED', '201', 'PY-B15; PY-B12', 'TC-PAY-025'),
 A('Chống trùng', CB, 'Boundary', '5 callback SUCCESS song song vẫn xác nhận đúng một lần', 'Giao dịch PENDING.', '5 callback đồng thời', f'1) Gửi 5 callback SUCCESS đồng thời\n2) GET booking', 'Tất cả 200; booking CONFIRMED, kết quả nhất quán', '200', 'PY-B14', 'TC-PAY-026'),
 A('Hoàn tiền', f'POST {PAYU}/:id/refund', 'Positive', 'Admin hoàn tiền giao dịch PAID', 'Giao dịch PAID; có token Admin.', '—', f'1) Admin POST refund\n2) GET booking', '200; payment REFUNDED; booking CANCELLED', '200', 'PY-B17', 'TC-PAY-028'),
 A('Hoàn tiền', f'POST {PAYU}/:id/refund', 'Security', 'Customer/Guest không được hoàn tiền', 'Giao dịch PAID.', '—', '1) Customer POST refund\n2) Guest POST refund\n3) Admin GET giao dịch', '403 và 401; giao dịch vẫn PAID', '403', 'PY-B18', 'TC-PAY-029'),
 A('Hoàn tiền', f'POST {PAYU}/:id/refund', 'Negative', 'Không hoàn tiền giao dịch chưa thanh toán và không hoàn hai lần', 'Giao dịch PENDING rồi PAID.', '—', '1) Refund khi PENDING\n2) Callback SUCCESS rồi refund\n3) Refund lần 2', '409 → 200 → 409', '409', 'PY-B18', 'TC-PAY-030')]
br = [('PY-B01','Tính tiền','Server tính tổng = giá Package + Σ(giá Add-on × số lượng)'),('PY-B02','Tính tiền','Bỏ qua total/amount do client gửi (NFR-03 Never Trust the Client)'),
 ('PY-B03','Tính tiền','Validate Package/Add-on tồn tại và số lượng nguyên dương → 422'),('PY-B04','Thanh toán','Xác thực: Guest → 401'),('PY-B05','Thanh toán','Kiểm tra chủ sở hữu booking/giao dịch → 403'),
 ('PY-B06','Thanh toán','Booking không tồn tại → 404'),('PY-B07','Thanh toán','Validate phương thức thanh toán (VNPAY/MOMO/BANK_TRANSFER) → 422'),('PY-B08','Thanh toán','Tạo giao dịch PENDING, số tiền lấy từ booking, trả paymentUrl → 201'),
 ('PY-B09','Chống trùng','Booking không còn PENDING (đã PAID/CANCELLED) → 409'),('PY-B10','Chống trùng','Giao dịch PENDING đang tồn tại → 409; Idempotency-Key trùng → 200 cùng giao dịch'),
 ('PY-B11','Webhook','Xác thực chữ ký HMAC-SHA256 của callback → 401 nếu sai/thiếu'),('PY-B12','Webhook','Callback SUCCESS: Payment PAID, Booking CONFIRMED + PAID'),
 ('PY-B13','Webhook','Đối chiếu số tiền callback với giao dịch → 422 nếu lệch'),('PY-B14','Webhook','Idempotent & chống sai thứ tự callback (SUCCESS lặp, FAILED sau PAID, SUCCESS sau FAILED)'),
 ('PY-B15','Webhook','Callback FAILED: Payment FAILED, booking giữ PENDING, cho phép thử lại'),('PY-B16','Thanh toán','Hết hạn giữ chỗ: booking chuyển EXPIRED, không cho thanh toán'),
 ('PY-B17','Hoàn tiền','Admin hoàn tiền giao dịch PAID: REFUNDED, booking CANCELLED'),('PY-B18','Hoàn tiền','Hoàn tiền: Customer/Guest bị chặn; giao dịch chưa PAID hoặc đã hoàn → 409'),
 ('PY-B19','Chống trùng','Angular: chống bấm trùng, mở 2 tab, Back/F5 sau khi thanh toán'),('PY-B20','Thanh toán','Angular: hiển thị responsive, thông báo lỗi mạng, lịch sử giao dịch')]
flows = [
 ('Luồng thanh toán thành công: Tạo booking → Tạo giao dịch → Webhook → Xác nhận', [
  ('POST /api/bookings (Customer)', '{"packageId": "pkg-pro", "addons": [{"id": "cafe", "qty": 2}]}', '201; total do server tính', ['Tổng booking = giá Package']),
  ('POST /api/payments', '{"bookingId": "<id>", "method": "VNPAY"}', '201; PENDING; có paymentUrl', ['Tạo giao dịch thành công']),
  ('POST /api/payments/:id/callback (cổng thanh toán)', '{"result": "SUCCESS", "amount": 860000} + X-Signature', '200; Payment PAID', ['Webhook SUCCESS hợp lệ']),
  ('GET /api/bookings/:id (Admin)', '—', 'Booking CONFIRMED + PAID', ['Webhook SUCCESS hợp lệ'])]),
 ('Luồng thanh toán lỗi rồi thử lại: FAILED → Thử lại → Thành công', [
  ('POST /api/payments', '{"bookingId": "<id>", "method": "MOMO"}', '201; PENDING', ['Tạo giao dịch thành công']),
  ('POST /api/payments/:id/callback', '{"result": "FAILED"}', '200; Payment FAILED, booking PENDING', ['Webhook FAILED']),
  ('POST /api/payments (thử lại)', '{"bookingId": "<id>", "method": "MOMO"}', '201; giao dịch mới khác id cũ', ['thử lại bằng giao dịch mới']),
  ('POST /api/payments/:id/callback (giao dịch mới)', '{"result": "SUCCESS", "amount": 500000}', '200; booking CONFIRMED', ['thử lại bằng giao dịch mới'])]),
 ('Luồng hoàn tiền: Thanh toán → Admin hoàn tiền → Booking hủy', [
  ('Webhook SUCCESS cho giao dịch PENDING', '{"result": "SUCCESS", "amount": 500000}', 'Giao dịch PAID', ['Webhook SUCCESS hợp lệ']),
  ('POST /api/payments/:id/refund (Admin)', '—', '200; REFUNDED; booking CANCELLED', ['Admin hoàn tiền giao dịch PAID']),
  ('POST /api/payments/:id/refund (lần 2)', '—', '409 – không hoàn tiền hai lần', ['không hoàn hai lần']),
  ('Admin Dashboard: kiểm tra doanh thu', '—', 'Doanh thu giảm đúng số tiền hoàn', ['Admin hoàn tiền giao dịch đã thanh toán'])])]
notes = ['1. Phạm vi: tính tiền booking, tạo giao dịch, webhook cổng thanh toán, chống thanh toán trùng/race condition, hoàn tiền (mục 3.6, 3.7; NFR-03). Ca API ghi mã test tự động ở cột Ghi chú.',
 '2. Chạy tự động: npm run test:payment. Backend thật: PAYMENT_BASE_URL, ADMIN_TOKEN, CUSTOMER_TOKEN, CUSTOMER2_TOKEN, PAYMENT_WEBHOOK_SECRET.',
 '3. Chữ ký webhook (HMAC-SHA256 trên raw body), thời gian giữ chỗ 15 phút, các phương thức VNPAY/MOMO/BANK_TRANSFER là giả định – cần đối chiếu với cổng thanh toán thật. Test thủ công chỉ dùng môi trường SANDBOX.',
 '4. Toàn bộ TC đang "Chưa chạy" – automation chỉ đạt trên server mô phỏng; QA chạy lại trên hệ thống thật và ghi kết quả.']
d = dict(title='BỘ TEST CASE – THANH TOÁN: TÍNH TIỀN, WEBHOOK, CHỐNG TRÙNG & HOÀN TIỀN (ĐỒ ÁN KÉN)', scope='Booking & Payment (mục 3.6, 3.7; NFR-03; BR-A04, BR-A05): /api/bookings, /api/payments/*, webhook cổng thanh toán, trang Thanh toán Angular',
 tools='VS Code + Node.js ≥ 20 (node:test), Postman (tùy chọn), cổng thanh toán SANDBOX, trình duyệt + DevTools (Network offline, 375px), MongoDB Compass', base='http://localhost:3000 (API /api/bookings, /api/payments/*) – Website: http://localhost:4200 (điều chỉnh theo môi trường)',
 groups=GR, tcs=tcs, flows=flows, branches=br, notes=notes)
print(build('KEN_TestCase_Payment.xlsx', d))
