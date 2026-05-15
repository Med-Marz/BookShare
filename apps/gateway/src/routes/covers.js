const express = require('express');
const bookClient = require('../clients/bookClient');

const router = express.Router();
const ONE_DAY_SECONDS = 60 * 60 * 24;

// Express 5 named wildcard — captures every path segment after /covers/ as an
// array (because object keys may include slashes, e.g. "covers/<uuid>.jpg").
// Public route: no JWT required — covers are visible to anonymous viewers.
router.get('/*object_key', async (req, res, next) => {
  const raw = req.params.object_key;
  const objectKey = Array.isArray(raw) ? raw.join('/') : raw;
  const startedAt = Date.now();

  try {
    const { content, content_type } = await bookClient.getCoverBytes({
      object_key: objectKey,
    });
    res.set('Content-Type', content_type || 'application/octet-stream');
    res.set('Cache-Control', `public, max-age=${ONE_DAY_SECONDS}`);
    res.status(200).end(Buffer.from(content));

    if (req.log) {
      req.log.info(
        {
          event: 'cover.served',
          method: 'GET',
          route: '/api/v1/covers/:object_key',
          object_key: objectKey,
          status: 200,
          duration_ms: Date.now() - startedAt,
          bytes: content?.length || 0,
        },
        'cover served',
      );
    }
  } catch (err) {
    if (req.log) {
      // grpc.status.NOT_FOUND === 5
      req.log.warn(
        {
          event: 'cover.miss',
          method: 'GET',
          route: '/api/v1/covers/:object_key',
          object_key: objectKey,
          status: err?.code === 5 ? 404 : 500,
          duration_ms: Date.now() - startedAt,
        },
        'cover lookup failed',
      );
    }
    return next(err);
  }
});

module.exports = router;
