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

  req.user = user;
  next();
});

module.exports = authenticate; // ← shu muhim
