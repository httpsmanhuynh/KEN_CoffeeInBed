'use strict';
// BR-A01, BR-A04, BR-A05. Session do express-session tạo; đăng nhập gán req.session.user = { id, role }.
function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) return res.status(401).json({ code: 'UNAUTHENTICATED', message: 'Vui lòng đăng nhập' });
  next();
}
function requireRole(role) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) return res.status(401).json({ code: 'UNAUTHENTICATED', message: 'Vui lòng đăng nhập' });
    if (req.session.user.role !== role) return res.status(403).json({ code: 'FORBIDDEN', message: 'Không có quyền' });
    next();
  };
}

// Mốc đổi mật khẩu (ms) lưu trong session; khác giá trị trong DB => session đã bị thu hồi (BR-A05).
const pwdStamp = (user) => (user.password_changed_at ? new Date(user.password_changed_at).getTime() : 0);

// Gọi SAU KHI xác thực xong hoàn toàn (mật khẩu + OTP nếu 2FA). Tạo session ID mới (chống session fixation)
// nhưng giữ ngữ cảnh đặt chỗ của Auth Guard.
function startSession(req, user) {
  const pendingBooking = req.session.pendingBooking;
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      req.session.user = { id: String(user._id ?? user.id), role: user.role, pwdAt: pwdStamp(user) };
      if (pendingBooking) req.session.pendingBooking = pendingBooking;
      req.session.save((e) => (e ? reject(e) : resolve()));
    });
  });
}

function destroySession(req, res) {
  return new Promise((resolve, reject) => {
    req.session.destroy((err) => {
      if (err) return reject(err);
      res.clearCookie('connect.sid');
      resolve();
    });
  });
}

module.exports = { requireAuth, requireRole, startSession, destroySession, pwdStamp };
