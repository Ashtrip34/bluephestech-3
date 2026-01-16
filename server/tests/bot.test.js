const request = require('supertest')
const app = require('../src/index')
const prisma = require('../src/db/prismaClient')
const bot = require('../src/bot')

describe('Bot events scheduler', ()=>{
  beforeAll(async ()=>{
    await prisma.virtualEventUpdate.deleteMany()
    await prisma.virtualEvent.deleteMany()
  })
  afterAll(async ()=>{
    await prisma.virtualEventUpdate.deleteMany()
    await prisma.virtualEvent.deleteMany()
    await prisma.$disconnect()
  })

  it('should create event and scheduler should start/finish', async ()=>{
    const start = new Date(Date.now() - 60 * 1000).toISOString() // started 1m ago
    const duration = 1 // minute
    const r = await request(app).post('/bot/events').send({ title: 'Test Match', sport: 'football', start, duration })
    expect(r.status).toBe(200)
    const ev = r.body.event
    expect(ev).toBeDefined()

    // Run a manual tick => scheduled -> live
    await bot.tick()
    const e1 = await prisma.virtualEvent.findUnique({ where: { id: ev.id }, include: { updates: true } })
    expect(e1.status === 'live' || e1.status === 'finished').toBeTruthy()

    // Run second tick => should move to finished if duration exhausted
    await bot.tick()
    const e2 = await prisma.virtualEvent.findUnique({ where: { id: ev.id }, include: { updates: true } })
    expect(e2.status).toBe('finished')
    expect(e2.updates.length).toBeGreaterThanOrEqual(2)
  })
})
