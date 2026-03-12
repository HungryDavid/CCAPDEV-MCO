const mongoose = require('mongoose');
const CustomError = require('../util/CustomError');
const moment = require('moment');

const reservationSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null // null if anonymous
  },
  walkInStudent: {
    type: String,
    default: null 
  },
  anonymous: {
    type: Boolean,
    default: false
  },
  laboratory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Laboratory',
    required: true
  },
  date: {
    type: String, // 'YYYY-MM-DD'
    required: true
  },
  timeSlots: {
    type: [String], // e.g. ["09:00","09:30"]
    required: true,
    validate: [arr => arr.length > 0, 'Must select at least one slot']
  },
  seatNumbers: {
    type: [Number], // e.g. [1,2,5]
    required: true,
    validate: [arr => arr.length > 0, 'Must select at least one seat']
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});


reservationSchema.statics.checkSlotStatus = async function(selectedLab, selectedDate, labCart) {
  const currentTime = moment.utc(); // current date and time in UTC
  const currentDate = moment.utc().format('YYYY-MM-DD'); // current date in UTC

  // Get all reservations for the selected lab and date
  const reservations = await this.find({
    laboratory: selectedLab,
    date: selectedDate
  });

  const slotStatus = {};

  // Check each time slot in labCart
  for (const [time, seatData] of Object.entries(labCart)) {
    // Convert labCart time to UTC and create moment object
    const slotMoment = moment.utc(`${selectedDate} ${time}`, 'YYYY-MM-DD HH:mm');

    // Initialize the slot status for this time
    slotStatus[time] = {
      status: null,
      seatNumber: seatData.seatNumber // Directly assign the seatNumber from labCart
    };

    // Check if the slot has passed
    if (slotMoment.isBefore(currentTime)) {
      slotStatus[time].status = 'expired';
    } else {
      // Check if the slot is reserved by matching both time and seat number
      const isReserved = reservations.some(reservation => {

        // Map through the reservation.timeSlots array, normalize each time to UTC, and format it
        const reservationTimes = reservation.timeSlots.map(slot =>
          moment.utc(slot, 'HH:mm').format('HH:mm')  // Convert each time slot to UTC and format as HH:mm
        );

        // Check if the time matches
        const isTimeMatch = reservationTimes.includes(time);
        
        // Check if the seat number also matches
        const isSeatMatch = reservation.seatNumbers.includes(seatData.seatNumber);

        // Both time and seat number must match
        if (isTimeMatch && isSeatMatch) {
          return true; // This slot is reserved
        }

        return false;
      });

      if (isReserved) {
        slotStatus[time].status = 'reserved';
      } else {
        slotStatus[time].status = 'available';
      }
    }
  }

  return slotStatus;
};



/**
 * Create a new reservation safely
 */
reservationSchema.statics.checkUserReservationConflict = async function (studentId, laboratory, date, timeSlots) {
  // Check if the user has already made a reservation for the same lab, date, and time slot
  for (const time of timeSlots) {
    const existingReservation = await this.findOne({
      studentId,
      laboratory,
      date,
      timeSlots: time
    });

    if (existingReservation) {
      throw new CustomError(409, 'Conflict', `You have already reserved a seat for ${time} in this lab.`);
    }
  }
};

reservationSchema.statics.checkSeatAvailabilityConflict = async function (laboratory, date, timeSlots, seatNumbers) {
  // Check conflicts for each time slot (seat availability)
  for (const time of timeSlots) {
    const existing = await this.find({ laboratory, date, timeSlots: time });
    const reservedSeats = existing.flatMap(r => r.seatNumbers);

    const conflict = seatNumbers.some(seat => reservedSeats.includes(seat));
    if (conflict) {
      throw new CustomError(409, 'Conflict', `One or more seats are already reserved at ${time}`);
    }
  }
};

reservationSchema.statics.createReservation = async function ({ studentId, walkInStudent, anonymous, laboratory, date, timeSlots, seatNumbers }) {
  // Validate input data directly within the model
  try {

    console.log('laboratory:', laboratory);
    console.log('date:', date);
    console.log('timeSlots:', timeSlots);
    console.log('seatNumbers:', seatNumbers);

    if (!laboratory || !date || !timeSlots || !seatNumbers || timeSlots.length === 0 || seatNumbers.length === 0) {
      throw new CustomError(400, 'BadRequest', "Invalid request, missing labId, date, time slots, or seat numbers.");
    }
    // Check for any user reservation conflicts
    if (studentId) {
      await this.checkUserReservationConflict(studentId, laboratory, date, timeSlots);
    }
    // Then, check for any seat availability conflicts
    await this.checkSeatAvailabilityConflict(laboratory, date, timeSlots, seatNumbers);
    // If no conflicts, proceed with creating the reservation
    return this.create({ studentId, walkInStudent, anonymous, laboratory, date, timeSlots, seatNumbers });
  } catch (err) {
    console.log(err);
    if (err instanceof CustomError) {
      throw err; // Re-throw the custom error to be handled at the API level or UI
    } else {
      throw new CustomError(500, 'InternalServerError', 'Failed to fetch lab slot status');
    }
  }
};

/**
 * Update a reservation
 */
reservationSchema.statics.updateReservation = async function (reservationId, updateData) {
  // Check if timeSlots/laboratory/date is being updated
  if (updateData.timeSlots || updateData.date || updateData.laboratory) {
    const reservation = await this.findById(reservationId);
    if (!reservation) throw new Error('Reservation not found');

    const labId = updateData.laboratory || reservation.laboratory;
    const date = updateData.date || reservation.date;
    const slots = updateData.timeSlots || reservation.timeSlots;

    const available = await this.areSlotsAvailable(labId, date, slots, reservationId);
    if (!available) throw new Error('One or more selected slots are already reserved');
  }

  return this.findByIdAndUpdate(reservationId, updateData, {
    new: true,
    runValidators: true
  });
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
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error('Invalid reservation ID');
  }

  return this.findById(id)
    .populate('studentId', 'name email')     // optional
    .populate('laboratory', 'name') // optional
    .exec();
};


/**
 * Get a single reservation by ID
 */
reservationSchema.statics.getReservationById = async function (id) {
  const res = await this.findById(id)
    .populate('laboratory', 'name openTime closeTime')
    .populate('studentId', 'name email')
    .lean();
  if (!res) throw new Error('Reservation not found');
  return res;
};

reservationSchema.statics.getUpcomingReservationsByUser = async function (userId) {
  try {
    const today = new Date().toISOString().split('T')[0];

    const reservations = await this.find({
      studentId: userId,
      date: { $gte: today }
    })
      .populate('laboratory', 'name')
      .select('_id laboratory seatNumbers timeSlots date createdAt')
      .sort({ date: 1 });

    const formatDateTime = (date) => {
      const d = new Date(date);
      const pad = (n) => n.toString().padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    };

    // Group by reservation _id
    const grouped = reservations.map(res => ({
      reservationId: res._id,
      laboratory: res.laboratory?.name,
      date: res.date,
      seats: Array.isArray(res.seatNumbers) ? res.seatNumbers.join(', ') : res.seatNumbers,
      time: Array.isArray(res.timeSlots) ? res.timeSlots.join(', ') : res.timeSlots,
      dateTimeCreated: formatDateTime(res.createdAt)

    }));

    return grouped;

  } catch (err) {
    throw err;
  }
};

module.exports = mongoose.model('Reservation', reservationSchema);