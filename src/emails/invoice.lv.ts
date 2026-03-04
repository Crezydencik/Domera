export default {
  subject: 'Jauns rēķins par komunālajiem pakalpojumiem',
  html: (payUrl: string) => `
    <div style="background:#fff;padding:0;margin:0;font-family:Arial,sans-serif;">
      <div style="text-align:center;padding:32px 0 12px;">
        <img src="https://cdn-icons-png.flaticon.com/512/1828/1828919.png" alt="key" width="64" height="64" style="margin-bottom:12px;"/>
      </div>
      <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:10px;padding:24px 18px 32px 18px;box-shadow:0 2px 8px #e0e7ef;">
        <h2 style="text-align:center;font-size:20px;font-weight:700;margin:0 0 18px 0;color:#222;">Cien./God. klient!</h2>
        <p style="font-size:15px;color:#222;text-align:center;margin:0 0 18px 0;">Informējam, ka Jūsu Domera.lv profilā ir sagatavots un ievietots jauns rēķins par komunālajiem pakalpojumiem.</p>
        <div style="text-align:center;margin:24px 0;">
          <a href="${payUrl}" style="display:inline-block;padding:12px 32px;background:#4db6ac;color:#fff;font-size:16px;font-weight:600;border-radius:8px;text-decoration:none;">Apmaksāt rēķinu</a>
        </div>
        <p style="font-size:14px;color:#444;text-align:center;margin:0 0 12px 0;">Samaksu par saņemtajiem pakalpojumiem var ērti veikt arī izmantojot mobilo lietotni "Domera", kuru varat lejupielādēt no <a href="https://apps.apple.com/" style="color:#1976d2;font-weight:600;">App Store</a> vai <a href="https://play.google.com/" style="color:#1976d2;font-weight:600;">Google Play</a>.</p>
        <p style="font-size:13px;color:#888;text-align:center;margin:0;">Lai pieslēgtos lietotnei, Jums ir jāizmanto tie paši pieslēgšanās rekvizīti, ko izmantojāt slēdzoties klāt vortalām <a href="https://domera.lv" style="color:#1976d2;">domera.lv</a>.</p>
      </div>
    </div>
  `,
};
