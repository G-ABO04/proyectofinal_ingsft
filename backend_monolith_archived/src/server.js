const { loadConfig } = require('./config');
const { openDatabase } = require('./database');
const { createApp } = require('./app');

const config = loadConfig();
const db = openDatabase(config.databasePath);
const server = createApp({ db, config }).listen(config.port, config.host, () => {
  console.log(`DonativoSeguro disponible en ${config.publicOrigin}`);
  if (!config.production && db.prepare('SELECT COUNT(*) AS count FROM users').get().count === 0) {
    console.log('Crea tu primer administrador desde la pantalla de configuración inicial.');
    console.log('El código de instalación es SETUP_TOKEN en backend/.env.');
  }
});
server.on('error', (error) => { console.error(`No se pudo iniciar el servidor: ${error.code}`); db.close(); process.exitCode = 1; });
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close(() => { db.close(); process.exit(0); }));
