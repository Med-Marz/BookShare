import axios from './axios';

// GET /api/v1/notifications?limit=...&since=...
export async function listNotifications(params = {}) {
  const res = await axios.get('/api/v1/notifications', { params });
  return res.data.notifications;
}

// POST /api/v1/notifications/:id/read
export async function markNotificationRead(id) {
  const res = await axios.post(`/api/v1/notifications/${id}/read`);
  return res.data.notification;
}

// POST /api/v1/notifications/mark-all-read — bulk; returns the updated count.
export async function markAllNotificationsRead() {
  const res = await axios.post('/api/v1/notifications/mark-all-read');
  return res.data.updated_count;
}

// GET /api/v1/notifications/unread-count — used by the navbar badge.
export async function getUnreadCount() {
  const res = await axios.get('/api/v1/notifications/unread-count');
  return res.data.count;
}
