// Build the public URL for a cover-image object key. The gateway proxies
// MinIO so the bucket itself stays unreachable from the browser.
export function coverUrl(objectKey) {
  const base = import.meta.env.VITE_GATEWAY_URL || '';
  return `${base}/api/v1/covers/${objectKey}`;
}
