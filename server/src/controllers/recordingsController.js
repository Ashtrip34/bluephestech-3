const path = require('path')
const fs = require('fs')
const uploadDir = path.join(__dirname, '..', '..', 'assets', 'recordings')

// List recordings from local assets folder (dev). In production use S3 or cloud storage.
exports.listRecordings = async (req, res) => {
  try{
    if(!fs.existsSync(uploadDir)) return res.json([])
    const files = fs.readdirSync(uploadDir)
    const items = files.map(f => ({ id: f, title: f, url: '/assets/recordings/' + f }))
    res.json(items)
  }catch(err){ res.status(500).json({error: 'Failed to list recordings'}) }
}

exports.uploadRecording = async (req, res) => {
  if(!req.file) return res.status(400).json({error: 'No file uploaded'})
  // In production: push to S3 and save metadata to DB
  res.status(201).json({ ok:true, filename: req.file.filename, url: '/assets/recordings/' + req.file.filename })
}
