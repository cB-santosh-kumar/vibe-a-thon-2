const express = require('express')
const trafficRoutes = require('./trafficRoutes')

const router = express.Router()

router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'traffic-simulator' })
})

router.use('/traffic', trafficRoutes)

module.exports = router
