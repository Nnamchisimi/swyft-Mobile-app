const mysql = require('mysql2');
const { Pool } = require('pg');
require('dotenv').config();

// Determine which database to use
const useSupabase = process.env.USE_SUPABASE === 'true' || !!process.env.SUPABASE_DATABASE_URL;
const useLocalMySQL = !useSupabase || process.env.USE_LOCAL_MYSQL === 'true';

let db;

// Initialize database connection
if (useSupabase && process.env.SUPABASE_DATABASE_URL) {
  // Supabase PostgreSQL connection
  console.log('Initializing Supabase PostgreSQL connection...');
  
  // Parse Supabase connection string to extract components
  const connectionString = process.env.SUPABASE_DATABASE_URL;
  const connectionRegex = /postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/;
  const match = connectionString?.match(connectionRegex);
  
  if (match) {
    const [, user, password, host, port, database] = match;
    console.log(`Connecting to Supabase at ${host}:${port}/${database}`);
    
    // Supabase PostgreSQL connection configuration with explicit options
    db = new Pool({
      user,
      password,
      host,
      port: parseInt(port),
      database,
      ssl: {
        rejectUnauthorized: false
      },
      connectionTimeoutMillis: 10000, // Increased to 10s
      family: 4 // Force IPv4 to avoid IPv6 connectivity issues on Render
    });
  } else {
    // Fallback to connection string if parsing fails
    console.log('Using connection string directly');
    db = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false
      },
      connectionTimeoutMillis: 10000, // Increased to 10s
      family: 4
    });
  }

  db.on('connect', () => {
    console.log('Connected to Supabase PostgreSQL database!');
  });

  db.on('error', (err) => {
    console.error('Unexpected error on idle client:', err);
  });
} else if (useLocalMySQL) {
  // Local MySQL connection
  console.log('Initializing local MySQL connection...');
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '123456789',
    database: process.env.DB_NAME || 'swyft',
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  // Test connection
  pool.getConnection((err, connection) => {
    if (err) {
      console.error('MySQL connection failed:', err.message);
    } else {
      console.log(`Connected to MySQL database ${process.env.DB_NAME}!`);
      connection.release();
    }
  });

  // Handle pool errors
  pool.on('error', (err) => {
    console.error('MySQL pool error:', err.message);
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
      console.log('MySQL connection lost. Attempting to reconnect...');
    }
  });

  db = pool;
} else {
  throw new Error('No database configuration found. Please set either SUPABASE_DATABASE_URL or MySQL credentials.');
}

// Helper function to normalize parameters for different databases
// PostgreSQL uses $1, $2, etc. MySQL uses ?
// We'll standardize on $1, $2 syntax and convert for MySQL
function normalizeParams(sql, params) {
  if (!useSupabase) {
    // For MySQL, convert $1, $2, etc. to ?
    let paramIndex = 1;
    return sql.replace(/\$\d+/g, () => {
      return '?';
    });
  }
  return sql;
}

// Helper function to execute queries with automatic reconnection handling
const executeQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    // Normalize SQL for the current database
    const normalizedSql = normalizeParams(sql, params);
    
    if (useSupabase) {
      // PostgreSQL/Supabase
      db.query(normalizedSql, params, (err, results) => {
        if (err) {
          // Check if it's a connection error
          if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.fatal) {
            console.error('Connection error, retrying...', err.message);
            // Retry once after a short delay
            setTimeout(() => {
              db.query(normalizedSql, params, (retryErr, retryResults) => {
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
          // For PostgreSQL, results are in .rows
          resolve({ rows: results.rows || results, rowCount: results.rowCount || results.length });
        }
      });
    } else {
      // MySQL
      db.query(normalizedSql, params, (err, results) => {
        if (err) {
          // Check if it's a connection error
          if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.fatal) {
            console.error('Connection error, retrying...', err.message);
            // Retry once after a short delay
            setTimeout(() => {
              db.query(normalizedSql, params, (retryErr, retryResults) => {
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
          // For MySQL, results are directly returned
          resolve({ rows: results, rowCount: results.affectedRows || results.length });
        }
      });
    }
  });
};

// Export both pool (for direct access) and executeQuery (for promise-based usage)
module.exports = {
  query: (sql, params, callback) => {
    const normalizedSql = normalizeParams(sql, params);
    if (useSupabase) {
      db.query(normalizedSql, params, callback);
    } else {
      db.query(normalizedSql, params, callback);
    }
  },
  getConnection: (callback) => {
    if (useSupabase) {
      db.connect(callback);
    } else {
      db.getConnection(callback);
    }
  },
  executeQuery: executeQuery,
  isSupabase: () => useSupabase,
  isMySQL: () => !useSupabase
};
