const jwt = require('jsonwebtoken');
const User = require('../modules/users/user.model');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

const authenticate = asyncHandler(async (req, res, next) => {
  let token;

  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  if (!token) {
    throw new ApiError(401, "Ruxsat yo'q. Token topilmadi");
  }

  const decoded = jwt.verify(token, process.env.JWT_TOKEN_SECRET);

  const user = await User.findById(decoded.id);
  if (!user) {
    throw new ApiError(401, 'Foydalanuvchi topilmadi');
  }

  if (user.isBlocked) {
    throw new ApiError(403, 'Sizning hisobingiz bloklangan');
  }

  if (!user.isVerified) {
    throw new ApiError(403, 'Hisobingiz hali administrator tomonidan tasdiqlanmagan');
  }

  // Parol o'zgargan yoki logout qilingan bo'lsa, eski token shu yerda rad etiladi
  if (decoded.tokenVersion !== user.tokenVersion) {
    throw new ApiError(401, 'Token muddati tugagan, qayta kiring');
  }

  req.user = user;
  next();
});

// Public endpointlar uchun: token bo'lsa req.user'ni to'ldiradi, bo'lmasa yoki
// yaroqsiz bo'lsa ham so'rovni rad etmay davom ettiradi.
const optionalAuthenticate = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) return next();

  try {
    const decoded = jwt.verify(token, process.env.JWT_TOKEN_SECRET);
    const user = await User.findById(decoded.id);

    if (user && !user.isBlocked && user.isVerified && decoded.tokenVersion === user.tokenVersion) {
      req.user = user;
    }
  } catch {
    // noto'g'ri/eskirgan token — public endpoint sifatida baribir davom etadi
  }

  next();
});

authenticate.optional = optionalAuthenticate;

module.exports = authenticate; // ← shu muhim
