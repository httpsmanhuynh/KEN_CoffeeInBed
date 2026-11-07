#!/usr/bin/env bash
# Tải icon từ Figma (node 465:17602) về public/images/figma/.
# URL do Figma MCP cấp, hết hạn sau 7 ngày -> nếu lỗi, nhờ Claude lấy lại URL mới.
set -euo pipefail
cd "$(dirname "$0")/../public/images/figma"
B="https://www.figma.com/api/mcp/asset"
dl() { curl -fsSL -o "$1" "$B/$2" && echo "ok  $1"; }
dl nguoi-dung.svg      8609604c-fc6e-4ec3-8ec2-3703632886ac.svg   # avatar header (14.72px)
dl menu-tai-khoan.svg  f71adf57-032f-432a-9126-0fbc031b4425.svg   # mũi tên mở menu (16px)
dl nguoi-dung-lg.svg   08a0fa62-8bb2-4633-bfca-076d0c2d876f.svg   # avatar sidebar (23.92px)
dl sparkles.svg        d2dc894f-ab46-460c-9ca6-b8d9fd1abb1b.svg   # KÉN Điểm
dl coins.svg           739bf061-6857-4194-a961-35bb7e86458a.svg   # KÉN Coins
dl lich-dat-cho.svg    0f113510-49e1-4375-b998-5517549d01c1.svg   # Lịch sử đặt chỗ
dl calendar-clock.svg  e5b881ef-12cc-493d-842e-653ae6903442.svg   # Đổi / Huỷ lịch
dl user-round.svg      2900ec7f-392a-479f-be5c-cab22f528b27.svg   # Tài khoản
dl dang-xuat.svg       0147ce04-84f6-4270-b740-571c760f5754.svg   # Đăng xuất
dl selectarrow.svg     50c1db45-c276-4428-a320-8a3bb9d7af3b.svg   # select
dl calendar-date.svg   b354e66d-cfc3-4fc5-b01f-756a95d89756.svg   # ô ngày
dl filter.svg          c891340a-c71c-425c-a7c2-393b6c63c383.svg   # nút Lọc
dl info.svg            28a38f6b-2aac-4ce2-8eca-0dbb406e59c1.svg   # hộp lưu ý
dl table.svg           e7e7896e-1bbb-40af-87ea-238acec44534.svg   # cột MÃ BOOKING
dl clock-history.svg   3ef5b0ea-325f-498a-891f-3482a465d93e.svg   # cột NGÀY GIỜ
dl eye.svg             1624953b-812a-49d6-b49b-2295731bed4b.svg   # cột XEM (thanh icon bên phải)
dl message-circle.svg  9e3dc743-d4b5-48df-8003-f6e22993b93a.svg   # thẻ "Cần KÉN kiểm tra giúp?"
dl bao-ve-mat-khau.svg      91fc1898-d810-441a-ae00-14770f5b6a7e.svg
dl hien-mat-khau.svg        2a0e7a4e-cefb-448c-a5dc-11ebc1f1788c.svg
dl hien-mat-khau-active.svg e2c69d84-7b39-4bc2-a441-8a7882fe29f0.svg
dl dang-nhap-otp.svg        33ef7a40-e446-432e-b8c1-39515fcc8d3c.svg
dl check-tip.svg            c1a06e05-0448-4de7-9f49-d8bc3bc800ff.svg
dl session-clock-icon.svg   7dc75a0c-ad6a-4b70-9774-44d4745e38d7.svg
dl monitor.svg              6936f6cd-d1d6-44b7-a5b0-58d916fe18c9.svg
dl smartphone.svg           b74d3b03-785a-43f3-a89c-e5dede25e0c8.svg
dl footer-logo.png          e800996f-5ef5-489b-b743-46a62b963723.png
echo "Xong. Kiểm tra: ls -la public/images/figma"
