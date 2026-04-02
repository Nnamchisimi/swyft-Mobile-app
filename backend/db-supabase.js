const { Pool } = require('pg');
require('dotenv').config();

// Parse Supabase connection string to extract components
const connectionString = process.env.SUPABASE_DATABASE_URL;
const connectionRegex = /postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/;
const match = connectionString?.match(connectionRegex);

let pool;

if (match) {
  const [, user, password, host, port, database] = match;
  console.log(`Connecting to Supabase at ${host}:${port}/${database}`);
  
  // Supabase PostgreSQL connection configuration with explicit options
  pool = new Pool({
    user,
    password,
    host,
    port: parseInt(port),
    database,
    ssl: {
      rejectUnauthorized: false // Required for Supabase
    },
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000, // How long a client is allowed to remain idle
    connectionTimeoutMillis: 2000, // How long to wait for a connection
    family: 4 // Force IPv4 to avoid IPv6 connectivity issues on Render
  });
} else {
  // Fallback to connection string if parsing fails
  console.log('Using connection string directly');
  pool = new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    },
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
    family: 4
  });
}

// Test the connection
pool.on('connect', () => {
  console.log('Connected to Supabase PostgreSQL database!');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client:', err);
  process.exit(-1);
});

// Helper function to execute queries with automatic reconnection handling
const executeQuery = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (err) {
    console.error('Query error:', err.message);
    throw err;
  }
};

// Export both pool (for direct access) and executeQuery (for promise-based usage)
module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
  executeQuery: executeQuery,
  end: () => pool.end()
};
