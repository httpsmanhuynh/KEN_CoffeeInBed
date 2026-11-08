import sys; sys.path.insert(0, 'tools')
from common import *; from xl2 import build
C = load_manual('tools/catalog_xlsx.py', "ADMIN='", "wb=Workbook()")
GR = {'Space': 'SP', 'Zone': 'ZN', 'Package': 'PK', 'Product': 'PD', 'Phân quyền': 'AR', 'Validation': 'AV', 'Xóa mềm': 'AD', 'Guest chỉ đọc': 'AG'}
rules = [('Phân quyền UI', 'CT-B01; CT-B02'), ('Client validation', 'CT-B13'), ('Hủy thao tác', 'CT-B13'), ('Thêm mới Space', 'CT-B03'), ('Thêm mới Zone', 'CT-B03; CT-B07'),
 ('Cập nhật thông tin Space', 'CT-B07'), ('Xóa Space (soft delete)', 'CT-B08; CT-B12'), ('Bấm "Hủy" ở hộp thoại', 'CT-B08'), ('Đổi ACTIVE', 'CT-B14; CT-B10'), ('Đổi MAINTENANCE', 'CT-B14; CT-B10'),
 ('Xem danh sách Zone', 'CT-B11'), ('Xóa Zone', 'CT-B08'), ('Tìm Zone', 'CT-B11'), ('Dropdown "Áp dụng', 'CT-B15'), ('Tạo Package kèm', 'CT-B03; CT-B15'),
 ('Lưu Package khi chưa', 'CT-B13; CT-B04'), ('Giá chênh lệch', 'CT-B17'), ('INACTIVE/MAINTENANCE không hiện', 'CT-B10; CT-B12'), ('Cập nhật giá Package', 'CT-B07'),
 ('Thêm Product mới kèm', 'CT-B03; CT-B16'), ('Tải lên tệp', 'CT-B16; CT-B04'), ('Ảnh Product trên', 'CT-B16'), ('Chọn nhiều Add-on', 'CT-B17'), ('Product INACTIVE', 'CT-B10; CT-B12'), ('Admin đổi giá Product', 'CT-B07')]
