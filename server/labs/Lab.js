const mongoose = require('mongoose');
const Reservation = require('../reservations/Reservation'); 
const moment = require('moment'); 
const CustomError = require('../util/CustomError');

const laboratorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'A lab must have a name'],
    unique: true,
    trim: true
  },
  capacity: {
    type: Number,
    required: [true, 'A lab must have a total number of seats'],
    min: [1, 'Lab must have at least one seat']
  },
  image: {
    type: String,
    default: 'lab-default.jpg'
  },
  openTime: {
    type: String,
    required: [true, 'A lab must have an open time']
  },
  closeTime: {
    type: String,
    required: [true, 'A lab must have a close time']
  }
},
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  });

// Virtual: Get all reservations for this lab
laboratorySchema.virtual('reservations', {
  ref: 'Reservation',
  foreignField: 'laboratory',
  localField: '_id'
});

laboratorySchema.statics.doesLabExist = function (name) {
  return this.findOne({ name });
};

laboratorySchema.statics.createLab = async function (labData) {
  if (!labData.name) {
    throw new Error("Lab name is required");
  }

  const existingLab = await this.findOne({ name: labData.name });
  if (existingLab) {
    throw new Error("Laboratory already exists");
  }

  return await this.create(labData);
};

laboratorySchema.statics.getAllLabs = function (queryObj) {
  const excludedFields = ['page', 'sort', 'limit', 'fields'];
  const filterData = { ...queryObj };
  excludedFields.forEach(el => delete filterData[el]);

  return this.find(filterData).lean();
};

laboratorySchema.statics.getLabById = async function (id) {
  // Use lean() to return a plain JavaScript object
  return await this.findById(id).lean();
};

laboratorySchema.statics.updateLab = function (id, updateData) {
  return this.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
  });
};

laboratorySchema.statics.deleteLab = function (id) {
  return this.findByIdAndDelete(id);
};

laboratorySchema.statics.getIdByName = async function (labName) {
  const lab = await this.findOne({ name: labName }).select('_id'); // Only select _id
  if (!lab) {
    throw new Error(`Lab with name "${labName}" not found`);
  }
  return await lab._id; 
};


/**
 * Check if requested slots are available
 * @param {ObjectId} labId 
 * @param {String} date 
 * @param {Array} requestedSlots 
 * @returns {Boolean}
 */
laboratorySchema.statics.areSeatsAvailable = async function (labName, date, timeSlots, seatNumbers) {
  try {
    const lab = await this.findOne({ name: labName });
    if (!lab) throw new Error(`Laboratory "${labName}" not found.`);

    const Reservation = mongoose.model('Reservation');
    const existingReservations = await Reservation.find({ laboratory: lab._id, date });

    for (const time of timeSlots) {
      // Get all seats already reserved at this time
      const reservedSeats = existingReservations
        .flatMap(r => r.slots
          .filter(s => s.timeSlot === time)
          .map(s => s.seatNumber)
        );

      const conflict = seatNumbers.some(seat => reservedSeats.includes(seat));
      if (conflict) {
        return false;
      }
    }
    return true;
  } catch (err) {
    throw err;
  }
};

laboratorySchema.statics.getAvailableLabs = async function (bookingDate, bookingTime, rooms = null) {
  const Reservation = mongoose.model("Reservation");

  let labFilter = {};
  if (Array.isArray(rooms)) {
    const filteredRooms = rooms.filter(r => r);
    if (filteredRooms.length > 0) {
      labFilter.name = { $in: filteredRooms };
    }
  }

  const labs = await this.find(labFilter).lean();
  if (!labs.length) return [];

  const labIds = labs.map(lab => lab._id);

  const reservations = await Reservation.find({
    laboratory: { $in: labIds },
    date: bookingDate
  }).lean();

  const availableLabs = labs.map(lab => {
    const open = moment(lab.openTime, "HH:mm");
    const close = moment(lab.closeTime, "HH:mm");
    const booking = moment(bookingTime, "HH:mm");

    if (!booking.isBetween(open, close, undefined, "[)")) {
      return null; 
    }

    const labReservations = reservations.filter(
      r => r.laboratory.toString() === lab._id.toString()
    );

    const reservedSeats = labReservations.flatMap(r =>
      r.slots
        .filter(s => s.timeSlot === bookingTime)
        .map(s => s.seatNumber)
    );

    const freeSeats = lab.capacity - reservedSeats.length;

    let image = lab.image || "lab-default.jpg";
    if (lab.name.startsWith("GK")) image = "/imgs/gk-building.jpg";
    else if (lab.name.startsWith("LS")) image = "/imgs/ls-building.png";
    else if (lab.name.startsWith("VL")) image = "/imgs/vl-building.jpg";
    else if (lab.name.startsWith("AG")) image = "/imgs/ag-building.jpg";
    else image = "/imgs/logo.png";

    return {
      ...lab,
      freeSeats,
      image
    };
  })
  .filter(lab => lab && lab.freeSeats > 0); 

  return availableLabs;
};

laboratorySchema.statics.getLabSeats = async function(labName, timeSlot, date) {
  const lab = await this.findOne({ name: labName });
  if (!lab) throw new CustomError(404, 'Not Found', 'Lab not found.');

  const query = { laboratory: lab._id, date };
  if (timeSlot) query["slots.timeSlot"] = timeSlot;

  const reservations = await Reservation.find(query).populate({ 
    path: 'studentId', 
    select: 'name idNumber' 
  });

  const seatMap = new Map();
  reservations.forEach(res => {
  res.slots.forEach(slot => {
    if (!timeSlot || slot.timeSlot === timeSlot) {

      let user;

      if (res.anonymous) {
        user = {
          name: 'Anonymous',
          id: null,
          idNumber: null
        };
      } else {
        user = {
          name: res.studentId?.name || 'Unknown',
          id: res.studentId?._id || null,
          idNumber: res.studentId?.idNumber || null
        };
      }

      seatMap.set(slot.seatNumber.toString(), {
        user,
        status: 'reserved'
      });

    }
  });
});

  const seatStatus = [];
  for (let seat = 1; seat <= lab.capacity; seat++) {
    const seatStr = seat.toString();
    let status = seatMap.get(seatStr)?.status || 'available';

    if (timeSlot) {
      const slotMoment = moment(`${date} ${timeSlot}`, 'YYYY-MM-DD HH:mm');
      if (slotMoment.isBefore(new Date())) {
        status = 'expired';
      }
    }

    seatStatus.push({
      seatNumber: seat,
      user: seatMap.get(seatStr)?.user || { name: null, id: null, idNumber: null }, 
      status
    });
  }
  return seatStatus;
  
};

module.exports = mongoose.model('Laboratory', laboratorySchema);