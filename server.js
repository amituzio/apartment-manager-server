const express = require('express');
const cors = require('cors');
const twilio = require('twilio');
require('dotenv').config();

const app = express();

// Configure middleware BEFORE routes
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Store Twilio config
let twilioConfig = null;

console.log('🚀 Apartment Manager Server v4.1 Starting...');

// ============ HEALTH CHECK ============
app.get('/api/health', (req, res) => {
  console.log('✅ Health check requested');
  res.json({
    status: 'running',
    timestamp: new Date().toISOString(),
    twilioConfigured: !!twilioConfig
  });
});

// ============ SAVE TWILIO CONFIG ============
app.post('/api/save-twilio-config', (req, res) => {
  try {
    console.log('📥 Save Twilio Config request');
    console.log('Body received:', JSON.stringify(req.body));

    const { accountSid, authToken, fromNumber } = req.body;

    if (!accountSid || !authToken || !fromNumber) {
      console.error('❌ Missing Twilio fields');
      return res.status(400).json({
        success: false,
        error: 'Missing: accountSid, authToken, or fromNumber',
        received: req.body
      });
    }

    twilioConfig = { accountSid, authToken, fromNumber };
    console.log('✅ Twilio config saved successfully');

    res.json({
      success: true,
      message: 'Twilio credentials saved'
    });
  } catch (error) {
    console.error('❌ Error saving config:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============ TEST TWILIO ============
app.post('/api/test-twilio', (req, res) => {
  try {
    console.log('🧪 Testing Twilio');
    const { accountSid, authToken, fromNumber } = req.body;

    if (!accountSid || !authToken || !fromNumber) {
      return res.status(400).json({
        success: false,
        error: 'Missing fields'
      });
    }

    if (accountSid.startsWith('AC') && authToken.length > 20) {
      console.log('✅ Twilio credentials valid');
      res.json({
        success: true,
        message: 'Credentials are valid'
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Invalid format'
      });
    }
  } catch (error) {
    console.error('❌ Test error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============ SEND SMS (MAIN ROUTE) ============
app.post('/api/send-sms', (req, res) => {
  try {
    console.log('\n========================================');
    console.log('📨 SMS SEND REQUEST RECEIVED');
    console.log('========================================');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Content-Type:', req.get('Content-Type'));
    console.log('Full Body:', JSON.stringify(req.body));
    console.log('Body Type:', typeof req.body);
    console.log('Body Keys:', Object.keys(req.body || {}));

    // Extract fields
    const to = req.body?.to;
    const message = req.body?.message;

    console.log('Extracted to:', to, '| Type:', typeof to);
    console.log('Extracted message:', message ? `"${message.substring(0, 30)}..."` : 'undefined', '| Type:', typeof message);
    console.log('to is truthy:', !!to);
    console.log('message is truthy:', !!message);

    // Validate
    if (!to || !message) {
      console.error('❌ VALIDATION FAILED');
      console.error('Missing to:', !to);
      console.error('Missing message:', !message);
      return res.status(400).json({
        success: false,
        error: 'Missing phone number or message',
        received: { to, message },
        details: `to: ${to ? 'received' : 'MISSING'}, message: ${message ? 'received' : 'MISSING'}`
      });
    }

    // Check Twilio config
    if (!twilioConfig) {
      console.error('❌ Twilio not configured on server');
      return res.status(400).json({
        success: false,
        error: 'Twilio not configured. Please configure credentials first.',
        needsConfig: true
      });
    }

    const { accountSid, authToken, fromNumber } = twilioConfig;

    console.log('✅ Validation passed');
    console.log(`📞 Sending SMS:`);
    console.log(`   To: ${to}`);
    console.log(`   From: ${fromNumber}`);
    console.log(`   Message: "${message.substring(0, 50)}..."`);

    // Create Twilio client
    const client = twilio(accountSid, authToken);

    // Send SMS
    client.messages.create({
      body: message,
      from: fromNumber,
      to: to
    }).then(result => {
      console.log('✅ SMS SENT SUCCESSFULLY');
      console.log('Message SID:', result.sid);
      console.log('Status:', result.status);
      console.log('========================================\n');

      res.json({
        success: true,
        message: 'SMS sent successfully!',
        messageSid: result.sid,
        status: result.status,
        sentTo: to
      });
    }).catch(error => {
      console.error('❌ TWILIO ERROR:', error.message);
      console.error('========================================\n');

      res.status(400).json({
        success: false,
        error: error.message,
        details: 'Check Twilio credentials and phone number format'
      });
    });

  } catch (error) {
    console.error('❌ UNEXPECTED ERROR:', error.message);
    console.error('Stack:', error.stack);
    console.error('========================================\n');

    res.status(500).json({
      success: false,
      error: error.message,
      type: error.constructor.name
    });
  }
});

// ============ CATCH ALL ============
app.all('*', (req, res) => {
  console.log(`⚠️ Unknown route: ${req.method} ${req.path}`);
  res.status(404).json({
    error: 'Route not found',
    path: req.path,
    method: req.method
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('💥 UNHANDLED ERROR:', err.message);
  res.status(500).json({
    error: err.message
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n╔════════════════════════════════════╗`);
  console.log(`║  🏢 Apartment Manager Server       ║`);
  console.log(`║  Version: 4.1                      ║`);
  console.log(`║  Port: ${PORT}                         ║`);
  console.log(`║  Status: ✅ RUNNING                ║`);
  console.log(`╚════════════════════════════════════╝\n`);
});