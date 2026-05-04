/**
 * Plain-HTML magic-link email. Editorial-brutalist tone matching the brand.
 * Renders fine in every email client — no external assets, all inline styles.
 */
export function sendMagicLinkEmail({ email, url }: { email: string; url: string }) {
  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:40px 20px;background:#0a0a0a;color:#f4f1ea;font-family:Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased;">
  <div style="max-width:480px;margin:0 auto;background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:32px;">
    <div style="font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#FFC452;margin-bottom:24px;">
      wingmic.xyz
    </div>
    <h1 style="font-size:28px;font-weight:800;letter-spacing:-0.025em;line-height:1.1;margin:0 0 16px;color:#fff;">
      sign in to wingmic.
    </h1>
    <p style="font-size:15px;line-height:1.6;color:rgba(255,255,255,0.7);margin:0 0 24px;">
      tap the button below to finish signing in. the link expires in 10 minutes and only works once.
    </p>
    <a href="${url}" style="display:inline-block;padding:14px 24px;border-radius:10px;background:#FFC452;color:#000;font-weight:700;font-size:15px;text-decoration:none;border:1.5px solid #000;">
      sign in →
    </a>
    <p style="font-size:13px;line-height:1.55;color:rgba(255,255,255,0.4);margin:32px 0 0;">
      didn't request this? ignore the email. nobody else can use this link.
    </p>
    <hr style="border:0;border-top:1px solid rgba(255,255,255,0.06);margin:32px 0 16px;" />
    <p style="font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:1px;color:rgba(255,255,255,0.3);text-transform:uppercase;margin:0;">
      sent to ${email}
    </p>
  </div>
</body>
</html>`;
}
