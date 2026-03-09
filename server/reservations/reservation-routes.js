const express = require('express');
const router = express.Router();
const reservationController = require('./reservation-controller');

router.post('/create', reservationController.createReservation);
router.post('/', reservationController.createReservation);
// router.get('/', reservationController.getReservations);
// router.get('/:id', reservationController.getReservation);

module.exports = router;