const express = require('express')
const router = express.Router()
const { listSessions, createSession, joinSession } = require('../controllers/sessionsController')

router.get('/', listSessions)
router.post('/', createSession)
router.post('/join', joinSession)

module.exports = router
