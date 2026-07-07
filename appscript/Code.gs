// ============================================================
// PropCRM — Google Apps Script Backend
// ============================================================
// Deploy as Web App: Execute as Me, Access: Anyone
// Sheet Structure:
//   Sheet 1: "Leads" — columns: id, name, email, area, price, priceBracket, submittedAt, contacted, contactedAt, emailSentToLead, reminderSentToAgent
//   Sheet 2: "AgentConfig" — row 2: agentName, agentEmail, brevoApiKey, dashboardPin, reminderHours
// ============================================================

// ── Configuration ──────────────────────────────────────────────
const SPREADSHEET_ID = '1P1C-3oHLfVKBZCC0ube7wO-BzC-RRJbiRAO8krIEq4U'; // Replace with your Google Sheet ID
const LEADS_SHEET_NAME = 'Leads';
const CONFIG_SHEET_NAME = 'AgentConfig';

// ── Helper: Get Spreadsheet ────────────────────────────────────
function getSpreadsheet() {
  // Try bound spreadsheet first (when opened via Extensions > Apps Script)
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;
  // Fallback for web app calls
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function getLeadsSheet() {
  return getSpreadsheet().getSheetByName(LEADS_SHEET_NAME);
}

function getConfigSheet() {
  return getSpreadsheet().getSheetByName(CONFIG_SHEET_NAME);
}

// ── Helper: Read Agent Config ──────────────────────────────────
function getAgentConfig() {
  const sheet = getConfigSheet();
  const data = sheet.getRange('A2:E2').getValues()[0];
  return {
    agentName: data[0] || '',
    agentEmail: data[1] || '',
    brevoApiKey: data[2] || '',
    dashboardPin: String(data[3] || ''),
    reminderHours: Number(data[4]) || 1,
  };
}

// ── Helper: Generate UUID ──────────────────────────────────────
function generateUUID() {
  const chars = 'abcdef0123456789';
  let uuid = '';
  const pattern = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] === 'x') {
      uuid += chars[Math.floor(Math.random() * 16)];
    } else if (pattern[i] === 'y') {
      uuid += chars[Math.floor(Math.random() * 4) + 8];
    } else {
      uuid += pattern[i];
    }
  }
  return uuid;
}

// ── Helper: Price Bracket ──────────────────────────────────────
function getPriceBracket(price) {
  if (price < 2500000) return 'Under 25L';
  if (price < 5000000) return '25L - 50L';
  if (price < 10000000) return '50L - 1Cr';
  if (price < 20000000) return '1Cr - 2Cr';
  if (price < 50000000) return '2Cr - 5Cr';
  return '5Cr+';
}

