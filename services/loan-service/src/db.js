const path = require('node:path');
const fs = require('node:fs');
const sqlite3 = require('sqlite3').verbose();

let db;

function resolveDbPath() {
  const target = process.env.LOAN_DB_PATH || '/app/data/loan.sqlite';
  const dir = path.dirname(target);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return target;
}

function init() {
  const dbPath = resolveDbPath();
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) return reject(err);
      db.serialize(() => {
        db.run(
          `CREATE TABLE IF NOT EXISTS reservations (
             id              TEXT PRIMARY KEY,
             book_id         TEXT NOT NULL,
             owner_id        TEXT NOT NULL,
             borrower_id     TEXT NOT NULL,
             state           TEXT NOT NULL,
             created_at      TEXT NOT NULL,
             loan_started_at TEXT,
             returned_at     TEXT,
             cancelled_at    TEXT
           )`,
        );
        db.run(`CREATE INDEX IF NOT EXISTS idx_reservations_borrower ON reservations(borrower_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_reservations_owner ON reservations(owner_id)`, (err2) => {
          if (err2) return reject(err2);
          resolve({ dbPath });
        });
      });
    });
  });
}

function row2reservation(row) {
  if (!row) return null;
  return {
    id: row.id,
    book_id: row.book_id,
    owner_id: row.owner_id,
    borrower_id: row.borrower_id,
    state: row.state,
    created_at: row.created_at,
    loan_started_at: row.loan_started_at || '',
    returned_at: row.returned_at || '',
    cancelled_at: row.cancelled_at || '',
  };
}

function insertReservation({ id, book_id, owner_id, borrower_id, created_at }) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO reservations (id, book_id, owner_id, borrower_id, state, created_at)
       VALUES (?, ?, ?, ?, 'Active', ?)`,
      [id, book_id, owner_id, borrower_id, created_at],
      (err) => {
        if (err) return reject(err);
        getReservation(id).then(resolve).catch(reject);
      },
    );
  });
}

function getReservation(id) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM reservations WHERE id = ?`, [id], (err, row) => {
      if (err) return reject(err);
      resolve(row2reservation(row));
    });
  });
}

function getActiveReservation({ book_id, borrower_id }) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT * FROM reservations
        WHERE book_id = ? AND borrower_id = ? AND state IN ('Active', 'LoanStarted')
        ORDER BY created_at DESC
        LIMIT 1`,
      [book_id, borrower_id],
      (err, row) => {
        if (err) return reject(err);
        resolve(row2reservation(row));
      },
    );
  });
}

function updateState(id, patch) {
  const sets = ['state = ?'];
  const params = [patch.state];
  if (patch.loan_started_at !== undefined) {
    sets.push('loan_started_at = ?');
    params.push(patch.loan_started_at);
  }
  if (patch.returned_at !== undefined) {
    sets.push('returned_at = ?');
    params.push(patch.returned_at);
  }
  if (patch.cancelled_at !== undefined) {
    sets.push('cancelled_at = ?');
    params.push(patch.cancelled_at);
  }
  params.push(id);
  return new Promise((resolve, reject) => {
    db.run(`UPDATE reservations SET ${sets.join(', ')} WHERE id = ?`, params, function (err) {
      if (err) return reject(err);
      if (this.changes === 0) return resolve(null);
      getReservation(id).then(resolve).catch(reject);
    });
  });
}

function close() {
  return new Promise((resolve, reject) => {
    if (!db) return resolve();
    db.close((err) => (err ? reject(err) : resolve()));
  });
}

module.exports = {
  init,
  insertReservation,
  getReservation,
  getActiveReservation,
  updateState,
  close,
};
