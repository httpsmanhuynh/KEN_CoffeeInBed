require('node:dns').setServers(['8.8.8.8', '1.1.1.1']);
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const { MongoStore } = require('connect-mongo');
const path = require('path');
const { MongoClient } = require('mongodb');

const app = express();
const port = process.env.PORT || 3002; // Cổng 3002 theo slide của thầy
const isProd = process.env.NODE_ENV === 'production';

// 1. Middleware cơ bản
app.use(morgan('combined'));
if (isProd) app.set('trust proxy', 1); // sau reverse proxy HTTPS: cookie secure + req.ip (rate limit) mới đúng
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:4200', credentials: true }));
app.use(express.json({ limit: '1mb' })); // 50mb quá lớn nếu không upload ảnh qua JSON
app.use(express.urlencoded({ limit: '1mb', extended: true }));
app.use((req, res, next) => {
  req.body ??= {};
  next();
}); // Express 5: req.body là undefined khi không có body
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// 2. MongoDB (Chương VII). URI lấy từ env; mặc định là Mongo local. Tạo trước để session store dùng chung kết nối.
const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const client = new MongoClient(uri);
const DB_NAME = 'ken_space_booking';

// 3. Session (Chương VIII). Secret lấy từ biến môi trường, không commit giá trị thật.
if (isProd && !process.env.SESSION_SECRET)
  throw new Error('SESSION_SECRET is required in production');
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev-only-secret',
    // Lưu session trong MongoDB (collection sessions): restart server không mất đăng nhập; TTL tự dọn session hết hạn.
    store: MongoStore.create({ client, dbName: DB_NAME, collectionName: 'sessions', ttl: 24 * 60 * 60 }),
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, secure: isProd, sameSite: 'lax', maxAge: 24 * 60 * 60 * 1000 },
  }),
);

async function startServer() {
  try {
    await client.connect();
    app.locals.db = client.db(DB_NAME); // route dùng req.app.locals.db
    console.log('Mongo host:', client.options.hosts.map((h) => h.host).join(','));
    console.log('Đã kết nối thành công tới MongoDB!');
    // await require('./src/config/indexes').ensureIndexes(app.locals.db); // BR-A02: unique phone/email (idempotent)

    // 4. Routes
    app.get('/', (req, res) => res.send('This Web server is processed for MongoDB (KEN Platform)'));
    const authRouter = require('./src/routes/auth');
    app.use('/api/loyalty', require('./src/routes/loyalty'));
    app.use('/api', authRouter);
    app.use('/api/auth', authRouter);
    app.use('/api/profile', require('./src/routes/profile'));

    // Lỗi chung: lỗi client (body-parser: JSON sai 400, quá lớn 413...) giữ đúng mã 4xx;
    // lỗi server luôn trả 500 và không lộ stack.
    // eslint-disable-next-line no-unused-vars
    app.use((err, req, res, next) => {
      if (res.headersSent) return next(err);
      const status = err.status || err.statusCode || 500;
      if (status >= 400 && status < 500) {
        return res.status(status).json({
          code: status === 413 ? 'PAYLOAD_TOO_LARGE' : 'BAD_REQUEST',
          message: 'Yêu cầu không hợp lệ',
        });
      }
      console.error(err);
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Lỗi hệ thống' });
    });

    app.listen(port, () => console.log(`My Server listening on port ${port}`));
  } catch (err) {
    console.error('Lỗi kết nối cơ sở dữ liệu MongoDB:', err);
    process.exit(1);
  }
}

startServer();
