const express = require('express');
const twilio = require('twilio');
require('dotenv').config();

const app = express();

// Simple middleware
app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

let twilioConfig = null;

// Health
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', twilio: !!twilioConfig });
});

// Save config
app.post('/api/save-twilio-config', (req, res) => {
  const { accountSid, authToken, fromNumber } = req.body;
  if (accountSid && authToken && fromNumber) {
    twilioConfig = { accountSid, authToken, fromNumber };
    res.json({ success: true });
  } else {
    res.status(400).json({ success: false, error: 'Missing fields' });
  }
});

// Test
app.post('/api/test-twilio', (req, res) => {
  const { accountSid, authToken } = req.body;
  if (accountSid && accountSid.startsWith('AC') && authToken && authToken.length > 20) {
    res.json({ success: true });
  } else {
    res.status(400).json({ success: false, error: 'Invalid' });
  }
});

// SEND SMS - ABSOLUTE SIMPLEST VERSION
app.post('/api/send-sms', async (req, res) => {
  try {
    const phone = req.body.to;
    const msg = req.body.message;

    if (!phone || !msg) {
      return res.status(400).json({
        success: false,
        error: 'Missing to or message',
        got: { to: phone, message: msg }
      });
    }

    if (!twilioConfig) {
      return res.status(400).json({
        success: false,
        error: 'Twilio not configured'
      });
    }

    const client = twilio(twilioConfig.accountSid, twilioConfig.authToken);
    const result = await client.messages.create({
      body: msg,
      from: twilioConfig.fromNumber,
      to: phone
    });

    res.json({
      success: true,
      messageSid: result.sid,
      status: result.status
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

app.listen(3001, () => {
  console.log('Server running on port 3001');
});
