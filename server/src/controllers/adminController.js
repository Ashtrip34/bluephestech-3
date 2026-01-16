const prisma = require('../db/prismaClient')
const fs = require('fs')
const path = require('path')

const recordingsDir = path.join(__dirname, '..', '..', 'assets', 'recordings')

exports.getOverview = async (req, res) => {
  try{
    const users = await prisma.user.findMany({ select: { id: true, email: true, name: true, role: true, createdAt: true } })
    const sessions = await prisma.session ? await prisma.session.findMany() : []
    let recordings = []
    if(fs.existsSync(recordingsDir)){
      recordings = fs.readdirSync(recordingsDir).map(f=>({ id:f, url: '/assets/recordings/' + f }))
    }
    res.json({ ok:true, users, sessions, recordings })
  }catch(err){
    console.error('admin overview error', err)
    res.status(500).json({ error: 'Failed to load admin overview' })
  }
}

exports.createSession = async (req, res) => {
  try{
    const { title, start } = req.body || {}
    if(!title) return res.status(400).json({ error: 'Missing title' })
    // If Prisma Session model exists, create; otherwise return placeholder
    if(prisma.session){
      const s = await prisma.session.create({ data: { title, start: start ? new Date(start) : new Date() } })
      return res.status(201).json({ ok:true, session: s })
    }
    res.status(201).json({ ok:true, session: { id: Date.now(), title, start } })
  }catch(err){
    console.error('create session error', err)
    res.status(500).json({ error: 'Failed to create session' })
  }
}
