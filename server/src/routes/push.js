const express = require('express')
const router = express.Router()
const prisma = require('../db/prismaClient')

// Save push subscription
router.post('/subscribe', async (req, res) => {
  try{
    const { endpoint, keys, userId } = req.body || {}
    if(!endpoint) return res.status(400).json({ error: 'Missing endpoint' })
    const ks = keys ? JSON.stringify(keys) : null
    const existing = await prisma.pushSubscription.findUnique({ where: { endpoint } })
    if(existing) return res.json({ ok:true, subscription: existing })
    const sub = await prisma.pushSubscription.create({ data: { endpoint, keys: ks, userId: userId ? Number(userId) : null } })
    return res.json({ ok:true, subscription: sub })
  }catch(err){ console.error('subscribe', err); return res.status(500).json({ error: 'Server error' }) }
})

// Remove subscription
router.post('/unsubscribe', async (req, res) => {
  try{
    const { endpoint } = req.body || {}
    if(!endpoint) return res.status(400).json({ error: 'Missing endpoint' })
    await prisma.pushSubscription.deleteMany({ where: { endpoint } })
    return res.json({ ok:true })
  }catch(err){ console.error('unsubscribe', err); return res.status(500).json({ error: 'Server error' }) }
})

// Return VAPID public key for clients to use
router.get('/publickey', async (req, res) => {
  const k = process.env.VAPID_PUBLIC_KEY || null
  return res.json({ publicKey: k })
})

module.exports = router
