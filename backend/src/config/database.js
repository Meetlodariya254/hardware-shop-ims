'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

let db;

function getPool() {
  if (!db) {
    const dbDir = path.join(process.env.APPDATA || process.env.HOME || __dirname, 'HardwareShopIMS');
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    const dbPath = path.join(dbDir, 'ims_database.sqlite');
    
    db = new Database(dbPath);
    
    // Enable WAL mode for better concurrency and set a busy timeout
    db.pragma('journal_mode = WAL');
    db.pragma('busy_timeout = 5000');
    // Enable foreign keys
    db.pragma('foreign_keys = ON');

    console.log(`✅ SQLite Database connected at ${dbPath}`);
  }
  return db;
}

/**
 * Convert PostgreSQL-style SQL to SQLite-compatible SQL
 */
function convertToSQLite(text) {
  let sql = text;

  // 1. Convert PostgreSQL positional parameters $1, $2 to SQLite ?1, ?2
  sql = sql.replace(/\$(\d+)/g, '?$1');

  // 2. Convert ILIKE to LIKE (case-insensitive in SQLite via PRAGMA case_sensitive_like)
  sql = sql.replace(/\bILIKE\b/gi, 'LIKE');

  // 3. Convert NOW() to CURRENT_TIMESTAMP
  sql = sql.replace(/\bNOW\(\)/gi, 'CURRENT_TIMESTAMP');

  // 4. Convert CURRENT_DATE to date('now')
  sql = sql.replace(/\bCURRENT_DATE\b/g, "date('now')");

  // 5. Convert INTERVAL expressions: e.g. INTERVAL '6 days' => '-6 days' for use with date()
  // Pattern: date('now') - INTERVAL 'N unit' => date('now', '-N unit')
  sql = sql.replace(
    /date\('now'\)\s*-\s*INTERVAL\s+'(\d+)\s+(\w+)'/gi,
    (match, n, unit) => `date('now', '-${n} ${unit}')`
  );

  // 6. Convert DATE_TRUNC('month', expr) to strftime('%Y-%m-01', expr)
  sql = sql.replace(/DATE_TRUNC\('month',\s*([^)]+)\)/gi, "strftime('%Y-%m-01', $1)");

  // 7. Convert Postgres cast ::text to nothing (SQLite handles as text natively)
  sql = sql.replace(/::text/gi, '');

  // 8. Convert boolean literals true/false to 1/0 in WHERE clauses
  // Only replace " = true" and " = false" patterns (not inside strings)
  sql = sql.replace(/\s*=\s*true\b/gi, ' = 1');
  sql = sql.replace(/\s*=\s*false\b/gi, ' = 0');

  return sql;
}

/**
 * Emulate pg query function
 */
async function query(text, params = []) {
  const db = getPool();
  const sqliteSql = convertToSQLite(text);

  try {
    const stmt = db.prepare(sqliteSql);

    // Check if it returns data
    const isSelect = /^\s*(SELECT|PRAGMA|EXPLAIN)/i.test(sqliteSql);
    const hasReturning = /\bRETURNING\b/i.test(sqliteSql);

    // better-sqlite3 with ?1, ?2, ... style uses named parameters via object { '1': val, '2': val }
    // Also serialize Date objects to ISO string since SQLite can't bind them natively
    let sqliteParams;
    if (Array.isArray(params)) {
      sqliteParams = {};
      params.forEach((val, idx) => {
        // Normalize undefined to null — better-sqlite3 throws on undefined params
        if (val === undefined) {
          sqliteParams[(idx + 1).toString()] = null;
        } else if (val instanceof Date) {
          // Serialize Date objects to ISO date strings
          sqliteParams[(idx + 1).toString()] = val.toISOString().split('T')[0];
        } else if (typeof val === 'boolean') {
          // Serialize booleans to 0/1 for SQLite
          sqliteParams[(idx + 1).toString()] = val ? 1 : 0;
        } else {
          sqliteParams[(idx + 1).toString()] = val;
        }
      });
    } else {
      sqliteParams = params;
    }

    if (isSelect || hasReturning) {
      const rows = stmt.all(sqliteParams);
      // Normalize count(*) -> count field name to 'count'
      const normalizedRows = rows.map(row => {
        const normalized = {};
        for (const key of Object.keys(row)) {
          normalized[key.toLowerCase() === 'count(*)' ? 'count' : key] = row[key];
        }
        return normalized;
      });
      return { rows: normalizedRows, rowCount: normalizedRows.length };
    } else {
      const info = stmt.run(sqliteParams);
      return { rows: [], rowCount: info.changes };
    }
  } catch (err) {
    console.error('Database query error:', err.message, '\nQuery:', sqliteSql, '\nParams:', params);
    throw err;
  }
}

/**
 * Emulate pg getClient()
 */
async function getClient() {
  return {
    query: async (text, params) => query(text, params),
    release: () => {}
  };
}

/**
 * Emulate pg withTransaction
 */
async function withTransaction(fn) {
  const db = getPool();
  try {
    db.exec('BEGIN IMMEDIATE');
    const client = await getClient();
    const result = await fn(client);
    db.exec('COMMIT');
    return result;
  } catch (err) {
    if (db.inTransaction) {
      db.exec('ROLLBACK');
    }
    throw err;
  }
}

async function testConnection() {
  try {
    getPool();
    const result = await query("SELECT 'SQLite' as db, CURRENT_TIMESTAMP as now");
    console.log(`✅ Database tested: ${result.rows[0].db} at ${result.rows[0].now}`);
    return true;
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
    return false;
  }
}

module.exports = { query, getClient, withTransaction, testConnection, getPool };
