const { createApp } = require('./app');
const { openDatabase } = require('./database');
const { loadConfig } = require('./config');

const config = loadConfig(process.env);
const db = openDatabase(config.databasePath);

const server = createApp({ db, config }).listen(config.port, config.host, () => {
  console.log(`Accounting Service disponible en http://${config.host}:${config.port}`);
});

process.on('SIGINT', () => { server.close(); db.close(); process.exit(0); });
process.on('SIGTERM', () => { server.close(); db.close(); process.exit(0); });
