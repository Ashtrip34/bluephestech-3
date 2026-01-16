// Payments controller - Paystack integration (server-side initialize + verify)
// IMPORTANT: Do NOT hardcode your Paystack secret in source. Set it in environment:
// PAYSTACK_SECRET=sk_test_...
// Ensure a fetch implementation is available (Node 18+ has global.fetch).
let fetchImpl = global.fetch
if(!fetchImpl){
  try{
    // node-fetch v2 exports a function, v3 is ESM-only; try to require safely
    const nf = require('node-fetch')
    fetchImpl = nf && nf.default ? nf.default : nf
  }catch(e){
    fetchImpl = null
  }
}
const fetch = fetchImpl
// Support two env var names for Paystack secret (some configs used PAYSTACK_SECRET_KEY)
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET || process.env.PAYSTACK_SECRET_KEY || null

// Initialize a Paystack transaction. Expects { email, amount } in request body.
// amount should be in the main currency units (e.g., NGN) and will be converted to kobo.
exports.initializePayment = async (req, res) => {
  try{
    const { email, amount, currency = 'NGN' } = req.body || {}
    if(!email || !amount) return res.status(400).json({ error: 'Missing email or amount' })

    // Development fallback: if PAYSTACK_SECRET is not configured, return a local mock checkout URL
    if(!PAYSTACK_SECRET && process.env.NODE_ENV !== 'production'){
      // allow tests to pass a deterministic `reference` for repeatable mock behavior
      const providedRef = (req.body && req.body.reference) || (req.query && req.query.reference)
      const reference = providedRef || `DEV-${Date.now()}-${Math.random().toString(36).slice(2,8)}`
      // persist a pending payment record if Prisma is available
      try{
        const prisma = require('../db/prismaClient')
        await prisma.payment.create({ data: { reference, amount: Math.round(Number(amount) * 100) || 0, currency, status: 'pending', email, metadata: '' } })
      }catch(e){ /* ignore DB errors in dev fallback */ }
      const url = `${req.protocol}://${req.get('host')}/payments/mock/${encodeURIComponent(reference)}`
      return res.json({ ok:true, authorization_url: url, reference })
    }

    if(!PAYSTACK_SECRET) return res.status(500).json({ error: 'Paystack not configured. Set PAYSTACK_SECRET in env.' })

    // Paystack expects amount in the lowest currency unit (kobo for NGN)
    const amt = Math.round(Number(amount) * 100)

    const resp = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, amount: amt, currency })
    })

    const data = await resp.json()
    if(!resp.ok) {
      console.error('Paystack initialize error', data)
      return res.status(502).json({ error: 'Paystack initialize failed', details: data })
    }

    // Return the authorization_url and reference to the client so it can redirect
    return res.json({ ok: true, authorization_url: data.data.authorization_url, reference: data.data.reference })
  }catch(err){
    console.error('initializePayment error', err)
    return res.status(500).json({ error: 'Server error during Paystack initialize' })
  }
}

// Verify a Paystack transaction by reference. Expects { reference } in body or query param.
exports.verifyPayment = async (req, res) => {
  try{
    const reference = (req.body && req.body.reference) || (req.query && req.query.reference)
    if(!reference) return res.status(400).json({ error: 'Missing reference' })

    // Development mock: if reference starts with DEV- check local DB record
    if(!PAYSTACK_SECRET && reference.startsWith('DEV-')){
      try{
        const prisma = require('../db/prismaClient')
        const rec = await prisma.payment.findUnique({ where: { reference } })
        if(!rec) return res.json({ ok:true, verified:false, details: { reference, reason: 'not_found' } })
        return res.json({ ok:true, verified: rec.status === 'success', details: rec })
      }catch(e){
        console.error('DEV verify DB error', e)
        return res.status(500).json({ error: 'Server error during mock verify' })
      }
    }

    if(!PAYSTACK_SECRET) return res.status(500).json({ error: 'Paystack not configured. Set PAYSTACK_SECRET in env.' })

    const resp = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` }
    })
    const data = await resp.json()
    if(!resp.ok){
      console.error('Paystack verify error', data)
      return res.status(502).json({ error: 'Paystack verify failed', details: data })
    }

    // data.data.status === 'success' indicates a successful payment
    return res.json({ ok: true, verified: data.data.status === 'success', details: data.data })
  }catch(err){
    console.error('verifyPayment error', err)
    return res.status(500).json({ error: 'Server error during Paystack verify' })
  }
}

// Paystack webhook handler
exports.webhookHandler = async (req, res) => {
  const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET || null
  if(!PAYSTACK_SECRET) {
    console.error('Webhook received but PAYSTACK_SECRET not configured')
    return res.status(500).end()
  }

  try{
    // raw body is available on req.body because route used express.raw
    const sig = req.headers['x-paystack-signature'] || req.headers['X-Paystack-Signature']
    const crypto = require('crypto')
    const raw = req.body
    const hmac = crypto.createHmac('sha512', PAYSTACK_SECRET).update(raw).digest('hex')
    if(!sig || sig !== hmac){
      console.error('Invalid Paystack signature on webhook')
      return res.status(400).end()
    }

    const payload = JSON.parse(raw.toString('utf8'))
    // Example payload structure: { event: 'charge.success', data: { ... } }
    console.log('Paystack webhook event:', payload.event)

    // Persist payment event to DB if Prisma is available
    try{
      const prisma = require('../db/prismaClient')
      const ev = payload.data
      // upsert payment by reference
      await prisma.payment.upsert({
        where: { reference: ev.reference },
        update: { status: ev.status || ev.gateway_response || 'unknown', metadata: ev },
        create: { reference: ev.reference, amount: ev.amount || 0, currency: ev.currency || 'NGN', status: ev.status || ev.gateway_response || 'unknown', email: ev.customer?.email || ev.customer_email || '', metadata: ev }
      })
      console.log('Payment record upserted for', ev.reference)
    }catch(err){
      // If DB not ready, log and continue
      console.error('Failed to persist payment event', err)
    }

    // Handle important events (you can expand to update DB records)
    if(payload.event === 'charge.success'){
      const tx = payload.data
      console.log('Payment successful for reference:', tx.reference)
    }

    // Respond with 200 to acknowledge receipt
    res.json({ received: true })
  }catch(err){
    console.error('Webhook handler error', err)
    res.status(500).end()
  }
}
