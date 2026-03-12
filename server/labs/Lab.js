const mongoose = require('mongoose');
const Reservation = require('../reservations/Reservation'); // adjust the path to your model
const moment = require('moment'); // You can use moment.js for easier date handling
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

// Check if lab exists
laboratorySchema.statics.doesLabExist = function (name) {
  return this.findOne({ name });
};

// Create a new lab
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

// Get all labs
laboratorySchema.statics.getAllLabs = function (queryObj) {
  const excludedFields = ['page', 'sort', 'limit', 'fields'];
  const filterData = { ...queryObj };
  excludedFields.forEach(el => delete filterData[el]);

  return this.find(filterData).lean();
};

// Get one lab by ID
laboratorySchema.statics.getLabById = async function (id) {
  // Use lean() to return a plain JavaScript object
  return await this.findById(id).lean();
};

// Update lab by ID
laboratorySchema.statics.updateLab = function (id, updateData) {
  return this.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
  });
};

// **Hard delete lab by ID**
laboratorySchema.statics.deleteLab = function (id) {
  return this.findByIdAndDelete(id);
};

laboratorySchema.statics.getIdByName = async function (labName) {
  const lab = await this.findOne({ name: labName }).select('_id'); // Only select _id
  if (!lab) {
    throw new Error(`Lab with name "${labName}" not found`);
  }
  return await lab._id; // Return the ObjectId
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
    console.log('--- areSeatsAvailable Debug ---');
    console.log('Lab Name:', labName);
    console.log('Date:', date);
    console.log('Requested Time Slots:', timeSlots);
    console.log('Requested Seats:', seatNumbers);

    // 1️⃣ Find the laboratory
    const lab = await this.findOne({ name: labName });
    if (!lab) throw new Error(`Laboratory "${labName}" not found.`);
    console.log('Lab found:', lab._id.toString(), 'Capacity:', lab.capacity);

    // 2️⃣ Query reservations for that lab & date
    const Reservation = mongoose.model('Reservation');
    const existingReservations = await Reservation.find({ laboratory: lab._id, date });
    console.log('Existing Reservations:', existingReservations.length);

    // 3️⃣ Check each requested time slot for seat conflicts
    for (const time of timeSlots) {
      console.log(`Checking time slot: ${time}`);

      // Get all seats already reserved at this time
      const reservedSeats = existingReservations
        .flatMap(r => r.slots
          .filter(s => s.timeSlot === time)
          .map(s => s.seatNumber)
        );

      console.log(`Reserved seats for time ${time}:`, reservedSeats);

      // Check if any requested seat is already taken
      const conflict = seatNumbers.some(seat => reservedSeats.includes(seat));
      if (conflict) {
        console.log(`Conflict found for seats ${seatNumbers} at time ${time}`);
        return false;
      }
    }

    console.log('No conflicts found. Seats are available.');
    return true;
  } catch (err) {
    console.error('Error in areSeatsAvailable:', err);
    throw err;
  }
};

laboratorySchema.statics.getAvailableLabs = async function (bookingDate, bookingTime, rooms = null) {
  const Reservation = mongoose.model("Reservation");

  // 1️⃣ Filter labs if rooms array is provided
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

  // 2️⃣ Find reservations for the date
  const reservations = await Reservation.find({
    laboratory: { $in: labIds },
    date: bookingDate
  }).lean();

  // 3️⃣ Process labs
  const availableLabs = labs.map(lab => {
    // Check if bookingTime is within lab operating hours
    const open = moment(lab.openTime, "HH:mm");
    const close = moment(lab.closeTime, "HH:mm");
    const booking = moment(bookingTime, "HH:mm");

    if (!booking.isBetween(open, close, undefined, "[)")) {
      return null; // booking time not within lab schedule
    }

    // Reservations for this lab
    const labReservations = reservations.filter(
      r => r.laboratory.toString() === lab._id.toString()
    );

    // Collect reserved seats at the specific bookingTime
    const reservedSeats = labReservations.flatMap(r =>
      r.slots
        .filter(s => s.timeSlot === bookingTime)
        .map(s => s.seatNumber)
    );

    const freeSeats = lab.capacity - reservedSeats.length;

    // Assign building image
    let image = lab.image || "lab-default.jpg";
    if (lab.name.startsWith("GK")) image = "/imgs/gk-building.jpg";
    else if (lab.name.startsWith("LS")) image = "/imgs/ls-building.png";
    else if (lab.name.startsWith("VL")) image = "/imgs/vl-building.jpg";

    return {
      ...lab,
      freeSeats,
      image
    };
  })
  .filter(lab => lab && lab.freeSeats > 0); // remove null + full labs

  return availableLabs;
};

laboratorySchema.statics.getLabSeats = async function(labName, timeSlot, date) {
  const lab = await this.findOne({ name: labName });
  if (!lab) throw new CustomError(404, 'Not Found', 'Lab not found.');

  const query = { laboratory: lab._id, date };
  if (timeSlot) query["slots.timeSlot"] = timeSlot;

  const reservations = await Reservation.find(query).populate({ path: 'studentId', select: 'name' });

  const seatMap = new Map();
  reservations.forEach(res => {
    res.slots.forEach(slot => {
      if (!timeSlot || slot.timeSlot === timeSlot) {
        seatMap.set(slot.seatNumber.toString(), {
          user: res.anonymous
            ? { name: 'Anonymous', id: null }
            : { name: res.studentId?.name || 'Unknown', id: res.studentId?._id || null },
          status: 'reserved'
        });
      }
    });
  });

  const seatStatus = [];
  for (let seat = 1; seat <= lab.capacity; seat++) {
    const seatStr = seat.toString();
    seatStatus.push({
      seatNumber: seat,
      user: seatMap.get(seatStr)?.user || { name: null, id: null },
      status: seatMap.get(seatStr)?.status || 'available'
    });
  }


  return seatStatus;
};


module.exports = mongoose.model('Laboratory', laboratorySchema);