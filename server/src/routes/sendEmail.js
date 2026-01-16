const nodemailer = require('nodemailer');

async function sendVerificationEmail(toEmail, code) {
  let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'ashamudaniel4161@gmail.com',
      pass: 'sgegkahubrtaspwy'  // Your app password here
    }
  });

  let mailOptions = {
    from: 'ashamudaniel4161@gmail.com',
    to: toEmail,
    subject: 'Your Verification Code',
    text: `Your code is: ${code}`
  };

  try {
    let info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.response);
  } catch (error) {
    console.error('Error sending email:', error);
  }
}

module.exports = { sendVerificationEmail };