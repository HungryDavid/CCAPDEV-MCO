const express = require('express');
const router = express.Router();
const controller = require('./labs-controller');
const reservationController = require('../reservations/reservation-controller');
const { authorize } = require('../middleware/auth-middleware');

router.get('/slots-availability/:id', controller.getLabSeatsAvailability);
router.get('/slots-availability', controller.getLabSlotsAvailabilityCount);


// router.get("/:id/availability", reservationController.getAvailability);


authorize('technician');
router.post('/manage/create', controller.createLab);
router.get('/manage/:id/edit', controller.getLabById);
router.post('/manage/:id/edit', controller.updateLab);
router.post('/manage/:id/delete', controller.deleteLab);
router.get('/manage', controller.getManageLabsPage);

module.exports = router;