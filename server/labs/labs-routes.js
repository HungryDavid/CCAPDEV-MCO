const express = require('express');
const router = express.Router();
const controller = require('./labs-controller');
const { authorize, ensureAuthenticated } = require('../middleware/auth-middleware');

router.get('/slots-availability', controller.getAllAvailableLabs);
router.get("/:labName/availability", controller.getSeatStatus);
router.post('/slots-availability/:labName', controller.getLabSeats);
router.use(ensureAuthenticated);
authorize('technician');
router.post('/manage/create', controller.createLab);
router.get('/manage/:id/edit', controller.getLabById);
router.post('/manage/:id/edit', controller.updateLab);
router.post('/manage/:id/delete', controller.deleteLab);
router.get('/manage', controller.getManageLabsPage);

module.exports = router;