// ── Helper: Validate Lead Data ─────────────────────────────────
function validateLeadData(data) {
  const errors = [];

  // Name validation
  if (!data.name || typeof data.name !== 'string' || data.name.trim().length < 2) {
    errors.push('Name must be at least 2 characters long');
  } else if (!/^[a-zA-Z\s\.\-']+$/.test(data.name.trim())) {
    errors.push('Name can only contain letters, spaces, dots, hyphens, and apostrophes');
  }

  // Email validation
  const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
  if (!data.email || !emailRegex.test(data.email.trim())) {
    errors.push('Please provide a valid email address');
  }

  // Area validation
  if (!data.area || typeof data.area !== 'string' || data.area.trim().length < 1) {
    errors.push('Property area/locality is required');
  } else if (data.area.trim().length > 100) {
    errors.push('Property area must be under 100 characters');
  }

  // Price validation
  const price = Number(data.price);
  if (!data.price || isNaN(price) || price <= 0) {
    errors.push('Property price must be a positive number');
  }

  return errors;
}

// ── Helper: Sanitize Input ─────────────────────────────────────
function sanitize(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[<>"'&]/g, function (c) {
    return { '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '&': '&amp;' }[c];
  });
}

// ── Helper: Format Price for Display ───────────────────────────
function formatPrice(price) {
  // Indian numbering system
  const num = Number(price);
  if (num >= 10000000) {
    return '₹' + (num / 10000000).toFixed(2) + ' Cr';
  } else if (num >= 100000) {
    return '₹' + (num / 100000).toFixed(2) + ' L';
  } else {
    return '₹' + num.toLocaleString('en-IN');
  }
}

// ── Brevo Email Sending ────────────────────────────────────────
function sendBrevoEmail(apiKey, toEmail, toName, subject, htmlContent, senderName, senderEmail) {
  const url = 'https://api.brevo.com/v3/smtp/email';
  const payload = {
    sender: { name: senderName || 'PropCRM', email: senderEmail || 'noreply@propcrm.com' },
    to: [{ email: toEmail, name: toName || '' }],
    subject: subject,
    htmlContent: htmlContent,
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'api-key': apiKey,
      'accept': 'application/json',
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const code = response.getResponseCode();
    if (code >= 200 && code < 300) {
      return { success: true };
    } else {
      Logger.log('Brevo error: ' + response.getContentText());
      return { success: false, error: response.getContentText() };
    }
  } catch (e) {
    Logger.log('Brevo exception: ' + e.message);
    return { success: false, error: e.message };
  }
}

// ── Email Templates ────────────────────────────────────────────

function getLeadAcknowledgmentEmail(name, area, price) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f5f5f0;">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#2E7D32,#4CAF50);padding:40px 32px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:24px;">Thank You, ${sanitize(name)}!</h1>
      <p style="color:#C8E6C9;margin:8px 0 0;font-size:14px;">Your property inquiry has been received</p>
    </div>
    <div style="padding:32px;">
      <p style="color:#333;font-size:15px;line-height:1.6;">We appreciate your interest! Our agent will review your inquiry and contact you shortly.</p>
      <div style="background:#F1F8E9;border-radius:8px;padding:20px;margin:24px 0;">
        <h3 style="color:#2E7D32;margin:0 0 12px;font-size:14px;text-transform:uppercase;letter-spacing:1px;">Your Inquiry Summary</h3>
        <table style="width:100%;font-size:14px;color:#333;">
          <tr><td style="padding:6px 0;font-weight:600;width:120px;">Area</td><td style="padding:6px 0;">${sanitize(area)}</td></tr>
          <tr><td style="padding:6px 0;font-weight:600;">Budget</td><td style="padding:6px 0;">${formatPrice(price)}</td></tr>
        </table>
      </div>
      <p style="color:#666;font-size:13px;line-height:1.6;">If you have any immediate questions, feel free to reply to this email.</p>
    </div>
    <div style="background:#FAFAF5;padding:20px 32px;text-align:center;border-top:1px solid #eee;">
      <p style="color:#999;font-size:11px;margin:0;">Powered by PropCRM</p>
    </div>
  </div>
</body>
</html>`;
}

function getAgentNotificationEmail(leadName, leadEmail, area, price) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f5f5f0;">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#1B5E20,#2E7D32);padding:32px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:22px;">🏠 New Lead Received!</h1>
    </div>
    <div style="padding:32px;">
      <div style="background:#E8F5E9;border-radius:8px;padding:20px;margin-bottom:20px;">
        <table style="width:100%;font-size:14px;color:#333;">
          <tr><td style="padding:8px 0;font-weight:600;width:100px;vertical-align:top;">Name</td><td style="padding:8px 0;">${sanitize(leadName)}</td></tr>
          <tr><td style="padding:8px 0;font-weight:600;vertical-align:top;">Email</td><td style="padding:8px 0;"><a href="mailto:${sanitize(leadEmail)}" style="color:#2E7D32;">${sanitize(leadEmail)}</a></td></tr>
          <tr><td style="padding:8px 0;font-weight:600;vertical-align:top;">Area</td><td style="padding:8px 0;">${sanitize(area)}</td></tr>
          <tr><td style="padding:8px 0;font-weight:600;vertical-align:top;">Budget</td><td style="padding:8px 0;font-size:16px;color:#2E7D32;font-weight:700;">${formatPrice(price)}</td></tr>
        </table>
      </div>
      <p style="color:#666;font-size:13px;line-height:1.6;">Log in to your dashboard to manage this lead and send a follow-up.</p>
    </div>
  </div>
</body>
</html>`;
}

function getAgentReminderEmail(leadName, leadEmail, area, price, hoursAgo) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f5f5f0;">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#E65100,#F57C00);padding:32px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:22px;">⏰ Lead Needs Follow-up!</h1>
      <p style="color:#FFE0B2;margin:8px 0 0;font-size:14px;">Submitted ${hoursAgo} hour(s) ago — not yet contacted</p>
    </div>
    <div style="padding:32px;">
      <div style="background:#FFF3E0;border-radius:8px;padding:20px;margin-bottom:20px;">
        <table style="width:100%;font-size:14px;color:#333;">
          <tr><td style="padding:8px 0;font-weight:600;width:100px;">Name</td><td style="padding:8px 0;">${sanitize(leadName)}</td></tr>
          <tr><td style="padding:8px 0;font-weight:600;">Email</td><td style="padding:8px 0;"><a href="mailto:${sanitize(leadEmail)}" style="color:#E65100;">${sanitize(leadEmail)}</a></td></tr>
          <tr><td style="padding:8px 0;font-weight:600;">Area</td><td style="padding:8px 0;">${sanitize(area)}</td></tr>
          <tr><td style="padding:8px 0;font-weight:600;">Budget</td><td style="padding:8px 0;">${formatPrice(price)}</td></tr>
        </table>
      </div>
      <p style="color:#C62828;font-size:14px;font-weight:600;">Please follow up with this lead as soon as possible.</p>
    </div>
  </div>
