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

// Look up a user by primary key. Returns null when no row matches.
function getUserById(id) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE id = ?', [id], (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

// Update editable profile fields. Builds the SET clause dynamically so empty
// strings (proto3 "absent" sentinel) leave the column untouched. Returns the
// fresh row, or null if no row matched.
function updateUser({ id, display_name, phone, address }) {
  const sets = [];
  const params = [];
  if (display_name) {
    sets.push('display_name = ?');
    params.push(display_name);
  }
  if (phone) {
    sets.push('phone = ?');
    params.push(phone);
  }
  if (address) {
    sets.push('address = ?');
    params.push(address);
  }
  if (sets.length === 0) {
    // Nothing to update — return the current row unchanged.
    return getUserById(id);
  }
  params.push(id);
  return new Promise((resolve, reject) => {
    db.run(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, params, function (err) {
      if (err) return reject(err);
      if (this.changes === 0) return resolve(null);
      getUserById(id).then(resolve).catch(reject);
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

module.exports = { init, getUserByEmail, getUserById, insertUser, updateUser, close };
