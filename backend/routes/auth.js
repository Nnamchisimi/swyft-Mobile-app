const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const {
  generateVerificationCode,
  signToken,
  verifyToken,
  sendVerificationEmail,
  sendPasswordResetEmail
} = require('../utils/helpers');

// Register auth/user endpoints: verify-code, resend, signup, verify (GET), login, profile, google oauth
function registerAuthRoutes(app, db) {
  const dbQuery = (sql, params) => new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });

  // === VERIFY EMAIL CODE (POST - for mobile app) ===
  app.post('/api/users/verify-code', (req, res) => {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: 'Email and code required' });
    }

    console.log('Verifying code:', email, code);

    db.query('SELECT id FROM public.users WHERE email = $1', [email], (err0, userResult) => {
      if (err0) return res.status(500).json({ error: 'Server error finding user: ' + err0.message });
      if (userResult.rows.length === 0) return res.status(400).json({ error: 'User not found' });

      const userId = userResult.rows[0].id;
      console.log('Found userId:', userId);

      db.query('SELECT * FROM email_verification_tokens WHERE user_id = $1 AND token = $2 AND expires_at > NOW()', [userId, code], (err, results) => {
        if (err) return res.status(500).json({ error: 'Server error: ' + err.message });
        console.log('Token query results:', results.rows);

        if (results.rows.length === 0) return res.status(400).json({ error: 'Invalid or expired code' });

        db.query('UPDATE public.users SET is_verified = true, verified = true WHERE id = $1', [userId], (err3) => {
          if (err3) return res.status(500).json({ error: 'Verification failed: ' + err3.message });

          db.query('DELETE FROM email_verification_tokens WHERE user_id = $1', [userId]);

          db.query('SELECT * FROM public.users WHERE id = $1', [userId], (err4, user) => {
            if (err4 || user.rows.length === 0) return res.status(500).json({ error: 'User not found' });

            const token = signToken({ id: userId, email, role: user.rows[0].role });
            const userData = user.rows[0];
            userData.token = token;

            console.log('Verification successful for user:', userId);

            res.json({
              message: 'Email verified successfully',
              token,
              user: userData
            });
          });
        });
      });
    });
  });

  // === RESEND VERIFICATION CODE ===
  app.post('/api/users/resend-code', (req, res) => {
    const { email } = req.body;

    if (!email) return res.status(400).json({ error: 'Email required' });

    db.query('SELECT id, is_verified FROM public.users WHERE email = $1', [email], (err, results) => {
      if (err) return res.status(500).json({ error: 'Server error' });
      if (results.rows.length === 0) return res.status(404).json({ error: 'User not found' });
      if (results.rows[0].is_verified) return res.status(400).json({ error: 'Email already verified' });

      const userId = results.rows[0].id;
      const code = generateVerificationCode();

      db.query('DELETE FROM email_verification_tokens WHERE user_id = $1', [userId]);

      // Insert new verification token
      db.query('INSERT INTO email_verification_tokens (user_id, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'15 minutes\')', [userId, code], (err2) => {
        if (err2) {
          console.log('Verification token error:', err2.message);
          // Continue anyway - user can resend code
        }

        // Send verification email
        sendVerificationEmail(email, code);

        res.json({ message: 'Verification code sent' });
      });
    });
  });

  // === SIGNUP ===
  app.post('/api/users', async (req, res) => {
    console.log('Registration request received:', req.body);

    const {
      first_name,
      last_name,
      email,
      password,
      role,
      phone,
      vehicle_make,
      vehicle_model,
      vehicle_year,
      vehicle_color,
      vehicle_plate
    } = req.body;

    if (!first_name || !last_name || !email || !password || !role)
      return res.status(400).json({ error: 'Missing required fields: first_name, last_name, email, password, role' });

    if (role === 'driver' && (!vehicle_make || !vehicle_model || !vehicle_plate))
      return res.status(400).json({ error: 'Vehicle details required for drivers' });

    const normalizedRole = (role || 'passenger').toLowerCase();

    // For Google OAuth users, use a special marker (don't need real password)
    const finalPassword = password === 'google-oauth' ? 'google-oauth' : password;

    db.query('SELECT id FROM public.users WHERE email = $1', [email], async (err, results) => {
      if (err) return res.status(500).json({ error: 'Server error: ' + err.message });
      if (results.rows.length > 0) return res.status(400).json({ error: 'Email already exists' });

      const hashedPassword = await bcrypt.hash(finalPassword, 10);

      // Insert user - NOT verified yet (requires email verification)
      // role is stored lowercase for consistent comparisons (e.g. 'driver', 'passenger', 'admin')
      const userQuery = 'INSERT INTO public.users (first_name, last_name, email, password, role, phone, is_verified) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, role';
      const userValues = [first_name?.trim(), last_name?.trim(), email?.trim(), hashedPassword, normalizedRole, phone || null, false];

      db.query(userQuery, userValues, async (err2, result) => {
        if (err2) {
          console.log('User insert error:', err2.message);
          return res.status(500).json({ error: 'Failed to create user', details: err2.message });
        }

        const userId = result.rows[0].id;
        const userRole = result.rows[0].role;
        console.log('User created (pending verification):', userId, 'Role:', userRole);

        // If driver, create car record
        if (userRole === 'driver') {
          try {
            const carQuery = 'INSERT INTO cars (user_id, make, model, year, color, plate_number) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id';
            const carValues = [userId, vehicle_make, vehicle_model, vehicle_year, vehicle_color, vehicle_plate];
            const carResult = await dbQuery(carQuery, carValues);
            const carId = carResult.rows[0].id;
            await dbQuery('UPDATE users SET vehicle_id = $1 WHERE id = $2', [carId, userId]);
            console.log('Car record created for driver:', userId, 'carId:', carId);
          } catch (carErr) {
            console.log('Car insert error:', carErr.message);
          }
        }

        // Generate and store verification code
        const code = generateVerificationCode();

        // Delete any existing tokens for this user
        db.query('DELETE FROM email_verification_tokens WHERE user_id = $1', [userId]);

        // Insert new verification token
        db.query('INSERT INTO email_verification_tokens (user_id, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'15 minutes\')', [userId, code], async (err3) => {
          if (err3) {
            console.log('Verification token error:', err3.message);
            // Continue anyway - user can resend code
          }

          // Send verification email and wait for result
          const emailSent = await sendVerificationEmail(email, code);
          console.log('Email send result:', emailSent ? 'SUCCESS' : 'FAILED');

          // Return success - user needs to verify email
          res.status(201).json({
            message: emailSent
              ? 'User created successfully. Please verify your email.'
              : 'User created, but verification email failed. Please request a new code.',
            requiresVerification: true,
            email: email,
            emailSent: emailSent
          });
        });
      });
    });
  });

  // === VERIFY EMAIL (GET - for email link) ===
  app.get('/api/users/verify', (req, res) => {
    const { token, email } = req.query;
    if (!token) return res.status(400).json({ error: 'Invalid verification link' });

    try {
      // token here is the 6-digit code, not a JWT
      db.query('SELECT id FROM public.users WHERE email = $1', [email], (err0, userResult) => {
        if (err0 || userResult.rows.length === 0) return res.status(400).json({ error: 'Invalid verification link' });

        const userId = userResult.rows[0].id;
        db.query('SELECT * FROM email_verification_tokens WHERE user_id = $1 AND token = $2 AND expires_at > NOW()', [userId, token], (err, results) => {
          if (err || results.rows.length === 0) return res.status(400).json({ error: 'Invalid or expired token' });

          db.query('UPDATE public.users SET is_verified = true, verified = true WHERE id = $1', [userId], (err2) => {
            if (err2) return res.status(500).json({ error: 'Failed to verify email' });

            db.query('DELETE FROM email_verification_tokens WHERE user_id = $1', [userId]);

            // Generate JWT for auto-login after verification
            db.query('SELECT * FROM public.users WHERE id = $1', [userId], (err4, user) => {
              if (err4 || user.rows.length === 0) return res.status(500).json({ error: 'User not found' });

              const jwtToken = signToken({ id: userId, email, role: user.rows[0].role });
              const userData = user.rows[0];
              userData.token = jwtToken;

              // Redirect to app deep link with token and user data for auto-login
              const appScheme = process.env.APP_SCHEME || 'swyftmobile';
              const redirectUrl = `${appScheme}://verify?token=${jwtToken}&email=${encodeURIComponent(email)}`;
              res.redirect(redirectUrl);
            });
          });
        });
      });
    } catch {
      res.status(400).json({ error: 'Invalid or expired token' });
    }
  });

  // === LOGIN ===
  function issueDriverToken(user, res) {
    const token = signToken({ id: user.id, email: user.email, role: user.role });
    db.query('SELECT * FROM cars WHERE user_id = $1', [user.id], (err2, carResults) => {
      const car = carResults && carResults.rows.length > 0 ? carResults.rows[0] : null;
      res.json({
        token,
        id: user.id,
        role: user.role,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        phone: user.phone,
        vehicle: car ? `${car.year} ${car.make} ${car.model}` : null,
        vehicle_make: car ? car.make : null,
        vehicle_model: car ? car.model : null,
        vehicle_year: car ? car.year : null,
        vehicle_color: car ? car.color : null,
        vehicle_plate: car ? car.plate_number : null
      });
    });
  }

  app.post('/api/users/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    db.query('SELECT * FROM public.users WHERE email = $1', [email], async (err, results) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (results.rows.length === 0) return res.status(404).json({ error: 'User not found' });

      const user = results.rows[0];

      // Handle Google OAuth users specially
      if (user.password === 'google-oauth') {
        if (password !== 'google-oauth') {
          return res.status(401).json({ error: 'Incorrect password' });
        }
      } else {
        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(401).json({ error: 'Incorrect password' });
      }

      // Check if user is verified
      if (!user.is_verified && !user.verified) {
        return res.status(403).json({
          error: 'Email not verified',
          requiresVerification: true,
          email: email
        });
      }

      // If driver, check if account is approved
      if (user.role && user.role.toLowerCase() === 'driver') {
        db.query('SELECT is_approved FROM driver_verification_status WHERE user_id = $1', [user.id], (errAppr, apprResults) => {
          if (errAppr) {
            console.error('Approval check error:', errAppr.message);
          }

          const driverApproved = apprResults && apprResults.rows.length > 0 && apprResults.rows[0].is_approved;
          const userVerified = !!(user.is_verified || user.verified);

          if (driverApproved || userVerified) {
            return issueDriverToken(user, res);
          }

          db.query('SELECT is_verified FROM id_documents WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [user.id], (err1, idResult) => {
            if (err1) {
              console.error('ID document check error:', err1.message);
            }

            db.query('SELECT is_verified FROM selfie_verifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [user.id], (err2, selfieResult) => {
              if (err2) {
                console.error('Selfie check error:', err2.message);
              }

              db.query('SELECT is_verified FROM phone_verifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [user.id], (err3, phoneResult) => {
                if (err3) {
                  console.error('Phone check error:', err3.message);
                }

                db.query('SELECT is_verified FROM bank_accounts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [user.id], (err4, bankResult) => {
                  if (err4) {
                    console.error('Bank check error:', err4.message);
                  }

                  const idVerified = idResult.rows.length > 0 && idResult.rows[0].is_verified;
                  const selfieVerified = selfieResult.rows.length > 0 && selfieResult.rows[0].is_verified;
                  const phoneVerified = phoneResult.rows.length > 0 && phoneResult.rows[0].is_verified;
                  const bankVerified = bankResult.rows.length > 0 && bankResult.rows[0].is_verified;

                  const allVerified = idVerified && selfieVerified && phoneVerified && bankVerified;

                  if (allVerified) {
                    return issueDriverToken(user, res);
                  }

                  return res.status(403).json({
                    error: 'Your driver account is pending approval. Please complete your verification steps.',
                    requiresVerification: true,
                    email: email,
                    role: user.role
                  });
                });
              });
            });
          });
        });
        return;
      }

      const token = signToken(
        { id: user.id, email: user.email, role: user.role }
      );

      res.json({
        token,
        id: user.id,
        role: user.role,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        phone: user.phone
      });
    });
  });

  // === FORGOT PASSWORD ===
  const ensurePasswordResetTables = (cb) => {
    db.query(`CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash VARCHAR(255) NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`, cb);
  };

  app.post('/api/users/forgot-password', (req, res) => {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    ensurePasswordResetTables((err) => {
      if (err) {
        console.error('Failed to ensure password reset tables:', err);
      }

      db.query('SELECT id FROM public.users WHERE email = $1', [email], (err, results) => {
        if (err) {
          return res.status(500).json({ error: 'Server error' });
        }

        const userId = results.rows[0]?.id;
        if (!userId) {
          return res.status(404).json({ error: 'User not found' });
        }

        const code = generateVerificationCode();

        bcrypt.hash(code, 10, (err, tokenHash) => {
          if (err) {
            return res.status(500).json({ error: 'Server error' });
          }

          db.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [userId]);

          db.query('INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'15 minutes\')', [userId, tokenHash], (err2) => {
            if (err2) {
              console.log('Password reset token error:', err2.message);
            }

            sendPasswordResetEmail(email, code);

            res.json({ message: 'Password reset code sent' });
          });
        });
      });
    });
  });

  // === RESET PASSWORD ===
  app.post('/api/users/reset-password', async (req, res) => {
    const { email, code, password } = req.body;

    if (!email || !code || !password) {
      return res.status(400).json({ error: 'Email, code, and new password are required' });
    }

    try {
      ensurePasswordResetTables((err) => {
        if (err) {
          console.error('Failed to ensure password reset tables:', err);
        }
      });

      db.query('SELECT id FROM public.users WHERE email = $1', [email], async (err, results) => {
        if (err) {
          console.error('Reset password user lookup error:', err);
          return res.status(500).json({ error: 'Server error' });
        }

        const userId = results.rows[0]?.id;
        if (!userId) {
          return res.status(404).json({ error: 'User not found' });
        }

        db.query('SELECT token_hash FROM password_reset_tokens WHERE user_id = $1 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1', [userId], async (err2, tokenResults) => {
          if (err2) {
            console.error('Reset password token lookup error:', err2);
            return res.status(500).json({ error: 'Server error' });
          }

          if (tokenResults.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid or expired reset code' });
          }

          const tokenHash = tokenResults.rows[0].token_hash;
          const match = await bcrypt.compare(code, tokenHash);

          if (!match) {
            return res.status(400).json({ error: 'Invalid reset code' });
          }

          const hashedPassword = await bcrypt.hash(password, 10);

          db.query('UPDATE public.users SET password = $1 WHERE id = $2', [hashedPassword, userId], (err3) => {
            if (err3) {
              console.error('Reset password update error:', err3);
              return res.status(500).json({ error: 'Failed to reset password' });
            }

            db.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [userId]);

            res.json({ message: 'Password reset successful' });
          });
        });
      });
    } catch (err) {
      console.error('Reset password unexpected error:', err);
      return res.status(400).json({ error: 'Invalid or expired code' });
    }
  });

  // === USER PROFILE ===
  app.get('/api/user/profile', (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const decoded = verifyToken(token);
      db.query('SELECT id, first_name, last_name, email, phone, vehicle_plate, role FROM public.users WHERE id = $1', [decoded.id], (err, results) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (results.rows.length === 0) return res.status(404).json({ error: 'User not found' });

        const user = results.rows[0];
        res.json({
          id: user.id,
          firstName: user.first_name,
          lastName: user.last_name,
          email: user.email,
          phone: user.phone,
          vehicle: user.vehicle_plate,
          role: user.role
        });
      });
    } catch (error) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  });

  // GET all drivers
  app.get('/api/drivers', (req, res) => {
    db.query('SELECT id, first_name, last_name, email, phone, vehicle_plate FROM public.users WHERE role = $1', ['driver'], (err, results) => {
      if (err) return res.status(500).json({ error: 'Failed to fetch drivers' });
      res.json(results.rows);
    });
  });

  // === GOOGLE OAUTH CALLBACK ===
  const { OAuth2Client } = require('google-auth-library');
  const googleClient = new OAuth2Client({
    clientId: process.env.GOOGLE_CLIENT_ID || '1077024630815-l4o088f9l2q4udhgvnasd89v2cqmesb5.apps.googleusercontent.com',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  });

  app.post('/api/auth/google/callback', async (req, res) => {
    const { code, redirectUri } = req.body;

    console.log('=== GOOGLE OAUTH CALLBACK ===');
    console.log('Code received:', code ? 'Yes' : 'No');
    console.log('Redirect URI:', redirectUri);

    try {
      // Exchange authorization code for tokens
      const { tokens } = await googleClient.getToken({
        code,
        redirect_uri: redirectUri || 'https://auth.expo.io/@njapp/swyft-mobile',
      });

      // Verify the ID token
      const ticket = await googleClient.verifyIdToken({
        idToken: tokens.id_token,
        audience: process.env.GOOGLE_CLIENT_ID || '1077024630815-l4o088f9l2q4udhgvnasd89v2cqmesb5.apps.googleusercontent.com',
      });

      const payload = ticket.getPayload();
      const email = payload.email;
      const name = payload.name;

      // Check if user exists
      db.query('SELECT * FROM public.users WHERE email = $1', [email], (err, results) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Database error' });
        }

        if (results.rows.length === 0) {
          // Auto-register new Google user
          bcrypt.hash('google-oauth', 10, (err2, hashedPassword) => {
            if (err2) return res.status(500).json({ error: 'Hashing failed' });

            db.query(
              'INSERT INTO public.users (first_name, last_name, email, password, role, phone, is_verified, verified) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, role',
              [name ? name.split(' ')[0] : '', name ? name.split(' ').slice(1).join(' ') : '', email, hashedPassword, 'passenger', '', true, true],
              (err3, result) => {
                if (err3) {
                  console.error('User creation error:', err3);
                  return res.status(500).json({ error: 'Failed to create user' });
                }

                const token = signToken(
                  { id: result.rows[0].id, email, role: 'passenger' }
                );

                res.json({
                  token,
                  user: {
                    ...result.rows[0],
                    email,
                    first_name: name ? name.split(' ')[0] : '',
                    last_name: name ? name.split(' ').slice(1).join(' ') : ''
                  }
                });
              }
            );
          });
        } else {
          // Login existing user
          const user = results.rows[0];
          const token = signToken(
            { id: user.id, email: user.email, role: user.role }
          );

          res.json({ token, user });
        }
      });
    } catch (error) {
      console.error('Google callback error:', error.message);
      console.error('Full error:', error);
      res.status(400).json({ error: 'Invalid code or token verification failed', details: error.message });
    }
  });
}

module.exports = { registerAuthRoutes };
