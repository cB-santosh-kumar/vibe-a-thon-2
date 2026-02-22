const buildMeta = (req, res, extra = {}) => ({
  method: req.method,
  path: req.originalUrl,
  status: res.statusCode,
  requestId: req.headers['x-request-id'] || null,
  ...extra,
})

const logger = {
  info: (message, meta) => {
    console.log(
      JSON.stringify({
        level: 'info',
        message,
        timestamp: new Date().toISOString(),
        ...meta,
      })
    )
  },
  error: (message, meta) => {
    console.error(
      JSON.stringify({
        level: 'error',
        message,
        timestamp: new Date().toISOString(),
        ...meta,
      })
    )
  },
}

const requestLogger = (req, res, next) => {
  const start = process.hrtime.bigint()
  logger.info('request', buildMeta(req, res))

  res.on('finish', () => {
    const end = process.hrtime.bigint()
    const durationMs = Number(end - start) / 1e6
    logger.info('response', buildMeta(req, res, { durationMs }))
  })

  next()
}

const errorLogger = (err, req, res, next) => {
  logger.error('error',
    buildMeta(req, res, {
      error: err.message,
      stack: err.stack,
    })
  )
  next(err)
}

module.exports = {
  logger,
  requestLogger,
  errorLogger,
}