</body>
</html>`;
}

function getFollowUpEmail(leadName, area, price, agentName) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f5f5f0;">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#2E7D32,#66BB6A);padding:40px 32px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:22px;">Regarding Your Property Inquiry</h1>
    </div>
    <div style="padding:32px;">
      <p style="color:#333;font-size:15px;line-height:1.7;">Hi ${sanitize(leadName)},</p>
      <p style="color:#333;font-size:15px;line-height:1.7;">Thank you for your interest in properties in <strong>${sanitize(area)}</strong> with a budget of <strong>${formatPrice(price)}</strong>.</p>
      <p style="color:#333;font-size:15px;line-height:1.7;">I'm <strong>${sanitize(agentName)}</strong>, and I'd love to help you find the perfect property. I have several listings that match your requirements.</p>
      <p style="color:#333;font-size:15px;line-height:1.7;">Would you be available for a quick call to discuss your preferences in more detail? Please reply to this email or call me at your convenience.</p>
      <p style="color:#333;font-size:15px;line-height:1.7;margin-top:24px;">Best regards,<br><strong>${sanitize(agentName)}</strong></p>
    </div>
    <div style="background:#FAFAF5;padding:20px 32px;text-align:center;border-top:1px solid #eee;">
      <p style="color:#999;font-size:11px;margin:0;">Powered by PropCRM</p>
    </div>
  </div>
</body>
</html>`;
}

// ── Main Entry: doPost ─────────────────────────────────────────
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    switch (action) {
      case 'submitLead':
        return handleSubmitLead(data);
      case 'verifyPin':
        return handleVerifyPin(data);
      case 'updateContacted':
        return handleUpdateContacted(data);
      case 'sendEmailToLead':
        return handleSendEmailToLead(data);
      default:
        return jsonResponse({ success: false, error: 'Unknown action: ' + action });
    }
  } catch (err) {
    Logger.log('doPost error: ' + err.message);
    return jsonResponse({ success: false, error: 'Server error: ' + err.message });
  }
}

// ── Main Entry: doGet ──────────────────────────────────────────
function doGet(e) {
  try {
    const action = e.parameter.action;
    const pin = e.parameter.pin;

    if (action === 'getLeads') {
      return handleGetLeads(pin);
    }

    return jsonResponse({ success: false, error: 'Unknown action' });
  } catch (err) {
    Logger.log('doGet error: ' + err.message);
    return jsonResponse({ success: false, error: 'Server error: ' + err.message });
  }
}

// ── Handler: Submit Lead ───────────────────────────────────────
function handleSubmitLead(data) {
  // Validate
  const errors = validateLeadData(data);
  if (errors.length > 0) {
    return jsonResponse({ success: false, errors: errors });
  }

  const config = getAgentConfig();
  const sheet = getLeadsSheet();

  // Prepare lead record
  const id = generateUUID();
  const name = data.name.trim();
  const email = data.email.trim().toLowerCase();
  const area = data.area.trim().substring(0, 100);
  const price = Number(data.price);
  const priceBracket = getPriceBracket(price);
  const submittedAt = new Date();

  // Append row to sheet
  sheet.appendRow([
    id,
    name,
    email,
    area,
    price,
    priceBracket,
    submittedAt,
    false,    // contacted
    '',       // contactedAt
    false,    // emailSentToLead
    false,    // reminderSentToAgent
  ]);

  // Send acknowledgment email to lead (non-blocking — lead is already saved)
  let emailSent = false;
  if (config.brevoApiKey) {
    const ackResult = sendBrevoEmail(
      config.brevoApiKey,
      email,
      name,
      'Thank you for your interest, ' + name + '!',
      getLeadAcknowledgmentEmail(name, area, price),
      config.agentName || 'PropCRM',
      config.agentEmail
    );
    emailSent = ackResult.success;

    // Update emailSentToLead flag
    if (emailSent) {
      updateLeadField(id, 9, true); // Column J (index 9, 0-based → column 10)
    }

    // Send notification to agent
    if (config.agentEmail) {
      sendBrevoEmail(
        config.brevoApiKey,
        config.agentEmail,
        config.agentName,
        '🏠 New Lead: ' + name + ' — ' + formatPrice(price) + ' in ' + area,
        getAgentNotificationEmail(name, email, area, price),
        'PropCRM Notifications',
        config.agentEmail
      );
    }
  }

  return jsonResponse({
    success: true,
    id: id,
    message: 'Lead saved successfully',
    emailSent: emailSent,
  });
}

