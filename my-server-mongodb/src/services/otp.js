'use strict';
// BR-A08: OTP lưu hash, có hạn, giới hạn số lần thử, đánh dấu đã dùng.
// Tên field và purpose khớp database/schemas/otp_codes.validator.json
//   purpose: REGISTER | 2FA_LOGIN | FORGOT_PASSWORD | CHANGE_PASSWORD | CHANGE_PHONE | TOGGLE_2FA
//   REGISTER: user_id = null và BẮT BUỘC có pending_data. Các purpose khác: BẮT BUỘC có user_id.
// Kênh gửi: nếu có email -> gửi qua email (do SMS tốn phí); nếu không có email -> in terminal SMS mock.
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');

const ttlSeconds = () => Number(process.env.OTP_TTL_SECONDS) || 300;
const maxAttempts = () => Number(process.env.OTP_MAX_ATTEMPTS) || 5;
const hashCode = (code) =>
  crypto
    .createHmac('sha256', process.env.SESSION_SECRET || 'dev-only-secret')
    .update(String(code))
    .digest('hex');

// SMS_PROVIDER=mock: chỉ in ra console khi KHÔNG phải production.
async function sendSms(phone, text) {
  if ((process.env.SMS_PROVIDER || 'mock') === 'mock') {
    if (process.env.NODE_ENV !== 'production') console.log(`[SMS mock] ${phone}: ${text}`);
    return;
  }
  throw new Error('SMS provider chưa được hỗ trợ');
}

let transporter = null;
function getEmailTransporter() {
  if (transporter) return transporter;
  const user = process.env.SMTP_USER ? process.env.SMTP_USER.trim() : null;
  const pass = process.env.SMTP_PASS ? process.env.SMTP_PASS.replace(/\s+/g, '') : null;
  if (!user || !pass) return null;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 465,
    secure: process.env.SMTP_SECURE === 'true' || (Number(process.env.SMTP_PORT) || 465) === 465,
    auth: { user, pass },
  });
  return transporter;
}

const PURPOSE_LABELS = {
  REGISTER: 'Xác thực đăng ký tài khoản',
  '2FA_LOGIN': 'Xác thực đăng nhập 2 bước (2FA)',
  FORGOT_PASSWORD: 'Khôi phục mật khẩu',
  CHANGE_PASSWORD: 'Xác nhận đổi mật khẩu',
  CHANGE_PHONE: 'Xác nhận đổi số điện thoại',
  TOGGLE_2FA: 'Xác nhận bật/tắt 2FA',
};

function renderEmailHtml({ code, purposeText, minutes }) {
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mã xác thực OTP - KÉN Coffee In Bed</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F7F3EE; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #3E2B1E; line-height: 1.6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #F7F3EE; padding: 40px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" style="max-width: 540px; background-color: #FFFFFF; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(62, 43, 30, 0.08); border: 1px solid #EBE1D4;" cellspacing="0" cellpadding="0" border="0">
          
          <!-- Top Accent Gradient Banner -->
          <tr>
            <td style="background: linear-gradient(90deg, #4A2E1B 0%, #7A4B29 50%, #D48B16 100%); height: 8px;"></td>
          </tr>

          <!-- Header with Logo -->
          <tr>
            <td align="center" style="padding: 36px 30px 20px 30px;">
              <img src="cid:ken_logo" alt="KÉN — Coffee In Bed" width="115" height="115" style="display: block; border-radius: 50%; box-shadow: 0 6px 18px rgba(62, 43, 30, 0.15); margin-bottom: 18px; border: 3px solid #F5EDE0;" />
              <h1 style="margin: 0; font-size: 23px; font-weight: 800; letter-spacing: 2px; color: #3E2B1E; text-transform: uppercase;">KÉN — Coffee In Bed</h1>
              <p style="margin: 6px 0 0 0; font-size: 13px; color: #A67336; font-style: italic; letter-spacing: 1px; font-weight: 500;">"Lười một chút, chill một góc"</p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 36px;">
              <div style="border-bottom: 1px solid #F0E6D8;"></div>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 28px 36px 20px 36px;">
              <!-- Purpose Badge -->
              <div style="text-align: center; margin-bottom: 22px;">
                <span style="display: inline-block; background-color: #FDF4E7; color: #B36800; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; padding: 7px 18px; border-radius: 30px; border: 1px solid #F7DFC0;">
                  ${purposeText}
                </span>
              </div>

              <p style="margin: 0 0 14px 0; font-size: 15px; color: #4A3A2C;">
                Xin chào Quý khách,
              </p>
              <p style="margin: 0 0 24px 0; font-size: 14px; color: #665444; line-height: 1.6;">
                Hệ thống nhận được yêu cầu <strong>${purposeText.toLowerCase()}</strong> cho tài khoản của bạn tại <strong>KÉN</strong>. Vui lòng sử dụng mã xác thực bảo mật bên dưới để hoàn tất thao tác:
              </p>

              <!-- OTP Highlight Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: linear-gradient(145deg, #FDFBF8 0%, #F5ECE0 100%); border: 2px dashed #DCB685; border-radius: 16px; margin: 0 0 24px 0;">
                <tr>
                  <td align="center" style="padding: 24px 20px;">
                    <div style="font-size: 11px; font-weight: 700; letter-spacing: 2.5px; color: #9A7B62; text-transform: uppercase; margin-bottom: 8px;">
                      MÃ XÁC THỰC (OTP)
                    </div>
                    <div style="font-size: 40px; font-weight: 800; letter-spacing: 12px; color: #3E2B1E; font-family: 'SF Pro Display', -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; text-indent: 12px; margin: 6px 0;">
                      ${code}
                    </div>
                    <div style="font-size: 12px; color: #8A6D56; margin-top: 8px;">
                      ⏱ Hiệu lực trong vòng <strong>${minutes} phút</strong> · Tối đa 5 lần nhập
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Warning Callout Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #FDF8F2; border-left: 4px solid #D48B16; border-radius: 6px; padding: 14px 16px; margin-bottom: 10px;">
                <tr>
                  <td style="font-size: 13px; color: #735338; line-height: 1.5;">
                    <strong style="color: #42281D;">Lưu ý bảo mật:</strong> Tuyệt đối không chia sẻ mã này cho bất kỳ ai, bao gồm cả nhân viên KÉN. Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email hoặc đổi mật khẩu ngay để bảo vệ tài khoản.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #FBF8F4; padding: 24px 36px; text-align: center; border-top: 1px solid #EFE6DC;">
              <p style="margin: 0 0 6px 0; font-size: 11px; font-weight: 700; letter-spacing: 2px; color: #8C6D53; text-transform: uppercase;">
                KẾT NỐI · TẬP TRUNG · TÁI TẠO
              </p>
              <p style="margin: 0 0 6px 0; font-size: 12px; color: #9C8370;">
                KÉN — Không gian làm việc, kết nối &amp; thư giãn chuyên sâu
              </p>
              <p style="margin: 0; font-size: 11px; color: #BAA696;">
                © 2026 KÉN — Coffee In Bed. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendEmail(email, { code, purpose }) {
  const t = getEmailTransporter();
  const purposeText = PURPOSE_LABELS[purpose] || 'Xác thực tài khoản';
  const minutes = Math.floor(ttlSeconds() / 60);

  if (!t) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[EMAIL mock] ${email}: Ma OTP KEN cua ban: ${code}. Het han sau ${minutes} phut. (${purposeText})`);
    }
    return;
  }

  const logoPath = path.join(__dirname, '../../public/images/ken-logo.png');
  const attachments = [];
  if (fs.existsSync(logoPath)) {
    attachments.push({
      filename: 'ken-logo.png',
      path: logoPath,
      cid: 'ken_logo',
    });
  }

  try {
    await t.sendMail({
      from: `"KÉN — Coffee In Bed" <${process.env.SMTP_USER}>`,
      to: email,
      subject: `[KÉN] Mã OTP: ${code} - ${purposeText}`,
      html: renderEmailHtml({ code, purposeText, minutes }),
      text: `Mã OTP KÉN của bạn: ${code}. Dùng cho: ${purposeText}. Hết hạn sau ${minutes} phút.`,
      attachments,
    });
    console.log(`[EMAIL] Đã gửi mã OTP thành công tới ${email}`);
  } catch (err) {
    console.error(`[EMAIL ERROR] Không thể gửi tới ${email}:`, err.message);
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[EMAIL Fallback mock] ${email}: Ma OTP KEN cua ban: ${code}`);
    }
  }
}

