# 3.7 Thiết lập Bài toán 2 (Dự báo nhu cầu - Demand Forecasting)

Nếu Bài toán 1 và Bài toán 3 tập trung vào hành vi phía người dùng (gợi ý món xu hướng cho trang chủ và phân khúc khách hàng thành viên), thì Bài toán 2 giải quyết trực tiếp bài toán vận hành hậu cần (back-office operations) của mô hình tổ hợp Cà phê - Không gian làm việc KÉN. Mục tiêu trọng tâm của bài toán là dự báo chính xác số lượng bán ra của từng món F&B (gồm 31 món: 21 đồ uống, 8 loại bánh và 2 món đồ ăn vặt) vào ngày kế tiếp ($T + 1$). Kết quả dự báo này đóng vai trò căn cứ định lượng để ban quản lý và bộ phận bếp chủ động chuẩn bị mẻ ủ cà phê/trà, rã đông bánh theo định mức hợp lý, hạn chế tối đa tình trạng thiếu hụt hàng (stockout) trong các khung giờ cao điểm cũng như giảm thiểu tỷ lệ hủy lãng phí (waste rate) đối với các loại bánh tươi có thời hạn sử dụng ngắn.

Trong kiến trúc mã nguồn của hệ sinh thái học máy KÉN, toàn bộ quy trình tiền xử lý, trích xuất đặc trưng chuỗi thời gian và xây dựng tài liệu dự báo được đóng gói tập trung tại module dùng chung `src/forecast_common.py`, phục vụ hai kịch bản độc lập:

* **`src/train/02_Forecasting_train.py`:** Đọc tệp `master_ken_data.csv`, tái cấu trúc chuỗi thời gian liên tục 210 ngày $\times$ 31 món, trích xuất 48 biến đặc trưng (trễ lag, thống kê trượt, lịch, định danh món), huấn luyện các mô hình trên tập Train (01/04 – 13/10/2026), kiểm định sai số trên tập Test (14/10 – 27/10/2026), xuất các báo cáo đối chứng và biểu đồ vào `outputs/`, cuối cùng lưu gói mô hình tối ưu vào `models/rf_forecast.joblib` (tuyệt đối không kết nối và không ghi vào cơ sở dữ liệu MongoDB).
* **`src/run/02_Forecasting_run.py`:** Nạp gói mô hình `models/rf_forecast.joblib`, trích xuất dữ liệu lịch sử để khởi tạo vector đặc trưng cho ngày tham chiếu kế tiếp (`forecast_date = 28/10/2026`), thực hiện suy diễn số lượng kỳ vọng (`predicted_qty`) cùng khoảng tin cậy (`lower_qty`, `upper_qty`), xuất bảng kế hoạch chi tiết ra `outputs/` và thực hiện ghi an toàn có kiểm soát vào collection `demand_forecasts` của MongoDB thông qua thư viện `src/safe_write.py`.

---

### 3.7.1 Tái cấu trúc dữ liệu và Mã hóa ngữ cảnh

#### a. Quy tắc chọn lọc dòng và Resampling chuỗi thời gian
Khác biệt căn bản với Bài toán 1 (loại bỏ dòng quyền lợi miễn phí) và Bài toán 3 (loại bỏ cả khách vãng lai lẫn dòng quyền lợi), Bài toán 2 giữ lại toàn bộ 67.375 dòng giao dịch trong tệp `master_ken_data.csv`, bao gồm cả 39.068 dòng khách vãng lai (`is_walk_in == 1`, chiếm 58% dữ liệu) và 13.679 dòng quyền lợi đi kèm gói (`is_inclusion == 1`, ví dụ món nước tinh khiết `WATER_BOTTLE`). Lý do thiết kế này xuất phát từ bản chất vận hành thực tế: dù khách hàng mua trực tiếp tại quầy hay dùng nước tặng kèm trong gói đặt chỗ, nhà bếp và quầy bar vẫn phải tiêu tốn nguyên vật liệu và chuẩn bị đủ số lượng thực phẩm phục vụ. Dữ liệu này khớp hoàn toàn với bảng tổng hợp doanh số thực tế `sales_history_daily` của hệ thống KÉN.

