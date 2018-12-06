require('dotenv').config();

const { runServer } = require('./app/server');
const { DATABASE_URL } = require('./app/config');

runServer( DATABASE_URL );