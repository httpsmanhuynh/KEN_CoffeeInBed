require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const path = require('path');
const { MongoClient } = require('mongodb');

const app = express();
const port = process.env.PORT || 3002; // Cổng 3002 theo slide của thầy
const isProd = process.env.NODE_ENV === 'production';

// 1. Middleware cơ bản
app.use(morgan('combined'));
app.use(cors({ origin: 'http://localhost:4200', credentials: true }));
app.use(bodyParser.json({ limit: '1mb' })); // 50mb quá lớn nếu không upload ảnh qua JSON
app.use(bodyParser.urlencoded({ limit: '1mb', extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// 2. Session (Chương VIII). Secret lấy từ biến môi trường, không commit giá trị thật.
if (isProd && !process.env.SESSION_SECRET)
  throw new Error('SESSION_SECRET is required in production');
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev-only-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, secure: isProd, sameSite: 'lax', maxAge: 24 * 60 * 60 * 1000 },
  }),
);

// 3. MongoDB (Chương VII). URI lấy từ env; mặc định là Mongo local.
const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const client = new MongoClient(uri);

async function startServer() {
  try {
    await client.connect();
    console.log('Mongo host:', client.options.hosts.map((h) => h.host).join(','));
    app.locals.db = client.db('ken_space_booking'); // route dùng req.app.locals.db
    console.log('Đã kết nối thành công tới MongoDB!');

    // 4. Routes
    app.get('/', (req, res) => res.send('This Web server is processed for MongoDB (KEN Platform)'));
    const authRouter = require('./src/routes/auth');
    app.use('/api/loyalty', require('./src/routes/loyalty'));
    app.use('/api', authRouter);
    app.use('/api/auth', authRouter);

    app.use((err, req, res, next) => {
      // eslint-disable-line no-unused-vars
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
