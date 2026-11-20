// src/modules/diamond-ledger/diamondTransaction.model.js
// Olmos jurnali (ledger): user.diamonds'ning HAR BIR o'zgarishi shu yerda bitta yozuv.
// Faqat diamondLedger.service.changeDiamonds() orqali yoziladi — balans o'zgarishi
// bilan birga, shuning uchun oxirgi yozuvning balanceAfter'i doim user.diamonds'ga teng.

const mongoose = require('mongoose');

const DIAMOND_SOURCES = [
  'quiz', // test baholandi (faqat 1-urinish)
  'lesson', // dars tugatildi
  'spin', // kunlik barabon savoliga to'g'ri javob
  'live_quiz', // jonli testdagi o'rin (hozircha olmos berilmaydi — kelajak uchun)
  'reward', // sovg'a so'raldi (−)
  'reward_refund', // sovg'a so'rovi rad etildi, olmos qaytdi (+)
  'attempt_revoked', // superadmin urinishni o'chirdi, olmos qaytarib olindi (−)
  'admin_adjust', // qo'lda tuzatish (shu jumladan migratsiyadagi qoldiq farqi)
];

const DIAMOND_REF_KINDS = ['attempt', 'lesson', 'spin', 'redemption', 'live_session'];

const diamondTransactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // Doim musbat — yo'nalish `type` bilan beriladi
    amount: { type: Number, required: true, min: 0 },
    type: { type: String, enum: ['earn', 'spend'], required: true },
    source: { type: String, enum: DIAMOND_SOURCES, required: true },

    // Manba obyekti. title — yozilgan paytdagi nom (snapshot): manba keyin o'chirilsa
    // yoki nomi o'zgarsa ham tarix o'qiladigan bo'lib qoladi
    ref: {
      type: {
        kind: { type: String, enum: DIAMOND_REF_KINDS, required: true },
        id: { type: mongoose.Schema.Types.ObjectId, required: true },
        title: { type: String, default: null },
      },
      default: null,
      _id: false,
    },

    balanceAfter: { type: Number, required: true },
    note: { type: String, trim: true, default: null },

    // Kim qilgani (reward_refund, attempt_revoked, admin_adjust) — o'zi bo'lsa null
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    // scripts/migrateDiamondLedger.js yaratgan tarixiy yozuvlar
    migrated: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

diamondTransactionSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('DiamondTransaction', diamondTransactionSchema);
module.exports.DIAMOND_SOURCES = DIAMOND_SOURCES;
module.exports.DIAMOND_REF_KINDS = DIAMOND_REF_KINDS;
