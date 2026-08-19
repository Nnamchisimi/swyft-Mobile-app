require('dotenv').config();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Resend } = require('resend');

// === Shared JWT secret ===
const JWT_SECRET = process.env.JWT_SECRET;

// Generate a 6-digit verification code
function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Generate unique delivery ID
function generateDeliveryId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 7; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `SWY-${code}`;
}

// Hash OTP for secure storage
async function hashOtp(otp) {
  return await bcrypt.hash(otp, 10);
}

// Verify OTP against hash
async function verifyOtp(otp, hash) {
  return await bcrypt.compare(otp, hash);
}

// Sign a JWT for a user
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

// Verify a JWT, throws on invalid/expired
function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

// Admin guard: every /api/admin/* request must carry a valid JWT with role = 'admin'
function adminGuard(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role && decoded.role.toLowerCase() !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    req.admin = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Resend email client (shared instance)
const resend = new Resend(process.env.RESEND_API_KEY);

// Send OTP to customer via email
async function sendDeliveryOtp(email, otp, deliveryId) {
  try {
    const { data, error } = await resend.emails.send({
      from: 'Swyft <support@otoekspert.com>',
      to: [email],
      subject: `Swyft - Your Delivery OTP for ${deliveryId}`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2563eb;">Swyft Delivery Confirmation</h2>
          <p>Your delivery has been picked up and is on its way!</p>
          <div style="text-align: center; margin: 30px 0; padding: 20px; background-color: #f3f4f6; border-radius: 8px;">
            <p style="font-size: 14px; color: #666; margin-bottom: 8px;">Your Delivery OTP:</p>
            <p style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #2563eb; margin: 0;">${otp}</p>
          </div>
          <p>Please provide this OTP to your driver when they arrive to confirm delivery.</p>
          <p style="color: #dc2626; font-size: 14px;">This OTP will expire in 2 hours.</p>
        </div>
      `,
      text: `Your Swyft Delivery OTP: ${otp}\n\nProvide this to your driver to confirm delivery.\n\nThis OTP expires in 2 hours.`,
    });
    if (error) {
      console.error('Failed to send OTP:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('OTP send error:', err.message);
    return false;
  }
}

// Helper function to send verification email via Resend
async function sendVerificationEmail(toEmail, code) {
  try {
    const { data, error } = await resend.emails.send({
      from: 'Swyft <support@otoekspert.com>',
      to: [toEmail],
      subject: 'Swyft - Your Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2563eb;">Welcome to Swyft!</h2>
          <p>Thank you for creating an account. Use the verification code below to verify your email:</p>
          <div style="text-align: center; margin: 30px 0; padding: 20px; background-color: #f3f4f6; border-radius: 8px;">
            <p style="font-size: 14px; color: #666; margin-bottom: 8px;">Your verification code is:</p>
            <p style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #2563eb; margin: 0;">${code}</p>
          </div>
          <p style="text-align: center; color: #666;">Enter this code in the Swyft app to verify your email.</p>
          <p style="color: #dc2626; font-size: 14px;">This code will expire in 15 minutes.</p>
          <hr style="margin-top: 30px; border: none; border-top: 1px solid #eee;">
          <p style="font-size: 12px; color: #666;">If you didn't create an account with Swyft, please ignore this email.</p>
        </div>
      `,
      text: `Welcome to Swyft!\n\nYour verification code is: ${code}\n\nEnter this code in the Swyft app to verify your email.\n\nThis code will expire in 15 minutes.\n\nIf you didn't create an account, please ignore this email.`,
    });

    if (error) {
      console.error('Email send error:', error);
      return false;
    }

    console.log('Email sent successfully to:', toEmail);
    console.log('Message ID:', data?.id);
    return true;
  } catch (err) {
    console.error('Email send error:', err.message);
    return false;
  }
}

// Send password reset email via Resend
async function sendPasswordResetEmail(toEmail, resetToken) {
  try {
    const resetLink = `swyftmobile://reset-password?token=${resetToken}&email=${encodeURIComponent(toEmail)}`;
    const { data, error } = await resend.emails.send({
      from: 'Swyft <support@otoekspert.com>',
      to: [toEmail],
      subject: 'Swyft - Reset Your Password',
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2563eb;">Reset Your Password</h2>
          <p>We received a request to reset your password for your Swyft account.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="background-color: #2563eb; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">Reset Password</a>
          </div>
          <p style="font-size: 14px; color: #666;">This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.</p>
        </div>
      `,
      text: `Reset your password: ${resetLink}\n\nThis link will expire in 1 hour.`,
    });
    if (error) {
      console.error('Password reset email error:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Password reset email error:', err.message);
    return false;
  }
}

module.exports = {
  JWT_SECRET,
  generateVerificationCode,
  generateDeliveryId,
  hashOtp,
  verifyOtp,
  signToken,
  verifyToken,
  adminGuard,
  resend,
  sendDeliveryOtp,
  sendVerificationEmail,
  sendPasswordResetEmail
};
