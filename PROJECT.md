# Edu Platform UZ — Server API

O'zbekiston maktablari (1–11-sinf) uchun mo'ljallangan ta'lim platformasining backend qismi.
O'qituvchilar kurs/dars/test yaratadi, o'quvchilar ularni o'qiydi/yechadi, gamifikatsiya
(olmos, mukofotlar, kunlik barabon) orqali faollik rag'batlantiriladi, Premium tarif orqali
qo'shimcha imkoniyatlar sotiladi, va hammasi bir Telegram bot bilan chambarchas bog'langan.

## Texnologiyalar

- **Runtime:** Node.js, CommonJS (`require`/`module.exports`), TypeScript yo'q
- **Server:** Express 5
- **Baza:** MongoDB + Mongoose 9
- **Autentifikatsiya:** JWT (`jsonwebtoken`) + bcrypt (`bcryptjs`)
- **Validatsiya:** `express-validator`
- **Fayl yuklash:** `multer` (avatar, kurs muqovasi, dars materiali, kitob fayli)
- **To'lov:** Multicard (O'zbek to'lov agregatori — Payme/Click/Uzcard/Humo'ga yo'naltiradi)
- **Telegram bot:** `node-telegram-bot-api`
- **PDF generatsiya:** `pdfkit` (sertifikatlar)
- **Hujjatlar:** `swagger-jsdoc` + `swagger-ui-express` (`/api-docs`)
- **Rejalashtirilgan vazifalar:** `node-cron` (Asia/Tashkent timezone)
- **Test:** Jest + Supertest + `mongodb-memory-server` (haqiqiy MongoDB shart emas)
- **Xavfsizlik:** `helmet`, `cors`, `express-rate-limit`

> **Eslatma:** `package.json`da `fastify` va `ioredis` ro'yxatda bor, lekin kodning hech
> bir joyida ishlatilmaydi — ishlatilmaydigan (orphan) bog'liqliklar.

## Loyihani ishga tushirish

```bash
npm install
npm run dev     # nodemon bilan (development)
npm start        # production
npm test         # Jest test to'plami (mongodb-memory-server, real DB shart emas)
```

