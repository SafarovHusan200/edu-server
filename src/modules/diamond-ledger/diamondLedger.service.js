// src/modules/diamond-ledger/diamondLedger.service.js
// user.diamonds'ni o'zgartiradigan YAGONA joy. Balans atomik $inc bilan o'zgaradi va shu
// zahoti jurnalga (DiamondTransaction) yozuv qo'shiladi — replica set bo'lsa bitta
// tranzaksiyada. Yangi olmos manbai qo'shilsa, User'ga to'g'ridan-to'g'ri $inc emas,
// shu funksiya chaqirilishi kerak (aks holda diamond-history balans bilan mos kelmay qoladi).

const User = require('../users/user.model');
const DiamondTransaction = require('./diamondTransaction.model');
const { withTransaction } = require('../../utils/transaction');

// mode:
//   'allowNegative' — ayirish balansdan qat'i nazar bajariladi (standart)
//   'requireBalance' — balans yetmasa hech narsa o'zgarmaydi, null qaytadi (sovg'a so'rash)
//   'clampAtZero'   — balans yetmasa 0 gacha tushiriladi; jurnalga haqiqatda ayirilgan
//                     miqdor yoziladi (urinishni o'chirish)
//
// Qaytaradi: { user, entry } yoki null (user topilmadi / balans yetmadi / o'zgarish 0).
const changeDiamonds = async ({
  userId,
  delta,
  source,
  ref = null,
  note = null,
  actorId = null,
  mode = 'allowNegative',
}) => {
  if (!delta || !Number.isFinite(delta)) return null;

  return withTransaction(async (session) => {
    const opts = { returnDocument: 'after', session };
    let amount = Math.abs(delta);
    let user;

    if (delta > 0 || mode === 'allowNegative') {
      user = await User.findOneAndUpdate({ _id: userId }, { $inc: { diamonds: delta } }, opts);
    } else {
      user = await User.findOneAndUpdate(
        { _id: userId, diamonds: { $gte: amount } },
        { $inc: { diamonds: delta } },
        opts
      );

      if (!user && mode === 'clampAtZero') {
        const before = await User.findOneAndUpdate(
          { _id: userId, diamonds: { $gt: 0 } },
          { $set: { diamonds: 0 } },
          { returnDocument: 'before', session }
        );
        if (before) {
          amount = before.diamonds;
          before.diamonds = 0;
          user = before;
        }
      }
    }

    if (!user) return null;

    const [entry] = await DiamondTransaction.create(
      [
        {
          user: userId,
          amount,
          type: delta > 0 ? 'earn' : 'spend',
          source,
          ref,
          note,
          actor: actorId,
          balanceAfter: user.diamonds,
        },
      ],
      { session }
    );

    return { user, entry };
  });
};

module.exports = { changeDiamonds };
