const Reservation = require('./Reservation');
const Laboratory = require('../labs/Lab');
const User = require('../users/User');
const { getTimeSlots, renderErrorPage } = require('../util/helpers');


exports.createReservation = async (req, res) => {
  try {
    const {selectedLab, selectedDate, labCart, walkInStudent } = req.body; // selections = { time: [seatNumber] }
    const userId = req.session.userId;
    const userRole = req.session.role;

    let studentId = userId;
    let walkInDetails = null;
    let isAnonymous = req.body.isAnonymous || false;

    if (userRole === 'technician' && walkInStudent) {
      studentId = null; // Walk-ins aren't necessarily linked to a system User ID
      walkInDetails = walkInStudent;
      isAnonymous = false; // Technicians usually record actual names/IDs
    }

    // Get labId from the name (assuming this logic stays the same)
    const labId = await Laboratory.getIdByName(selectedLab);

    const timeSlots = Object.keys(labCart);
    const seatNumbers = Object.values(labCart).map(item => item.seatNumber);


    // Now that the controller only prepares data, let the model handle validation and creation
    await Reservation.createReservation({
      studentId,
      walkInStudent: walkInDetails,
      anonymous: isAnonymous,
      laboratory: labId,
      date: selectedDate,
      timeSlots,
      seatNumbers,
    });

    res.status(200).json({
      message: "Reservation confirmed successfully!",
    });
  } catch (err) {
    console.log(err);
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

const normalizeTimeSlots = (time) => {
  if (!time) return undefined;
  if (Array.isArray(time)) return time.map(t => String(t).trim()).filter(Boolean);
  if (typeof time === 'string') return time.split(',').map(t => t.trim()).filter(Boolean);
  return undefined;
};

const parseSeatField = (seat) => {
  if (seat === undefined || seat === null || seat === '') return undefined;
  const seatNumber = Number(seat);
  if (!Number.isFinite(seatNumber) || seatNumber <= 0) {
    throw new Error('Seat must be a positive number');
  }
  return [seatNumber];
};

const buildEditReservationData = async (reqBody, existingReservation) => {
  const { laboratory: labName, date, time, seat } = reqBody;
  const result = {};

  if (seat !== undefined) {
    result.seatNumbers = parseSeatField(seat);
  }

  if (labName && labName !== existingReservation.laboratory?.name) {
    result.laboratory = await Laboratory.getIdByName(labName);
  }

  if (date && date !== existingReservation.date) {
    result.date = date;
  }

  const normalizedTime = normalizeTimeSlots(time);
  if (normalizedTime && normalizedTime.length > 0) {
    // only set if different from current values to avoid unnecessary checks
    const currentTime = existingReservation.timeSlots || [];
    if (normalizedTime.length !== currentTime.length || normalizedTime.some((v, i) => v !== currentTime[i])) {
      result.timeSlots = normalizedTime;
    }
  }

  return result;
};

exports.editReservation = async (req, res) => {
  try {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Reservation id is required' });
    }

    const reservation = await Reservation.getReservationById(id);
    if (!reservation) {
      return res.status(404).json({ error: 'Reservation not found' });
    }

    const userRole = String(req.session.role || '').toLowerCase();
    const userId = req.session.userId;

    if (userRole === 'student' && reservation.studentId && reservation.studentId.toString() !== userId?.toString()) {
      return res.status(403).render('error', { message: 'Forbidden: You can only edit your own reservations.' });
    }

    let updateData;
    try {
      updateData = await buildEditReservationData(req.body, reservation);
    } catch (validationError) {
      return res.status(400).json({ error: validationError.message });
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No changes detected to update.' });
    }

    const checkLabName = req.body.laboratory || reservation.laboratory?.name;
    const checkDate = updateData.date || reservation.date;
    const checkTime = updateData.timeSlots || reservation.timeSlots;
    const checkSeats = updateData.seatNumbers || reservation.seatNumbers;

    const isAvailable = await Laboratory.areSeatsAvailable(checkLabName, checkDate, checkTime, checkSeats);
    if (!isAvailable) {
      return res.status(400).json({ error: 'The selected lab, date, time, or seat is already reserved by another user.' });
    }

    const updated = await Reservation.updateReservation(id, updateData);

    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.json({ message: 'Reservation updated successfully', reservation: updated });
    }

    res.redirect('/reservation');
  } catch (err) {
    console.error('editReservation error:', err);

    const statusCode = err.status || err.statusCode || 500;
    const errorMessage = err.message || 'Failed to update reservation';

    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.status(statusCode).json({ error: errorMessage });
    }

    return res.status(statusCode).render('error', { message: errorMessage });
  }
};