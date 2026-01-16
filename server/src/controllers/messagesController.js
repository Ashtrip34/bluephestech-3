const prisma = require('../db/prismaClient')

const forbiddenPatterns = [
  /send\s*money/i,
  /request\s*money/i,
  /paypal/i,
  /venmo/i,
  /bitcoin|btc|eth/i,
  /wallet\s*address/i,
  /bank\s*details/i,
  /transfer\s*funds/i,
  /account\s*number/i,
  /western\s*union/i
]

function isAllowedText(text){
  if(!text || typeof text !== 'string') return false
  if(text.length > 2000) return false
  for(const re of forbiddenPatterns) if(re.test(text)) return false
  return true
}

exports.listUsers = async (req, res) => {
  try{
    // List basic info (id, email, name) for users
    const users = await prisma.user.findMany({ select: { id: true, email: true, name: true } })
    res.json(users)
  }catch(err){
    console.error('listUsers error', err)
    res.status(500).json({ error: 'Failed to list users' })
  }
}

exports.getConversation = async (req, res) => {
  try{
    const meId = req.user.id
    const otherId = Number(req.params.userId)
    if(!otherId) return res.status(400).json({ error: 'Invalid user id' })

    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { fromId: meId, toId: otherId },
          { fromId: otherId, toId: meId }
        ]
      },
      orderBy: { createdAt: 'asc' }
    })
    res.json(messages)
  }catch(err){
    console.error('getConversation error', err)
    res.status(500).json({ error: 'Failed to get conversation' })
  }
}

exports.sendMessage = async (req, res) => {
  try{
    const fromId = req.user.id
    const toId = Number(req.params.userId)
    const { text } = req.body || {}
    if(!toId) return res.status(400).json({ error: 'Invalid recipient' })
    if(!isAllowedText(text)) return res.status(400).json({ error: 'Message rejected (policy)' })

    // Ensure recipient exists
    const recipient = await prisma.user.findUnique({ where: { id: toId } })
    if(!recipient) return res.status(404).json({ error: 'Recipient not found' })

    const msg = await prisma.message.create({ data: { fromId, toId, text } })

    // push real-time notification via Socket.IO if recipient connected
    try{
      const socket = require('../socket')
      socket.emitToUser(toId, 'new_message', msg)
    }catch(e){ /* ignore socket errors */ }

    res.status(201).json(msg)
  }catch(err){
    console.error('sendMessage error', err)
    res.status(500).json({ error: 'Failed to send message' })
  }
}
