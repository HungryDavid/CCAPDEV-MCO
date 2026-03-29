const mongoose = require('mongoose');
const CustomError = require('../util/CustomError');
const {minutesToTime } = require('../util/helpers');

const reservationSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
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
    type: String,
    required: true
  },
  slots: [
    {
      seatNumber: { type: Number, required: true },
      startTime: { type: Number, min: 0, max: 1439 },
      endTime: { type: Number, min: 0, max: 1439 }
    }
  ],
  createdAt: { type: Date, default: Date.now }
});


// Get all reservations for a user
reservationSchema.statics.getAllUserReservation = async function (userId) {
  const reservation = await this.find({ studentId: userId }).populate('laboratory').lean();
  return reservation;
};

// Get all public reservations for a user (anonymous)
reservationSchema.statics.getUserPublicReservation = async function (userId) {
  const reservation = await this.find({ studentId: userId, anonymous: false }).populate('laboratory').lean();
  return reservation;
};

//Get all past reservations for a user
reservationSchema.statics.getUserPastReservations = async function (userId) {
  try {

    const now = new Date();
    const currentMinutes = (now.getHours() * 60) + now.getMinutes()
    const todayStr = now.toISOString().split('T')[0];

    return pastReservations = await this.find({
      studentId: userId,
      $or: [
        { date: { $lt: todayStr } }, 
        {
          $and: [
            { date: todayStr },
            { 'slots.startTime': { $not: { $gt: currentMinutes } } }
          ]
        }
      ]
    }).populate('laboratory').lean();

  } catch (err) {
    throw new CustomError(500, 'Internal Server Error', 'Failed to fetch past reservations.');
  }
};

//Get all upcoming reservations for a user
reservationSchema.statics.getUpcomingUserReservations = async function (userId) {
  try {
    const now = new Date();
    const currentMinutes = (now.getHours() * 60) + now.getMinutes();

    const todayStr = now.toISOString().split('T')[0];

    return reservations = await this.find({
      studentId: userId,
      $or: [
        { date: { $gt: todayStr } }, 
        {
          date: todayStr,
          'slots.startTime': { $gt: currentMinutes } 
        }
      ]
    }).populate('laboratory', 'name').lean();

  } catch (err) {
    console.error("Error fetching upcoming reservations:", err);
  }
};

// Get Check Cart Status for a specific lab, date, and time
reservationSchema.statics.checkCartStatus = async function (labName, date, checkList) {
  const lab = await mongoose.model('Laboratory').findOne({ name: labName });
  if (!lab) throw new Error("Laboratory not found");

  const existingReservations = await this.find({
    laboratory: lab._id,
    date: date
  }).lean();

  const now = new Date();
  const currentMinutes = (now.getHours() * 60) + now.getMinutes();

  const isToday = new Date(date).toDateString() === now.toDateString();

  const results = { ...checkList };

  for (const timeKey in results) {
    const seatToCheck = Number(results[timeKey].seatNumber);
    const startTimeToCheck = Number(timeKey);

    if (isToday && currentMinutes > (startTimeToCheck + 29)) {
      results[timeKey].status = "Expired";
      continue; // Skip DB check if it's already expired
    }

    const isReserved = existingReservations.some(res =>
      res.slots.some(slot =>
        slot.seatNumber === seatToCheck &&
        startTimeToCheck >= slot.startTime &&
        startTimeToCheck < slot.endTime
      )
    );

    results[timeKey].status = isReserved ? "Reserved" : "Available";
  }

  return results;
};


// Check if the user already reserved a seat for the same lab, date, and time
reservationSchema.statics.checkUserReservationConflict = async function (userId, date, slots, operation='create') {
  for (const slot of slots) {
    console.log(`Checking reservation conflict for student ${userId} on ${date} at ${slot.startTime} minutes...`);
    const existing = await this.findOne({
      studentId: userId,
      date: date,
      slots: {
        $elemMatch: {
          startTime: { $eq: slot.startTime }, 
        }
      }
    }).populate('laboratory', 'name'); 

    if (existing) {
      if(existing.studentId && existing.studentId.toString() === userId.toString() && operation==='update')
        continue;
      else {
        let formattedTime = minutesToTime(existing.slots[0].startTime);
        throw new CustomError(409, 'Conflict', `User already has a reservation on ${date}, at ${formattedTime} in Lab ${existing.laboratory.name}, Seat ${existing.slots[0].seatNumber}.`
      );
      }
        
    }
  }
};

