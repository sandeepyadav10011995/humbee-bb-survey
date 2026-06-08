const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

const dbPath = path.resolve(__dirname, process.env.DATABASE_FILE || 'leads.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to SQLite database:', err.message);
  } else {
    console.log(`Connected to SQLite database at: ${dbPath}`);
  }
});

// Initialize database tables
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS Lead_Profile (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      company_name TEXT NOT NULL,
      mobile_number TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      profile_type TEXT NOT NULL,
      industry TEXT NOT NULL,
      preferred_followup TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('Error creating Lead_Profile table:', err.message);
    } else {
      console.log('Lead_Profile table verified/created.');
    }
  });

  // Create indexes for faster queries and duplicate checks
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_mobile ON Lead_Profile(mobile_number)`);
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_email ON Lead_Profile(email)`);
});

module.exports = {
  db,
  
  // Helper to run query and return Promise for single row
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },

  // Helper to run query and return Promise for all rows
  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },

  // Helper to execute query (insert, update, delete)
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }
};
