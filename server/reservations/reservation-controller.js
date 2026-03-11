const Reservation = require('./Reservation');
const Laboratory = require('../labs/Lab');
const User = require('../users/User');



exports.createReservation = async (req, res) => {
  try {
    const { labName, date, selections } = req.body; // selections = { time: [seatNumber] }
    const studentId = req.session.userId;
    const anonymous = true;

    if (!labName || !date || !selections || Object.keys(selections).length === 0) {
      return res.status(400).json({ error: "Invalid request, missing labId, date or selections." });
    }

    const labId = await Laboratory.getIdByName(labName);

    const timeSlots = [];
    const seatNumbers = [];

    // Check availability and prepare arrays for reservation
    for (const [time, seats] of Object.entries(selections)) {
      const seat = Number(seats[0]); // only one seat per time slot
      const isAvailable = await Laboratory.areSeatsAvailable(labName, date, [time], [seat]);

      if (!isAvailable) {
        return res.status(400).json({
          error: `Seat ${seat} for time slot ${time} is already reserved.`,
        });
      }

      timeSlots.push(time);
      seatNumbers.push(seat);
    }

    // Create single reservation for all time slots
    await Reservation.createReservation({
      studentId,
      anonymous,
      laboratory: labId,
      date,
      timeSlots,
      seatNumbers,
    });
    res.status(200).json({
      message: "Reservation confirmed successfully!",
    });
  } catch (err) {
    console.error(err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: "An error occurred while processing your reservation." });
  }
};

exports.getReservationById = async (req, res) => {
  try {
    const sessionUser = await User.readUserByIdSafe(req.session.userId).lean();
    const reservations = await Reservation.getUpcomingReservationsByUser(req.session.userId);

    res.render('my-reservations', {
            user: sessionUser,
            account: sessionUser,
            title: 'My Reservations',
            headerTitle: 'My Reservations',
            layout: 'dashboard',
            activePage: 'my-reservations',
            reservations
    });

  } catch (err) {
    console.log(err);
    res.status(404).send(err.message);

  }
};

exports.getReservations = async (req, res) => {
  try {

    const filter = {};

    if (req.query.lab) filter.laboratory = req.query.lab;
    if (req.query.date) filter.date = req.query.date;
    if (req.query.student) filter.studentId = req.query.student;

    const reservations = await Reservation.getReservations(filter);

    res.json(reservations);

  } catch (err) {

    res.status(500).send(err.message);

  }
};

exports.updateReservation = async (req, res) => {
  try {

    const { id } = req.params;
    const { selections, date, laboratory } = req.body;

    const updateData = {};

    if (selections) {
      updateData.timeSlots = Reservation.parseSelections(selections);
    }

    if (date) updateData.date = date;
    if (laboratory) updateData.laboratory = laboratory;

    const updated = await Reservation.updateReservation(id, updateData);

    res.json(updated);

  } catch (err) {

    res.status(400).send(err.message);

  }
};

exports.deleteReservation = async (req, res) => {
  try {


    const { id } = req.body;

    await Reservation.deleteReservation(id);
    res.redirect("/reservation");

  } catch (err) {

    console.log(err);
    res.status(404).send(err.message);

  }
};
