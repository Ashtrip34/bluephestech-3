const jwt = require('jsonwebtoken')
const prisma = require('../db/prismaClient')

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret'

function signToken(payload, opts = {expiresIn: '7d'}){
  return jwt.sign(payload, JWT_SECRET, opts)
}

async function authMiddleware(req, res, next){
  const auth = req.headers.authorization
  if(!auth || !auth.startsWith('Bearer ')) return res.status(401).json({error: 'Unauthorized'})
  const token = auth.split(' ')[1]
  try{
    const data = jwt.verify(token, JWT_SECRET)
    // attach user
    const user = await prisma.user.findUnique({where: {id: data.id}})
    if(!user) return res.status(401).json({error: 'User not found'})
    req.user = { id: user.id, email: user.email, role: user.role }
    next()
  }catch(err){
    return res.status(401).json({error: 'Invalid token'})
  }
}

module.exports = { signToken, authMiddleware }
