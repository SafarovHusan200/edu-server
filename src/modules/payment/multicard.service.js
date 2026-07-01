// src/modules/payment/multicard.service.js
// Multicard (mesh.multicard.uz) to'lov shlyuzi bilan bevosita ishlaydigan past darajadagi xizmat.
// Bu fayl faqat Multicard API bilan gaplashadi — biznes logikasi (DB) payment.service.js'da.

const axios = require('axios');
const ApiError = require('../../utils/ApiError');

const BASE_URL = process.env.MULTICARD_BASE_URL || 'https://dev-mesh.multicard.uz';
const APPLICATION_ID = process.env.MULTICARD_APP_ID;
const SECRET = process.env.MULTICARD_SECRET;
const STORE_ID = process.env.MULTICARD_STORE_ID;

const http = axios.create({
  baseURL: BASE_URL,
  timeout: 10000, // 10 soniya — Multicard javob bermasa so'rovni to'xtatamiz
});

// ─────────────────────────────────────────
// Token keshi (xotirada) — har so'rovda /auth chaqirmaslik uchun
// ─────────────────────────────────────────
let cachedToken = null;
let tokenExpiresAt = 0; // Date.now() bilan solishtiriladigan millisekund

// Multicard javobidagi xatoni birxil ko'rinishga keltirib, logga yozamiz
const handleMulticardError = (error, action) => {
  const responseData = error.response?.data;
  const code = responseData?.error?.code || 'UNKNOWN';
  const details = responseData?.error?.details || error.message;

  console.error(`❌ Multicard xatosi [${action}]:`, { code, details });

  throw new ApiError(502, `To'lov tizimida xatolik: ${details}`);
};

// ─────────────────────────────────────────
// POST /auth — token olish (keshdan foydalanadi, muddati tugasa yangilaydi)
// ─────────────────────────────────────────
const getToken = async () => {
  const now = Date.now();

  if (cachedToken && now < tokenExpiresAt) {
    return cachedToken;
  }

  try {
    const { data } = await http.post('/auth', {
      application_id: APPLICATION_ID,
      secret: SECRET,
    });

    if (!data?.token) {
      throw new ApiError(502, "Multicard token qaytarmadi");
    }

    cachedToken = data.token;

    // "expiry" — GMT+5 vaqt sifatida keladi, shuning uchun Date orqali parslaymiz.
    // Agar biror sababdan parslay olmasak, ehtiyot uchun 10 daqiqadan keyin qayta so'raymiz.
    const parsedExpiry = data.expiry ? new Date(data.expiry).getTime() : NaN;
    tokenExpiresAt = !Number.isNaN(parsedExpiry) ? parsedExpiry - 60 * 1000 : now + 10 * 60 * 1000;

    return cachedToken;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    handleMulticardError(error, 'getToken');
  }
};

// Har bir himoyalangan so'rov uchun Authorization headerini tayyorlaydi
const authHeaders = async () => ({
  Authorization: `Bearer ${await getToken()}`,
});

// ─────────────────────────────────────────
// POST /payment/invoice — to'lov uchun invoys (checkout) yaratish
// ─────────────────────────────────────────
const createInvoice = async ({ amount, invoiceId, callbackUrl, returnUrl, ofd }) => {
  try {
    const headers = await authHeaders();

    const { data } = await http.post(
      '/payment/invoice',
      {
        store_id: Number(STORE_ID),
        amount, // Multicard summani tiyinda kutadi (1 so'm = 100 tiyin)
        invoice_id: invoiceId,
        callback_url: callbackUrl || process.env.MULTICARD_CALLBACK_URL,
        return_url: returnUrl,
        ofd,
      },
      { headers }
    );

    if (!data?.success || !data?.data?.uuid) {
      throw new ApiError(502, "Multicard invoys yaratmadi");
    }

    return {
      uuid: data.data.uuid,
      checkoutUrl: data.data.checkout_url,
      raw: data.data,
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    handleMulticardError(error, 'createInvoice');
  }
};

// ─────────────────────────────────────────
// GET /payment/invoice/:uuid — invoys holatini tekshirish
// ─────────────────────────────────────────
const getInvoiceStatus = async (uuid) => {
  try {
    const headers = await authHeaders();
    const { data } = await http.get(`/payment/invoice/${uuid}`, { headers });

    return data?.data || data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    handleMulticardError(error, 'getInvoiceStatus');
  }
};

module.exports = {
  getToken,
  createInvoice,
  getInvoiceStatus,
};
