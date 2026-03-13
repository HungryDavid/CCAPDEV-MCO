const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const validator = require('validator');

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
      unique: true,
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
      unique: true,
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
    isPrivate: {
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

userSchema.virtual('reservations', {
  ref: 'Reservation',
  foreignField: 'User',
  localField: '_id',
});

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.index({ email: 1, idNumber: 1 });


userSchema.statics.doesUserExist = async function (email, idNumber) {
  const user = await this.findOne({
    $or: [{ email }, { idNumber }],
  });
  return user;
};

userSchema.methods.isCorrectPassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};


userSchema.statics.createUser = async function (userData) {
  const { email, idNumber, password } = userData;

  if (!email || !idNumber || !password) {
    throw new Error('Please fill in all fields.');
  }

  const exisitingUser = await this.doesUserExist(email, idNumber);

  if (exisitingUser) {
    const field = exisitingUser.email === email ? 'Email' : 'ID Number';
    throw new Error(`${field} is already registered.`);
  }

  const role = email.toLowerCase().includes('technician') ? 'technician' : 'student';

  const name = email
    .split('@')[0]
    .split(/[._]/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');


  const newUser = await this.create({
    ...userData,
    name,
    role,
  });

  return newUser;
};

userSchema.statics.readUserByIdSafe = function (userId) {
  if (!userId) {
    throw new Error('User ID is required.');
  }

  return this.findById(userId).select('-password');
};

userSchema.statics.readUserByEmailSafe = async function (query) {
  return await this.find({
    email: { $regex: query, $options: 'i' }
  }).select('-password');
};

userSchema.statics.readUserByEmailWithPassword = async function (email) {
  if (!email) {
    throw new Error('Email is required.');
  }

  return await this.findOne(email).select('+password');
};

userSchema.methods.updateUser = async function (data, filePath) {
  if (data.bio) this.bio = data.bio;
  if (filePath) {
    this.profilePic = filePath;
  }
  return await this.save();
};


userSchema.statics.deleteUser = async function (userId) {
  if (!userId) {
    throw new Error('User ID is required.');
  }

  const user = await this.readUserById(userId);

  if (!user) {
    throw new Error('User not found.');
  }

  await user.deleteOne();
  return true;
};


userSchema.statics.loginUser = async function (identifier, password) {
  if (!identifier || !password) {
    throw new Error('Please provide both email/ID and password');
  }

  const query = identifier.includes('@')
    ? { email: identifier.toLowerCase() }
    : { idNumber: identifier };

  const user = await this.findOne(query).select('+password');
  if (!user) {
    throw new Error('Invalid credentials');
  }

  const isMatch = await user.isCorrectPassword(password);
  if (!isMatch) {
    throw new Error('Invalid credentials');
  }

  return user;
};


userSchema.statics.readUserSafeAndPublic = async function (identifier) {
  if (!identifier) {
    throw new Error('ID number or email is required.');
  }

  const baseQuery = {
    $or: [
      { email: identifier.toLowerCase() },
      { idNumber: identifier }
    ]
  };
  const privacyCheck = await this.findOne(baseQuery).select('isPrivate');

  if (!privacyCheck) {
    throw new Error('User not found.');
  }

  if (privacyCheck.isPrivate) {
    return await this.findOne(baseQuery)
      .select('name profilePic isPrivate');
  }
  return await this.findOne(baseQuery)
    .select('-password');
};

userSchema.statics.getIdByStudentId = async function (idNumber) {
  if (!idNumber) {
    throw new Error('Student ID is required.');
  }

  const user = await this.findOne({ idNumber }).select('_id');

  if (!user) {
    throw new Error('User not found.');
  }

  return user._id;
};

const User = mongoose.model('User', userSchema);
module.exports = User; 