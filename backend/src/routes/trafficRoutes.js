const express = require('express')
const trafficController = require('../controllers/trafficController')

const router = express.Router()

router.post('/simulate', trafficController.simulate)
router.post('/playback', trafficController.playback)
router.get('/simulations', trafficController.list)

module.exports = router
