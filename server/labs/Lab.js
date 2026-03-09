const mongoose = require('mongoose');
const Reservation = require('../reservations/Reservation'); // adjust the path to your model

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

laboratorySchema.statics.generateFlattenedSeats = async function(lab, timeSlots, selectedDate) {
  // Fetch reservations for this lab on the selected date
  const reservations = await Reservation.find({
    laboratory: lab._id,
    date: selectedDate
  }).lean();

  const flattenedSeats = [];

  for (let seat = 1; seat <= lab.capacity; seat++) {
    timeSlots.forEach(time => {
      const reserved = reservations.some(
        r => r.seatNumber === seat && r.timeSlots.includes(time)
      );

      flattenedSeats.push({
        seatNumber: seat,
        time,
        reserved
      });
    });
  }

  return flattenedSeats;
};
/**
 * Check if requested slots are available
 * @param {ObjectId} labId 
 * @param {String} date 
 * @param {Array} requestedSlots 
 * @returns {Boolean}
 */

laboratorySchema.statics.areSeatsAvailable = async function(labName, date, timeSlots, seatNumbers) {
  // 1. Find the laboratory document by 'name' to get its ObjectId
  const lab = await this.findOne({ name: labName }); 
  
  if (!lab) {
    throw new Error(`Laboratory "${labName}" not found.`);
  }

  // 2. Query the Reservation model using the lab's ObjectId
  // We use mongoose.model('Reservation') to avoid circular dependency issues
  const Reservation = mongoose.model('Reservation');
  const filter = { laboratory: lab._id, date: date };
  const existingReservations = await Reservation.find(filter);

  // 3. Check for overlaps
  for (const time of timeSlots) {
    const reservedSeats = existingReservations
      .filter(r => r.timeSlots.includes(time))
      .flatMap(r => r.seatNumbers || [r.seatNumber]); // Handles both array and single number schemas

    if (seatNumbers.some(seat => reservedSeats.includes(seat))) {
      return false; 
    }
  }
  return true; 
};

module.exports = mongoose.model('Laboratory', laboratorySchema);