import re, glob
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.formatting.rule import CellIsRule

F='Arial'
hdr=PatternFill('solid',start_color='1F4E78'); thin=Side(style='thin',color='BFBFBF'); bd=Border(left=thin,right=thin,top=thin,bottom=thin)
def head(ws,row,cols,widths):
    for i,(c,w) in enumerate(zip(cols,widths),1):
        x=ws.cell(row,i,c); x.font=Font(name=F,bold=True,color='FFFFFF',size=10); x.fill=hdr
        x.alignment=Alignment(horizontal='center',vertical='center',wrap_text=True); x.border=bd
        ws.column_dimensions[x.column_letter].width=w
    ws.row_dimensions[row].height=30

# (ma, chucnang, uutien, tieude, dieukien, cacbuoc, dulieu, mongdoi, thamchieu)
ADMIN='Đăng nhập Admin, mở Admin Dashboard (Angular)'
T=[]
def add(*a): T.append(a)
# --- Space & Zone
add('Space','Thêm mới Space','P1','Thêm Space với form hợp lệ',ADMIN,'1. Vào trang Quản lý Space\n2. Bấm "Thêm mới"\n3. Nhập form hợp lệ\n4. Bấm "Lưu"','Tên: Phòng họp A | Sức chứa: 10 | Giá: 150000 | Zone: Zone 1','Hiện thông báo thành công; bảng danh sách load lại và hiển thị Space vừa thêm với trạng thái ACTIVE','UC-18')
add('Space','Client validation','P1','Để trống trường "Tên Space"',ADMIN+'; đang mở form Thêm mới','1. Để trống "Tên Space"\n2. Nhập các trường khác hợp lệ\n3. Quan sát ô input và nút "Lưu"','Tên: (trống)','Ô "Tên Space" viền đỏ + thông báo lỗi (SweetAlert2/inline); nút "Lưu" bị mờ (disabled)','UC-18, NFR-03')
add('Space','Client validation','P1','Nhập chữ cái vào trường "Giá tiền"',ADMIN+'; đang mở form Thêm mới','1. Nhập "abc" vào "Giá tiền"\n2. Quan sát ô input và nút "Lưu"','Giá: abc','Ô "Giá tiền" viền đỏ, không nhận ký tự chữ hoặc báo lỗi; nút "Lưu" disabled','UC-18')
add('Space','Client validation','P1','Nhập giá / sức chứa là số âm',ADMIN+'; đang mở form Thêm mới','1. Nhập Giá = -100, Sức chứa = -5\n2. Quan sát','Giá: -100 | Sức chứa: -5','Hai ô báo lỗi viền đỏ; nút "Lưu" disabled; không gửi request lên server','NFR-03')
add('Space','Client validation','P2','Nhập sức chứa = 0 hoặc số thập phân',ADMIN+'; đang mở form Thêm mới','1. Nhập Sức chứa = 0, sau đó 2.5\n2. Quan sát','Sức chứa: 0 / 2.5','Báo lỗi "Sức chứa phải là số nguyên dương"; nút "Lưu" disabled','NFR-03')
add('Space','Sửa Space','P1','Cập nhật thông tin Space',ADMIN+'; có ≥1 Space','1. Chọn Space, bấm "Sửa"\n2. Đổi tên và giá\n3. Bấm "Lưu"','Tên mới: Phòng họp A+ | Giá: 180000','Danh sách hiển thị dữ liệu mới; tải lại trang (F5) dữ liệu vẫn giữ nguyên','UC-19')
add('Space','Hủy thao tác','P3','Đóng form khi đang nhập dở',ADMIN,'1. Bấm "Thêm mới", nhập vài trường\n2. Bấm "Hủy"/đóng modal','—','Form đóng, không có Space mới nào được tạo; mở lại form thì các trường trống','UC-18')
add('Space','Xóa mềm Space','P1','Xóa Space (soft delete)',ADMIN+'; có Space chưa có booking','1. Chọn Space, bấm "Xóa"\n2. Xác nhận hộp thoại\n3. Kiểm tra bảng Admin','—','Có hộp thoại xác nhận; Space chuyển trạng thái INACTIVE (không mất khỏi bảng Admin); Khách không còn thấy Space','FR-3.1')
add('Space','Xóa mềm Space','P2','Bấm "Hủy" ở hộp thoại xác nhận xóa',ADMIN,'1. Bấm "Xóa" một Space\n2. Chọn "Hủy"','—','Space giữ nguyên trạng thái ACTIVE, không có thay đổi','FR-3.1')
add('Space','Đổi trạng thái','P0','Đổi ACTIVE → MAINTENANCE, kiểm tra phía khách',ADMIN+'; mở thêm tab ẩn danh (vai Khách hàng)','1. Admin chọn Space đang ACTIVE, đổi sang MAINTENANCE\n2. Mở trang chủ (tab khách), tìm Space đó\n3. F5 trang đặt chỗ','Space: Phòng họp A','Space bị ẩn khỏi danh sách đặt chỗ hoặc bôi mờ và không thể chọn','UC-19, BR-A04')
add('Space','Đổi trạng thái','P1','Đổi MAINTENANCE → ACTIVE, Space hiện lại',ADMIN+'; Space đang MAINTENANCE','1. Admin đổi về ACTIVE\n2. Tab khách F5 trang đặt chỗ','—','Space hiển thị lại và chọn được bình thường','UC-19')
add('Space','Phân quyền UI','P0','Customer không thấy chức năng quản trị','Đăng nhập tài khoản Customer','1. Truy cập đường dẫn /admin/spaces bằng URL trực tiếp\n2. Quan sát','URL: /admin/spaces','Bị chặn: chuyển về trang chủ/đăng nhập hoặc báo 403; không thấy nút Thêm/Sửa/Xóa','BR-A04, BR-A05')
add('Space','Phân quyền UI','P0','Khách chưa đăng nhập truy cập trang quản trị','Chưa đăng nhập (tab ẩn danh)','1. Truy cập /admin/spaces','—','Chuyển hướng đến trang đăng nhập; không lộ dữ liệu quản trị','BR-A05')
add('Zone','Hiển thị danh sách','P1','Xem danh sách Zone & số Space thuộc Zone',ADMIN,'1. Vào trang Quản lý Zone\n2. Đối chiếu số lượng với dữ liệu MongoDB Atlas','—','Danh sách đủ Zone; thông tin khớp dữ liệu nguồn','Mục 3.2')
add('Zone','Thêm / sửa Zone','P1','Thêm mới Zone hợp lệ',ADMIN,'1. Bấm "Thêm mới"\n2. Nhập tên Zone\n3. Lưu','Tên: Zone 5','Zone mới xuất hiện trong danh sách và trong dropdown "Zone" ở form Space','UC-18')
add('Zone','Xóa mềm Zone','P1','Xóa Zone đang có Space',ADMIN+'; Zone có ≥1 Space ACTIVE','1. Bấm "Xóa" Zone đó\n2. Xác nhận','—','Zone chuyển INACTIVE; hệ thống cảnh báo hoặc xử lý hợp lý Space thuộc Zone (ghi lại hành vi thực tế)','FR-3.1')
add('Zone','Lọc / tìm kiếm','P2','Tìm Zone theo tên',ADMIN,'1. Nhập từ khóa vào ô tìm kiếm\n2. Xóa từ khóa','Từ khóa: Zone 1','Danh sách lọc đúng; xóa từ khóa thì trả về đầy đủ','Mục 3.2')
# --- Package
add('Package','Dropdown liên kết','P1','Dropdown "Áp dụng cho Space" chỉ có Space ACTIVE',ADMIN+'; có Space ACTIVE, MAINTENANCE và Space đã xóa mềm','1. Vào Quản lý Package, bấm "Thêm mới"\n2. Mở dropdown "Áp dụng cho Space"','—','Chỉ liệt kê các Space ACTIVE; không hiện Space đã xóa mềm (và MAINTENANCE nếu theo đặc tả)','UC-18, FR-3.1')
add('Package','Thêm mới Package','P1','Tạo Package kèm Inclusion',ADMIN,'1. Thêm mới Package\n2. Chọn Space, thêm 2 Inclusion có giá khác nhau\n3. Lưu','Tên: Gói Học Nhóm | Giá: 500000','Package lưu thành công; mở chi tiết thấy đủ Inclusion và Space đã chọn','Mục 3.3')
add('Package','Client validation','P1','Lưu Package khi chưa chọn Space hoặc giá âm',ADMIN,'1. Thêm mới, để trống Space\n2. Nhập giá -1','Giá: -1','Báo lỗi viền đỏ; nút "Lưu" disabled','NFR-03')
add('Package','Hiển thị giá','P1','Giá chênh lệch Inclusion hiển thị đúng',ADMIN+'; Package có Inclusion giá chênh lệch','1. Mở trang đặt chỗ phía khách\n2. Chọn lần lượt từng Inclusion','Inclusion A: +0 | B: +50000','Tổng tiền thay đổi đúng theo phần chênh lệch; khớp với dữ liệu Admin','Mục 3.3, 3.6')
add('Package','Ẩn theo trạng thái','P0','Package INACTIVE/MAINTENANCE không hiện với khách',ADMIN,'1. Admin đổi Package sang INACTIVE rồi MAINTENANCE\n2. Tab khách F5 danh sách Package','—','Khách chỉ thấy Package ACTIVE','BR-A04')
add('Package','Sửa Package','P1','Cập nhật giá Package, Booking cũ không đổi',ADMIN+'; Package đã có Booking','1. Sửa giá Package\n2. Xem Booking cũ ở trang Admin','Giá mới: 600000','Booking cũ giữ nguyên giá đã chốt; Booking mới dùng giá mới','Mục 3.3, 3.6')
# --- Product
add('Product','Thêm kèm hình ảnh','P1','Thêm Product mới kèm hình ảnh',ADMIN,'1. Vào Quản lý Product, bấm "Thêm mới"\n2. Nhập form hợp lệ, tải ảnh JPG ≤2MB\n3. Lưu','Tên: Cà phê sữa | Giá: 30000 | Ảnh: ca-phe.jpg','Product được lưu; ảnh hiển thị đúng ở bảng Admin','Mục 3.4')
add('Product','Upload ảnh','P2','Tải lên tệp không phải ảnh hoặc quá dung lượng',ADMIN,'1. Chọn file .pdf / .exe\n2. Chọn ảnh >5MB','File: test.pdf; big.jpg','Báo lỗi định dạng/dung lượng; không tạo Product lỗi','NFR-03')
add('Product','Responsive','P1','Ảnh Product trên trình duyệt điện thoại',ADMIN+'; Product vừa thêm có ảnh','1. Mở trang KÉN Kết Nối trên điện thoại (hoặc DevTools 375px)\n2. Cuộn đến Product','Màn hình: 375x667, 414x896','Ảnh không méo tỉ lệ, không tràn viền, không vỡ layout','Mục 3.4')
add('Product','Responsive','P2','Ảnh Product trên tablet & desktop','Product có ảnh','1. Mở ở 768px và 1366px','—','Ảnh hiển thị cân đối, kích thước nhất quán giữa các thẻ Product','Mục 3.4')
add('Product','Add-on khi đặt chỗ','P1','Chọn nhiều Add-on, tổng tiền đúng','Đăng nhập Customer','1. Chọn Space + Package\n2. Thêm Cà phê ×2, Bánh ×1\n3. Xem tổng tiền','Cà phê 30000×2, Bánh 25000×1','Tổng Add-on = 85000; tổng tiền khớp quy tắc làm tròn','Mục 3.4, 3.6')
add('Product','Ẩn theo trạng thái','P1','Product INACTIVE không hiện ở bước chọn Add-on',ADMIN,'1. Admin đổi Product sang INACTIVE\n2. Khách mở bước chọn Add-on','—','Product không xuất hiện trong danh sách Add-on của khách','FR-3.1')
add('Product','Đổi giá','P1','Admin đổi giá Product, giao diện khách cập nhật',ADMIN,'1. Sửa giá Product\n2. Khách F5 bước Add-on','Giá mới: 35000','Khách thấy giá mới; không cần khởi động lại server','Mục 3.4')

