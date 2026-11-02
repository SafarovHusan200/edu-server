// scripts/seedSpinQuestions.js
// Kunlik barabon (daily-spin) uchun har bir sinf (1-11) bo'yicha boshlang'ich xalqaro
// darajadagi bilim savollari. Bu — faqat BOSHLANG'ICH to'plam, admin keyinchalik
// POST/PATCH/DELETE /spin-questions orqali o'zi ko'paytiradi/tahrirlaydi.
//
// Idempotent — bir xil (grade + question matni) allaqachon bazada bo'lsa, qayta
// qo'shilmaydi, shuning uchun bir necha marta ishga tushirish xavfsiz.
//
// Ishlatilishi:
//   node scripts/seedSpinQuestions.js

require('dotenv').config();
const mongoose = require('mongoose');

const SpinQuestion = require('../src/modules/spin-questions/spinQuestion.model');
const User = require('../src/modules/users/user.model');

// [savol, [4 variant], to'g'ri variant indeksi]
const QUESTIONS_BY_GRADE = {
  1: [
    ['Osmon kunduzi qanday rangda?', ['Ko\'k', 'Qizil', 'Sariq', 'Yashil'], 0],
    ['1 + 1 nechiga teng?', ['1', '2', '3', '4'], 1],
    ['It qanday ovoz chiqaradi?', ['Miyov', 'Vuf-vuf', 'Mo\'-o\'', 'Chuk-chuk'], 1],
  ],
  2: [
    ['Bir haftada necha kun bor?', ['5', '6', '7', '8'], 2],
    ['Quyosh qaysi tomondan chiqadi?', ['Sharq', 'G\'arb', 'Shimol', 'Janub'], 0],
    ['2 x 3 nechiga teng?', ['5', '6', '7', '8'], 1],
  ],
  3: [
    ['Dunyodagi eng katta okean qaysi?', ['Hind okeani', 'Atlantika okeani', 'Tinch okean', 'Arktika okeani'], 2],
    ['Suv necha gradus Selsiyda muzlaydi?', ['0°C', '10°C', '50°C', '100°C'], 0],
    ['Yerning tabiiy sun\'iy yo\'ldoshi nima deyiladi?', ['Mars', 'Oy', 'Quyosh', 'Yupiter'], 1],
  ],
  4: [
    ['Dunyodagi eng uzun daryo qaysi?', ['Amazonka', 'Nil', 'Yangtsi', 'Missisipi'], 1],
    ['Kattalar tanasida nechta suyak bor?', ['106', '206', '306', '406'], 1],
    ['Qaysi sayyora "Qizil sayyora" deb ataladi?', ['Venera', 'Mars', 'Yupiter', 'Saturn'], 1],
  ],
  5: [
    ['Fotosintez jarayonida o\'simlik qaysi gazni ishlab chiqaradi?', ['Kislorod', 'Azot', 'Vodorod', 'Uglerod'], 0],
    ['Dunyodagi eng baland tog\' qaysi?', ['Everest', 'K2', 'Kilimanjaro', 'Elbrus'], 0],
    ['7 x 8 nechiga teng?', ['54', '56', '58', '64'], 1],
  ],
  6: [
    ['Insonning yuragi nechta bo\'lmadan iborat?', ['2', '3', '4', '5'], 2],
    ['Kimyoviy belgisi "O" bo\'lgan element qaysi?', ['Oltin', 'Kislorod', 'Osmiy', 'Azot'], 1],
    ['Dunyoda eng ko\'p gapiriladigan ona tili qaysi?', ['Ingliz tili', 'Xitoy (mandarin) tili', 'Ispan tili', 'Hind tili'], 1],
  ],
  7: [
    ['Pifagor teoremasi qaysi shaklga tegishli?', ['Doira', 'To\'g\'ri burchakli uchburchak', 'Kvadrat', 'Beshburchak'], 1],
    ['Global isishga eng ko\'p sabab bo\'ladigan gaz qaysi?', ['Kislorod', 'Azot', 'Karbonat angidrid (CO2)', 'Geliy'], 2],
    ['Oyga birinchi qadam bosgan inson kim?', ['Yuriy Gagarin', 'Neil Armstrong', 'Buzz Aldrin', 'John Glenn'], 1],
  ],
  8: [
    ['Nyutonning uchinchi qonuni nimani ifodalaydi?', ['Inersiya', 'Ta\'sir kuchiga teng va qarama-qarshi aks ta\'sir', 'Tezlanish formulasi', 'Gravitatsiya qonuni'], 1],
    ['Kimyoviy elementlar davriy jadvalini kim yaratgan?', ['Albert Einstein', 'Dmitriy Mendeleyev', 'Isaac Newton', 'Charles Darwin'], 1],
    ['DNK so\'zi nimani anglatadi?', ['Dezoksiribonuklein kislota', 'Dinamik neyron kodi', 'Digital tarmoq algoritmi', 'Hech biri'], 0],
  ],
  9: [
    ['Birlashgan Millatlar Tashkiloti (BMT) qachon tuzilgan?', ['1919', '1945', '1955', '1991'], 1],
    ['Yorug\'lik tezligi vakuumda (taxminan) qancha?', ['300 000 km/s', '300 km/s', '3 000 000 km/s', '30 000 km/s'], 0],
    ['Suvning kimyoviy formulasi qanday?', ['CO2', 'H2O', 'O2', 'NaCl'], 1],
  ],
  10: [
    ['ax² + bx + c = 0 tenglamaning diskriminanti formulasi qaysi?', ['b² - 4ac', 'b² + 4ac', '4ac - b²', 'a² - 4bc'], 0],
    ['Nisbiylik nazariyasini kim yaratgan?', ['Isaac Newton', 'Albert Einstein', 'Niels Bohr', 'Max Planck'], 1],
    ['Parij iqlim kelishuvi nimaga qaratilgan?', ['Global isishni cheklash', 'Savdo tariflari', 'Harbiy hamkorlik', 'Migratsiya'], 0],
  ],
  11: [
    ['Ikkinchi jahon urushi qaysi yilda tugagan?', ['1943', '1945', '1947', '1950'], 1],
    ['Dunyoda eng ko\'p mamlakatda rasmiy til hisoblangan til qaysi?', ['Ingliz tili', 'Fransuz tili', 'Arab tili', 'Ispan tili'], 0],
    ['Mur qonuni (Moore\'s law) nimaga tegishli?', ['Chipdagi tranzistorlar sonining o\'sishi', 'Iqlim o\'zgarishi', 'Aholi o\'sishi', 'Inflatsiya darajasi'], 0],
  ],
};

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log(`✅ Bazaga ulandi: ${mongoose.connection.name}\n`);

  const admin = await User.findOne({ role: { $in: ['admin', 'superadmin'] } }).sort({ createdAt: 1 });
  if (!admin) {
    console.log("❌ Bazada admin/superadmin topilmadi — createdBy uchun kerak. Avval admin yarating.");
    await mongoose.disconnect();
    return;
  }

  let added = 0;
  let skipped = 0;

  for (const [gradeStr, questions] of Object.entries(QUESTIONS_BY_GRADE)) {
    const grade = Number(gradeStr);

    for (const [question, options, correctIndex] of questions) {
      const existing = await SpinQuestion.findOne({ grade, question });
      if (existing) {
        skipped += 1;
        continue;
      }

      await SpinQuestion.create({ grade, question, options, correctIndex, createdBy: admin._id });
      added += 1;
    }
  }

  console.log(`🎉 ${added} ta savol qo'shildi, ${skipped} ta allaqachon bor edi (o'tkazib yuborildi).`);
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error('❌ Kutilmagan xatolik:', error);
  process.exit(1);
});
