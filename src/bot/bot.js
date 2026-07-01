const TelegramBot = require('node-telegram-bot-api');
const Otp = require('../modules/auth/otp.model');
const User = require('../modules/users/user.model');

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

// Foydalanuvchi ma'lumotlarini vaqtincha xotirada ushlab turish uchun state
const userState = {};

const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

// --- 1. START BUYRUG'I ---
bot.onText(/\/start/, async (msg) => {
  const telegramId = msg.from.id;

  try {
    const user = await User.findOne({ telegramId });

    if (!user) {
      return bot.sendMessage(
        telegramId,
        'Xush kelibsiz! Botdan foydalanish uchun iltimos telefon raqamingizni yuboring:',
        {
          reply_markup: {
            keyboard: [[{ text: '📱 Telefon raqamni yuborish', request_contact: true }]],
            resize_keyboard: true,
            one_time_keyboard: true,
          },
        }
      );
    }

    bot.sendMessage(
      telegramId,
      `Xush kelibsiz, ${user.name}! Kirish uchun /login buyrug'ini bosing.`
    );
  } catch (error) {
    console.error(error);
  }
});

// --- 2. TELEFON RAQAMINI QABUL QILISH ---
bot.on('contact', async (msg) => {
  const telegramId = msg.from.id;
  const phone = msg.contact.phone_number.startsWith('+')
    ? msg.contact.phone_number.slice(1)
    : msg.contact.phone_number;

  try {
    // Bazadan telefon orqali qidirish
    const existingUser = await User.findOne({ phone });

    if (existingUser) {
      // User bor — faqat telegramId va telegramUsername yangilash
      if (existingUser.isBlocked) {
        return bot.sendMessage(telegramId, 'Kechirasiz, profilingiz bloklangan.', {
          reply_markup: { remove_keyboard: true },
        });
      }

      await User.findByIdAndUpdate(existingUser._id, {
        telegramId,
        telegramUsername: msg.from.username || null,
        isVerified: true,
        lastLogin: new Date(),
      });

      return bot.sendMessage(
        telegramId,
        `✅ Xush kelibsiz, <b>${existingUser.name}</b>!\n\n` +
          `Kirish uchun /login buyrug'ini bosing.`,
        {
          parse_mode: 'HTML',
          reply_markup: { remove_keyboard: true },
        }
      );
    }

    // User yo'q — to'liq ro'yxatdan o'tkazish
    userState[telegramId] = {
      phone,
      name: msg.from.first_name,
      telegramUsername: msg.from.username || null,
    };

    bot.sendMessage(telegramId, "Kim sifatida ro'yxatdan o'tasiz?", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "O'quvchi (Student) 🎓", callback_data: 'role_student' }],
          [{ text: "O'qituvchi (Teacher) 👨‍🏫", callback_data: 'role_teacher' }],
        ],
        remove_keyboard: true,
      },
    });
  } catch (error) {
    console.error('Contact xatosi:', error.message);
    bot.sendMessage(telegramId, "Xatolik yuz berdi. Qayta urinib ko'ring: /start");
  }
});

// --- 3. INLINE TUGMALAR BOSILGANDA ---
bot.on('callback_query', async (query) => {
  const telegramId = query.from.id;
  const data = query.data;

  // Agar foydalanuvchi state-da bo'lmasa, qayta /start qilishini so'raymiz
  if (!userState[telegramId]) {
    bot.answerCallbackQuery(query.id, { text: 'Sessiya muddati tugadi. Iltimos, /start bosing.' });
    return bot.sendMessage(telegramId, 'Iltimos, qaytadan boshlang: /start');
  }

  // A. Rol: O'qituvchi tanlasa
  if (data === 'role_teacher') {
    userState[telegramId].role = 'teacher';
    await registerUserToDB(telegramId, query.message.message_id);
    bot.answerCallbackQuery(query.id);
  }

  // B. Rol: O'quvchi tanlasa -> Sinf raqamini so'rash
  if (data === 'role_student') {
    userState[telegramId].role = 'student';

    const gradeButtons = [];
    for (let i = 1; i <= 11; i++) {
      gradeButtons.push({ text: `${i}-sinf`, callback_data: `gNum_${i}` });
    }

    // Tugmalarni 3 tadan qilib chiroyli qatorlash
    const chunkedGrades = [];
    while (gradeButtons.length) chunkedGrades.push(gradeButtons.splice(0, 3));

    bot.editMessageText('Sinfingiz raqamini tanlang:', {
      chat_id: telegramId,
      message_id: query.message.message_id,
      reply_markup: { inline_keyboard: chunkedGrades },
    });
    bot.answerCallbackQuery(query.id);
  }

  // C. Sinf raqami tanlanganda -> Sinf harfini so'rash
  if (data.startsWith('gNum_')) {
    userState[telegramId].gradeNumber = parseInt(data.split('_')[1], 10);

    const letters = ['A', 'B', 'C', 'D', 'E'];
    const letterButtons = letters.map((l) => ({ text: l, callback_data: `gLet_${l}` }));

    bot.editMessageText('Sinfingiz harfini tanlang:', {
      chat_id: telegramId,
      message_id: query.message.message_id,
      reply_markup: { inline_keyboard: [letterButtons] },
    });
    bot.answerCallbackQuery(query.id);
  }

  // D. Sinf harfi tanlanganda -> Yakuniy bazaga yozish
  if (data.startsWith('gLet_')) {
    userState[telegramId].gradeLetter = data.split('_')[1];
    await registerUserToDB(telegramId, query.message.message_id);
    bot.answerCallbackQuery(query.id);
  }
});

