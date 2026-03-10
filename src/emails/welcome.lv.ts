export default {
  subject: 'Laipni lūdzam Domera!',
  html: (name: string) => `
    <div style="background:#fff;padding:0;margin:0;font-family:Arial,sans-serif;">
      <div style="text-align:center;padding:32px 0 12px;">
        <img src='/Logo1.png' alt='Domera Logo' width='64' height='64' style='margin-bottom:12px;' />
      </div>
      <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:10px;padding:24px 18px 32px 18px;box-shadow:0 2px 8px #e0e7ef;">
        <h2 style="text-align:center;font-size:20px;font-weight:700;margin:0 0 18px 0;color:#222;">Laipni lūdzam, ${name}!</h2>
        <p style="font-size:15px;color:#222;text-align:center;margin:0 0 18px 0;">Paldies, ka pievienojāties Domera platformai. Tagad Jūs varat pilnvērtīgi izmantot visus pakalpojumus.</p>
        <div style="text-align:center;margin:24px 0;">
          <a href="https://domera.lv" style="display:inline-block;padding:12px 32px;background:#2563eb;color:#fff;font-size:16px;font-weight:600;border-radius:8px;text-decoration:none;">Atvērt Domera</a>
        </div>
      </div>
    </div>
  `,
};
