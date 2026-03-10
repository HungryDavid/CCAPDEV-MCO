const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Import DB arrays and connection function
const { connectDB, users, labs, reservations } = require('./config/db');

// Import Mongoose models
const User = require('./users/User');
const Lab = require('./labs/Lab');
const Reservation = require('./reservations/Reservation');

const seedData = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    // ───── USERS ─────
    console.log('Adding Users...');
    for (let u of users) {
      // Skip deleted accounts
      if (u.accountStatus === 'deleted') continue;

      // Check if user already exists
      const existing = await User.findOne({ $or: [{ email: u.email }, { _id: u._id }] });
      if (existing) continue;

      const newUser = new User({
          _id: u._id,
          name: `${u.profile.firstName} ${u.profile.lastName}`,
          email: u.email,
          password: u.password, // This is your '$2b$12$...' hash from config
          role: u.role,
          profilePic: u.profile.profilePicture,
          bio: u.profile.description
      });

      newUser.isAlreadyHashed = true; 

      await newUser.save();
    }

    // ───── LABS ─────
    console.log('Adding Labs...');
    for (let l of labs) {
      const existingLab = await Lab.findById(l._id);
      if (existingLab) continue;

      await Lab.create(l);
    }

    // ───── RESERVATIONS ─────
    console.log('Adding Reservations...');
    for (let r of reservations) {
      const existingRes = await Reservation.findById(r._id);
      if (existingRes) continue;

      await Reservation.create({
        _id: r._id,
        userId: r.userId,        
        labId: r.labId,         
        seatNumbers: [r.seatNumber],             
        reservationDate: r.reservationDate,
        timeSlots: [r.timeSlotStart, r.timeSlotEnd], 
        anonymous: r.isAnonymous,               
        status: r.status,
        walkInStudent: r.walkInStudent || null
      });
    }

    console.log('Complete!');
  } catch (err) {
    console.error('Adding Error:', err);
    process.exit(1);
  }
};

module.exports = { seedData };