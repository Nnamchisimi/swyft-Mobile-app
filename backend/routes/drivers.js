const jwt = require('jsonwebtoken');
const { verifyToken } = require('../utils/helpers');
const db = require('../db-supabase');

function authenticateToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireDriverApproval(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  db.query('SELECT id, role FROM public.users WHERE id = $1', [decoded.id], (err, results) => {
    if (err) return res.status(500).json({ error: 'Server error' });
    if (results.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const user = results.rows[0];
    if (user.role && user.role.toLowerCase() !== 'driver') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const userId = user.id;
    const approvalChecks = [
      (cb) => db.query('SELECT is_approved FROM driver_verification_status WHERE user_id = $1', [userId], (e, r) => cb(e, r)),
      (cb) => db.query('SELECT is_verified FROM id_documents WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [userId], (e, r) => cb(e, r)),
      (cb) => db.query('SELECT is_verified FROM selfie_verifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [userId], (e, r) => cb(e, r)),
      (cb) => db.query('SELECT is_verified FROM phone_verifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [userId], (e, r) => cb(e, r)),
      (cb) => db.query('SELECT is_verified FROM bank_accounts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [userId], (e, r) => cb(e, r)),
    ];

    const checkResults = [];
    let step = 0;
    const nextCheck = (err, results) => {
      checkResults.push({ err, results });
      if (checkResults.length === approvalChecks.length) {
        const apprRes = checkResults[0];
        const idRes = checkResults[1];
        const selfieRes = checkResults[2];
        const phoneRes = checkResults[3];
        const bankRes = checkResults[4];

        const isApproved = !apprRes.err && apprRes.results && apprRes.results.rows.length > 0 && apprRes.results.rows[0].is_approved;
        if (isApproved) return next();

        const idVerified = !idRes.err && idRes.results && idRes.results.rows.length > 0 && idRes.results.rows[0].is_verified;
        const selfieVerified = !selfieRes.err && selfieRes.results && selfieRes.results.rows.length > 0 && selfieRes.results.rows[0].is_verified;
        const phoneVerified = !phoneRes.err && phoneRes.results && phoneRes.results.rows.length > 0 && phoneRes.results.rows[0].is_verified;
        const bankVerified = !bankRes.err && bankRes.results && bankRes.results.rows.length > 0 && bankRes.results.rows[0].is_verified;

        if (idVerified && selfieVerified && phoneVerified && bankVerified) return next();

        return res.status(403).json({
          error: 'Your driver account is pending approval. Please complete your verification steps.',
          requiresVerification: true,
        });
      }

      step++;
      approvalChecks[step](nextCheck);
    };

    approvalChecks[0](nextCheck);
  });
}

// Register driver, passenger, earnings, stats and pricing endpoints
function registerDriversRoutes(app, db) {
  // Set driver online/offline status
  app.post('/api/drivers/status', requireDriverApproval, (req, res) => {
    const { email, is_online, lat, lng } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const query = `
      UPDATE driver_profiles dp
      SET is_online = $1, current_lat = $2, current_lng = $3
      FROM public.users u
      WHERE dp.user_id = u.id AND u.email = $4
    `;
    db.query(query, [is_online ? true : false, lat || null, lng || null, email], (err, result) => {
      if (err) return res.status(500).json({ error: 'Failed to update driver status' });
      res.json({ message: `Driver is now ${is_online ? 'online' : 'offline'}`, is_online });
    });
  });

  // Get nearby online drivers
  app.get('/api/drivers/nearby', (req, res) => {
    const { lat, lng, radius = 5 } = req.query; // radius in km

    if (!lat || !lng) {
      // Return all online drivers if no location specified
      db.query(`
        SELECT u.id, u.first_name, u.last_name, u.email, u.phone, dp.rating, dp.is_online, dp.current_lat, dp.current_lng
        FROM public.users u
        JOIN driver_profiles dp ON u.id = dp.user_id
        WHERE LOWER(u.role) = $1 AND dp.is_online = true
      `, ['driver'], (err, results) => {
        if (err) return res.status(500).json({ error: 'Failed to fetch drivers' });
        res.json(results);
      });
      return;
    }

    // Calculate nearby drivers using Haversine formula (simplified)
    const query = `
      SELECT u.id, u.first_name, u.last_name, u.email, u.phone, dp.rating, dp.is_online, dp.current_lat, dp.current_lng,
      (6371 * acos(cos(radians(?)) * cos(radians(dp.current_lat)) * cos(radians(dp.current_lng) - radians(?)) + sin(radians(?)) * sin(radians(dp.current_lat)))) AS distance
      FROM public.users u
      JOIN driver_profiles dp ON u.id = dp.user_id
      WHERE LOWER(u.role) = 'driver' AND dp.is_online = true AND dp.current_lat IS NOT NULL
      HAVING distance < ?
      ORDER BY distance
    `;

    db.query(query, [parseFloat(lat), parseFloat(lng), parseFloat(lat), parseFloat(radius)], (err, results) => {
      if (err) return res.status(500).json({ error: 'Failed to fetch nearby drivers' });
      res.json(results);
    });
  });

  // Get driver earnings - accessible without auth for unapproved drivers
  app.get('/api/drivers/earnings', (req, res) => {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    console.log('Fetching earnings for:', email);

    const completedStatuses = ['completed', 'confirmed', 'active'];
    const statusList = completedStatuses.map(s => "'" + s + "'").join(',');

    const simpleQuery = `SELECT COALESCE(SUM(price), 0) as total FROM rides WHERE driver_email = $1 AND status IN (${statusList})`;
    db.query(simpleQuery, [email], (err, results) => {
      if (err) {
        console.log('Earnings query error:', err.message);
        return res.json({ today_earnings: 0, total_earnings: 0, total_trips: 0, withdrawn: 0, recent_rides: [], recent_withdrawals: [] });
      }
      const total = results.rows[0]?.total || 0;

      const todayQuery = `SELECT COALESCE(SUM(price), 0) as today FROM rides WHERE driver_email = $1 AND status IN (${statusList}) AND DATE(created_at) = CURRENT_DATE`;
      db.query(todayQuery, [email], (err2, todayResults) => {
        if (err2) {
          console.log('Today earnings query error:', err2.message);
        }
        const today = todayResults.rows[0]?.today || 0;

        const weekQuery = `SELECT COALESCE(SUM(price), 0) as week FROM rides WHERE driver_email = $1 AND status IN (${statusList}) AND created_at >= CURRENT_DATE - ((EXTRACT(DOW FROM CURRENT_DATE)::integer + 6) % 7) * INTERVAL '1 day' AND created_at < CURRENT_DATE - ((EXTRACT(DOW FROM CURRENT_DATE)::integer + 6) % 7) * INTERVAL '1 day' + INTERVAL '7 days'`;
        db.query(weekQuery, [email], (errWeek, weekResults) => {
          if (errWeek) {
            console.log('Week earnings query error:', errWeek.message);
          }
          const week = weekResults.rows[0]?.week || 0;

          const monthQuery = `SELECT COALESCE(SUM(price), 0) as month FROM rides WHERE driver_email = $1 AND status IN (${statusList}) AND created_at >= DATE_TRUNC('month', CURRENT_DATE)`;
          db.query(monthQuery, [email], (errMonth, monthResults) => {
            if (errMonth) {
              console.log('Month earnings query error:', errMonth.message);
            }
            const month = monthResults.rows[0]?.month || 0;

            const countQuery = `SELECT COUNT(*) as count FROM rides WHERE driver_email = $1 AND status IN (${statusList})`;
            db.query(countQuery, [email], (err3, countResults) => {
              if (err3) {
                console.log('Count query error:', err3.message);
              }
              const trips = countResults.rows[0]?.count || 0;

              const recentRidesQuery = `
                SELECT r.id, r.passenger_name, r.price, r.status, r.created_at,
                       r.pickup_location, r.dropoff_location
                FROM rides r
                WHERE r.driver_email = $1 AND r.status IN (${statusList})
                ORDER BY r.created_at DESC
                LIMIT 10
              `;
              db.query(recentRidesQuery, [email], (err4, ridesResults) => {
                if (err4) {
                  console.log('Recent rides query error:', err4.message);
                }
                const recentRides = ridesResults?.rows || [];

                db.query('SELECT id FROM public.users WHERE email = $1', [email], (errUser, userResults) => {
                  if (errUser || userResults.rows.length === 0) {
                    return res.json({ today_earnings: today, total_earnings: total, total_trips: trips, week_earnings: week, month_earnings: month, withdrawn: 0, recent_rides: recentRides, recent_withdrawals: [] });
                  }

                  const userId = userResults.rows[0].id;
                  db.query('SELECT * FROM driver_wallets WHERE user_id = $1', [userId], (errWallet, walletResults) => {
                    if (errWallet) {
                      return res.json({ today_earnings: today, total_earnings: total, total_trips: trips, week_earnings: week, month_earnings: month, withdrawn: 0, recent_rides: recentRides, recent_withdrawals: [] });
                    }
                    const wallet = walletResults.rows[0];
                    const withdrawn = wallet ? parseFloat(wallet.total_withdrawn || 0) : 0;

                    db.query(
                      `SELECT id, amount, status, created_at FROM withdrawal_requests WHERE driver_id = $1 ORDER BY created_at DESC LIMIT 10`,
                      [userId],
                      (errW, wResults) => {
                        if (errW) {
                          return res.json({ today_earnings: today, total_earnings: total, total_trips: trips, week_earnings: week, month_earnings: month, withdrawn, recent_rides: recentRides, recent_withdrawals: [] });
                        }
                        const recent_withdrawals = wResults.rows.map(w => ({
                          id: w.id,
                          amount: parseFloat(w.amount),
                          status: w.status,
                          created_at: w.created_at,
                        }));

                        res.json({
                          today_earnings: today,
                          total_earnings: total,
                          total_trips: trips,
                          week_earnings: week,
                          month_earnings: month,
                          withdrawn,
                          recent_rides: recentRides,
                          recent_withdrawals,
                        });
                      }
                    );
                  });
                });
              });
            });
          });
        });
      });
    });
  });

  // Get driver stats (today's trips and earnings) - must be defined BEFORE /api/drivers/:email
   app.get('/api/drivers/stats', requireDriverApproval, (req, res) => {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    // Include multiple completed statuses
    const completedStatuses = ['completed', 'confirmed', 'active'];

    try {
      // Get today's stats
      const statsQuery = `
        SELECT
          COUNT(*) as today_trips,
          COALESCE(SUM(price), 0) as today_earnings
        FROM rides
        WHERE driver_email = $1 AND status IN (${completedStatuses.map(s => `'${s}'`).join(',')})
        AND DATE(created_at) = CURRENT_DATE
      `;
      db.query(statsQuery, [email], (err, results) => {
        if (err) {
          console.log('Stats query error:', err.message);
          return res.json({ today_trips: 0, today_earnings: 0 });
        }
        res.json({
          today_trips: results.rows[0]?.today_trips || 0,
          today_earnings: results.rows[0]?.today_earnings || 0
        });
      });
    } catch (e) {
      console.log('Stats catch error:', e.message);
      res.json({ today_trips: 0, today_earnings: 0 });
    }
  });

  // Get driver info by email - accessible without auth for unapproved drivers
  app.get('/api/drivers/:email', (req, res) => {
    const { email } = req.params;
    console.log(`[DEBUG] Fetching driver info for email: ${email}`);

    db.query(`
      SELECT
        u.id, u.first_name, u.last_name, u.email, u.phone, u.profile_picture, dp.rating, dp.is_online,
        c.make, c.model, c.year, c.color, c.plate_number, c.image_url
      FROM public.users u
      LEFT JOIN driver_profiles dp ON u.id = dp.user_id
      LEFT JOIN cars c ON c.user_id = u.id
      WHERE u.email = $1 AND LOWER(u.role) = 'driver'
    `, [email], (err, results) => {
      if (err) return res.status(500).json({ error: 'Failed to fetch driver info', details: err.message });
      if (results.rows.length === 0) {
        console.log(`[DEBUG] Driver not found for email: ${email}`);
        return res.status(404).json({ error: 'Driver not found' });
      }

      const driver = results.rows[0];
      console.log(`[DEBUG] Driver info found:`, JSON.stringify(driver));
      res.json({
      ...driver,
      vehicle: {
        make: driver.make,
        model: driver.model,
        year: driver.year,
        color: driver.color,
        plate: driver.plate_number,
        image_url: driver.image_url,
      }
    });
    });
  });

  // Update driver profile picture
  app.patch('/api/drivers/:email/profile-picture', requireDriverApproval, (req, res) => {
    const { email } = req.params;
    const { profile_picture } = req.body;

    if (!profile_picture) {
      return res.status(400).json({ error: 'profile_picture is required' });
    }

    db.query(
      'UPDATE public.users SET profile_picture = $1 WHERE email = $2 RETURNING id, first_name, last_name, email, phone, profile_picture',
      [profile_picture, email],
      (err, results) => {
        if (err) return res.status(500).json({ error: 'Failed to update profile picture', details: err.message });
        if (results.rows.length === 0) return res.status(404).json({ error: 'User not found' });
        res.json({ user: results.rows[0] });
      }
    );
  });

  // Update driver vehicle image - allowed during verification
  app.patch('/api/drivers/:email/vehicle-image', authenticateToken, (req, res) => {
    const { email } = req.params;
    const { image_url } = req.body;

    if (!image_url) {
      return res.status(400).json({ error: 'image_url is required' });
    }

    db.query(
      `UPDATE cars c
       SET image_url = $1, updated_at = NOW()
       FROM public.users u
       WHERE c.user_id = u.id AND u.email = $2
       RETURNING c.id, c.image_url`,
      [image_url, email],
      (err, results) => {
        if (err) return res.status(500).json({ error: 'Failed to update vehicle image', details: err.message });
        if (results.rows.length === 0) return res.status(404).json({ error: 'Car not found for user' });
        res.json({ car: results.rows[0] });
      }
    );
  });

  // Get passenger info
  app.get('/api/passengers/:email', (req, res) => {
    const { email } = req.params;

    db.query('SELECT id, first_name, last_name, email, phone, rating FROM public.users WHERE email = $1', [email], (err, results) => {
      if (err) return res.status(500).json({ error: 'Failed to fetch passenger info' });
      if (results.rows.length === 0) return res.status(404).json({ error: 'Passenger not found' });
      res.json(results.rows[0]);
    });
  });

  // GET pricing for city hub areas and vehicle types
  app.get('/api/pricing', (req, res) => {
    const locationPrices = {
      lefkosa: 250,
      girne: 350,
      magusa: 250,
      iskele: 300
    };

    const vehiclePrices = {
      motorcycle: 50,
      sedan: 150,
      truck: 400
    };

    res.json({ locationPrices, vehiclePrices });
  });
}

module.exports = { registerDriversRoutes };
