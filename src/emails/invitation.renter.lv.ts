export default {
  subject: 'Iegūstiet pieeja jūsu dzīvoklim Domera platformā',
  /**
   * @param link - ссылка для приглашения
   * @param apartment - номер квартиры
   * @param buildingAddress - адрес здания (может быть пустым)
   */
  html: (link: string, apartment: string, buildingAddress?: string) => {
    const fullAddress = buildingAddress ? `${apartment}, ${buildingAddress}` : apartment;
    return `
    <div style="background:#fff;padding:0;margin:0;font-family:Arial,sans-serif;">
      <div style="text-align:center;padding:32px 0 12px;">
        <img src='/Logo1.png' alt='Domera Logo' width='64' height='64' style='margin-bottom:12px;' />
      </div>
      <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:10px;padding:24px 18px 32px 18px;box-shadow:0 2px 8px #e0e7ef;">
        <h2 style="text-align:center;font-size:20px;font-weight:700;margin:0 0 18px 0;color:#222;">Iegūstiet pieeja jūsu dzīvoklim</h2>
        <p style="font-size:15px;color:#222;text-align:center;margin:0 0 18px 0;">Jums ir piešķirta pieeja dzīvoklim <b>${fullAddress}</b> Domera.lv platformā. Jūs varēsiet iesniegt skaitītāju rādījumus tiešsaistē un paskatīties paraugus.</p>
        <div style="text-align:center;margin:24px 0;">
          <a href="${link}" style="display:inline-block;padding:12px 32px;background:#2563eb;color:#fff;font-size:16px;font-weight:600;border-radius:8px;text-decoration:none;">Iegūt pieeja</a>
        </div>
        <p style="font-size:14px;color:#444;text-align:center;margin:0 0 12px 0;">Ja poga nedarbojas, atveriet saiti manuāli:</p>
        <p style="font-size:13px;color:#888;text-align:center;margin:0;word-break:break-all;"><a href="${link}" style="color:#1976d2;">${link}</a></p>
      </div>
    </div>
    `;
  },
};
