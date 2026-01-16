const fs = require('fs')
const path = require('path')
const request = require('supertest')
const crypto = require('crypto')

// Use test DB file for prisma
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = `file:${path.join(process.cwd(), 'prisma', 'test.db')}`

const app = require('../src/index') // index exports app in test env
const prisma = require('../db/prismaClient')

beforeAll(async () => {
  // remove test DB if exists
  try{ fs.unlinkSync(path.join(process.cwd(), 'prisma', 'test.db')) }catch(e){}
  // Ensure prisma client is generated and schema pushed
  const { execSync } = require('child_process')
  execSync('npx prisma generate', { cwd: process.cwd(), stdio: 'inherit' })
  execSync('npx prisma db push', { cwd: process.cwd(), stdio: 'inherit' })
})

afterAll(async () => {
  // Close prisma connection
  try{ await prisma.$disconnect() }catch(e){}
})

describe('Paystack mock and webhook', () => {
  it('should initialize a DEV payment with provided reference and verify via mock complete', async () => {
    const testRef = 'DEV-TEST-12345'
    const email = 'tester@example.com'
    const amount = 100

    // initialize with provided reference
    const initResp = await request(app).post('/payments/initialize').send({ email, amount, reference: testRef })
    expect(initResp.status).toBe(200)
    expect(initResp.body.authorization_url).toContain(`/payments/mock/${encodeURIComponent(testRef)}`)

    // complete mock payment (POST form)
    const completeResp = await request(app).post(`/payments/mock/complete/${encodeURIComponent(testRef)}`).send()
    // after completion, it should redirect to frontend with query param
    expect(completeResp.status).toBe(302)
    expect(completeResp.headers.location).toContain(`payment_ref=${encodeURIComponent(testRef)}`)

    // verify via verify endpoint
    const verifyResp = await request(app).get(`/payments/verify?reference=${encodeURIComponent(testRef)}`)
    expect(verifyResp.status).toBe(200)
    expect(verifyResp.body.verified).toBe(true)
  })

  it('should accept Paystack webhook and persist payment', async () => {
    const sampleRef = 'DEV-WEBHOOK-123'
    const payload = { event: 'charge.success', data: { reference: sampleRef, amount: 1234, currency: 'NGN', status: 'success', customer: { email: 'hook@example.com' } } }
    const raw = JSON.stringify(payload)
    const secret = 'webhook_test_secret'
    process.env.PAYSTACK_SECRET = secret
    const sig = crypto.createHmac('sha512', secret).update(raw).digest('hex')

    const resp = await request(app).post('/payments/webhook').set('X-Paystack-Signature', sig).send(raw)
    expect(resp.status).toBe(200)
    // confirm the payment exists in DB in the test DB
    const rec = await prisma.payment.findUnique({ where: { reference: sampleRef } })
    expect(rec).not.toBeNull()
    expect(rec.status).toBe('success')
  })

  it('should reject webhook with invalid signature', async () => {
    const sampleRef = 'DEV-WEBHOOK-INVALID'
    const payload = { event: 'charge.success', data: { reference: sampleRef, amount: 600, currency: 'NGN', status: 'success', customer: { email: 'invalid@example.com' } } }
    const raw = JSON.stringify(payload)
    process.env.PAYSTACK_SECRET = 'webhook_test_secret_2'
    const sig = 'invalidsignature'
    const resp = await request(app).post('/payments/webhook').set('X-Paystack-Signature', sig).send(raw)
    expect(resp.status).toBe(400)
  })

  it('should return 400 if missing email or amount on initialize', async () => {
    const resp = await request(app).post('/payments/initialize').send({ email: '', amount: '' })
    expect(resp.status).toBe(400)
  })

  it('should initialize DEV payment without provided reference', async () => {
    const email = 'tester2@example.com'
    const amount = 150
    const initResp = await request(app).post('/payments/initialize').send({ email, amount })
    expect(initResp.status).toBe(200)
    expect(initResp.body.authorization_url).toMatch(/\/payments\/mock\/DEV-/)
    expect(initResp.body.reference).toMatch(/^DEV-/)
  })

  it('should return error if PAYSTACK_SECRET is set and external paystack fails', async () => {
    // mock global.fetch used by controller
    process.env.PAYSTACK_SECRET = 'set_secret'
    const fetch = require('node-fetch')
    const original = global.fetch
    global.fetch = jest.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'bad' }) })
    const resp = await request(app).post('/payments/initialize').send({ email: 'x@y.z', amount: 100 })
    expect(resp.status).toBe(502)
    // restore
    global.fetch = original
  })
})
