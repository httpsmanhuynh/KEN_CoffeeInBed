function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.status(401).send({ message: 'Vui lòng đăng nhập' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user) {
    return res.status(401).send({ message: 'Vui lòng đăng nhập' });
  }
  if (req.session.user.role !== 'ADMIN') {
    return res.status(403).send({ message: 'Không có quyền truy cập' });
  }
  next();
}

module.exports = { requireLogin, requireAdmin };