wb=Workbook()
ws0=wb.active; ws0.title='Hướng dẫn'
guide=[('KÉN KẾT NỐI - KEN_Test_Cases (Module: CATALOG)',True),('',False),
('Cấu trúc file',True),('• TC_Catalog_Manual: test thủ công trên Angular Admin Dashboard (QA điền cột "Kết quả thực tế", "Trạng thái", "Người test").',False),
('• Automation_Map: danh sách test tự động (node:test) và mã TC tương ứng - xem tests/ trong VS Code.',False),('• Tổng hợp: thống kê Pass/Fail/Blocked tự tính bằng công thức.',False),('',False),
('Quy ước (theo tài liệu mục 5)',True),('• Mã TC: TC-[MODULE]-[SỐ] - ví dụ TC-SPACE-001. Trạng thái: chưa chạy / Pass / Fail / Blocked.',False),
('• Ưu tiên: P0 rất cao, P1 cao, P2 trung bình, P3 thấp. Test case P0 phải Pass trước nghiệm thu.',False),
('• Ô vàng nhạt = ô QA cần điền. Trạng thái mặc định "chưa chạy".',False),('',False),
('Chạy test tự động trên VS Code',True),('1) npm test            - chạy toàn bộ (unit + API), mặc định dùng mock server',False),
('2) npm run test:coverage - đo coverage',False),('3) TEST_BASE_URL=http://localhost:3000 ADMIN_TOKEN=<jwt> CUSTOMER_TOKEN=<jwt> npm run test:api  - chạy với backend thật',False)]
for i,(t,b) in enumerate(guide,1):
    c=ws0.cell(i,1,t); c.font=Font(name=F,bold=b,size=13 if i==1 else 10)
