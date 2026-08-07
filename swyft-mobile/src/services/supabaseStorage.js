import { API_URL } from '../constants/config';

export const uploadDriverImage = async (base64, path, bucket = 'casyft') => {
  const res = await fetch(`${API_URL}/api/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ base64, path, bucket }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Upload failed (${res.status}): ${text}`);
  }

  const json = await res.json();
  return json.url;
};

export const uploadBase64AsDataUri = (base64) => `data:image/jpeg;base64,${base64}`;
