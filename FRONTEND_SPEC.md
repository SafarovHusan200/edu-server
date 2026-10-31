# Edu Platform UZ — Full Specification for Rebuilding the Frontend from Scratch

Bu hujjat **frontendning yangi versiyasini loyihalash** (dizayn chizish) uchun to'liq
funksional (content/UX) manba hisoblanadi. Vizual dizayn (ranglar, shrift, komponent
uslubi, brend) ataylab ushbu hujjatga kiritilmagan — bu alohida dizayn sessiyasida hal
qilinadi. Shu yerda esa: **qaysi sahifalar kerak, har birida nima ko'rsatiladi, qanday
action'lar bor, va asosiy foydalanuvchi oqimlari qanday ishlaydi** — hammasi mavjud
backend (`edu-platform.uz-server-api`)ning haqiqiy imkoniyatlariga asoslanib yozilgan
(taxmin qilingan narsa yo'q).

> To'liq backend arxitekturasi va biznes-qoidalar uchun qarang: `PROJECT.md`.
> To'liq API spetsifikatsiyasi: backend ishga tushganda `/api-docs` (Swagger UI).

## 0. General Context

- **Auditoriya:** O'zbekiston maktab o'quvchilari (1–11-sinf), o'qituvchilar, va
  maktab/platforma administratorlari.
- **Til:** interfeys matnlari o'zbek tilida (lotin yozuvida).
- **Valyuta:** so'm (backendda tiyinda saqlanadi — frontend `amount / 100` qilib
  ko'rsatishi kerak).
- **Vaqt mintaqasi:** Asia/Tashkent — barcha sana/vaqt shu bo'yicha ko'rsatilsin.
- **Autentifikatsiya:** JWT (`Authorization: Bearer <token>`), `localStorage`/
  secure storage'da saqlanadi. Token ichida `tokenVersion` bor — parol o'zgarsa yoki
  logout qilinsa, eski token serverda avtomatik rad etiladi (401 qaytadi — frontend
  buni ushlab, qayta login sahifasiga yo'naltirishi kerak).
- **API javob formati (har doim):**
  ```json
  { "success": true, "statusCode": 200, "message": "...", "data": { ... } }
  ```
  Xato bo'lsa `success: false` + `message` + (validatsiya xatosi bo'lsa) `errors[]`.
- **Qurilma:** mobile-first — o'quvchilarning katta qismi telefon orqali kiradi
  (ko'pchiligi Telegram bot orqali ham ulanadi). Desktop ham to'liq qo'llab-quvvatlansin
  (o'qituvchi/admin panel uchun ayniqsa muhim — ko'proq jadval/formalar bilan ishlaydi).
- **Telegram bilan chambarchas bog'liqlik:** ko'p bildirishnomalar va ba'zi amallar
  (test javoblarini tekshirish, login OTP) Telegram bot orqali ham amalga oshiriladi.
  Frontendda "Telegramni ulash" (profil sahifasida) muhim komponent.
- **Ikkinchi maqsadli platforma — Telegram Mini App:** xuddi shu frontend (bir xil
  kod, bir xil API) Telegram ichida **Mini App** sifatida ham ochilishi mo'ljallangan
  (qarang: 3.7-bo'lim). Shuning uchun dizayn/layout **Telegram WebView konteyneriga
  mos** bo'lishi kerak: tashqi brauzer-xrom elementlari (manzil satri, orqaga tugmasi)
  yo'q deb hisoblab loyihalash, Telegramning `MainButton`/`BackButton` kabi native
  elementlaridan foydalanishni ko'zda tutish, va mavzu ranglarini Telegram
  `themeParams`iga moslashtirish imkoniyatini qoldirish tavsiya etiladi (aniq
  implementatsiya dizayn bosqichida hal qilinadi — bu yerda faqat talab sifatida
  belgilanadi).

## 1. User Roles and Their Core Goals

| Role | Goal |
|---|---|
| **student** | Kurs/kitob o'qish, test yechish, olmos to'plash, mukofotga almashtirish, Premium sotib olish, sertifikat olish |
| **teacher** | Kurs/dars/test/kitob yaratish, natijalarni ko'rish, ochiq savollarni baholash, o'z faolligini kuzatish |
| **admin** | Foydalanuvchilarni tasdiqlash/bloklash, mukofot so'rovlarini bosqichma-bosqich boshqarish, mukofotlar katalogini yuritish |
| **superadmin** | admin'ning barchasi + istalgan foydalanuvchini yaratish/o'chirish/tahrirlash, rolini o'zgartirish, parolini tiklash, avatarini boshqarish |

## 2. Full Sitemap (page list, by role)

### 2.1 Public (no login required / any role)
1. **Bosh sahifa** — platforma haqida qisqa, mashhur kurslar/kitoblar vitrinasi, CTA (ro'yxatdan o'tish/kirish)
2. **Ro'yxatdan o'tish** (telefon + parol + ism + rol tanlash + student bo'lsa sinf)
3. **Kirish** (telefon + parol)
4. **Telegram orqali kirish** — bot deep-link YOKI botdan olingan OTP kodni kiritish formasi
5. **Kurslar katalogi** (filtrlash: kategoriya, narx, qidiruv)
6. **Kurs tafsilotlari** (dars ro'yxati, reyting/izohlar, narx, "Sotib olish"/"Yozilish")
7. **Kitoblar kutubxonasi** (filtrlash: kategoriya, sinf, qidiruv) — barchasi bepul
8. **Kitob tafsilotlari** (yuklab olish)
9. **Mukofotlar katalogi** (diamond narxi bilan — login bo'lmasa ham ko'rinadi, lekin "almashtirish" uchun login kerak)
10. **Sertifikat tekshirish** (ochiq sahifa — sertifikat raqami kiritiladi, haqiqiyligi tasdiqlanadi)
11. **404 / xatolik sahifalari**

### 2.2 Student Panel
1. **Dashboard** — mening kurslarim progress, olmos balansim, bugungi barabon holati, so'nggi bildirishnomalar
2. **Mening kurslarim** (enrollment ro'yxati, progress %)
3. **Dars sahifasi** (video/matn/fayl, "tugatdim" tugmasi, keyingi darsga o'tish)
4. **Test (quiz) ro'yxati** (kursga/darsiga tegishli yoki mustaqil) — har birida: holat (urinilmagan/davom etmoqda/tugagan), qolgan urinishlar
5. **Test yechish sahifasi** — savol-savol yoki bir sahifada, **countdown timer** (qolgan vaqt — `effectiveTimeLimit` asosida), avtomatik submit vaqt tugaganda
6. **Test natijasi sahifasi** — ball, to'g'ri/noto'g'ri javoblar, agar ochiq savol bo'lsa "tekshirilmoqda" holati
7. **Mening urinishlarim** (bitta quiz bo'yicha tarix — har bir urinish balli, holati)
8. **Diamond va reyting** — "Eng ko'p olmos to'plaganlar" reytingi (leaderboard)
9. **Kunlik barabon** — aylantirish tugmasi, qolgan aylanishlar, streak ko'rsatkichi, yutuq animatsiyasi
10. **Mukofotlar** — katalog, "Diamondga almashtirish" tugmasi (agar `premiumOnly` bo'lsa va student premium bo'lmasa — qulflangan holat ko'rsatilsin)
11. **Mening so'rovlarim (mukofot)** — holat: kutilmoqda → tasdiqlandi → yetkazildi (yoki rad etildi + sababi)
12. **Premium sahifasi** — rejalar jadvali (30/90/180/365 kun, chegirma %), joriy holat (agar premium bo'lsa — tugash sanasi), sotib olish tugmasi
13. **Hamyon (wallet)** — balans, to'ldirish, to'lovlar tarixi, "balansdan to'lash" opsiyasi checkout'da
14. **Sertifikatlarim** — ro'yxat + yuklab olish
15. **Bildirishnomalar** — ro'yxat, o'qilgan/o'qilmagan, "hammasini o'qilgan qilish"
16. **Profil** — sinf tahrirlash (ism **tahrirlanmaydi** — o'quvchi o'z ismini o'zgartira olmaydi, backend buni e'tiborsiz qoldiradi, shuning uchun ism maydoni frontendda faqat o'qish uchun/disabled ko'rsatilsin), parol o'zgartirish, avatar yuklash, Telegramni ulash/uzish

### 2.3 Teacher Panel
1. **Dashboard** — umumiy statistika (kurslar soni, nashr qilinganlar, o'rtacha reyting, daromad, o'rtacha test balli, o'tish foizi)
2. **Mening kurslarim** (CRUD: yaratish, tahrirlash, nashr qilish/qilmaslik, muqova yuklash)
3. **Kurs ichidagi darslar** (CRUD, tartiblash — `order`)
4. **Mening testlarim** (CRUD)
5. **Test yaratish/tahrirlash** — murakkab forma:
   - Asosiy: nom, nishonlash (`course`/`lesson`/`standalone` + tegishli tanlov), o'tish balli, umumiy `maxAttempts`/`timeLimit`/`availableFrom`/`availableUntil`
   - **Sinf(lar) tanlash** (`targetGrades[]`) — bir nechta sinf/parallel qo'shish, har biriga ixtiyoriy alohida boshlanish/tugash vaqti, urinish soni, vaqt limiti
   - Savollar qo'shish (multiple_choice/true_false/open_ended) — variant, to'g'ri javob, ball
   - Faollashtirish (`isActive`) — minimal savol soni talabi haqida ogohlantirish (sinf darajasiga qarab 10/20/25 ta)
6. **Test natijalari** — barcha studentlar ro'yxati, ball, holat (shu jumladan "vaqt tugadi" — `expired`).
   Bitta urinishni bosilganda savol-javob tafsiloti ochiladi (`GET /quizzes/attempts/:attemptId`).
   **Faqat superadmin** uchun bu yerda qo'shimcha **"O'chirish"** tugmasi ko'rinadi — test
   texnik xato (masalan noto'g'ri savol/vaqt limiti) sababli buzilib ketgan urinishni butunlay
   o'chirish uchun (shu bilan urinish `maxAttempts` hisobidan chiqadi — student qayta urina
   oladi; agar diamond berilgan bo'lsa, avtomatik qaytarib olinadi). Boshqa rollar (teacher/
   admin) bu tugmani ko'rmaydi/chaqirolmaydi.
7. **Ochiq savollarni baholash** — kutilayotgan urinishlar ro'yxati, har bir javobga ball/izoh qo'yish formasi
8. **Testni ulashish** — "Mening testlarim" ro'yxatidagi har bir **mustaqil (standalone)** test
   yonida "Boshqa o'qituvchiga ulashish" tugmasi. Telefon raqamini qo'lda kiritish o'rniga
   **qidiruv bilan select** ko'rsatilsin — `GET /users/teachers?search=...` orqali to'ldiriladi
   (yozilgan harflar bo'yicha ism/telefon filtrlanadi), tanlangan o'qituvchining `phone`i
   `toTeacherPhone` sifatida yuboriladi. Bilan bog'liq ikki ro'yxat:
   - **Menga ulashilganlar** — kelgan so'rovlar, har birida "Qabul qilish" / "Rad etish"
     tugmalari. Qabul qilinganda **yangi, mustaqil test** (o'zining nusxasi, `isActive:false`)
     yaratiladi — buni darhol "Test tahrirlash" sahifasiga yo'naltirib, o'z sinfini
     (`targetGrades`) tanlashini so'rash kerak (aks holda eski sinf — masalan 4-A —
     qolib ketadi).
   - **Men ulashganlar** — o'zi yuborgan so'rovlar va ularning holati (kutilmoqda/
     qabul qilindi/rad etildi).
9. **Kitoblarim** (CRUD, fayl/muqova yuklash)
10. **Eng faol o'qituvchilar reytingi** — o'zining o'rnini ko'rish
11. **Profil** — xuddi student bilan bir xil (+ o'z tarifi: standart/premium, chunki bu test urinish limitiga ta'sir qiladi)

### 2.4 Admin / Superadmin Panel
1. **Dashboard** — umumiy platforma ko'rsatkichlari
2. **Foydalanuvchilar** — ro'yxat (filtr: rol, tasdiqlangan/tasdiqlanmagan, qidiruv), qatordan:
   - Tasdiqlash (`isVerified`)
   - Bloklash/blokdan chiqarish
   - *(faqat superadmin)* yaratish, o'chirish
3. **Foydalanuvchi profili (admin ko'rinishi)** — ro'yxatda bir userni bosilganda ochiladigan
   batafsil sahifa (`GET /users/:id`): ism, telefon, rol, sinf (student bo'lsa), tarif,
   premium tugash sanasi, diamond/balans, kim va qachon tasdiqlagani (`verifiedBy/At`),
   ro'yxatdan o'tgan/so'nggi kirgan sana. Shu sahifada amallar:
   - Tasdiqlash, bloklash/blokdan chiqarish
   - *(faqat superadmin)* ism/telefon/rol/tarif/sinfni tahrirlash, parolni majburan
     tiklash, avatarni almashtirish/o'chirish, foydalanuvchini o'chirish
4. **Tasdiqlashni kutayotganlar** — alohida filtr/tab (`isVerified=false`)
5. **Mukofotlar boshqaruvi** — katalog CRUD (nom, narx, qoldiq, rasm, `premiumOnly`)
6. **Mukofot so'rovlari** — 3 bosqichli navbat:
   - **Kutilmoqda** → "Tasdiqlash" / "Rad etish" (sabab bilan)
   - **Tasdiqlangan** → "Yetkazildi" deb belgilash (izoh bilan)
   - **Tarix** — yetkazilgan/rad etilgan so'rovlar, kim va qachon bajargani
7. **Kategoriyalar** (kurs va kitob kategoriyalari — alohida CRUD)
8. **To'lovlar** (barcha to'lovlar ro'yxati — kim, qancha, qaysi maqsadda, holati)

## 3. Key End-to-End User Flows

Bu oqimlar dizaynda alohida e'tibor talab qiladi — har biri bir nechta ekran/holatni
o'z ichiga oladi:

### 3.1 Registration → Approval → Login
Telefon+parol bilan ro'yxatdan o'tgan foydalanuvchi **darhol kira olmaydi** —
"Hisobingiz admin tasdiqlashini kutmoqda" holati ko'rsatilishi kerak. Admin tasdiqlagach
bildirishnoma keladi (Telegram ulangan bo'lsa botdan ham), shundan keyingina login
mumkin. **Muqobil yo'l:** Telegram bot orqali ro'yxatdan o'tish — bu avtomatik
tasdiqlangan hisoblanadi, kutish shart emas.

### 3.2 Taking a Quiz (most complex flow)
1. Student test ro'yxatida testni ko'radi — agar uning sinfi uchun mo'ljallanmagan
   bo'lsa, umuman ko'rinmasligi/bosib bo'lmasligi kerak.
2. "Boshlash" bosilganda: agar hali vaqti kelmagan/vaqti o'tgan bo'lsa — aniq xabar
   ("Boshlanish vaqti: 10:00 01.01.2026 (Toshkent vaqti)").
3. Boshlagach — **countdown timer** darhol ishga tushishi SHART (`effectiveTimeLimit`
   daqiqada). Vaqt tugaganda frontend **avtomatik submit** qilishi kerak — chunki endi
   backend ham vaqtni tekshiradi (20 soniya zahira bilan) va kech kelgan submit'ni
   `400` xatolik bilan rad etib, urinishni "vaqt tugadi" (`expired`, 0 ball) deb
   yopadi. Shuning uchun frontend countdown'ni **sinxron va ishonchli** qilish kritik
   — aks holda student vaqtni frontendda ko'rib turib ham urinishni yo'qotishi mumkin.
4. Javob yuborilgach: agar faqat multiple_choice/true_false bo'lsa — natija darhol
   (ball, o'tdi/o'tmadi). Agar ochiq savol bo'lsa — "Tekshirilmoqda, natija tayinlangach
   xabar beramiz" holati.
5. Keyinroq (teacher tekshirgach) — bildirishnoma, natija yangilanadi.

### 3.3 Purchasing Premium
1. Premium sahifasida 4 reja (30/90/180/365 kun) — har birida narx, oyiga narx,
   chegirma %. Agar foydalanuvchi allaqachon premium bo'lsa — joriy tugash sanasi va
   "yana sotib olib, muddatni uzaytirish" imkoniyati ko'rsatiladi (yangi reja eskisi
   ustiga **qo'shiladi**, almashtirmaydi).
2. Ixtiyoriy promokod kiritish (premium **va** kurs xaridlarida ishlaydi — wallet/donation'da ishlamaydi).
3. To'lov usuli tanlash: **Multicard** (checkout'ga yo'naltiriladi, keyin qaytib keladi
   — "to'lov tekshirilmoqda" holatini ko'rsatish kerak, chunki tasdiqlash bir oz vaqt
   olishi mumkin) YOKI **hamyon balansidan** (agar balans yetarli bo'lsa — darhol
   natija, Multicard'ga chiqilmaydi).
4. Muvaffaqiyatli bo'lgach — "Premium faollashtirildi" + o'z roliga mos imkoniyatlar
   ro'yxati (student: 1.5x olmos, premium-only mukofotlar, 3x kunlik barabon; teacher:
   o'z testlarida kengroq urinish limiti).

### 3.4 Redeeming a Reward (3-stage)
1. Student katalogdan mukofot tanlaydi, diamond yetarli bo'lsa "Almashtirish" —
   darhol diamond yechiladi, so'rov **"kutilmoqda"** holatida yaratiladi.
2. Admin panelida so'rov ko'rinadi → admin "Tasdiqlash" yoki "Rad etish" (sabab bilan,
   rad etilsa diamond qaytariladi — buni studentga aniq ko'rsatish kerak).
3. Tasdiqlangandan keyin — admin jismonan mukofotni topshirgach "Yetkazildi" deb
   belgilaydi (izoh bilan).
4. Student har bosqichda bildirishnoma oladi, "Mening so'rovlarim" sahifasida holat
   jonli yangilanadi (kim qachon tasdiqlagan/yetkazgan — audit sifatida ko'rsatish mumkin).

### 3.5 Teacher — Grading Open-Ended Answers
Natijalar sahifasida "tekshirish kerak" degan belgi bilan ko'rinadi. Teacher har bir
ochiq javobni o'qib, ball qo'yadi (+ ixtiyoriy izoh). **Eslatma:** bu amal muqobil
ravishda Telegram botning o'zida ham (`/tekshir` buyrug'i) qilinishi mumkin — frontend
bu haqda bildirishnomada eslatma ko'rsatishi mumkin ("Botda tekshirish" tugmasi bilan),
lekin asosiy oqim frontendda bo'lishi kerak.

### 3.6 Linking Telegram
Profil sahifasida "Telegramni ulash" tugmasi — bosilganda bir martalik deep-link
yaratiladi (`t.me/<bot>?start=<token>`, 5 daqiqa amal qiladi). Foydalanuvchi shu
linkni bosib botga o'tadi, bot avtomatik ulaydi. Frontend buni **QR kod** yoki
to'g'ridan-to'g'ri link sifatida ko'rsatishi mumkin (mobil qurilmada link, desktopda QR
qulayroq bo'lishi mumkin — dizayn bosqichida hal qilinadi).

### 3.7 Opening as a Telegram Mini App
Frontend Telegram ichida (Mini App sifatida) ochilganda, login oqimi **butunlay
boshqacha va avtomatik** bo'lishi kerak — telefon/parol yoki OTP so'ralmaydi:

1. Sahifa yuklanganda frontend `window.Telegram.WebApp.initData`ni o'qiydi (Telegram
   SDK — `telegram-web-app.js` — Mini App ichida avtomatik mavjud bo'ladi).
2. Shu qiymat `POST /auth/telegram-webapp` ga `{ initData }` sifatida yuboriladi.
   Backend buni bot tokeni bilan HMAC orqali tasdiqlaydi (soxtalashtirish mumkin
   emas) va 24 soatdan eski bo'lsa rad etadi.
3. **Agar foydalanuvchi avval botdan (`/start`) ro'yxatdan o'tgan bo'lsa** — darhol
   JWT token qaytadi, foydalanuvchi hech qanday forma to'ldirmasdan ichkariga kiradi.
4. **Agar foydalanuvchi hali botga umuman yozmagan bo'lsa** — `404` xatolik qaytadi
   ("Foydalanuvchi topilmadi. Avval botdan ro'yxatdan o'ting"). Bu holatda frontend
   aniq yo'riqnoma ko'rsatishi kerak: "Avval botga o'ting va /start bosing" + botga
   olib boradigan tugma — chunki Mini App orqali **yangi hisob yaratib bo'lmaydi**
   (Telegram profilida telefon raqami yo'q, faqat bot kontaktni so'rab, ro'yxatdan
   o'tkaza oladi).
5. Muvaffaqiyatli bo'lsa — qolgan butun ilova (sahifalar, API chaqiruvlari) oddiy
   veb-versiya bilan **bir xil** ishlaydi, faqat token olish usuli farq qiladi.

> **Eslatma:** to'lov (Multicard checkout) Telegram'ning ichki WebView'ida har doim
> silliq ochilmasligi mumkin — dizayn bosqichida checkout'ni tashqi brauzerda ochish
> (`Telegram.WebApp.openLink()`) kerak bo'lishi mumkinligini hisobga olish kerak.

### 3.8 Teacher — Sharing a Quiz with Another Teacher
Masalan 4-A sinf o'qituvchisi testini 4-V sinf o'qituvchisiga ulashmoqchi:

1. 4-A o'qituvchisi "Mening testlarim"da (faqat **standalone** testlar uchun chiqadi
   — kursga/darsga bog'langan testlar ulashilmaydi) "Ulashish" tugmasini bosadi,
   ochilgan **qidiruv bilan select**da (`GET /users/teachers?search=...`) 4-V
   o'qituvchisini ism/telefon bo'yicha topib tanlaydi (telefon raqamini qo'lda
   kiritish shart emas).
2. 4-V o'qituvchisiga bildirishnoma keladi ("Sizga test ulashildi"), "Menga
   ulashilganlar" sahifasida so'rov "kutilmoqda" holatida ko'rinadi.
3. 4-V o'qituvchisi **"Qabul qilish"** bosadi → backend avtomatik ravishda testning
   **to'liq mustaqil nusxasini** (barcha savollar bilan) yaratadi, egasi endi 4-V
   o'qituvchisi bo'ladi, lekin **`isActive: false`** va eski (4-A) sinf hali
   `targetGrades`da turadi.
4. Frontend buni darhol **"Test tahrirlash"** sahifasiga yo'naltirishi kerak — 4-V
   o'qituvchisi birinchi navbatda `targetGrades`ni o'z sinfiga (4-V) o'zgartirib,
   kerak bo'lsa savollarni tahrirlab, keyin faollashtiradi. Bu qadam **shart** —
   aks holda test hamon 4-A sinf uchun qolib ketadi va 4-V o'quvchilari uni
   boshlay olmaydi (403).
5. 4-V **"Rad etish"**ni tanlasa — 4-A o'qituvchisiga bildirishnoma keladi, hech
   narsa yaratilmaydi.
6. Ikkala tomon ham o'z tarixini ko'ra oladi: "Men ulashganlar" (4-A uchun) va
   "Menga ulashilganlar" (4-V uchun) — har birida holat (kutilmoqda/qabul
   qilindi/rad etildi).

## 4. States to Always Handle (UX Edge Cases)

- **Bo'sh holatlar** — hali kurs/test/mukofot/bildirishnoma yo'q bo'lganda nima ko'rsatiladi.
- **Ruxsat yo'q holatlar** — `403` kelganda (masalan boshqa sinf uchun test, premiumOnly
  mukofot) — tushunarli, harakatga undaydigan xabar (masalan "Faqat Premium
  foydalanuvchilar uchun" + "Premium sotib olish" tugmasi).
- **Tasdiqlanmagan hisob** — login urinishida `403` + aniq xabar.
- **Bloklangan hisob** — darhol chiqarib yuborish + sabab.
- **Token eskirgan/yaroqsiz** (`401`, boshqa qurilmada parol o'zgartirilgan) — avtomatik
  login sahifasiga qaytarish.
- **Vaqt tugashi** (test, promokod, premium) — real vaqtli countdown yoki aniq sana
  ko'rsatilishi kerak, "o'tib ketgan" holatlar alohida belgilansin.
- **Yuklab olish/fayl yuklash davomida progress** (kitob fayli, test materiali — katta
  fayllar bo'lishi mumkin, 5–20MB gacha).

## 5. Full API Reference (Appendix)

Barcha endpoint — baza manzil `{BASE_URL}/api/v1`. "Auth" ustuni: **public** — token
shart emas; **login** — istalgan login qilingan foydalanuvchi; aks holda ruxsat
etilgan rollar ko'rsatilgan. Barcha so'rov/javob tafsilotlari (to'liq validatsiya
qoidalari, javob namunalari) uchun backend ishga tushganda `/api-docs` (Swagger UI).

### Auth (`/auth`)
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /auth/register | public | Ro'yxatdan o'tish (student/teacher) — token qaytmaydi, admin tasdiqlashi kerak |
| POST | /auth/login | public | Telefon+parol bilan kirish |
| POST | /auth/telegram | public | Bot bergan 6 xonali OTP kod bilan kirish |
| POST | /auth/telegram-webapp | public | **Telegram Mini App uchun** — `window.Telegram.WebApp.initData` bilan avtomatik kirish (yangi hisob yaratmaydi, qarang 3.7) |
| GET | /auth/me | login | Joriy foydalanuvchi profilini olish |
| POST | /auth/logout | login | Chiqish (barcha eski tokenlar bekor bo'ladi) |

### Users (`/users`)
| Method | Path | Auth | Description |
|---|---|---|---|
| PATCH | /users/me | login | O'z profilini yangilash: `name` (student uchun e'tiborga olinmaydi), `grade{number,letter}` |
| PATCH | /users/me/password | login | Parol o'zgartirish: `oldPassword`, `newPassword` |
| POST | /users/me/avatar | login | Avatar yuklash (multipart: `avatar`) |
| POST | /users/me/telegram/link | login | Telegram ulash uchun bir martalik deep-link |
| DELETE | /users/me/telegram | login | Telegramni profildan uzish |
| GET | /users/leaderboard | login | Diamond reytingi |
| GET | /users/teachers | login | O'qituvchilarni qidirish (test ulashish uchun select) — filtr: `search` (ism/telefon), ko'pi bilan 20 ta, so'ragan o'zi natijaga kirmaydi |
| GET | /users | admin, superadmin | Foydalanuvchilar ro'yxati (filtr: `role`, `isVerified`, `search`, `page`, `limit`) |
| GET | /users/:id | admin, superadmin | Bitta foydalanuvchi |
| PATCH | /users/:id/verify | admin, superadmin | Ro'yxatdan o'tishni tasdiqlash |
| PATCH | /users/:id/block | admin, superadmin | Bloklash/blokdan chiqarish: `isBlocked` |
| POST | /users | superadmin | Istalgan rolda user yaratish: `name,phone,password,role,tarif,grade` |
| PATCH | /users/:id | superadmin | Tahrirlash (rol shu jumladan): `name,phone,role,tarif,grade` |
| DELETE | /users/:id | superadmin | O'chirish |
| PATCH | /users/:id/reset-password | superadmin | Parolni majburan tiklash: `newPassword` |
| POST | /users/:id/avatar | superadmin | Boshqa user uchun avatar (multipart: `avatar`) |
| DELETE | /users/:id/avatar | superadmin | Boshqa userning avatarini o'chirish |

### Categories (`/categories`, `/book-categories`) — identical shape for both
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /categories | public | Kurs kategoriyalari ro'yxati |
| GET | /categories/:id | public | Bitta kategoriya |
| POST | /categories | teacher, admin, superadmin | Yaratish: `name,description,icon` |
| PATCH | /categories/:id | teacher, admin, superadmin | Tahrirlash: `name,description,icon,isActive` |
| DELETE | /categories/:id | admin, superadmin | O'chirish |

> `/book-categories` xuddi shu 5 endpointning aynan o'zi, faqat kitob kategoriyalari uchun.

### Books (`/books`)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /books | public (ixtiyoriy token) | Ro'yxat — filtr: `category,grade,search,page,limit`; login bo'lsa o'z draftlari ham ko'rinadi |
| GET | /books/:id | public (ixtiyoriy token) | Bitta kitob |
| GET | /books/:id/download | public (ixtiyoriy token) | Fayl yuklab olish (PDF, `downloadsCount` oshadi) |
| POST | /books | teacher, admin, superadmin | Yaratish: `title,author,description,category,grade` |
| PATCH | /books/:id | egasi yoki admin/superadmin | Tahrirlash (`isPublished` shu orqali ham) |
| DELETE | /books/:id | teacher, admin, superadmin | O'chirish |
| POST | /books/:id/cover | teacher, admin, superadmin | Muqova yuklash (multipart: `cover`) |
| POST | /books/:id/file | teacher, admin, superadmin | PDF fayl yuklash (multipart: `file`) |

### Courses (`/courses`) — lesson/review creation nested here
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /courses | public (ixtiyoriy token) | Ro'yxat — filtr: `category,search,sort(popular\|rating\|newest\|price_asc\|price_desc),isFree,excludeEnrolled,page,limit`. `excludeEnrolled=true` — "Kurslarim" ostidagi katalogda student allaqachon yozilgan kurslarni chiqarib tashlash uchun (faqat student + token bo'lsa ishlaydi, aks holda e'tiborsiz qoldiriladi). Javob: `{courses:[...], meta:{total,page,limit,totalPages}}` — filtr sahifalashdan oldin qo'llanadi, shuning uchun `meta` har doim to'g'ri. **YANGI**: har bir kurs `lessonsCount` (darslar soni) va `studentsCount` (yozilganlar soni) bilan qaytadi |
| GET | /courses/:id | public (ixtiyoriy token) | Bitta kurs. **YANGI**: `data.course` endi `lessonsCount` va `studentsCount` ham o'z ichiga oladi |
| POST | /courses | teacher, admin, superadmin | Yaratish: `title,description,category,price` |
| PATCH | /courses/:id | teacher, admin, superadmin | Tahrirlash (`isPublished` shu orqali ham) |
| DELETE | /courses/:id | teacher, admin, superadmin | O'chirish |
| POST | /courses/:id/thumbnail | teacher, admin, superadmin | Muqova yuklash (multipart: `thumbnail`) |
| GET | /courses/:id/stats | teacher, admin, superadmin | Kurs statistikasi (yozilganlar, daromad) |
| GET | /courses/:id/lessons | public (token ixtiyoriy) | Kursdagi darslar ro'yxati. **MUHIM:** kursga yozilgan studentga to'liq ma'lumot berish uchun `Authorization` header albatta yuborilsin — bo'lmasa har doim `locked:true` qaytadi. To'liq darslardagi `videoUrl`/`attachments` endi imzolangan `/media/lessons/...` havolasi (pastga qarang) |
| POST | /courses/:id/lessons | teacher, admin, superadmin | Yangi dars: `title,description,content,videoUrl,order` |
| GET | /courses/:id/reviews | public | Kurs sharhlari |
| POST | /courses/:id/reviews | student | Sharh qoldirish: `rating,comment` |

### Lessons (`/lessons`) — single-lesson operations only
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /lessons/:id | public (token ixtiyoriy) | Bitta dars. **MUHIM:** kursga yozilgan studentga to'liq ma'lumot berish uchun `Authorization` header albatta yuborilsin — bo'lmasa har doim `locked:true` qaytadi. Qulf holatida `{_id,title,order,course,locked:true}` (`course` bor — frontend kurs sahifasiga yo'naltira oladi, `videoUrl`/`attachments` umuman berilmaydi). To'liq javobda `videoUrl`/`attachments` endi imzolangan `/media/lessons/...` havolasi |
| PATCH | /lessons/:id | teacher, admin, superadmin | Tahrirlash: `title,description,content,videoUrl,order` |
| DELETE | /lessons/:id | teacher, admin, superadmin | O'chirish |
| POST | /lessons/:id/material | teacher, admin, superadmin | Qo'shimcha material (rasm/pdf/video, 20MB gacha) biriktirish — `attachments`ga qo'shiladi (multipart: `material`). Javobdagi havola ham imzolangan |
| POST | /lessons/:id/video | teacher, admin, superadmin | Darsning ASOSIY videosini yuklash, `lesson.videoUrl`ni belgilaydi (multipart: `video`, ixtiyoriy `durationMinutes`). `attachments`ga qo'shilmaydi, eski video almashtirilganda o'chiriladi. Max 300MB, `video/mp4\|webm\|quicktime`. Javobdagi `videoUrl` ham imzolangan |
| POST | /lessons/:id/complete | student | Darsni "tugatildi" deb belgilash. Enrollment'ning `progress`ini (0-100) qayta hisoblaydi |

### Media (`/media`) — **YANGI**, himoyalangan dars fayllari
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /media/lessons/:filename?exp&uid&sig | token kerak emas, imzo kerak | Dars video/materialining haqiqiy fayli. `GET /lessons/:id` yoki `GET /courses/:id/lessons` javobidagi `videoUrl`/`attachments` ichida TAYYOR holda keladi — frontend bu URL'ni **o'zgartirmasdan, to'g'ridan-to'g'ri** `<video src>`/`<a href>`ga qo'yadi. 15 daqiqadan keyin havola eskiradi (sahifa qayta yuklansa yangisi keladi). Range so'rovlari (video oldinga surish) qo'llab-quvvatlanadi. **Eski `/uploads/lessons/...` havolalari endi ishlamaydi (404)** — agar frontendda qayerdadir bu yo'l qattiq yozilgan (hardcoded) bo'lsa, albatta javobdagi yangi `videoUrl`ga almashtiring |

### Reviews (`/reviews`) — single-review operations only
| Method | Path | Auth | Description |
|---|---|---|---|
| PATCH | /reviews/:id | login (egasi) | Tahrirlash: `rating,comment` |
| DELETE | /reviews/:id | login (egasi) | O'chirish |

### Enrollment (`/enrollment`)
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /enrollment | student | Bepul kursga yozilish: `courseId` |
| GET | /enrollment/my | login | O'z yozilishlarim. **YANGI**: har bir element `progress` (0-100, haqiqiy qiymat — ilgari doim 0 edi) va `course.lessonsCount`, `course.teacher.name` bilan qaytadi |
| GET | /enrollment/:id | login | Bitta yozilish. **YANGI**: `course.lessonsCount` ham bor |

### Notifications (`/notifications`)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /notifications | login | Ro'yxat |
| PATCH | /notifications/read-all | login | Hammasini o'qilgan qilish |
| PATCH | /notifications/:id/read | login | Bittasini o'qilgan qilish |
| DELETE | /notifications/:id | login | O'chirish |

### Quizzes + Attempts (`/quizzes`) — `quiz-attempts` nested here too
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /quizzes | public | Ro'yxat — filtr: `targetType` |
| GET | /quizzes/my | login | O'zim yaratgan testlar (`questionsCount` bilan) |
| GET | /quizzes/:id | public | Bitta test (javobsiz — student uchun) |
| GET | /quizzes/:id/answers | teacher, admin, superadmin | Bitta test (to'g'ri javoblar bilan) |
| POST | /quizzes | teacher, admin, superadmin | Yaratish: `title,targetType,targetId,passingScore,maxAttempts,timeLimit,targetGrades[],availableFrom,availableUntil` |
| PATCH | /quizzes/:id | teacher, admin, superadmin | Tahrirlash (`isActive` shu orqali ham) |
| DELETE | /quizzes/:id | teacher, admin, superadmin | O'chirish |
| POST | /quizzes/:id/questions | teacher, admin, superadmin | Savol qo'shish: `text,type,options[],correctAnswer,sampleAnswer,points` |
| PATCH | /quizzes/questions/:questionId | teacher, admin, superadmin | Savolni tahrirlash |
| DELETE | /quizzes/questions/:questionId | teacher, admin, superadmin | Savolni o'chirish |
| POST | /quizzes/:quizId/start | student | Urinishni boshlash |
| POST | /quizzes/attempts/:attemptId/submit | student | Javoblarni yuborish: `answers[{questionId,givenAnswer}]` |
| GET | /quizzes/:quizId/my-attempts | login | O'zimning shu testdagi urinishlarim |
| GET | /quizzes/:quizId/results | teacher, admin, superadmin | Barcha studentlar natijalari |
| PATCH | /quizzes/attempts/:attemptId/review | teacher, admin, superadmin | Ochiq savolni baholash: `reviews[{questionId,pointsEarned,feedback}]` |
| GET | /quizzes/attempts/:attemptId | login (egasi) yoki teacher/admin/superadmin | Bitta urinishni savol-javob tafsiloti bilan ko'rish |
| DELETE | /quizzes/attempts/:attemptId | **superadmin** | Urinishni o'chirish (xato ketgan testlar uchun) — `maxAttempts`dan chiqadi, berilgan diamond qaytariladi |
| POST | /quizzes/:id/share | teacher, admin, superadmin (egasi) | Testni boshqa o'qituvchiga ulashish: `toTeacherPhone` — faqat standalone testlar (qarang 3.8) |
| GET | /quizzes/shares/incoming | teacher, admin, superadmin | Menga ulashilgan testlar — filtr: `status` |
| GET | /quizzes/shares/outgoing | teacher, admin, superadmin | Men ulashgan testlar — filtr: `status` |
| PATCH | /quizzes/shares/:id/accept | teacher, admin, superadmin (qabul qiluvchi) | Qabul qilish → mustaqil nusxa yaratiladi (`isActive:false`) |
| PATCH | /quizzes/shares/:id/reject | teacher, admin, superadmin (qabul qiluvchi) | Rad etish |

### Payment (`/payment`)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /payment/premium-plans | public | 4 rejaning narxlari (`30d/90d/180d/365d`) |
| POST | /payment/create | login | To'lov yaratish: `purpose,courseId,plan,amount,promoCode,useBalance,returnUrl` → `{invoiceId,purpose,amount,checkoutUrl,paidWithBalance,status}`. `promoCode` faqat `purpose='premium'` yoki `'course'`da ishlaydi. 100% chegirma yakuniy summani 0 ga tushirsa — Multicard'ga chiqilmaydi, `paidWithBalance:true, amount:0, status:'success'` bilan darhol yakunlanadi. Chegirmadan keyingi summa 100 so'mdan kam (lekin 0 emas) bo'lsa — `400` |
| POST | /payment/callback | public (Multicard webhook) | **Frontend ishlatmaydi** — Multicard serveri chaqiradi |
| GET | /payment/status/:invoiceId | login | To'lov holatini tekshirish (checkout'dan qaytgandan keyin poll qilish uchun) |
| GET | /payment/my | login | O'z to'lovlar tarixim — filtr: `purpose,status,page,limit` |
| GET | /payment | admin, superadmin | Barcha to'lovlar — filtr: `userId,purpose,status,page,limit` |

### Promo Codes (`/promo-codes`)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /promo-codes/preview | public | Promokodni oldindan tekshirish (query: `code,purpose` + `purpose='premium'` bo'lsa `plan`, `purpose='course'` bo'lsa `courseId`) — checkout'da "qo'llash" tugmasi bosilganda |
| GET | /promo-codes | admin, superadmin | Ro'yxat |
| POST | /promo-codes | admin, superadmin | Yaratish: `code,discountPercent,expiresAt,maxUses` |
| PATCH | /promo-codes/:id | admin, superadmin | Tahrirlash |
| DELETE | /promo-codes/:id | admin, superadmin | O'chirish |

### Rewards (`/rewards`)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /rewards | public | Katalog |
| GET | /rewards/:id | public | Bitta mukofot |
| POST | /rewards/:id/redeem | student | Diamondga almashtirish (403 — agar `premiumOnly` va student premium emas) |
| GET | /rewards/redemptions/my | student | O'z so'rovlarim (holat tarixi) |
| GET | /rewards/redemptions | admin, superadmin | Barcha so'rovlar — filtr: `status` |
| PATCH | /rewards/redemptions/:id/approve | admin, superadmin | Bosqich 1: tasdiqlash |
| PATCH | /rewards/redemptions/:id/reject | admin, superadmin | Rad etish: `reason` |
| PATCH | /rewards/redemptions/:id/deliver | admin, superadmin | Bosqich 2 (yakuniy): topshirildi: `note` |
| POST | /rewards | admin, superadmin | Katalogga qo'shish: `title,description,cost,stock,premiumOnly` |
| PATCH | /rewards/:id | admin, superadmin | Tahrirlash |
| DELETE | /rewards/:id | admin, superadmin | O'chirish |
| POST | /rewards/:id/image | admin, superadmin | Rasm yuklash (multipart: `image`) |

### Certificates (`/certificates`)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /certificates/verify/:certificateNumber | public | Haqiqiyligini tekshirish |
| GET | /certificates/my | login | O'z sertifikatlarim |
| GET | /certificates/:id/download | login | PDF yuklab olish |

### Stats (`/stats`)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /stats/teacher | teacher, admin, superadmin | O'z dashboard statistikam |
| GET | /stats/top-teachers | login | Eng faol o'qituvchilar reytingi |

### Daily Spin (`/daily-spin`)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /daily-spin/status | student | Holat (qolgan aylanishlar, streak) — aylantirmasdan |
| POST | /daily-spin/spin | student | Aylantirish (diamond yutib olish) |

## 6. Out of Scope (deliberately not covered here)

- Vizual dizayn: rang palitra, shrift, logotip, komponent kutubxonasi tanlovi — bularni
  alohida dizayn sessiyasida hal qilish kerak.
- Frontend texnologiya tanlovi (React/Next/Vue/boshqa) — ushbu hujjat texnologiyadan
  mustaqil.
- Backend o'zgarishlari — bu hujjat mavjud backend imkoniyatlariga asoslangan, agar
  dizayn jarayonida backendda yo'q biror funksiya kerak bo'lib qolsa, alohida backend
  so'rovi sifatida ko'rib chiqilishi kerak.
