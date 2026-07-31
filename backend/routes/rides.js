const { registerCreateRoutes } = require('./rides.create');
const { registerAcceptRoutes } = require('./rides.accept');
const { registerStatusRoutes } = require('./rides.status');
const { registerOtpRoutes } = require('./rides.otp');
const { registerRatingRoutes } = require('./rides.rating');
const { registerFavoriteRoutes } = require('./rides.favorites');
const { registerPaymentMethodRoutes } = require('./rides.payment-methods');

function registerRidesRoutes(app, io, db) {
  registerCreateRoutes(app, io, db);
  registerAcceptRoutes(app, io, db);
  registerStatusRoutes(app, io, db);
  registerOtpRoutes(app, io, db);
  registerRatingRoutes(app, io, db);
  registerFavoriteRoutes(app, io, db);
  registerPaymentMethodRoutes(app, io, db);
}

module.exports = { registerRidesRoutes };