ws0.column_dimensions['A'].width=120

ws=wb.create_sheet('TC_Catalog_Manual')
cols=['Mã TC','Module','Chức năng','Ưu tiên','Tiêu đề test case','Điều kiện tiên quyết','Các bước thực hiện','Dữ liệu test','Kết quả mong đợi','Kết quả thực tế','Trạng thái','Người test','Ngày test','Bug ID / Ghi chú','Tham chiếu']
head(ws,1,cols,[16,10,18,8,34,34,44,30,44,30,12,14,12,22,14])
yellow=PatternFill('solid',start_color='FFF2CC')
cnt={}
for r,(mod,cn,pr,ti,dk,st,dl,ex,ref) in enumerate(T,2):
    cnt[mod]=cnt.get(mod,0)+1
    code=f'TC-{mod.upper()}-{cnt[mod]:03d}'
    vals=[code,mod,cn,pr,ti,dk,st,dl,ex,'','chưa chạy','','','',ref]
    for c,v in enumerate(vals,1):
        x=ws.cell(r,c,v); x.font=Font(name=F,size=10); x.border=bd; x.alignment=Alignment(vertical='top',wrap_text=True)
        if c in (10,11,12,13,14): x.fill=yellow
    ws.cell(r,13).number_format='dd/mm/yyyy'
