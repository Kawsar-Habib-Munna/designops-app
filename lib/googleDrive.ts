import { google } from 'googleapis';

// শুধু সার্ভার-সাইড কোডে (API route handler) ইম্পোর্ট করার জন্য — এখানে OAuth
// client secret ও refresh token থাকে, তাই এই ফাইল কখনো 'use client' কম্পোনেন্টে
// ইম্পোর্ট করা যাবে না।
//
// একটা dedicated Google অ্যাকাউন্ট (personal Gmail, Workspace না) ব্যবহার করা
// হয়েছে — সার্ভিস অ্যাকাউন্ট না, কারণ personal Drive-এ সার্ভিস অ্যাকাউন্টের নিজের
// কোনো স্টোরেজ কোটা থাকে না (আপলোড করলেই storageQuotaExceeded এরর দেয়)।
// OAuth refresh token একবার /api/drive-auth/start দিয়ে ম্যানুয়ালি জেনারেট করে
// .env.local-এ বসানো হয়, এরপর সার্ভার নিজে থেকেই access token রিফ্রেশ করে।

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} সেট করা নেই — .env.local দেখুন।`);
  return value;
}

export function getOAuthClient() {
  const clientId = requireEnv('GOOGLE_OAUTH_CLIENT_ID');
  const clientSecret = requireEnv('GOOGLE_OAUTH_CLIENT_SECRET');
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI || 'http://localhost:3000/api/drive-auth/callback';
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function getAuthUrl() {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/drive.file'],
  });
}

export async function exchangeCodeForTokens(code: string) {
  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);
  return tokens;
}

// প্রতিবার নতুন OAuth2Client ইনস্ট্যান্স — refresh token থেকে access token নিজে থেকেই
// রিফ্রেশ হয়, ম্যানুয়ালি কিছু করা লাগে না।
function getAuthorizedClient() {
  const refreshToken = requireEnv('GOOGLE_OAUTH_REFRESH_TOKEN');
  const client = getOAuthClient();
  client.setCredentials({ refresh_token: refreshToken });
  return client;
}

export function getDriveClient() {
  const auth = getAuthorizedClient();
  return { drive: google.drive({ version: 'v3', auth }), auth };
}

export function getUploadFolderId() {
  return requireEnv('GOOGLE_DRIVE_FOLDER_ID');
}
