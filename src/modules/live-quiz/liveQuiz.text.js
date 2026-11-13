// src/modules/live-quiz/liveQuiz.text.js
// Savol matni markdown (frontendda @uiw/react-md-editor). Rasmlar matn ichida
// ![nom](/uploads/live-quiz/...) ko'rinishida bo'ladi — faqat o'zimiz yuklagan fayllar.
// Base64 (data:) va tashqi havolalar rad etiladi: base64 har savolda 200 tagacha telefonga
// Socket.IO orqali ketib, maktab internetini bo'g'ib qo'yadi; tashqi rasm esa doskada
// nomaqbul kontent yoki kuzatuv pikseli bo'lib chiqishi mumkin.

const TEXT_MAX_LENGTH = 2000;
const MAX_IMAGES = 3;
const IMAGE_PREFIX = '/uploads/live-quiz/';

const isOwnImage = (url) => typeof url === 'string' && url.startsWith(IMAGE_PREFIX) && !url.includes('..');

// ![alt](url) yoki ![alt](url "sarlavha") — url'ni ajratib oladi
const MARKDOWN_IMAGE = /!\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+["'][^)]*["'])?\s*\)/g;

// Xato bo'lsa — matn, bo'lmasa null
const checkQuestionText = (text) => {
  if (typeof text !== 'string' || !text.trim()) return 'Savol matni kiritilishi shart';
  if (text.length > TEXT_MAX_LENGTH) return `Savol matni ${TEXT_MAX_LENGTH} ta belgidan oshmasligi kerak`;

  // HTML <img> markdown tekshiruvini aylanib o'tishi mumkin (rehype-sanitize http(s) rasmlarga ruxsat beradi)
  if (/<\s*img\b/i.test(text)) return "Rasmni HTML <img> bilan emas, markdown ![](...) bilan qo'shing";
  if (/data:\s*image\//i.test(text)) {
    return "Base64 rasm mumkin emas — rasmni POST /live-quizzes/upload-image orqali yuklang";
  }

  const urls = [...text.matchAll(MARKDOWN_IMAGE)].map((m) => m[1]);
  if (urls.length > MAX_IMAGES) return `Savolda ko'pi bilan ${MAX_IMAGES} ta rasm bo'lishi mumkin`;
  if (urls.some((url) => !isOwnImage(url))) {
    return "Rasm POST /live-quizzes/upload-image orqali yuklangan bo'lishi kerak";
  }
  return null;
};

module.exports = { checkQuestionText, isOwnImage, TEXT_MAX_LENGTH, MAX_IMAGES, IMAGE_PREFIX };
