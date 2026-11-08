import re, glob
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.formatting.rule import CellIsRule
F='Arial'; hdr=PatternFill('solid',start_color='1F4E78'); yellow=PatternFill('solid',start_color='FFF2CC')
thin=Side(style='thin',color='BFBFBF'); bd=Border(left=thin,right=thin,top=thin,bottom=thin)
def head(ws,cols,widths):
    for i,(c,w) in enumerate(zip(cols,widths),1):
        x=ws.cell(1,i,c); x.font=Font(name=F,bold=True,color='FFFFFF',size=10); x.fill=hdr
        x.alignment=Alignment(horizontal='center',vertical='center',wrap_text=True); x.border=bd
        ws.column_dimensions[x.column_letter].width=w
    ws.row_dimensions[1].height=30
def build(out,title,sheet,cases,prefix_re,files,intro):
    wb=Workbook(); g=wb.active; g.title='Hướng dẫn'
    lines=[(f'KÉN KẾT NỐI - KEN_Test_Cases ({title})',1),('',0),('Cấu trúc file',1),
    (f'• {sheet}: test thủ công trên giao diện Angular. QA điền "Kết quả thực tế", "Trạng thái", "Người test" (ô vàng).',0),
    ('• Automation_Map: các test tự động (node:test) tương ứng - chạy bằng npm test trong VS Code.',0),
    ('• Tổng hợp: thống kê Pass/Fail/Blocked bằng công thức.',0),('',0),
    ('Quy ước: P0 rất cao, P1 cao, P2 trung bình, P3 thấp. Trạng thái: chưa chạy / Pass / Fail / Blocked. P0 phải Pass trước nghiệm thu.',0),('',0)]+[(x,0) for x in intro]
    for i,(t,b) in enumerate(lines,1): g.cell(i,1,t).font=Font(name=F,bold=bool(b),size=13 if i==1 else 10)
    g.column_dimensions['A'].width=130
    ws=wb.create_sheet(sheet)
    head(ws,['Mã TC','Module','Chức năng','Ưu tiên','Tiêu đề test case','Điều kiện tiên quyết','Các bước thực hiện','Dữ liệu test','Kết quả mong đợi','Kết quả thực tế','Trạng thái','Người test','Ngày test','Bug ID / Ghi chú','Tham chiếu'],[16,10,18,8,34,34,44,30,44,30,12,14,12,22,14])
    cnt={}
    for r,(mod,cn,pr,ti,dk,st,dl,ex,ref) in enumerate(cases,2):
        cnt[mod]=cnt.get(mod,0)+1
        vals=[f'TC-{mod.upper()}-{cnt[mod]:03d}',mod,cn,pr,ti,dk,st,dl,ex,'','chưa chạy','','','',ref]
        for c,v in enumerate(vals,1):
            x=ws.cell(r,c,v); x.font=Font(name=F,size=10); x.border=bd; x.alignment=Alignment(vertical='top',wrap_text=True)
            if c in (10,11,12,13,14): x.fill=yellow
        ws.cell(r,13).number_format='dd/mm/yyyy'
    last=len(cases)+1; ws.freeze_panes='B2'; ws.auto_filter.ref=f'A1:O{last}'
    dv=DataValidation(type='list',formula1='"chưa chạy,Pass,Fail,Blocked"'); ws.add_data_validation(dv); dv.add(f'K2:K{last}')
    dp=DataValidation(type='list',formula1='"P0,P1,P2,P3"'); ws.add_data_validation(dp); dp.add(f'D2:D{last}')
    for txt,col in (('Pass','C6EFCE'),('Fail','FFC7CE'),('Blocked','FFEB9C')):
        ws.conditional_formatting.add(f'K2:K{last}',CellIsRule(operator='equal',formula=[f'"{txt}"'],fill=PatternFill('solid',start_color=col,end_color=col)))
    wa=wb.create_sheet('Automation_Map'); head(wa,['Mã TC (auto)','File test','Mô tả','Loại'],[18,42,90,10]); r=2
    for f in files:
        src=open(f,encoding='utf-8').read(); seen=set()
        for m in re.finditer(prefix_re+r"(?: \[[^\]]*\])?: ([^`'\n]*)",src):
            k=(m.group(1),m.group(2).strip())
            if k in seen: continue
            seen.add(k)
            for c,v in enumerate([k[0],f,k[1],'Unit' if '/unit/' in f else 'API'],1):
                x=wa.cell(r,c,v); x.font=Font(name=F,size=10); x.border=bd; x.alignment=Alignment(wrap_text=True,vertical='top')
            r+=1
    s=wb.create_sheet('Tổng hợp',1); head(s,['Module','Tổng TC','Pass','Fail','Blocked','Chưa chạy','% Pass'],[16,12,10,10,10,12,12])
    R=lambda c:f"'{sheet}'!${c}$2:${c}${last}"
    for i,m in enumerate(cnt,2):
        s.cell(i,1,m); s.cell(i,2,f'=COUNTIF({R("B")},A{i})')
        for j,v in enumerate(['Pass','Fail','Blocked','chưa chạy'],3): s.cell(i,j,f'=COUNTIFS({R("B")},$A{i},{R("K")},"{v}")')
        s.cell(i,7,f'=IF(B{i}=0,0,C{i}/B{i})').number_format='0.0%'
    t=len(cnt)+2; s.cell(t,1,'TỔNG')
    for j in range(2,7):
        L=s.cell(1,j).column_letter; s.cell(t,j,f'=SUM({L}2:{L}{t-1})')
    s.cell(t,7,f'=IF(B{t}=0,0,C{t}/B{t})').number_format='0.0%'
    for row in s.iter_rows(min_row=2,max_row=t):
        for c in row: c.font=Font(name=F,size=10,bold=(c.row==t)); c.border=bd
    s.cell(t+2,1,'="Test tự động: "&COUNTA(Automation_Map!A2:A300)&" test (xem kết quả ở terminal VS Code)"').font=Font(name=F,size=9,italic=True)
    wb.save(out); return len(cases),r-2
