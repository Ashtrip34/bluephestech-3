// Simple feedback controller - in production persist to DB or send to ticketing
exports.sendFeedback = async (req, res) => {
  const { message } = req.body || {}
  if(!message || message.trim().length < 3) return res.status(400).json({error: 'Message too short'})
  // TODO: save to DB, send email, or push to admin dashboard
  console.log('Feedback received:', message)
  return res.status(200).json({ok:true, message: 'Feedback received'})
}