// ── Handler: Verify PIN ────────────────────────────────────────
function handleVerifyPin(data) {
  const config = getAgentConfig();
  const inputPin = String(data.pin || '');

  if (inputPin === config.dashboardPin) {
    return jsonResponse({ success: true, agentName: config.agentName });
  } else {
    return jsonResponse({ success: false, error: 'Invalid PIN' });
  }
}

// ── Handler: Update Contacted ──────────────────────────────────
function handleUpdateContacted(data) {
  const config = getAgentConfig();
  if (String(data.pin) !== config.dashboardPin) {
    return jsonResponse({ success: false, error: 'Unauthorized' });
  }

  const sheet = getLeadsSheet();
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();

  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === data.id) {
      const row = i + 1; // Sheet rows are 1-indexed
      const contacted = data.contacted === true || data.contacted === 'true';
      sheet.getRange(row, 8).setValue(contacted); // Column H: contacted
      sheet.getRange(row, 9).setValue(contacted ? new Date() : ''); // Column I: contactedAt
      return jsonResponse({ success: true });
    }
  }

  return jsonResponse({ success: false, error: 'Lead not found' });
}

// ── Handler: Send Email to Lead ────────────────────────────────
function handleSendEmailToLead(data) {
  const config = getAgentConfig();
  if (String(data.pin) !== config.dashboardPin) {
    return jsonResponse({ success: false, error: 'Unauthorized' });
  }

  if (!config.brevoApiKey) {
    return jsonResponse({ success: false, error: 'Brevo API key not configured' });
  }

  const sheet = getLeadsSheet();
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();

  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === data.id) {
      const leadName = values[i][1];
      const leadEmail = values[i][2];
      const area = values[i][3];
      const price = values[i][4];

      const result = sendBrevoEmail(
        config.brevoApiKey,
        leadEmail,
        leadName,
        'Regarding your property inquiry — ' + config.agentName,
        getFollowUpEmail(leadName, area, price, config.agentName),
        config.agentName || 'PropCRM',
        config.agentEmail
      );

      return jsonResponse({
        success: result.success,
        message: result.success ? 'Email sent successfully' : 'Failed to send email',
        error: result.error || null,
      });
    }
  }

  return jsonResponse({ success: false, error: 'Lead not found' });
}

// ── Handler: Get Leads (Dashboard) ─────────────────────────────
function handleGetLeads(pin) {
  const config = getAgentConfig();
  if (String(pin) !== config.dashboardPin) {
    return jsonResponse({ success: false, error: 'Unauthorized' });
  }

  const sheet = getLeadsSheet();
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();

  const leads = [];
  const priceBrackets = {};
  const areaCounts = {};
  let totalPrice = 0;
  let contactedCount = 0;

  // Define all brackets so chart always shows all
  const allBrackets = ['Under 25L', '25L - 50L', '50L - 1Cr', '1Cr - 2Cr', '2Cr - 5Cr', '5Cr+'];
  allBrackets.forEach(function (b) { priceBrackets[b] = 0; });

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const lead = {
      id: row[0],
      name: row[1],
      email: row[2],
      area: row[3],
      price: row[4],
      priceBracket: row[5],
      submittedAt: row[6] instanceof Date ? row[6].toISOString() : row[6],
      contacted: row[7] === true || row[7] === 'TRUE',
      contactedAt: row[8] instanceof Date ? row[8].toISOString() : row[8],
      emailSentToLead: row[9] === true || row[9] === 'TRUE',
      reminderSentToAgent: row[10] === true || row[10] === 'TRUE',
    };

    leads.push(lead);
    totalPrice += Number(lead.price) || 0;

    if (lead.contacted) contactedCount++;

    // Price bracket aggregation
    if (priceBrackets.hasOwnProperty(lead.priceBracket)) {
      priceBrackets[lead.priceBracket]++;
    }

    // Area aggregation (case-insensitive)
    const areaKey = String(lead.area).trim().toLowerCase();
    if (areaKey) {
      areaCounts[areaKey] = (areaCounts[areaKey] || 0) + 1;
    }
  }

  const totalLeads = leads.length;
  const stats = {
    totalLeads: totalLeads,
    contactedCount: contactedCount,
    uncontactedCount: totalLeads - contactedCount,
    contactedPercent: totalLeads > 0 ? Math.round((contactedCount / totalLeads) * 100 * 10) / 10 : 0,
    averagePrice: totalLeads > 0 ? Math.round(totalPrice / totalLeads) : 0,
  };

  // Sort area counts descending and capitalize
  const sortedAreas = {};
  Object.keys(areaCounts)
    .sort(function (a, b) { return areaCounts[b] - areaCounts[a]; })
    .forEach(function (key) {
      // Capitalize first letter of each word
      const capitalized = key.replace(/\b\w/g, function (l) { return l.toUpperCase(); });
      sortedAreas[capitalized] = areaCounts[key];
    });

  return jsonResponse({
    success: true,
    leads: leads,
    stats: stats,
    priceBrackets: priceBrackets,
    areaCounts: sortedAreas,
  });
}

