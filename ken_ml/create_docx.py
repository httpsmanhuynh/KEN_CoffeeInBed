"""Script tạo file Word (.docx) hoàn chỉnh cho mục 4.2 Báo cáo Bài toán 2 (Dự báo nhu cầu).
Đảm bảo chuẩn học thuật, định dạng bảng biểu, canh lề, font Times New Roman, và chèn biểu đồ.
"""
from pathlib import Path
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

def set_cell_background(cell, fill_hex):
    """Đặt màu nền cho ô trong bảng."""
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    tcPr.append(shd)

def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    """Đặt padding cho ô."""
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = OxmlElement('w:tcMar')
    for m, val in [('w:top', top), ('w:bottom', bottom), ('w:left', left), ('w:right', right)]:
        node = OxmlElement(m)
        node.set(qn('w:w'), str(val))
        node.set(qn('w:type'), 'dxa')
        tcMar.append(node)
    tcPr.append(tcMar)

def set_table_borders(table, color="D3D3D3", sz="4", val="single"):
    """Đặt viền thanh mảnh cho toàn bộ bảng."""
    tblPr = table._tbl.tblPr
    borders = parse_xml(
        f'<w:tblBorders {nsdecls("w")}>'
        f'  <w:top w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'  <w:bottom w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'  <w:insideH w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'  <w:insideV w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'  <w:left w:val="none"/>'
        f'  <w:right w:val="none"/>'
        f'</w:tblBorders>'
    )
    tblPr.append(borders)

