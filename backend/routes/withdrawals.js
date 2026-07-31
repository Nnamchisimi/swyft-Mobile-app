function registerWithdrawalRoutes(app, io, db) {
  // Driver: get wallet balance
  app.get('/api/drivers/wallet', (req, res) => {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    db.query('SELECT id FROM public.users WHERE email = $1', [email], (err, results) => {
      if (err) return res.status(500).json({ error: 'Server error' });
      if (results.rows.length === 0) return res.status(404).json({ error: 'Driver not found' });

      const userId = results.rows[0].id;

      db.query('SELECT * FROM driver_wallets WHERE user_id = $1', [userId], (err2, walletResults) => {
        if (err2) return res.status(500).json({ error: 'Server error' });

        let wallet = walletResults.rows[0];
        if (!wallet) {
          wallet = {
            available_balance: 0,
            pending_balance: 0,
            total_earned: 0,
            total_withdrawn: 0,
          };
        }

        // Format numbers for response
        wallet.available_balance = parseFloat(wallet.available_balance) || 0;
        wallet.pending_balance = parseFloat(wallet.pending_balance) || 0;
        wallet.total_earned = parseFloat(wallet.total_earned) || 0;
        wallet.total_withdrawn = parseFloat(wallet.total_withdrawn) || 0;

        res.json(wallet);
      });
    });
  });

  // Driver: request withdrawal
  app.post('/api/drivers/wallet/withdraw', (req, res) => {
    const { email, amount, bank_name, iban, account_holder_name } = req.body;

    if (!email) return res.status(400).json({ error: 'Email is required' });
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Valid amount is required' });

    db.query('SELECT id FROM public.users WHERE email = $1', [email], (err, results) => {
      if (err) return res.status(500).json({ error: 'Server error' });
      if (results.rows.length === 0) return res.status(404).json({ error: 'Driver not found' });

      const userId = results.rows[0].id;

      db.query('SELECT * FROM driver_wallets WHERE user_id = $1', [userId], (err2, walletResults) => {
        if (err2) return res.status(500).json({ error: 'Server error' });

        let wallet = walletResults.rows[0];
        const availableBalance = wallet ? parseFloat(wallet.available_balance) : 0;
        const requestAmount = parseFloat(amount);

        if (requestAmount > availableBalance) {
          return res.status(400).json({ 
            error: 'Insufficient balance',
            available: availableBalance,
            requested: requestAmount
          });
        }

        const createWalletIfNotExists = () => {
          const now = new Date().toISOString();
          if (!wallet) {
            db.query(
              'INSERT INTO driver_wallets (user_id, available_balance, pending_balance, total_earned, total_withdrawn, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
              [userId, -requestAmount, requestAmount, 0, 0, now, now],
              (errInsert) => {
                if (errInsert) return res.status(500).json({ error: 'Failed to create wallet' });
                createWithdrawalRequest();
              }
            );
          } else {
            createWithdrawalRequest();
          }
        };

        const createWithdrawalRequest = () => {
          db.query(
            'INSERT INTO withdrawal_requests (driver_id, amount, status, bank_name, iban, account_holder_name, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
            [userId, requestAmount, 'PENDING', bank_name || null, iban || null, account_holder_name || null, now, now],
            (err3, withdrawalResults) => {
              if (err3) return res.status(500).json({ error: 'Failed to create withdrawal request' });

              const withdrawal = withdrawalResults.rows[0];

              // Update wallet: lock funds
              db.query(
                'UPDATE driver_wallets SET available_balance = available_balance - $1, pending_balance = pending_balance + $1, updated_at = $2 WHERE user_id = $3',
                [requestAmount, now, userId],
                (err4) => {
                  if (err4) return res.status(500).json({ error: 'Failed to update wallet' });

                  res.json({
                    message: 'Withdrawal request created',
                    withdrawal: {
                      id: withdrawal.id,
                      amount: parseFloat(withdrawal.amount),
                      status: withdrawal.status,
                      bank_name: withdrawal.bank_name,
                      iban: withdrawal.iban,
                      account_holder_name: withdrawal.account_holder_name,
                      created_at: withdrawal.created_at,
                    }
                  });
                }
              );
            }
          );
        };

        createWalletIfNotExists();
      });
    });
  });

  // Driver: get withdrawal history
  app.get('/api/drivers/withdrawals', (req, res) => {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    db.query('SELECT id FROM public.users WHERE email = $1', [email], (err, results) => {
      if (err) return res.status(500).json({ error: 'Server error' });
      if (results.rows.length === 0) return res.status(404).json({ error: 'Driver not found' });

      const userId = results.rows[0].id;

      db.query(
        'SELECT * FROM withdrawal_requests WHERE driver_id = $1 ORDER BY created_at DESC',
        [userId],
        (err2, results2) => {
          if (err2) return res.status(500).json({ error: 'Server error' });

          const withdrawals = results2.rows.map(w => ({
            id: w.id,
            amount: parseFloat(w.amount),
            status: w.status,
            bank_name: w.bank_name,
            iban: w.iban,
            account_holder_name: w.account_holder_name,
            admin_notes: w.admin_notes,
            processed_by: w.processed_by,
            processed_at: w.processed_at,
            transfer_reference: w.transfer_reference,
            created_at: w.created_at,
            updated_at: w.updated_at,
          }));

          res.json(withdrawals);
        }
      );
    });
  });

  // Admin: list all pending withdrawals
  app.get('/api/admin/withdrawals', (req, res) => {
    const { status } = req.query;
    let query = 'SELECT wr.*, u.email as driver_email, u.first_name, u.last_name FROM withdrawal_requests wr JOIN public.users u ON wr.driver_id = u.id';
    const params = [];

    if (status) {
      query += ' WHERE wr.status = $1';
      params.push(status);
    } else {
      query += ' WHERE wr.status IN ($1, $2)';
      params.push('PENDING', 'PROCESSING');
    }

    query += ' ORDER BY wr.created_at ASC';

    db.query(query, params, (err, results) => {
      if (err) return res.status(500).json({ error: 'Server error' });

      const withdrawals = results.rows.map(w => ({
        id: w.id,
        driver_id: w.driver_id,
        driver_email: w.driver_email,
        driver_name: `${w.first_name || ''} ${w.last_name || ''}`.trim(),
        amount: parseFloat(w.amount),
        status: w.status,
        bank_name: w.bank_name,
        iban: w.iban,
        account_holder_name: w.account_holder_name,
        admin_notes: w.admin_notes,
        processed_by: w.processed_by,
        processed_at: w.processed_at,
        transfer_reference: w.transfer_reference,
        created_at: w.created_at,
        updated_at: w.updated_at,
      }));

      res.json(withdrawals);
    });
  });

  // Admin: mark withdrawal as processing
  app.post('/api/admin/withdrawals/:id/process', (req, res) => {
    const withdrawalId = req.params.id;
    const { admin_email, admin_notes } = req.body;

    db.query('SELECT * FROM withdrawal_requests WHERE id = $1', [withdrawalId], (err, results) => {
      if (err) return res.status(500).json({ error: 'Server error' });
      if (results.rows.length === 0) return res.status(404).json({ error: 'Withdrawal not found' });

      const withdrawal = results.rows[0];

      if (withdrawal.status !== 'PENDING') {
        return res.status(400).json({ error: `Cannot process withdrawal with status ${withdrawal.status}` });
      }

      db.query(
        'UPDATE withdrawal_requests SET status = $1, admin_notes = $2, processed_by = (SELECT id FROM public.users WHERE email = $3), processed_at = NOW(), updated_at = NOW() WHERE id = $4',
        ['PROCESSING', admin_notes || null, admin_email, withdrawalId],
        (err2, result) => {
          if (err2) return res.status(500).json({ error: 'Server error' });
          if (result.rowCount === 0) return res.status(404).json({ error: 'Withdrawal not found' });

          res.json({ message: 'Withdrawal marked as processing', withdrawal_id: withdrawalId });
        }
      );
    });
  });

  // Admin: reject withdrawal
  app.post('/api/admin/withdrawals/:id/reject', (req, res) => {
    const withdrawalId = req.params.id;
    const { admin_email, admin_notes } = req.body;

    db.query('SELECT * FROM withdrawal_requests WHERE id = $1', [withdrawalId], (err, results) => {
      if (err) return res.status(500).json({ error: 'Server error' });
      if (results.rows.length === 0) return res.status(404).json({ error: 'Withdrawal not found' });

      const withdrawal = results.rows[0];

      if (withdrawal.status === 'PAID') {
        return res.status(400).json({ error: 'Cannot reject a paid withdrawal' });
      }

      const now = new Date().toISOString();

      // Update withdrawal status
      db.query(
        'UPDATE withdrawal_requests SET status = $1, admin_notes = $2, processed_by = (SELECT id FROM public.users WHERE email = $3), processed_at = $4, updated_at = $5 WHERE id = $6',
        ['REJECTED', admin_notes || null, admin_email, now, now, withdrawalId],
        (err2, result) => {
          if (err2) return res.status(500).json({ error: 'Server error' });
          if (result.rowCount === 0) return res.status(404).json({ error: 'Withdrawal not found' });

          // Release reserved funds back to available balance
          db.query(
            'UPDATE driver_wallets SET available_balance = available_balance + $1, pending_balance = pending_balance - $1, updated_at = $2 WHERE user_id = $3',
            [withdrawal.amount, now, withdrawal.driver_id],
            (err3) => {
              if (err3) return res.status(500).json({ error: 'Failed to update wallet' });

              res.json({ message: 'Withdrawal rejected, funds released', withdrawal_id: withdrawalId });
            }
          );
        }
      );
    });
  });

  // Admin: mark withdrawal as paid
  app.post('/api/admin/withdrawals/:id/mark-paid', (req, res) => {
    const withdrawalId = req.params.id;
    const { admin_email, transfer_reference } = req.body;

    db.query('SELECT * FROM withdrawal_requests WHERE id = $1', [withdrawalId], (err, results) => {
      if (err) return res.status(500).json({ error: 'Server error' });
      if (results.rows.length === 0) return res.status(404).json({ error: 'Withdrawal not found' });

      const withdrawal = results.rows[0];

      if (withdrawal.status === 'REJECTED') {
        return res.status(400).json({ error: 'Cannot mark a rejected withdrawal as paid' });
      }

      if (withdrawal.status === 'PAID') {
        return res.status(400).json({ error: 'Withdrawal is already paid' });
      }

      const now = new Date().toISOString();

      // Update withdrawal status
      db.query(
        'UPDATE withdrawal_requests SET status = $1, transfer_reference = $2, processed_by = (SELECT id FROM public.users WHERE email = $3), processed_at = $4, updated_at = $5 WHERE id = $6',
        ['PAID', transfer_reference || null, admin_email, now, now, withdrawalId],
        (err2, result) => {
          if (err2) return res.status(500).json({ error: 'Server error' });
          if (result.rowCount === 0) return res.status(404).json({ error: 'Withdrawal not found' });

          // Permanently remove reserved funds from wallet
          db.query(
            'UPDATE driver_wallets SET pending_balance = pending_balance - $1, total_withdrawn = total_withdrawn + $1, updated_at = $2 WHERE user_id = $3',
            [withdrawal.amount, now, withdrawal.driver_id],
            (err3) => {
              if (err3) return res.status(500).json({ error: 'Failed to update wallet' });

              res.json({ message: 'Withdrawal marked as paid', withdrawal_id: withdrawalId });
            }
          );
        }
      );
    });
  });
}

module.exports = { registerWithdrawalRoutes };
