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
    console.log('Time Slots:', timeSlots);
    console.log('Requested Seats:', seatNumbers);

    // 1. Find the laboratory document by 'name' to get its ObjectId
    const lab = await this.findOne({ name: labName });
    if (!lab) {
      console.log('Lab not found');
      throw new Error(`Laboratory "${labName}" not found.`);
    }
    console.log('Lab found:', lab._id.toString(), 'Capacity:', lab.capacity);

    // 2. Query the Reservation model using the lab's ObjectId
    const Reservation = mongoose.model('Reservation');
    const filter = { laboratory: lab._id, date: date };
    const existingReservations = await Reservation.find(filter);
    console.log('Existing Reservations:', existingReservations.length);

    // 3. Check for overlaps
    for (const time of timeSlots) {
      console.log(`Checking time slot: ${time}`);
      const reservedSeats = existingReservations
        .filter(r => r.timeSlots.includes(time))
        .flatMap(r => r.seatNumbers || [r.seatNumber]);
      console.log(`Reserved seats for time ${time}:`, reservedSeats);

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

/**
 * Get available laboratories for a single date and time with available seat count and building image
 * @param {String} bookingDate - Date of booking (YYYY-MM-DD)
 * @param {String} bookingTime - Single time slot (e.g., "09:00")
 * @param {Array|null} rooms - Optional array of lab names to filter; if null or empty, return all labs
 * @returns {Array} - List of available labs with freeSeats and image
 */
laboratorySchema.statics.getAvailableLabs = async function (bookingDate, bookingTime, rooms = null) {
  const Reservation = mongoose.model('Reservation');

  // 1. Filter labs if rooms array is provided and not empty
  let labFilter = {};
  if (Array.isArray(rooms)) {
    // Remove null or empty strings
    const filteredRooms = rooms.filter(r => r);
    if (filteredRooms.length > 0) {
      labFilter.name = { $in: filteredRooms };
    }
  }

  const labs = await this.find(labFilter).lean();
  if (!labs.length) return [];

  const labIds = labs.map(lab => lab._id);

  // 2. Find reservations on the date for these labs
  const reservations = await Reservation.find({
    laboratory: { $in: labIds },
    date: bookingDate
  }).lean();

  // 3. Map labs to available seats and assign building image
  const availableLabs = labs.map(lab => {
    const labReservations = reservations.filter(r => r.laboratory.toString() === lab._id.toString());

    // Get all reserved seats for this time slot
    const reservedSeats = labReservations.flatMap(r => r.timeSlots.includes(bookingTime)
      ? (r.seatNumbers || [r.seatNumber])
      : []
    );

    const freeSeats = lab.capacity - reservedSeats.length;

    // Assign image based on lab name prefix
    let image = lab.image || 'lab-default.jpg';
    if (lab.name.startsWith("GK")) {
      image = "/imgs/gk-building.jpg";
    } else if (lab.name.startsWith("LS")) {
      image = "/imgs/ls-building.png";
    } else if (lab.name.startsWith("VL")) {
      image = "/imgs/vl-building.jpg";
    }

    return {
      ...lab,
      freeSeats,
      image
    };
  }).filter(lab => lab.freeSeats > 0); // only include labs with available seats

  console.log(availableLabs);
  return availableLabs;
};


laboratorySchema.statics.getLabSeats = async function(labName, timeSlot, date) {
  try {
    // 1. Validate Date
    const currentDate = moment(); // current date
    const inputDate = moment(date); // user's selected date

    // Check if the selected date is a valid date
    if (!inputDate.isValid()) {
      throw new CustomError(400, 'Bad Request', 'The date format is invalid.');
    }

    // Ensure that the selected date is within the next 7 days from today
    const sevenDaysFromNow = moment().add(7, 'days'); // 7 days from current date
    if (inputDate.isBefore(currentDate, 'day') || inputDate.isAfter(sevenDaysFromNow, 'day')) {
      throw new CustomError(400, 'Bad Request', 'Booking date must be within the next 7 days.');
    }

    // 2. Validate Time Slot (ensure it's in HH:mm format)
    const timeSlotRegex = /^([01]\d|2[0-3]):([0-5]\d)$/; // Regular expression for 24-hour time format (HH:mm)
    if (timeSlot && !timeSlotRegex.test(timeSlot)) {
      throw new CustomError(400, 'Bad Request', 'Invalid time format. Expected HH:mm.');
    }

    // 3. Proceed with fetching lab details
    const lab = await this.findOne({ name: labName });
    if (!lab) {
      throw new CustomError(404, 'Not Found', 'Lab not found.');
    }

    // Correct query for timeSlots (array)
    const query = { laboratory: lab._id, date: date };
    if (timeSlot) query.timeSlots = { $in: [timeSlot] };

    const reservations = await Reservation.find(query).populate({
      path: 'studentId',
      model: 'User',
      select: 'name'
    });

    // 4. Build seat map
    const seatMap = new Map();
    reservations.forEach(res => {
      res.seatNumbers.forEach(seat => {
        seatMap.set(seat.toString(), { // normalize
          user: res.anonymous
            ? { name: 'Anonymous', id: null }
            : { name: res.studentId?.name || 'Unknown', id: res.studentId?._id || null },
          status: 'reserved'
        });
      });
    });

    // 5. Build seat status array
    const seatStatus = [];
    for (let seat = 1; seat <= lab.capacity; seat++) {
      const seatStr = seat.toString();
      if (seatMap.has(seatStr)) {
        seatStatus.push({
          seatNumber: seat,
          user: seatMap.get(seatStr).user,
          status: 'reserved'
        });
      } else {
        seatStatus.push({
          seatNumber: seat,
          user: { name: null, id: null },
          status: 'available'
        });
      }
    }

    console.log(labName);
    console.log(date);
    console.log(timeSlot);
    console.log(seatStatus);
    return seatStatus;

  } catch (err) {
    if (err instanceof CustomError) {
      throw err; // Re-throw the custom error to be handled at the API level or UI
    } else {
      throw new CustomError(500, 'InternalServerError', 'Failed to fetch lab slot status');
    }
  }
};


module.exports = mongoose.model('Laboratory', laboratorySchema);