const request = require('supertest')
const app = require('../src/index')
const prisma = require('../src/db/prismaClient')

beforeAll(async ()=>{
  await prisma.$connect()
})
afterAll(async ()=>{
  await prisma.$disconnect()
})

afterEach(async ()=>{
  await prisma.reminder.deleteMany()
})

describe('Reminders API', ()=>{
  it('should create and list reminders', async ()=>{
    const res = await request(app).post('/reminders').send({ sessionId: 1, text: 'Test reminder', time: new Date().toISOString() })
    expect(res.statusCode).toBe(200)
    expect(res.body.reminder).toBeDefined()
    const list = await request(app).get('/reminders?sessionId=1')
    expect(list.statusCode).toBe(200)
    expect(list.body.length).toBeGreaterThan(0)
  })

  it('should snooze a reminder', async ()=>{
    const create = await request(app).post('/reminders').send({ sessionId: 2, text: 'Snooze me', time: new Date().toISOString() })
    const id = create.body.reminder.id
    const sres = await request(app).post(`/reminders/${id}/snooze`).send({ minutes: 5 })
    expect(sres.statusCode).toBe(200)
    expect(sres.body.reminder.snoozeUntil).toBeDefined()
  })
})
