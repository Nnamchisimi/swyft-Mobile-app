const mysql = require('mysql2');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  connectTimeout: 10000,
});

pool.getConnection((err, connection) => {
  if (err) {
    console.error('Database connection failed:', err.message);
    return;
  }
  console.log(`Connected to MySQL database ${process.env.DB_NAME}!`);
  connection.release();
});

pool.on('error', (err) => {
  console.error('Pool error:', err.message);
  if (err.code === 'PROTOCOL_CONNECTION_LOST') {
    console.log('Database connection lost. Attempting to reconnect...');
  }
});

const executeQuery = (sql, params) => {
  return new Promise((resolve, reject) => {
    pool.query(sql, params, (err, results) => {
      if (err) {
        if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.fatal) {
          console.error('Connection error, retrying...', err.message);
          setTimeout(() => {
            pool.query(sql, params, (retryErr, retryResults) => {
              if (retryErr) {
                reject(retryErr);
              } else {
                resolve(retryResults);
              }
            });
          }, 1000);
        } else {
          reject(err);
        }
      } else {
        resolve(results);
      }
    });
  });
};

module.exports = {
  query: (sql, params, callback) => {
    pool.query(sql, params, callback);
  },
  getConnection: (callback) => {
    pool.getConnection(callback);
  },
  escape: (value) => {
    return pool.escape(value);
  },
  executeQuery: executeQuery
};
