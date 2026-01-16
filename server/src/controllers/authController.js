const bcrypt = require('bcrypt')
const prisma = require('../db/prismaClient')
const { signToken } = require('../utils/auth')
const crypto = require('crypto')
const fetch = global.fetch || (() => { try{ return require('node-fetch') }catch(e){ return null } })()

exports.register = async (req, res) => {
  try{
    const { email, password, name, verificationCode } = req.body || {}
    if(!email || !password) return res.status(400).json({ error: 'Missing email or password' })
    const existing = await prisma.user.findUnique({ where: { email } })
    if(existing) return res.status(400).json({ error: 'User already exists' })
    // If a verificationCode is provided, validate it
    if(verificationCode){
      const vc = await prisma.verificationCode.findFirst({ where: { email, code: verificationCode, used: false } })
      if(!vc) return res.status(400).json({ error: 'Invalid or expired verification code' })
      if(new Date() > vc.expiresAt) return res.status(400).json({ error: 'Verification code expired' })
      // mark used
      await prisma.verificationCode.update({ where: { id: vc.id }, data: { used: true } })
    }
    const hash = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({ data: { email, password: hash, name } })
    const token = signToken({ id: user.id, email: user.email })
    return res.json({ ok:true, token, user: { id: user.id, email: user.email, name: user.name } })
  }catch(err){
    console.error('register error', err)
    return res.status(500).json({ error: 'Server error during registration' })
  }
}

exports.login = async (req, res) => {
  try{
    const { email, password } = req.body || {}
    if(!email || !password) return res.status(400).json({ error: 'Missing email or password' })
    const user = await prisma.user.findUnique({ where: { email } })
    if(!user) return res.status(400).json({ error: 'Invalid credentials' })
    const ok = await bcrypt.compare(password, user.password)
    if(!ok) return res.status(400).json({ error: 'Invalid credentials' })
    const token = signToken({ id: user.id, email: user.email })
    return res.json({ ok:true, token, user: { id: user.id, email: user.email, name: user.name } })
  }catch(err){
    console.error('login error', err)
    return res.status(500).json({ error: 'Server error during login' })
  }
}

exports.me = async (req, res) => {
  res.json({ ok:true, user: req.user })
}

// Send a verification code to an email (development: returns code in response)
exports.sendVerificationCode = async (req, res) => {
  try{
    const { email } = req.body || {}
    if(!email) return res.status(400).json({ error: 'Missing email' })
    const code = Math.floor(100000 + Math.random() * 900000).toString() // 6-digit
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
    await prisma.verificationCode.create({ data: { email, code, expiresAt } })
    // If SMTP is configured, send the code by email. Otherwise try a test account (ethereal)
    const nodemailer = require('nodemailer')
    const smtpHost = process.env.SMTP_HOST
    try{
      let transporter
      let previewUrl
      if(smtpHost){
        transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT || 587),
          secure: (process.env.SMTP_SECURE === 'true'),
          auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
        })
      }else{
        // create a test account (Ethereal) for development testing so mails are real but don't require external SMTP
        const testAccount = await nodemailer.createTestAccount()
        transporter = nodemailer.createTransport({
          host: testAccount.smtp.host,
          port: testAccount.smtp.port,
          secure: testAccount.smtp.secure,
          auth: { user: testAccount.user, pass: testAccount.pass }
        })
      }

      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || 'no-reply@bluephes.test',
        to: email,
        subject: 'Your Bluephes verification code',
        text: `Your verification code is ${code}. It expires in 10 minutes.`,
        html: `<p>Your verification code is <strong>${code}</strong>. It expires in 10 minutes.</p>`
      })

      // If using a test account, produce a preview URL the developer can open
      try{ previewUrl = nodemailer.getTestMessageUrl(info) }catch(e){ previewUrl = null }
      console.log(`Sent verification code to ${email} via ${smtpHost ? 'SMTP' : 'Ethereal'}`)
      // Don't return the raw code when we have sent an email; return a preview URL in dev or confirmation
      const resp = { ok:true, message: 'Verification code sent via email' }
      if(previewUrl) resp.previewUrl = previewUrl
      return res.json(resp)
    }catch(err){
      console.error('Failed to send verification email', err)
      // fall through to return the code in response (dev fallback)
    }

    // Final fallback: return the code in the response and log it
    console.log(`Verification code for ${email}: ${code}`)
    return res.json({ ok:true, message: 'Verification code generated', code })
  }catch(err){
    console.error('sendVerificationCode error', err)
    return res.status(500).json({ error: 'Server error' })
  }
}

