const mongoose = require('mongoose');
const CustomError = require('../util/CustomError');
const moment = require('moment');

const reservationSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  anonymous: { type: Boolean, default: false },
  laboratory: { type: mongoose.Schema.Types.ObjectId, ref: 'Laboratory', required: true },
  date: { type: String, required: true }, // YYYY-MM-DD
  slots: [
    {
      seatNumber: { type: Number, required: true },
      timeSlot: { type: String, required: true } // "HH:mm"
    }
  ],
  createdAt: { type: Date, default: Date.now }
});


reservationSchema.statics.checkSlotStatus = async function(selectedLab, selectedDate, labCart) {
  const currentTime = moment.utc(); // current date and time in UTC

  // Get all reservations for the selected lab and date
  const reservations = await this.find({
    laboratory: selectedLab,
    date: selectedDate
  });

  const slotStatus = {};

  // Check each time slot in labCart
  for (const [time, seatData] of Object.entries(labCart)) {
    const seatNumber = Number(seatData.seatNumber); // ensure number

    // Convert labCart time to UTC moment
    const slotMoment = moment.utc(`${selectedDate} ${time}`, 'YYYY-MM-DD HH:mm');

    slotStatus[time] = {
      status: null,
      seatNumber
    };

    // 1️⃣ Check if the slot has already passed
    if (slotMoment.isBefore(currentTime)) {
      slotStatus[time].status = 'expired';
      continue;
    }

    // 2️⃣ Check if the slot is reserved
    const isReserved = reservations.some(reservation => {
      if (!Array.isArray(reservation.slots)) return false; // skip old/invalid documents

      return reservation.slots.some(slot =>
        slot.timeSlot === time && slot.seatNumber === seatNumber
      );
    });

    slotStatus[time].status = isReserved ? 'reserved' : 'available';
  }

  return slotStatus;
};


/**
 * Create a new reservation safely
 */
// Check if the user already reserved a seat for the same lab, date, and time
reservationSchema.statics.checkUserReservationConflict = async function (studentId, laboratory, date, slots) {
  for (const { timeSlot } of slots) {
    const existing = await this.findOne({
      studentId,
      laboratory,
      date,
      "slots.timeSlot": timeSlot
    });
    if (existing) {
      throw new CustomError(409, 'Conflict', `You have already reserved a seat for ${timeSlot} in this lab.`);
    }
  }
};

// Check if seats are already taken
reservationSchema.statics.checkSeatAvailabilityConflict = async function (laboratory, date, slots) {
  for (const { seatNumber, timeSlot } of slots) {
    const existing = await this.find({
      laboratory,
      date,
      "slots.timeSlot": timeSlot,
      "slots.seatNumber": seatNumber
    });
    if (existing.length > 0) {
      throw new CustomError(409, 'Conflict', `Seat ${seatNumber} is already reserved at ${timeSlot}`);
    }
  }
};

reservationSchema.statics.createReservation = async function ({ studentId, anonymous, laboratory, date, slots }) {
  if (!laboratory || !date || !slots || slots.length === 0) {
    throw new CustomError(400, 'BadRequest', "Missing labId, date, or slots.");
  }

  // Conflict checks
  await this.checkUserReservationConflict(studentId, laboratory, date, slots);
  await this.checkSeatAvailabilityConflict(laboratory, date, slots);

  // Create reservation
  return this.create({ studentId, anonymous, laboratory, date, slots });
};
/**
 * Update a reservation
 */
