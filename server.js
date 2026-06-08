const express = require('express');
const cors = require('cors');
const path = require('path');
const dbHelper = require('./database');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// List of connected SSE clients for real-time notifications
let sseClients = [];

// SSE endpoint for live dashboard notifications
app.get('/api/notifications/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders(); // Establish connection

  const clientId = Date.now();
  const newClient = { id: clientId, res };
  sseClients.push(newClient);
  console.log(`SSE Client connected: ${clientId}. Total: ${sseClients.length}`);

  req.on('close', () => {
    sseClients = sseClients.filter(c => c.id !== clientId);
    console.log(`SSE Client disconnected: ${clientId}. Total: ${sseClients.length}`);
  });
});

// Broadcast helper for SSE
function broadcastNotification(data) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach(client => client.res.write(payload));
}

// ----------------------------------------------------
// REST ENDPOINTS
// ----------------------------------------------------

/**
 * POST /api/profile
 * Create a new lead profile. Returns 400 on validation failure, 409 on duplicate, 201 on success.
 */
app.post('/api/profile', async (req, res) => {
  const {
    name,
    company_name,
    mobile_number,
    email,
    profile_type,
    industry,
    preferred_followup
  } = req.body;

  // 1. Validation
  if (!name || name.trim().length < 3) {
    return res.status(400).json({ error: 'Name is mandatory and must be at least 3 characters.' });
  }
  if (!company_name || company_name.trim().length === 0) {
    return res.status(400).json({ error: 'Company Name is mandatory.' });
  }
  
  // Clean mobile and email
  const cleanMobile = mobile_number ? mobile_number.trim() : '';
  const cleanEmail = email ? email.trim() : '';

  // Validate 10-digit Indian Mobile number
  // Format matches standard 10 digit starting with 6-9
  const mobileRegex = /^[6-9]\d{9}$/;
  if (!mobileRegex.test(cleanMobile)) {
    return res.status(400).json({ error: 'Please enter a valid 10-digit Indian mobile number.' });
  }

  // Validate Email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleanEmail)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  // Validate dropdown lists
  const validProfiles = ['Builder', 'Contractor', 'Architect', 'Dealer', 'Consultant', 'Sub Dealer', 'Company Representative'];
  const validIndustries = ['Cement', 'Steel', 'Tiles', 'Sanitary Ware'];
  const validFollowups = ['Call', 'Email', 'WhatsApp'];

  // profile_type and preferred_followup support comma-separated multi-select
  const profileTypes = profile_type ? profile_type.split(',').map(s => s.trim()) : [];
  if (profileTypes.length === 0 || !profileTypes.every(p => validProfiles.includes(p))) {
    return res.status(400).json({ error: 'Invalid profile selection.' });
  }
  if (!validIndustries.includes(industry)) {
    return res.status(400).json({ error: 'Invalid industry selection.' });
  }
  const followupTypes = preferred_followup ? preferred_followup.split(',').map(s => s.trim()) : [];
  if (followupTypes.length === 0 || !followupTypes.every(f => validFollowups.includes(f))) {
    return res.status(400).json({ error: 'Invalid follow-up selection.' });
  }

  try {
    // 2. Duplicate Check
    const existingMobile = await dbHelper.get(
      'SELECT id FROM Lead_Profile WHERE mobile_number = ?',
      [cleanMobile]
    );
    if (existingMobile) {
      return res.status(409).json({ error: 'duplicate_mobile', message: 'Mobile number has already been registered.' });
    }

    const existingEmail = await dbHelper.get(
      'SELECT id FROM Lead_Profile WHERE email = ?',
      [cleanEmail]
    );
    if (existingEmail) {
      return res.status(409).json({ error: 'duplicate_email', message: 'Email address has already been registered.' });
    }

    // 3. Insert lead
    // Save locally using ISO format (or default trigger will save sqlite time)
    // We let SQL default CURRENT_TIMESTAMP run, or we can use custom timezone string
    const result = await dbHelper.run(
      `INSERT INTO Lead_Profile (name, company_name, mobile_number, email, profile_type, industry, preferred_followup)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name.trim(), company_name.trim(), cleanMobile, cleanEmail, profile_type, industry, preferred_followup]
    );

    const newLead = {
      id: result.id,
      name: name.trim(),
      company_name: company_name.trim(),
      mobile_number: cleanMobile,
      email: cleanEmail,
      profile_type,
      industry,
      preferred_followup,
      created_at: new Date().toISOString()
    };

    // 4. Trigger Real-time SSE Notification
    broadcastNotification({
      type: 'NEW_LEAD',
      lead: newLead,
      timestamp: new Date().toISOString()
    });

    return res.status(201).json({ success: true, lead: newLead });

  } catch (err) {
    console.error('Error saving profile:', err.message);
    return res.status(500).json({ error: 'Database error while saving profile.' });
  }
});

/**
 * GET /api/dashboard
 * Return core dashboard KPIs: Total, Today, Week, Month, Unique Companies, Velocity, and Follow-up splits.
 */
app.get('/api/dashboard', async (req, res) => {
  try {
    const totalRow = await dbHelper.get('SELECT COUNT(*) AS count FROM Lead_Profile');
    const todayRow = await dbHelper.get(
      "SELECT COUNT(*) AS count FROM Lead_Profile WHERE date(created_at) = date('now', 'localtime')"
    );
    const weekRow = await dbHelper.get(
      "SELECT COUNT(*) AS count FROM Lead_Profile WHERE created_at >= date('now', '-7 days')"
    );
    const monthRow = await dbHelper.get(
      "SELECT COUNT(*) AS count FROM Lead_Profile WHERE created_at >= date('now', '-30 days')"
    );
    const uniqueCompanyRow = await dbHelper.get(
      'SELECT COUNT(DISTINCT company_name) AS count FROM Lead_Profile'
    );
    
    // Follow-up distribution for percentages
    const followupsList = await dbHelper.all(
      'SELECT preferred_followup, COUNT(*) AS count FROM Lead_Profile GROUP BY preferred_followup'
    );
    
    // Conversion Velocity Calculation: Leads per hour over the active period
    const timeBoundRow = await dbHelper.get(
      'SELECT MIN(created_at) AS min_t, MAX(created_at) AS max_t FROM Lead_Profile'
    );
    
    let velocity = 0;
    const totalLeads = totalRow.count;
    
    if (totalLeads > 0 && timeBoundRow.min_t && timeBoundRow.max_t) {
      // Parse sqlite timestamp strings into JS Dates (sqlite format is YYYY-MM-DD HH:MM:SS)
      const minDate = new Date(timeBoundRow.min_t.replace(' ', 'T') + 'Z');
      const maxDate = new Date(timeBoundRow.max_t.replace(' ', 'T') + 'Z');
      const diffMs = maxDate - minDate;
      const diffHours = diffMs / (1000 * 60 * 60);
      
      // If the difference is negligible, treat as 1 hour
      const activeHours = Math.max(1, diffHours);
      velocity = parseFloat((totalLeads / activeHours).toFixed(2));
    }

    // Initialize follow-up splits
    let whatsappPct = 0;
    let callPct = 0;
    let emailPct = 0;
    
    if (totalLeads > 0) {
      followupsList.forEach(item => {
        const pct = parseFloat(((item.count / totalLeads) * 100).toFixed(1));
        if (item.preferred_followup === 'WhatsApp') whatsappPct = pct;
        else if (item.preferred_followup === 'Call') callPct = pct;
        else if (item.preferred_followup === 'Email') emailPct = pct;
      });
    }

    res.json({
      total_leads: totalLeads,
      today_leads: todayRow.count,
      week_leads: weekRow.count,
      month_leads: monthRow.count,
      unique_companies: uniqueCompanyRow.count,
      conversion_velocity: velocity,
      followup_split: {
        whatsapp: whatsappPct,
        call: callPct,
        email: emailPct
      }
    });

  } catch (err) {
    console.error('Error fetching dashboard stats:', err.message);
    res.status(500).json({ error: 'Database error while gathering dashboard stats.' });
  }
});

/**
 * GET /api/leads
 * Return list of leads with pagination, filtering, searching, and sorting.
 */
app.get('/api/leads', async (req, res) => {
  const {
    search,
    profile_type,
    industry,
    preferred_followup,
    date_start,
    date_end,
    sort_by = 'created_at',
    order = 'DESC'
  } = req.query;

  // Build SQL query dynamically
  let query = 'SELECT * FROM Lead_Profile WHERE 1=1';
  const params = [];

  if (search && search.trim() !== '') {
    query += ' AND (name LIKE ? OR company_name LIKE ? OR email LIKE ? OR mobile_number LIKE ?)';
    const searchParam = `%${search.trim()}%`;
    params.push(searchParam, searchParam, searchParam, searchParam);
  }

  if (profile_type) {
    query += ' AND profile_type LIKE ?';
    params.push(`%${profile_type}%`);
  }

  if (industry) {
    query += ' AND industry = ?';
    params.push(industry);
  }

  if (preferred_followup) {
    query += ' AND preferred_followup LIKE ?';
    params.push(`%${preferred_followup}%`);
  }

  if (date_start) {
    query += ' AND date(created_at) >= date(?)';
    params.push(date_start);
  }

  if (date_end) {
    query += ' AND date(created_at) <= date(?)';
    params.push(date_end);
  }

  // Safety whitelist for sorting column to prevent SQL Injection
  const allowedSortCols = ['id', 'name', 'company_name', 'mobile_number', 'email', 'profile_type', 'industry', 'preferred_followup', 'created_at'];
  const sortCol = allowedSortCols.includes(sort_by) ? sort_by : 'created_at';
  const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  query += ` ORDER BY ${sortCol} ${sortOrder}`;

  try {
    const leads = await dbHelper.all(query, params);
    res.json(leads);
  } catch (err) {
    console.error('Error fetching leads list:', err.message);
    res.status(500).json({ error: 'Database error while listing leads.' });
  }
});

/**
 * GET /api/analytics
 * Return aggregated data for charts.
 */
app.get('/api/analytics', async (req, res) => {
  try {
    // 1. Profile Distribution (Builder, Contractor, etc.)
    const profileDist = await dbHelper.all(
      'SELECT profile_type, COUNT(*) AS count FROM Lead_Profile GROUP BY profile_type ORDER BY count DESC'
    );

    // 2. Industry Distribution (Cement, Steel, Tiles, Sanitary Ware)
    const industryDist = await dbHelper.all(
      'SELECT industry, COUNT(*) AS count FROM Lead_Profile GROUP BY industry ORDER BY count DESC'
    );

    // 3. Follow-up Preference Distribution
    const followupDist = await dbHelper.all(
      'SELECT preferred_followup, COUNT(*) AS count FROM Lead_Profile GROUP BY preferred_followup ORDER BY count DESC'
    );

    // 4. Daily lead trend (Last 30 days)
    const dailyTrend = await dbHelper.all(
      `SELECT date(created_at) AS date_str, COUNT(*) AS count 
       FROM Lead_Profile 
       GROUP BY date_str 
       ORDER BY date_str ASC`
    );

    // 5. Hourly lead trend (consolidated across event hours)
    const hourlyTrend = await dbHelper.all(
      `SELECT strftime('%H:00', created_at) AS hour_str, COUNT(*) AS count 
       FROM Lead_Profile 
       GROUP BY hour_str 
       ORDER BY hour_str ASC`
    );

    // 6. Top Companies Table (Limit 10)
    const topCompanies = await dbHelper.all(
      `SELECT company_name, COUNT(*) AS count 
       FROM Lead_Profile 
       GROUP BY company_name 
       ORDER BY count DESC, company_name ASC 
       LIMIT 10`
    );

    res.json({
      profile_dist: profileDist,
      industry_dist: industryDist,
      followup_dist: followupDist,
      daily_trend: dailyTrend,
      hourly_trend: hourlyTrend,
      top_companies: topCompanies
    });

  } catch (err) {
    console.error('Error fetching analytics:', err.message);
    res.status(500).json({ error: 'Database error while gathering analytics data.' });
  }
});

/**
 * GET /api/event-closure
 * Get summary metrics for the Event Closure Report
 */
app.get('/api/event-closure', async (req, res) => {
  try {
    // Total Leads
    const totalRow = await dbHelper.get('SELECT COUNT(*) AS count FROM Lead_Profile');
    // Unique Companies
    const uniqueCompanyRow = await dbHelper.get('SELECT COUNT(DISTINCT company_name) AS count FROM Lead_Profile');
    
    // Top Industry
    const topIndustryRow = await dbHelper.get(
      'SELECT industry, COUNT(*) AS count FROM Lead_Profile GROUP BY industry ORDER BY count DESC LIMIT 1'
    );

    // Top Profile Category
    const topProfileRow = await dbHelper.get(
      'SELECT profile_type, COUNT(*) AS count FROM Lead_Profile GROUP BY profile_type ORDER BY count DESC LIMIT 1'
    );

    // Top Followup preference
    const topFollowupRow = await dbHelper.get(
      'SELECT preferred_followup, COUNT(*) AS count FROM Lead_Profile GROUP BY preferred_followup ORDER BY count DESC LIMIT 1'
    );

    res.json({
      total_leads: totalRow.count,
      unique_companies: uniqueCompanyRow.count,
      top_industry: topIndustryRow ? topIndustryRow.industry : 'N/A',
      top_industry_count: topIndustryRow ? topIndustryRow.count : 0,
      top_profile: topProfileRow ? topProfileRow.profile_type : 'N/A',
      top_profile_count: topProfileRow ? topProfileRow.count : 0,
      top_followup: topFollowupRow ? topFollowupRow.preferred_followup : 'N/A',
      top_followup_count: topFollowupRow ? topFollowupRow.count : 0
    });

  } catch (err) {
    console.error('Error calculating closure metrics:', err.message);
    res.status(500).json({ error: 'Database error while generating event closure data.' });
  }
});

// Serve frontend routing for clean index
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`========================================================`);
  console.log(`  HUMBEE Partner Profiler Backend Running!     `);
  console.log(`  Local URL: http://localhost:${PORT}                   `);
  console.log(`========================================================`);
});
