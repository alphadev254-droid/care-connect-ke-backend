const nodemailer = require('nodemailer');
const logger = require('../utils/logger');
const { getPrimaryFrontendUrl } = require('../utils/config');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT, 10),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendEmail = async (to, subject, html) => {
  try {
    console.log('🔄 Attempting to send email...');
    console.log('📧 To:', to);
    console.log('📝 Subject:', subject);
    console.log('📤 From:', `${process.env.MAIL_FROM_NAME} <${process.env.MAIL_FROM_ADDRESS}>`);

    const info = await transporter.sendMail({
      from: `${process.env.MAIL_FROM_NAME} <${process.env.MAIL_FROM_ADDRESS}>`,
      to,
      subject,
      html,
    });

    console.log('✅ Email sent successfully!');
    console.log('📨 Message ID:', info.messageId);
    logger.info(`Email sent: ${info.messageId}`);
    return { id: info.messageId };
  } catch (error) {
    console.error('💥 Email sending failed:', error);
    logger.error('Email sending failed:', error);
    throw error;
  }
};

const sendAppointmentConfirmation = async (patientEmail, appointmentDetails) => {
  const subject = 'Appointment Confirmation - TunzaConnect Healthcare';
  const formattedDate = new Date(appointmentDetails.scheduledDate).toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 20px auto; background: white; }
        .header { padding: 30px 20px; text-align: center; border-bottom: 2px solid #e5e5e5; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; color: #1a1a1a; }
        .content { padding: 30px 20px; }
        .details { padding: 20px; border: 1px solid #e5e5e5; border-radius: 4px; margin: 20px 0; }
        .detail-row { padding: 10px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; }
        .detail-row:last-child { border-bottom: none; }
        .detail-row strong { display: inline-block; min-width: 120px; color: #1a1a1a; font-weight: 600; }
        .button { display: inline-block; background: #1a1a1a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 10px 5px; font-size: 14px; font-weight: 500; }
        .video-button { background: #047857; }
        .video-box { padding: 20px; border: 2px solid #047857; border-radius: 8px; margin: 20px 0; background: #f0fdf4; }
        .video-link { word-break: break-all; color: #047857; font-size: 13px; font-family: monospace; }
        .footer { text-align: center; color: #666; padding: 20px; font-size: 12px; border-top: 1px solid #e5e5e5; background: #fafafa; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✓ Appointment Confirmed</h1>
        </div>
        <div class="content">
          <p>Dear Patient,</p>
          <p>Your appointment has been successfully confirmed. Here are the details:</p>

          <div class="details">
            <div class="detail-row">
              <strong>Date & Time:</strong>
              <span>${formattedDate}</span>
            </div>
            <div class="detail-row">
              <strong>Caregiver:</strong>
              <span>${appointmentDetails.caregiverName}</span>
            </div>
            <div class="detail-row">
              <strong>Session Type:</strong>
              <span>${appointmentDetails.sessionType === 'in_person' ? 'In-Person Visit' : 'Teleconference'}</span>
            </div>
            ${appointmentDetails.duration ? `
            <div class="detail-row">
              <strong>Duration:</strong>
              <span>${appointmentDetails.duration} minutes</span>
            </div>
            ` : ''}
          </div>

          ${appointmentDetails.jitsiMeetingUrl ? `
          <div class="video-box">
            <h3 style="margin: 0 0 15px 0; color: #047857; font-size: 18px;">🎥 Video Consultation Link</h3>
            <p style="margin: 0 0 10px 0; font-size: 14px;">Join your video consultation at the scheduled time using the link below:</p>
            <center>
              <a href="${appointmentDetails.jitsiMeetingUrl}" class="button video-button" style="color: white !important;">Join Video Call</a>
            </center>
            <p style="margin: 15px 0 0 0; font-size: 12px; color: #666;">
              <strong>Note:</strong> You can join the meeting 15 minutes before your scheduled appointment time.
            </p>
            <p style="margin: 10px 0 0 0; font-size: 11px; color: #888;">
              Meeting Link: <span class="video-link">${appointmentDetails.jitsiMeetingUrl}</span>
            </p>
          </div>
          ` : ''}

          <p>If you need to reschedule or cancel, please contact us at least 24 hours in advance.</p>

          <center>
            <a href="${getPrimaryFrontendUrl()}/dashboard/appointments" class="button" style="color: white !important;">View Appointment</a>
          </center>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} TunzaConnect Healthcare. All rights reserved.</p>
          <p>This is an automated message, please do not reply directly to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(patientEmail, subject, html);
};

const sendStatusAlert = async (recipientEmail, alertDetails) => {
  const subject = `Patient Status Alert - ${alertDetails.severity.toUpperCase()} - TunzaConnect Healthcare`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 20px auto; background: white; }
        .header { padding: 30px 20px; text-align: center; border-bottom: 2px solid #e5e5e5; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; color: #1a1a1a; }
        .content { padding: 30px 20px; }
        .alert-box { padding: 20px; border: 2px solid #1a1a1a; border-radius: 4px; margin: 20px 0; }
        .detail-row { padding: 10px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; }
        .detail-row:last-child { border-bottom: none; }
        .detail-row strong { display: inline-block; min-width: 120px; color: #1a1a1a; font-weight: 600; }
        .severity-badge { display: inline-block; padding: 4px 12px; border: 1px solid #1a1a1a; border-radius: 4px; background: #f5f5f5; color: #1a1a1a; font-weight: 600; text-transform: uppercase; font-size: 11px; }
        .button { display: inline-block; background: #1a1a1a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0; font-size: 14px; font-weight: 500; }
        .footer { text-align: center; color: #666; padding: 20px; font-size: 12px; border-top: 1px solid #e5e5e5; background: #fafafa; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>⚠️ Patient Status Alert</h1>
        </div>
        <div class="content">
          <p><strong>URGENT:</strong> A patient status alert has been triggered.</p>

          <div class="alert-box">
            <div class="detail-row">
              <strong>Severity:</strong>
              <span class="severity-badge">${alertDetails.severity}</span>
            </div>
            <div class="detail-row">
              <strong>Patient:</strong>
              <span>${alertDetails.patientName}</span>
            </div>
            <div class="detail-row">
              <strong>Status:</strong>
              <span>${alertDetails.message}</span>
            </div>
            ${alertDetails.reportedBy ? `
            <div class="detail-row">
              <strong>Reported By:</strong>
              <span>${alertDetails.reportedBy}</span>
            </div>
            ` : ''}
            <div class="detail-row">
              <strong>Time:</strong>
              <span>${new Date().toLocaleString()}</span>
            </div>
          </div>

          <p><strong>Action Required:</strong> Please review the patient's condition and take appropriate action immediately.</p>

          <center>
            <a href="${getPrimaryFrontendUrl()}/dashboard/reports" class="button" style="color: white !important;">View Care Reports</a>
          </center>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} TunzaConnect Healthcare . All rights reserved.</p>
          <p>This is an automated alert. For urgent matters, please contact the care team directly.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(recipientEmail, subject, html);
};

const sendPasswordChangeNotification = async (email, firstName) => {
  const systemName = process.env.SYSTEM || 'TunzaConnect Healthcare';
  const subject = `Password Changed - ${systemName}`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 20px auto; background: white; }
        .header { padding: 30px 20px; text-align: center; border-bottom: 2px solid #e5e5e5; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; color: #1a1a1a; }
        .content { padding: 30px 20px; }
        .footer { text-align: center; color: #666; padding: 20px; font-size: 12px; border-top: 1px solid #e5e5e5; background: #fafafa; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Password Changed</h1>
        </div>
        <div class="content">
          <p>Hello ${firstName},</p>
          <p>Your password has been successfully changed on ${new Date().toLocaleDateString()}.</p>
          <p>If you did not make this change, please contact our support team immediately.</p>
          <p>Best regards,<br>${systemName} Team</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} ${systemName}. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(email, subject, html);
};

const sendCaregiverRegistrationNotification = async (email, firstName) => {
  const systemName = process.env.SYSTEM || 'TunzaConnect Healthcare';
  const subject = `Registration Received - ${systemName}`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 20px auto; background: white; }
        .header { padding: 30px 20px; text-align: center; border-bottom: 2px solid #e5e5e5; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; color: #1a1a1a; }
        .content { padding: 30px 20px; }
        .footer { text-align: center; color: #666; padding: 20px; font-size: 12px; border-top: 1px solid #e5e5e5; background: #fafafa; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Registration Received</h1>
        </div>
        <div class="content">
          <p>Dear ${firstName},</p>
          <p>Thank you for registering as a caregiver with ${systemName}. Your application has been successfully received and is currently under review.</p>
          <p>Our administrative team will review your credentials and qualifications. You will receive an email notification once your account has been approved.</p>
          <p>This process typically takes 1-2 business days. We appreciate your patience.</p>
          <p>Best regards,<br>${systemName} Team</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} ${systemName}. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(email, subject, html);
};

const sendCaregiverVerificationNotification = async (email, firstName) => {
  const systemName = process.env.SYSTEM || 'TunzaConnect Healthcare';
  const frontendUrl = getPrimaryFrontendUrl();
  const subject = `Account Verified - ${systemName}`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 20px auto; background: white; }
        .header { padding: 30px 20px; text-align: center; border-bottom: 2px solid #e5e5e5; background: #e8f5e8; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; color: #2e7d32; }
        .content { padding: 30px 20px; }
        .action-box { padding: 20px; border: 2px solid #047857; border-radius: 8px; margin: 20px 0; background: #f0fdf4; }
        .action-box h3 { margin: 0 0 10px 0; color: #047857; font-size: 16px; }
        .button { display: inline-block; background: #047857; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 10px 0; font-size: 14px; font-weight: 500; }
        .footer { text-align: center; color: #666; padding: 20px; font-size: 12px; border-top: 1px solid #e5e5e5; background: #fafafa; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✅ Account Verified</h1>
        </div>
        <div class="content">
          <p>Dear ${firstName},</p>
          <p>Congratulations! Your caregiver credentials have been successfully verified by our administrative team.</p>
          <p>Your account is now fully verified and you can start providing healthcare services through ${systemName}.</p>

          <div class="action-box">
            <h3>📅 Important: Set Your Availability</h3>
            <p>To start receiving appointment bookings, please log in to your account and set your availability schedule. Patients can only book appointments during your available time slots.</p>
            <center>
              <a href="${frontendUrl}/dashboard/schedule" class="button" style="color: white !important;">Set Your Availability</a>
            </center>
          </div>

          <p>Welcome to our healthcare community!</p>
          <p>Best regards,<br>${systemName} Team</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} ${systemName}. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(email, subject, html);
};

const sendCaregiverRejectionNotification = async (email, firstName, reason) => {
  const systemName = process.env.SYSTEM || 'TunzaConnect Healthcare';
  const subject = `Account Verification - ${systemName}`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 20px auto; background: white; }
        .header { padding: 30px 20px; text-align: center; border-bottom: 2px solid #e5e5e5; background: #fff3cd; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; color: #856404; }
        .content { padding: 30px 20px; }
        .reason-box { background: #f8f9fa; padding: 20px; border-left: 4px solid #ffc107; margin: 20px 0; border-radius: 4px; }
        .footer { text-align: center; color: #666; padding: 20px; font-size: 12px; border-top: 1px solid #e5e5e5; background: #fafafa; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>⚠️ Verification Update</h1>
        </div>
        <div class="content">
          <p>Dear ${firstName},</p>
          <p>Thank you for your interest in joining ${systemName} as a caregiver. After reviewing your application, we need additional information or corrections before we can proceed with verification.</p>
          
          <div class="reason-box">
            <h3>Reason for Review:</h3>
            <p>${reason}</p>
          </div>
          
          <p>Please address the concerns mentioned above and feel free to contact our support team if you need assistance. You may resubmit your application once the issues are resolved.</p>
          <p>We appreciate your understanding and look forward to working with you.</p>
          <p>Best regards,<br>${systemName} Team</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} ${systemName}. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(email, subject, html);
};

const sendAccountStatusNotification = async (email, firstName, isActive) => {
  const systemName = process.env.SYSTEM || 'TunzaConnect Healthcare';
  const status = isActive ? 'Activated' : 'Deactivated';
  const subject = `Account ${status} - ${systemName}`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 20px auto; background: white; }
        .header { padding: 30px 20px; text-align: center; border-bottom: 2px solid #e5e5e5; background: ${isActive ? '#e8f5e8' : '#fff5f5'}; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; color: ${isActive ? '#2e7d32' : '#d32f2f'}; }
        .content { padding: 30px 20px; }
        .footer { text-align: center; color: #666; padding: 20px; font-size: 12px; border-top: 1px solid #e5e5e5; background: #fafafa; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${isActive ? '✅' : '❌'} Account ${status}</h1>
        </div>
        <div class="content">
          <p>Dear ${firstName},</p>
          <p>Your ${systemName} account has been ${isActive ? 'activated' : 'deactivated'} by our administrative team.</p>
          ${isActive ? 
            '<p>You can now access all platform features and services.</p>' : 
            '<p>Your account access has been temporarily suspended. Please contact support if you believe this is an error.</p>'
          }
          <p>If you have any questions, please contact our support team.</p>
          <p>Best regards,<br>${systemName} Team</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} ${systemName}. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(email, subject, html);
};

const sendPasswordResetEmail = async (email, firstName, resetUrl) => {
  const systemName = process.env.SYSTEM || 'TunzaConnect Healthcare';
  const subject = `Password Reset Request - ${systemName}`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 20px auto; background: white; }
        .header { padding: 30px 20px; text-align: center; border-bottom: 2px solid #e5e5e5; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; color: #1a1a1a; }
        .content { padding: 30px 20px; }
        .reset-box { padding: 20px; border: 1px solid #e5e5e5; border-radius: 4px; margin: 20px 0; text-align: center; }
        .button { display: inline-block; background: #1a1a1a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0; font-weight: 500; font-size: 14px; }
        .footer { text-align: center; color: #666; padding: 20px; font-size: 12px; border-top: 1px solid #e5e5e5; background: #fafafa; }
        .warning { background: #fafafa; border: 1px solid #e5e5e5; padding: 15px; border-radius: 4px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔐 Password Reset</h1>
        </div>
        <div class="content">
          <p>Hello ${firstName},</p>
          <p>We received a request to reset your password for your ${systemName} account.</p>

          <div class="reset-box">
            <p>Click the button below to reset your password:</p>
            <a href="${resetUrl}" class="button" style="color: white !important;">Reset Password</a>
            <p style="font-size: 12px; color: #666; margin-top: 20px;">
              This link will expire in 1 hour for security reasons.
            </p>
          </div>

          <div class="warning">
            <strong>⚠️ Security Notice:</strong>
            <p style="margin: 8px 0 0 0;">If you didn't request this password reset, please ignore this email. Your password will remain unchanged.</p>
          </div>

          <p>If the button doesn't work, copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #666; font-size: 12px;">${resetUrl}</p>

          <p>Best regards,<br>${systemName} Team</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} ${systemName}. All rights reserved.</p>
          <p>This is an automated message, please do not reply directly to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(email, subject, html);
};

const sendPaymentConfirmation = async (patientEmail, paymentDetails) => {
  const systemName = process.env.SYSTEM || 'TunzaConnect Healthcare';
  const subject = `Payment Confirmation - ${systemName}`;
  const formattedDate = new Date(paymentDetails.appointmentDate).toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 20px auto; background: white; }
        .header { padding: 30px 20px; text-align: center; border-bottom: 2px solid #e5e5e5; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; color: #1a1a1a; }
        .content { padding: 30px 20px; }
        .payment-box { padding: 20px; border: 2px solid #1a1a1a; border-radius: 4px; margin: 20px 0; }
        .detail-row { padding: 10px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; }
        .detail-row:last-child { border-bottom: none; }
        .detail-row strong { display: inline-block; min-width: 120px; color: #1a1a1a; font-weight: 600; }
        .amount { font-size: 20px; font-weight: 600; color: #1a1a1a; }
        .button { display: inline-block; background: #1a1a1a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 10px 5px; font-size: 14px; font-weight: 500; }
        .video-button { background: #047857; }
        .video-box { padding: 20px; border: 2px solid #047857; border-radius: 8px; margin: 20px 0; background: #f0fdf4; }
        .video-link { word-break: break-all; color: #047857; font-size: 13px; font-family: monospace; }
        .footer { text-align: center; color: #666; padding: 20px; font-size: 12px; border-top: 1px solid #e5e5e5; background: #fafafa; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✓ Payment Confirmed</h1>
        </div>
        <div class="content">
          <p>Dear ${paymentDetails.patientName},</p>
          <p>Your payment has been successfully processed and <strong>your booking is now confirmed!</strong></p>

          <div class="payment-box">
            <div class="detail-row">
              <strong>Amount Paid:</strong>
              <span class="amount">Ksh ${paymentDetails.amount}</span>
            </div>
            <div class="detail-row">
              <strong>Transaction ID:</strong>
              <span>${paymentDetails.transactionId}</span>
            </div>
            <div class="detail-row">
              <strong>Payment Date:</strong>
              <span>${new Date().toLocaleDateString()}</span>
            </div>
            <div class="detail-row">
              <strong>Appointment:</strong>
              <span>${formattedDate}</span>
            </div>
            <div class="detail-row">
              <strong>Caregiver:</strong>
              <span>${paymentDetails.caregiverName}</span>
            </div>
            <div class="detail-row">
              <strong>Session Type:</strong>
              <span>${paymentDetails.jitsiMeetingUrl ? 'Teleconference (Video Call)' : 'In-Person Visit'}</span>
            </div>
          </div>

          ${paymentDetails.jitsiMeetingUrl ? `
          <div class="video-box">
            <h3 style="margin: 0 0 15px 0; color: #047857; font-size: 18px;">🎥 Video Consultation Link</h3>
            <p style="margin: 0 0 10px 0; font-size: 14px;">Your secure video consultation link is ready! Join at your appointment time:</p>
            <center>
              <a href="${paymentDetails.jitsiMeetingUrl}" class="button video-button" style="color: white !important;">Join Video Call</a>
            </center>
            <p style="margin: 15px 0 0 0; font-size: 12px; color: #666;">
              <strong>Note:</strong> You can join the meeting 15 minutes before your scheduled appointment time.
            </p>
            <p style="margin: 10px 0 0 0; font-size: 11px; color: #888;">
              Meeting Link: <span class="video-link">${paymentDetails.jitsiMeetingUrl}</span>
            </p>
          </div>
          ` : ''}

          <p>Your appointment is confirmed and the caregiver has been notified. You will receive a reminder 24 hours before your scheduled appointment.</p>

          <center>
            <a href="${getPrimaryFrontendUrl()}/dashboard/appointments" class="button" style="color: white !important;">View Appointment</a>
          </center>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} TunzaConnect Healthcare. All rights reserved.</p>
          <p>Keep this email as your payment receipt.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(patientEmail, subject, html);
};

const sendPaymentFailureNotification = async (patientEmail, paymentDetails) => {
  const systemName = process.env.SYSTEM || 'TunzaConnect Healthcare';
  const subject = `Payment Failed - ${systemName}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 20px auto; background: white; }
        .header { padding: 30px 20px; text-align: center; border-bottom: 2px solid #e5e5e5; background: #fff5f5; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; color: #d32f2f; }
        .content { padding: 30px 20px; }
        .failure-box { padding: 20px; border: 2px solid #d32f2f; border-radius: 4px; margin: 20px 0; background: #fff5f5; }
        .detail-row { padding: 10px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; }
        .detail-row:last-child { border-bottom: none; }
        .detail-row strong { display: inline-block; min-width: 120px; color: #1a1a1a; font-weight: 600; }
        .amount { font-size: 18px; font-weight: 600; color: #d32f2f; }
        .button { display: inline-block; background: #1a1a1a; color: white !important; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0; font-size: 14px; font-weight: 500; }
        .info-box { padding: 15px; border: 1px solid #e5e5e5; border-radius: 4px; margin: 20px 0; background: #fafafa; }
        .footer { text-align: center; color: #666; padding: 20px; font-size: 12px; border-top: 1px solid #e5e5e5; background: #fafafa; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✗ Payment Failed</h1>
        </div>
        <div class="content">
          <p>Dear ${paymentDetails.patientName},</p>
          <p>We're sorry, but your payment could not be processed. Your booking has been released and the time slot is now available for others.</p>

          <div class="failure-box">
            <div class="detail-row">
              <strong>Amount:</strong>
              <span class="amount">Ksh ${paymentDetails.amount}</span>
            </div>
            <div class="detail-row">
              <strong>Transaction ID:</strong>
              <span>${paymentDetails.tx_ref}</span>
            </div>
            <div class="detail-row">
              <strong>Booking ID:</strong>
              <span>${paymentDetails.bookingId}</span>
            </div>
            <div class="detail-row">
              <strong>Failed At:</strong>
              <span>${new Date().toLocaleString()}</span>
            </div>
          </div>

          <div class="info-box">
            <strong>What happened?</strong>
            <p style="margin: 8px 0 0 0;">Your payment could not be completed. This might be due to insufficient funds, declined card, or a technical issue with the payment provider.</p>
          </div>

          <div class="info-box">
            <strong>What should I do?</strong>
            <p style="margin: 8px 0 0 0;">
              1. Check your payment method and ensure sufficient funds are available<br>
              2. Try booking again with a different payment method<br>
              3. Contact your bank if the issue persists<br>
              4. Reach out to our support team if you need assistance
            </p>
          </div>

          <p>The time slot you selected has been released and is available for rebooking. We recommend booking soon to secure your preferred time.</p>

          <center>
            <a href="${getPrimaryFrontendUrl()}/dashboard/caregiver-availability" class="button" style="color: white !important;">Book Again</a>
          </center>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} TunzaConnect Healthcare. All rights reserved.</p>
          <p>Need help? Contact our support team at support@homecaresystem.com</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(patientEmail, subject, html);
};

const sendBookingExpiredNotification = async (patientEmail, bookingDetails) => {
  const systemName = process.env.SYSTEM || 'TunzaConnect Healthcare';
  const subject = `Booking Expired - ${systemName}`;
  const formattedExpiry = new Date(bookingDetails.expiresAt).toLocaleString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 20px auto; background: white; }
        .header { padding: 30px 20px; text-align: center; border-bottom: 2px solid #e5e5e5; background: #fffbf0; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; color: #f57c00; }
        .content { padding: 30px 20px; }
        .expired-box { padding: 20px; border: 2px solid #f57c00; border-radius: 4px; margin: 20px 0; background: #fffbf0; }
        .detail-row { padding: 10px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; }
        .detail-row:last-child { border-bottom: none; }
        .detail-row strong { display: inline-block; min-width: 120px; color: #1a1a1a; font-weight: 600; }
        .button { display: inline-block; background: #1a1a1a; color: white !important; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0; font-size: 14px; font-weight: 500; }
        .info-box { padding: 15px; border: 1px solid #e5e5e5; border-radius: 4px; margin: 20px 0; background: #fafafa; }
        .footer { text-align: center; color: #666; padding: 20px; font-size: 12px; border-top: 1px solid #e5e5e5; background: #fafafa; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>⏱ Booking Expired</h1>
        </div>
        <div class="content">
          <p>Dear ${bookingDetails.patientName},</p>
          <p>Your booking reservation has expired because payment was not completed within the time limit. The time slot has been released and is now available for others to book.</p>

          <div class="expired-box">
            <div class="detail-row">
              <strong>Booking ID:</strong>
              <span>${bookingDetails.bookingId}</span>
            </div>
            <div class="detail-row">
              <strong>Expired At:</strong>
              <span>${formattedExpiry}</span>
            </div>
            <div class="detail-row">
              <strong>Reason:</strong>
              <span>Payment not completed within 10 minutes</span>
            </div>
          </div>

          <div class="info-box">
            <strong>What happened?</strong>
            <p style="margin: 8px 0 0 0;">To ensure fair access to appointments, we hold time slots for 10 minutes. Since payment wasn't completed within this timeframe, the slot has been automatically released.</p>
          </div>

          <div class="info-box">
            <strong>Want to book again?</strong>
            <p style="margin: 8px 0 0 0;">
              The time slot may still be available! Click the button below to view available appointments and complete your booking quickly.
            </p>
          </div>

          <p><strong>Tip:</strong> Complete your payment within 10 minutes to secure your booking. Have your payment method ready before starting the booking process.</p>

          <center>
            <a href="${getPrimaryFrontendUrl()}/dashboard/caregiver-availability" class="button" style="color: white !important;">View Available Slots</a>
          </center>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} TunzaConnect Healthcare. All rights reserved.</p>
          <p>Questions? Contact support@homecaresystem.com</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(patientEmail, subject, html);
};

const sendRescheduleNotification = async (recipientEmail, recipientName, rescheduleBy, rescheduleByName, newDateTime, jitsiMeetingUrl = null) => {
  const systemName = process.env.SYSTEM || 'TunzaConnect Healthcare';
  const subject = `Appointment Rescheduled - ${systemName}`;
  const isPatient = rescheduleBy === 'patient';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 20px auto; background: white; }
        .header { padding: 30px 20px; text-align: center; border-bottom: 2px solid #e5e5e5; background: #f0f8ff; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; color: #1976d2; }
        .content { padding: 30px 20px; }
        .reschedule-box { padding: 20px; border: 2px solid #1976d2; border-radius: 4px; margin: 20px 0; background: #f0f8ff; }
        .detail-row { padding: 10px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; }
        .detail-row:last-child { border-bottom: none; }
        .detail-row strong { display: inline-block; min-width: 120px; color: #1a1a1a; font-weight: 600; }
        .new-time { font-size: 18px; font-weight: 600; color: #1976d2; }
        .button { display: inline-block; background: #1976d2; color: white !important; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 10px 5px; font-size: 14px; font-weight: 500; }
        .video-button { background: #047857; }
        .video-box { padding: 20px; border: 2px solid #047857; border-radius: 8px; margin: 20px 0; background: #f0fdf4; }
        .video-link { word-break: break-all; color: #047857; font-size: 13px; font-family: monospace; }
        .footer { text-align: center; color: #666; padding: 20px; font-size: 12px; border-top: 1px solid #e5e5e5; background: #fafafa; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📅 Appointment Rescheduled</h1>
        </div>
        <div class="content">
          <p>Dear ${recipientName},</p>
          <p>Your appointment has been rescheduled by ${isPatient ? 'your patient' : 'your caregiver'} (${rescheduleByName}).</p>

          <div class="reschedule-box">
            <div class="detail-row">
              <strong>New Date & Time:</strong>
              <span class="new-time">${newDateTime}</span>
            </div>
            <div class="detail-row">
              <strong>Rescheduled By:</strong>
              <span>${rescheduleByName} (${rescheduleBy})</span>
            </div>
            <div class="detail-row">
              <strong>Rescheduled At:</strong>
              <span>${new Date().toLocaleString()}</span>
            </div>
          </div>

          ${jitsiMeetingUrl ? `
          <div class="video-box">
            <h3 style="margin: 0 0 15px 0; color: #047857; font-size: 18px;">🎥 Video Consultation Link</h3>
            <p style="margin: 0 0 10px 0; font-size: 14px;">Your video consultation link remains the same. Join at the NEW appointment time:</p>
            <center>
              <a href="${jitsiMeetingUrl}" class="button video-button" style="color: white !important;">Join Video Call</a>
            </center>
            <p style="margin: 15px 0 0 0; font-size: 12px; color: #666;">
              <strong>Note:</strong> The link works only at the new scheduled time. You can join 15 minutes before the appointment.
            </p>
            <p style="margin: 10px 0 0 0; font-size: 11px; color: #888;">
              Meeting Link: <span class="video-link">${jitsiMeetingUrl}</span>
            </p>
          </div>
          ` : ''}

          <p>Please update your calendar with the new appointment time. If you have any concerns about this change, please contact ${isPatient ? 'your patient' : 'your caregiver'} directly.</p>

          <center>
            <a href="${getPrimaryFrontendUrl()}/dashboard/${isPatient ? 'appointments' : 'schedule'}" class="button" style="color: white !important;">View ${isPatient ? 'Appointments' : 'Schedule'}</a>
          </center>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} ${systemName}. All rights reserved.</p>
          <p>This is an automated notification. Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(recipientEmail, subject, html);
};

const sendCancellationNotification = async (recipientEmail, recipientName, appointmentDateTime, reason) => {
  const systemName = process.env.SYSTEM || 'TunzaConnect Healthcare';
  const subject = `Appointment Cancelled - ${systemName}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 20px auto; background: white; }
        .header { padding: 30px 20px; text-align: center; border-bottom: 2px solid #e5e5e5; background: #fff5f5; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; color: #d32f2f; }
        .content { padding: 30px 20px; }
        .cancellation-box { padding: 20px; border: 2px solid #d32f2f; border-radius: 4px; margin: 20px 0; background: #fff5f5; }
        .detail-row { padding: 10px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; }
        .detail-row:last-child { border-bottom: none; }
        .detail-row strong { display: inline-block; min-width: 120px; color: #1a1a1a; font-weight: 600; }
        .button { display: inline-block; background: #1a1a1a; color: white !important; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0; font-size: 14px; font-weight: 500; }
        .footer { text-align: center; color: #666; padding: 20px; font-size: 12px; border-top: 1px solid #e5e5e5; background: #fafafa; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>❌ Appointment Cancelled</h1>
        </div>
        <div class="content">
          <p>Dear ${recipientName},</p>
          <p>We're writing to inform you that an appointment has been cancelled by the patient.</p>

          <div class="cancellation-box">
            <div class="detail-row">
              <strong>Appointment:</strong>
              <span>${appointmentDateTime}</span>
            </div>
            <div class="detail-row">
              <strong>Cancelled At:</strong>
              <span>${new Date().toLocaleString()}</span>
            </div>
            ${reason ? `
            <div class="detail-row">
              <strong>Reason:</strong>
              <span>${reason}</span>
            </div>
            ` : ''}
          </div>

          <p>The time slot has been released and is now available for other bookings. No refund will be processed as per our cancellation policy.</p>

          <center>
            <a href="${getPrimaryFrontendUrl()}/dashboard/appointments" class="button" style="color: white !important;">View Appointments</a>
          </center>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} ${systemName}. All rights reserved.</p>
          <p>This is an automated notification. Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(recipientEmail, subject, html);
};

const sendUserWelcomeEmail = async (userDetails) => {
  const systemName = process.env.SYSTEM || 'TunzaConnect Healthcare';
  const subject = `Welcome to ${systemName} - Account Created`;
  const { email, firstName, lastName, password, role, assignedRegion } = userDetails;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 20px auto; background: white; }
        .header { padding: 30px 20px; text-align: center; border-bottom: 2px solid #e5e5e5; background: #f0f8ff; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; color: #1976d2; }
        .content { padding: 30px 20px; }
        .credentials-box { padding: 20px; border: 2px solid #1976d2; border-radius: 4px; margin: 20px 0; background: #f0f8ff; }
        .detail-row { padding: 10px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; }
        .detail-row:last-child { border-bottom: none; }
        .detail-row strong { display: inline-block; min-width: 120px; color: #1a1a1a; font-weight: 600; }
        .password { font-family: monospace; background: #f5f5f5; padding: 4px 8px; border-radius: 4px; font-weight: bold; }
        .button { display: inline-block; background: #1976d2; color: white !important; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0; font-size: 14px; font-weight: 500; }
        .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 4px; margin: 20px 0; }
        .footer { text-align: center; color: #666; padding: 20px; font-size: 12px; border-top: 1px solid #e5e5e5; background: #fafafa; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 Welcome to ${systemName}</h1>
        </div>
        <div class="content">
          <p>Dear ${firstName} ${lastName},</p>
          <p>Your account has been successfully created by the system administrator. Below are your login credentials and account details:</p>

          <div class="credentials-box">
            <div class="detail-row">
              <strong>Email:</strong>
              <span>${email}</span>
            </div>
            <div class="detail-row">
              <strong>Password:</strong>
              <span class="password">${password}</span>
            </div>
            <div class="detail-row">
              <strong>Role:</strong>
              <span>${role.replace('_', ' ').toUpperCase()}</span>
            </div>
            ${assignedRegion && assignedRegion !== 'All regions' ? `
            <div class="detail-row">
              <strong>Assigned Region:</strong>
              <span>${assignedRegion}</span>
            </div>
            ` : ''}
            <div class="detail-row">
              <strong>Account Created:</strong>
              <span>${new Date().toLocaleDateString()}</span>
            </div>
          </div>

          <div class="warning">
            <strong>🔒 Security Notice:</strong>
            <p style="margin: 8px 0 0 0;">For security reasons, please change your password immediately after your first login. Keep your credentials secure and do not share them with anyone.</p>
          </div>

          <p><strong>Getting Started:</strong></p>
          <ul>
            <li>Log in using the credentials above</li>
            <li>Change your password in your profile settings</li>
            <li>Complete your profile information</li>
            <li>Familiarize yourself with the system features</li>
          </ul>

          <center>
            <a href="${getPrimaryFrontendUrl()}/login" class="button" style="color: white !important;">Login to ${systemName}</a>
          </center>

          <p>If you have any questions or need assistance, please contact the system administrator.</p>

          <p>Welcome to the team!</p>
          <p>Best regards,<br>${systemName} Administration Team</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} ${systemName}. All rights reserved.</p>
          <p>This email contains sensitive information. Please keep it secure.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(email, subject, html);
};

const sendCaregiverAppointmentNotification = async (caregiverEmail, appointmentDetails) => {
  const subject = 'New Appointment Booked - TunzaConnect Healthcare';
  const formattedDate = new Date(appointmentDetails.scheduledDate).toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 20px auto; background: white; }
        .header { padding: 30px 20px; text-align: center; border-bottom: 2px solid #e5e5e5; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; color: #1a1a1a; }
        .content { padding: 30px 20px; }
        .details { padding: 20px; border: 1px solid #e5e5e5; border-radius: 4px; margin: 20px 0; }
        .detail-row { padding: 10px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; }
        .detail-row:last-child { border-bottom: none; }
        .detail-row strong { display: inline-block; min-width: 120px; color: #1a1a1a; font-weight: 600; }
        .button { display: inline-block; background: #1a1a1a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 10px 5px; font-size: 14px; font-weight: 500; }
        .video-button { background: #047857; }
        .video-box { padding: 20px; border: 2px solid #047857; border-radius: 8px; margin: 20px 0; background: #f0fdf4; }
        .video-link { word-break: break-all; color: #047857; font-size: 13px; font-family: monospace; }
        .footer { text-align: center; color: #666; padding: 20px; font-size: 12px; border-top: 1px solid #e5e5e5; background: #fafafa; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🆕 New Appointment Scheduled</h1>
        </div>
        <div class="content">
          <p>Dear ${appointmentDetails.caregiverName},</p>
          <p>A new appointment has been booked with you. Here are the details:</p>

          <div class="details">
            <div class="detail-row">
              <strong>Patient:</strong>
              <span>${appointmentDetails.patientName}</span>
            </div>
            <div class="detail-row">
              <strong>Date & Time:</strong>
              <span>${formattedDate}</span>
            </div>
            <div class="detail-row">
              <strong>Session Type:</strong>
              <span>${appointmentDetails.sessionType === 'in_person' ? 'In-Person Visit' : 'Teleconference'}</span>
            </div>
            ${appointmentDetails.duration ? `
            <div class="detail-row">
              <strong>Duration:</strong>
              <span>${appointmentDetails.duration} minutes</span>
            </div>
            ` : ''}
            ${appointmentDetails.notes ? `
            <div class="detail-row">
              <strong>Notes:</strong>
              <span>${appointmentDetails.notes}</span>
            </div>
            ` : ''}
          </div>

          ${appointmentDetails.jitsiMeetingUrl ? `
          <div class="video-box">
            <h3 style="margin: 0 0 15px 0; color: #047857; font-size: 18px;">🎥 Video Consultation Link</h3>
            <p style="margin: 0 0 10px 0; font-size: 14px;">Join the video consultation at the scheduled time using your secure link:</p>
            <center>
              <a href="${appointmentDetails.jitsiMeetingUrl}" class="button video-button" style="color: white !important;">Join Video Call</a>
            </center>
            <p style="margin: 15px 0 0 0; font-size: 12px; color: #666;">
              <strong>Note:</strong> You can join the meeting 15 minutes before the scheduled appointment time.
            </p>
            <p style="margin: 10px 0 0 0; font-size: 11px; color: #888;">
              Meeting Link: <span class="video-link">${appointmentDetails.jitsiMeetingUrl}</span>
            </p>
          </div>
          ` : ''}

          <p>Please ensure you are available at the scheduled time. The patient is expecting your professional care.</p>

          <center>
            <a href="${getPrimaryFrontendUrl() || 'http://localhost:8080'}/dashboard/appointments" class="button" style="color: white !important;">View Appointment</a>
          </center>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} TunzaConnect Healthcare. All rights reserved.</p>
          <p>This is an automated message, please do not reply directly to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(caregiverEmail, subject, html);
};

const sendDataProtectionNotification = async (userData) => {
  const { firstName, lastName, email, role } = userData;
  const systemName = process.env.SYSTEM || 'TunzaConnect Healthcare';
  const subject = `Data Protection Policy Acknowledgment - ${systemName}`;
  
  // Determine role-specific content
  const isCaregiver = role === 'caregiver';
  const roleDisplayName = isCaregiver ? 'Healthcare Caregiver' : 'Patient';
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
  const termsUrl = `${backendUrl}/api/terms/${isCaregiver ? 'caregiver' : 'patient'}/pdf`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 20px auto; background: white; }
        .header { padding: 30px 20px; text-align: center; border-bottom: 2px solid #e5e5e5; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
        .content { padding: 30px 20px; }
        .highlight { background: #e3f2fd; padding: 15px; border-left: 4px solid #2196f3; margin: 20px 0; border-radius: 4px; }
        .rights-box { background: #f0f8ff; padding: 20px; border: 1px solid #2196f3; border-radius: 4px; margin: 20px 0; }
        .usage-box { background: #f9f9f9; padding: 20px; border: 1px solid #e5e5e5; border-radius: 4px; margin: 20px 0; }
        .contact-box { background: #fff3cd; padding: 20px; border: 1px solid #ffeaa7; border-radius: 4px; margin: 20px 0; }
        .footer { text-align: center; color: #666; padding: 20px; font-size: 12px; border-top: 1px solid #e5e5e5; background: #fafafa; }
        .button { display: inline-block; background: #2196f3; color: white !important; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 10px 5px; font-size: 14px; font-weight: 500; }
        ul { padding-left: 20px; }
        li { margin-bottom: 8px; }
        .detail-row { padding: 8px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; }
        .detail-row:last-child { border-bottom: none; }
        .detail-row strong { display: inline-block; min-width: 100px; color: #1a1a1a; font-weight: 600; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🛡️ Data Protection Policy Acknowledgment</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">${systemName} Healthcare Platform</p>
        </div>
        
        <div class="content">
          <h2>Dear ${firstName} ${lastName},</h2>
          
          <p>Thank you for registering with ${systemName} as a <strong>${roleDisplayName}</strong>. This email confirms that by creating your account, you have acknowledged and accepted our data protection policies in compliance with the <strong>Kenya Data Privacy Protection Act</strong>.</p>
          
          <div class="highlight">
            <h3>Registration Confirmation:</h3>
            <p>By completing your registration${isCaregiver ? ' and submitting your professional credentials' : ''}, you have consented to the collection, processing, and storage of your personal data as outlined in our Terms of Service and Privacy Policy.</p>
            ${isCaregiver ? '<p><strong>Note:</strong> Your caregiver account is currently under review by our administrative team. You will receive a separate notification once your credentials are verified and your account is approved.</p>' : ''}
          </div>
          
          <div class="rights-box">
            <h3> Your Data Protection Rights Under Kenya Law:</h3>
            <ul>
              <li><strong>Right to Access:</strong> You can request access to your personal data held by our platform</li>
              <li><strong>Right to Correction:</strong> You can request correction of any inaccurate personal data</li>
              <li><strong>Right to Deletion:</strong> You can request deletion of your personal data (subject to legal and medical record retention requirements)</li>
              <li><strong>Right to Withdraw Consent:</strong> You can withdraw consent for non-essential data processing</li>
              <li><strong>Right to Complain:</strong> You can lodge complaints with the Kenya Data Protection Authority</li>
            </ul>
          </div>
          
          <div class="usage-box">
            <h3>How We Use Your Data:</h3>
            <ul>
              <li>Healthcare service delivery and coordination</li>
              <li>Account management and communication</li>
              <li>Compliance with healthcare regulations</li>
              <li>Platform security and fraud prevention</li>
              ${isCaregiver ? '<li>Professional credential verification and background checks</li>' : '<li>Medical appointment scheduling and care coordination</li>'}
              ${isCaregiver ? '<li>Regulatory reporting to healthcare authorities</li>' : '<li>Emergency contact notifications when necessary</li>'}
              ${isCaregiver ? '<li>Performance monitoring and quality assurance</li>' : '<li>Health record management (with your consent)</li>'}
            </ul>
          </div>
          
          <div class="highlight">
            <h3>📧Communication Preferences:</h3>
            <p>You will receive automated email notifications regarding:</p>
            <ul>
              <li>Account status updates and security notifications</li>
              ${isCaregiver ? '<li>New appointment bookings and schedule changes</li>' : '<li>Appointment confirmations and reminders</li>'}
              ${isCaregiver ? '<li>Payment notifications and earnings reports</li>' : '<li>Payment confirmations and receipts</li>'}
              <li>Important updates about our data protection policies</li>
              <li>Platform maintenance and service announcements</li>
            </ul>
            <p><em>These communications are essential for platform operation and compliance.</em></p>
          </div>
          
          <div class="highlight">
            <h3> Terms & Conditions:</h3>
            <p>You can review the complete ${isCaregiver ? 'caregiver-specific' : 'patient'} terms and conditions that you agreed to during registration:</p>
            <center>
              <a href="${termsUrl}" class="button" style="color: white !important;">View ${isCaregiver ? 'Caregiver' : 'Patient'} Terms & Conditions (PDF)</a>
            </center>
            <p style="font-size: 12px; color: #666; margin-top: 10px;">This document contains the specific terms, conditions, and responsibilities for ${roleDisplayName.toLowerCase()}s using our platform.</p>
          </div>
          
          <div class="usage-box">
            <h3>📋 Account Details:</h3>
            <div class="detail-row">
              <strong>Email:</strong>
              <span>${email}</span>
            </div>
            <div class="detail-row">
              <strong>Role:</strong>
              <span>${roleDisplayName}</span>
            </div>
            <div class="detail-row">
              <strong>Registration Date:</strong>
              <span>${new Date().toLocaleDateString('en-GB')}</span>
            </div>
            ${isCaregiver ? `
            <div class="detail-row">
              <strong>Account Status:</strong>
              <span>Pending Approval</span>
            </div>
            ` : ''}
          </div>
        </div>
        
        <div class="footer">
          <p>This is an automated message sent in compliance with the Kenya Data Privacy Protection Act.</p>
          <p><strong>${systemName} Healthcare Platform</strong><br>
          Committed to protecting your privacy and data rights.</p>
          <p>© ${new Date().getFullYear()} ${systemName}. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(email, subject, html);
};

// Send custom message from system manager to caregiver
const sendCustomMessageToCaregiver = async (caregiverEmail, caregiverFirstName, senderName, subject, messageContent) => {
  const systemName = process.env.SYSTEM || 'TunzaConnect Healthcare';
  const emailSubject = `${subject} - ${systemName}`;
  const frontendUrl = getPrimaryFrontendUrl();

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 20px auto; background: white; }
        .header { padding: 30px 20px; text-align: center; border-bottom: 2px solid #e5e5e5; background: #f0f8ff; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; color: #1976d2; }
        .content { padding: 30px 20px; }
        .message-box { padding: 20px; border: 1px solid #e5e5e5; border-radius: 4px; margin: 20px 0; background: #fafafa; white-space: pre-wrap; }
        .from-box { padding: 15px; border-left: 4px solid #1976d2; margin: 20px 0; background: #f0f8ff; }
        .button { display: inline-block; background: #1976d2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0; font-size: 14px; font-weight: 500; }
        .footer { text-align: center; color: #666; padding: 20px; font-size: 12px; border-top: 1px solid #e5e5e5; background: #fafafa; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📧 Message from ${systemName}</h1>
        </div>
        <div class="content">
          <p>Dear ${caregiverFirstName},</p>

          <div class="from-box">
            <strong>From:</strong> ${senderName} (System Manager)
          </div>

          <div class="message-box">
${messageContent}
          </div>

          <p>If you have any questions or need further clarification, please log in to your account or contact support.</p>

          <center>
            <a href="${frontendUrl}/dashboard" class="button" style="color: white !important;">Go to Dashboard</a>
          </center>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} ${systemName}. All rights reserved.</p>
          <p>This message was sent by the ${systemName} administrative team.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(caregiverEmail, emailSubject, html);
};

const sendWithdrawalTokenEmail = async (caregiverEmail, caregiverName, token) => {
  const systemName = process.env.SYSTEM || 'TunzaConnect Healthcare';
  const subject = `Withdrawal Verification Token - ${systemName}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 20px auto; background: white; }
        .header { padding: 30px 20px; text-align: center; border-bottom: 2px solid #e5e5e5; background: #f0f8ff; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; color: #1976d2; }
        .content { padding: 30px 20px; }
        .token-box { padding: 30px; border: 2px solid #1976d2; border-radius: 8px; margin: 20px 0; background: #f0f8ff; text-align: center; }
        .token { font-size: 36px; font-weight: bold; color: #1976d2; letter-spacing: 8px; font-family: monospace; margin: 20px 0; }
        .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 4px; margin: 20px 0; }
        .footer { text-align: center; color: #666; padding: 20px; font-size: 12px; border-top: 1px solid #e5e5e5; background: #fafafa; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Withdrawal Verification</h1>
        </div>
        <div class="content">
          <p>Dear ${caregiverName},</p>
          <p>You have requested to withdraw funds from your ${systemName} account. Please use the verification token below to complete your withdrawal:</p>

          <div class="token-box">
            <h3 style="margin: 0 0 20px 0; color: #1976d2;">Your Verification Token</h3>
            <div class="token">${token}</div>
            <p style="margin: 20px 0 0 0; font-size: 14px; color: #666;">Enter this 6-digit code in the withdrawal form</p>
          </div>

          <div class="warning">
            <strong>Security Notice:</strong>
            <ul style="margin: 8px 0 0 0; padding-left: 20px;">
              <li>This token expires in <strong>3 minutes</strong></li>
              <li>Do not share this token with anyone</li>
              <li>If you didn't request this withdrawal, ignore this email</li>
              <li>Contact support immediately if you suspect unauthorized access</li>
            </ul>
          </div>

          <p>Complete your withdrawal by entering this token in the withdrawal form within the next 3 minutes.</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} ${systemName}. All rights reserved.</p>
          <p>This is a security-sensitive email. Keep it confidential.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(caregiverEmail, subject, html);
};

const sendWithdrawalSuccessEmail = async (caregiverEmail, withdrawalDetails) => {
  const systemName = process.env.SYSTEM || 'TunzaConnect Healthcare';
  const subject = `Withdrawal Successful - ${systemName}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 20px auto; background: white; }
        .header { padding: 30px 20px; text-align: center; border-bottom: 2px solid #e5e5e5; background: #e8f5e8; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; color: #2e7d32; }
        .content { padding: 30px 20px; }
        .success-box { padding: 20px; border: 2px solid #2e7d32; border-radius: 8px; margin: 20px 0; background: #e8f5e8; }
        .detail-row { padding: 10px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; }
        .detail-row:last-child { border-bottom: none; }
        .detail-row strong { display: inline-block; min-width: 140px; color: #1a1a1a; font-weight: 600; }
        .amount { font-size: 20px; font-weight: 600; color: #2e7d32; }
        .footer { text-align: center; color: #666; padding: 20px; font-size: 12px; border-top: 1px solid #e5e5e5; background: #fafafa; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✅ Withdrawal Successful</h1>
        </div>
        <div class="content">
          <p>Dear ${withdrawalDetails.caregiverName},</p>
          <p>Your withdrawal request has been successfully processed. The funds have been sent to your specified account.</p>

          <div class="success-box">
            <h3 style="margin: 0 0 15px 0; color: #2e7d32;">Transaction Summary</h3>
            <div class="detail-row">
              <strong>Withdrawal Amount:</strong>
              <span class="amount">${withdrawalDetails.currency} ${withdrawalDetails.requestedAmount}</span>
            </div>
            <div class="detail-row">
              <strong>Transaction Fee:</strong>
              <span>${withdrawalDetails.currency} ${withdrawalDetails.withdrawalFee}</span>
            </div>
            <div class="detail-row">
              <strong>Net Amount Received:</strong>
              <span class="amount">${withdrawalDetails.currency} ${withdrawalDetails.netPayout}</span>
            </div>
            <div class="detail-row">
              <strong>Reference Number:</strong>
              <span>${withdrawalDetails.paymentReference}</span>
            </div>
            <div class="detail-row">
              <strong>Recipient Account:</strong>
              <span>${withdrawalDetails.recipientType === 'mobile_money' ? 'Mobile Money' : 'Bank Account'} - ${withdrawalDetails.recipientNumber}</span>
            </div>
            <div class="detail-row">
              <strong>Processing Date:</strong>
              <span>${new Date().toLocaleDateString()}</span>
            </div>
            <div class="detail-row">
              <strong>Processing Time:</strong>
              <span>${new Date().toLocaleTimeString()}</span>
            </div>
          </div>

          <p><strong>Important Notes:</strong></p>
          <ul>
            <li>Keep this email as your withdrawal receipt</li>
            <li>Funds typically arrive within 1-24 hours depending on your payment provider</li>
            <li>Contact your payment provider if funds don't arrive within 24 hours</li>
            <li>Reference number: <strong>${withdrawalDetails.paymentReference}</strong></li>
          </ul>

          <p>Thank you for using ${systemName}. Your earnings have been successfully transferred.</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} ${systemName}. All rights reserved.</p>
          <p>Keep this email as your official withdrawal receipt.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(caregiverEmail, subject, html);
};

const sendReferralInvitation = async (details) => {
  const { recipientEmail, caregiverName, referralLink, personalMessage } = details;
  const systemName = process.env.SYSTEM || 'TunzaConnect Healthcare';
  const subject = `${caregiverName} recommends ${systemName} Healthcare`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 20px auto; background: white; }
        .header { padding: 30px 20px; text-align: center; border-bottom: 2px solid #e5e5e5; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
        .content { padding: 30px 20px; }
        .highlight-box { background: #f0f8ff; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0; border-radius: 4px; }
        .message-box { background: #fff9f0; padding: 20px; border: 1px solid #ffd89b; border-radius: 4px; margin: 20px 0; }
        .features-box { background: #f9f9f9; padding: 20px; border: 1px solid #e5e5e5; border-radius: 4px; margin: 20px 0; }
        .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white !important; padding: 14px 32px; text-decoration: none; border-radius: 4px; margin: 20px 0; font-size: 16px; font-weight: 600; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.3); }
        .footer { text-align: center; color: #666; padding: 20px; font-size: 12px; border-top: 1px solid #e5e5e5; background: #fafafa; }
        ul { padding-left: 20px; margin: 10px 0; }
        li { margin-bottom: 8px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🌟 You've Been Referred to ${systemName}</h1>
        </div>
        <div class="content">
          <p>Hello,</p>
          <p><strong>${caregiverName}</strong>, a trusted healthcare caregiver, has recommended ${systemName} to you for quality home healthcare services.</p>

          ${personalMessage ? `
          <div class="message-box">
            <h3 style="margin: 0 0 10px 0; color: #856404;">📝 Personal Message from ${caregiverName}:</h3>
            <p style="margin: 0; font-style: italic;">"${personalMessage}"</p>
          </div>
          ` : ''}

          <div class="highlight-box">
            <h3 style="margin: 0 0 15px 0; color: #667eea;">Why Choose ${systemName}?</h3>
            <ul style="margin: 0;">
              <li>✅ <strong>Verified Healthcare Professionals</strong> - All caregivers are credential-verified</li>
              <li>🏠 <strong>Convenient Home Care Services</strong> - Healthcare at your doorstep</li>
              <li>📹 <strong>Secure Video Consultations</strong> - Connect from anywhere</li>
              <li>⏰ <strong>Easy Appointment Scheduling</strong> - Book at your convenience</li>
              <li>💳 <strong>Secure Payment Processing</strong> - Safe and reliable transactions</li>
            </ul>
          </div>

          <center>
            <a href="${referralLink}" class="button" style="color: white !important;">Get Started with ${systemName}</a>
          </center>

          <p style="font-size: 13px; color: #666; text-align: center; margin-top: 20px;">
            This referral link helps ${caregiverName} be recommended to more patients like you.<br>
            By signing up, you support their professional recognition on our platform.
          </p>

          <div class="features-box">
            <h3 style="margin: 0 0 15px 0;">Getting Started is Easy:</h3>
            <ol style="margin: 0; padding-left: 20px;">
              <li>Click the button above to create your free account</li>
              <li>Complete your patient profile</li>
              <li>Browse verified caregivers and specialties</li>
              <li>Book your first appointment</li>
            </ol>
          </div>

          <p>Join hundreds of patients who trust ${systemName} for their healthcare needs.</p>
        </div>
        <div class="footer">
          <p><strong>${systemName} Healthcare Platform</strong></p>
          <p>© ${new Date().getFullYear()} ${systemName}. All rights reserved.</p>
          <p>This email was sent because ${caregiverName} thought you might benefit from our healthcare services.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(recipientEmail, subject, html);
};

module.exports = {
  sendEmail,
  sendAppointmentConfirmation,
  sendCaregiverAppointmentNotification,
  sendStatusAlert,
  sendPasswordChangeNotification,
  sendPasswordResetEmail,
  sendCaregiverRegistrationNotification,
  sendCaregiverVerificationNotification,
  sendCaregiverRejectionNotification,
  sendAccountStatusNotification,
  sendPaymentConfirmation,
  sendPaymentFailureNotification,
  sendBookingExpiredNotification,
  sendRescheduleNotification,
  sendCancellationNotification,
  sendUserWelcomeEmail,
  sendDataProtectionNotification,
  sendCustomMessageToCaregiver,
  sendWithdrawalTokenEmail,
  sendWithdrawalSuccessEmail,
  sendReferralInvitation,
};
