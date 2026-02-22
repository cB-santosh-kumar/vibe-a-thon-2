const { logger } = require('./logger')

const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err)
  }

  const statusCode = err.statusCode || 500
  const message = err.message || 'Internal server error'

  logger.error('handler', { message, statusCode })

  return res.status(statusCode).json({
    status: 'error',
    message,
  })
}

module.exports = errorHandler
