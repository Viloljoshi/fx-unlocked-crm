function esc(str) {
  if (str === null || str === undefined) return ''
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function dealApprovalEmailHtml({ deal, affiliate, broker, levels, approveUrl, rejectUrl }) {
  const levelRows = (levels || [])
    .sort((a, b) => a.level_number - b.level_number)
    .map(
      (l) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;">${esc(l.level_number)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;">${esc(l.label)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;">${esc(l.rebate_forex)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;">${esc(l.rebate_gold)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;">${esc(l.rebate_crypto)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;">${esc(l.rebate_custom)}</td>
      </tr>`
    )
    .join('')

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

    <div style="background:#3B82F6;padding:24px 32px;">
      <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:600;">Deal Approval Request</h1>
      <p style="margin:4px 0 0;color:#dbeafe;font-size:14px;">FX Unlocked CRM</p>
    </div>

    <div style="padding:32px;">
      <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.5;">
        A new deal requires your approval. Please review the details below.
      </p>

      <div style="background:#f9fafb;border-radius:8px;padding:20px;margin-bottom:24px;">
        <h3 style="margin:0 0 12px;color:#111827;font-size:16px;">Deal Summary</h3>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:6px 0;color:#6b7280;font-size:14px;width:140px;">Affiliate / IB</td>
            <td style="padding:6px 0;color:#111827;font-size:14px;font-weight:500;">${esc(affiliate?.name) || 'N/A'}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7280;font-size:14px;">Email</td>
            <td style="padding:6px 0;color:#111827;font-size:14px;">${esc(affiliate?.email) || 'N/A'}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7280;font-size:14px;">Broker</td>
            <td style="padding:6px 0;color:#111827;font-size:14px;font-weight:500;">${esc(broker?.name) || 'N/A'}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7280;font-size:14px;">Deal Type</td>
            <td style="padding:6px 0;color:#111827;font-size:14px;">
              <span style="background:#dbeafe;color:#1e40af;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;">${esc(deal.deal_type)}</span>
            </td>
          </tr>
          ${deal.deal_terms ? `
          <tr>
            <td style="padding:6px 0;color:#6b7280;font-size:14px;">Deal Terms</td>
            <td style="padding:6px 0;color:#111827;font-size:14px;">${esc(deal.deal_terms)}</td>
          </tr>` : ''}
        </table>
      </div>

      ${levels && levels.length > 0 ? `
      <div style="margin-bottom:24px;">
        <h3 style="margin:0 0 12px;color:#111827;font-size:16px;">Rebate Structure</h3>
        <table style="width:100%;border-collapse:collapse;background:#f9fafb;border-radius:8px;overflow:hidden;">
          <thead>
            <tr style="background:#e5e7eb;">
              <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;">Level</th>
              <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;">Name</th>
              <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;">Forex</th>
              <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;">Gold</th>
              <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;">Crypto</th>
              <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;">Custom</th>
            </tr>
          </thead>
          <tbody>${levelRows}</tbody>
        </table>
      </div>` : ''}

      <div style="text-align:center;padding:16px 0 8px;">
        <a href="${approveUrl}"
           style="display:inline-block;background:#16a34a;color:#ffffff;padding:14px 40px;border-radius:8px;text-decoration:none;font-size:16px;font-weight:600;letter-spacing:0.5px;">
          APPROVE DEAL
        </a>
        ${rejectUrl ? `
        <div style="margin-top:12px;">
          <a href="${rejectUrl}"
             style="display:inline-block;background:#dc2626;color:#ffffff;padding:10px 32px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">
            REJECT DEAL
          </a>
        </div>` : ''}
      </div>
      <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:12px;">
        These links expire in 72 hours.
      </p>
    </div>

    <div style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;">
      <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">
        FX Unlocked CRM &bull; Automated Deal Notification
      </p>
    </div>
  </div>
</body>
</html>`
}
