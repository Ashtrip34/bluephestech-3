const express = require('express')
const cors = require('cors')
const dotenv = require('dotenv')
// Diagnostics: capture unexpected exits and uncaught exceptions
process.on('uncaughtException', (err) => {
	console.error('UNCAUGHT EXCEPTION', err && err.stack ? err.stack : err)
})
process.on('unhandledRejection', (reason, p) => {
	console.error('UNHANDLED REJECTION at', p, 'reason:', reason)
})
process.on('exit', (code) => {
	console.error('PROCESS EXIT with code', code)
})
const http = require('http')
const { Server } = require('socket.io')
const feedbackRoutes = require('./routes/feedback')
const sessionsRoutes = require('./routes/sessions')
const recordingsRoutes = require('./routes/recordings')
const paymentsRoutes = require('./routes/payments')
const adminRoutes = require('./routes/admin')
const authRoutes = require('./routes/auth')
const messagesRoutes = require('./routes/messages')
const remindersRoutes = require('./routes/reminders')
const pushRoutes = require('./routes/push')
const botRoutes = require('./routes/bot')
const bot = require('./bot')
const scheduler = require('./scheduler')
const socketManager = require('./socket')

dotenv.config()
const app = express()
app.use(cors())
app.use(express.json())

// serve uploaded assets (recordings, videos) from /assets path (dev)
const path = require('path')
const assetsDir = path.join(__dirname, '..', '..', 'assets')
app.use('/assets', express.static(assetsDir))

// simple request logger in development to help debug auth/migrations
if(process.env.NODE_ENV !== 'production'){
	app.use((req, res, next) => {
		console.log(new Date().toISOString(), req.method, req.path)
		if(['POST','PUT','PATCH'].includes(req.method)) console.log('  body:', req.body)
		next()
	})
}

app.get('/health', (req, res) => res.json({ok: true, now: new Date()}))

app.use('/feedback', feedbackRoutes)
app.use('/sessions', sessionsRoutes)
app.use('/recordings', recordingsRoutes)
app.use('/payments', paymentsRoutes)
app.use('/admin', adminRoutes)
app.use('/auth', authRoutes)
app.use('/messages', messagesRoutes)
app.use('/reminders', remindersRoutes)
app.use('/push', pushRoutes)
app.use('/bot', botRoutes)

const PORT = process.env.PORT || 4000
const httpServer = http.createServer(app)
console.log('DEBUG: http server created')

const io = new Server(httpServer, { cors: { origin: '*' } })
console.log('DEBUG: socket.io Server created')

socketManager.attach(io)
console.log('DEBUG: socketManager attached')

// forward bot events to connected Socket.IO clients for real-time updates
try{
	const botModule = require('./bot')
	botModule.emitter.on('event-update', (ev, data)=>{
		try{ io.emit('bot:event:update', { id: ev.id, title: ev.title, data }) }catch(e){ console.warn('bot emit failed', e) }
	})
	botModule.emitter.on('event-start', (ev)=> io.emit('bot:event:start', { id: ev.id, title: ev.title }))
	botModule.emitter.on('event-finish', (ev)=> io.emit('bot:event:finish', { id: ev.id, title: ev.title }))
}catch(e){ /* silence errors when bot is not present for tests */ }

// Bind to all interfaces so other devices on the LAN (e.g. your phone) can reach the API
const HOST = process.env.HOST || '0.0.0.0'
// Handle server 'error' events to surface helpful messages and exit gracefully
httpServer.on('error', (err) => {
	if (err && err.code === 'EADDRINUSE') {
		console.error(`ERROR: Port ${PORT} is already in use on ${HOST}. Another process may be running.`)
		console.error('Hint: stop the other process or set PORT env to a different value, then restart.')
		process.exit(1)
	} else {
		console.error('HTTP server error', err)
	}
})
// Only listen on a port when not running tests. Tests will import the app directly.
if(process.env.NODE_ENV !== 'test'){
	httpServer.listen(PORT, HOST, ()=> {
	console.log(`Server running on ${HOST}:${PORT}`)
	// print local IPv4 addresses to help mobile testing
	try{
		const os = require('os')
		const ifaces = os.networkInterfaces()
		Object.keys(ifaces).forEach(name => {
			for(const iface of ifaces[name]){
				if(iface.family === 'IPv4' && !iface.internal){
					console.log(`  - Local address: http://${iface.address}:${PORT}`)
				}
			}
		})
	}catch(e){ /* ignore */ }
	})
}

// Start scheduler for reminders and push if required
if(process.env.NODE_ENV !== 'test'){
	try{ scheduler.start() }catch(e){ console.error('Scheduler failed to start', e) }
	try{ bot.start() }catch(e){ console.error('Bot failed to start', e) }
}

// Development keep-alive to help debugging immediate exits (remove in production)
if(process.env.NODE_ENV !== 'production'){
	console.log('DEBUG: entering keep-alive interval (dev)')
	setInterval(()=>{}, 1e8)
}

// Export app for testing utilities (e.g. supertest)
module.exports = app
