require('dotenv').config();
const express = require('express');
const app = express();
const port = 3002;

const morgan = require('morgan');
app.use(morgan('combined'));

const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));

const cors = require('cors');
app.use(cors({ origin: 'http://localhost:4200', credentials: true }));

if (!process.env.SESSION_SECRET) {
  throw new Error('Thiếu SESSION_SECRET trong file .env');
}
const session = require('express-session');
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 3600000, httpOnly: true, sameSite: 'lax' },
  }),
);

const bodyParser = require('body-parser');
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

const { ObjectId } = require('mongodb');
const db = require('./db');

app.use('/api/auth', require('./routes/auth'));

app.get('/', (req, res) => {
  res.send('This Web server is processed for MongoDB');
});

const publicCollections = ['zones', 'spaces', 'packages', 'space_package_prices', 'product_addons'];

app.get('/api/:collection', async (req, res) => {
  const name = req.params.collection;
  if (!publicCollections.includes(name)) {
    return res.status(404).send('Not found');
  }
  const data = await db.collection(name).find().toArray();
  res.send(data);
});

app.get('/api/:collection/:id', async (req, res) => {
  const name = req.params.collection;
  if (!publicCollections.includes(name)) {
    return res.status(404).send('Not found');
  }
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(400).send('Invalid id');
  }
  const data = await db.collection(name).findOne({
    _id: new ObjectId(req.params.id),
  });
  if (!data) return res.status(404).send('Not found');
  res.send(data);
});

// Lệnh này giữ server chạy, KHÔNG được thiếu
app.listen(port, () => {
  console.log(`My Server listening on port ${port}`);
});