// ── Helper: Update Single Lead Field ───────────────────────────
function updateLeadField(leadId, colIndex, value) {
  const sheet = getLeadsSheet();
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();

  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === leadId) {
      sheet.getRange(i + 1, colIndex + 1).setValue(value);
      return;
    }
  }
}

// ── Scheduled Trigger: Check Uncontacted Leads ─────────────────
// Set up as a time-driven trigger: every 1 hour
function checkUncontactedLeads() {
  const config = getAgentConfig();
  if (!config.brevoApiKey || !config.agentEmail) {
    Logger.log('Reminder skipped: Brevo key or agent email not configured');
    return;
  }

  const sheet = getLeadsSheet();
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();
  const now = new Date();
  const reminderThresholdMs = config.reminderHours * 60 * 60 * 1000;

  let remindersSent = 0;

  for (let i = 1; i < values.length; i++) {
    const contacted = values[i][7] === true || values[i][7] === 'TRUE';
    const reminderSent = values[i][10] === true || values[i][10] === 'TRUE';

    if (!contacted && !reminderSent) {
      const submittedAt = values[i][6];
      if (submittedAt instanceof Date) {
        const ageMs = now.getTime() - submittedAt.getTime();

        if (ageMs > reminderThresholdMs) {
          const leadName = values[i][1];
          const leadEmail = values[i][2];
          const area = values[i][3];
          const price = values[i][4];
          const hoursAgo = Math.round(ageMs / (60 * 60 * 1000));

          // Send reminder email
          const result = sendBrevoEmail(
            config.brevoApiKey,
            config.agentEmail,
            config.agentName,
            '⏰ Reminder: ' + leadName + ' hasn\'t been contacted yet',
            getAgentReminderEmail(leadName, leadEmail, area, price, hoursAgo),
            'PropCRM Reminders',
            config.agentEmail
          );

          if (result.success) {
            // Mark reminder as sent
            sheet.getRange(i + 1, 11).setValue(true); // Column K: reminderSentToAgent
            remindersSent++;
          }
        }
      }
    }
  }

  Logger.log('Reminder check complete. Reminders sent: ' + remindersSent);
}

// ── Helper: JSON Response ──────────────────────────────────────
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Setup: Create Sheets Structure ─────────────────────────────
// Run this once to set up the sheet headers
function setupSheets() {
  const ss = getSpreadsheet();

  // Leads sheet
  let leadsSheet = ss.getSheetByName(LEADS_SHEET_NAME);
  if (!leadsSheet) {
    leadsSheet = ss.insertSheet(LEADS_SHEET_NAME);
  }
  leadsSheet.getRange('A1:K1').setValues([[
    'ID', 'Name', 'Email', 'Area', 'Price', 'Price Bracket',
    'Submitted At', 'Contacted', 'Contacted At', 'Email Sent', 'Reminder Sent'
  ]]);
  leadsSheet.getRange('A1:K1').setFontWeight('bold');
  leadsSheet.setFrozenRows(1);

  // AgentConfig sheet
  let configSheet = ss.getSheetByName(CONFIG_SHEET_NAME);
  if (!configSheet) {
    configSheet = ss.insertSheet(CONFIG_SHEET_NAME);
  }
  configSheet.getRange('A1:E1').setValues([[
    'Agent Name', 'Agent Email', 'Brevo API Key', 'Dashboard PIN', 'Reminder Hours'
  ]]);
  configSheet.getRange('A1:E1').setFontWeight('bold');

  // Set default values if row 2 is empty
  const existingData = configSheet.getRange('A2').getValue();
  if (!existingData) {
    configSheet.getRange('A2:E2').setValues([[
      'Your Name', 'your.email@example.com', '', '1234', 1
    ]]);
  }

  Logger.log('Sheets setup complete!');
}