last=len(T)+1
ws.freeze_panes='B2'; ws.auto_filter.ref=f'A1:O{last}'
dv=DataValidation(type='list',formula1='"chưa chạy,Pass,Fail,Blocked"',allow_blank=False); ws.add_data_validation(dv); dv.add(f'K2:K{last}')
dp=DataValidation(type='list',formula1='"P0,P1,P2,P3"'); ws.add_data_validation(dp); dp.add(f'D2:D{last}')
for txt,col in (('Pass','C6EFCE'),('Fail','FFC7CE'),('Blocked','FFEB9C')):
    ws.conditional_formatting.add(f'K2:K{last}',CellIsRule(operator='equal',formula=[f'"{txt}"'],fill=PatternFill('solid',start_color=col,end_color=col)))

# Automation map
wa=wb.create_sheet('Automation_Map')
head(wa,1,['Mã TC (auto)','File test','Mô tả','Loại','Ghi chú'],[18,40,80,14,20])
r=2
for f in sorted(glob.glob('tests/*/*.test.js')):
    src=open(f,encoding='utf-8').read()
    seen=set()
    for m in re.finditer(r"(TC-CAT-[A-Z]-\d+)(?: \[\$\{col\}\])?: ([^`'\n]*)",src):
        code,desc=m.group(1),m.group(2).strip()
        if (code,desc) in seen: continue
        seen.add((code,desc))
        row=[code,f,desc,'Unit' if '/unit/' in f else 'API','Tự động']
        for c,v in enumerate(row,1):
            x=wa.cell(r,c,v); x.font=Font(name=F,size=10); x.border=bd; x.alignment=Alignment(wrap_text=True,vertical='top')
        r+=1
wa.freeze_panes='A2'

# Summary
wsu=wb.create_sheet('Tổng hợp')
head(wsu,1,['Module','Tổng TC','Pass','Fail','Blocked','Chưa chạy','% Pass'],[16,12,10,10,10,12,12])
mods=list(cnt)
for i,m in enumerate(mods,2):
    rng=lambda col:f"TC_Catalog_Manual!${col}$2:${col}${last}"
    wsu.cell(i,1,m)
    wsu.cell(i,2,f'=COUNTIF({rng("B")},A{i})')
    for j,s in enumerate(['Pass','Fail','Blocked','chưa chạy'],3):
        wsu.cell(i,j,f'=COUNTIFS({rng("B")},$A{i},{rng("K")},"{s}")')
    wsu.cell(i,7,f'=IF(B{i}=0,0,C{i}/B{i})'); wsu.cell(i,7).number_format='0.0%'
t=len(mods)+2
wsu.cell(t,1,'TỔNG')
for j in range(2,7): 
    L=wsu.cell(1,j).column_letter; wsu.cell(t,j,f'=SUM({L}2:{L}{t-1})')
wsu.cell(t,7,f'=IF(B{t}=0,0,C{t}/B{t})'); wsu.cell(t,7).number_format='0.0%'
for row in wsu.iter_rows(min_row=2,max_row=t):
    for c in row: c.font=Font(name=F,size=10,bold=(c.row==t)); c.border=bd
wsu.cell(t+2,1,f'Test tự động: xem sheet Automation_Map (đếm: ').font=Font(name=F,size=9,italic=True)
wsu.cell(t+2,1,'="Test tự động: "&COUNTA(Automation_Map!A2:A200)&" test (chạy bằng npm test, kết quả Pass/Fail xem terminal VS Code)"')
wsu.cell(t+2,1).font=Font(name=F,size=9,italic=True)
wb.move_sheet('Tổng hợp',offset=-2)
import os; os.makedirs('/mnt/user-data/outputs',exist_ok=True)
wb.save('/home/claude/ken-tests/KEN_Test_Cases_Catalog.xlsx')
print(len(T),'manual TCs; auto rows',r-2)
