const jwt = require('jsonwebtoken')
const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret'

// Map userId => Set(socketId)
const userSockets = new Map()
let ioInstance = null

function attach(io){
  ioInstance = io
  io.on('connection', socket => {
    // Expect token in query: ?token=...
    const token = socket.handshake.query && socket.handshake.query.token
    if(token){
      try{
        const data = jwt.verify(token, JWT_SECRET)
        const userId = data.id
        if(userId){
          const set = userSockets.get(userId) || new Set()
          set.add(socket.id)
          userSockets.set(userId, set)
          socket.userId = userId
        }
      }catch(err){ /* ignore invalid token */ }
    }

    socket.on('disconnect', ()=>{
      if(socket.userId){
        const set = userSockets.get(socket.userId)
        if(set){
          set.delete(socket.id)
          if(set.size === 0) userSockets.delete(socket.userId)
        }
      }
    })
  })
}

function emitToUser(userId, event, payload){
  if(!ioInstance) return
  const set = userSockets.get(userId)
  if(!set) return
  for(const sid of set){ ioInstance.to(sid).emit(event, payload) }
}

module.exports = { attach, emitToUser }
