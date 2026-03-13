const mongoose = require('mongoose');
const CustomError = require('../util/CustomError');
const moment = require('moment');

const reservationSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  anonymous: { type: Boolean, default: false },
  laboratory: { type: mongoose.Schema.Types.ObjectId, ref: 'Laboratory', required: true },
  date: { type: String, required: true },
  slots: [
    {
      seatNumber: { type: Number, required: true },
      timeSlot: { type: String, required: true }
    }
  ],
  createdAt: { type: Date, default: Date.now }
});


reservationSchema.statics.checkSlotStatus = async function (selectedLab, selectedDate, labCart) {
  const currentTime = moment.utc();

  const reservations = await this.find({
    laboratory: selectedLab,
    date: selectedDate
  });

  const slotStatus = {};

  for (const [time, seatData] of Object.entries(labCart)) {
    const seatNumber = Number(seatData.seatNumber); 

    const slotMoment = moment.utc(`${selectedDate} ${time}`, 'YYYY-MM-DD HH:mm');

    slotStatus[time] = {
      status: null,
      seatNumber
    };

    if (slotMoment.isBefore(currentTime)) {
      slotStatus[time].status = 'expired';
      continue;
    }

    const isReserved = reservations.some(reservation => {
      if (!Array.isArray(reservation.slots)) return false; 

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
  await this.checkUserReservationConflict(studentId, laboratory, date, slots);
  await this.checkSeatAvailabilityConflict(laboratory, date, slots);
  return this.create({ studentId, anonymous, laboratory, date, slots });
};

/**
 * Update a reservation
 */
reservationSchema.statics.updateReservationFromCart = async function (reservationId, sessionCart) {
  try {
    const reservation = await this.findById(reservationId);
    if (!reservation) {
      throw new CustomError(404, 'Not Found', 'Reservation not found.');
    }

    const oldSlotsMap = new Map();
    reservation.slots.forEach(slot => {
      oldSlotsMap.set(slot.timeSlot, slot.seatNumber);
    });

    const newSlots = [];

    for (const [timeSlot, seatData] of Object.entries(sessionCart)) {
      newSlots.push({
        timeSlot,
        seatNumber: Number(seatData.seatNumber)
      });
    }

    reservation.slots.forEach(slot => {
      if (!sessionCart.hasOwnProperty(slot.timeSlot)) {
        newSlots.push({
          timeSlot: slot.timeSlot,
          seatNumber: slot.seatNumber
        });
      }
    });

    reservation.slots = newSlots;
    await reservation.save();

    return reservation;
  } catch (error) {
    throw error;
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

  return true;
};

/**
 * Get reservations (optionally filter by lab, student, date)
 */
reservationSchema.statics.getReservationById = async function (id) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error('Invalid reservation ID');
  }

  const reservation = await this.findById(id)
    .populate('laboratory', 'name openTime closeTime')
    .populate('studentId', 'name email')
    .lean();
  if (!reservation) {
    throw new Error('Reservation not found');
  }

  return reservation;
};

reservationSchema.statics.getUpcomingReservationsByUser = async function (userId) {
  try {
    const now = moment(); // current date & time

    const reservations = await this.find({ studentId: userId })
      .populate('laboratory', 'name')
      .select('_id laboratory slots date createdAt')
      .sort({ date: 1 })
      .lean();

    const formatDateTime = (date) => {
      const d = new Date(date);
      const pad = (n) => n.toString().padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    };

    const upcomingReservations = reservations.filter(res => {
      return res.slots?.some(slot => {
        const slotMoment = moment(`${res.date} ${slot.timeSlot}`, 'YYYY-MM-DD HH:mm');
        return slotMoment.isSameOrAfter(now); // slot is current or upcoming
      });
    });

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

reservationSchema.statics.getReservationIdByLabNameDateTimeSeat = async function (labName, date, timeSlot, seatNumber) {
  if (!labName || !date || !timeSlot || seatNumber === undefined) {
    throw new Error('labName, date, timeSlot, and seatNumber are required');
  }

  const lab = await mongoose.model('Laboratory').findOne({ name: labName });
  if (!lab) {
    throw new Error('Laboratory not found');
  }

  const reservation = await this.findOne({
    laboratory: lab._id,
    date: date,
    slots: {
      $elemMatch: { timeSlot: timeSlot, seatNumber: Number(seatNumber) }
    }
  }).select('_id');

  return reservation?._id || null;
};

module.exports = mongoose.model('Reservation', reservationSchema);