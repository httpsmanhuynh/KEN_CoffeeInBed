# Bộ dựng file test theo ĐÚNG format mẫu KEN_TestCase_Profile_RateLimit_Session_OTP.xlsx
import math
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation

FN = 'Times New Roman'
NAVY, BLUE, W, G, YEL = '1F3864', 'D9E2F3', 'FFFFFF', 'F9FAFB', 'FFF2CC'
bd = Border(*(Side(style='thin', color='D9D9D9'),) * 4)
fill = lambda c: PatternFill('solid', start_color=c, end_color=c)
def font(b=False, sz=10, color='000000'): return Font(name=FN, size=sz, bold=b, color=color)
def put(ws, r, c, v, b=False, bg=None, h=None, wrap=True, sz=10, color='000000', border=True, fmt=None, v_al='center'):
    x = ws.cell(r, c, v); x.font = font(b, sz, color)
    if bg: x.fill = fill(bg)
    x.alignment = Alignment(horizontal=h, vertical=v_al, wrap_text=wrap)
    if border: x.border = bd
    if fmt: x.number_format = fmt
    return x
def lines(text, width): return sum(max(1, math.ceil(len(p) / max(width * 1.05, 1))) for p in str(text or '').split('\n'))

TC_COLS = ['Mã TC','Nhóm chức năng','API / Thành phần','Loại','Mô tả test case','Điều kiện tiên quyết','Dữ liệu vào','Các bước thực hiện','Kết quả mong đợi','HTTP mong đợi','Nhánh code bao phủ','Kết quả thực tế','Trạng thái','Ngày test','Người test','Ghi chú']
TC_W = [12.1,19.3,28,13.7,36,34,38,44,43,15.1,24,30,14.9,12,14,34]
CENTER = {1,2,3,4,10,11,12,13,14,15,16}
TESTERS = 'Trinh,Hùng,Mẫn,Thảo,Khanh'