// userId: null khi purpose = REGISTER (kèm pendingData); các purpose khác phải có userId.
// Kênh gửi (Delivery Channel):
// - Nếu có email: gửi qua Email thật (hoặc in log mock email nếu chưa cấu hình SMTP).
// - Nếu không có email: gửi qua SMS mock in ra terminal.
async function issueOtp(db, { userId = null, purpose, phone, email = null, pendingData }) {
  const col = db.collection('otp_codes');
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  const now = new Date();
  // vô hiệu mã cũ cùng số điện thoại + mục đích (khớp index idx_otp_phone_purpose_used)
  await col.updateMany({ phone, purpose, is_used: false }, { $set: { is_used: true } });
  const doc = {
    user_id: userId,
    phone,
    purpose,
    code_hash: hashCode(code),
    expires_at: new Date(now.getTime() + ttlSeconds() * 1000),
    attempt_count: 0,
    max_attempts: maxAttempts(),
    is_used: false,
    created_at: now,
  };
  if (pendingData) doc.pending_data = pendingData;
  await col.insertOne(doc);

  if (email && String(email).trim()) {
    await sendEmail(String(email).trim(), { code, purpose });
  } else {
    await sendSms(
      phone,
      `Ma OTP KEN cua ban: ${code}. Het han sau ${Math.floor(ttlSeconds() / 60)} phut.`,
    );
  }
}

// Trả về { status: 'OK' | 'INVALID' | 'EXPIRED' | 'TOO_MANY', otp }
// otp (khi OK) chứa user_id / pending_data để route dùng tiếp.
async function verifyOtp(db, { phone, purpose, code }) {
  const col = db.collection('otp_codes');
  if (typeof code !== 'string' || !/^\d{6}$/.test(code)) return { status: 'INVALID' };
  const otp = await col.findOne({ phone, purpose, is_used: false }, { sort: { created_at: -1 } });
  if (!otp) return { status: 'INVALID' };
  if (otp.expires_at <= new Date()) return { status: 'EXPIRED' };
  const bump = await col.updateOne(
    { _id: otp._id, is_used: false, attempt_count: { $lt: otp.max_attempts } },
    { $inc: { attempt_count: 1 } },
  );
  if (bump.matchedCount === 0) return { status: 'TOO_MANY' };
  const a = Buffer.from(otp.code_hash, 'hex');
  const b = Buffer.from(hashCode(code), 'hex');
  if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
    const done = await col.updateOne({ _id: otp._id, is_used: false }, { $set: { is_used: true } });
    return done.matchedCount === 1 ? { status: 'OK', otp } : { status: 'INVALID' };
  }
  return { status: otp.attempt_count + 1 >= otp.max_attempts ? 'TOO_MANY' : 'INVALID' };
}

module.exports = { issueOtp, verifyOtp };
