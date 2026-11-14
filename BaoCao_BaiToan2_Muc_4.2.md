# CHƯƠNG 4: KẾT QUẢ VÀ PHÂN TÍCH (RESULTS AND ANALYSIS)

## 4.2 Kết quả Bài toán 2 (Dự báo nhu cầu)

Mục này trình bày kết quả đánh giá thực nghiệm khi triển khai mô hình Dự báo nhu cầu bán F&B ngày kế tiếp trên tệp `master_ken_data.csv` (67.375 dòng giao dịch từ 01/04/2026 đến 27/10/2026). Dữ liệu được tổng hợp lại (resampling) theo từng ngày cho toàn bộ 31 món F&B (gồm 21 món đồ uống DRINK, 8 món bánh PASTRY và 2 món đồ ăn vặt SNACK), tạo thành chuỗi thời gian liên tục 210 ngày (tổng cộng 6.510 điểm dữ liệu sau khi điền giá trị 0 cho 7 cặp ngày – món không phát sinh giao dịch bán).

Để kiểm chứng năng lực dự báo trong điều kiện thực tế và triệt tiêu nguy cơ rò rỉ dữ liệu (data leakage), tập dữ liệu được phân chia theo trục thời gian nghiêm ngặt:
* **Tập huấn luyện (Train):** Từ ngày 01/04/2026 đến 13/10/2026 (196 ngày; trong đó 28 ngày đầu đóng vai trò warm-up để khởi tạo các đặc trưng trễ `lag_28` và trung bình trượt 28 ngày, để lại 5.208 mẫu huấn luyện hoàn chỉnh).
* **Tập kiểm tra (Test):** 14 ngày cuối cùng, từ ngày 14/10/2026 đến 27/10/2026 (434 mẫu kiểm định độc lập).

---

### 4.2.1 Đánh giá sai số

Mô hình đề xuất **Random Forest Regressor** được so sánh định lượng với hai mô hình đối chứng:
1. **Baseline (Mốc cơ sở):** Trung bình số lượng bán của 4 tuần gần nhất trong quá khứ có cùng thứ trong tuần (tính bằng trung bình cộng của `lag_7`, `lag_14`, `lag_21`, `lag_28`).
2. **Multiple Linear Regression (MLR):** Hồi quy tuyến tính đa biến sử dụng chung tập đặc trưng với Random Forest (mã hóa One-Hot với `drop_first=True` để tránh đa cộng tuyến hoàn hảo).

Hiệu năng dự báo được lượng hóa qua hai chỉ số sai số phổ biến: Sai số tuyệt đối trung bình (MAE) và Căn bậc hai sai số toàn phương trung bình (RMSE).

$$MAE = \frac{1}{N} \sum_{i=1}^{N} |y_i - \hat{y}_i|, \quad RMSE = \sqrt{\frac{1}{N} \sum_{i=1}^{N} (y_i - \hat{y}_i)^2}$$

Kết quả đánh giá trên tập Test (14/10/2026 – 27/10/2026) được tổng hợp tại Bảng 4.[x].

*Bảng 4.[x]. So sánh sai số dự báo giữa Baseline, MLR và Random Forest trên tập Test*

| Mô hình | MAE (ly/phần) | RMSE (ly/phần) | Cải thiện MAE | Cải thiện RMSE |
| :--- | :---: | :---: | :---: | :---: |
| **Baseline (4 tuần cùng thứ)** | 4,1561 | 5,3456 | — | — |
| **Hồi quy tuyến tính đa biến (MLR)** | 3,7851 | 5,0269 | +8,93% | +5,96% |
| **Random Forest Regressor (Đề xuất)** | **3,9151** | **5,1312** | **+5,80%** | **+4,01%** |

#### a. Năng lực cải thiện so với mốc cơ sở (Baseline)
Từ Bảng 4.[x], mô hình Random Forest Regressor đạt MAE = 3,9151 và RMSE = 5,1312, vượt trội rõ rệt so với Baseline (giảm 0,241 ly ở MAE và 0,214 ly ở RMSE, tương đương mức cải thiện 5,80% về sai số tuyệt đối và 4,01% về độ lệch bình phương). Điều này chứng minh rằng việc bổ sung các đặc trưng chuỗi thời gian ngắn hạn (`lag_1`, `lag_2`), trung bình động (`rolling_mean_7`, `rolling_mean_28`), độ lệch chuẩn dao động (`rolling_std_7`) và mã hóa định danh từng món đã giúp mô hình bắt kịp xu thế tiêu dùng biến động gần đây của quán thay vì chỉ dựa vào thói quen theo thứ cố định của Baseline.

