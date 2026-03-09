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
    type: String,  // Add open time for each lab
    required: [true, 'A lab must have an open time']
  },
  closeTime: {
    type: String,  // Add close time for each lab
    required: [true, 'A lab must have a close time']
  }, deleted: {
    type: Boolean,
    default: false,
    select: false, // hide by default
  },
  deletedAt: {
    type: Date,
    select: false,
  }, 
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
  return this.findOne({ name, deleted: false });
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

  return this.find(filterData).lean();  // Return all labs based on the filterData
};

// Static Method: Get one lab by ID
laboratorySchema.statics.getLabById = async function (id) {
  return await this.findById(id);
};

laboratorySchema.statics.updateLab = function (id, updateData) {
  return this.findByIdAndUpdate(id, updateData, {
    new: true, // return updated document
    runValidators: true, // validate updates
  });
};

// Static Method: Delete a lab by ID
laboratorySchema.statics.deleteLab = function (id) {
  return this.findByIdAndUpdate(
    id,
    { deleted: true, deletedAt: Date.now() },
    { new: true }
  );
};

module.exports = mongoose.model('Laboratory', laboratorySchema);



