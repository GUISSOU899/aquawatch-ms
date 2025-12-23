require('dotenv').config();
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

// sendAlertEmail(sensorId, parameter, value, threshold)
// Uses env vars EMAIL_USER and EMAIL_PASS for SMTP auth. Optionally uses ALERT_RECIPIENTS (comma-separated).
async function sendAlertEmail(sensorId, parameter, value, threshold) {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  const to = (process.env.ALERT_RECIPIENTS && process.env.ALERT_RECIPIENTS.split(',')) || ['simomars0006@gmail.com'];

  if (!user || !pass) {
    console.warn('📧 Email credentials not set (EMAIL_USER / EMAIL_PASS). Skipping email.');
    return;
  }

  // create transporter (Gmail-compatible SMTP by default)
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass }
  });

  const subject = `[AquaWatch] ALERTE ${parameter.toUpperCase()} - ${sensorId}`;
  const html = `
    <p>Une alerte a été déclenchée par le capteur <strong>${sensorId}</strong>.</p>
    <ul>
      <li><strong>Paramètre:</strong> ${parameter}</li>
      <li><strong>Valeur:</strong> ${value}</li>
      <li><strong>Seuil:</strong> ${threshold}</li>
      <li><strong>Heure:</strong> ${new Date().toLocaleString()}</li>
    </ul>
    <p>Veuillez vérifier la situation dans le tableau de bord AquaWatch.</p>
  `;

  const mailOptions = {
    from: user,
    to: Array.isArray(to) ? to.join(',') : to,
    subject,
    html
  };

  // send mail (returns a promise)
  return transporter.sendMail(mailOptions)
    .then(info => {
      const msg = `📧 Email d'alerte envoyé à ${Array.isArray(to) ? to.join(',') : to} (messageId=${info.messageId})`;
      console.log(msg);
      try {
        const logPath = path.join(__dirname, 'email.log');
        fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${msg}\n`);
      } catch (e) {
        // ignore logging errors
      }
      return info;
    })
    .catch(err => {
      const errMsg = `❌ Erreur en envoyant l'email d'alerte: ${err && err.message ? err.message : err}`;
      console.error(errMsg);
      try {
        const logPath = path.join(__dirname, 'email.log');
        fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${errMsg}\n`);
      } catch (e) {
        // ignore logging errors
      }
      throw err;
    });
}

module.exports = { sendAlertEmail };
