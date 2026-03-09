const Reservation = require('./Reservation');

exports.createReservation = async (req, res) => {
  try {
    const { labId, date, selections } = req.body; // selections = { time: [seatNumbers] }
    const studentId = req.user?._id || null;
    const anonymous = !req.user;

    if (!selections || Object.keys(selections).length === 0) {
      return res.status(400).json({ error: "No seats selected" });
    }

    // Loop through each time slot
    for (const [time, seats] of Object.entries(selections)) {
      await Reservation.createReservation({
        studentId,
        anonymous,
        laboratory: labId,
        date,
        timeSlots: [time],
        seatNumbers: seats.map(Number)
      });
    }

    res.status(201).json({ message: "Reservation created successfully" });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
};

exports.getReservationById = async (req, res) => {
  try {

    const reservation = await Reservation.getReservationById(req.params.id);

    res.json(reservation);

  } catch (err) {

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

    const { id } = req.params;

    await Reservation.deleteReservation(id);

    res.json({ message: "Reservation deleted" });

  } catch (err) {

    res.status(404).send(err.message);

  }
};

exports.getAvailability = async (req, res) => {
  try {
    const { labId } = req.params;
    const { date, time } = req.query;

    // Build filter
    const filter = { laboratory: labId, date };
    if (time) filter.timeSlots = time; // filter by specific time if provided

    // Fetch reservations from the model
    const reservations = await Reservation.getReservations(filter);

    // Build reservedSeats object: { "14:30": [1,2,3], ... }
    const reservedSeats = {};

    reservations.forEach(r => {
      r.timeSlots.forEach(slot => {
        if (!reservedSeats[slot]) reservedSeats[slot] = [];
        if (r.seatNumbers) reservedSeats[slot].push(...r.seatNumbers);
      });
    });

    res.json(reservedSeats);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch availability' });
  }
};

