const sendSuccess = (res, statusCode, data) =>
  res.status(statusCode).json({
    status: 'success',
    data,
  })

const sendError = (res, statusCode, message, details = null) =>
  res.status(statusCode).json({
    status: 'error',
    message,
    details,
  })

module.exports = {
  sendSuccess,
  sendError,
}
