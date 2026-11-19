'use strict';
// BR-A01, BR-A04, BR-A05. Session do express-session tạo; đăng nhập gán req.session.user = { id, role }.
const { ObjectId } = require('mongodb');

const unauthenticated = (res) =>
  res.status(401).json({ code: 'UNAUTHENTICATED', message: 'Vui lòng đăng nhập' });

// BR-A05: đọc lại user từ DB ở MỌI request cần đăng nhập. User bị khóa/xóa, hoặc đã đổi/reset mật khẩu
// sau khi session này được tạo (pwdAt lệch) => hủy session, trả 401. Thành công thì gán req.user.
async function checkSession(req, res) {
  const { id, pwdAt } = req.session.user;
  const user = ObjectId.isValid(id)
    ? await req.app.locals.db.collection('users').findOne({ _id: new ObjectId(id) })
    : null;
  if (!user || user.status !== 'ACTIVE' || pwdStamp(user) !== pwdAt) {
    await destroySession(req, res);
    unauthenticated(res);
    return false;
  }
  req.user = user;
  return true;
}

// Route đặt chỗ/hồ sơ chỉ cần gắn requireAuth là đã kiểm tra DB (không cần nhớ gọi thêm middleware nào).
function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) return unauthenticated(res);
  checkSession(req, res).then((ok) => ok && next(), next);
}
// Vai trò lấy từ DB (req.user.role), không tin role trong session.
function requireRole(role) {
  return (req, res, next) =>
    requireAuth(req, res, () => {
      if (req.user.role !== role)
        return res.status(403).json({ code: 'FORBIDDEN', message: 'Không có quyền' });
      next();
    });
}

// Mốc đổi mật khẩu (ms) lưu trong session; khác giá trị trong DB => session đã bị thu hồi (BR-A05).
const pwdStamp = (user) =>
  user.password_changed_at ? new Date(user.password_changed_at).getTime() : 0;

// Gọi SAU KHI xác thực xong hoàn toàn (mật khẩu + OTP nếu 2FA). Tạo session ID mới (chống session fixation)
// nhưng giữ ngữ cảnh đặt chỗ của Auth Guard.
function startSession(req, user) {
  const pendingBooking = req.session.pendingBooking;
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      req.session.user = {
        id: String(user._id ?? user.id),
        role: user.role,
        pwdAt: pwdStamp(user),
      };
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
