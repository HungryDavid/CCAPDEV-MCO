const express = require('express');
const router = express.Router();
const  controller = require('./labs-controller');
const { authorize } = require('../middleware/auth-middleware');

router.get("/:labName/availability", controller.getSeatStatus);
router.get('/slots-availability/:labName', controller.getLabSeats);
router.get('/slots-availability', controller.getAllAvailableLabs);


authorize('technician');
router.post('/manage/create', controller.createLab);
router.get('/manage/:id/edit', controller.getLabById);
router.post('/manage/:id/edit', controller.updateLab);
router.post('/manage/:id/delete', controller.deleteLab);
router.get('/manage', controller.getManageLabsPage);

module.exports = router;