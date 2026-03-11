const express = require('express');
const router = express.Router();
const reservationController = require('./reservation-controller');

router.post('/create', reservationController.createReservation);
router.post('/delete', reservationController.deleteReservation);
router.get('/', reservationController.getReservationById);
// router.get('/:id', reservationController.getReservation);

module.exports = router;