def build(out, d):
    """d: title, scope, tools, base, groups{name:abbr}, tcs, flows, branches, notes, src_label"""
    wb = Workbook(); ov = wb.active; ov.title = 'Tổng quan'
    tc = wb.create_sheet('Test Case'); fl = wb.create_sheet('Luồng test'); cv = wb.create_sheet('Bao phủ code')
    groups = list(d['groups'])
    # ---------- đánh mã TC
    cnt = {}; rows = []
    for g in groups:
        for t in [x for x in d['tcs'] if x['g'] == g]:
            cnt[g] = cnt.get(g, 0) + 1
            t['id'] = f"TC-{d['groups'][g]}-{cnt[g]:02d}"; rows.append(t)
    n = len(rows); last = n + 1
    # ---------- Test Case
    for i, (h, w) in enumerate(zip(TC_COLS, TC_W), 1):
        put(tc, 1, i, h, True, NAVY, 'left' if i in (5,6,7,8,9) else 'center', color='FFFFFF')
        tc.column_dimensions[tc.cell(1, i).column_letter].width = w
    tc.row_dimensions[1].height = 25.5
    for r, t in enumerate(rows, 2):
        bg = W if r % 2 == 0 else G
        vals = [t['id'], t['g'], t['api'], t['type'], t['desc'], t['pre'], t['data'], t['steps'], t['exp'], t['http'], t['br'], '', 'Chưa chạy', None, None, t['note']]
        for c, v in enumerate(vals, 1):
            x = put(tc, r, c, v, b=(c == 1), bg=(YEL if c in (12,13,14,15) else bg), h='center' if c in CENTER else 'left')
        tc.cell(r, 14).number_format = 'dd/mm/yyyy'
        tc.row_dimensions[r].height = min(max(54, 13 * max(lines(t['steps'], 44), lines(t['exp'], 43), lines(t['desc'], 36), lines(t['pre'], 34), lines(t['data'], 38))), 190)
    tc.freeze_panes = 'C2'; tc.auto_filter.ref = f'A1:P{last}'
    def dv(rng, f, ws=tc, custom=False):
        v = DataValidation(type='custom' if custom else 'list', formula1=f, allow_blank=True); ws.add_data_validation(v); v.add(rng)
    dv(f'B2:B{last}', '"' + ','.join(groups) + '"')
    dv(f'D2:D{last}', '"Negative,Positive,Security,Boundary"')
    dv(f'J2:J{last}', '"' + ','.join(sorted({t['http'] for t in rows})) + '"')
    dv(f'M2:M{last}', '"Chưa chạy,Pass,Fail,Blocked"')
    dv(f'O2:O{last}', f'"{TESTERS}"')
    dv(f'N2:N{last}', 'OR(NOT(ISERROR(DATEVALUE(N2))), AND(ISNUMBER(N2), LEFT(CELL("format", N2))="D"))', custom=True)
    # ---------- Luồng test
    FH = ['Mã luồng','Tên luồng','Bước','Hành động / API','Dữ liệu vào','Kết quả mong đợi','TC liên quan','Kết quả thực tế','Trạng thái']
    FW = [10,38,7,38,42,46,18,28,12]
    for i, (h, w) in enumerate(zip(FH, FW), 1):
        put(fl, 1, i, h, True, NAVY, 'center', color='FFFFFF'); fl.column_dimensions[fl.cell(1, i).column_letter].width = w
    fl.row_dimensions[1].height = 25.5
    def resolve(keys):
        out = []
        for k in keys:
            m = next((t['id'] for t in rows if k in t['desc']), None)
            if m: out.append(m)
        return ', '.join(out)
    r = 2; fcode = 0
    for name, steps in d['flows']:
        fcode += 1; code = f'F{fcode:02d}'
        for si, (act, data, exp, keys) in enumerate(steps):
            head = si == 0
            bg = BLUE if head else W
            vals = [code, name if head else None, f'{si + 1}.0', act, data, exp, resolve(keys), None, 'Chưa chạy']
            for c, v in enumerate(vals, 1):
                put(fl, r, c, v, b=(head and c in (1, 2)), bg=(YEL if c in (8, 9) else bg), h='left' if c in (2, 4, 5, 6) else 'center')
            fl.row_dimensions[r].height = max(36, 13 * max(lines(act, 38), lines(data, 42), lines(exp, 46), lines(name if head else '', 38)))
            r += 1
    fl.freeze_panes = 'A2'; dv(f'I2:I{r - 1}', '"Chưa chạy,Pass,Fail,Blocked"', fl)
    # ---------- Bao phủ code
    put(cv, 1, 1, 'BẢNG BAO PHỦ NHÁNH CODE  (branch coverage theo test case)', True, None, sz=13, color=NAVY, border=False, wrap=False)
    put(cv, 2, 1, "Mỗi nhánh (rẽ nhánh if/else, middleware, lỗi, thành công) được ánh xạ tới các TC ở cột K của sheet 'Test Case'. Các cột đếm là công thức, tự cập nhật khi đổi Trạng thái.", border=False, wrap=False)
    b0, b1 = 11, 10 + len(d['branches'])
    for r_, (lab, f_) in enumerate([('Tổng số nhánh', f'=COUNTA(A{b0}:A{b1})'), ('Nhánh đã có TC', f'=COUNTIF(C{b0}:C{b1},">0")'),
            ('Nhánh đã kiểm chứng (tất cả TC Pass)', f'=COUNTIF(F{b0}:F{b1},"Đã kiểm chứng")'), ('Tỉ lệ nhánh có TC', '=IF(B4=0,0,B5/B4)'), ('Tỉ lệ nhánh đã kiểm chứng', '=IF(B4=0,0,B6/B4)')], 4):
        put(cv, r_, 1, lab, True, BLUE, wrap=False); put(cv, r_, 2, f_, True, W, 'right', fmt='0.0%' if r_ >= 7 else None)
    for i, (h, w) in enumerate(zip(['Mã nhánh','Nhóm','Số TC bao phủ','Mô tả nhánh code','Số TC Pass','Trạng thái bao phủ','Số TC Fail'], [16,22,16.1,72.4,13,20,13]), 1):
        put(cv, 10, i, h, True, NAVY, 'center', color='FFFFFF'); cv.column_dimensions[cv.cell(10, i).column_letter].width = w
    cv.row_dimensions[10].height = 24
    K, M = "'Test Case'!$K$2:$K$500", "'Test Case'!$M$2:$M$500"
    for r_, (code, grp, desc) in enumerate(d['branches'], b0):
        bg = W if r_ % 2 else G
        vals = [code, grp, f'=COUNTIF({K},"*"&A{r_}&"*")', desc, f'=COUNTIFS({K},"*"&A{r_}&"*",{M},"Pass")',
                f'=IF(C{r_}=0,"Chưa có TC",IF(G{r_}>0,"Có Fail",IF(E{r_}=C{r_},"Đã kiểm chứng","Đã thiết kế TC")))', f'=COUNTIFS({K},"*"&A{r_}&"*",{M},"Fail")']
        for c, v in enumerate(vals, 1): put(cv, r_, c, v, b=(c == 1), bg=bg, h='left' if c == 4 else 'center')
    cv.freeze_panes = 'A11'; cv.auto_filter.ref = f'A10:G{b1}'
    # ---------- Tổng quan
    for c, w in zip('ABCDEFGH', [34, 14, 12, 16, 14, 14, 14, 8.7]): ov.column_dimensions[c].width = w
    put(ov, 1, 1, d['title'], True, None, sz=15, border=False, wrap=False)
    for r_, (k, v) in enumerate([('Phạm vi', d['scope']), ('Công cụ', d['tools']), ('Cổng / Base URL', d['base']),
            ('Cách ghi kết quả', "Điền cột 'Kết quả thực tế', chọn 'Trạng thái' (Chưa chạy/Pass/Fail/Blocked), 'Ngày test', 'Người test' – các ô vàng là ô nhập. Các thống kê bên dưới tự cập nhật.")], 3):
        put(ov, r_, 1, k, True, BLUE, wrap=False); ov.merge_cells(start_row=r_, start_column=2, end_row=r_, end_column=7)
        put(ov, r_, 2, v, h='left'); ov.row_dimensions[r_].height = max(15, 13.5 * lines(v, 88))
    put(ov, 8, 1, 'THỐNG KÊ KẾT QUẢ', True, None, border=False, wrap=False); put(ov, 8, 4, 'ĐỘ PHỦ NHÁNH CODE', True, None, border=False, wrap=False)
    TCM = "'Test Case'!$M$2:$M$500"
    L = [('Tổng số test case', "=COUNTA('Test Case'!$A$2:$A$500)", None), ('Pass', f'=COUNTIF({TCM},"Pass")', None), ('Fail', f'=COUNTIF({TCM},"Fail")', None),
         ('Blocked', f'=COUNTIF({TCM},"Blocked")', None), ('Chưa chạy', f'=COUNTIF({TCM},"Chưa chạy")', None),
         ('Tỉ lệ Pass (trên số đã chạy)', '=IF(B10+B11=0,0,B10/(B10+B11))', '0.0%'), ('Tiến độ đã chạy (Pass+Fail)/Tổng', '=IF(B9=0,0,(B10+B11)/B9)', '0.0%')]
    for r_, (k, f_, fm) in enumerate(L, 9):
        put(ov, r_, 1, k, True, BLUE, wrap=False); put(ov, r_, 2, f_, True, W, 'right', fmt=fm)
    for r_, (k, f_, fm) in enumerate([('Tổng số nhánh', "='Bao phủ code'!B4", None), ('Nhánh đã có TC', "='Bao phủ code'!B5", None), ('Nhánh đã kiểm chứng', "='Bao phủ code'!B6", None),
            ('Tỉ lệ nhánh có TC', "='Bao phủ code'!B7", '0.0%'), ('Tỉ lệ đã kiểm chứng', "='Bao phủ code'!B8", '0.0%')], 9):
        ov.merge_cells(start_row=r_, start_column=4, end_row=r_, end_column=5)
        put(ov, r_, 4, k, True, BLUE, wrap=False); ov.cell(r_, 5).border = bd; ov.cell(r_, 5).fill = fill(BLUE)
        put(ov, r_, 6, f_, True, W, 'right', fmt=fm)
    put(ov, 17, 1, 'THỐNG KÊ THEO NHÓM CHỨC NĂNG', True, None, border=False, wrap=False)
    for i, h in enumerate(['Nhóm chức năng','Tổng TC','Pass','Fail','Blocked','Chưa chạy','% Pass'], 1): put(ov, 18, i, h, True, NAVY, 'left', color='FFFFFF')
    B = "'Test Case'!$B$2:$B$500"; g0 = 19
    for r_, g in enumerate(groups, g0):
        bg = W if (r_ - g0) % 2 == 0 else G
        f = [g, f'=COUNTIF({B},A{r_})'] + [f'=COUNTIFS({B},$A{r_},{TCM},"{s}")' for s in ('Pass', 'Fail', 'Blocked', 'Chưa chạy')] + [f'=IF(B{r_}=0,0,C{r_}/B{r_})']
        for c, v in enumerate(f, 1): put(ov, r_, c, v, bg=bg, h='left', fmt='0.0%' if c == 7 else None, wrap=False)
    t = g0 + len(groups); gl = t - 1
    for c, v in enumerate(['Cộng'] + [f'=SUM({x}{g0}:{x}{gl})' for x in 'BCDEF'] + [f'=IF(B{t}=0,0,C{t}/B{t})'], 1):
        put(ov, t, c, v, True, BLUE, 'left', fmt='0.0%' if c == 7 else None, wrap=False)
    nr = t + 2
    put(ov, nr, 1, 'LƯU Ý CẤU HÌNH & ĐỐI CHIẾU VỚI TÀI LIỆU / CODE TỰ ĐỘNG', True, None, border=False, wrap=False)
    for i, s in enumerate(d['notes'], 1):
        ov.merge_cells(start_row=nr + i, start_column=1, end_row=nr + i, end_column=7)
        put(ov, nr + i, 1, s, h='left', border=False, v_al='top'); ov.row_dimensions[nr + i].height = max(15, 13.5 * lines(s, 130))
    wb.save(out); return n, len(d['branches'])
