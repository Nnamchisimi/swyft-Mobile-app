const jwt = require('jsonwebtoken');
const { verifyToken } = require('../utils/helpers');

function requireAdmin(req, res) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return { ok: false, res: res.status(401).json({ error: 'Unauthorized' }) };
  try {
    verifyToken(token);
    return { ok: true, token };
  } catch (e) {
    return { ok: false, res: res.status(401).json({ error: 'Invalid or expired token' }) };
  }
}

function resolveImageRef(ref) {
  if (!ref) return null;
  if (ref.startsWith('data:image/')) return { type: 'base64', url: ref };
  return { type: 'url', url: ref };
}

function buildArchiveSnapshot(bundle, history) {
  return {
    id_document: bundle.id_document
      ? {
          document_type: bundle.id_document.document_type,
          document_number: bundle.id_document.document_number,
          expiry_date: bundle.id_document.expiry_date,
          verification_status: bundle.id_document.verification_status,
          is_verified: bundle.id_document.is_verified,
          rejection_reason: bundle.id_document.rejection_reason,
          front_image: bundle.id_document.front_image,
          back_image: bundle.id_document.back_image,
        }
      : null,
    selfie: bundle.selfie
      ? {
          verification_status: bundle.selfie.verification_status,
          is_verified: bundle.selfie.is_verified,
          match_confidence: bundle.selfie.match_confidence,
          rejection_reason: bundle.selfie.rejection_reason,
          selfie_image: bundle.selfie.selfie_image,
          id_document_image: bundle.selfie.id_document_image,
        }
      : null,
    phone: bundle.phone
      ? {
          phone_number: bundle.phone.phone_number,
          is_verified: bundle.phone.is_verified,
          verified_at: bundle.phone.verified_at,
        }
      : null,
    bank_account: bundle.bank_account
      ? {
          bank_name: bundle.bank_account.bank_name,
          account_holder_name: bundle.bank_account.account_holder_name,
          account_number: bundle.bank_account.account_number,
          routing_number: bundle.bank_account.routing_number,
          iban: bundle.bank_account.iban,
          swift_code: bundle.bank_account.swift_code,
          verification_status: bundle.bank_account.verification_status,
          is_verified: bundle.bank_account.is_verified,
          rejection_reason: bundle.bank_account.rejection_reason,
        }
      : null,
    car: bundle.car
      ? {
          make: bundle.car.make,
          model: bundle.car.model,
          year: bundle.car.year,
          color: bundle.car.color,
          plate_number: bundle.car.plate_number,
          image_url: bundle.car.image_url,
        }
      : null,
    ...(history || {}),
  };
}

module.exports = { requireAdmin, resolveImageRef, buildArchiveSnapshot };
