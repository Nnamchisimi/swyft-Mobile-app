const Iyzipay = require('iyzipay');
const crypto = require('crypto');

const apiKey = process.env.IYZICO_API_KEY;
const secretKey = process.env.IYZICO_SECRET_KEY;
const baseUrl = process.env.IYZICO_BASE_URL || 'https://sandbox-api.iyzipay.com';

const iyzipay = apiKey && secretKey ? new Iyzipay({
  apiKey,
  secretKey,
  uri: baseUrl,
}) : null;

function ensurePaymentsTable(db) {
  return new Promise((resolve, reject) => {
    db.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        payment_id VARCHAR(255) UNIQUE NOT NULL,
        ride_id INTEGER NOT NULL,
        passenger_email VARCHAR(255) NOT NULL,
        amount NUMERIC(10, 2) NOT NULL,
        currency VARCHAR(10) NOT NULL DEFAULT 'TRY',
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        token VARCHAR(255),
        verified BOOLEAN DEFAULT FALSE,
        raw_response JSONB,
        callback_params JSONB,
        webhook_payload JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `, (err) => {
      if (err) return reject(err);
      db.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS token VARCHAR(255)`, (alterErr) => {
        if (alterErr) console.error('Failed to add payments.token column:', alterErr);
      });
      db.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT FALSE`, (alterErr) => {
        if (alterErr) console.error('Failed to add payments.verified column:', alterErr);
      });
      resolve();
    });
  });
}

function registerPaymentsRoutes(app, db, io) {
  if (!iyzipay) {
    app.use('/api/payments', (req, res) => {
      res.status(503).json({ error: 'Payment service is not configured' });
    });
    return;
  }

  ensurePaymentsTable(db).catch((err) => {
    console.error('Failed to ensure payments table exists:', err);
  });

  const dbQuery = (sql, params) =>
    new Promise((resolve, reject) => {
      db.query(sql, params, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

  async function verifyPayment(paymentId) {
    if (!paymentId || !iyzipay.checkoutForm || !iyzipay.checkoutForm.retrieve) {
      return 'pending';
    }

    const paymentResult = await dbQuery('SELECT * FROM payments WHERE payment_id = $1', [paymentId]);
    const payment = paymentResult.rows[0];
    if (!payment || !payment.token) {
      return 'pending';
    }

    if (payment.status === 'succeeded' || payment.status === 'failed') {
      return payment.status;
    }

    const inquiryRequest = {
      locale: 'tr',
      conversationId: payment.payment_id,
      token: payment.token,
    };

    let inquiryResult = null;
    try {
      inquiryResult = await new Promise((resolve, reject) => {
        iyzipay.checkoutForm.retrieve(inquiryRequest, (err, response) => {
          if (err) return reject(err);
          resolve(response);
        });
      });
    } catch (error) {
      console.error('Iyzico payment inquiry error:', error);
      return payment.status;
    }

    const paymentSucceeded = inquiryResult.status === 'success' && inquiryResult.paymentStatus === 'SUCCESS';
    const status = paymentSucceeded ? 'succeeded' : 'failed';

    const updates = {
      status,
      raw_response: inquiryResult,
      verified: status !== 'pending',
      updated_at: new Date().toISOString(),
    };

    const setClauses = Object.keys(updates).map((key, index) => `${key} = $${index + 1}`).join(', ');
    const values = Object.values(updates);

    await dbQuery(`UPDATE payments SET ${setClauses} WHERE payment_id = $${values.length + 1}`, [...values, paymentId]);

    if (io && payment.passenger_email) {
      io.to(payment.passenger_email).emit('paymentStatusUpdated', {
        paymentId: payment.payment_id,
        status,
        ride_id: payment.ride_id,
      });
    }

    if (io && status === 'succeeded' && payment.ride_id) {
      io.emit('paymentSucceeded', { paymentId: payment.payment_id, rideId: payment.ride_id });

      const rideResult = await dbQuery('SELECT * FROM rides WHERE id = $1', [payment.ride_id]);
      const ride = rideResult.rows[0];
      if (ride) {
        const newRide = {
          ...ride,
          created_at: ride.created_at ? new Date(ride.created_at).toISOString() : new Date().toISOString(),
        };
        console.log('Emitting newRide to onlineDrivers after card payment verification');
        io.to('onlineDrivers').emit('newRide', newRide);
      }
    }

    return status;
  }

  app.post('/api/payments/create', async (req, res) => {
    try {
      const { ride_id, passenger_email, amount, currency = 'TRY' } = req.body;

      if (!ride_id || !passenger_email || !amount) {
        return res.status(400).json({ error: 'ride_id, passenger_email and amount are required' });
      }

      let ride = null;
      try {
        const rideResult = await dbQuery('SELECT * FROM rides WHERE id = $1', [ride_id]);
        ride = rideResult.rows[0];
      } catch (e) {
        console.error('DB error fetching ride:', e.message);
      }

      if (!ride) return res.status(404).json({ error: 'Ride not found' });
      if (ride.passenger_email !== passenger_email) return res.status(403).json({ error: 'Unauthorized' });

      const paymentId = `PAY_${Date.now()}_${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

      await dbQuery(
        `INSERT INTO payments (payment_id, ride_id, passenger_email, amount, currency, status) VALUES ($1, $2, $3, $4, $5, $6)`,
        [paymentId, ride_id, passenger_email, amount, currency, 'pending']
      );

      const request = {
        locale: 'tr',
        conversationId: paymentId,
        price: parseFloat(amount).toFixed(2),
        paidPrice: parseFloat(amount).toFixed(2),
        currency,
        installment: '1',
        basketId: ride_id,
        paymentChannel: 'WEB',
        paymentGroup: 'PRODUCT',
        callbackUrl: `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/payments/callback`,
      };

      const cardInfo = {
        id: ride_id.toString(),
        name: 'SWYFT Courier Delivery',
        category1: 'Delivery',
        itemType: 'VIRTUAL',
        price: parseFloat(amount).toFixed(2),
      };

      const buyer = {
        id: `BY${Date.now()}`,
        name: ride.passenger_name || 'Passenger',
        surname: (ride.passenger_name || 'Passenger').split(' ').slice(1).join(' ') || 'Passenger',
        gsmNumber: ride.passenger_phone || '+905555555555',
        email: passenger_email,
        identityNumber: '11111111111',
        registrationAddress: 'Turkey',
        city: 'Istanbul',
        country: 'Turkey',
      };

      const paymentRequest = {
        ...request,
        buyer,
        shippingAddress: {
          contactName: ride.passenger_name || 'Passenger',
          city: 'Istanbul',
          country: 'Turkey',
          address: 'Istanbul, Turkey',
        },
        billingAddress: {
          contactName: ride.passenger_name || 'Passenger',
          city: 'Istanbul',
          country: 'Turkey',
          address: 'Istanbul, Turkey',
        },
        basketItems: [cardInfo],
      };

      const result = await new Promise((resolve, reject) => {
        iyzipay.checkoutFormInitialize.create(paymentRequest, (err, response) => {
          if (err) return reject(err);
          resolve(response);
        });
      });

      console.log('Iyzico checkout form init result:', JSON.stringify(result));

      await dbQuery(
        `UPDATE payments SET raw_response = $1, token = $2, updated_at = NOW() WHERE payment_id = $3`,
        [result, result.token, paymentId]
      );

      if (result.paymentPageUrl) {
        return res.json({ paymentId, paymentPageUrl: result.paymentPageUrl, token: result.token, status: 'pending' });
      } else if (result.threeDSHtmlContent) {
        return res.json({ paymentId, threeDSHtmlContent: result.threeDSHtmlContent, token: result.token, status: 'pending' });
      }

      return res.status(400).json({
        error: 'Could not initialize payment',
        status: 'pending',
        iyzicoStatus: result.status,
        iyzicoError: result.errorMessage || result.errorCode || null,
        details: JSON.stringify(result)
      });
    } catch (error) {
      console.error('Payment create error:', error);
      return res.status(500).json({ error: 'Payment initialization failed', details: error.message });
    }
  });

  app.get('/api/payments/callback', async (req, res) => {
    try {
      console.log('Iyzico callback received (verification handled by webhook):', JSON.stringify(req.query));
      res.status(200).send('<html><body><h1>Payment Complete</h1><p>You may close this window.</p><script>setTimeout(function(){ window.close(); }, 1000);</script></body></html>');
    } catch (error) {
      console.error('Payment GET callback error:', error);
      res.status(200).send('<html><body><h1>Payment Complete</h1><p>You may close this window.</p><script>setTimeout(function(){ window.close(); }, 1000);</script></body></html>');
    }
  });

  app.post('/api/payments/callback', async (req, res) => {
    try {
      console.log('Iyzico callback received (verification handled by webhook):', JSON.stringify(req.body));
      res.status(200).send('<html><body><h1>Payment Complete</h1><p>You may close this window.</p><script>setTimeout(function(){ window.close(); }, 1000);</script></body></html>');
    } catch (error) {
      console.error('Payment callback error:', error);
      res.status(200).send('<html><body><h1>Payment Complete</h1><p>You may close this window.</p><script>setTimeout(function(){ window.close(); }, 1000);</script></body></html>');
    }
  });

  app.post('/api/payments/webhook', (req, res) => {
    console.log("========== WEBHOOK HIT ==========");
    console.log(req.headers);
    console.log(req.body);

    res.sendStatus(200);
});s

  app.post('/api/payments/verify', async (req, res) => {
    try {
      const { paymentId } = req.body;
      if (!paymentId) {
        return res.status(400).json({ error: 'paymentId is required' });
      }

      const status = await verifyPayment(paymentId);

      const paymentResult = await dbQuery('SELECT * FROM payments WHERE payment_id = $1', [paymentId]);
      const payment = paymentResult.rows[0];
      const rawResponse = payment ? payment.raw_response : null;

      return res.json({ status, rawResponse });
    } catch (error) {
      console.error('Payment verify error:', error);
      return res.status(500).json({ error: 'Payment verification failed', details: error.message });
    }
  });

  app.get('/api/payments/status/:paymentId', async (req, res) => {
    const { paymentId } = req.params;

    try {
      const result = await dbQuery('SELECT * FROM payments WHERE payment_id = $1', [paymentId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Payment not found' });
      }

      const payment = result.rows[0];
      res.json({
        id: payment.payment_id,
        ride_id: payment.ride_id,
        passenger_email: payment.passenger_email,
        amount: parseFloat(payment.amount),
        currency: payment.currency,
        status: payment.status,
        created_at: payment.created_at,
        updated_at: payment.updated_at,
      });
    } catch (error) {
      console.error('Payment status DB error:', error);
      res.status(500).json({ error: 'Failed to fetch payment status' });
    }
  });
}

module.exports = { registerPaymentsRoutes };
