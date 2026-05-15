// Build the public URL for a cover-image object key. The gateway proxies
// MinIO so the bucket itself stays unreachable from the browser.
// Defaults to localhost:4000 so dev runs at localhost:5173 work without an
// apps/web/.env override — same fallback pattern axios.js uses for REST calls.
export function coverUrl(objectKey) {
  const base = import.meta.env.VITE_GATEWAY_URL || 'http://localhost:4000';
  return `${base}/api/v1/covers/${objectKey}`;
}
