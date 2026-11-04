# Câu hỏi mở / còn tồn

Ba câu nghiệp vụ trước đây (BR-F01, BR-C04, hủy `PENDING_PAYMENT` quá hạn) đã chốt, xem `decisions.md`.

- Session store chạy nhiều instance: `connect-mongo` đã dùng chung được, nhưng rate limit vẫn nằm trong RAM của từng instance (dùng Redis hoặc `express-rate-limit` khi deploy nhiều instance).
- Cron chuyển `PENDING_PAYMENT` quá hạn sang `EXPIRED` chưa có trong code (chỉ có luật trong state machine).
- Giá trị tạm trong báo cáo: Cut-off hủy (BR-G01, 2 giờ), đặt trước tối thiểu (BR-C06, 30 phút). Xem `src/config/constants.js`.
