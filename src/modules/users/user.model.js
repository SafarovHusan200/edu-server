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

    password: {
      type: String,
      minlength: 6,
      default: null,
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

    grade: {
      number: {
        type: Number,
        min: 1,
        max: 11,
        default: null,
      },
      letter: {
        type: String,
        enum: ['A', 'B', 'C', 'D', 'E', null],
        default: null,
      },
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

    // Telefon+parol orqali ro'yxatdan o'tgan userlar admin/superadmin tasdiqlamaguncha
    // login qila olmaydi (authenticate middleware va login servisida tekshiriladi).
    // Telegram orqali ro'yxatdan o'tganlar va admin tomonidan yaratilganlar avtomatik true.
    isVerified: {
      type: Boolean,
      default: false,
    },

    // Qaysi admin/superadmin tasdiqlagani va qachon — auditlik uchun
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    verifiedAt: {
      type: Date,
      default: null,
    },

    isBlocked: {
      type: Boolean,
      default: false,
    },

    balance: {
      type: Number,
      default: 0,
    },

    // Testlarni topshirish va darslarni tugatish uchun beriladigan o'yin ichi valyuta
    diamonds: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Kunlik barabon (daily-spin) uchun holat — ketma-ket kunlar va kunlik limit shu yerda saqlanadi
    streakCount: {
      type: Number,
      default: 0,
    },

    // 'YYYY-MM-DD' (Toshkent kalendar kuni) — oxirgi marta aylantirilgan kun
    lastSpinDate: {
      type: String,
      default: null,
    },

    // lastSpinDate kuni uchun ishlatilgan aylantirishlar soni — kun almashganda 0'ga tushadi
    spinsUsedToday: {
      type: Number,
      default: 0,
    },

    lastLogin: {
      type: Date,
      default: null,
    },

    // Logout yoki parol o'zgarganda oshadi — shu qiymat oldingi tokenlarni
    // yaroqsiz qilish uchun ishlatiladi (authenticate middleware'da tekshiriladi)
    tokenVersion: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

userSchema.pre('save', async function () {
  if (!this.isModified('password') || !this.password) return;

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.pre('validate', async function () {
  if (this.role === 'student') {
    if (!this.grade?.number) {
      this.invalidate('grade.number', 'Sinf raqami kiritilishi shart');
    }
    if (!this.grade?.letter) {
      this.invalidate('grade.letter', 'Sinf harfi kiritilishi shart');
    }
  }
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
      tokenVersion: this.tokenVersion,
    },
    process.env.JWT_TOKEN_SECRET,
    { expiresIn: '1d' }
  );
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.tokenVersion;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