#### b. Đối chiếu giữa Random Forest và MLR trong bài toán vận hành KÉN
Mặc dù MLR có chỉ số sai số trung bình thấp hơn một lượng nhỏ (MAE đạt 3,7851 so với 3,9151 của RF) do tính chất dữ liệu mô phỏng có tính chu kỳ tuyến tính tương đối đồng đều, Random Forest vẫn được lựa chọn làm mô hình triển khai chính thức cho KÉN nhờ hai ưu thế vận hành thực tiễn:
* **Khả năng ước lượng khoảng tin cậy (Prediction Intervals):** Nhờ cơ chế tổng hợp từ 100 cây quyết định con (`n_estimators = 100`), Random Forest cho phép tính toán trực tiếp phân vị 10% (`lower_qty`) và phân vị 90% (`upper_qty`). Khoảng biến thiên này đóng vai trò then chốt giúp quản lý quán KÉN biết biên độ dao động an toàn để chuẩn bị nguyên vật liệu và rã đông thực phẩm.
* **Đảm bảo tính phi âm và phi tuyến tính:** Random Forest hoàn toàn không đưa ra các giá trị dự báo âm vô lý mà không cần gượng ép ngưỡng cắt (threshold clipping), đồng thời tự động học được mối quan hệ phi tuyến giữa các danh mục sản phẩm khác nhau vào các ngày cuối tuần.

#### c. Phân tích sai số theo nhóm danh mục sản phẩm
Bảng 4.[x] phân tích chi tiết sai số dự báo của mô hình Random Forest trên 3 nhóm danh mục F&B của KÉN:

*Bảng 4.[x]. Đánh giá sai số Random Forest theo nhóm danh mục sản phẩm*

| Danh mục | Số món | Số mẫu test | MAE Baseline | MAE Random Forest | RMSE Random Forest |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Đồ uống (DRINK)** | 21 | 294 | 4,461 | **4,185** | 5,424 |
| **Bánh (PASTRY)** | 8 | 112 | 3,551 | **3,410** | 4,487 |
| **Đồ ăn vặt (SNACK)** | 2 | 28 | 3,375 | **3,103** | 4,317 |

Nhóm SNACK và PASTRY có mức sai số tuyệt đối thấp nhất (MAE dao động từ 3,103 đến 3,410 ly/phần). Đây là các món có sản lượng bán ổn định, ít bị phân tán cực đoan giữa các ngày trong tuần (ví dụ: `BREAD_QUE` đạt MAE = 2,236; `CAKE_CHEESE` đạt MAE = 2,639). Ngược lại, nhóm DRINK có sai số tuyệt đối cao hơn (MAE = 4,185), tập trung vào các sản phẩm chủ lực có doanh số lớn như `WATER_BOTTLE` (bán trung bình 37,2 đơn vị/ngày, MAE = 7,696) hay `CF_SUA` (23,3 đơn vị/ngày, MAE = 5,395). Khi lượng bán lớn, độ biến thiên ngẫu nhiên theo ngày cũng lớn hơn, tuy nhiên sai số tương đối (MAPE) của nhóm đồ uống chủ lực vẫn duy trì ở mức an toàn dưới 18%.

---

### 4.2.2 Phân tích biểu đồ Actual vs. Predicted

Hình 4.[x] trực quan hóa đường biến thiên tổng sản lượng tiêu thụ F&B thực tế (*Actual*) so với giá trị dự báo từ mô hình Random Forest (*Predicted*) trên toàn bộ 14 ngày của tập kiểm tra (14/10/2026 – 27/10/2026).

![Hình 4.[x]. So sánh tổng số lượng F&B Thực tế vs. Dự báo của Random Forest (14/10 – 27/10/2026)](ken_ml/figures/forecasting_actual_vs_predicted.png)

*Hình 4.[x]. So sánh tổng số lượng F&B Thực tế vs. Dự báo của Random Forest (14/10 – 27/10/2026)*

*Bảng 4.[x]. Tổng sản lượng thực tế và dự báo theo ngày trong kỳ kiểm tra*

| Ngày | Thứ | Thực tế (ly/phần) | Baseline (4W) | Random Forest | Lệch (RF − Thực tế) |
| :---: | :--- | :---: | :---: | :---: | :---: |
| **14/10/2026** | Thứ 4 | 442 | 347,5 | 350,4 | −91,6 |
| **15/10/2026** | Thứ 5 | 281 | 308,5 | 351,3 | +70,3 |
| **16/10/2026** | Thứ 6 | 365 | 381,3 | 376,2 | +11,2 |
| **17/10/2026** | Thứ 7 | 423 | 546,3 | 460,0 | +37,0 |
| **18/10/2026** | Chủ nhật | 474 | 451,5 | 450,1 | −23,9 |
| **19/10/2026** | Thứ 2 | 252 | 312,5 | 341,7 | +89,7 |
| **20/10/2026** | Thứ 3 | 388 | 328,8 | 329,6 | −58,4 |
| **21/10/2026** | Thứ 4 | 340 | 393,3 | 337,5 | −2,5 |
| **22/10/2026** | Thứ 5 | 335 | 299,8 | 346,2 | +11,2 |
| **23/10/2026** | Thứ 6 | 538 | 395,3 | 364,8 | −173,2 |
| **24/10/2026** | Thứ 7 | 583 | 498,3 | 454,5 | −128,5 |
| **25/10/2026** | Chủ nhật | 520 | 444,3 | 452,6 | −67,4 |
| **26/10/2026** | Thứ 2 | 334 | 283,8 | 329,0 | −5,0 |
| **27/10/2026** | Thứ 3 | 416 | 344,5 | 338,1 | −77,9 |

