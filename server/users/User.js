const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const validator = require('validator');

// Define the user schema
const userSchema = new mongoose.Schema(
  {
    // User's ID number (should be 8 digits)
    _id: {
      type: String,
      required: true,
      trim: true,
      match: [/^\d{8}$/, 'ID Number must be exactly 8 digits']
    },
    // User's full name
    name: {
      type: String,
      required: [true, 'Please provide your name'],
      trim: true, // Remove leading/trailing spaces
    },
    // User's email address
    email: {
      type: String,
      required: [true, 'Please provide your DLSU email'],
      unique: true, // Ensure email is unique
      lowercase: true, // Convert email to lowercase
      validate: {
        validator: (val) =>
          validator.isEmail(val) && val.endsWith('@dlsu.edu.ph'), // Validate email format & domain
        message: 'Email must be a valid @dlsu.edu.ph address',
      },
    },
    // User's role (either student or technician)
    role: {
      type: String,
      enum: ['student', 'technician'], // Only these two roles are allowed
      default: 'student', // Default role is 'student'
    },
    // User's password (hashed for security)
    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: 8, // Minimum length of 8 characters
      select: false, // Don't return the password by default
    },
    // Profile picture (default placeholder if not provided)
    profilePic: {
      type: String,
      default: '/imgs/portraitPlaceholder.png', // Default profile picture path
    },
    // Short bio of the user
    bio: {
      type: String,
      maxlength: 300, // Max length of 300 characters
      default: '',
    },
    // Privacy setting (whether the user wants to hide profile details)
    isPrivate: {
      type: Boolean,
      default: false, // Default is public
    },
    // Timestamp for when the password was last changed
    passwordChangedAt: Date,
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt fields
    toJSON: { virtuals: true }, // Include virtuals when converting to JSON
    toObject: { virtuals: true }, // Include virtuals when converting to object
  }
);

// ─── Virtuals (References to other models) ──────────────────────────────────
userSchema.virtual('reservations', {
  ref: 'Reservation', // The model being referenced
  foreignField: 'student', // Field in Reservation model that links to User
  localField: '_id', // Local field to match
});

// --- MIDDLEWARE (HOOKS) ---
// Pre-save hook to hash the password before saving the user
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

//MODEL LEVEL
userSchema.statics.doesUserExist = async function (email, idNumber) {
  const user = await this.findOne({
    $or: [{ email }, { idNumber }],
  });
  return user;
};

//DOC LEVEL
userSchema.methods.isCorrectPassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};


// --- STATIC METHODS (Business Logic) ---
userSchema.statics.createUser = async function (userData) {
  const { email, idNumber, password } = userData;

  if (!email || !idNumber || !password) {
    throw new Error('Please fill in all fields.');
  }

  // Check if email or ID number already exists
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
    _id: idNumber,
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
    email: { $regex: query, $options: 'i' } // Search for email matching query
  }).select('-password'); // Exclude password from the results
};

userSchema.statics.readUserByEmailWithPassword = async function (email) {
  if (!email) {
    throw new Error('Email is required.');
  }

  return await this.findOne(email).select('+password');
};

userSchema.methods.updateUser = async function (data, filePath) {
  if (data.bio) this.bio = data.bio; // Update bio if provided
  if (filePath) {
    this.profilePic = filePath; // Update profile picture if provided
  }
  return await this.save(); // Save the updated user data
};


userSchema.statics.deleteUser = async function (userId) {
  if (!userId) {
    throw new Error('User ID is required.');
  }

  const user = await this.readUserById(userId);

  if (!user) {
    throw new Error('User not found.');
  }

  await user.deleteOne(); // Delete the user document
  return true;
};


// Login a user with email and password
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


// Find a public profile by email or ID number
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

  // First get only privacy flag
  const privacyCheck = await this.findOne(baseQuery).select('isPrivate');

  if (!privacyCheck) {
    throw new Error('User not found.');
  }

  // If private, only return basic details
  if (privacyCheck.isPrivate) {
    return await this.findOne(baseQuery)
      .select('name profilePic isPrivate');
  }

  // If public, return full profile excluding password
  return await this.findOne(baseQuery)
    .select('-password');
};

const User = mongoose.model('User', userSchema);
module.exports = User; // Export the User model 