Để chuyển đổi dữ liệu giao dịch sự kiện (transaction-level) sang dạng chuỗi thời gian giám sát đều đặn (regular daily time series), hàm `build_daily_grid()` thực hiện hai bước kỹ thuật:
1. **Gom nhóm và tổng hợp (Aggregation):** Tính tổng sản lượng bán ra theo từng cặp `(sale_date, item_code)`.
2. **Tái tạo lưới thời gian toàn vẹn (Full Grid Reindexing):** Tạo một MultiIndex tích Descartes giữa 210 ngày liên tục (từ ngày 01/04/2026 đến ngày 27/10/2026) và toàn bộ 31 mã món (`item_code`), thu được chính xác 6.510 điểm dữ liệu. Đối với 7 cặp (ngày, món) không phát sinh đơn hàng trong thực tế, hàm tự động điền giá trị 0 (`fillna(0)`). Việc lấp đầy lưới tọa độ này là điều kiện tiên quyết để chuỗi thời gian không bị đứt gãy, đảm bảo các hàm trễ (shift) và cửa sổ trượt (rolling window) tính toán chính xác tuyệt đối.

Mốc tham chiếu của bài toán được xác định tự động từ dữ liệu: $\text{reference\_date} = \max(\text{sale\_date}) + 1\text{ ngày} = 28/10/2026$, đóng vai trò là ngày dự báo (`forecast_date`) trong kịch bản chạy thực tế.

#### b. Kỹ thuật trích xuất đặc trưng chuỗi thời gian (Feature Engineering)
Nếu chỉ huấn luyện mô hình dựa trên các đặc trưng ngày trong tuần, các thuật toán học máy chỉ học được giá trị trung bình theo thứ và không thể vượt qua mốc cơ sở Baseline. Do đó, hàm `compute_historical_features()` trong `src/forecast_common.py` đã xây dựng một bộ đặc trưng chuỗi thời gian sâu, tính toán độc lập trên chuỗi số lượng của từng món (nhóm theo `item_code`) và luôn áp dụng độ trễ `shift(1)` để triệt tiêu hoàn toàn hiện tượng rò rỉ thông tin tương lai:
* **Các biến trễ trực tiếp (Lag Features):** Gồm các mốc `lag_1`, `lag_2` (phản ánh xung lực tiêu thụ ngắn hạn của 1–2 ngày vừa qua); `lag_7`, `lag_14`, `lag_21`, `lag_28` (phản ánh tính chu kỳ cùng thứ của 1, 2, 3 và 4 tuần trước đó).
* **Các biến thống kê trượt (Rolling Window Statistics):** Gồm `rolling_mean_7`, `rolling_mean_14`, `rolling_mean_28` lần lượt là trung bình động của 7, 14 và 28 ngày gần nhất trên chuỗi `shift(1)`, phản ánh xu hướng trung hạn của món; kèm theo biến `rolling_std_7` đo lường độ biến động (volatility) của nhu cầu trong tuần gần nhất.
* **Biến ước lượng cơ sở (Baseline 4W):** Tính toán trung bình lượng bán của 4 ngày cùng thứ trong 4 tuần trước đó:
$$\text{baseline\_4w} = \frac{\text{lag\_7} + \text{lag\_14} + \text{lag\_21} + \text{lag\_28}}{4}$$

