const prisma = require('./db/prismaClient')
const EventEmitter = require('events')
const emitter = new EventEmitter()

// Basic simulation: update scores for football-like events
function simulateScore(prev, sport, start, duration){
  // prev: existing data JSON or null
  let data = prev ? JSON.parse(prev) : { home: 0, away: 0 }
  if(sport === 'football'){
    // small chance to score each tick
    if(Math.random() < 0.2) data.home += Math.random() < 0.5 ? 1 : 0
    if(Math.random() < 0.2) data.away += Math.random() < 0.5 ? 1 : 0
  }else if(sport === 'basketball'){
    data.home += Math.round(Math.random() * 3)
    data.away += Math.round(Math.random() * 3)
  }else{
    // generic
    if(Math.random() < 0.25) data.home += 1
    if(Math.random() < 0.25) data.away += 1
  }
  // add optional meta such as lastUpdate timestamp
  data.lastUpdated = new Date().toISOString()
  return data
}

async function tick(){
  try{
    const now = new Date()
    // find events that are not finished
    const events = await prisma.virtualEvent.findMany({ where: { status: { not: 'finished' } } })
    for(const ev of events){
      const start = new Date(ev.start)
      // calculate end time
      const end = ev.duration ? new Date(start.getTime() + (ev.duration * 60 * 1000)) : null

      if(ev.status === 'scheduled' && now >= start){
        // set live
        await prisma.virtualEvent.update({ where: { id: ev.id }, data: { status: "live" } })
        await prisma.virtualEventUpdate.create({ data: { eventId: ev.id, payload: JSON.stringify({ event: 'started', at: now.toISOString() }) } })
        emitter.emit('event-start', ev)
        continue
      }

      if(ev.status === 'live'){
        // if end passed => finish
        if(end && now >= end){
          await prisma.virtualEvent.update({ where: { id: ev.id }, data: { status: 'finished' } })
          await prisma.virtualEventUpdate.create({ data: { eventId: ev.id, payload: JSON.stringify({ event: 'finished', at: now.toISOString() }) } })
          emitter.emit('event-finish', ev)
          continue
        }
        // otherwise simulate a score/update
        const simulated = simulateScore(ev.data, ev.sport || 'generic', start, ev.duration)
        await prisma.virtualEvent.update({ where: { id: ev.id }, data: { data: JSON.stringify(simulated) } })
        await prisma.virtualEventUpdate.create({ data: { eventId: ev.id, payload: JSON.stringify({ event: 'update', data: simulated, at: now.toISOString() }) } })
        emitter.emit('event-update', ev, simulated)
        continue
      }
      // if status is scheduled and not yet started nothing to do
    }
  }catch(err){ console.error('Bot tick error', err) }
}

let intervalId = null
module.exports = {
  start(interval = 30_000){
    if(intervalId) return
    intervalId = setInterval(tick, interval)
    console.log('Bot scheduler started (poll every', interval, 'ms)')
  },
  stop(){ if(intervalId) clearInterval(intervalId); intervalId = null },
  emitter,
  tick
}
