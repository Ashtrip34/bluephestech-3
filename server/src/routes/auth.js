const express = require('express')
const router = express.Router()
const { register, login, me, sendVerificationCode, verifyCode, requestPasswordReset, resetPassword, oauthGoogle, oauthGoogleCallback, oauthApple, oauthAppleCallback } = require('../controllers/authController')
const { authMiddleware } = require('../utils/auth')

router.post('/register', register)
router.post('/login', login)
router.get('/me', authMiddleware, me)
router.post('/send-code', sendVerificationCode)
router.post('/verify-code', verifyCode)
router.post('/request-password-reset', requestPasswordReset)
router.post('/reset-password', resetPassword)

// OAuth
router.get('/oauth/google', oauthGoogle)
router.get('/oauth/google/callback', oauthGoogleCallback)
router.get('/oauth/apple', oauthApple)
router.post('/oauth/apple/callback', oauthAppleCallback)

module.exports = router 
