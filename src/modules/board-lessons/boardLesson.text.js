// src/modules/board-lessons/boardLesson.text.js
// Slayd va mashq matni markdown. Rasmlar matn ichida ![nom](/uploads/board-lessons/...)
// ko'rinishida bo'ladi — faqat o'zimiz yuklagan fayllar (live-quiz/liveQuiz.text.js bilan bir xil
// sabab: base64 doskani/internetni og'irlashtiradi, tashqi rasm nomaqbul kontent bo'lishi mumkin).

const TEXT_MAX_LENGTH = 2000;
const MAX_IMAGES = 3;
const IMAGE_PREFIX = '/uploads/board-lessons/';
const UPLOAD_HINT = 'POST /board-lessons/upload-image';

const isOwnImage = (url) => typeof url === 'string' && url.startsWith(IMAGE_PREFIX) && !url.includes('..');

// ![alt](url) yoki ![alt](url "sarlavha") — url'ni ajratib oladi
const MARKDOWN_IMAGE = /!\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+["'][^)]*["'])?\s*\)/g;

// Xato bo'lsa — matn, bo'lmasa null. label — xabardagi nom ("Mashq matni", "Slayd matni")
const checkMarkdown = (text, { label = 'Matn', required = false } = {}) => {
  if (typeof text !== 'string') return `${label} matn ko'rinishida bo'lishi kerak`;
  if (!text.trim()) return required ? `${label} kiritilishi shart` : null;
  if (text.length > TEXT_MAX_LENGTH) return `${label} ${TEXT_MAX_LENGTH} ta belgidan oshmasligi kerak`;

  if (/<\s*img\b/i.test(text)) return "Rasmni HTML <img> bilan emas, markdown ![](...) bilan qo'shing";
  if (/data:\s*image\//i.test(text)) return `Base64 rasm mumkin emas — rasmni ${UPLOAD_HINT} orqali yuklang`;

  const urls = [...text.matchAll(MARKDOWN_IMAGE)].map((m) => m[1]);
  if (urls.length > MAX_IMAGES) return `${label}da ko'pi bilan ${MAX_IMAGES} ta rasm bo'lishi mumkin`;
  if (urls.some((url) => !isOwnImage(url))) return `Rasm ${UPLOAD_HINT} orqali yuklangan bo'lishi kerak`;
  return null;
};

module.exports = { checkMarkdown, isOwnImage, TEXT_MAX_LENGTH, MAX_IMAGES, IMAGE_PREFIX, UPLOAD_HINT };
