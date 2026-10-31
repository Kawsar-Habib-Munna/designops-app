import { NextRequest } from 'next/server';
import { getSupabaseAdmin, getCallerProfile } from '@/lib/supabaseAdmin';
import { sendEmail } from '@/lib/email';
import { sendWhatsApp } from '@/lib/whatsapp';

// Team Files page -> "tell the client": emails and/or WhatsApps the client a short message with a link into their
// client portal. (The in-portal chat message is written by the page itself.) Only signed-in team members can call it,
// and the recipient is always the contact on the project's client record, never an address sent by the browser.

const ANCHORS = ['', '#all-files', '#links'];

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// WhatsApp needs an international number: +8801XXXXXXXXX. Local Bangladeshi numbers (01XXXXXXXXX) are converted.
function toInternational(phone: string): string | null {
  const digits = phone.replace(/[^\d+]/g, '');
  if (!digits) return null;
  if (digits.startsWith('+')) return digits;
  if (/^0\d{10}$/.test(digits)) return `+88${digits}`;
  if (/^880\d{10}$/.test(digits)) return `+${digits}`;
  return `+${digits}`;
}

export async function POST(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return Response.json({ error: 'You are not signed in.' }, { status: 401 });

  let admin;
  try {
    admin = getSupabaseAdmin();
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'Server is not configured.' }, { status: 500 });
  }
  const caller = await getCallerProfile(admin, token);
  if (!caller) return Response.json({ error: 'Your session could not be verified. Please sign in again.' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const projectId = typeof body.projectId === 'string' ? body.projectId : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const anchor = typeof body.anchor === 'string' && ANCHORS.includes(body.anchor) ? body.anchor : '';
  const wantEmail = body.email === true;
  const wantWhatsApp = body.whatsapp === true;
  if (!projectId || !message || message.length > 2000) return Response.json({ error: 'A project and a message (up to 2000 characters) are needed.' }, { status: 400 });
  if (!wantEmail && !wantWhatsApp) return Response.json({ error: 'Choose email or WhatsApp.' }, { status: 400 });

  const { data: project } = await admin.from('projects').select('id, name, client_id').eq('id', projectId).maybeSingle();
  if (!project?.client_id) return Response.json({ error: 'This project has no client.' }, { status: 404 });
  const { data: client } = await admin.from('clients').select('company_name, primary_contact, contact_email, contact_phone').eq('id', project.client_id).maybeSingle();
  if (!client) return Response.json({ error: 'Client not found.' }, { status: 404 });

  const link = `${new URL(request.url).origin}/client/project/${projectId}/files${anchor}`;
  const result: { email?: string; whatsapp?: string } = {};

  if (wantEmail) {
    if (!client.contact_email) {
      result.email = 'no email address on file';
    } else {
      try {
        await sendEmail(
          client.contact_email,
          `${project.name}: new files from FLOW 53`,
          `<div style="font-family:sans-serif;font-size:14px;color:#14141A;max-width:520px;">
            <p style="white-space:pre-line;line-height:1.6;margin:0 0 18px;">${escapeHtml(message)}</p>
            <p style="margin:0 0 22px;"><a href="${link}" style="background:#7c3aed;color:#fff;padding:11px 20px;border-radius:10px;text-decoration:none;display:inline-block;font-weight:600;">Open in your client portal</a></p>
            <p style="margin:0;color:#6E6E7A;font-size:12px;">FLOW 53 · ${escapeHtml(project.name)}</p>
          </div>`,
        );
        result.email = 'sent';
      } catch (e) {
        result.email = e instanceof Error ? e.message.slice(0, 200) : 'could not be sent';
      }
    }
  }

  if (wantWhatsApp) {
    const phone = client.contact_phone ? toInternational(client.contact_phone) : null;
    if (!phone) {
      result.whatsapp = 'no phone number on file';
    } else {
      try {
        await sendWhatsApp(phone, `${message}\n${link}`);
        result.whatsapp = 'sent';
      } catch (e) {
        result.whatsapp = e instanceof Error ? e.message.slice(0, 200) : 'could not be sent';
      }
    }
  }

  return Response.json(result);
}
