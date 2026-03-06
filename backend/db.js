const mysql = require('mysql2');
require('dotenv').config();  // load .env

// Use connection pooling for better reliability
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

// Test the connection
pool.getConnection((err, connection) => {
  if (err) {
    console.error('Database connection failed:', err.message);
    // Don't exit, let the app continue and retry
    return;
  }
  console.log(`Connected to MySQL database ${process.env.DB_NAME}!`);
  connection.release();
});

// Handle pool errors
pool.on('error', (err) => {
  console.error('Pool error:', err.message);
  if (err.code === 'PROTOCOL_CONNECTION_LOST') {
    console.log('Database connection lost. Attempting to reconnect...');
  }
});

// Helper function to execute queries with automatic reconnection handling
const executeQuery = (sql, params) => {
  return new Promise((resolve, reject) => {
    pool.query(sql, params, (err, results) => {
      if (err) {
        // Check if it's a connection error
        if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.fatal) {
          console.error('Connection error, retrying...', err.message);
          // Retry once after a short delay
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

// Export both pool (for direct access) and executeQuery (for promise-based usage)
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
