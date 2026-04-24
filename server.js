const express = require('express');
const cors = require('cors');
const twilio = require('twilio');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

let twilioConfig = null;

// HEALTH CHECK
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '5.0', twilioConfigured: !!twilioConfig });
});

// SAVE TWILIO CONFIG
app.post('/api/save-twilio-config', (req, res) => {
  try {
    const { accountSid, authToken, fromNumber } = req.body;
    
    if (!accountSid || !authToken || !fromNumber) {
      return res.status(400).json({ success: false, error: 'Missing fields' });
    }
    
    twilioConfig = { accountSid, authToken, fromNumber };
    res.json({ success: true, message: 'Config saved' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// SEND SMS
app.post('/api/send-sms', async (req, res) => {
  try {
    const { to, message } = req.body;
    
    if (!to || !message) {
      return res.status(400).json({ success: false, error: 'Missing to or message' });
    }
    
    if (!twilioConfig) {
      return res.status(400).json({ success: false, error: 'Twilio not configured' });
    }
    
    const client = twilio(twilioConfig.accountSid, twilioConfig.authToken);
    const result = await client.messages.create({
      body: message,
      from: twilioConfig.fromNumber,
      to: to
    });
    
    res.json({ success: true, messageSid: result.sid, status: result.status });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log('✅ Apartment Manager Server running on port ' + PORT);
});
