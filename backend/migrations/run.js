'use strict';

const fs = require('fs');
const path = require('path');

// Support both dev (migrations/run.js → src/config/database) 
// and packaged Electron (where __dirname may be inside ASAR)
const dbPath = path.resolve(__dirname, '../src/config/database');
const { getPool } = require(dbPath);

async function runMigrations() {
  console.log('Starting database migrations...');
  const pool = getPool();

  try {
    const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.sql')).sort();

    for (const file of files) {
      const filePath = path.join(__dirname, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      console.log(`Executing ${file}...`);
      // Use exec for DDL statements — split by semicolons and run each safely
      const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
      for (const stmt of statements) {
        try {
          pool.exec(stmt + ';');
        } catch (err) {
          // Ignore "already exists" errors — migrations are idempotent
          if (!err.message.includes('already exists') && !err.message.includes('duplicate column')) {
            console.warn(`Migration warning in ${file}: ${err.message}`);
          }
        }
      }
    }

    console.log('Migrations completed successfully!');
  } catch (err) {
    console.error('Migration failed:', err);
    throw err;
  }
}

module.exports = runMigrations;
