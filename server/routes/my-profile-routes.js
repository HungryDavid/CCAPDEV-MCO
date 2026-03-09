const upload = require('../middleware/upload'); // Import middleware


const express = require('express');
const router = express.Router();
const controller = require('./user-controller');
const searchController = require('./user-controller');
const { authorize } = require('../middleware/auth-middleware');

// Chain them: Route -> Middleware -> Controller
console.log("Profile Routes");

authorize('student','technician');
router.post('/edit', upload.single('profilePic'), controller.updateProfile)
router.post('/delete', controller.deleteProfile)
router.get('/', controller.renderMyProfilePage);
module.exports = router;