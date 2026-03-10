export default {
  subject: 'Pieķluve dzīvoklim piešķirta',
  html: (link: string, apartment: string, resideName: string) => `
    <div style="background:#fff;padding:0;margin:0;font-family:Arial,sans-serif;">
      <div style="text-align:center;padding:32px 0 12px;">
        <img src='/Logo1.png' alt='Domera Logo' width='64' height='64' style='margin-bottom:12px;' />
      </div>
      <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:10px;padding:24px 18px 32px 18px;box-shadow:0 2px 8px #e0e7ef;">
        <div style="text-align:left;margin:0 0 18px 0;">
          <p style="font-size:13px;color:#6b7280;margin:0;font-weight:600;">DOMERA</p>
        </div>
        <h2 style="text-align:left;font-size:24px;font-weight:700;margin:0 0 18px 0;color:#fff;background:linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);padding:16px;border-radius:8px;margin:0 -18px 18px -18px;padding-left:18px;">Pieķluve dzīvoklim piešķirta</h2>
        <p style="font-size:15px;color:#222;text-align:left;margin:0 0 18px 0;"><b>${resideName}</b> jums piešķīra pieķluvi dzīvoklim <b>${apartment}</b> Domera.lv platformā.</p>
        <p style="font-size:14px;color:#222;margin:0 0 12px 0;"><b>1. solis: ieiet kontā</b></p>
        <div style="text-align:center;margin:12px 0 24px 0;">
          <a href="${link}" style="display:inline-block;padding:12px 32px;background:#2563eb;color:#fff;font-size:16px;font-weight:600;border-radius:8px;text-decoration:none;">Ieit Domera</a>
        </div>
        <p style="font-size:14px;color:#222;margin:0 0 12px 0;"><b>2. solis: apstiprinet pieķluvi dzīvoklim</b></p>
        <div style="text-align:center;margin:12px 0 24px 0;">
          <a href="${link}" style="display:inline-block;padding:12px 32px;background:#7c3aed;color:#fff;font-size:16px;font-weight:600;border-radius:8px;text-decoration:none;">Apstiprinet pieķluvi</a>
        </div>
        <p style="font-size:13px;color:#6b7280;text-align:left;margin:0 0 12px 0;">Ja pogas nedarbojas, atveriet saiti manuāli:</p>
        <p style="font-size:12px;color:#3b82f6;text-align:left;margin:0 0 18px 0;word-break:break-all;"><a href="${link}" style="color:#3b82f6;">${link}</a></p>
        <div style="background:#f3f4f6;padding:12px;border-radius:6px;border-left:3px solid #3b82f6;">
          <p style="font-size:12px;color:#6b7280;margin:0;">
            Ja negaidīdāt šo vēstuli, vienkarši ignorējiet to.
          </p>
        </div>
      </div>
    </div>
  `,
};
     