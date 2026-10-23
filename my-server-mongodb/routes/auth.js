const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');

const router = express.Router();
const users = () => db.collection('users');

const toSafeUser = (u) => ({
  _id: u._id,
  full_name: u.full_name,
  email: u.email,
  phone: u.phone,
  role: u.role,
  membership_tier: u.membership_tier,
  loyalty_points: u.loyalty_points,
});

// Đăng ký
router.post('/register', async (req, res) => {
  try {
    const { full_name, email, phone, date_of_birth, password } = req.body;
    if (!full_name || !email || !phone || !date_of_birth || !password) {
      return res.status(400).send({ message: 'Vui lòng nhập đủ thông tin' });
    }
    if (String(password).length < 8) {
      return res.status(400).send({ message: 'Mật khẩu tối thiểu 8 ký tự' });
    }
    const dob = new Date(date_of_birth);
    if (isNaN(dob.getTime())) {
      return res.status(400).send({ message: 'Ngày sinh không hợp lệ' });
    }

    const now = new Date();
    const result = await users().insertOne({
      full_name: String(full_name).trim(),
      email: String(email).trim().toLowerCase(),
      phone: String(phone).trim(),
      date_of_birth: dob,
      password_hash: await bcrypt.hash(String(password), 10),
      role: 'CUSTOMER', // chỉ cho tự đăng ký Customer
      status: 'ACTIVE',
      loyalty_points: 0,
      membership_tier: 'BASIC',
      created_at: now,
      updated_at: now,
    });
    res.status(201).send({ message: 'Đăng ký thành công', _id: result.insertedId });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).send({ message: 'Email hoặc số điện thoại đã tồn tại' });
    }
    if (err.code === 121) {
      return res
        .status(400)
        .send({ message: 'Dữ liệu không hợp lệ (kiểm tra email, số điện thoại)' });
    }
    console.error(err);
    res.status(500).send({ message: 'Lỗi máy chủ' });
  }
});

// Đăng nhập
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).send({ message: 'Vui lòng nhập email và mật khẩu' });
    }
    const user = await users().findOne({ email: String(email).trim().toLowerCase() });
    const ok = user && (await bcrypt.compare(String(password), user.password_hash));
    if (!ok) {
      return res.status(401).send({ message: 'Email hoặc mật khẩu không đúng' });
    }
    if (user.status === 'LOCKED') {
      return res.status(403).send({ message: 'Tài khoản đã bị khóa' });
    }
    // regenerate: tạo session ID mới, chống Session Fixation (slide Chương VIII)
    req.session.regenerate((err) => {
      if (err) return res.status(500).send({ message: 'Lỗi máy chủ' });
      req.session.user = {
        _id: user._id.toString(),
        full_name: user.full_name,
        role: user.role,
      };
      res.send({ message: 'Đăng nhập thành công', user: toSafeUser(user) });
    });
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: 'Lỗi máy chủ' });
  }
});

// Ai đang đăng nhập
router.get('/me', (req, res) => {
  if (!req.session.user) {
    return res.status(401).send({ message: 'Chưa đăng nhập' });
  }
  res.send({ user: req.session.user });
});

// Đăng xuất
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.send({ message: 'Đã đăng xuất' });
  });
});

module.exports = router;