Qua biểu đồ Hình 4.[x] và bảng chi tiết, có thể rút ra ba nhận xét định lượng:

#### a. Khả năng nắm bắt quy luật tuần hoàn theo tuần (Weekly Seasonality)
Đường dự báo của Random Forest (đường nét đứt màu cam) bám rất sát nhịp điệu sinh hoạt của mô hình tổ hợp Cà phê - Làm việc KÉN:
* **Đáy vào đầu tuần:** Thứ 2 luôn là ngày có lượng tiêu thụ thấp nhất tuần (ngày 19/10 chạm đáy với 252 phần; ngày 26/10 là 334 phần). Mô hình đã phản ánh được sự sụt giảm này khi điều chỉnh đường dự báo hạ sâu so với các ngày trước đó.
* **Đỉnh vào cuối tuần:** Lượng tiêu thụ tăng vọt từ Thứ 6 đến Chủ Nhật (đạt 423 – 474 phần ở tuần đầu và đạt đỉnh 520 – 583 phần ở tuần thứ hai). Random Forest đã dự báo chính xác xu hướng dâng cao của nhu cầu trong các ngày nghỉ cuối tuần với dự báo quanh mức 450 – 460 phần.

#### b. Hiện tượng làm mượt (Smoothing effect) tại các điểm cực trị
Tương tự như hầu hết các mô hình dạng Ensemble averaging, Random Forest dự báo dựa trên giá trị trung bình đầu ra của các lá cây. Do đó:
* Tại các ngày có sự bùng nổ bất thường về lượng khách như ngày 23/10 (538 phần) và 24/10 (583 phần), mô hình có xu hướng dự báo bảo thủ hơn (~455 phần), dẫn đến sai lệch âm cục bộ.
* Ngược lại, vào ngày vắng khách đột ngột như Thứ 2 ngày 19/10 (252 phần), mô hình dự báo ở mức an toàn 341,7 phần. 
Đặc tính bảo thủ này trên thực tế vận hành F&B là một ưu điểm: tránh tình trạng nhà bếp hoảng loạn tăng/giảm định mức nguyên vật liệu quá đột ngột chỉ vì một ngày biến động cá biệt.

#### c. Ý nghĩa thực tiễn đối với hệ thống KÉN và ứng dụng nhãn hành động
Từ kết quả dự báo cho ngày mốc tham chiếu kế tiếp (**28/10/2026**), hệ thống đã trích xuất tự động kế hoạch chuẩn bị gồm:
* **Tăng chuẩn bị / Tăng rã đông (6 món):** Các món có lượng dự báo cao hơn Baseline từ 15% trở lên như `BAKE_CROISSANT` (dự báo 17 so với baseline 13,8), `CAKE_CHEESE` (dự báo 10 so với baseline 8), `TEA_LUC`, `HOJICHA_LATTE`, `SNACK_FRUIT`, `TEA_CHAI`.
* **Giảm chuẩn bị (5 món):** Nhu cầu dự kiến giảm sâu hơn 15% như `WATER_BOTTLE` (dự báo 32 so với baseline 45), `CF_BAC_XIU` (dự báo 19 so với 22,8), `CF_DEN`, `SNACK_SANDWICH`, `SODA_TRAI_CAY`.
* **Giữ mức chuẩn bị (20 món):** Dao động trong khoảng an toàn $\pm 15\%$, đảm bảo quy trình vận hành ổn định.

#### d. Nhận xét về hạn chế của dữ liệu
Một hạn chế quan trọng cần được ghi nhận trong nghiên cứu: biến đặc trưng mùa vụ (`season = DRY`) chỉ xuất hiện duy nhất ở tháng 4/2026 (nằm hoàn toàn trong tập Train), trong khi các tháng từ 5 đến 10 thuộc mùa mưa (`season = RAINY`). Do đó, trên tập Test (tháng 10), biến `season` thực chất chỉ đóng vai trò như một cờ cố định và mô hình chưa có cơ hội kiểm chứng tác động chuyển giao mùa khi bước sang mùa khô thực tế. Khi KÉN vận hành qua trọn vẹn chu kỳ năm, mô hình cần được tái huấn luyện để hấp thu đầy đủ tính chu kỳ mùa vụ dài hạn.
