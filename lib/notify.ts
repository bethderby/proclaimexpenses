export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char));
}

function appBaseUrl() {
  return process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
}

/**
 * Every notification email in the app shares this shape: a heading, an intro
 * line, an optional highlighted "card" (amount + description + note), an
 * optional call-to-action button, and a footer. Building emails through this
 * one function - rather than hand-writing a new template literal with its own
 * escapeHtml() calls at every call site - means every value that came from
 * user input or the database is escaped exactly once, in exactly one place.
 * Callers pass raw, unescaped text; this function does the escaping.
 */
export type EmailCard = {
  amountLabel?: string;
  description?: string;
  note?: string;
};

export type EmailContent = {
  heading: string;
  intro?: string;
  card?: EmailCard;
  /** Path relative to the app, e.g. '/dashboard/approvals'. Combined with NEXTAUTH_URL/VERCEL_URL. */
  ctaPath?: string;
  ctaLabel?: string;
  plainTextExtra?: string;
};

export function renderEmail({ heading, intro, card, ctaPath, ctaLabel, plainTextExtra }: EmailContent): { html: string; text: string } {
  const appUrl = appBaseUrl();
  const ctaUrl = ctaPath && appUrl ? `${appUrl}${ctaPath}` : null;

  const cardHtml = card
    ? `<div style="padding:18px;border:1px solid #e2e8f0;border-radius:14px;margin:20px 0">${
        card.amountLabel ? `<p style="margin:0 0 8px;font-size:20px;font-weight:700">${escapeHtml(card.amountLabel)}</p>` : ''
      }${
        card.description ? `<p style="margin:0;color:#475569">${escapeHtml(card.description)}</p>` : ''
      }${
        card.note ? `<p style="margin:8px 0 0;color:#64748b">${escapeHtml(card.note)}</p>` : ''
      }</div>`
    : '';

  const ctaHtml = ctaUrl
    ? `<a href="${ctaUrl}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700">${escapeHtml(ctaLabel || 'Open Proclaim Expenses')}</a>`
    : '';

  const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#0f172a"><h2 style="margin-bottom:8px">${escapeHtml(heading)}</h2>${
    intro ? `<p style="color:#64748b">${escapeHtml(intro)}</p>` : ''
  }${cardHtml}${ctaHtml}<p style="margin-top:28px;font-size:12px;color:#94a3b8">Proclaim Expenses</p></div>`;

  const textParts = [
    heading,
    intro,
    card?.amountLabel,
    card?.description,
    card?.note,
    plainTextExtra,
    ctaUrl,
  ].filter((part): part is string => !!part);
  const text = textParts.join('\n\n');

  return { html, text };
}

export async function notify(to: string | string[], subject: string, html: string, text: string) {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM) {
    console.warn('Email notification skipped: RESEND_API_KEY or RESEND_FROM is not configured.');
    return;
  }

  try {
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    const result = await resend.emails.send({ from: process.env.RESEND_FROM, to, subject, html, text });
    if (result.error) console.error('Email notification failed', result.error);
  } catch (error) {
    console.error('Email notification failed', error);
  }
}