Muhim `.env` o'zgaruvchilari: `PORT`, `MONGO_URI`, `JWT_TOKEN_SECRET`, `JWT_EXPIRE`,
`TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `MULTICARD_*`, `PREMIUM_PRICE_30D`,
`DB_BACKUP_*`. To'liq ro'yxat `src/config/env.js`da tekshiriladi (ilova shu fayl orqali
kerakli o'zgaruvchilar yo'qligini startda aniqlaydi).

## Yuqori darajadagi arxitektura

```
server.js                    — entry point: .env, bot, DB, backup scheduler, HTTP server
src/app.js                   — Express konfiguratsiyasi (middleware, routes, error handler)
src/routes/index.js          — barcha modullarning route'larini /api/v1 ostida birlashtiradi
src/modules/<name>/          — har bir domen uchun: model, service, controller, routes, validation
src/middleware/               — authenticate, authorize, validate, upload, rateLimiter, errorHandler
src/config/                   — "sehrli sonlar"ni markazlashtirgan sozlama fayllari
src/utils/                    — ApiError, ApiResponse, asyncHandler, paginate, diamonds, tashkentDate
src/bot/                      — Telegram bot (bot.js) va bildirishnoma yuboruvchi (telegramNotifier.js)
src/jobs/                     — kunlik DB zaxira (dbBackup.service.js, dbBackup.scheduler.js)
scripts/restoreBackup.js      — zaxiradan qo'lda tiklash uchun CLI skript
```

Har bir modul bir xil 4 qavatli naqshga amal qiladi:
**routes → validation (express-validator) → controller (asyncHandler + ApiResponse) → service (biznes mantiq, Mongoose bilan ishlaydi)**.

### Umumiy javob formati

```json
{ "success": true, "statusCode": 200, "message": "...", "data": { ... } }
```

Xatolar `ApiError(statusCode, message)` orqali tashlanadi va `errorHandler` middleware
tomonidan bir xil formatga keltiriladi.

## Foydalanuvchi rollari

`student | teacher | admin | superadmin` — bitta `role` maydoni (string, massiv emas —
bir foydalanuvchi bir vaqtda faqat bitta rolda bo'ladi). `authorize(...roles)` middleware
har bir endpoint uchun ruxsatni tekshiradi.

- **student** — kurslarga yoziladi, darslarni o'qiydi, test yechadi, kitob o'qiydi, olmos
  to'playdi, mukofotga almashtiradi, Premium sotib oladi.
- **teacher** — kurs/dars/test yaratadi, natijalarni ko'radi, ochiq savollarni baholaydi.
  O'zining tarifiga (standart/premium) qarab o'z testlarining urinish limiti kengayadi.
- **admin** — foydalanuvchilarni tasdiqlaydi/bloklaydi, mukofot so'rovlarini bosqichma-bosqich
  ko'rib chiqadi.
- **superadmin** — admin'ning barcha huquqlari + istalgan roldagi user yaratish/o'chirish/
  tahrirlash, parolni majburan tiklash, avatarni boshqa user nomidan boshqarish.

## Autentifikatsiya oqimlari (`auth` moduli)

1. **Telefon + parol bilan ro'yxatdan o'tish** — `isVerified: false` bilan yaratiladi,
   barcha admin/superadmin'larga "tasdiqlashni kutmoqda" bildirishnoma boradi. Admin
   tasdiqlamaguncha login qilolmaydi (`login`/`authenticate` ikkalasida ham tekshiriladi).
2. **Telefon + parol bilan login** — `isVerified`, `isBlocked` tekshiriladi, JWT qaytadi.
3. **Telegram orqali ro'yxatdan o'tish/login** — bot `/start` orqali avtomatik ro'yxatdan
   o'tkazadi (`isVerified: true`, parol shart emas), yoki bot orqali bir martalik OTP kod
   generatsiya qilib, saytda shu kodni kiritib login qilish mumkin (`verifyTelegramOtp`).
4. **JWT ichida:** `id, role, tarif, tokenVersion`. `tokenVersion` parol o'zgarganda/
   logout qilinganda oshadi — shu orqali eski tokenlar darhol yaroqsiz qilinadi.
5. **Premium avtomatik muddati tugashi** — `authenticate` middleware va login/OTP vaqtida
   `user.downgradeIfPremiumExpired()` chaqiriladi — muddati o'tgan premium avtomatik
   `standart`ga tushadi, butun ilova bo'ylab tarif har doim haqiqiy holatni ko'rsatadi.

## Asosiy domenlar

### Kurslar / Darslar / Ro'yxatga olish (`courses`, `lessons`, `enrollment`, `reviews`)
- `Course` — `category`, `teacher`, narx (tiyinda, 0 = bepul), `isPublished`, reyting.
- `Lesson` — kursga tegishli, video/matn/fayl biriktirilgan, `order` bilan tartiblangan.
- `Enrollment` — student+course (unique), `completedLessons[]` orqali progress kuzatiladi,
  pullik bo'lsa `paymentRef` orqali qaysi to'lov bilan bog'langani saqlanadi.
- `Review` — student+course (unique), 1–5 reyting + izoh.

### Kitoblar (`books`, `book-categories`)
Barcha kitoblar **bepul**, sinf bo'yicha ixtiyoriy filtrlash (`grade`), PDF fayl +
muqova rasmi, yuklab olishlar soni hisoblanadi.

### Testlar (`quizzes`, `questions`, `quiz-attempts`)
Eng murakkab va ko'p marta rivojlantirilgan modul:

- **Nishonlash (`targetType`/`targetId`):** `course | lesson | standalone`.
- **Ko'p sinfli targeting:** bitta quiz bir nechta sinf/parallelga mo'ljallanishi mumkin
  (`targetGrades: [{number, letter, availableFrom, availableUntil, maxAttempts, timeLimit}]`).
  `letter: null` — shu sinf raqamining BARCHA parallellarini qamrab oladi. Har bir yozuv
  o'zining boshlanish/tugash vaqti, urinish soni va vaqt limitiga ega bo'lishi mumkin;
  ko'rsatilmagan bo'lsa quiz darajasidagi umumiy qiymat (`availableFrom/Until`, `maxAttempts`,
  `timeLimit`) qo'llaniladi (`quiz.service.js`dagi `getEffective*`/`findMatchingTargetGrade`
  funksiyalari orqali).
- **Minimal savol soni** (`quizRules.js`): faollashtirish uchun sinf darajasiga qarab
  (1–4-sinf: 10 ta, 5–8-sinf: 20 ta, 9–11-sinf: 25 ta savol) kamida shuncha savol talab
  qilinadi.
- **Urinishlar soni** o'qituvchining o'z tarifiga bog'liq: `standart` tarifdagi o'qituvchining
  testida necha marta so'ralmasin **1 martaga** cheklanadi, `premium`da so'ralgan qiymat
  to'liq beriladi.
- **Vaqt limiti endi backend tomonida ham tekshiriladi** — `submitAttempt`da
  `startedAt`dan beri o'tgan vaqt effektiv `timeLimit`dan (20 soniyalik zahira bilan)
  oshsa, attempt `status: "expired"` deb yakunlanadi (0 ball, diamond yo'q, baribir
  `maxAttempts` hisobiga kiradi).
- **Savol turlari:** `multiple_choice`, `true_false` (avtomatik baholanadi, darhol natija),
  `open_ended` (o'qituvchi qo'lda baholaydi — `status: "submitted"` → `reviewOpenEnded`
  orqali `"reviewed"`ga o'tadi).
- **Attempt holatlari:** `in_progress → submitted (ochiq savol bo'lsa) | reviewed (yo'q bo'lsa) | expired`.

### Gamifikatsiya (`src/config/gamification.js`, `src/utils/diamonds.js`, `daily-spin`)
- Test/dars tugatganda olmos beriladi (`QUIZ_MAX_REWARD`, `LESSON_COMPLETE_REWARD`,
  natijaga proporsional).
- **Premium multiplikator:** premium studentlar 1.5x ko'proq olmos oladi — bu **studentning
  o'z tarifiga** bog'liq, o'qituvchining tarifiga emas.
- **Kunlik barabon (`daily-spin`):** standart 1, premium 3 marta/kun; har bir aylanish
  `SPIN_PRIZE_TABLE`dan tasodifiy 1–5 olmos beradi; ketma-ket kunlar `streakCount` orqali
  kuzatiladi (Toshkent kalendar kuni asosida, `tashkentDate.js`).

### Mukofotlar (`rewards`)
3 bosqichli audit-trail bilan: `pending → approved → delivered` (yoki istalgan bosqichdan
`rejected`). Har bir bosqich — kim va qachon bajargani (`approvedBy/At`, `rejectedBy/At/
rejectReason`, `deliveredBy/At/deliveryNote`) saqlanadi. `premiumOnly: true` bo'lgan
mukofotlarni faqat premium studentlar olishi mumkin.

### To'lov (`payment`, `promocodes`)
- **Multicard** integratsiyasi: invoice yaratish → checkout URL → callback (MD5 imzo
  tekshiriladi) **yoki** pull-based reconciliation (`GET /payment/invoice/:uuid` →
  Multicard'ning `GET invoice` javobi, `invoice.payment.status` yo'lidan o'qiladi).
- **Atomik holat yangilash** (`findOneAndUpdate({_id, status:{$ne:'success'}}, ...)`) —
  callback va reconciliation bir vaqtda kelsa ham mukofot/premium ikki marta berilmaydi.
- **3 maqsad (`purpose`):** `wallet` (balansni to'ldirish), `course` (kursga Enrollment),
  `premium` (tarif sotib olish), `donation` (hech narsa berilmaydi).
- **Premium rejalar:** faqat 30 kunlik narx `.env`dan (`PREMIUM_PRICE_30D`), qolgan
  90/180/365 kunlik rejalar shundan avtomatik hisoblanadi (uzoqroq = chegirmali,
  `pricing.js`). Muddat KUNLARDA qo'shiladi (`setDate()`), oy uzunligi noaniqligidan
  qochish uchun; mavjud muddat tugamagan bo'lsa — uzaytiradi, aks holda yangidan boshlaydi.
- **Balansdan to'g'ridan-to'g'ri to'lash** (`useBalance: true`) — Multicard'ga chiqmasdan,
  atomik `$inc` orqali balansdan yechib, darhol natija beriladi.
- **Promokodlar** — faqat `purpose: 'premium'` xaridlarida ishlaydi, muddat/ishlatilish
  soni cheklovi bilan.

### Bildirishnomalar (`notifications`) + Telegram bot (`src/bot/`)
- Har bir muhim voqea (`payment, enrollment, quiz, lesson, reward, system`) uchun DB'da
  `Notification` yaratiladi va **parallel** Telegram orqali ham yuboriladi (agar user bot
  bilan ulangan bo'lsa — `telegramId`).
- Xabarlar ixtiyoriy tugmalar bilan keladi: `url` (frontendga ochiladigan link) yoki
  `callbackData` (botning o'zida ishlov beriladigan amal).
- **Bot'ning o'ziga xos funksiyalari:**
  - `/start` — ro'yxatdan o'tish/login (deep-link orqali ham, profildan ulash uchun ham).
  - `/login` — saytga kirish uchun bir martalik OTP kod.
  - `/tekshir` — **o'qituvchi botning ichida, saytga kirmasdan**, ochiq savolli (hali
    tekshirilmagan) test javoblarini ko'rib, ball qo'yib baholay oladi (inline keyboard
    orqali savol-savol o'tiladi).
- Bildirishnoma matnlari va linklar `src/config/frontendLinks.js`da markazlashtirilgan —
  frontend route'lari o'zgarsa shu bir joydan yangilanadi.

### Sertifikatlar (`certificates`)
Kurs 100% tugatilganda PDF sertifikat generatsiya qilinadi (`pdfkit`), noyob
`certificateNumber` bilan, `/uploads/certificates/...`ga saqlanadi.

### Statistika (`stats`)
- Teacher uchun kurs/test statistikasi (reyting, daromad, o'rtacha ball, o'tish foizi).
- **Eng faol o'qituvchilar reytingi** — og'irlik koeffitsientlari bilan (`teacherActivity.js`:
  kurs×3, test×2, dars×1, kitob×2), MongoDB aggregation orqali N+1 so'rovsiz hisoblanadi.

### Ma'lumotlar zaxiralash (`src/jobs/`)
Har kuni soat 03:00 (Asia/Tashkent, `node-cron`) butun MongoDB (barcha kolleksiyalar)
JSON'ga eksport qilinadi, parol/OTP kod kabi maxfiy maydonlar olib tashlanadi, gzip
bilan siqiladi va belgilangan Telegram chatga fayl sifatida yuboriladi (MongoDB
Atlas/disk muammosiga qarshi zaxira nusxa). `scripts/restoreBackup.js` — shu fayldan
qo'lda tiklash uchun CLI (`--yes` flagisiz faqat dry-run).

> Eslatma: bu zaxira faqat MongoDB hujjatlarini qamrab oladi — `uploads/` papkadagi
> rasm/video/PDF fayllar zaxiraga kirmaydi (Telegram bot API fayl yuklash limiti —
> 50MB — sababli alohida yechim talab qiladi, hozircha qo'shilmagan).

## Xavfsizlik

- `helmet` (barcha route'larda, `/api-docs` bundan mustasno — Swagger UI ishlashi uchun).
- `cors` — `CLIENT_URL` orqali sozlanadi.
- `express-rate-limit` — umumiy API (`/api/v1` — 15 daqiqada 300 so'rov) va alohida
  og'ir endpointlar (login/register/OTP — 5 daqiqada 10 so'rov) uchun; test muhitida o'chirilgan.
- Parollar bcrypt bilan bir tomonlama hash qilinadi, API javoblarida hech qachon
  qaytarilmaydi (`toJSON()` orqali avtomatik olib tashlanadi).
- `tokenVersion` orqali parol o'zgarganda/logout qilinganda barcha eski tokenlar
  (boshqa qurilmalardagilar ham) darhol yaroqsiz bo'ladi.

## Test

`tests/` papkasida Jest + Supertest + `mongodb-memory-server` — har bir test real HTTP
so'rovlar orqali to'liq oqimni tekshiradi (DB real emas, lekin xotiradagi haqiqiy
MongoDB instance). `tests/setup.js` har bir testdan keyin barcha kolleksiyalarni tozalaydi,
`tests/helpers.js` umumiy `createUser` kabi yordamchilarni beradi. Joriy holatda **53/53
test o'tadi** (`npm test`).

## Hujjatlar

To'liq API spetsifikatsiyasi (har bir endpoint, so'rov/javob namunalari) Swagger orqali
avtomatik generatsiya qilinadi va server ishga tushganda `/api-docs` manzilida (brauzerda
interaktiv) hamda `/api-docs.json` manzilida (xom OpenAPI JSON) mavjud bo'ladi.