#### c. Mã hóa ngữ cảnh lịch và sản phẩm (Contextual Encoding)
Bên cạnh đặc trưng lịch sử bán hàng, hàm `prepare_encoded_dataset()` bổ sung các biến ngữ cảnh vận hành:
* **Đặc trưng thời gian:** Biến `day_of_week` nhận giá trị từ 0 (Thứ 2) đến 6 (Chủ nhật); biến nhị phân `is_weekend` nhận giá trị 1 nếu là Thứ 7 hoặc Chủ nhật (phản ánh lượng khách tăng vọt tại KÉN vào cuối tuần).
* **Đặc trưng mùa vụ:** Biến `season` nhận giá trị `DRY` đối với tháng 4 và `RAINY` đối với các tháng từ 5 đến 10 (theo quy chuẩn khí hậu TP.HCM trong tài liệu KÉN).
* **Kỹ thuật mã hóa biến định danh:** Áp dụng phương pháp One-Hot Encoding thông qua hàm `pd.get_dummies()` cho các biến `day_of_week`, `season` và `item_code` với tham số `drop_first=True`. Việc loại bỏ cột đầu tiên của mỗi nhóm mã hóa giúp ngăn ngừa hiện tượng đa cộng tuyến hoàn hảo (multicollinearity), bảo đảm tính khả định cho mô hình hồi quy tuyến tính MLR đồng thời tối ưu hóa tốc độ phân tách nhánh của cây quyết định.

Tổng cộng, không gian đặc trưng đầu vào sau khi xử lý hoàn chỉnh gồm 48 biến độc lập (Bảng 3.[x]).

*Bảng 3.[x]. Bảng tổng hợp không gian đặc trưng đầu vào của Bài toán 2 (src/forecast_common.py)*

| Nhóm đặc trưng | Tên biến trong mã nguồn | Kiểu dữ liệu | Ý nghĩa và vai trò trong mô hình |
| :--- | :--- | :---: | :--- |
| **Biến trễ lịch sử (Lag)** | `lag_1, lag_2, lag_7, lag_14, lag_21, lag_28` | float | Sản lượng bán của ngày hôm qua, hôm kia và các ngày cùng thứ của 1–4 tuần trước (shift 1..28 ngày). |
| **Thống kê trượt (Rolling Stats)** | `rolling_mean_7, rolling_mean_14, rolling_mean_28, rolling_std_7` | float | Trung bình động 7, 14, 28 ngày và độ lệch chuẩn 7 ngày gần nhất, thể hiện xu thế và mức độ biến động ngắn hạn. |
| **Mốc cơ sở tuần hoàn (Baseline)** | `baseline_4w` | float | Trung bình cộng của lag 7, 14, 21, 28 (trung bình 4 tuần cùng thứ), làm biến định hướng cho mô hình. |
| **Lịch và Mùa vụ (Calendar/Season)** | `day_of_week_1..6, season_RAINY, is_weekend` | int (0/1) | Mã hóa One-Hot thứ trong tuần (gốc là Thứ 2), cờ mùa mưa (gốc là DRY) và chỉ thị cuối tuần. |
| **Định danh sản phẩm (Item ID)** | `item_code_BAKE_CROISSANT, item_code_CF_SUA, ...` | int (0/1) | 30 biến giả One-Hot phân biệt 31 món F&B riêng biệt (gốc là món đầu tiên theo thứ tự từ điển). |

---

### 3.7.2 Cấu hình Mô hình và Baseline

#### a. Thiết lập mốc đối chứng (Baseline) và Mô hình tuyến tính chuẩn tắc (MLR)
Để đánh giá khách quan giá trị gia tăng của các thuật toán học máy phức tạp, nhóm thiết lập hai mô hình mốc so sánh:
1. **Mô hình Heuristic Baseline (Trung bình 4 tuần cùng thứ):** Dựa trên kinh nghiệm quản lý truyền thống của ngành F&B, số lượng khách đến quán vào một ngày trong tuần (ví dụ: Thứ 4) có xu hướng lặp lại thói quen của các ngày Thứ 4 gần đó. Công thức Baseline dự báo sản lượng món $i$ vào ngày $t$ bằng trung bình số lượng bán của 4 ngày cùng thứ trước đó:
$$\hat{y}_{\text{base}}(i, t) = \frac{1}{4} \left[ q(i, t-7) + q(i, t-14) + q(i, t-21) + q(i, t-28) \right]$$
2. **Mô hình Multiple Linear Regression (MLR):** Áp dụng phương pháp bình phương bé nhất thông thường (OLS) trên toàn bộ 48 biến đặc trưng, đóng vai trò là mốc chuẩn mực đại diện cho lớp mô hình tuyến tính tham số.