reservationSchema.statics.updateReservationFromCart = async function (reservationId, sessionCart) {
  try {
    // 1️⃣ Fetch the old reservation
    const reservation = await this.findById(reservationId);
    if (!reservation) {
      throw new CustomError(404, 'Not Found', 'Reservation not found.');
    }

    // 2️⃣ Convert old slots to a map for easier access
    const oldSlotsMap = new Map();
    reservation.slots.forEach(slot => {
      oldSlotsMap.set(slot.timeSlot, slot.seatNumber);
    });

    // 3️⃣ Build new slots array
    const newSlots = [];

    // 3a. Replace or add slots from sessionCart
    for (const [timeSlot, seatData] of Object.entries(sessionCart)) {
      newSlots.push({
        timeSlot,
        seatNumber: Number(seatData.seatNumber)
      });
    }

    // 3b. Keep old slots that were not included in sessionCart
    reservation.slots.forEach(slot => {
      if (!sessionCart.hasOwnProperty(slot.timeSlot)) {
        newSlots.push({
          timeSlot: slot.timeSlot,
          seatNumber: slot.seatNumber
        });
      }
    });

    // 4️⃣ Assign updated slots to reservation
    reservation.slots = newSlots;

    // 5️⃣ Save
    await reservation.save();

    return reservation;
  } catch (error) {
    // You can log the error or wrap it in a CustomError if needed
    console.log('Error updating reservation:', error);
    throw error; // rethrow so the caller can handle it
  }
};

/**
 * Delete a reservation
 */
reservationSchema.statics.deleteReservation = async function (reservationId) {

  // Validate the reservationId
  if (!reservationId || !mongoose.Types.ObjectId.isValid(reservationId)) {
    throw new Error('Invalid reservation ID');
  }

  const result = await this.findByIdAndDelete(reservationId);

  if (!result) throw new Error('Reservation not found');

  return true; // simply indicate success
};

/**
 * Get reservations (optionally filter by lab, student, date)
 */
reservationSchema.statics.getReservationById = async function (id) {
  // 1️⃣ Validate the ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error('Invalid reservation ID');
  }

  // 2️⃣ Find the reservation and populate references
  const reservation = await this.findById(id)
    .populate('laboratory', 'name openTime closeTime') // populate lab details
    .populate('studentId', 'name email')              // populate student details
    .lean();                                          // convert to plain JS object

  // 3️⃣ Handle not found
  if (!reservation) {
    throw new Error('Reservation not found');
  }

  return reservation;
};

reservationSchema.statics.getUpcomingReservationsByUser = async function (userId) {
  try {
    const now = moment(); // current date & time

    // 1️⃣ Find all reservations for the user (no strict date filtering)
    const reservations = await this.find({ studentId: userId })
      .populate('laboratory', 'name')
      .select('_id laboratory slots date createdAt')
      .sort({ date: 1 })
      .lean();

    // 2️⃣ Format date-time for display
    const formatDateTime = (date) => {
      const d = new Date(date);
      const pad = (n) => n.toString().padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    };

    // 3️⃣ Filter reservations: include if **any slot is current or upcoming**
    const upcomingReservations = reservations.filter(res => {
      return res.slots?.some(slot => {
        const slotMoment = moment(`${res.date} ${slot.timeSlot}`, 'YYYY-MM-DD HH:mm');
        return slotMoment.isSameOrAfter(now); // slot is current or upcoming
      });
    });

    // 4️⃣ Map reservations to output format
    const grouped = upcomingReservations.map(res => {
      const seats = res.slots?.map(s => s.seatNumber).join(', ') || '';
      const times = res.slots?.map(s => s.timeSlot).join(', ') || '';

      return {
        reservationId: res._id,
        laboratory: res.laboratory?.name || 'Unknown',
        date: res.date,
        seats,
        time: times,
        dateTimeCreated: formatDateTime(res.createdAt)
      };
    });

    return grouped;

  } catch (err) {
    throw err;
  }
};

reservationSchema.statics.getReservationIdByLabNameDateTimeSeat = async function(labName, date, timeSlot, seatNumber) {
  if (!labName || !date || !timeSlot || seatNumber === undefined) {
    throw new Error('labName, date, timeSlot, and seatNumber are required');
  }

  // 1️⃣ Find the laboratory by name
  const lab = await mongoose.model('Laboratory').findOne({ name: labName });
  if (!lab) {
    throw new Error('Laboratory not found');
  }

  // 2️⃣ Find the reservation matching the lab, date, timeSlot, and seatNumber
  const reservation = await this.findOne({
    laboratory: lab._id,
    date: date,
    slots: {
      $elemMatch: { timeSlot: timeSlot, seatNumber: Number(seatNumber) }
    }
  }).select('_id');

  // 3️⃣ Return reservation ID or null if not found
  return reservation?._id || null;
};

module.exports = mongoose.model('Reservation', reservationSchema);