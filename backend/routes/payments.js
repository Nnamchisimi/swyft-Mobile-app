const Iyzipay = require('iyzipay');

const apiKey = process.env.IYZICO_API_KEY;
const secretKey = process.env.IYZICO_SECRET_KEY;
const baseUrl = process.env.IYZICO_BASE_URL || 'https://sandbox-api.iyzipay.com';

const iyzipay = apiKey && secretKey ? new Iyzipay({
  apiKey,
  secretKey,
  uri: baseUrl,
}) : null;

const paymentStore = new Map();

function registerPaymentsRoutes(app, db, io) {
  if (!iyzipay) {
    app.use('/api/payments', (req, res) => {
      res.status(503).json({ error: 'Payment service is not configured' });
    });
    return;
  }
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

      paymentStore.set(paymentId, {
        ride_id,
        passenger_email,
        amount,
        currency,
        status: 'pending',
        createdAt: new Date().toISOString(),
      });

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
        surname: '',
        gsmNumber: ride.passenger_phone || '+905555555555',
        email: passenger_email,
        identityNumber: '11111111111',
        registrationAddress: 'Turkey',
        city: 'Istanbul',
        country: 'Turkey',
      };

      const address = {
        contactName: ride.passenger_name || 'Passenger',
        city: 'Istanbul',
        country: 'Turkey',
        address: 'Istanbul, Turkey',
      };

      const paymentRequest = {
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
        buyer: {
          id: `BY${Date.now()}`,
          name: ride.passenger_name || 'Passenger',
          surname: '',
          gsmNumber: ride.passenger_phone || '+905555555555',
          email: passenger_email,
          identityNumber: '11111111111',
          registrationAddress: 'Turkey',
          city: 'Istanbul',
          country: 'Turkey',
        },
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
        basketItems: [
          {
            id: ride_id.toString(),
            name: 'SWYFT Courier Delivery',
            category1: 'Delivery',
            itemType: 'VIRTUAL',
            price: parseFloat(amount).toFixed(2),
          },
        ],
      };

      const result = await new Promise((resolve, reject) => {
        iyzipay.checkoutFormInitialize.create(paymentRequest, (err, response) => {
          if (err) return reject(err);
          resolve(response);
        });
      });

      console.log('Iyzico payment result:', JSON.stringify(result));

      const record = paymentStore.get(paymentId);
      const isSuccess = result.status === 'success' || result.status === 'captured';
      record.status = isSuccess ? 'captured' : 'failed';
      record.rawResponse = result;
      record.updatedAt = new Date().toISOString();
      paymentStore.set(paymentId, record);

      if (result.paymentPageUrl) {
        return res.json({ paymentId, paymentPageUrl: result.paymentPageUrl, status: record.status });
      } else if (result.threeDSHtmlContent) {
        return res.json({ paymentId, threeDSHtmlContent: result.threeDSHtmlContent, status: record.status });
      }

      return res.status(400).json({
        error: 'Could not initialize payment',
        status: record.status,
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

      if (conversationId && paymentStore.has(conversationId)) {
        const record = paymentStore.get(conversationId);
        const isSuccess = callbackParams.status === 'success' || String(callbackParams.paymentStatus || '').toLowerCase() === 'success';
        record.status = isSuccess ? 'succeeded' : 'failed';
        record.callbackParams = callbackParams;
        record.updatedAt = new Date().toISOString();
        paymentStore.set(conversationId, record);
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

      if (paymentStore.has(conversationId)) {
        const record = paymentStore.get(conversationId);
        const isSuccess = notification.status === 'success' || String(notification.paymentStatus || '').toLowerCase() === 'success';
        record.status = isSuccess ? 'succeeded' : 'failed';
        record.webhookPayload = notification;
        record.updatedAt = new Date().toISOString();
        paymentStore.set(conversationId, record);

        if (io && isSuccess) {
          io.emit('paymentSucceeded', { paymentId: conversationId, rideId: record.ride_id });
        }
      }

      res.status(200).json({ received: true });
    } catch (error) {
      console.error('Payment webhook error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  });

  app.get('/api/payments/status/:paymentId', (req, res) => {
    const { paymentId } = req.params;
    const record = paymentStore.get(paymentId);

    if (!record) return res.status(404).json({ error: 'Payment not found' });

    res.json({
      id: paymentId,
      ride_id: record.ride_id,
      passenger_email: record.passenger_email,
      amount: record.amount,
      currency: record.currency,
      status: record.status,
      created_at: record.createdAt,
      updated_at: record.updatedAt,
    });
  });
}

module.exports = { registerPaymentsRoutes };
