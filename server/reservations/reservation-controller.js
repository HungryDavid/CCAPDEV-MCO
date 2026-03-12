const Reservation = require('./Reservation');
const Laboratory = require('../labs/Lab');
const User = require('../users/User');
const { getTimeSlots, renderErrorPage } = require('../util/helpers');


exports.createReservation = async (req, res) => {
  try {
    const { studentNumber, selectedLab, selectedDate, labCart } = req.body;
    let studentId = req.session.userId;

    if (req.session.role === "technician") {
      studentId = await User.getIdByStudentId(studentNumber);
    }

    const anonymous = false;

    // 1️⃣ Get labId from lab name
    const labId = await Laboratory.getIdByName(selectedLab);

    // 2️⃣ Transform labCart into slots array
    // labCart = { "16:00": { seatNumber: "15", status: "available" } }
    const slots = [];
    for (const [timeSlot, seatObj] of Object.entries(labCart)) {
      if (!seatObj || !seatObj.seatNumber) continue;

      // Convert seatNumber to number
      const seatNumber = Number(seatObj.seatNumber);
      if (isNaN(seatNumber)) continue;

      slots.push({ timeSlot, seatNumber });
    }

    if (slots.length === 0) {
      return res.status(400).json({ message: "No seats selected." });
    }

    // 3️⃣ Call the model to handle creation
    await Reservation.createReservation({
      studentId,
      anonymous,
      laboratory: labId,
      date: selectedDate,
      slots
    });

    res.status(200).json({
      message: "Reservation confirmed successfully!"
    });

  } catch (err) {
    console.log(err);
    const statusCode = err.errorNumber || 500;
    const formattedMessage = `${err.errorMessage || err.message} (${statusCode})`;

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

exports.updateReservation = async (req, res) => {
  console.error("INNN");
  try {
    const { reservationId, sessionCart } = req.body;

    console.log(req.body);
    if (!reservationId || !sessionCart || Object.keys(sessionCart).length === 0) {
      return res.status(400).json({ message: 'Reservation ID and session cart are required.' });
    }

    // 1️⃣ Update reservation using model method
    const updatedReservation = await Reservation.updateReservationFromCart(reservationId, sessionCart);

    // 2️⃣ Format slots for response
    const formattedSlots = {};
    updatedReservation.slots.forEach(slot => {
      formattedSlots[slot.timeSlot] = {
        seatNumber: String(slot.seatNumber),
        status: 'available' // you can also compute reserved/expired if needed
      };
    });

    res.status(200).json({
      message: 'Reservation updated successfully.',
      reservationId: updatedReservation._id,
      slots: formattedSlots
    });

  } catch (err) {
    console.log(err);
    console.error('Error updating reservation:', err);
    const statusCode = err.errorNumber || 500;
    res.status(statusCode).json({
      message: err.errorMessage || err.message || 'Internal Server Error'
    });
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





exports.deleteReservation = async (req, res) => {
  try {

    const { labName, bookingDate, bookingTime, seatNumber } = req.body;
    const seat = parseInt(seatNumber, 10);

    if (isNaN(seat)) {
      return res.status(400).send({ error: "Invalid seat number provided." });
    }

     console.log(labName, bookingDate, bookingTime, seat);

    let { id } = req.body;
    if (labName && bookingDate && bookingTime && seat) {
      id = await Reservation.getReservationIdByLabNameDateTimeSeat(
        labName,
        bookingDate,
        bookingTime,
        seat
      );
    }

    await Reservation.deleteReservation(id);
    res.redirect("/labs/slots-availability");

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
