// Stand-in for `workers-og` in Docker/Node builds: workers-og depends on
// Workers-only wasm integrations that cannot run under plain Node. OG image
// routes degrade to a 1x1 transparent PNG instead of crashing the server.
const TRANSPARENT_PNG = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='),
  (c) => c.charCodeAt(0),
);

export class ImageResponse extends Response {
  constructor() {
    super(new Uint8Array(TRANSPARENT_PNG), {
      headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=3600' },
    });
  }
}

export async function loadGoogleFont() {
  return '';
}
