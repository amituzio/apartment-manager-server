const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const twilio = require('twilio');
const AWS = require('aws-sdk');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// In-memory store for credentials (persists during server runtime)
let credentials = {
  twilio: null
};

// ============================================
// CREDENTIAL MANAGEMENT
// ============================================

// Save Twilio Credentials from Frontend
app.post('/api/save-twilio-config', async (req, res) => {
  try {
    const { accountSid, authToken, fromNumber } = req.body;

    if (!accountSid || !authToken || !fromNumber) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: accountSid, authToken, fromNumber' 
      });
    }

    // Store credentials in memory
    credentials.twilio = {
      accountSid,
      authToken,
      fromNumber
    };

    console.log('✅ Twilio credentials saved successfully');

    return res.json({
      success: true,
      message: 'Twilio credentials saved successfully!',
      configured: true
    });
  } catch (error) {
    console.error('Error saving Twilio config:', error.message);
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Get Twilio Configuration Status
app.get('/api/twilio-status', (req, res) => {
  const isConfigured = credentials.twilio && credentials.twilio.accountSid && credentials.twilio.authToken && credentials.twilio.fromNumber;
  
  return res.json({
    configured: isConfigured,
    message: isConfigured ? 'Twilio is configured' : 'Twilio is not configured'
  });
});

// ============================================
// TWILIO SMS ROUTES
// ============================================

// Test Twilio Connection
app.post('/api/test-twilio', async (req, res) => {
  try {
    const { accountSid, authToken, fromNumber } = req.body;

    if (!accountSid || !authToken || !fromNumber) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: accountSid, authToken, fromNumber' 
      });
    }

    // Create Twilio client with provided credentials
    const client = twilio(accountSid, authToken);

    // Try to fetch account info to verify credentials
    const account = await client.api.accounts(accountSid).fetch();

    if (account.status === 'active') {
      return res.json({
        success: true,
        message: 'Twilio connection successful!',
        accountName: account.friendlyName,
        status: account.status
      });
    }
  } catch (error) {
    console.error('Twilio test error:', error.message);
    return res.status(400).json({
      success: false,
      message: `Twilio error: ${error.message}`,
      details: error.message.includes('Invalid') ? 'Check your Account SID and Auth Token' : error.message
    });
  }
});

// Send SMS using stored credentials (Called by Frontend)
app.post('/api/send-sms', async (req, res) => {
  try {
    const { to, message } = req.body;

    if (!to || !message) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing phone number or message' 
      });
    }

    // Check if Twilio is configured
    if (!credentials.twilio || !credentials.twilio.accountSid) {
      return res.status(400).json({
        success: false,
        message: 'Twilio not configured on server. Please configure credentials first.',
        needsConfig: true
      });
    }

    const { accountSid, authToken, fromNumber } = credentials.twilio;
    
    // Validate phone number format
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(to)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid phone number format. Use format: +919876543210' 
      });
    }

    // Create Twilio client
    const client = twilio(accountSid, authToken);

    console.log(`📱 Sending SMS to ${to}...`);

    // Send SMS
    const result = await client.messages.create({
      body: message,
      from: fromNumber,
      to: to
    });

    console.log(`✅ SMS sent! Message SID: ${result.sid}`);

    return res.json({
      success: true,
      message: 'SMS sent successfully!',
      messageSid: result.sid,
      status: result.status,
      sentTo: to
    });
  } catch (error) {
    console.error('❌ SMS sending error:', error.message);
    return res.status(400).json({
      success: false,
      message: `Failed to send SMS: ${error.message}`,
      error: error.message
    });
  }
});

// Send WhatsApp using Twilio
app.post('/api/send-whatsapp', async (req, res) => {
  try {
    const { to, message } = req.body;

    if (!to || !message) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing phone number or message' 
      });
    }

    if (!credentials.twilio || !credentials.twilio.accountSid) {
      return res.status(400).json({
        success: false,
        message: 'Twilio not configured on server'
      });
    }

    const { accountSid, authToken, fromNumber } = credentials.twilio;
    const client = twilio(accountSid, authToken);

    // WhatsApp requires whatsapp: prefix
    const whatsappFromNumber = `whatsapp:${fromNumber}`;
    const whatsappToNumber = `whatsapp:${to}`;

    console.log(`💬 Sending WhatsApp to ${to}...`);

    const result = await client.messages.create({
      body: message,
      from: whatsappFromNumber,
      to: whatsappToNumber
    });

    console.log(`✅ WhatsApp sent! Message SID: ${result.sid}`);

    return res.json({
      success: true,
      message: 'WhatsApp sent successfully!',
      messageSid: result.sid,
      status: result.status
    });
  } catch (error) {
    console.error('❌ WhatsApp error:', error.message);
    return res.status(400).json({
      success: false,
      message: `Failed to send WhatsApp: ${error.message}`
    });
  }
});

// ============================================
// GENERAL ROUTES
// ============================================

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'Server is running',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    twilioConfigured: !!credentials.twilio
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred'
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║     Apartment Manager Server (v2.0 - With SMS)          ║
║  ✅ Express Server Running                               ║
║  ✅ CORS Enabled                                         ║
║  ✅ Twilio Integration Ready                             ║
║                                                          ║
║  Port: ${PORT}                                              ║
║  API Base: http://localhost:${PORT}/api                  ║
║                                                          ║
║  Available Endpoints:                                    ║
║  - POST /api/save-twilio-config    (Save credentials)   ║
║  - POST /api/test-twilio           (Test connection)    ║
║  - GET  /api/twilio-status         (Check status)       ║
║  - POST /api/send-sms              (Send SMS)           ║
║  - POST /api/send-whatsapp         (Send WhatsApp)      ║
║  - GET  /api/health                (Health check)       ║
║                                                          ║
║  🎉 Ready to receive Twilio credentials from frontend!  ║
╚══════════════════════════════════════════════════════════╝
  `);
});
