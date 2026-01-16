const express = require('express')
const router = express.Router()
const { authMiddleware } = require('../utils/auth')
const adminController = require('../controllers/adminController')

// All admin routes require auth and admin role
router.use(authMiddleware)
router.use((req, res, next)=>{
  if(!req.user || req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' })
  next()
})

router.get('/', adminController.getOverview)
router.post('/sessions', adminController.createSession)

module.exports = router
