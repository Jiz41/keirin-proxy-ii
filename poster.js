const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function post(payload) {
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

  try {
    const { error } = await supabase.from('discord_posts').insert(record);
    if (error) {
      console.error('[poster] INSERT失敗:', error.message);
    }
  } catch (e) {
    console.error('[poster] エラー:', e.message);
  }
}

module.exports = { post };
