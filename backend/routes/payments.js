const Iyzipay = require('iyzipay');

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
        raw_response JSONB,
        callback_params JSONB,
        webhook_payload JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `, (err) => {
      if (err) reject(err);
      else resolve();
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
        `UPDATE payments SET raw_response = $1, updated_at = NOW() WHERE payment_id = $2`,
        [JSON.stringify(result), paymentId]
      );

      if (result.paymentPageUrl) {
        return res.json({ paymentId, paymentPageUrl: result.paymentPageUrl, status: 'pending' });
      } else if (result.threeDSHtmlContent) {
        return res.json({ paymentId, threeDSHtmlContent: result.threeDSHtmlContent, status: 'pending' });
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

  app.post('/api/payments/callback', async (req, res) => {
    try {
      const callbackParams = req.body;
      const conversationId = callbackParams.conversationId || callbackParams.conversation_id;

      if (conversationId) {
        const isSuccess = callbackParams.status === 'success' || String(callbackParams.paymentStatus || '').toLowerCase() === 'success';
        const status = isSuccess ? 'succeeded' : 'failed';

        await dbQuery(
          `UPDATE payments SET status = $1, callback_params = $2, updated_at = NOW() WHERE payment_id = $3`,
          [status, JSON.stringify(callbackParams), conversationId]
        );

        const paymentResult = await dbQuery('SELECT passenger_email, ride_id FROM payments WHERE payment_id = $1', [conversationId]);
        const payment = paymentResult.rows[0];
        if (payment) {
          if (io && payment.passenger_email) {
            io.to(payment.passenger_email).emit('paymentStatusUpdated', {
              paymentId: conversationId,
              status,
              ride_id: payment.ride_id,
            });
          }
          if (io && isSuccess && payment.ride_id) {
            io.emit('paymentSucceeded', { paymentId: conversationId, rideId: payment.ride_id });
          }
        }
      }

      res.status(200).json({ received: true });
    } catch (error) {
      console.error('Payment callback error:', error);
      res.status(200).json({ received: true });
    }
  });

  app.post('/api/payments/webhook', async (req, res) => {
    try {
      const notification = req.body;

      if (!notification || !notification.conversationId) {
        return res.status(400).json({ error: 'Invalid payload' });
      }

      const conversationId = notification.conversationId;
      const isSuccess = notification.status === 'success' || String(notification.paymentStatus || '').toLowerCase() === 'success';
      const status = isSuccess ? 'succeeded' : 'failed';

      await dbQuery(
        `UPDATE payments SET status = $1, webhook_payload = $2, updated_at = NOW() WHERE payment_id = $3`,
        [status, JSON.stringify(notification), conversationId]
      );

      const paymentResult = await dbQuery('SELECT passenger_email, ride_id FROM payments WHERE payment_id = $1', [conversationId]);
      const payment = paymentResult.rows[0];
      if (payment) {
        if (io && payment.passenger_email) {
          io.to(payment.passenger_email).emit('paymentStatusUpdated', {
            paymentId: conversationId,
            status,
            ride_id: payment.ride_id,
          });
        }
        if (io && isSuccess && payment.ride_id) {
          io.emit('paymentSucceeded', { paymentId: conversationId, rideId: payment.ride_id });
        }
      }

      res.status(200).json({ received: true });
    } catch (error) {
      console.error('Payment webhook error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
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