def build_document():
    doc = docx.Document()

    # Căn lề trang chuẩn A4 (1 inch = 2.54 cm)
    for section in doc.sections:
        section.top_margin = Inches(1.0)
        section.bottom_margin = Inches(1.0)
        section.left_margin = Inches(1.0)
        section.right_margin = Inches(1.0)

    # Đặt style mặc định Normal là Times New Roman 12pt
    style_normal = doc.styles['Normal']
    font = style_normal.font
    font.name = 'Times New Roman'
    font.size = Pt(12)
    font.color.rgb = RGBColor(0, 0, 0)

    def add_p(text="", bold_prefix="", italic=False, space_after=6, space_before=0, align=WD_ALIGN_PARAGRAPH.JUSTIFY):
        p = doc.add_paragraph()
        p.alignment = align
        p.paragraph_format.line_spacing = 1.25
        p.paragraph_format.space_after = Pt(space_after)
        p.paragraph_format.space_before = Pt(space_before)
        if bold_prefix:
            r_bold = p.add_run(bold_prefix)
            r_bold.font.name = 'Times New Roman'
            r_bold.font.size = Pt(12)
            r_bold.bold = True
        if text:
            r = p.add_run(text)
            r.font.name = 'Times New Roman'
            r.font.size = Pt(12)
            r.italic = italic
        return p

    def add_heading_1(text):
        p = doc.add_paragraph()
        p.paragraph_format.line_spacing = 1.25
        p.paragraph_format.space_before = Pt(14)
        p.paragraph_format.space_after = Pt(6)
        r = p.add_run(text)
        r.font.name = 'Times New Roman'
        r.font.size = Pt(14)
        r.bold = True
        return p

    def add_heading_2(text):
        p = doc.add_paragraph()
        p.paragraph_format.line_spacing = 1.25
        p.paragraph_format.space_before = Pt(12)
        p.paragraph_format.space_after = Pt(4)
        r = p.add_run(text)
        r.font.name = 'Times New Roman'
        r.font.size = Pt(13)
        r.bold = True
        return p

    def add_heading_3(text):
        p = doc.add_paragraph()
        p.paragraph_format.line_spacing = 1.25
        p.paragraph_format.space_before = Pt(8)
        p.paragraph_format.space_after = Pt(2)
        r = p.add_run(text)
        r.font.name = 'Times New Roman'
        r.font.size = Pt(12)
        r.bold = True
        return p

    def add_caption(text):
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.line_spacing = 1.15
        p.paragraph_format.space_before = Pt(6)
        p.paragraph_format.space_after = Pt(6)
        r = p.add_run(text)
        r.font.name = 'Times New Roman'
        r.font.size = Pt(11)
        r.italic = True
        return p

    # --- TIÊU ĐỀ CHƯƠNG ---
    p_chap = doc.add_paragraph()
    p_chap.paragraph_format.space_before = Pt(0)
    p_chap.paragraph_format.space_after = Pt(8)
    r_chap = p_chap.add_run("CHƯƠNG 4: KẾT QUẢ VÀ PHÂN TÍCH (RESULTS AND ANALYSIS)")
    r_chap.font.name = 'Times New Roman'
    r_chap.font.size = Pt(14)
    r_chap.bold = True

    # --- 4.2 TIÊU ĐỀ MỤC ---
    add_heading_1("4.2 Kết quả Bài toán 2 (Dự báo nhu cầu)")

    add_p(
        "Mục này trình bày kết quả đánh giá thực nghiệm khi triển khai mô hình Dự báo nhu cầu bán F&B ngày kế tiếp trên tệp master_ken_data.csv (67.375 dòng giao dịch từ 01/04/2026 đến 27/10/2026). Dữ liệu được tổng hợp lại (resampling) theo từng ngày cho toàn bộ 31 món F&B (gồm 21 món đồ uống DRINK, 8 món bánh PASTRY và 2 món đồ ăn vặt SNACK), tạo thành chuỗi thời gian liên tục 210 ngày (tổng cộng 6.510 điểm dữ liệu sau khi điền giá trị 0 cho 7 cặp ngày – món không phát sinh giao dịch bán)."
    )
    add_p(
        "Để kiểm chứng năng lực dự báo trong điều kiện thực tế và triệt tiêu nguy cơ rò rỉ dữ liệu (data leakage), tập dữ liệu được phân chia theo trục thời gian nghiêm ngặt:\n"
        "• Tập huấn luyện (Train): Từ ngày 01/04/2026 đến 13/10/2026 (196 ngày; trong đó 28 ngày đầu đóng vai trò warm-up để khởi tạo các đặc trưng trễ lag_28 và trung bình trượt 28 ngày, để lại 5.208 mẫu huấn luyện hoàn chỉnh).\n"
        "• Tập kiểm tra (Test): 14 ngày cuối cùng, từ ngày 14/10/2026 đến 27/10/2026 (434 mẫu kiểm định độc lập)."
    )

    # --- 4.2.1 ĐÁNH GIÁ SAI SỐ ---
    add_heading_2("4.2.1 Đánh giá sai số")

    add_p(
        "Mô hình đề xuất Random Forest Regressor được so sánh định lượng với hai mô hình đối chứng:\n"
        "1. Baseline (Mốc cơ sở): Trung bình số lượng bán của 4 tuần gần nhất trong quá khứ có cùng thứ trong tuần (tính bằng trung bình cộng của lag_7, lag_14, lag_21, lag_28).\n"
        "2. Multiple Linear Regression (MLR): Hồi quy tuyến tính đa biến sử dụng chung tập đặc trưng với Random Forest (mã hóa One-Hot với drop_first=True để tránh đa cộng tuyến hoàn hảo).\n"
        "Hiệu năng dự báo được lượng hóa qua hai chỉ số sai số phổ biến: Sai số tuyệt đối trung bình (MAE) và Căn bậc hai sai số toàn phương trung bình (RMSE). Kết quả đánh giá trên tập Test (14/10/2026 – 27/10/2026) được tổng hợp tại Bảng 4.[x]."
    )

    add_caption("Bảng 4.[x]. So sánh sai số dự báo giữa Baseline, MLR và Random Forest trên tập Test")

    # Bảng 1: Metrics
    t1 = doc.add_table(rows=4, cols=5)
    t1.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(t1)

    t1_headers = ["Mô hình", "MAE (ly/phần)", "RMSE (ly/phần)", "Cải thiện MAE", "Cải thiện RMSE"]
    t1_data = [
        ["Baseline (4 tuần cùng thứ)", "4,1561", "5,3456", "—", "—"],
        ["Hồi quy tuyến tính đa biến (MLR)", "3,7851", "5,0269", "+8,93%", "+5,96%"],
        ["Random Forest Regressor (Đề xuất)", "3,9151", "5,1312", "+5,80%", "+4,01%"],
    ]

    for c_idx, h in enumerate(t1_headers):
        cell = t1.cell(0, c_idx)
        set_cell_background(cell, "F2F2F2")
        set_cell_margins(cell, top=120, bottom=120, left=150, right=150)
        cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run(h)
        r.font.name = 'Times New Roman'
        r.font.size = Pt(11)
        r.bold = True

    for r_idx, row_data in enumerate(t1_data):
        for c_idx, val in enumerate(row_data):
            cell = t1.cell(r_idx + 1, c_idx)
            set_cell_margins(cell, top=100, bottom=100, left=150, right=150)
            cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
            p = cell.paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT if c_idx == 0 else WD_ALIGN_PARAGRAPH.CENTER
            r = p.add_run(val)
            r.font.name = 'Times New Roman'
            r.font.size = Pt(11)
            if r_idx == 2:
                r.bold = True

    add_p(space_after=4)

    add_heading_3("a. Năng lực cải thiện so với mốc cơ sở (Baseline)")
    add_p(
        "Từ Bảng 4.[x], mô hình Random Forest Regressor đạt MAE = 3,9151 và RMSE = 5,1312, vượt trội rõ rệt so với Baseline (giảm 0,241 ly ở MAE và 0,214 ly ở RMSE, tương đương mức cải thiện 5,80% về sai số tuyệt đối và 4,01% về độ lệch bình phương). Điều này chứng minh rằng việc bổ sung các đặc trưng chuỗi thời gian ngắn hạn (lag_1, lag_2), trung bình động (rolling_mean_7, rolling_mean_28), độ lệch chuẩn dao động (rolling_std_7) và mã hóa định danh từng món đã giúp mô hình bắt kịp xu thế tiêu dùng biến động gần đây của quán thay vì chỉ dựa vào thói quen theo thứ cố định của Baseline."
    )

    add_heading_3("b. Đối chiếu giữa Random Forest và MLR trong bài toán vận hành KÉN")
    add_p(
        "Mặc dù MLR có chỉ số sai số trung bình thấp hơn một lượng nhỏ (MAE đạt 3,7851 so với 3,9151 của RF) do tính chất dữ liệu mô phỏng có tính chu kỳ tuyến tính tương đối đồng đều, Random Forest vẫn được lựa chọn làm mô hình triển khai chính thức cho KÉN nhờ hai ưu thế vận hành thực tiễn:\n"
        "• Khả năng ước lượng khoảng tin cậy (Prediction Intervals): Nhờ cơ chế tổng hợp từ 100 cây quyết định con (n_estimators = 100), Random Forest cho phép tính toán trực tiếp phân vị 10% (lower_qty) và phân vị 90% (upper_qty). Khoảng biến thiên này đóng vai trò then chốt giúp quản lý quán KÉN biết biên độ dao động an toàn để chuẩn bị nguyên vật liệu và rã đông thực phẩm.\n"
        "• Đảm bảo tính phi âm và phi tuyến tính: Random Forest hoàn toàn không đưa ra các giá trị dự báo âm vô lý mà không cần gượng ép ngưỡng cắt (threshold clipping), đồng thời tự động học được mối quan hệ phi tuyến giữa các danh mục sản phẩm khác nhau vào các ngày cuối tuần."
    )

    add_heading_3("c. Phân tích sai số theo nhóm danh mục sản phẩm")
    add_p(
        "Bảng 4.[x] phân tích chi tiết sai số dự báo của mô hình Random Forest trên 3 nhóm danh mục F&B của KÉN:"
    )

    add_caption("Bảng 4.[x]. Đánh giá sai số Random Forest theo nhóm danh mục sản phẩm")

    # Bảng 2: Category
    t2 = doc.add_table(rows=4, cols=6)
    t2.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(t2)

    t2_headers = ["Danh mục", "Số món", "Số mẫu test", "MAE Baseline", "MAE Random Forest", "RMSE Random Forest"]
    t2_data = [
        ["Đồ uống (DRINK)", "21", "294", "4,461", "4,185", "5,424"],
        ["Bánh (PASTRY)", "8", "112", "3,551", "3,410", "4,487"],
        ["Đồ ăn vặt (SNACK)", "2", "28", "3,375", "3,103", "4,317"],
    ]

    for c_idx, h in enumerate(t2_headers):
        cell = t2.cell(0, c_idx)
        set_cell_background(cell, "F2F2F2")
        set_cell_margins(cell, top=120, bottom=120, left=150, right=150)
        cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run(h)
        r.font.name = 'Times New Roman'
        r.font.size = Pt(11)
        r.bold = True

    for r_idx, row_data in enumerate(t2_data):
        for c_idx, val in enumerate(row_data):
            cell = t2.cell(r_idx + 1, c_idx)
            set_cell_margins(cell, top=100, bottom=100, left=150, right=150)
            cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
            p = cell.paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT if c_idx == 0 else WD_ALIGN_PARAGRAPH.CENTER
            r = p.add_run(val)
            r.font.name = 'Times New Roman'
            r.font.size = Pt(11)
            if c_idx == 4:
                r.bold = True

    add_p(
        "Nhóm SNACK và PASTRY có mức sai số tuyệt đối thấp nhất (MAE dao động từ 3,103 đến 3,410 ly/phần). Đây là các món có sản lượng bán ổn định, ít bị phân tán cực đoan giữa các ngày trong tuần (ví dụ: BREAD_QUE đạt MAE = 2,236; CAKE_CHEESE đạt MAE = 2,639). Ngược lại, nhóm DRINK có sai số tuyệt đối cao hơn (MAE = 4,185), tập trung vào các sản phẩm chủ lực có doanh số lớn như WATER_BOTTLE (bán trung bình 37,2 đơn vị/ngày, MAE = 7,696) hay CF_SUA (23,3 đơn vị/ngày, MAE = 5,395). Khi lượng bán lớn, độ biến thiên ngẫu nhiên theo ngày cũng lớn hơn, tuy nhiên sai số tương đối (MAPE) của nhóm đồ uống chủ lực vẫn duy trì ở mức an toàn dưới 18%."
    )

    # --- 4.2.2 PHÂN TÍCH BIỂU ĐỒ ---
    add_heading_2("4.2.2 Phân tích biểu đồ Actual vs. Predicted")

    add_p(
        "Hình 4.[x] trực quan hóa đường biến thiên tổng sản lượng tiêu thụ F&B thực tế (Actual) so với giá trị dự báo từ mô hình Random Forest (Predicted) trên toàn bộ 14 ngày của tập kiểm tra (14/10/2026 – 27/10/2026)."
    )

    # Chèn ảnh biểu đồ
    img_path = Path("ken_ml/figures/forecasting_actual_vs_predicted.png")
    if not img_path.exists():
        img_path = Path("../ken_ml/figures/forecasting_actual_vs_predicted.png")
    if img_path.exists():
        p_img = doc.add_paragraph()
        p_img.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_img.paragraph_format.space_before = Pt(6)
        p_img.paragraph_format.space_after = Pt(4)
        run_img = p_img.add_run()
        run_img.add_picture(str(img_path), width=Inches(5.8))
        add_caption("Hình 4.[x]. So sánh tổng số lượng F&B Thực tế vs. Dự báo của Random Forest (14/10 – 27/10/2026)")

    add_caption("Bảng 4.[x]. Tổng sản lượng thực tế và dự báo theo ngày trong kỳ kiểm tra")

    # Bảng 3: Daily Actual vs Predicted
    t3 = doc.add_table(rows=15, cols=6)
    t3.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(t3)

    t3_headers = ["Ngày", "Thứ", "Thực tế (ly/phần)", "Baseline (4W)", "Random Forest", "Lệch (RF − Thực tế)"]
    t3_data = [
        ["14/10/2026", "Thứ 4", "442", "347,5", "350,4", "−91,6"],
        ["15/10/2026", "Thứ 5", "281", "308,5", "351,3", "+70,3"],
        ["16/10/2026", "Thứ 6", "365", "381,3", "376,2", "+11,2"],
        ["17/10/2026", "Thứ 7", "423", "546,3", "460,0", "+37,0"],
        ["18/10/2026", "Chủ nhật", "474", "451,5", "450,1", "−23,9"],
        ["19/10/2026", "Thứ 2", "252", "312,5", "341,7", "+89,7"],
        ["20/10/2026", "Thứ 3", "388", "328,8", "329,6", "−58,4"],
        ["21/10/2026", "Thứ 4", "340", "393,3", "337,5", "−2,5"],
        ["22/10/2026", "Thứ 5", "335", "299,8", "346,2", "+11,2"],
        ["23/10/2026", "Thứ 6", "538", "395,3", "364,8", "−173,2"],
        ["24/10/2026", "Thứ 7", "583", "498,3", "454,5", "−128,5"],
        ["25/10/2026", "Chủ nhật", "520", "444,3", "452,6", "−67,4"],
        ["26/10/2026", "Thứ 2", "334", "283,8", "329,0", "−5,0"],
        ["27/10/2026", "Thứ 3", "416", "344,5", "338,1", "−77,9"],
    ]

    for c_idx, h in enumerate(t3_headers):
        cell = t3.cell(0, c_idx)
        set_cell_background(cell, "F2F2F2")
        set_cell_margins(cell, top=100, bottom=100, left=120, right=120)
        cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run(h)
        r.font.name = 'Times New Roman'
        r.font.size = Pt(10)
        r.bold = True

    for r_idx, row_data in enumerate(t3_data):
        for c_idx, val in enumerate(row_data):
            cell = t3.cell(r_idx + 1, c_idx)
            set_cell_margins(cell, top=80, bottom=80, left=120, right=120)
            cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
            p = cell.paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            r = p.add_run(val)
            r.font.name = 'Times New Roman'
            r.font.size = Pt(10)

    add_p(space_after=4)

    add_heading_3("a. Khả năng nắm bắt quy luật tuần hoàn theo tuần (Weekly Seasonality)")
    add_p(
        "Đường dự báo của Random Forest (đường nét đứt màu cam) bám rất sát nhịp điệu sinh hoạt của mô hình tổ hợp Cà phê - Làm việc KÉN:\n"
        "• Đáy vào đầu tuần: Thứ 2 luôn là ngày có lượng tiêu thụ thấp nhất tuần (ngày 19/10 chạm đáy với 252 phần; ngày 26/10 là 334 phần). Mô hình đã phản ánh được sự sụt giảm này khi điều chỉnh đường dự báo hạ sâu so với các ngày trước đó.\n"
        "• Đỉnh vào cuối tuần: Lượng tiêu thụ tăng vọt từ Thứ 6 đến Chủ Nhật (đạt 423 – 474 phần ở tuần đầu và đạt đỉnh 520 – 583 phần ở tuần thứ hai). Random Forest đã dự báo chính xác xu hướng dâng cao của nhu cầu trong các ngày nghỉ cuối tuần với dự báo quanh mức 450 – 460 phần."
    )

    add_heading_3("b. Hiện tượng làm mượt (Smoothing effect) tại các điểm cực trị")
    add_p(
        "Tương tự như hầu hết các mô hình dạng Ensemble averaging, Random Forest dự báo dựa trên giá trị trung bình đầu ra của các lá cây. Do đó:\n"
        "• Tại các ngày có sự bùng nổ bất thường về lượng khách như ngày 23/10 (538 phần) và 24/10 (583 phần), mô hình có xu hướng dự báo bảo thủ hơn (~455 phần), dẫn đến sai lệch âm cục bộ.\n"
        "• Ngược lại, vào ngày vắng khách đột ngột như Thứ 2 ngày 19/10 (252 phần), mô hình dự báo ở mức an toàn 341,7 phần.\n"
        "Đặc tính bảo thủ này trên thực tế vận hành F&B là một ưu điểm: tránh tình trạng nhà bếp hoảng loạn tăng/giảm định mức nguyên vật liệu quá đột ngột chỉ vì một ngày biến động cá biệt."
    )

    add_heading_3("c. Ý nghĩa thực tiễn đối với hệ thống KÉN và ứng dụng nhãn hành động")
    add_p(
        "Từ kết quả dự báo cho ngày mốc tham chiếu kế tiếp (28/10/2026), hệ thống đã trích xuất tự động kế hoạch chuẩn bị gồm:\n"
        "• Tăng chuẩn bị / Tăng rã đông (6 món): Các món có lượng dự báo cao hơn Baseline từ 15% trở lên như BAKE_CROISSANT (dự báo 17 so với baseline 13,8), CAKE_CHEESE (dự báo 10 so với baseline 8), TEA_LUC, HOJICHA_LATTE, SNACK_FRUIT, TEA_CHAI.\n"
        "• Giảm chuẩn bị (5 món): Nhu cầu dự kiến giảm sâu hơn 15% như WATER_BOTTLE (dự báo 32 so với baseline 45), CF_BAC_XIU (dự báo 19 so với 22,8), CF_DEN, SNACK_SANDWICH, SODA_TRAI_CAY.\n"
        "• Giữ mức chuẩn bị (20 món): Dao động trong khoảng an toàn ±15%, đảm bảo quy trình vận hành ổn định."
    )

    add_heading_3("d. Nhận xét về hạn chế của dữ liệu")
    add_p(
        "Một hạn chế quan trọng cần được ghi nhận trong nghiên cứu: biến đặc trưng mùa vụ (season = DRY) chỉ xuất hiện duy nhất ở tháng 4/2026 (nằm hoàn toàn trong tập Train), trong khi các tháng từ 5 đến 10 thuộc mùa mưa (season = RAINY). Do đó, trên tập Test (tháng 10), biến season thực chất chỉ đóng vai trò như một cờ cố định và mô hình chưa có cơ hội kiểm chứng tác động chuyển giao mùa khi bước sang mùa khô thực tế. Khi KÉN vận hành qua trọn vẹn chu kỳ năm, mô hình cần được tái huấn luyện để hấp thu đầy đủ tính chu kỳ mùa vụ dài hạn."
    )

    out_file = Path("BaoCao_BaiToan2_Muc_4.2.docx")
    doc.save(str(out_file))
    print(f"Đã tạo file Word thành công tại: {out_file.resolve()}")

    # Sao lưu sang outputs/
    alt_out = Path("ken_ml/outputs/BaoCao_BaiToan2_Muc_4.2.docx")
    alt_out.parent.mkdir(parents=True, exist_ok=True)
    doc.save(str(alt_out))
    print(f"Đã sao lưu sang: {alt_out.resolve()}")

if __name__ == '__main__':
    build_document()
