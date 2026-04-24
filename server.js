const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const twilio = require('twilio');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

// Store credentials in memory
let twilioConfig = null;

console.log('✅ Apartment Manager Server Starting...');

// ============================================
// HEALTH CHECK
// ============================================

app.get('/api/health', (req, res) => {
  res.json({
    status: 'running',
    message: 'Server is active',
    timestamp: new Date().toISOString(),
    version: '3.0.0',
    twilioConfigured: !!twilioConfig
  });
});

// ============================================
// TWILIO CONFIGURATION
// ============================================

// Save Twilio Config
app.post('/api/save-twilio-config', (req, res) => {
  try {
    const { accountSid, authToken, fromNumber } = req.body;

    if (!accountSid || !authToken || !fromNumber) {
      return res.status(400).json({
        success: false,
        error: 'Missing: accountSid, authToken, or fromNumber'
      });
    }

    twilioConfig = {
      accountSid,
      authToken,
      fromNumber
    };

    console.log('✅ Twilio config saved on server');

    res.json({
      success: true,
      message: 'Twilio credentials saved successfully'
    });
  } catch (error) {
    console.error('Error saving config:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Check Twilio Status
app.get('/api/twilio-status', (req, res) => {
  res.json({
    configured: !!twilioConfig,
    message: twilioConfig ? 'Twilio is configured' : 'Twilio is not configured'
  });
});

// Test Twilio Connection
app.post('/api/test-twilio', (req, res) => {
  try {
    const { accountSid, authToken, fromNumber } = req.body;

    if (!accountSid || !authToken || !fromNumber) {
      return res.status(400).json({
        success: false,
        error: 'Missing credentials'
      });
    }

    // Simple validation
    if (accountSid.startsWith('AC') && authToken.length > 20) {
      res.json({
        success: true,
        message: 'Twilio credentials are valid',
        accountSid: accountSid
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Invalid credential format'
      });
    }
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// SEND SMS - THE MAIN ROUTE
// ============================================

app.post('/api/send-sms', async (req, res) => {
  try {
    console.log('📨 Received SMS request');
    console.log('Request body:', JSON.stringify(req.body));

    const { to, message } = req.body;

    // Validate inputs
    if (!to) {
      console.error('❌ Missing phone number');
      return res.status(400).json({
        success: false,
        error: 'Missing phone number (to)'
      });
    }

    if (!message) {
      console.error('❌ Missing message');
      return res.status(400).json({
        success: false,
        error: 'Missing message'
      });
    }

    // Check if Twilio is configured
    if (!twilioConfig) {
      console.error('❌ Twilio not configured on server');
      return res.status(400).json({
        success: false,
        error: 'Twilio not configured. Please configure credentials first.',
        needsConfig: true
      });
    }

    const { accountSid, authToken, fromNumber } = twilioConfig;

    console.log(`📱 Sending SMS to: ${to}`);
    console.log(`📝 Message: ${message}`);
    console.log(`📞 From: ${fromNumber}`);

    // Create Twilio client
    const client = twilio(accountSid, authToken);

    // Send the SMS
    const result = await client.messages.create({
      body: message,
      from: fromNumber,
      to: to
    });

    console.log(`✅ SMS sent! SID: ${result.sid}`);

    res.json({
      success: true,
      message: 'SMS sent successfully!',
      messageSid: result.sid,
      status: result.status,
      sentTo: to
    });

  } catch (error) {
    console.error('❌ Error sending SMS:', error.message);
    res.status(400).json({
      success: false,
      error: error.message,
      details: 'Check your Twilio credentials and phone number format'
    });
  }
});

// ============================================
// CATCH-ALL ROUTES
// ============================================

app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.path,
    method: req.method
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// ============================================
// START SERVER
// ============================================

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════╗
║                                                        ║
║   🏢 APARTMENT MANAGER SERVER v3.0                     ║
║   ✅ Running on port ${PORT}                              ║
║   ✅ Express.js enabled                                ║
║   ✅ CORS enabled                                      ║
║   ✅ Twilio SMS ready                                  ║
║                                                        ║
║   Available Endpoints:                                 ║
║   • GET  /api/health                                   ║
║   • POST /api/save-twilio-config                       ║
║   • POST /api/test-twilio                              ║
║   • GET  /api/twilio-status                            ║
║   • POST /api/send-sms  ⭐ (Main SMS Route)            ║
║                                                        ║
║   Ready to send SMS messages! 📱                       ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
  `);
});
