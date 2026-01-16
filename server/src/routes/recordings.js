const express = require('express')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const router = express.Router()
const { listRecordings, uploadRecording } = require('../controllers/recordingsController')

const uploadDir = path.join(__dirname, '..', '..', 'assets', 'recordings')
if(!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

const storage = multer.diskStorage({
	destination: function (req, file, cb) { cb(null, uploadDir) },
	filename: function (req, file, cb) { cb(null, Date.now() + '-' + file.originalname) }
})
const upload = multer({ storage })

router.get('/', listRecordings)
router.post('/upload', upload.single('file'), uploadRecording)

module.exports = router
