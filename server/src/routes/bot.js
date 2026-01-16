const express = require('express')
const router = express.Router()
const prisma = require('../db/prismaClient')

// Create a new virtual event
router.post('/events', async (req, res) => {
  try{
    const { title, sport, start, duration, remoteId } = req.body
    const event = await prisma.virtualEvent.create({ data: { title, sport, start: new Date(start), duration: duration || null, remoteId } })
    res.json({ event })
  }catch(err){ console.error(err); res.status(400).json({ error: err.message }) }
})

// List events
router.get('/events', async (req, res) => {
  const { status, sport } = req.query
  const where = {}
  if(status) where.status = status
  if(sport) where.sport = sport
  const events = await prisma.virtualEvent.findMany({ where, orderBy: { start: 'asc' } })
  res.json({ events })
})

router.get('/events/:id', async (req, res) => {
  const id = Number(req.params.id)
  const event = await prisma.virtualEvent.findUnique({ where: { id }, include: { updates: true } })
  if(!event) return res.status(404).json({ error: 'Not found' })
  res.json({ event })
})

// Manually add an update (score or commentary)
router.post('/events/:id/update', async (req, res) => {
  try{
    const id = Number(req.params.id)
    const event = await prisma.virtualEvent.findUnique({ where: { id } })
    if(!event) return res.status(404).json({ error: 'Event not found' })
    const payload = req.body.payload || {}
    const update = await prisma.virtualEventUpdate.create({ data: { eventId: id, payload: JSON.stringify(payload) } })
    // Optionally store the last known data in event.data
    await prisma.virtualEvent.update({ where: { id }, data: { data: JSON.stringify(payload) } })
    res.json({ update })
  }catch(err){ console.error(err); res.status(400).json({ error: err.message }) }
})

// Delete event
router.delete('/events/:id', async (req, res) => {
  const id = Number(req.params.id)
  await prisma.virtualEvent.delete({ where: { id } })
  res.json({ ok: true })
})

// Trigger update run for an event (manual)
router.post('/events/:id/trigger', async (req, res) => {
  const id = Number(req.params.id)
  const event = await prisma.virtualEvent.findUnique({ where: { id } })
  if(!event) return res.status(404).json({ error: 'Not found' })
  // update status or insert an update record; used by admins to simulate
  const payload = req.body.payload || { note: 'manual trigger' }
  const update = await prisma.virtualEventUpdate.create({ data: { eventId: id, payload: JSON.stringify(payload) } })
  res.json({ update })
})

module.exports = router
