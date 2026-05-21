export const notFound = (req, res, next) => {
  res.status(404);
  next(new Error(`Route not found: ${req.originalUrl}`));
};

export const errorHandler = (error, _req, res, _next) => {
  if (error.name === "MulterError") {
    res.status(400).json({
      message: error.code === "LIMIT_FILE_SIZE" ? "File is too large." : error.message
    });
    return;
  }

  const statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;

  res.status(statusCode).json({
    message: error.message || "Something went wrong."
  });
};
