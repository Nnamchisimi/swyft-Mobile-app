const { Pool } = require('pg');
require('dotenv').config();

// Supabase PostgreSQL connection configuration
const pool = new Pool({
  connectionString: process.env.SUPABASE_DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for Supabase
  },
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // How long a client is allowed to remain idle
  connectionTimeoutMillis: 2000, // How long to wait for a connection
});

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
