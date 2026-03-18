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
      sparse: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
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
      sparse: true,
    },

    telegramUsername: {
      type: String,
      default: null,
    },

    avatar: {
      type: String,
      default: null,
    },

    role: {
      type: String,
      enum: ['student', 'teacher', 'admin', 'superadmin'],
      required: true,
    },

    tarif: {
      type: String,
      enum: ['standart', 'premium'],
      default: 'standart',
    },

    isVerified: {
      type: Boolean,
      default: false,
    },

    isBlocked: {
      type: Boolean,
      default: false,
    },

    lastLogin: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

userSchema.pre('save', async function () {
  if (!this.isModified('password') || !this.password) return;

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  if (!this.password) return false; // telegram user parolsiz
  return bcrypt.compare(enteredPassword, this.password);
};

userSchema.methods.generateJwtToken = function () {
  return jwt.sign(
    {
      id: this._id,
      role: this.role,
      tarif: this.tarif,
    },
    process.env.JWT_TOKEN_SECRET,
    { expiresIn: '1d' }
  );
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
