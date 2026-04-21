const fetch = require('node-fetch');

console.log('[poster] WEBHOOK URL:', process.env.DISCORD_WEBHOOK_URL);

async function post(payload) {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) {
    console.error('[poster] DISCORD_WEBHOOK_URL が未設定です');
    return;
  }
  try {
    const res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`[poster] POST失敗: ${res.status} ${body}`);
    }
  } catch (e) {
    console.error('[poster] エラー:', e.message);
  }
}

module.exports = { post };
