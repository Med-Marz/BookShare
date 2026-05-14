const path = require('node:path');
const fs = require('node:fs');
const sqlite3 = require('sqlite3').verbose();

let db;

// Resolve the SQLite file path, creating any missing parent directories.
function resolveDbPath() {
  const target = process.env.USER_DB_PATH || '/app/data/user.sqlite';
  const dir = path.dirname(target);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return target;
}

// Open the database and ensure the schema exists. Called once at boot.
function init() {
  const dbPath = resolveDbPath();
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) return reject(err);
      db.run(
        `CREATE TABLE IF NOT EXISTS users (
           id            TEXT PRIMARY KEY,
           email         TEXT UNIQUE NOT NULL COLLATE NOCASE,
           password_hash TEXT NOT NULL,
           display_name  TEXT NOT NULL,
           phone         TEXT NOT NULL,
           address       TEXT NOT NULL,
           created_at    TEXT NOT NULL
         )`,
        (tableErr) => {
          if (tableErr) return reject(tableErr);
          resolve({ dbPath });
        },
      );
    });
  });
}

// Look up a user by email (case-insensitive thanks to COLLATE NOCASE).
function getUserByEmail(email) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

// Insert a new user row. The caller is responsible for hashing the password.
function insertUser({ id, email, password_hash, display_name, phone, address, created_at }) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO users (id, email, password_hash, display_name, phone, address, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, email, password_hash, display_name, phone, address, created_at],
      function (err) {
        if (err) return reject(err);
        resolve({ changes: this.changes });
      },
    );
  });
}

function close() {
  return new Promise((resolve, reject) => {
    if (!db) return resolve();
    db.close((err) => (err ? reject(err) : resolve()));
  });
}

module.exports = { init, getUserByEmail, insertUser, close };