tcs = manual_rows(C, lambda m, c, t: m, 'Admin Dashboard (Angular)', rules)
S, Z, P = '/api/catalog/spaces', '/api/catalog/zones', '/api/catalog/packages'
OK = '{"name": "Phòng họp A", "capacity": 10, "unitPrice": 150000}'
tcs += [
 A('Phân quyền', f'POST {S}', 'Negative', 'Guest (không JWT) tạo Space bị từ chối', 'Server chạy; chưa đăng nhập.', OK, f'1) Gửi POST {S} không có header Authorization\n2) Kiểm tra danh sách Admin không có bản ghi mới', '401 Unauthorized; không tạo bản ghi', '401', 'CT-B01', 'TC-CAT-A-001 (lặp cho spaces/zones/packages/products)'),
 A('Phân quyền', f'POST {S}', 'Negative', 'Customer tạo Space bị từ chối', 'Có token Customer.', OK, f'1) Gửi POST {S} với Bearer customer-token', '403 Forbidden; không tạo bản ghi', '403', 'CT-B02', 'TC-CAT-A-002'),
 A('Phân quyền', f'POST {S}', 'Positive', 'Admin tạo Space hợp lệ', 'Có token Admin.', OK, f'1) Gửi POST {S} với Bearer admin-token\n2) Kiểm tra body trả về', '201 Created; body có id, name đúng, status = ACTIVE', '201', 'CT-B03', 'TC-CAT-A-003'),
 A('Phân quyền', f'PUT | DELETE {S}/:id', 'Security', 'Guest/Customer không được sửa hoặc xóa Space', 'Đã có 1 Space ACTIVE.', '{"name": "x"}', f'1) Guest PUT /:id → 401\n2) Customer PUT /:id → 403\n3) Customer DELETE /:id → 403\n4) Admin GET /:id kiểm tra dữ liệu', '401/403 đúng từng vai trò; dữ liệu Space không đổi, status vẫn ACTIVE', '401/403', 'CT-B01; CT-B02', 'TC-CAT-A-004'),
 A('Validation', f'POST {S}', 'Boundary', 'Tạo Space với capacity = -5 (và 0)', 'Có token Admin.', '{"name": "Space X", "capacity": -5, "unitPrice": 150000}', f'1) POST {S} capacity=-5\n2) Lặp lại với capacity=0\n3) GET danh sách Admin kiểm tra không có bản ghi rác', '422 Validation Error; không tạo bản ghi', '422', 'CT-B04', 'TC-CAT-V-001, V-002'),
 A('Validation', f'POST {S}', 'Boundary', 'Tạo Space với unitPrice = -100', 'Có token Admin.', '{"name": "Space X", "capacity": 10, "unitPrice": -100}', f'1) POST {S} unitPrice=-100 (assertMoney chặn)', '422 Validation Error', '422', 'CT-B04', 'TC-CAT-V-001'),
 A('Validation', f'POST {S}', 'Negative', 'Tạo Space với unitPrice là chữ hoặc thiếu name', 'Có token Admin.', '{"name": "", "capacity": 10, "unitPrice": "abc"}', f'1) POST {S} unitPrice="abc"\n2) POST {S} name=""', '422 cho cả hai request', '422', 'CT-B04', 'TC-CAT-V-001'),
 A('Validation', f'POST {S}', 'Negative', 'Tạo Space với status không hợp lệ', 'Có token Admin.', '{"name": "Space X", "capacity": 10, "unitPrice": 1000, "status": "DELETED"}', f'1) POST {S} status="DELETED"', '422; chỉ chấp nhận ACTIVE/INACTIVE/MAINTENANCE', '422', 'CT-B06', 'TC-CAT-V-001'),
 A('Validation', f'PUT {S}/:id', 'Boundary', 'Cập nhật Space với giá âm giữ nguyên giá cũ', 'Space có unitPrice = 200000.', '{"unitPrice": -1}', f'1) PUT /:id unitPrice=-1\n2) GET /:id kiểm tra unitPrice', '422; unitPrice vẫn = 200000', '422', 'CT-B04; CT-B07', 'TC-CAT-V-003'),
 A('Validation', f'PUT {Z}/:id', 'Security', 'Update chèn trường rác {"is_admin": true} bị bỏ qua', 'Có Zone tên "Zone cũ".', '{"name": "Zone 1", "is_admin": true, "role": "ADMIN", "id": "hacked"}', f'1) PUT {Z}/:id với body trên\n2) Kiểm tra body trả về', '200; name = "Zone 1"; không có is_admin/role; id không bị ghi đè (pick() chỉ giữ trường whitelist)', '200', 'CT-B05; CT-B07', 'TC-CAT-V-004'),
 A('Validation', f'POST {S}', 'Security', 'Create chèn trường rác không được lưu (over-posting)', 'Có token Admin.', '{"name": "Space Y", "capacity": 10, "unitPrice": 1000, "is_admin": true, "createdBy": "x"}', f'1) POST {S} với body trên\n2) Kiểm tra body 201', '201; bản ghi không chứa is_admin, createdBy', '201', 'CT-B05; CT-B03', 'TC-CAT-V-005'),
 A('Validation', f'PUT {S}/:id', 'Negative', 'Sửa Space với id không tồn tại', 'Có token Admin.', '{"name": "x"}', f'1) PUT {S}/khong-ton-tai', '404 Not Found', '404', 'CT-B09', 'TC-CAT-D-004 (tương tự)'),
 A('Xóa mềm', f'DELETE {Z}/:id', 'Positive', 'DELETE Zone: bản ghi còn, status = INACTIVE', 'Có Zone ACTIVE.', '—', f'1) Admin DELETE {Z}/:id\n2) Admin GET {Z}/:id', 'DELETE 200/204; GET vẫn 200, id không đổi, status = INACTIVE (không mất dòng trong DB)', '200', 'CT-B08', 'TC-CAT-D-001'),
 A('Xóa mềm', f'GET {S}', 'Positive', 'Space xóa mềm vẫn nằm trong danh sách Admin', 'Có Space ACTIVE.', '—', f'1) Admin DELETE {S}/:id\n2) Admin GET {S}', 'Danh sách Admin vẫn chứa Space đó với status = INACTIVE', '200', 'CT-B08; CT-B11', 'TC-CAT-D-002'),
 A('Xóa mềm', f'GET {S} | GET {S}/:id', 'Positive', 'Space xóa mềm ẩn với Guest (danh sách và chi tiết)', 'Space đã bị xóa mềm.', '—', f'1) Guest GET {S} → không có Space\n2) Guest GET {S}/:id', 'List 200 không chứa Space; detail trả 404', '200/404', 'CT-B10; CT-B12', 'TC-CAT-D-003'),
 A('Xóa mềm', f'DELETE {Z}/:id', 'Negative', 'DELETE id không tồn tại', 'Có token Admin.', '—', f'1) DELETE {Z}/khong-ton-tai', '404 Not Found', '404', 'CT-B09', 'TC-CAT-D-004'),
 A('Xóa mềm', f'DELETE {Z}/:id', 'Boundary', 'DELETE lặp lại hai lần không lỗi 5xx', 'Zone đã INACTIVE.', '—', f'1) DELETE {Z}/:id lần 2\n2) GET lại', 'Không trả 5xx; status vẫn INACTIVE', '200', 'CT-B08', 'TC-CAT-D-005'),
 A('Guest chỉ đọc', f'GET {P}', 'Security', 'Guest GET /packages chỉ thấy ACTIVE (ẩn INACTIVE, MAINTENANCE)', 'Có Package ACTIVE, INACTIVE, MAINTENANCE.', '—', f'1) Gửi GET {P} không JWT\n2) Kiểm tra từng item trong data', '200; mọi item status = ACTIVE; không chứa 2 Package INACTIVE/MAINTENANCE', '200', 'CT-B10', 'TC-CAT-R-001'),
 A('Guest chỉ đọc', f'GET {P}', 'Positive', 'Admin thấy đủ 3 trạng thái', 'Như trên.', '—', f'1) Admin GET {P}', 'Có cả ACTIVE, INACTIVE, MAINTENANCE', '200', 'CT-B11', 'TC-CAT-R-002'),
 A('Guest chỉ đọc', f'GET {S}', 'Security', 'Customer cũng chỉ thấy ACTIVE', 'Có token Customer.', '—', f'1) Customer GET {S}', '200; mọi item ACTIVE', '200', 'CT-B10', 'TC-CAT-R-003'),
 A('Guest chỉ đọc', f'PUT {S}/:id', 'Positive', 'Space chuyển MAINTENANCE biến mất khỏi danh sách Guest', 'Space ACTIVE hiển thị với Guest.', '{"status": "MAINTENANCE"}', f'1) Guest GET {S} thấy Space\n2) Admin PUT status=MAINTENANCE\n3) Guest GET lại', 'Sau bước 2 Space không còn trong danh sách Guest', '200', 'CT-B10; CT-B14', 'TC-CAT-R-004'),
 A('Package', f'GET {S}?status=ACTIVE', 'Positive', 'API dropdown Space chỉ trả Space ACTIVE', 'Có Space ACTIVE và Space xóa mềm.', '—', f'1) Admin GET {S}?status=ACTIVE', 'Chỉ chứa Space ACTIVE; không chứa Space đã xóa mềm', '200', 'CT-B11; CT-B15', 'TC-CAT-L-001'),
 A('Package', f'POST {P}', 'Positive', 'Package lưu đúng spaceIds; Product lưu imageUrl', 'Có 1 Space ACTIVE.', '{"name": "Gói Học Nhóm", "unitPrice": 500000, "spaceIds": ["<id Space>"]}', f'1) POST {P} kèm spaceIds\n2) GET /:id kiểm tra spaceIds\n3) POST /api/catalog/products kèm imageUrl', 'spaceIds đúng như đã gửi; Product trả đúng imageUrl', '201', 'CT-B03; CT-B15', 'TC-CAT-L-002'),
]
br = [('CT-B01','Phân quyền','requireAuth: không có JWT → 401 Unauthorized'),('CT-B02','Phân quyền','requireRole(ADMIN): token Customer → 403 Forbidden (BR-A04, BR-A05)'),
 ('CT-B03','Space','POST tạo bản ghi: pick() whitelist, mặc định status ACTIVE → 201'),('CT-B04','Validation','assertMoney / assertPositiveInt: giá âm, sức chứa ≤ 0, sai kiểu → 422'),
 ('CT-B05','Validation','pick(): loại bỏ trường rác (is_admin, role, id...) khi create/update (NFR-03)'),('CT-B06','Validation','assertEnum(status): chỉ ACTIVE/INACTIVE/MAINTENANCE → 422'),
 ('CT-B07','Space','PUT/PATCH cập nhật thành công và lưu bền, giữ nguyên dữ liệu khi lỗi validation'),('CT-B08','Xóa mềm','DELETE: đặt status = INACTIVE, không xóa vật lý (FR-3.1); gọi lặp không lỗi'),
 ('CT-B09','Xóa mềm','Id không tồn tại (GET/PUT/DELETE) → 404'),('CT-B10','Guest chỉ đọc','GET danh sách với Guest/Customer: chỉ trả status ACTIVE'),
 ('CT-B11','Guest chỉ đọc','GET danh sách với Admin: thấy mọi trạng thái, hỗ trợ lọc ?status='),('CT-B12','Guest chỉ đọc','GET chi tiết bản ghi không ACTIVE với Guest → 404'),
 ('CT-B13','Space','Angular form: validation phía client (viền đỏ, nút Lưu disabled)'),('CT-B14','Space','Đổi trạng thái MAINTENANCE: giao diện khách ẩn/bôi mờ'),
 ('CT-B15','Package','Dropdown liên kết (Package → Space) chỉ liệt kê Space ACTIVE'),('CT-B16','Product','Upload & hiển thị ảnh Product, responsive trên điện thoại/tablet'),
 ('CT-B17','Package','Hiển thị giá Inclusion/Add-on và tổng tiền phía khách (mục 3.3, 3.4)')]
