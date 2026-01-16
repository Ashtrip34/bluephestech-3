// Zoom service placeholder — implement OAuth/JWT flow in production
// For scheduling, use Zoom Meetings API: https://marketplace.zoom.us/docs/api-reference/zoom-api

async function createZoomMeeting(opts){
  // opts: { topic, start_time, duration }
  // TODO: call Zoom API with saved credentials and return meeting info
  return { ok:true, zoomId: 'zoom_' + Date.now(), join_url: 'https://zoom.us/j/placeholder' }
}

module.exports = { createZoomMeeting }
// Zoom integration placeholder
// In production use Zoom JWT/OAuth or SDK to create meetings and manage participants.
exports.createMeeting = async ({topic, start_time}) => {
  // TODO: call Zoom API
  return {ok:true, meetingId: 'zoom_' + Date.now(), topic, start_time}
}
