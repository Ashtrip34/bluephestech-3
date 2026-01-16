const express = require('express')
const router = express.Router()
const prisma = require('../db/prismaClient')

// Create reminder
router.post('/', async (req, res) => {
  try{
    const { sessionId, userId, text, time, repeat } = req.body || {}
    if(!text) return res.status(400).json({ error: 'Missing text' })
    const r = await prisma.reminder.create({ data: { sessionId: sessionId ? Number(sessionId) : null, userId: userId ? Number(userId) : null, text, time: time ? new Date(time) : null, repeat: repeat || 'none' } })
    return res.json({ ok:true, reminder: r })
  }catch(err){ console.error('create reminder', err); return res.status(500).json({ error: 'Server error' }) }
})

// Get reminders by sessionId
router.get('/', async (req, res) => {
  try{
    const { sessionId } = req.query
    const where = sessionId ? { where: { sessionId: Number(sessionId) } } : {}
    const rs = await prisma.reminder.findMany(where)
    return res.json(rs)
  }catch(err){ console.error('get reminders', err); return res.status(500).json({ error: 'Server error' }) }
})

// Update reminder
router.put('/:id', async (req, res) => {
  try{
    const id = Number(req.params.id)
    const data = req.body || {}
    const r = await prisma.reminder.update({ where: { id }, data })
    return res.json({ ok:true, reminder: r })
  }catch(err){ console.error('update reminder', err); return res.status(500).json({ error: 'Server error' }) }
})

// Delete reminder
router.delete('/:id', async (req, res) => {
  try{
    const id = Number(req.params.id)
    await prisma.reminder.delete({ where: { id } })
    return res.json({ ok:true })
  }catch(err){ console.error('delete reminder', err); return res.status(500).json({ error: 'Server error' }) }
})

// Snooze a reminder (push forward by minutes)
router.post('/:id/snooze', async (req, res) => {
  try{
    const id = Number(req.params.id)
    const { minutes } = req.body || {}
    if(!minutes) return res.status(400).json({ error: 'Missing minutes' })
    const r = await prisma.reminder.findUnique({ where: { id } })
    if(!r) return res.status(404).json({ error: 'Not found' })
    const base = r.snoozeUntil ? new Date(r.snoozeUntil) : (r.time || new Date())
    const newTime = new Date(base.getTime() + Number(minutes) * 60 * 1000)
    const updated = await prisma.reminder.update({ where: { id }, data: { snoozeUntil: newTime, triggered: false } })
    return res.json({ ok:true, reminder: updated })
  }catch(err){ console.error('snooze reminder', err); return res.status(500).json({ error: 'Server error' }) }
})

module.exports = router