// Verify a code explicitly (optional)
exports.verifyCode = async (req, res) => {
  try{
    const { email, code } = req.body || {}
    if(!email || !code) return res.status(400).json({ error: 'Missing email or code' })
    const vc = await prisma.verificationCode.findFirst({ where: { email, code, used: false } })
    if(!vc) return res.status(400).json({ error: 'Invalid or expired code' })
    if(new Date() > vc.expiresAt) return res.status(400).json({ error: 'Code expired' })
    await prisma.verificationCode.update({ where: { id: vc.id }, data: { used: true } })
    return res.json({ ok:true, message: 'Code verified' })
  }catch(err){
    console.error('verifyCode error', err)
    return res.status(500).json({ error: 'Server error' })
  }
}

// Request a password reset; returns a short-lived token (dev returns token in response)
exports.requestPasswordReset = async (req, res) => {
  try{
    const { email } = req.body || {}
    if(!email) return res.status(400).json({ error: 'Missing email' })
    const user = await prisma.user.findUnique({ where: { email } })
    if(!user) return res.status(400).json({ error: 'No user with that email' })
    const token = crypto.randomBytes(24).toString('hex')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour
    await prisma.passwordResetToken.create({ data: { userId: user.id, token, expiresAt } })
    // Try to email the token as a reset link
    try{
      const nodemailer = require('nodemailer')
      let transporter
      if(process.env.SMTP_HOST){
        transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT || 587),
          secure: (process.env.SMTP_SECURE === 'true'),
          auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
        })
      }else{
        const testAccount = await nodemailer.createTestAccount()
        transporter = nodemailer.createTransport({
          host: testAccount.smtp.host,
          port: testAccount.smtp.port,
          secure: testAccount.smtp.secure,
          auth: { user: testAccount.user, pass: testAccount.pass }
        })
      }

      const frontend = process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`
      const resetLink = `${frontend.replace(/\/$/, '')}/reset-password?token=${token}`
      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || 'no-reply@bluephes.test',
        to: email,
        subject: 'Bluephes password reset',
        text: `Reset your password using this link: ${resetLink}`,
        html: `<p>Reset your password using this link: <a href="${resetLink}">${resetLink}</a></p>`
      })
      const previewUrl = nodemailer.getTestMessageUrl ? nodemailer.getTestMessageUrl(info) : null
      console.log(`Password reset email sent to ${email}`)
      const resp = { ok:true, message: 'Password reset email sent' }
      if(previewUrl) resp.previewUrl = previewUrl
      return res.json(resp)
    }catch(err){
      console.error('Failed to send password reset email', err)
    }

    console.log(`Password reset token for ${email}: ${token}`)
    return res.json({ ok:true, message: 'Password reset token generated', token })
  }catch(err){
    console.error('requestPasswordReset error', err)
    return res.status(500).json({ error: 'Server error' })
  }
}

// OAuth redirect to Google (opens consent screen)
exports.oauthGoogle = async (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const redirect = process.env.GOOGLE_OAUTH_REDIRECT || `${req.protocol}://${req.get('host')}/auth/oauth/google/callback`
  if(!clientId) return res.status(400).send('Google OAuth not configured')
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirect,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'select_account'
  })
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`)
}

// OAuth callback from Google
exports.oauthGoogleCallback = async (req, res) => {
  try{
    const code = req.query.code
    if(!code) return res.status(400).send('Missing code')
    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    const redirect = process.env.GOOGLE_OAUTH_REDIRECT || `${req.protocol}://${req.get('host')}/auth/oauth/google/callback`
    if(!clientId || !clientSecret) return res.status(400).send('Google client secret not configured on server')

    // Exchange code for tokens
    const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: {'Content-Type':'application/x-www-form-urlencoded'},
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirect, grant_type: 'authorization_code' })
    })
    const tokenJson = await tokenResp.json()
    if(!tokenResp.ok) return res.status(500).json({ error: 'Token exchange failed', details: tokenJson })

    // Fetch userinfo
    const userinfoResp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${tokenJson.access_token}` } })
    const profile = await userinfoResp.json()

    // Find or create user
    const prisma = require('../db/prismaClient')
    let user = await prisma.user.findUnique({ where: { email: profile.email } })
    if(!user) user = await prisma.user.create({ data: { email: profile.email, name: profile.name || profile.email } })

    const { signToken } = require('../utils/auth')
    const token = signToken({ id: user.id, email: user.email })

    // Redirect to frontend if configured, otherwise show JSON
    const frontend = process.env.FRONTEND_URL
    if(frontend){
      const dest = new URL(frontend)
      dest.pathname = '/auth/callback'
      dest.searchParams.set('token', token)
      return res.redirect(dest.toString())
    }
    return res.json({ ok:true, token, user })
  }catch(err){
    console.error('Google OAuth callback error', err)
    return res.status(500).send('OAuth callback error')
  }
}

// OAuth redirect to Apple
exports.oauthApple = async (req, res) => {
  const clientId = process.env.APPLE_CLIENT_ID
  const redirect = process.env.APPLE_OAUTH_REDIRECT || `${req.protocol}://${req.get('host')}/auth/oauth/apple/callback`
  if(!clientId) return res.status(400).send('Apple OAuth not configured')
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirect,
    response_type: 'code',
    response_mode: 'form_post',
    scope: 'name email'
  })
  res.redirect(`https://appleid.apple.com/auth/authorize?${params.toString()}`)
}

