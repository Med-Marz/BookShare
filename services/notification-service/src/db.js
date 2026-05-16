const path = require('node:path');
const fs = require('node:fs');
const sqlite3 = require('sqlite3').verbose();

let db;

function resolveDbPath() {
  const target = process.env.NOTIFICATION_DB_PATH || '/app/data/notification.sqlite';
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
          `CREATE TABLE IF NOT EXISTS notifications (
             id                  TEXT PRIMARY KEY,
             event_id            TEXT NOT NULL UNIQUE,
             topic               TEXT NOT NULL,
             recipient_actor_id  TEXT NOT NULL,
             actor_id            TEXT NOT NULL,
             book_id             TEXT NOT NULL,
             reservation_id      TEXT NOT NULL,
             message             TEXT NOT NULL,
             occurred_at         TEXT NOT NULL,
             created_at          TEXT NOT NULL,
             read_at             TEXT
           )`,
        );
        db.run(
          `CREATE INDEX IF NOT EXISTS idx_notif_recipient_time
             ON notifications(recipient_actor_id, occurred_at DESC)`,
        );
        // Partial index for the unread badge — limits scan to unread rows.
        db.run(
          `CREATE INDEX IF NOT EXISTS idx_notif_recipient_unread
             ON notifications(recipient_actor_id)
             WHERE read_at IS NULL`,
          (err2) => {
            if (err2) return reject(err2);
            resolve({ dbPath });
          },
        );
      });
    });
  });
}

function row2notification(row) {
  if (!row) return null;
  return {
    id: row.id,
    event_id: row.event_id,
    topic: row.topic,
    recipient_actor_id: row.recipient_actor_id,
    actor_id: row.actor_id,
    book_id: row.book_id,
    reservation_id: row.reservation_id,
    message: row.message,
    occurred_at: row.occurred_at,
    created_at: row.created_at,
    read_at: row.read_at || '',
  };
}

function insertNotification(row) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO notifications
         (id, event_id, topic, recipient_actor_id, actor_id,
          book_id, reservation_id, message, occurred_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.event_id,
        row.topic,
        row.recipient_actor_id,
        row.actor_id,
        row.book_id,
        row.reservation_id,
        row.message,
        row.occurred_at,
        row.created_at,
      ],
      (err) => {
        if (err) {
          // Re-tag UNIQUE-constraint failures so callers can skip duplicates
          // without coupling to the raw sqlite error string.
          if (
            String(err.message || '').includes('UNIQUE') &&
            String(err.message || '').includes('event_id')
          ) {
            const dup = new Error('duplicate event_id');
            dup.code = 'DUPLICATE_EVENT';
            return reject(dup);
          }
          return reject(err);
        }
        getNotification(row.id).then(resolve).catch(reject);
      },
    );
  });
}

function getNotification(id) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM notifications WHERE id = ?`, [id], (err, row) => {
      if (err) return reject(err);
      resolve(row2notification(row));
    });
  });
}

function listByRecipient({ recipient_actor_id, limit, since }) {
  const clampedLimit = Math.max(1, Math.min(100, Number.parseInt(limit, 10) || 20));
  const sinceParam = since && since.length > 0 ? since : null;
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM notifications
        WHERE recipient_actor_id = ?
          AND (? IS NULL OR occurred_at > ?)
        ORDER BY occurred_at DESC
        LIMIT ?`,
      [recipient_actor_id, sinceParam, sinceParam, clampedLimit],
      (err, rows) => {
        if (err) return reject(err);
        resolve((rows || []).map(row2notification));
      },
    );
  });
}

function markRead(id) {
  const now = new Date().toISOString();
  return new Promise((resolve, reject) => {
    // Only set read_at if currently NULL; idempotent on a second call.
    db.run(
      `UPDATE notifications SET read_at = ? WHERE id = ? AND read_at IS NULL`,
      [now, id],
      function (err) {
        if (err) return reject(err);
        getNotification(id).then(resolve).catch(reject);
      },
    );
  });
}

function markAllReadByRecipient(recipient_actor_id) {
  const now = new Date().toISOString();
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE notifications
          SET read_at = ?
        WHERE recipient_actor_id = ? AND read_at IS NULL`,
      [now, recipient_actor_id],
      function (err) {
        if (err) return reject(err);
        resolve(this.changes || 0);
      },
    );
  });
}

function countUnread(recipient_actor_id) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT COUNT(*) AS n FROM notifications
        WHERE recipient_actor_id = ? AND read_at IS NULL`,
      [recipient_actor_id],
      (err, row) => {
        if (err) return reject(err);
        resolve(row?.n ?? 0);
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

module.exports = {
  init,
  insertNotification,
  getNotification,
  listByRecipient,
  markRead,
  markAllReadByRecipient,
  countUnread,
  close,
};
