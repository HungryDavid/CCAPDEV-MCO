const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const validator = require('validator');
const Reservation = require('../reservations/Reservation'); // adjust path if needed
const CustomError = require('../util/CustomError');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide your name'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Please provide your DLSU email'],
      lowercase: true,
      validate: {
        validator: (val) =>
          validator.isEmail(val) && val.endsWith('@dlsu.edu.ph'),
        message: 'Email must be a valid @dlsu.edu.ph address',
      },
    },
    idNumber: {
      type: String,
      required: [true, 'ID Number is required'],
      trim: true,
      match: [/^\d{8}$/, 'ID Number must be exactly 8 digits'],
    },
    role: {
      type: String,
      enum: ['student', 'technician'],
      default: 'student',
    },
    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: 8,
      select: false,
    },
    profilePic: {
      type: String,
      default: '/imgs/portraitPlaceholder.png',
    },
    bio: {
      type: String,
      maxlength: 300,
      default: '',
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    passwordChangedAt: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

//Compound index to ensure email and ID number uniqueness
userSchema.index({ email: 1, idNumber: 1 });

//Instance method to check if the provided password matches the stored hashed password
userSchema.methods.isCorrectPassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

//Finds a user by either their email address or their unique ID number
userSchema.statics.findUserByEmailOrIdNumber = async function (email, idNumber) {
  const user = await this.findOne({
    $and: [
      { $or: [{ email }, { idNumber }] },
      { isDeleted: { $ne: true } }
    ]
  });
  return user;
};

//registers a new user in the database
userSchema.statics.createUser = async function (email, idNumber, password) {
  if (!email || !idNumber || !password) {
    throw new Error('Please fill in all fields.');
  }

  const exisitingUser = await this.findUserByEmailOrIdNumber(email, idNumber);

  if (exisitingUser) {
    const field = exisitingUser.email === email ? 'Email' : 'ID Number';
    throw new Error(`${field} is already registered.`);
  }

  const role = 'student';

  const name = email
    .split('@')[0]
    .split(/[._]/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');


  const newUser = await this.create({ email, idNumber, password, name, role, });

  return newUser;
};

//logins a user by checking if the provided email/ID and password match a record in the database
userSchema.statics.loginUser = async function (identifier, password) {
  if (!identifier || !password) {
    throw new Error('Please provide both email/ID and password');
  }

  const query = identifier.includes('@')
    ? { email: identifier.toLowerCase() }
    : { idNumber: identifier };
    
  query.isDeleted = { $ne: true };

  const user = await this.findOne(query).select('+password');

  if (!user) {
    throw new Error('User does not exist');
  }

  const isMatch = await user.isCorrectPassword(password);

  if (!isMatch) {
    throw new Error('Invalid credentials');
  }

  return user;
};

//deletes a user from the database and also deletes all reservations associated with that user
userSchema.statics.deleteUser = async function (userId) {
  if (!userId) {
    throw new CustomError(400, 'Bad Request', 'User ID is required.');
  }

  const user = await this.findById(userId);

  if (!user) {
    throw new CustomError(404, 'Not Found', 'User not found.');
  }

  const now = new Date();
  const currentMinutes = (now.getHours() * 60) + now.getMinutes()
  const todayStr = now.toISOString().split('T')[0];

  await Reservation.deleteMany({
    studentId: user._id,
    $or: [
      { date: { $gt: todayStr } },
      {
        date: todayStr,
        'slots.endTime': { $gt: currentMinutes }
      }
    ]
  });
  
  user.isDeleted = true;
  await user.save();
  return true;
};

//fetches a user by their unique ID and excludes sensitive information like password and role
userSchema.statics.searchUser = async function (identifier) {
  if (!identifier) {
    throw new Error('User ID or email is required.');
  }

  const query = identifier.includes('@')
    ? { email: identifier.toLowerCase() }
    : { idNumber: identifier };

  query.isDeleted = { $ne: true };

  return await this.findOne(query).select('-password -role').lean();
};

//fetches a user by their unique ID and excludes sensitive information like password and role
userSchema.statics.getUserById = async function (id) {
  return await this.findOne({ 
    _id: id, 
    isDeleted: { $ne: true } 
  })
  .select('-password')
  .lean();
};

//updates a user's profile information such as their bio and profile picture
userSchema.methods.updateUser = async function (bio, filePath) {
  if (bio) this.bio = bio;
  if (filePath) {
    this.profilePic = filePath;
  }
  return await this.save();
};

//get user by student Id
userSchema.statics.getUserByStudentId = async function (studentId) {
  try {
    const user = await this.findOne({ 
      idNumber: studentId, 
      isDeleted: { $ne: true } 
    });

    if (!user) {
      return null;
    }
    
    return user;
  } catch (err) {
    throw err; 
  }
};

const User = mongoose.model('User', userSchema);
module.exports = User; 