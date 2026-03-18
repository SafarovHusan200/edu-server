const notFound = (req, res) => {
  res.status(404).json({
    success: false,
    statusCode: 404,
    message: `Route topilmadi: ${req.method} ${req.originalUrl}`,
  });
};

module.exports = notFound;
