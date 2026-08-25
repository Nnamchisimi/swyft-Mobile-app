const { resolveImageRef, buildArchiveSnapshot } = require('./verification.helpers');

function getWithdrawalHistory(db, userId, callback) {
  db.query(
    `SELECT id, amount, status, bank_name, iban, account_holder_name, admin_notes, transfer_reference, processed_at, created_at
     FROM withdrawal_requests
     WHERE driver_id = $1
     ORDER BY created_at DESC`,
    [userId],
    (err, results) => {
      if (err) return callback(err, []);
      const withdrawals = results.rows.map(w => ({
        id: w.id,
        amount: parseFloat(w.amount),
        status: w.status,
        bank_name: w.bank_name,
        iban: w.iban,
        account_holder_name: w.account_holder_name,
        admin_notes: w.admin_notes,
        transfer_reference: w.transfer_reference,
        processed_at: w.processed_at,
        created_at: w.created_at,
      }));
      callback(null, withdrawals);
    }
  );
}

function getDocumentHistory(db, userId, callback) {
  db.query(
    `SELECT id, document_type, document_number, expiry_date, front_image_url, back_image_url, is_verified, verification_status, rejection_reason, created_at, updated_at
     FROM id_documents
     WHERE user_id = $1
     ORDER BY created_at ASC`,
    [userId],
    (e1, idDocs) => {
      if (e1) return callback(e1, null);
      db.query(
        `SELECT id, selfie_image_url, id_document_image_url, match_confidence, is_verified, verification_status, rejection_reason, created_at, updated_at
         FROM selfie_verifications
         WHERE user_id = $1
         ORDER BY created_at ASC`,
        [userId],
        (e2, selfies) => {
          if (e2) return callback(e2, null);
          db.query(
            `SELECT id, phone_number, is_verified, verified_at, created_at, updated_at
             FROM phone_verifications
             WHERE user_id = $1
             ORDER BY created_at ASC`,
            [userId],
            (e3, phones) => {
              if (e3) return callback(e3, null);
              db.query(
                `SELECT id, bank_name, account_holder_name, account_number, routing_number, iban, swift_code, is_verified, verification_status, rejection_reason, created_at, updated_at
                 FROM bank_accounts
                 WHERE user_id = $1
                 ORDER BY created_at ASC`,
                [userId],
                (e4, banks) => {
                  if (e4) return callback(e4, null);
                  callback(null, {
                    id_documents: (idDocs.rows || []).map(r => ({ ...r, front_image: resolveImageRef(r.front_image_url), back_image: resolveImageRef(r.back_image_url) })),
                    selfie_verifications: (selfies.rows || []).map(r => ({ ...r, selfie_image: resolveImageRef(r.selfie_image_url), id_document_image: resolveImageRef(r.id_document_image_url) })),
                    phone_verifications: (phones.rows || []).map(r => ({ ...r })),
                    bank_accounts: (banks.rows || []).map(r => ({ ...r })),
                  });
                }
              );
            }
          );
        }
      );
    }
  );
}

function getVerificationBundle(db, userId, callback) {
  db.query(
    `SELECT * FROM id_documents WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [userId],
    (e1, idResult) => {
      db.query(
        `SELECT * FROM selfie_verifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [userId],
        (e2, selfieResult) => {
          db.query(
            `SELECT * FROM phone_verifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
            [userId],
            (e3, phoneResult) => {
              db.query(
                `SELECT * FROM bank_accounts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
                [userId],
                (e4, bankResult) => {
                  db.query(
                    `SELECT c.make, c.model, c.year, c.color, c.plate_number, c.image_url FROM cars c WHERE c.user_id = $1`,
                    [userId],
                    (e5, carResult) => {
                      const id = idResult.rows[0] || null;
                      const selfie = selfieResult.rows[0] || null;
                      const phone = phoneResult.rows[0] || null;
                      const bank = bankResult.rows[0] || null;
                      const car = carResult.rows[0] || null;

                      const bundle = {
                        id_document: id ? {
                          id: id.id,
                          document_type: id.document_type,
                          document_number: id.document_number,
                          expiry_date: id.expiry_date,
                          front_image: resolveImageRef(id.front_image_url),
                          back_image: resolveImageRef(id.back_image_url),
                          is_verified: id.is_verified,
                          verification_status: id.verification_status,
                          rejection_reason: id.rejection_reason,
                        } : null,
                        selfie: selfie ? {
                          id: selfie.id,
                          selfie_image: resolveImageRef(selfie.selfie_image_url),
                          id_document_image: resolveImageRef(selfie.id_document_image_url),
                          match_confidence: selfie.match_confidence,
                          is_verified: selfie.is_verified,
                          verification_status: selfie.verification_status,
                          rejection_reason: selfie.rejection_reason,
                          created_at: selfie.created_at,
                        } : null,
                        phone: phone ? {
                          id: phone.id,
                          phone_number: phone.phone_number,
                          is_verified: phone.is_verified,
                          verified_at: phone.verified_at,
                        } : null,
                        bank_account: bank ? {
                          id: bank.id,
                          bank_name: bank.bank_name,
                          account_holder_name: bank.account_holder_name,
                          account_number: bank.account_number,
                          routing_number: bank.routing_number,
                          iban: bank.iban,
                          swift_code: bank.swift_code,
                          is_verified: bank.is_verified,
                          verification_status: bank.verification_status,
                          rejection_reason: bank.rejection_reason,
                        } : null,
                        car: car ? {
                          make: car.make,
                          model: car.model,
                          year: car.year,
                          color: car.color,
                          plate_number: car.plate_number,
                          image_url: car.image_url,
                        } : null,
                      };
                      callback(null, bundle);
                    }
                  );
                }
              );
            }
          );
        }
      );
    }
  );
}