flows = [
 ('Vòng đời Space: Tạo → Khách thấy → Bảo trì → Xóa mềm', [
  ('POST /api/catalog/spaces (Admin)', OK, '201; status ACTIVE', ['Admin tạo Space hợp lệ']),
  ('GET /api/catalog/spaces (Guest)', '—', '200; Space vừa tạo có trong danh sách', ['Guest GET /packages']),
  ('PUT /api/catalog/spaces/:id (Admin)', '{"status": "MAINTENANCE"}', '200; Guest không còn thấy Space', ['MAINTENANCE biến mất']),
  ('DELETE /api/catalog/spaces/:id (Admin)', '—', '200; bản ghi còn, status INACTIVE', ['Space xóa mềm vẫn nằm']),
  ('GET /api/catalog/spaces/:id (Guest)', '—', '404 – Guest không truy cập được bản ghi đã xóa mềm', ['ẩn với Guest'])]),
 ('Luồng Package: Dropdown Space ACTIVE → Tạo Package → Khách xem', [
  ('Admin Dashboard: mở form thêm Package, mở dropdown "Áp dụng cho Space"', 'Có Space ACTIVE & Space đã xóa mềm', 'Chỉ liệt kê Space ACTIVE', ['Dropdown "Áp dụng']),
  ('Admin Dashboard: chọn Space, thêm 2 Inclusion, bấm Lưu', 'Gói Học Nhóm – 500.000', 'Lưu thành công, danh sách load lại', ['Tạo Package kèm']),
  ('Trang khách: mở trang đặt chỗ, chọn từng Inclusion', 'Inclusion A +0 / B +50.000', 'Tổng tiền thay đổi đúng theo chênh lệch', ['Giá chênh lệch'])]),
 ('Luồng Product: Thêm kèm ảnh → Kiểm tra responsive trên điện thoại', [
  ('Admin Dashboard: Thêm Product, tải ảnh JPG ≤ 2MB, Lưu', 'Cà phê sữa – 30.000', 'Lưu thành công, ảnh hiển thị ở bảng Admin', ['Thêm Product mới kèm']),
  ('Trang KÉN Kết Nối (375px)', '—', 'Ảnh không méo, không tràn viền', ['Ảnh Product trên trình duyệt điện thoại']),
  ('Khách chọn Add-on ở bước đặt chỗ', 'Cà phê ×2, Bánh ×1', 'Tổng Add-on = 85.000', ['Chọn nhiều Add-on'])])]
