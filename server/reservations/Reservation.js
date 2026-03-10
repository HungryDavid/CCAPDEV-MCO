const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true
  },
  userId: {
    type: String,
    ref: 'Student',
    default: null
  },
  anonymous: {
    type: Boolean,
    default: false
  },
  labId: {
    type: String,
    ref: 'Laboratory',
    required: true
  },
  reservationDate: {
    type: String, // format: 'YYYY-MM-DD'
    required: true
  },
  timeSlots: [{
    type: String,
    required: true
  }],
  seatNumbers: [{
    type: Number,
    required: true
  }],
  status: {
    type: String,
    enum: ['active', 'cancelled', 'completed'],
    default: 'active'
  },
  reservedAt: {
    type: Date,
    default: Date.now
  },
  walkInStudent: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

reservationSchema.index({ 
  labId: 1, 
  reservationDate: 1, 
});

reservationSchema.statics.createReservation = async function(reservationData) {
  return this.create(reservationData);
};

reservationSchema.statics.updateReservation = async function(reservationId, updateData) {
  return this.findByIdAndUpdate(reservationId, updateData, {
    new: true,
    runValidators: true
  });
};

reservationSchema.statics.deleteReservation = async function(reservationId) {
  const res = await this.findByIdAndDelete(reservationId);
  if (!res) throw new Error('Reservation not found');
  return res;
};

reservationSchema.statics.getReservations = function(filter = {}) {
  return this.find(filter)
    .populate('labId', 'name openTime closeTime')
    .populate('userId', 'name email')
    .lean();
};

reservationSchema.statics.getReservationById = async function(id) {
  const res = await this.findById(id)
    .populate('labId', 'name openTime closeTime')
    .populate('userId', 'name email')
    .lean();
  if (!res) throw new Error('Reservation not found');
  return res;
};

module.exports = mongoose.model('Reservation', reservationSchema);