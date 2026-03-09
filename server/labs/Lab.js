const mongoose = require('mongoose');

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
  return await this.findById(id);
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

module.exports = mongoose.model('Laboratory', laboratorySchema);