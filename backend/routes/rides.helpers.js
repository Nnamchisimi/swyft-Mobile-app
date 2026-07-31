const {
  generateDeliveryId,
  generateVerificationCode,
  hashOtp,
  verifyOtp,
  sendDeliveryOtp
} = require('../utils/helpers');

function updateDriverRating(db, email) {
  db.query('SELECT AVG(rating) as avg_rating FROM ratings WHERE driver_email = $1', [email], (err, results) => {
    if (!err && results.rows.length > 0) {
      const avgRating = results.rows[0].avg_rating || 0;
      db.query('UPDATE users SET rating = $1 WHERE email = $2', [Math.round(avgRating * 10) / 10, email]);
    }
  });
}

function updateUserRating(db, email) {
  db.query('SELECT AVG(rating) as avg_rating FROM ratings WHERE user_email = $1', [email], (err, results) => {
    if (!err && results.rows.length > 0) {
      const avgRating = results.rows[0].avg_rating || 0;
      db.query('UPDATE users SET rating = $1 WHERE email = $2', [Math.round(avgRating * 10) / 10, email]);
    }
  });
}

module.exports = { updateDriverRating, updateUserRating, generateDeliveryId, generateVerificationCode, hashOtp, verifyOtp, sendDeliveryOtp };
