const express = require('express')
const router = express.Router()
const { initializePayment, verifyPayment, webhookHandler } = require('../controllers/paymentsController')

router.post('/initialize', initializePayment)
router.get('/verify', verifyPayment)

// Mock checkout pages for local dev when Paystack isn't configured
router.get('/mock/:reference', async (req, res) => {
	const ref = req.params.reference
	const host = req.get('host')
	const frontend = process.env.FRONTEND_URL || `http://${req.hostname}:3000`
	// Simple HTML page to simulate a payment provider
	res.send(`<!doctype html><html><head><meta charset="utf-8"><title>Mock Checkout</title></head><body style="font-family:system-ui,Segoe UI,Roboto,-apple-system;display:flex;align-items:center;justify-content:center;height:100vh;">
		<div style="max-width:420px;padding:24px;border-radius:12px;border:1px solid #eee;text-align:center;">
			<h2>Mock Paystack Checkout</h2>
			<p>Reference: <strong>${ref}</strong></p>
			<p>This is a local mock checkout for development. Click the button to complete the payment.</p>
			<form method="POST" action="/payments/mock/complete/${encodeURIComponent(ref)}">
				<button style="padding:10px 16px;border-radius:8px;background:#06f;color:#fff;border:none">Complete payment (mock)</button>
			</form>
			<p style="margin-top:12px;color:#888">After completion you will be redirected back to the app.</p>
		</div>
	</body></html>`)
})

router.post('/mock/complete/:reference', express.urlencoded({ extended: false }), async (req, res) => {
	const ref = req.params.reference
	try{
		const prisma = require('../db/prismaClient')
		await prisma.payment.upsert({ where: { reference: ref }, update: { status: 'success' }, create: { reference: ref, amount: 0, currency: 'NGN', status: 'success', email: '' } })
	}catch(e){ console.error('Failed to upsert mock payment', e) }
	// redirect back to frontend with reference as query param
	const frontend = process.env.FRONTEND_URL || `http://localhost:3000`
	return res.redirect(`${frontend.replace(/\/$/, '')}/?payment_ref=${encodeURIComponent(ref)}`)
})

// Paystack sends a POST with JSON body and signature header. For signature verification
// we need the raw body, so use express.raw for this route only.
router.post('/webhook', express.raw({ type: 'application/json' }), webhookHandler)

module.exports = router
