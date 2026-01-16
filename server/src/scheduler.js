const prisma = require('./db/prismaClient')
const webpush = require('web-push')

function configureVapid(){
  const pub = process.env.VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT || 'mailto:no-reply@bluephes.test'
  if(pub && priv){
    webpush.setVapidDetails(subject, pub, priv)
    console.log('VAPID configured for web-push')
    return true
  }
  console.warn('VAPID keys not configured; push notifications disabled')
  return false
}

async function sendPushNotification(subscription, payload){
  // subscription={ endpoint, keys: { p256dh, auth } }
  try{
    await webpush.sendNotification(subscription, JSON.stringify(payload))
    return true
  }catch(err){ console.error('Failed to send push', err); return false }
}

function computeNextTime(time, repeat){
  if(!time) return null
  const t = new Date(time)
  if(!repeat || repeat === 'none') return null
  if(repeat === 'daily') return new Date(t.getTime() + 24*60*60*1000)
  if(repeat === 'weekly') return new Date(t.getTime() + 7*24*60*60*1000)
  return null
}

async function checkAndSend(){
  const now = new Date()
  try{
    // Find reminders due (enabled true and not triggered) where either snoozeUntil <= now or time <= now
    const due = await prisma.reminder.findMany({ where: { enabled: true, triggered: false, OR: [{ snoozeUntil: { lte: now } }, { time: { lte: now } }] } })
    if(!due.length) return
    console.log('Scheduler: found', due.length, 'due reminders')

    // gather subscriptions
    const subs = await prisma.pushSubscription.findMany()
    for(const r of due){
      // prepare payload
      const payload = { title: 'Bluephes Reminder', body: r.text, url: `${process.env.FRONTEND_URL || ''}/sessions/${r.sessionId || ''}` }
      if(subs.length && process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY){
        for(const s of subs){
          try{
            const subscription = { endpoint: s.endpoint, keys: JSON.parse(s.keys) }
            await sendPushNotification(subscription, payload)
          }catch(e){ console.warn('Skipping subscription send', e) }
        }
      }else{
        // fallback: log or email
        console.log('Push not configured; reminder:', r.text)
      }

      // If repeat is set, compute next occurrence and update time; else mark triggered
      if(r.repeat && r.repeat !== 'none'){
        const next = computeNextTime(r.time || r.snoozeUntil, r.repeat)
        await prisma.reminder.update({ where: { id: r.id }, data: { time: next, snoozeUntil: null } })
      }else{
        await prisma.reminder.update({ where: { id: r.id }, data: { triggered: true } })
      }
    }
  }catch(err){ console.error('Scheduler error', err) }
}

let started = false

module.exports = {
  start(){
    if(started) return
    const vapid = configureVapid()
    // run every minute
    checkAndSend()
    setInterval(checkAndSend, 60 * 1000)
    started = true
    console.log('Reminder scheduler started')
  }
}
