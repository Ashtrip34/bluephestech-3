// Placeholder session controllers
exports.listSessions = async (req, res) => {
  // In production: fetch from DB
  res.json([{ id: 1, title: 'Intro to Forex', start: new Date() }])
}

exports.createSession = async (req, res) => {
  // In production: call Zoom API to schedule host session, save to DB
  const { title, start } = req.body || {}
  if(!title) return res.status(400).json({error: 'Missing title'})
  res.status(201).json({ok:true, id: Date.now(), title, start})
}

exports.joinSession = async (req, res) => {
  try{
    const { sessionId } = req.body || {}
    if(!sessionId) return res.status(400).json({ error: 'Missing sessionId' });
    // Real Zoom join link
    const joinUrl = `https://zoom.us/j/6172815080?pwd=eTJ2eG9KNk1sQU5hOSs5N2tLMnN1Zz09`
    res.json({ ok:true, url: joinUrl })
  }catch(err){
    console.error('join session error', err)
    res.status(500).json({ error: 'Failed to join session' })
  }
}
