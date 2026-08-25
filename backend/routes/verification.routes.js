const { registerDriverVerificationRoutes } = require('./verification.driver.routes');
const { registerAdminSelfieRoutes } = require('./verification.admin.selfies.routes');
const { registerAdminReviewRoutes } = require('./verification.admin.review.routes');
const { registerAdminDecisionRoutes } = require('./verification.admin.decisions.routes');
const { registerAdminArchivedRoutes } = require('./verification.admin.archived.routes');

function registerVerificationRoutes(app, db) {
  registerDriverVerificationRoutes(app, db);
  registerAdminSelfieRoutes(app, db);
  registerAdminReviewRoutes(app, db);
  registerAdminDecisionRoutes(app, db);
  registerAdminArchivedRoutes(app, db);
}

module.exports = { registerVerificationRoutes };