notes = ['1. Phạm vi: Zone / Space / Package / Product (Catalog) – gồm test thủ công trên Angular Admin Dashboard và test API tự động (node:test) tương ứng; các ca API ghi mã tự động ở cột Ghi chú.',
 '2. Chạy tự động: npm test (hoặc npm run test:api) trong VS Code. Mặc định dùng server mô phỏng; backend thật: đặt TEST_BASE_URL, ADMIN_TOKEN, CUSTOMER_TOKEN.',
 '3. Trạng thái toàn bộ TC là "Chưa chạy" – kết quả automation chỉ đạt trên server mô phỏng, QA cần chạy lại trên hệ thống thật rồi ghi kết quả.',
 '4. Quy ước trạng thái: Chưa chạy, Pass, Fail, Blocked để các công thức thống kê tại sheet Tổng quan và Bao phủ code tự tính.']
d = dict(title='BỘ TEST CASE – CATALOG: ZONE, SPACE, PACKAGE, PRODUCT (ĐỒ ÁN KÉN)', scope='Catalog Management (UC-18, UC-19; BR-A04, BR-A05; FR-3.1; NFR-03): /api/catalog/{zones,spaces,packages,products}, Angular Admin Dashboard',
 tools='VS Code + Node.js ≥ 20 (node:test), Postman (tùy chọn), trình duyệt + DevTools (giả lập điện thoại 375px), MongoDB Compass', base='http://localhost:3000 (API /api/catalog/*) – Admin Dashboard: http://localhost:4200/admin (điều chỉnh theo môi trường)',
 groups=GR, tcs=tcs, flows=flows, branches=br, notes=notes)
print(build('KEN_TestCase_Catalog.xlsx', d))
