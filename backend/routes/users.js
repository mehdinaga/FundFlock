// routes/users.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const { searchUsers, getUser } = require('../controllers/userController');

router.use(protect);

router.get('/search', searchUsers);
router.get('/:id', getUser);

module.exports = router;
