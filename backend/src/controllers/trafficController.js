const trafficService = require('../services/trafficService')
const { validateSimulationPayload, validatePlaybackPayload } = require('../utils/validation')
const { sendError } = require('../utils/response')

const simulate = (req, res, next) => {
  try {
    const errors = validateSimulationPayload(req.body)
    if (errors.length > 0) {
      return sendError(res, 400, 'Invalid payload', { errors })
    }

    const result = trafficService.runSimulation(req.body)
    return res.status(200).json(result)
  } catch (error) {
    return next(error)
  }
}

const list = (req, res, next) => {
  try {
    const results = trafficService.listSimulations()
    return res.status(200).json({ results })
  } catch (error) {
    return next(error)
  }
}

const playback = (req, res, next) => {
  try {
    const errors = validatePlaybackPayload(req.body)
    if (errors.length > 0) {
      return sendError(res, 400, 'Invalid payload', { errors })
    }

    const stepMs = Number(req.body.stepMs) || 500
    const result = trafficService.generatePlaybackFrames(req.body, stepMs)
    return res.status(200).json(result)
  } catch (error) {
    return next(error)
  }
}

module.exports = {
  simulate,
  list,
  playback,
}
