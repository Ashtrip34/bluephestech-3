const express = require('express')
const router = express.Router()
const { authMiddleware } = require('../utils/auth')
const { listUsers, getConversation, sendMessage } = require('../controllers/messagesController')

router.use(authMiddleware)

// GET /messages/users - list users to chat with
router.get('/users', listUsers)

// GET /messages/:userId - get conversation with userId
router.get('/:userId', getConversation)

// POST /messages/:userId - send message to userId
router.post('/:userId', sendMessage)

module.exports = router
