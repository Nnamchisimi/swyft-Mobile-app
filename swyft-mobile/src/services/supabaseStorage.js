import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_BUCKET } from '../constants/config';

const base64ToUint8Array = (b64) => {
  const clean = b64.indexOf(',') >= 0 ? b64.split(',')[1] : b64.replace(/=+$/, '');
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const map = {};
  for (let i = 0; i < chars.length; i++) map[chars[i]] = i;

  const len = clean.length;
  const bytes = new Uint8Array(Math.floor((len * 3) / 4));
  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const e1 = map[clean[i]] || 0;
    const e2 = map[clean[i + 1]] || 0;
    const e3 = map[clean[i + 2]] || 0;
    const e4 = map[clean[i + 3]] || 0;
    bytes[p++] = (e1 << 2) | (e2 >> 4);
    if (clean[i + 2] !== undefined) bytes[p++] = ((e2 & 15) << 4) | (e3 >> 2);
    if (clean[i + 3] !== undefined) bytes[p++] = ((e3 & 3) << 6) | e4;
  }
  return bytes;
};

export const uploadDriverImage = async (base64, path, bucket = SUPABASE_BUCKET) => {
  const bytes = base64ToUint8Array(base64);

  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'apikey': SUPABASE_ANON_KEY,
      'Content-Type': 'image/jpeg',
      'x-upsert': 'true',
      'Cache-Control': '3600',
    },
    body: bytes,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Upload failed (${res.status}): ${text}`);
  }

  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
};

export const uploadBase64AsDataUri = (base64) => `data:image/jpeg;base64,${base64}`;
