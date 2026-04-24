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

// In-memory store for credentials (in production, use a database)
let credentials = {};

// ============================================
// TWILIO ROUTES
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
      // Store credentials for later use
      credentials.twilio = {
        accountSid,
        authToken,
        fromNumber
      };

      return res.json({
        success: true,
        message: 'Twilio connection successful!',
        accountName: account.friendlyName,
        status: account.status
      });
    }
  } catch (error) {
    console.error('Twilio error:', error.message);
    return res.status(400).json({
      success: false,
      message: `Twilio error: ${error.message}`,
      details: error.message.includes('Invalid') ? 'Check your Account SID and Auth Token' : error.message
    });
  }
});

// Send SMS via Twilio
app.post('/api/send-sms', async (req, res) => {
  try {
    const { to, message, accountSid, authToken, fromNumber } = req.body;

    if (!to || !message || !accountSid || !authToken || !fromNumber) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields' 
      });
    }

    // Validate phone number format
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(to)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid phone number format. Use format: +919876543210' 
      });
    }

    const client = twilio(accountSid, authToken);

    const result = await client.messages.create({
      body: message,
      from: fromNumber,
      to: to
    });

    return res.json({
      success: true,
      message: 'SMS sent successfully!',
      messageSid: result.sid,
      status: result.status
    });
  } catch (error) {
    console.error('SMS sending error:', error.message);
    return res.status(400).json({
      success: false,
      message: `Failed to send SMS: ${error.message}`
    });
  }
});

// Send WhatsApp via Twilio
app.post('/api/send-whatsapp', async (req, res) => {
  try {
    const { to, message, accountSid, authToken, fromNumber } = req.body;

    if (!to || !message || !accountSid || !authToken || !fromNumber) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields' 
      });
    }

    const client = twilio(accountSid, authToken);

    // WhatsApp requires the format: whatsapp:+number
    const whatsappFromNumber = `whatsapp:${fromNumber}`;
    const whatsappToNumber = `whatsapp:${to}`;

    const result = await client.messages.create({
      body: message,
      from: whatsappFromNumber,
      to: whatsappToNumber
    });

    return res.json({
      success: true,
      message: 'WhatsApp message sent successfully!',
      messageSid: result.sid,
      status: result.status
    });
  } catch (error) {
    console.error('WhatsApp sending error:', error.message);
    return res.status(400).json({
      success: false,
      message: `Failed to send WhatsApp: ${error.message}`
    });
  }
});

// ============================================
// AWS SNS ROUTES
// ============================================

// Test AWS SNS Connection
app.post('/api/test-aws', async (req, res) => {
  try {
    const { accessKeyId, secretAccessKey, region } = req.body;

    if (!accessKeyId || !secretAccessKey || !region) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: accessKeyId, secretAccessKey, region' 
      });
    }

    const sns = new AWS.SNS({
      accessKeyId,
      secretAccessKey,
      region
    });

    // Try to list topics to verify credentials
    const data = await sns.listTopics().promise();

    return res.json({
      success: true,
      message: 'AWS SNS connection successful!',
      topicsCount: data.Topics.length
    });
  } catch (error) {
    console.error('AWS error:', error.message);
    return res.status(400).json({
      success: false,
      message: `AWS SNS error: ${error.message}`,
      details: 'Check your AWS credentials and region'
    });
  }
});

// Send SMS via AWS SNS
app.post('/api/send-aws-sms', async (req, res) => {
  try {
    const { to, message, accessKeyId, secretAccessKey, region } = req.body;

    if (!to || !message || !accessKeyId || !secretAccessKey || !region) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields' 
      });
    }

    const sns = new AWS.SNS({
      accessKeyId,
      secretAccessKey,
      region
    });

    // AWS requires format: +countrcode + number
    const params = {
      Message: message,
      PhoneNumber: to
    };

    const data = await sns.publish(params).promise();

    return res.json({
      success: true,
      message: 'SMS sent via AWS SNS successfully!',
      messageId: data.MessageId
    });
  } catch (error) {
    console.error('AWS SMS error:', error.message);
    return res.status(400).json({
      success: false,
      message: `Failed to send SMS via AWS: ${error.message}`
    });
  }
});

// ============================================
// GENERAL ROUTES
// ============================================

// Get stored credentials (for display purposes)
app.get('/api/credentials', (req, res) => {
  const maskedCreds = {};
  
  if (credentials.twilio) {
    maskedCreds.twilio = {
      accountSid: credentials.twilio.accountSid.substring(0, 10) + '...',
      fromNumber: credentials.twilio.fromNumber
    };
  }
  
  if (credentials.aws) {
    maskedCreds.aws = {
      region: credentials.aws.region
    };
  }

  res.json(maskedCreds);
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'Server is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred'
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════╗
║  Apartment Manager Server Running       ║
║  Port: ${PORT}                              ║
║  API Base: http://localhost:${PORT}/api   ║
╚══════════════════════════════════════════╝
  `);
  console.log('Available endpoints:');
  console.log('  POST /api/test-twilio');
  console.log('  POST /api/send-sms');
  console.log('  POST /api/send-whatsapp');
  console.log('  POST /api/test-aws');
  console.log('  POST /api/send-aws-sms');
  console.log('  GET  /api/health');
});