//Check if any of the selected seats are already reserved for the same lab, date, and time
reservationSchema.statics.checkSeatAvailabilityConflict = async function (userId, labId, date, slots) {
  for (const slot of slots) {
    
    const existingConflict = await this.findOne({
      laboratory: labId,
      date: date,
      slots: {
        $elemMatch: {
          seatNumber: slot.seatNumber,
          startTime: { $eq: slot.startTime }, 
        }
      }
    });

    if (existingConflict) {

      if (existingConflict.studentId && existingConflict.studentId.toString() === userId.toString()) {
        continue; 
      } else {
        throw new CustomError(409, 'Conflict', `One or more seats in your selection are already reserved.`);
      }
      
    }
  }

  return true;
};

// Get a reservation by ID
reservationSchema.statics.getReservationById = async function (reservationId) {
  if (!reservationId) {
    throw new CustomError(400, 'BadRequest', 'Reservation ID is required.');
  }
  const reservation = await this.findById(reservationId).populate('laboratory').lean();

  if (!reservation) {
    throw new CustomError(404, 'NotFound', 'Reservation not found.');
  }
  return reservation;
};

// Create a new reservation
reservationSchema.statics.createReservation = async function (studentId, isAnonymous, labId, date, slots) {
  if (!labId || !date || !Array.isArray(slots) || slots.length === 0) {
    throw new CustomError(400, 'BadRequest', "Missing labId, date, or reservation slots.");
  }

  await this.checkUserReservationConflict(studentId, date, slots, 'create');
  await this.checkSeatAvailabilityConflict(studentId, labId, date, slots);

  return this.create({
    studentId,
    anonymous: isAnonymous,
    laboratory: labId,
    date,
    slots
  });
};

// Delete a reservation by ID
reservationSchema.statics.deleteReservation = async function (reservationId) {
  if (!reservationId) {
    throw new CustomError(400, 'BadRequest', 'Reservation ID is required for deletion.');
  }

  const deleted = await this.findByIdAndDelete(reservationId);

  if (!deleted) {
    throw new CustomError(404, 'NotFound', 'Reservation not found or already deleted.');
  }
  return deleted;
};


//update a reservation
reservationSchema.statics.updateReservation = async function (reservationId, slots, isAnonymous) {
  try {
  
    const reservation = await this.findById(reservationId);
    if (!reservation) {
      throw new CustomError(404, 'Not Found', 'Reservation not found.');
    }

    await this.checkUserReservationConflict(reservation.studentId, reservation.date, slots, 'update');
    await this.checkSeatAvailabilityConflict(reservation.studentId, reservation.laboratory, reservation.date, slots);

    return await this.findByIdAndUpdate(reservationId, {
      isAnonymous: isAnonymous,
      slots: slots
    }, { new: true, runValidators: true });

  } catch (error) {
    throw error;
  }
};

//Get reservation id
reservationSchema.statics.getReservationIdByLabNameDateTimeSeat = async function (labName, date, startTime, seatNumber) {
  if (!labName || !date || startTime === undefined || seatNumber === undefined) {
    throw new Error('labName, date, startTime, and seatNumber are required');
  }

  const lab = await mongoose.model('Laboratory').findOne({ name: labName });
  if (!lab) {
    return null; 
  }

  const reservation = await this.findOne({
    laboratory: lab._id,
    date: date,
    slots: {
      $elemMatch: { 
        startTime: Number(startTime), 
        seatNumber: Number(seatNumber) 
      }
    }
  }).select('_id');

  return reservation ? reservation._id : null;
};

module.exports = mongoose.model('Reservation', reservationSchema);