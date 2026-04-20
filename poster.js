const fetch = require('node-fetch');

console.log('[poster] WEBHOOK URL:', process.env.DISCORD_WEBHOOK_ALL);

async function post(payload) {
  const url = process.env.DISCORD_WEBHOOK_ALL;
  if (!url) {
    console.error('[poster] DISCORD_WEBHOOK_ALL が未設定です');
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
