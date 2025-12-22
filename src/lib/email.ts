import nodemailer from 'nodemailer';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

// Check if we should use Resend API (recommended for Vercel/cloud platforms)
const useResend = !!process.env.RESEND_API_KEY;

// SMTP transporter for local development or non-Vercel platforms
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_PORT === '465',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  connectionTimeout: 30000,
  greetingTimeout: 30000,
  socketTimeout: 30000,
  pool: true,
  maxConnections: 5,
  maxMessages: 100,
  requireTLS: true,
  tls: {
    rejectUnauthorized: false,
    minVersion: 'TLSv1.2',
  },
  debug: process.env.NODE_ENV !== 'production',
  logger: process.env.NODE_ENV !== 'production',
});

// Send email via Resend API (works on Vercel - no SMTP port blocking)
async function sendViaResend({ to, subject, html }: EmailOptions): Promise<boolean> {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'BAP Workspace <onboarding@resend.dev>',
        to: [to],
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Resend API error:', error);
      return false;
    }

    const data = await response.json();
    console.log('Email sent via Resend:', data.id);
    return true;
  } catch (error) {
    console.error('Resend email error:', error);
    return false;
  }
}

// Send email via SMTP (nodemailer)
async function sendViaSMTP({ to, subject, html }: EmailOptions): Promise<boolean> {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`Sending email to ${to} (attempt ${attempt}/3)...`);

      const info = await transporter.sendMail({
        from: process.env.EMAIL_FROM || 'BAP Workspace <noreply@bap.com>',
        to,
        subject,
        html,
      });

      console.log('Email sent successfully to:', to);
      console.log('Message ID:', info.messageId);
      return true;
    } catch (error: any) {
      lastError = error;
      console.error(`Email attempt ${attempt} failed:`, error.message);

      if (attempt < 3 && (error.code === 'ETIMEDOUT' || error.code === 'ECONNECTION')) {
        console.log(`Waiting 2 seconds before retry...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  console.error('All SMTP attempts failed:', lastError);
  return false;
}

export async function sendEmail({ to, subject, html }: EmailOptions): Promise<boolean> {
  try {
    // Check if any email provider is configured
    if (!process.env.RESEND_API_KEY && !process.env.SMTP_USER) {
      console.log('Email not configured. Logging email content:');
      console.log('To:', to);
      console.log('Subject:', subject);
      return true; // Return true for development
    }

    // Use Resend API if available (recommended for Vercel)
    if (useResend) {
      console.log('Using Resend API to send email...');
      return await sendViaResend({ to, subject, html });
    }

    // Fall back to SMTP
    console.log('Using SMTP to send email...');
    return await sendViaSMTP({ to, subject, html });
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}

export function generateVerificationEmail(name: string, verificationUrl: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify Your Email</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #BA6675 0%, #95739F 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 28px;">BAP Workspace</h1>
      </div>
      <div style="background: #ffffff; padding: 40px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
        <h2 style="color: #333; margin-top: 0;">Welcome, ${name}!</h2>
        <p style="color: #666;">Thank you for signing up for BAP Workspace. To complete your registration, please verify your email address by clicking the button below:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" style="display: inline-block; background: linear-gradient(135deg, #BA6675 0%, #95739F 100%); color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Verify Email Address</a>
        </div>
        <p style="color: #666; font-size: 14px;">If the button doesn't work, copy and paste this link into your browser:</p>
        <p style="color: #667eea; word-break: break-all; font-size: 14px;">${verificationUrl}</p>
        <p style="color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">This link will expire in 24 hours. If you didn't create an account with BAP Workspace, you can safely ignore this email.</p>
      </div>
    </body>
    </html>
  `;
}

export function generateOtpEmail(name: string, otp: string, magicLinkUrl?: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Your Verification Code</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #BA6675 0%, #95739F 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 28px;">BAP Workspace</h1>
      </div>
      <div style="background: #ffffff; padding: 40px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
        <h2 style="color: #333; margin-top: 0;">Hi ${name}!</h2>
        <p style="color: #666;">Your verification code is:</p>
        <div style="text-align: center; margin: 30px 0;">
          <div style="display: inline-block; background: #f5f5f5; padding: 20px 40px; border-radius: 8px; letter-spacing: 8px; font-size: 32px; font-weight: bold; color: #333;">${otp}</div>
        </div>
        <p style="color: #666; font-size: 14px;">Enter this code in the app to verify your email address.</p>
        ${magicLinkUrl ? `
        <div style="text-align: center; margin: 30px 0; padding-top: 20px; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 14px; margin-bottom: 15px;">Or click the button below to sign in instantly:</p>
          <a href="${magicLinkUrl}" style="display: inline-block; background: linear-gradient(135deg, #BA6675 0%, #95739F 100%); color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Sign In with Magic Link</a>
        </div>
        ` : ''}
        <p style="color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">This code will expire in 10 minutes. If you didn't request this code, you can safely ignore this email.</p>
      </div>
    </body>
    </html>
  `;
}

export function generateMagicLinkEmail(name: string, magicLinkUrl: string, isNewUser: boolean = false): string {
  const greeting = isNewUser
    ? `Thank you for signing up for BAP Workspace. Click the magic link below to complete your signup and sign in instantly:`
    : `Welcome back to BAP Workspace! Click the magic link below to sign in instantly:`;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Sign in to BAP</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #BA6675 0%, #95739F 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 28px;">BAP Workspace</h1>
      </div>
      <div style="background: #ffffff; padding: 40px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
        <p style="color: #666;">${greeting}</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${magicLinkUrl}" style="display: inline-block; background: linear-gradient(135deg, #BA6675 0%, #95739F 100%); color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Magic Link</a>
        </div>
        <p style="color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">This link expires in 15 minutes.</p>
      </div>
    </body>
    </html>
  `;
}

export function generatePasswordResetEmail(name: string, resetUrl: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reset Your Password</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #BA6675 0%, #95739F 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 28px;">BAP Workspace</h1>
      </div>
      <div style="background: #ffffff; padding: 40px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
        <h2 style="color: #333; margin-top: 0;">Reset Your Password</h2>
        <p style="color: #666;">Hi ${name}, we received a request to reset your password. Click the button below to create a new password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #BA6675 0%, #95739F 100%); color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Reset Password</a>
        </div>
        <p style="color: #666; font-size: 14px;">If the button doesn't work, copy and paste this link into your browser:</p>
        <p style="color: #667eea; word-break: break-all; font-size: 14px;">${resetUrl}</p>
        <p style="color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.</p>
      </div>
    </body>
    </html>
  `;
}
