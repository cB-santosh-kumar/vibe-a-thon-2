const VALID_TYPES = ['straight', 'turn']
const VALID_DENSITIES = ['low', 'medium', 'high']
const VALID_EMERGENCY_LEVELS = ['low', 'medium', 'high']

const validateSimulationPayload = (payload) => {
  const errors = []

  if (!payload || typeof payload !== 'object') {
    errors.push('Payload must be an object')
    return errors
  }

  if (!payload.intersectionName || typeof payload.intersectionName !== 'string') {
    errors.push('intersectionName is required')
  }

  if (!Array.isArray(payload.lanes) || payload.lanes.length === 0) {
    errors.push('lanes must be a non-empty array')
  } else {
    payload.lanes.forEach((lane, index) => {
      if (!lane.name || typeof lane.name !== 'string') {
        errors.push(`lanes[${index}].name is required`)
      }
      const vehicles = Number(lane.vehicles)
      if (Number.isNaN(vehicles) || vehicles < 0) {
        errors.push(`lanes[${index}].vehicles must be >= 0`)
      }
      if (!VALID_TYPES.includes(lane.type)) {
        errors.push(`lanes[${index}].type must be straight or turn`)
      }
      if (!VALID_DENSITIES.includes(lane.density)) {
        errors.push(`lanes[${index}].density must be low, medium, or high`)
      }
    })
  }

  const timing = payload.timing || {}
  ;['green', 'yellow', 'red', 'cycle'].forEach((key) => {
    const value = Number(timing[key])
    if (Number.isNaN(value) || value < 0) {
      errors.push(`timing.${key} must be a number >= 0`)
    }
  })

  const emergency = payload.options?.emergencyPriority
  if (emergency) {
    if (typeof emergency.enabled !== 'boolean') {
      errors.push('options.emergencyPriority.enabled must be boolean')
    }
    if (emergency.enabled) {
      if (!emergency.laneName || typeof emergency.laneName !== 'string') {
        errors.push('options.emergencyPriority.laneName is required')
      } else if (!payload.lanes.some((lane) => lane.name === emergency.laneName)) {
        errors.push('options.emergencyPriority.laneName must match a lane name')
      }
      if (!VALID_EMERGENCY_LEVELS.includes(emergency.level)) {
        errors.push('options.emergencyPriority.level must be low, medium, or high')
      }
    }
  }

  return errors
}

const validatePlaybackPayload = (payload) => {
  const errors = validateSimulationPayload(payload)
  const stepMs = Number(payload?.stepMs)

  if (payload?.stepMs !== undefined) {
    if (Number.isNaN(stepMs) || stepMs < 100 || stepMs > 2000) {
      errors.push('stepMs must be a number between 100 and 2000')
    }
  }

  return errors
}

module.exports = {
  validateSimulationPayload,
  validatePlaybackPayload,
}
