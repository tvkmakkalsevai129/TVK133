// /api/upload-media.js
// Serverless API to upload media (images/audio) to Cloudflare R2
const crypto = require('crypto');
const https = require('https');

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || 'bdf08c4132cd5184a3a79f7efb29fdbb';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || '9f71affe9b173aa511234907bbbe56bd';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '0459f66505a4df78deccee09f78a6773b370734e5338abc9f173ebbc629c8fef';
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'tvk';
const R2_PUBLIC_DOMAIN = process.env.R2_PUBLIC_DOMAIN || 'https://pub-e502f5817f674844b0417bb8958b4d87.r2.dev';
const R2_ENDPOINT = `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

function hmac(key, string) {
  return crypto.createHmac('sha256', key).update(string, 'utf8').digest();
}

function hash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

// Upload buffer directly to R2 using AWS SigV4
async function uploadToR2(objectKey, buffer, contentType) {
  return new Promise((resolve, reject) => {
    const region = 'auto';
    const service = 's3';
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.substring(0, 8);

    const canonicalUri = `/${R2_BUCKET_NAME}/${objectKey}`;
    const canonicalQuerystring = '';
    const payloadHash = hash(buffer);
    const canonicalHeaders = `content-type:${contentType}\nhost:${R2_ENDPOINT}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';

    const canonicalRequest = `PUT\n${canonicalUri}\n${canonicalQuerystring}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
    const algorithm = 'AWS4-HMAC-SHA256';
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = `${algorithm}\n${amzDate}\n${credentialScope}\n${hash(Buffer.from(canonicalRequest, 'utf8'))}`;

    const kDate = hmac('AWS4' + R2_SECRET_ACCESS_KEY, dateStamp);
    const kRegion = hmac(kDate, region);
    const kService = hmac(kRegion, service);
    const kSigning = hmac(kService, 'aws4_request');
    const signature = crypto.createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');

    const authorizationHeader = `${algorithm} Credential=${R2_ACCESS_KEY_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const options = {
      hostname: R2_ENDPOINT,
      path: canonicalUri,
      method: 'PUT',
      headers: {
        'Host': R2_ENDPOINT,
        'Content-Type': contentType,
        'Content-Length': buffer.length,
        'x-amz-date': amzDate,
        'x-amz-content-sha256': payloadHash,
        'Authorization': authorizationHeader
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({
            success: true,
            publicUrl: `${R2_PUBLIC_DOMAIN}/${objectKey}`,
            mediaKey: objectKey
          });
        } else {
          reject(new Error(`R2 upload failed (${res.statusCode}): ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(buffer);
    req.end();
  });
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb'
    }
  }
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { base64Data, fileName, contentType, folder } = req.body;
    if (!base64Data) {
      return res.status(400).json({ error: 'Missing base64Data' });
    }

    const buffer = Buffer.from(base64Data, 'base64');
    const ext = fileName ? fileName.split('.').pop() : (contentType === 'image/jpeg' ? 'jpg' : 'png');
    const safeFolder = folder || 'images';
    const timestamp = Date.now();
    const rand = Math.floor(1000 + Math.random() * 9000);
    const objectKey = `${safeFolder}/${timestamp}-${rand}.${ext}`;

    const result = await uploadToR2(objectKey, buffer, contentType || 'image/jpeg');
    return res.status(200).json(result);
  } catch (err) {
    console.error('Upload handler error:', err);
    return res.status(500).json({ error: err.message });
  }
}