// --- 4. BAZAGA SAQLASH FUNKSIYASI ---
async function registerUserToDB(telegramId, messageId) {
  const state = userState[telegramId];

  try {
    // Telefon orqali bazadan qidirish
    const user = await User.findOne({ phone: state.phone });

    const updateData = {
      name: state.name,
      telegramId: telegramId, // state.telegramId emas, funksiya argumentidagi telegramId
      telegramUsername: state.telegramUsername,
      role: state.role,
      isVerified: true,
    };

    // Agar student bo'lsa, grade ma'lumotlarini qo'shamiz
    if (state.role === 'student') {
      updateData.grade = {
        number: state.gradeNumber,
        letter: state.gradeLetter,
      };
    } else {
      // Agar o'qituvchi bo'lsa, grade ni null qilish yoki o'chirish (ixtiyoriy)
      updateData.grade = { number: null, letter: null };
    }

    let newUser;
    if (!user) {
      // Yangi foydalanuvchi yaratish (phone ham qo'shiladi)
      newUser = await User.create({ ...updateData, phone: state.phone });
    } else {
      // Mavjud foydalanuvchini yangilash
      newUser = await User.findByIdAndUpdate(
        user._id,
        { telegramId: telegramId, telegramUsername: state.telegramUsername },
        { new: true, runValidators: true } // validatorlarni ham ishlatish
      );
    }

    await bot.editMessageText(
      `Muvaffaqiyatli ro'yxatdan o'tdingiz! 🎉\n\n` +
        `Ism: <b>${newUser.name}</b>\n` +
        `Rol: <b>${newUser.role}</b>\n` +
        (newUser.role === 'student' && newUser.grade?.number
          ? `Sinf: <b>${newUser.grade.number}-${newUser.grade.letter}</b>\n`
          : '') +
        `Kirish uchun: /login buyrug'ini bosing.`,
      {
        chat_id: telegramId,
        message_id: messageId,
        parse_mode: 'HTML',
      }
    );

    delete userState[telegramId];
  } catch (error) {
    console.error('Registratsiya xatosi:', error.message);
    bot
      .sendMessage(
        telegramId,
        "Xatolik yuz berdi. Ehtimol, bu raqam yoki ID banddir. Qayta urinib ko'ring: /start"
      )
      .catch(() => {});
    delete userState[telegramId];
  }
}

// --- 5. LOGIN (OTP GENERATSIYASI) ---
bot.onText(/\/login/, async (msg) => {
  const telegramId = msg.from.id;

  try {
    const user = await User.findOne({ telegramId });

    if (!user) {
      return bot.sendMessage(
        telegramId,
        "Siz hali ro'yxatdan o'tmadingiz. Iltimos, /start bosing."
      );
    }

    if (user.isBlocked) {
      return bot.sendMessage(telegramId, 'Kechirasiz, profilingiz bloklangan.');
    }

    const code = generateOtp();

    await Otp.deleteMany({ telegramId });
    await Otp.create({
      telegramId,
      code,
      expiresAt: new Date(Date.now() + 3 * 60 * 1000), // 3 minut
    });

    bot.sendMessage(
      telegramId,
      `Sizning kirish kodingiz:\n\n<code>${code}</code>\n\n⏳ Amal qilish muddati: 3 daqiqa.`,
      {
        parse_mode: 'HTML',
      }
    );
  } catch (error) {
    bot.sendMessage(telegramId, "Xatolik yuz berdi. Qayta urinib ko'ring.");
  }
});

module.exports = bot;
