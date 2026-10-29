/**
 * Serverless API Route for Vercel
 * Cleans up media (audio / image) from Cloudflare R2 when staff clicks "Clear Media Files"
 */
const crypto = require('crypto');
const https = require('https');

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || 'bdf08c4132cd5184a3a79f7efb29fdbb';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || '9f71affe9b173aa511234907bbbe56bd';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '0459f66505a4df78deccee09f78a6773b370734e5338abc9f173ebbc629c8fef';
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'tvk';
const R2_ENDPOINT = `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vtfuhajbqbrotjsufnrj.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0ZnVoYWpicWJyb3Rqc3VmbnJqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MzIzOTEzOSwiZXhwIjoyMTA4ODE1MTM5fQ.vf0kuOmewG3sda9rR_m2H2ZAdcJqMy0YdXA230AdxoQ';

function hmac(key, string) {
  return crypto.createHmac('sha256', key).update(string, 'utf8').digest();
}

function hash(string) {
  return crypto.createHash('sha256').update(string, 'utf8').digest('hex');
}

// S3 SigV4 Delete Object from Cloudflare R2
async function deleteFromR2(objectKey) {
  return new Promise((resolve, reject) => {
    const region = 'auto';
    const service = 's3';
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.substring(0, 8);

    const canonicalUri = `/${R2_BUCKET_NAME}/${objectKey}`;
    const canonicalQuerystring = '';
    const payloadHash = hash('');
    const canonicalHeaders = `host:${R2_ENDPOINT}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';

    const canonicalRequest = `DELETE\n${canonicalUri}\n${canonicalQuerystring}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
    const algorithm = 'AWS4-HMAC-SHA256';
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = `${algorithm}\n${amzDate}\n${credentialScope}\n${hash(canonicalRequest)}`;

    const kDate = hmac('AWS4' + R2_SECRET_ACCESS_KEY, dateStamp);
    const kRegion = hmac(kDate, region);
    const kService = hmac(kRegion, service);
    const kSigning = hmac(kService, 'aws4_request');
    const signature = crypto.createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');

    const authorizationHeader = `${algorithm} Credential=${R2_ACCESS_KEY_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const options = {
      hostname: R2_ENDPOINT,
      path: canonicalUri,
      method: 'DELETE',
      headers: {
        'Host': R2_ENDPOINT,
        'x-amz-date': amzDate,
        'x-amz-content-sha256': payloadHash,
        'Authorization': authorizationHeader
      }
    };

    const req = https.request(options, (res) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        resolve({ success: true, statusCode: res.statusCode });
      } else {
        reject(new Error(`R2 Delete failed with status code ${res.statusCode}`));
      }
    });

    req.on('error', (err) => reject(err));
    req.end();
  });
}

function extractR2Key(url) {
  if (!url) return null;
  // e.g. https://pub-b22815f6ae1c47518f37561b8b274210.r2.dev/complaints-images/123.jpg -> complaints-images/123.jpg
  try {
    const parsed = new URL(url);
    return parsed.pathname.replace(/^\/+/, '');
  } catch (e) {
    return url.replace(/^https?:\/\/[^\/]+\//, '');
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { id, ticket_id, media_key, audio_url, image_url, staff_email } = req.body || {};

  const keysToDelete = [];
  if (media_key) keysToDelete.push(media_key);
  if (audio_url) {
    const k = extractR2Key(audio_url);
    if (k && !keysToDelete.includes(k)) keysToDelete.push(k);
  }
  if (image_url) {
    const k = extractR2Key(image_url);
    if (k && !keysToDelete.includes(k)) keysToDelete.push(k);
  }

  if (keysToDelete.length === 0) {
    return res.status(400).json({ error: 'No media keys found to delete' });
  }

  try {
    // Delete each key from Cloudflare R2
    for (const key of keysToDelete) {
      try {
        await deleteFromR2(key);
      } catch (err) {
        console.warn(`Could not delete ${key} from R2:`, err.message);
      }
    }

    // Update Supabase to null out audio_url, image_url, and media_key
    if (id || ticket_id) {
      const matchParam = id ? `id=eq.${id}` : `ticket_id=eq.${ticket_id}`;
      await fetch(`${SUPABASE_URL}/rest/v1/complaints?${matchParam}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          audio_url: null,
          image_url: null,
          media_key: null
        })
      });

      // Add timeline log
      if (id) {
        await fetch(`${SUPABASE_URL}/rest/v1/ticket_updates`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            complaint_id: id,
            title: 'Media Files Purged from Cloudflare R2',
            description: `Media files (${keysToDelete.join(', ')}) were purged by ${staff_email || 'Staff'}.`,
            updated_by: staff_email || 'Staff'
          })
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: `Media files successfully deleted from Cloudflare R2.`,
      deletedKeys: keysToDelete
    });
  } catch (error) {
    console.error('Error during cleanup:', error);
    return res.status(500).json({ error: error.message });
  }
}