function backfillArchive(db) {
  db.query(
    `SELECT u.id AS user_id, u.email, u.first_name, u.last_name, u.phone
     FROM public.users u
     LEFT JOIN driver_verification_status dvs ON dvs.user_id = u.id
     WHERE u.role = 'driver'
       AND (
         dvs.is_approved = true
         OR (
           COALESCE((SELECT is_verified FROM id_documents WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1), false)
           AND COALESCE((SELECT is_verified FROM selfie_verifications WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1), false)
           AND COALESCE((SELECT is_verified FROM phone_verifications WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1), false)
           AND COALESCE((SELECT is_verified FROM bank_accounts WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1), false)
         )
       )
       AND NOT EXISTS (SELECT 1 FROM driver_verification_archive dva WHERE dva.user_id = u.id)`,
    [],
    (err, results) => {
      if (err) {
        console.error('[ARCHIVE_BACKFILL] Error fetching approved drivers:', err.message);
        return;
      }
      const approvedDrivers = results.rows || [];
      console.log(`[ARCHIVE_BACKFILL] Found ${approvedDrivers.length} approved drivers to archive`);
      let completed = 0;
      approvedDrivers.forEach((driver) => {
        getVerificationBundle(driver.user_id, (bundleErr, bundle) => {
          if (bundleErr) {
            console.error(`[ARCHIVE_BACKFILL] Bundle error for ${driver.email}:`, bundleErr.message);
          } else {
            getDocumentHistory(driver.user_id, (histErr, history) => {
              if (histErr) {
                console.error(`[ARCHIVE_BACKFILL] History error for ${driver.email}:`, histErr.message);
              }
              const snapshot = buildArchiveSnapshot(bundle, history);
              getWithdrawalHistory(driver.user_id, (wErr, withdrawals) => {
                if (wErr) {
                  console.error(`[ARCHIVE_BACKFILL] Withdrawals error for ${driver.email}:`, wErr.message);
                } else {
                  const finalSnapshot = { ...snapshot, withdrawals: withdrawals || [] };
                   db.query(
                     `INSERT INTO driver_verification_archive
                       (user_id, email, first_name, last_name, phone, decision, reviewer_email, notes, id_document, selfie, phone_verification, bank_account, car, withdrawals, id_document_history, selfie_history, phone_history, bank_history)
                      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
                     [
                       driver.user_id,
                       driver.email,
                       driver.first_name,
                       driver.last_name,
                       driver.phone,
                       'approved',
                       null,
                       null,
                       JSON.stringify(finalSnapshot.id_document),
                       JSON.stringify(finalSnapshot.selfie),
                       JSON.stringify(finalSnapshot.phone),
                       JSON.stringify(finalSnapshot.bank_account),
                       JSON.stringify(finalSnapshot.car),
                       JSON.stringify(finalSnapshot.withdrawals),
                       JSON.stringify(finalSnapshot.id_document_history || []),
                       JSON.stringify(finalSnapshot.selfie_history || []),
                       JSON.stringify(finalSnapshot.phone_history || []),
                       JSON.stringify(finalSnapshot.bank_history || []),
                     ],
                    (archiveErr) => {
                      if (archiveErr) {
                        console.error(`[ARCHIVE_BACKFILL] Insert error for ${driver.email}:`, archiveErr.message);
                      } else {
                        console.log(`[ARCHIVE_BACKFILL] Archived ${driver.email}`);
                      }
                    }
                  );
                }
              });
            });
          }
        });
      });
    }
  );
}

module.exports = { getWithdrawalHistory, getDocumentHistory, getVerificationBundle, backfillArchive };
