const express = require('express')
const cors = require('cors')
const helmet = require('helmet')

const routes = require('./routes')
const { requestLogger, errorLogger } = require('./middleware/logger')
const notFound = require('./middleware/notFound')
const errorHandler = require('./middleware/errorHandler')

const app = express()

app.use(helmet())
app.use(cors())
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(requestLogger)

app.use('/', routes)

app.use(notFound)
app.use(errorLogger)
app.use(errorHandler)

module.exports = app
