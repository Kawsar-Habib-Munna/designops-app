import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { getDriveClient, getUploadFolderId } from '@/lib/googleDrive';

// শেয়ার্ড টিম হোয়াইটবোর্ডের পুরো ডেটা (tldraw স্ন্যাপশট) Supabase DB-তে না,
// একটাই JSON ফাইলে Google Drive-এ থাকে (app/files-এর মতো একই দেডিকেটেড
// অ্যাকাউন্ট/ফোল্ডার — lib/googleDrive.ts) — অ্যাপের বাকি "আসল ফাইল" কন্টেন্টের
// মতোই। Supabase শুধু request-টা লগইন-করা টিম মেম্বারের কিনা যাচাই করতে
// ব্যবহার হয় (JWT verify), ডেটা রাখার জন্য না।
//
// Drive-এর নিজের "lastModifyingUser" সবসময় আমাদের একই শেয়ার্ড bot অ্যাকাউন্ট
// দেখাবে (আলাদা টিম মেম্বার না), তাই "কে সেভ করেছে" ট্র্যাক করতে updatedBy/
// updatedAt আমরা নিজেরাই ফাইলের content-এর ভেতরে আর Drive-এর "properties"
// (হালকা key-value মেটাডেটা, কন্টেন্ট ডাউনলোড না করেই পড়া যায়) — দুই জায়গাতেই
// সেভ করি, যাতে পোলিং-এর সময় পুরো ফাইল না নামিয়েও "কেউ আপডেট করেছে কিনা"
// সস্তায় চেক করা যায়।

const WHITEBOARD_FILE_NAME = 'flow53-whiteboard-state.json';

async function requireUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

async function findWhiteboardFileId(drive: ReturnType<typeof getDriveClient>['drive'], folderId: string) {
  const res = await drive.files.list({
    q: `name = '${WHITEBOARD_FILE_NAME}' and '${folderId}' in parents and trashed = false`,
    fields: 'files(id)',
    spaces: 'drive',
    pageSize: 1,
  });
  return res.data.files?.[0]?.id ?? null;
}

export async function GET(request: NextRequest) {
  const user = await requireUser(request);
  if (!user) return Response.json({ error: 'লগইন করা নেই।' }, { status: 401 });

  const metaOnly = request.nextUrl.searchParams.get('meta') === '1';

  try {
    const { drive } = getDriveClient();
    const folderId = getUploadFolderId();
    const fileId = await findWhiteboardFileId(drive, folderId);
    if (!fileId) return Response.json({ data: null });

    if (metaOnly) {
      const meta = await drive.files.get({ fileId, fields: 'properties' });
      const props = meta.data.properties ?? {};
      return Response.json({ updatedBy: props.updatedBy ?? null, updatedAt: props.updatedAt ?? null });
    }

    const content = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'json' });
    return Response.json({ data: content.data });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'হোয়াইটবোর্ড লোড করা যায়নি।' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await requireUser(request);
  if (!user) return Response.json({ error: 'লগইন করা নেই।' }, { status: 401 });

  const body = await request.json();
  if (!body?.snapshot) return Response.json({ error: 'snapshot আবশ্যক।' }, { status: 400 });

  const updatedAt = new Date().toISOString();
  const payload = { updatedBy: user.id, updatedAt, snapshot: body.snapshot };
  const properties = { updatedBy: user.id, updatedAt };

  try {
    const { drive } = getDriveClient();
    const folderId = getUploadFolderId();
    const fileId = await findWhiteboardFileId(drive, folderId);
    const media = { mimeType: 'application/json', body: JSON.stringify(payload) };

    if (fileId) {
      await drive.files.update({ fileId, media, requestBody: { properties } });
    } else {
      await drive.files.create({ requestBody: { name: WHITEBOARD_FILE_NAME, parents: [folderId], properties }, media, fields: 'id' });
    }

    return Response.json({ ok: true, updatedAt });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'হোয়াইটবোর্ড সেভ করা যায়নি।' }, { status: 500 });
  }
}
