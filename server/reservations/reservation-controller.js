const Reservation = require('./Reservation');
const Laboratory = require('../labs/Lab');
const User = require('../users/User');
const { getTimeSlots, renderErrorPage } = require('../util/helpers');


exports.createReservation = async (req, res) => {
  try {
    const { labName, date, selections } = req.body; // selections = { time: [seatNumber] }
    const studentId = req.session.userId;
    const anonymous = true;

    // Get labId from the name (assuming this logic stays the same)
    const labId = await Laboratory.getIdByName(labName);

    const timeSlots = [];
    const seatNumbers = [];

    // Build timeSlots and seatNumbers arrays
    for (const [time, seats] of Object.entries(selections)) {
      const seat = Number(seats[0]); // only one seat per time slot
      timeSlots.push(time);
      seatNumbers.push(seat);
    }

    // Now that the controller only prepares data, let the model handle validation and creation
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
    const statusCode = err.errorNumber || 500;

    // Format: "Conflict: You have already reserved a seat for 01:00 in this lab. (409)"
    const formattedMessage = `${err.errorMessage} (${statusCode})`;

    res.status(statusCode).json({
      message: formattedMessage
    });

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

exports.editReservationById = async (req, res) => {
  try {
    const reservationId = req.params.id;
    const reservation = await Reservation.getReservationById(reservationId);


    if (!reservation) {
      return res.status(404).send('Reservation not found');
    }


    const selectedTime = reservation.timeSlots[0];
    const selectedLabName = reservation.laboratory.name;
    const selectedDate = reservation.date;
    const lab = reservation.laboratory;
    const labSeats = await Laboratory.getLabSeats(selectedLabName, selectedTime, selectedDate);
    const timeSlotsArray = getTimeSlots(true, 30, lab.openTime, lab.closeTime, selectedDate);


    // Example server-side in editReservationById
    // Convert reservationSeats directly to the cart format
    const reservationSeats = {};

    reservation.seatNumbers?.forEach(seatNumber => {
      if (!reservationSeats[selectedTime]) reservationSeats[selectedTime] = [];
      reservationSeats[selectedTime].push(seatNumber.toString()); // convert to string if your cart stores strings
    });

    res.render("lab-details", {
      labSeats,
      selectedDate,
      selectedTime,
      timeSlotsArray,
      lab,
      reservation,
      reservationSeats,
      layout: "dashboard",
      activePage: "slots-availability",
      headerTitle: lab.name
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

exports.checkSeatAvailability = async (req, res, next) => {
  try {
    // Extract data from the request body
    const { selectedLab, selectedDate, labCart } = req.body;

    const timeSlots = Object.keys(labCart);
    const seatNumbers = Object.values(labCart);
    const labId = await Laboratory.getIdByName(selectedLab);
    const slotStatus = await Reservation.checkSlotStatus(labId, selectedDate, labCart);
    return res.json(slotStatus);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};
