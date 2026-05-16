const fs = require('node:fs/promises');
const path = require('node:path');
const { createRxDatabase, addRxPlugin } = require('rxdb');
const { getRxStorageMemory } = require('rxdb/plugins/storage-memory');
const { wrappedValidateAjvStorage } = require('rxdb/plugins/validate-ajv');
const { RxDBJsonDumpPlugin } = require('rxdb/plugins/json-dump');
const { RxDBMigrationSchemaPlugin } = require('rxdb/plugins/migration-schema');

addRxPlugin(RxDBJsonDumpPlugin);
addRxPlugin(RxDBMigrationSchemaPlugin);

const SNAPSHOT_PATH = process.env.BOOK_SNAPSHOT_PATH || '/app/data/books.snapshot.json';
const DEBOUNCE_MS = 200;

const bookSchema = {
  // Bump on every shape change so RxDB runs the migration below instead of
  // refusing the snapshot (error JD2) and silently starting empty.
  version: 1,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 64 },
    owner_id: { type: 'string', maxLength: 64 },
    title: { type: 'string', maxLength: 300 },
    author: { type: 'string', maxLength: 200 },
    year_published: { type: 'integer', minimum: -3000, maximum: 9999 },
    cover_object_key: { type: 'string', maxLength: 300 },
    status: { type: 'string', enum: ['Available', 'Reserved', 'Lent Out'] },
    created_at: { type: 'string' },
    updated_at: { type: 'string' },
  },
  required: [
    'id',
    'owner_id',
    'title',
    'author',
    'year_published',
    'cover_object_key',
    'status',
    'created_at',
    'updated_at',
  ],
};

let db;
let books;
let saveTimer;

async function init(logger) {
  db = await createRxDatabase({
    name: 'bookshare',
    storage: wrappedValidateAjvStorage({ storage: getRxStorageMemory() }),
  });
  await db.addCollections({
    books: {
      schema: bookSchema,
      // Identity migration — every prior document remains valid under the
      // current schema. Bump `version` and add the next step here when a
      // future change actually transforms shape.
      migrationStrategies: {
        1: (doc) => doc,
      },
    },
  });
  books = db.books;

  // Restore from disk on boot. We DO NOT use importJSON — its strict
  // schemaHash check throws JD2 when the schema shape changes (e.g. lowering
  // year_published.minimum), discarding the entire snapshot. Instead we read
  // the raw docs and bulk-insert them through the live schema; docs that no
  // longer match are skipped with a warn, and everything else survives.
  try {
    const raw = await fs.readFile(SNAPSHOT_PATH, 'utf8');
    const dump = JSON.parse(raw);
    const stored = dump?.collections?.[0]?.docs || [];
    if (stored.length > 0) {
      const result = await books.bulkInsert(stored);
      const restored = result.success?.length ?? stored.length;
      const skipped = result.error?.length ?? 0;
      logger.info(
        { snapshot_path: SNAPSHOT_PATH, restored, skipped },
        'snapshot restored',
      );
      if (skipped > 0) {
        logger.warn(
          { skipped_ids: result.error.map((e) => e.documentId || '<unknown>') },
          'some docs failed to restore',
        );
      }
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      logger.warn({ err }, 'snapshot read failed — starting empty');
    }
  }

  // Persist on every write, debounced.
  books.$.subscribe(() => scheduleSave(logger));

  return { snapshotPath: SNAPSHOT_PATH };
}

function scheduleSave(logger) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    flush(logger).catch((err) => logger.error({ err }, 'snapshot flush failed'));
  }, DEBOUNCE_MS);
}

async function flush(logger) {
  if (!db) return;
  const dump = await db.exportJSON();
  const tmp = `${SNAPSHOT_PATH}.tmp`;
  await fs.mkdir(path.dirname(SNAPSHOT_PATH), { recursive: true });
  await fs.writeFile(tmp, JSON.stringify(dump), 'utf8');
  await fs.rename(tmp, SNAPSHOT_PATH);
  if (logger) logger.debug({ snapshot_path: SNAPSHOT_PATH }, 'snapshot flushed');
}

async function insertBook(row) {
  await books.insert(row);
  return row;
}

async function close(logger) {
  clearTimeout(saveTimer);
  await flush(logger).catch(() => {});
  if (db) await db.close();
}

module.exports = {
  init,
  flush,
  close,
  insertBook,
  get collection() {
    return books;
  },
};
