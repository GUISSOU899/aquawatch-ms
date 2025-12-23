const { sendAlertEmail } = require('./email');

(async () => {
  try {
    console.log('Envoi d\'un email de test...');
    const info = await sendAlertEmail('test-sensor', 'ph', 9.5, 8.5);
    console.log('Résultat:', info && info.messageId ? `sent (id=${info.messageId})` : JSON.stringify(info));
    process.exit(0);
  } catch (err) {
    console.error('Erreur en envoyant l\'email de test:', err && err.message ? err.message : err);
    process.exit(2);
  }
})();
