const Reservation = require('./Reservation');
const Laboratory = require('../labs/Lab');


exports.createReservation = async (req, res) => {
  try {
    const { labId, date, selections } = req.body; // selections = { time: [seatNumbers] }
    
    const studentId = req.session?.userId || null;
    const anonymous = !studentId;

    // Ensure that the necessary fields are provided
    if (!labId || !date || !selections || Object.keys(selections).length === 0) {
      return res.status(400).json({ error: "Invalid request, missing labId, date or selections." });
    }

    const decodedLabName = decodeURIComponent(labId);

    const actualLabId = await Laboratory.getIdByName(decodedLabName);

    // Loop through each time slot and validate seat availability
    for (const [time, seats] of Object.entries(selections)) {
      const seatNumbers = seats.map(Number); // Ensure seats are in number format

      // Check if the selected seats are available for this time slot
      const isAvailable = await Laboratory.areSeatsAvailable(
        decodedLabName, 
        date,
        [time], // Single time slot
        seatNumbers
      );

      if (!isAvailable) {
        return res.status(400).json({
          error: `One or more seats for time slot ${time} are already reserved.`,
        });
      }

      console.log("hello");
      // Create reservation for this time slot
      await Reservation.createReservation({
        _id: `res-${Date.now()}-${Math.floor(Math.random() * 1000)}`, 
        userId: studentId,
        anonymous: anonymous,
        labId: actualLabId,         
        reservationDate: date,      
        timeSlots: [time],
        seatNumbers: seatNumbers,
      });
    }
    
    res.status(200).json({ message: "Reservation successful!" });
    
  } catch (err) {
    console.error(err);
    // More specific error messages can be added for various error types
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: "An error occurred while processing your reservation." });
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
