const { ensureVerificationTables, migrateVerificationTables } = require('./verification.migrations');
const { backfillArchive } = require('./verification.data');
const { registerVerificationRoutes: registerRoutes } = require('./verification.routes');

function registerVerificationRoutes(app, db) {
  ensureVerificationTables(db);
  migrateVerificationTables(db);
  backfillArchive(db);
  registerRoutes(app, db);
}

module.exports = { registerVerificationRoutes };
