const express = require('express');
const router = express.Router();
const authController = require('./auth-controller');
const {ensureGuest} = require('../middleware/auth-middleware');

router.use('/logout', authController.logoutUser);

router.get('/login', authController.getLoginPage);
router.post('/login', authController.loginUser);

router.get('/register', authController.getRegisterPage);
router.post('/register', authController.registerUser);

router.get('/', (req, res) => {
    res.redirect('/auth/login');
});
module.exports = router;