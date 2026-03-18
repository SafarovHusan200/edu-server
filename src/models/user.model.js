const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    telegramId: {
      type: Number,
      unique: true,
    },

    role: {
      type: String,
      enum: ['student', 'teacher', 'admin', 'superadmin'],
      default: 'student',
    },

    tarif: {
      type: String,
      enum: ['standart', 'premium'],
      default: 'standart',
    },
  },
  { timestamps: true }
);

// hash password - Cleaned up Async version
userSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return; // No next() needed
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  // No next() needed
});

// compare password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

// jwt token
userSchema.methods.generateJwtToken = function () {
  return jwt.sign(
    {
      id: this._id,
      role: this.role,
    },
    process.env.JWT_TOKEN_SECRET,
    { expiresIn: '1d' }
  );
};

// remove password from response
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
