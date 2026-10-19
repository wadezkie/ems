import "server-only";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function layout(title: string, bodyHtml: string) {
  return `<!doctype html>
<html><body style="margin:0;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;color:#1e1e1e">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:8px;overflow:hidden">
<tr><td style="background:#023482;color:#ffffff;padding:20px 28px;font-size:20px;font-weight:bold">EMS &middot; Employee Management System</td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 16px;font-size:22px;color:#040841">${escapeHtml(title)}</h1>
${bodyHtml}
</td></tr>
<tr><td style="padding:16px 28px;background:#fafafa;color:#757575;font-size:12px">This is an automated message. Please do not reply.</td></tr>
</table></td></tr></table></body></html>`;
}

function button(href: string, label: string) {
  return `<p style="margin:24px 0"><a href="${escapeHtml(href)}" style="display:inline-block;background:#0a52de;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:bold">${escapeHtml(label)}</a></p>`;
}

function credentialRow(label: string, value: string) {
  return `<tr><td style="padding:6px 0;color:#555;font-size:14px;width:150px">${escapeHtml(label)}</td><td style="padding:6px 0;font-family:Consolas,Menlo,monospace;font-size:16px;font-weight:bold;color:#040841">${escapeHtml(value)}</td></tr>`;
}

export function temporaryCredentialsEmail(input: {
  name: string;
  username: string;
  temporaryPassword: string;
  loginUrl: string;
  expiresMinutes: number;
}) {
  const subject = "Your EMS temporary login credentials";
  const html = layout(
    "Activate your account",
    `<p>Hello ${escapeHtml(input.name)},</p>
<p>We received a request to activate your Employee Management System account. Log in with the temporary credentials below. You will then be asked to set your own username and password.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0;padding:12px 16px;background:#f4f6fb;border-radius:6px;width:100%">
${credentialRow("Username", input.username)}
${credentialRow("Temporary password", input.temporaryPassword)}
</table>
${button(input.loginUrl, "Go to login")}
<p style="margin:0 0 16px;padding:12px 16px;background:#fff7e6;border-left:4px solid #f2a900;font-size:14px;color:#5c4100"><strong>This temporary password expires in ${input.expiresMinutes} minutes.</strong> If it expires, request new credentials from the Activate Account page.</p>
<p style="font-size:13px;color:#555"><strong>Security note:</strong> EMS will never ask for your password by email or phone. Do not share these credentials. If you did not request this activation, ignore this email; your account stays locked until it is activated.</p>`,
  );
  const text = `Hello ${input.name},

We received a request to activate your Employee Management System account. Log in with these temporary credentials. You will then be asked to set your own username and password.

Username: ${input.username}
Temporary password: ${input.temporaryPassword}

Log in here: ${input.loginUrl}

This temporary password expires in ${input.expiresMinutes} minutes. If it expires, request new credentials from the Activate Account page.

Security note: EMS will never ask for your password by email or phone. Do not share these credentials. If you did not request this activation, ignore this email; your account stays locked until it is activated.`;
  return { subject, html, text };
}

export function alreadyActiveEmail(input: { name: string; loginUrl: string }) {
  const subject = "Your EMS account is already active";
  const html = layout(
    "Your account is already active",
    `<p>Hello ${escapeHtml(input.name)},</p>
<p>Someone tried to activate your EMS account, but it is already active. You can log in with your username and password.</p>
${button(input.loginUrl, "Go to login")}
<p style="font-size:13px;color:#555">If this was not you, no action is needed.</p>`,
  );
  const text = `Hello ${input.name},

Someone tried to activate your EMS account, but it is already active. Log in here: ${input.loginUrl}

If this was not you, no action is needed.`;
  return { subject, html, text };
}
