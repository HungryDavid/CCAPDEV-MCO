const express = require('express');
const router = express.Router();
const controller = require('./labs-controller');
const reservationController = require('../reservations/reservation-controller');

router.get("/:id/availability", reservationController.getAvailability);
router.get('/:id', controller.getLabDetails);
router.get('/', controller.getSlotsAvailabilityPage);



module.exports = router;