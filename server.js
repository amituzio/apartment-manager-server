const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const twilio = require('twilio');
require('dotenv').config();

const app = express();

// CRITICAL: Configure body parser BEFORE routes
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

// Parse JSON with proper limits
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(bodyParser.json({ limit: '50mb' }));

// Store Twilio config
let twilioConfig = null;

console.log('✅ Server starting...');

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'running',
    version: '4.0',
    twilioConfigured: !!twilioConfig
  });
});

// Save Twilio Config
app.post('/api/save-twilio-config', express.json(), (req, res) => {
  try {
    const { accountSid, authToken, fromNumber } = req.body;

    if (!accountSid || !authToken || !fromNumber) {
      return res.status(400).json({
        success: false,
        error: 'Missing fields'
      });
    }

    twilioConfig = { accountSid, authToken, fromNumber };
    console.log('✅ Twilio config saved');

    res.json({ success: true, message: 'Saved' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Test Twilio
app.post('/api/test-twilio', express.json(), (req, res) => {
  try {
    const { accountSid, authToken, fromNumber } = req.body;

    if (!accountSid || !authToken || !fromNumber) {
      return res.status(400).json({ success: false, error: 'Missing fields' });
    }

    if (accountSid.startsWith('AC') && authToken.length > 20) {
      res.json({ success: true, message: 'Valid' });
    } else {
      res.status(400).json({ success: false, error: 'Invalid format' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// MAIN SMS SENDING ROUTE - THIS IS THE CRITICAL ONE
app.post('/api/send-sms', express.json(), async (req, res) => {
  try {
    console.log('📨 SMS Request received');
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);
    console.log('Body type:', typeof req.body);
    console.log('Body keys:', Object.keys(req.body || {}));

    const { to, message } = req.body;

    console.log('Extracted - to:', to);
    console.log('Extracted - message:', message);
    console.log('to exists:', !!to);
    console.log('message exists:', !!message);

    // Validate
    if (!to || !message) {
      console.error('❌ Missing fields - to:', !!to, 'message:', !!message);
      return res.status(400).json({
        success: false,
        error: 'Missing phone or message',
        received: { to, message }
      });
    }

    // Check Twilio config
    if (!twilioConfig) {
      return res.status(400).json({
        success: false,
        error: 'Twilio not configured'
      });
    }

    const { accountSid, authToken, fromNumber } = twilioConfig;

    console.log(`📱 Sending to: ${to}`);
    console.log(`📝 Message: ${message}`);

    // Create Twilio client
    const client = twilio(accountSid, authToken);

    // Send SMS
    const result = await client.messages.create({
      body: message,
      from: fromNumber,
      to: to
    });

    console.log(`✅ SMS sent! SID: ${result.sid}`);

    res.json({
      success: true,
      message: 'SMS sent!',
      messageSid: result.sid,
      status: result.status
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: err.message });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n✅ Server running on port ${PORT}\n`);
});