const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const config = require('../config');

let sesClient;
try {
  sesClient = new SESClient({
    region: config.aws.region,
    credentials: {
      accessKeyId: config.aws.accessKeyId,
      secretAccessKey: config.aws.secretAccessKey,
    },
  });
} catch {
  console.warn('AWS SES not configured — emails will be logged to console');
}

const emailService = {
  async sendInviteEmail({ to, batchName, inviteLink }) {
    const subject = `You're invited to join EnglishX — ${batchName}`;
    const html = `
      <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="color: #6366f1; font-size: 28px; margin: 0;">EnglishX</h1>
          <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Your AI English Speaking Coach</p>
        </div>
        <div style="background: #f8fafc; border-radius: 12px; padding: 32px; margin-bottom: 24px;">
          <h2 style="color: #1e293b; font-size: 20px; margin-top: 0;">You've been invited!</h2>
          <p style="color: #475569; line-height: 1.6;">
            You've been invited to join <strong>${batchName}</strong> on EnglishX —
            a voice-first AI English speaking coach that helps you practise speaking,
            get specific feedback on your pronunciation, vocabulary, and grammar,
            and track your progress over time.
          </p>
          <a href="${inviteLink}"
             style="display: inline-block; background: #6366f1; color: white; padding: 14px 32px;
                    border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px;">
            Accept Invite &amp; Sign Up
          </a>
          <p style="color: #94a3b8; font-size: 12px; margin-top: 16px;">
            This invite expires in 7 days. If you didn't expect this email, you can safely ignore it.
          </p>
        </div>
      </div>
    `;

    return this._send({ to, subject, html });
  },

  async sendDailyReminder({ to, name }) {
    const subject = "Don't break your streak! Practise English today 🎤";
    const html = `
      <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="color: #6366f1; font-size: 28px; margin: 0;">EnglishX</h1>
        </div>
        <div style="background: #f8fafc; border-radius: 12px; padding: 32px;">
          <h2 style="color: #1e293b; font-size: 20px; margin-top: 0;">Hi ${name}!</h2>
          <p style="color: #475569; line-height: 1.6;">
            You haven't practised today yet. Just 10 minutes of speaking practice
            can make a real difference. Your AI partner is ready and waiting!
          </p>
          <a href="${config.frontend.url}/dashboard"
             style="display: inline-block; background: #6366f1; color: white; padding: 14px 32px;
                    border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px;">
            Start Practising
          </a>
        </div>
      </div>
    `;

    return this._send({ to, subject, html });
  },

  async sendOtpEmail({ to, otp }) {
    const subject = 'Your EnglishX verification code';
    const html = `
      <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="color: #6366f1; font-size: 28px; margin: 0;">EnglishX</h1>
          <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Your AI English Speaking Coach</p>
        </div>
        <div style="background: #f8fafc; border-radius: 12px; padding: 32px; margin-bottom: 24px;">
          <h2 style="color: #1e293b; font-size: 20px; margin-top: 0;">Verify your email</h2>
          <p style="color: #475569; line-height: 1.6;">
            Use the code below to verify your account. It expires in <strong>10 minutes</strong>.
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <span style="display: inline-block; background: #6366f1; color: white;
                         font-size: 36px; font-weight: 700; letter-spacing: 10px;
                         padding: 16px 32px; border-radius: 12px; font-family: monospace;">
              ${otp}
            </span>
          </div>
          <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0;">
            If you didn't create an EnglishX account, you can safely ignore this email.
          </p>
        </div>
      </div>
    `;
    return this._send({ to, subject, html });
  },

  async _send({ to, subject, html }) {
    const fromEmail = config.aws.sesFromEmail;
    const isMocked = !sesClient || !config.aws.accessKeyId || config.aws.accessKeyId === 'your-access-key-id';

    if (isMocked) {
      console.log(`[EMAIL MOCK] To: ${to} | Subject: ${subject}`);
      return { messageId: 'mock-email-id', status: 'mocked' };
    }

    const command = new SendEmailCommand({
      Source: fromEmail,
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: { Html: { Data: html, Charset: 'UTF-8' } },
      },
    });

    try {
      const result = await sesClient.send(command);
      return { messageId: result.MessageId, status: 'sent' };
    } catch (err) {
      console.error('AWS SES send failed:', err.message);
      throw new Error('Email delivery failed');
    }
  },
};

module.exports = emailService;
