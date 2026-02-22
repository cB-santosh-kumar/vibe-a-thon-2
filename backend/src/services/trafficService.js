const { addSimulation, listSimulations } = require('./simulationStore')

const DENSITY_FACTORS = {
  low: 0.8,
  medium: 1,
  high: 1.25,
}

const TYPE_FACTORS = {
  straight: 1,
  turn: 1.15,
}

const EMERGENCY_BOOSTS = {
  low: 2,
  medium: 4,
  high: 6,
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

const calculateLoad = (lane) => {
  const vehicles = Number(lane.vehicles || 0)
  const densityFactor = DENSITY_FACTORS[lane.density] || 1
  const typeFactor = TYPE_FACTORS[lane.type] || 1
  return vehicles * densityFactor * typeFactor
}

const calculateMetrics = (lanes, timing, greenOverride) => {
  const totalVehicles = lanes.reduce((sum, lane) => sum + Number(lane.vehicles || 0), 0)
  const totalLoad = lanes.reduce((sum, lane) => sum + calculateLoad(lane), 0)

  const green = Math.max(Number(greenOverride ?? timing.green) || 0, 1)
  const yellow = Math.max(Number(timing.yellow) || 0, 1)
  const red = Math.max(Number(timing.red) || 0, 1)
  const cycle = Math.max(Number(timing.cycle) || green + yellow + red, 1)

  const greenRatio = clamp(green / cycle, 0.2, 0.9)
  const baseWait = totalLoad * 0.55 + totalVehicles * 0.35
  const avgWait = baseWait * (1.25 - greenRatio)
  const queueLength = totalVehicles * (1.15 - greenRatio) + totalLoad * 0.08
  const congestion = clamp((avgWait / 60) * 100, 0, 100)

  return {
    avgWait,
    queueLength,
    congestion,
  }
}

const optimizeTiming = (lanes, timing, options = {}) => {
  const totalLoad = lanes.reduce((sum, lane) => sum + calculateLoad(lane), 0)
  const totalVehicles = lanes.reduce((sum, lane) => sum + Number(lane.vehicles || 0), 0)
  const cycle = Math.max(Number(timing.cycle) || 0, 1)

  const demandRatio = totalLoad / Math.max(totalVehicles, 1)
  const targetRatio = clamp(0.42 + demandRatio * 0.18, 0.38, 0.75)
  let green = Math.round(cycle * targetRatio)
  const yellow = Math.max(Number(timing.yellow) || 5, 3)

  const emergency = options.emergencyPriority || {}
  const emergencyBoost = emergency.enabled
    ? EMERGENCY_BOOSTS[emergency.level] || EMERGENCY_BOOSTS.medium
    : 0

  green = green + emergencyBoost
  const minRed = 5
  const maxGreen = Math.max(cycle - yellow - minRed, 1)
  green = Math.min(green, maxGreen)
  const red = Math.max(cycle - green - yellow, minRed)

  return {
    green,
    yellow,
    red,
    cycle,
    emergencyBoostSec: emergencyBoost,
  }
}

const calculateLaneBalancing = (lanes) => {
  if (!lanes || lanes.length === 0) {
    return null
  }

  const loads = lanes.map((lane) => ({
    name: lane.name,
    load: calculateLoad(lane),
  }))

  const highest = loads.reduce((max, lane) => (lane.load > max.load ? lane : max), loads[0])
  const lowest = loads.reduce((min, lane) => (lane.load < min.load ? lane : min), loads[0])

  if (highest.load === 0 || highest.name === lowest.name) {
    return null
  }

  const shiftPercentage = clamp(((highest.load - lowest.load) / highest.load) * 25, 5, 30)
  return {
    fromLane: highest.name,
    targetLane: lowest.name,
    shiftPercentage: Math.round(shiftPercentage),
  }
}

const getPhaseAtTime = (timeSec, timing) => {
  const green = Math.max(Number(timing.green) || 0, 1)
  const yellow = Math.max(Number(timing.yellow) || 0, 1)
  const red = Math.max(Number(timing.red) || 0, 1)
  const cycle = Math.max(Number(timing.cycle) || green + yellow + red, 1)
  const t = timeSec % cycle

  if (t < green) {
    return 'green'
  }
  if (t < green + yellow) {
    return 'yellow'
  }
  return 'red'
}

const generatePlaybackFrames = (payload, stepMs = 500) => {
  const lanes = payload.lanes || []
  const timing = payload.timing || {}
  const emergency = payload.options?.emergencyPriority || {}
  const priorityLane = emergency.enabled ? emergency.laneName : null
  const priorityBoost = emergency.enabled
    ? EMERGENCY_BOOSTS[emergency.level] || EMERGENCY_BOOSTS.medium
    : 0

  const green = Math.max(Number(timing.green) || 0, 1)
  const yellow = Math.max(Number(timing.yellow) || 0, 1)
  const red = Math.max(Number(timing.red) || 0, 1)
  const cycle = Math.max(Number(timing.cycle) || green + yellow + red, 1)

  const durationSec = Math.max(60, cycle * 2)
  const stepSec = Math.max(stepMs / 1000, 0.1)
  const steps = Math.ceil(durationSec / stepSec)

  const laneState = lanes.map((lane) => ({
    name: lane.name,
    density: lane.density,
    type: lane.type,
    baseVehicles: Number(lane.vehicles || 0),
    queue: Math.max(Number(lane.vehicles || 0), 0),
  }))

  const frames = []

  for (let index = 0; index < steps; index += 1) {
    const timeSec = Number((index * stepSec).toFixed(2))
    const phase = getPhaseAtTime(timeSec, timing)
    const straightPhase = phase
    const turnPhase = phase === 'red' ? 'green' : 'red'

    const queues = laneState.map((lane) => {
      const densityFactor = DENSITY_FACTORS[lane.density] || 1
      const typeFactor = TYPE_FACTORS[lane.type] || 1
      const baseArrival = (lane.baseVehicles / durationSec) * densityFactor * typeFactor

      const arrivalRate = baseArrival * 1.1
      const isPriority = priorityLane && lane.name === priorityLane
      const emergencyMultiplier = isPriority ? 1 + priorityBoost / 10 : 1
      const lanePhase = lane.type === 'turn' ? turnPhase : straightPhase
      const departRate =
        lanePhase === 'green'
          ? baseArrival * 2.6 * emergencyMultiplier
          : lanePhase === 'yellow'
            ? baseArrival * 0.8 * emergencyMultiplier
            : baseArrival * 0.2 * emergencyMultiplier

      lane.queue = Math.max(0, lane.queue + arrivalRate * stepSec - departRate * stepSec)

      return {
        name: lane.name,
        phase: lanePhase,
        queueLength: Number(lane.queue.toFixed(1)),
      }
    })

    const totalQueue = queues.reduce((sum, lane) => sum + lane.queueLength, 0)
    const avgWait = totalQueue * 0.9

    frames.push({
      timeSec,
      phase,
      straightPhase,
      turnPhase,
      queues,
      totalQueue: Number(totalQueue.toFixed(1)),
      avgWait: Number(avgWait.toFixed(1)),
    })
  }

  return {
    stepMs,
    durationSec: Number(durationSec.toFixed(1)),
    frames,
    emergencyPriority: {
      enabled: Boolean(emergency.enabled),
      laneName: priorityLane,
      level: emergency.level || null,
    },
  }
}

const runSimulation = (payload) => {
  const lanes = payload.lanes || []
  const timing = payload.timing || {}
  const options = payload.options || {}

  const before = calculateMetrics(lanes, timing)
  const optimizedTiming = optimizeTiming(lanes, timing, options)
  const after = calculateMetrics(lanes, timing, optimizedTiming.green)
  const laneBalancing = options.balanceLanes ? calculateLaneBalancing(lanes) : null

  const emergencyPriority = options.emergencyPriority
    ? {
        enabled: Boolean(options.emergencyPriority.enabled),
        laneName: options.emergencyPriority.laneName || null,
        level: options.emergencyPriority.level || null,
        greenBoostSec: optimizedTiming.emergencyBoostSec || 0,
      }
    : { enabled: false, laneName: null, level: null, greenBoostSec: 0 }

  const simulation = {
    id: `sim-${Date.now()}`,
    createdAt: new Date().toISOString(),
    intersectionName: payload.intersectionName || 'Unnamed intersection',
    metrics: {
      before,
      after,
    },
    optimizedTiming,
    laneBalancing,
    emergencyPriority,
  }

  addSimulation(simulation)
  return simulation
}

module.exports = {
  runSimulation,
  listSimulations,
  generatePlaybackFrames,
}