#### b. Cấu hình thuật toán Random Forest Regressor
Thuật toán Random Forest Regressor (Breiman, 2001) được lựa chọn làm giải pháp trọng tâm cho Bài toán 2 nhờ các ưu điểm cấu trúc:
* **Năng lực bắt phi tuyến:** Nhu cầu tiêu thụ F&B chịu tác động đan xen phi tuyến giữa từng loại món (ví dụ: món bánh bán chạy vào giờ xế chiều, cà phê bán mạnh vào buổi sáng) và loại ngày (ngày thường hay cuối tuần). Các cây quyết định có khả năng phân đoạn tự nhiên không gian dữ liệu mà không cần định nghĩa thủ công các biến tương tác (interaction terms).
* **Tính vững chắc và kháng ngoại lai (Robustness):** Bằng cơ chế lấy mẫu lặp lại kèm hoàn lại (Bootstrap aggregating - Bagging) và lấy mẫu ngẫu nhiên tập con đặc trưng tại mỗi điểm phân nhánh, Random Forest giảm thiểu phương sai (variance), triệt tiêu nguy cơ quá khớp (overfitting) và ít bị ảnh hưởng bởi những ngày có lượng khách đột biến.

Cấu hình siêu tham số của mô hình trong `src/train/02_Forecasting_train.py` được thiết lập tối ưu như sau:
* `n_estimators = 100`: Sử dụng 100 cây quyết định con để đảm bảo độ mượt và hội tụ của phân phối dự báo.
* `max_depth = 12`: Giới hạn độ sâu tối đa của cây để ngăn chặn hiện tượng học vẹt các mẫu nhiễu cục bộ.
* `min_samples_leaf = 2`: Yêu cầu mỗi nút lá phải chứa ít nhất 2 mẫu quan sát nhằm đảm bảo tính tổng quát hóa.
* `random_state = 42 (SEED)`: Đảm bảo tính nhất quán và khả năng tái lập 100% của kết quả thực nghiệm.
* `n_jobs = -1`: Kích hoạt toàn bộ nhân CPU để tăng tốc độ huấn luyện.

#### c. Phân chia tập dữ liệu theo trục thời gian (Time-series Split)
Do tính chất tự tương quan (autocorrelation) của chuỗi thời gian, việc sử dụng các phương pháp lấy mẫu ngẫu nhiên (K-Fold cross-validation truyền thống) sẽ vi phạm nguyên lý nhân quả và gây rò rỉ dữ liệu nghiêm trọng. Vì vậy, tập dữ liệu được phân chia dứt khoát theo trục thời gian:
* **Tập huấn luyện (Train set):** Từ ngày 01/04/2026 đến ngày 13/10/2026. Do cần 28 ngày đầu tiên làm cửa sổ warm-up để khởi tạo đặc trưng trễ `lag_28`, tập mẫu huấn luyện hợp lệ bắt đầu từ ngày 29/04/2026 đến 13/10/2026, bao gồm 168 ngày $\times$ 31 món = 5.208 mẫu dữ liệu.
* **Tập kiểm định (Test set):** Gồm 14 ngày cuối cùng của chuỗi thời gian (từ 14/10/2026 đến 27/10/2026), tương đương 14 ngày $\times$ 31 món = 434 mẫu kiểm định. Tập này được giữ nguyên vẹn để đo lường độc lập sai số MAE và RMSE của các mô hình.

