const express = require('express');

const notificationClient = require('../clients/notificationClient');
const { makeMetadata } = require('../clients/grpcMetadata');

const router = express.Router();

// GET /api/v1/notifications?limit=20&since=<iso>
// The recipient id is ALWAYS taken from the JWT (req.userId) — never from
// the query string — so a signed-in user can only ever see their own
// notifications.
router.get('/', async (req, res, next) => {
  try {
    const limit = Number.parseInt(req.query.limit, 10);
    const since = typeof req.query.since === 'string' ? req.query.since : '';
    const { notifications } = await notificationClient.listNotifications(
      {
        recipient_actor_id: req.userId,
        limit: Number.isFinite(limit) ? limit : 0,
        since,
      },
      makeMetadata(req.userId),
    );
    res.json({ notifications: notifications || [] });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/notifications/unread-count
router.get('/unread-count', async (req, res, next) => {
  try {
    const { count } = await notificationClient.countUnreadNotifications(
      { recipient_actor_id: req.userId },
      makeMetadata(req.userId),
    );
    res.json({ count: count || 0 });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/notifications/mark-all-read — bulk; returns { updated_count }.
router.post('/mark-all-read', async (req, res, next) => {
  try {
    const { updated_count } = await notificationClient.markAllNotificationsRead(
      { requester_id: req.userId },
      makeMetadata(req.userId),
    );
    res.json({ updated_count: updated_count || 0 });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/notifications/:id/read — mark a single notification read.
// Returns 403 if the caller isn't the recipient.
router.post('/:id/read', async (req, res, next) => {
  try {
    const { notification } = await notificationClient.markNotificationRead(
      { notification_id: req.params.id, requester_id: req.userId },
      makeMetadata(req.userId),
    );
    res.json({ notification });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
