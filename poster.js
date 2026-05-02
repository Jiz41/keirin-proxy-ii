const { createClient } = require('@supabase/supabase-js');

let _supabase = null;
function getClient() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
  }
  return _supabase;
}

async function post(payload) {
  console.log('[poster] post() 呼び出し開始');

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    console.error('[poster] SUPABASE_URL または SUPABASE_SERVICE_KEY が未設定です');
    return;
  }

  const embed = payload.embeds[0];
  const fields = embed.fields ?? [];

  const hasField = (keyword) => fields.some((f) => f.name.includes(keyword));

  const record = {
    race_id:      embed.footer.text,
    title:        embed.title,
    color:        embed.color,
    timestamp:    embed.timestamp,
    fields:       fields,
    has_gold_cap: hasField('ゴールドキャップ'),
    has_ichiyo:   hasField('壱耀'),
    has_shakkou:  hasField('赤口'),
  };

  console.log('[poster] INSERTレコード:', JSON.stringify(record, null, 2));

  try {
    const { error } = await getClient().from('discord_posts').insert(record);
    if (error) {
      console.error('[poster] INSERT失敗:', {
        message: error.message,
        code:    error.code,
        details: error.details,
        hint:    error.hint,
      });
    } else {
      console.log('[poster] INSERT成功: race_id =', record.race_id);
    }
  } catch (e) {
    console.error('[poster] 例外エラー:', e.message);
  }
}

module.exports = { post };