#### d. Cơ chế ước lượng khoảng tin cậy (Prediction Intervals) và Nhãn hành động (Action Tags)
Nhằm hỗ trợ tốt nhất cho công tác lập kế hoạch nhà bếp, mô hình không chỉ đưa ra một giá trị dự báo điểm (point forecast) mà còn cung cấp khoảng tin cậy trực tiếp dựa trên phân phối dự báo của 100 cây con trong rừng ngẫu nhiên:
* `lower_qty`: Điểm phân vị thứ 10 (10th percentile) của 100 giá trị dự báo từ các cây con, thể hiện cận dưới an toàn của nhu cầu.
* `upper_qty`: Điểm phân vị thứ 90 (90th percentile) của 100 giá trị dự báo, thể hiện cận trên nhu cầu trong trường hợp lượng khách tăng cao.
* `predicted_qty`: Dự báo điểm chính thức từ giá trị trung bình của toàn bộ ensemble, làm tròn về số nguyên không âm: $\text{predicted\_qty} = \text{round}(\max(0, \hat{y}))$.

Hàm `compute_action_tags()` tự động so sánh dự báo điểm với mốc Baseline 4 tuần gần nhất để đề xuất nhãn hành động cho quản lý quán:
* **"Tăng chuẩn bị":** Khi dự báo tăng từ 15% trở lên so với Baseline ($(\text{predicted\_qty} - \text{baseline}) / \text{baseline} \ge +0.15$), cảnh báo rã đông thêm bánh hoặc ủ thêm cốt trà/cà phê.
* **"Giảm chuẩn bị":** Khi dự báo giảm từ 15% trở lên so với Baseline ($(\text{predicted\_qty} - \text{baseline}) / \text{baseline} \le -0.15$), chủ động giảm lượng sơ chế để chống hư hỏng.
* **"Giữ mức chuẩn bị":** Khi biến động nằm trong ngưỡng dung sai an toàn $\pm 15\%$.

---

### 3.7.3 Ranh giới lưu trữ và Phân luồng tính toán

#### a. Ranh giới kiến trúc giữa Học máy (ML) và Hệ thống Backend KÉN
Nhằm đảm bảo nguyên tắc phân tách trách nhiệm (Separation of Concerns) trong kiến trúc phần mềm:
* **Trách nhiệm của Mô-đun Học máy:** Dừng lại ở cấp độ dự báo sản lượng tiêu thụ của từng mã sản phẩm F&B (ly nước hoặc phần bánh cụ thể). Mã nguồn ML không can thiệp vào bài toán tính định mức nguyên vật liệu thô (gram hạt cà phê, ml sữa đặc, túi trà...). Việc nhân sản lượng dự báo với định lượng công thức trong collection `recipes` và cảnh báo tồn kho nguyên liệu do Backend Node.js của hệ thống KÉN đảm nhận thông qua `forecastService.js`.
* **Ranh giới về dữ liệu lưu trữ:** Trường nhãn hành động `action_tag` được cố tình loại bỏ khỏi tài liệu ghi vào MongoDB. Collection `demand_forecasts` áp dụng JSON Schema validator rất khắt khe với cờ `additionalProperties = false`, chỉ chấp nhận đúng 8 trường dữ liệu kỹ thuật. Trường `action_tag` chỉ xuất hiện trong tệp kết quả CSV và giao diện người dùng (do Frontend/Backend tự động suy diễn từ `predicted_qty` và baseline), hoàn toàn tuân thủ thiết kế cơ sở dữ liệu gốc.

#### b. Cấu trúc lưu trữ collection demand_forecasts và gói mô hình .joblib
Kịch bản `02_Forecasting_run.py` chuẩn bị danh sách 31 tài liệu đại diện cho 31 món F&B dự báo cho ngày 28/10/2026. Định dạng tài liệu và cấu trúc gói mô hình `models/rf_forecast.joblib` được chuẩn hóa chi tiết tại Bảng 3.[x].

*Bảng 3.[x]. Cấu trúc Document của demand_forecasts và cấu trúc gói rf_forecast.joblib*