// OAuth callback from Apple (requires APPLE_PRIVATE_KEY + APPLE_KEY_ID + APPLE_TEAM_ID)
exports.oauthAppleCallback = async (req, res) => {
  try{
    // Apple usually posts back with form data (response_mode=form_post). We'll handle both.
    const code = req.body && req.body.code ? req.body.code : req.query.code
    if(!code) return res.status(400).send('Missing code')
    const clientId = process.env.APPLE_CLIENT_ID
    const teamId = process.env.APPLE_TEAM_ID
    const keyId = process.env.APPLE_KEY_ID
    const privateKey = process.env.APPLE_PRIVATE_KEY
    const redirect = process.env.APPLE_OAUTH_REDIRECT || `${req.protocol}://${req.get('host')}/auth/oauth/apple/callback`
    if(!clientId || !teamId || !keyId || !privateKey) return res.status(400).send('Apple OAuth not configured on server')

    // Try to generate client_secret using jsonwebtoken (ES256)
    let clientSecret
    try{
      const jwt = require('jsonwebtoken')
      // privateKey may have escaped newlines; convert if needed
      const pk = privateKey.replace(/\\n/g, '\n')
      const now = Math.floor(Date.now()/1000)
      clientSecret = jwt.sign({ iss: teamId, iat: now, exp: now + (60 * 60 * 24 * 180), aud: 'https://appleid.apple.com', sub: clientId }, pk, { algorithm: 'ES256', keyid: keyId })
    }catch(err){
      console.error('apple jwt creation error', err)
      return res.status(500).send('Apple client secret generation failed on server; ensure jsonwebtoken is installed and APPLE_PRIVATE_KEY is correct')
    }

    // Exchange code for tokens
    const tokenResp = await fetch('https://appleid.apple.com/auth/token', {
      method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: new URLSearchParams({ grant_type: 'authorization_code', code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirect })
    })
    const tokenJson = await tokenResp.json()
    if(!tokenResp.ok) return res.status(500).json({ error: 'Apple token exchange failed', details: tokenJson })

    // Apple returns an id_token (JWT) that can be decoded to get email/name
    const idToken = tokenJson.id_token
    let profile = {}
    try{ profile = idToken ? JSON.parse(Buffer.from(idToken.split('.')[1], 'base64').toString('utf8')) : {} }catch(e){ /* ignore */ }

    // Find or create user
    const prisma = require('../db/prismaClient')
    let user = await prisma.user.findUnique({ where: { email: profile.email } })
    if(!user) user = await prisma.user.create({ data: { email: profile.email || `apple_${profile.sub}@missing`, name: profile.name || profile.email || '' } })
    const token = signToken({ id: user.id, email: user.email })
    const frontend = process.env.FRONTEND_URL
    if(frontend){
      const dest = new URL(frontend)
      dest.pathname = '/auth/callback'
      dest.searchParams.set('token', token)
      return res.redirect(dest.toString())
    }
    return res.json({ ok:true, token, user })
  }catch(err){
    console.error('Apple OAuth callback error', err)
    return res.status(500).send('Apple OAuth callback error')
  }
}

// Reset password using token
exports.resetPassword = async (req, res) => {
  try{
    const { token, newPassword } = req.body || {}
    if(!token || !newPassword) return res.status(400).json({ error: 'Missing token or newPassword' })
    const record = await prisma.passwordResetToken.findUnique({ where: { token } })
    if(!record) return res.status(400).json({ error: 'Invalid token' })
    if(record.used) return res.status(400).json({ error: 'Token already used' })
    if(new Date() > record.expiresAt) return res.status(400).json({ error: 'Token expired' })
    const hash = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({ where: { id: record.userId }, data: { password: hash } })
    await prisma.passwordResetToken.update({ where: { id: record.id }, data: { used: true } })
    return res.json({ ok:true, message: 'Password reset successful' })
  }catch(err){
    console.error('resetPassword error', err)
    return res.status(500).json({ error: 'Server error' })
  }
}
