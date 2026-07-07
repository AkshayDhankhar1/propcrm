# PropCRM — Real Estate Lead Management System

A lightweight, zero-cost CRM for independent real estate agents. Capture leads via a beautiful form, manage them on a secure dashboard, and automate email notifications — all powered by Google Sheets and deployed on GitHub Pages.

## 🚀 Quick Start

### Step 1: Create Google Sheet

1. Go to [Google Sheets](https://sheets.google.com) and create a new spreadsheet
2. Note the **Spreadsheet ID** from the URL: `https://docs.google.com/spreadsheets/d/{THIS_IS_YOUR_ID}/edit`

### Step 2: Set Up Google Apps Script

1. In your spreadsheet, go to **Extensions → Apps Script**
2. Delete any existing code in `Code.gs`
3. Copy the contents of `appscript/Code.gs` from this repo and paste it
4. Replace `YOUR_SPREADSHEET_ID_HERE` on line 12 with your actual Spreadsheet ID
5. **Run the `setupSheets` function** once:
   - Click the dropdown next to "Run" and select `setupSheets`
   - Click **Run** → Authorize the script when prompted
   - This creates the "Leads" and "AgentConfig" sheets with proper headers

### Step 3: Configure Agent Settings

1. Go to your Google Sheet → **AgentConfig** tab
2. Fill in Row 2:

| Column A | Column B | Column C | Column D | Column E |
|----------|----------|----------|----------|----------|
| Your Name | your.email@example.com | your-brevo-api-key | 1234 | 1 |

- **Agent Name**: Your display name (used in emails)
- **Agent Email**: Where you'll receive notifications
- **Brevo API Key**: Get one from [Brevo](https://www.brevo.com) (free account → SMTP & API → API Keys)
- **Dashboard PIN**: Your login PIN for the dashboard
- **Reminder Hours**: Hours before sending uncontacted lead reminder (default: 1)

### Step 4: Deploy Apps Script as Web App

1. In Apps Script editor, click **Deploy → New deployment**
2. Click the gear icon → Select **Web app**
3. Set:
   - **Execute as**: Me
   - **Who has access**: Anyone
4. Click **Deploy**
5. Copy the **Web App URL**

### Step 5: Configure Frontend

1. Open `js/config.js`
2. Replace `YOUR_APPS_SCRIPT_WEB_APP_URL_HERE` with your Web App URL

### Step 6: Deploy to GitHub Pages

1. Push this repo to GitHub
2. Go to **Settings → Pages**
3. Set Source to **main** branch, root directory
4. Your CRM is live at `https://yourusername.github.io/reponame/`

### Step 7: Set Up Reminder Trigger

1. In Apps Script, go to **Triggers** (clock icon on the left)
2. Click **+ Add Trigger**
3. Configure:
   - **Function**: `checkUncontactedLeads`
   - **Event source**: Time-driven
   - **Type**: Hour timer
   - **Interval**: Every 1 hour
4. Click **Save**

## 📁 Project Structure

```
├── index.html              ← Lead capture form (public)
├── dashboard.html          ← Agent dashboard (PIN-protected)
├── css/
│   ├── common.css          ← Design system tokens & utilities
│   ├── form.css            ← Form page styles (glassmorphism)
│   └── dashboard.css       ← Dashboard styles (cards, charts, table)
├── js/
│   ├── config.js           ← Apps Script URL configuration
│   ├── form.js             ← Form validation & submission
│   └── dashboard.js        ← Dashboard logic, charts, table
├── appscript/
│   └── Code.gs             ← Google Apps Script backend
├── docs/                   ← PRD, Data Flow, User Flow documents
└── README.md
```

## 🔒 Security Notes

- **Brevo API key** is stored in Google Sheets and accessed only server-side — never exposed in frontend code
- **Dashboard PIN** is verified server-side on every API call
- All communication is over **HTTPS**
- Frontend inputs are sanitized both client-side and server-side

## 📊 Features

- ✅ Lead capture form with glassmorphism design
- ✅ Client + server-side validation
- ✅ Automatic acknowledgment email to leads
- ✅ Instant notification email to agent
- ✅ PIN-protected agent dashboard
- ✅ Price bracket distribution chart (doughnut)
- ✅ Top localities chart (horizontal bar)
- ✅ Real-time contacted status toggle
- ✅ One-click follow-up email to leads
- ✅ Automated reminder for uncontacted leads
- ✅ Responsive design (mobile + desktop)
- ✅ Green gradient chart colors (more concentration → darker green)

## 💰 Cost

**$0/month** — All services used are free tier:
- Google Sheets: Free
- Google Apps Script: Free
- GitHub Pages: Free
- Brevo: Free (300 emails/day)