| Thành phần lưu trữ | Tên trường / Khóa (Key) | Kiểu dữ liệu | Ý nghĩa và vai trò trong hệ thống |
| :--- | :--- | :---: | :--- |
| **Collection `demand_forecasts`**<br><br>*(Ghi qua `safe_write.upsert_forecasts`)* | `item_id` | ObjectId | Mã định danh BSON của sản phẩm, liên kết với `_id` trong collection `products`. |
| | `item_code` | str | Mã rút gọn duy nhất của món (ví dụ: `CF_SUA`, `BAKE_CROISSANT`). |
| | `forecast_date` | datetime (UTC) | Ngày áp dụng dự báo (00:00:00 UTC ngày 28/10/2026). |
| | `predicted_qty` | int ($\ge 0$) | Số lượng sản phẩm dự báo bán ra trong ngày. |
| | `lower_qty, upper_qty` | int ($\ge 0$) | Cận dưới (phân vị 10%) và cận trên (phân vị 90%) của khoảng tin cậy. |
| | `model_version, generated_at` | str, datetime | Phiên bản mô hình (`rf_v1`) và dấu thời gian hệ thống tạo dự báo. |
| **Tệp gói mô hình `models/rf_forecast.joblib`**<br><br>*(Lưu qua `joblib.dump`)* | `model, eval_model, mlr_model` | Estimator | Mô hình Random Forest hoàn chỉnh (huấn luyện trên toàn bộ dữ liệu), mô hình đánh giá trên tập Train, và mô hình MLR đối chứng. |
| | `feature_cols` | list[str] | Danh sách đầy đủ 48 tên cột đặc trưng phục vụ tái tạo vector đầu vào. |
| | `metrics, item_metadata` | dict, dict | Từ điển lưu trữ sai số MAE/RMSE trên tập test và siêu dữ liệu 31 món F&B. |

#### c. Quy trình ghi an toàn và Kịch bản kiểm thử nghiệm thu (tests/test_task2.py)
Nhằm bảo vệ dữ liệu sản xuất của KÉN trước các sự cố rò rỉ hoặc ghi đè sai quy cách, quy trình cập nhật cơ sở dữ liệu tuân thủ tuyệt đối các nguyên tắc an toàn tại `src/safe_write.py`:
* **Phương thức ghi lũy tiến (Upsert):** Hàm `upsert_forecasts(db, docs, write=args.write)` thực hiện cập nhật có điều kiện dựa trên khóa phức hợp `(item_code, forecast_date, model_version)`. Nếu bản ghi đã tồn tại, hệ thống thực hiện cập nhật giá trị mới (`$set`); nếu chưa có, tài liệu sẽ được thêm mới. Nhờ đó, việc chạy lại kịch bản nhiều lần không bao giờ gây ra lỗi trùng lặp khóa (duplicate key error) hay tràn dữ liệu.
* **Cơ chế chạy thử (Dry-run) mặc định:** Khi chạy lệnh thông thường (`python src/run/02_Forecasting_run.py`), script hoạt động ở chế độ chạy thử, chỉ in bản ghi xem trước và xuất file CSV kết quả mà không tác động tới MongoDB. Chỉ khi người vận hành chỉ định cờ `--write`, lệnh ghi thật mới được kích hoạt.
* **Bộ kiểm thử tự động nghiêm ngặt (`tests/test_task2.py`):** Trước khi thực thi ghi thật, quy trình bắt buộc phải chạy kịch bản kiểm thử độc lập `tests/test_task2.py` (hoàn toàn không chạm vào database). Kịch bản thực hiện 26 bài kiểm tra tự động bao quát tính toàn vẹn của mô hình, tính hợp lệ của vector đặc trưng, tính logic của khoảng tin cậy (`lower_qty <= predicted_qty <= upper_qty`) và sự phù hợp 100% của cấu trúc tài liệu với validator MongoDB. Toàn bộ 26/26 bài kiểm thử đều đạt kết quả PASS trước khi hệ thống kích hoạt lệnh ghi cơ sở dữ liệu.
