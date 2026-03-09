const express = require('express');
const router = express.Router();
const controller = require('./user-controller');
const { authorize } = require('../middleware/auth-middleware');

// Chain them: Route -> Middleware -> Controller
authorize('student','technician')
router.get('/search',controller.searchUser);
router.get('/', controller.renderSearchUserPage);

module.exports = router;