'use strict';
const express = require('express');
const { TIERS } = require('../domain/loyalty');
const router = express.Router();

// Public: bảng hạng thành viên (BR-H04)
router.get('/tiers', (req, res) => res.json(TIERS));

module.exports = router;
