const TENUN_COLORS = {
  0:   0x57F287,  // 緑（完全安定）
  33:  0xFEE75C,  // 黄
  67:  0xFF9F00,  // 橙
  100: 0xED4245,  // 赤（完全混沌）
};

function stripHtml(html) {
  return (html || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function formatSeitenBets(bets) {
  if (!bets) return '取得不可';
  const tan  = (bets.sanrentan  || []).map(b => b.join('-')).join('\n');
  const puku = (bets.sanrenpuku || []).map(b => b.join('=')).join('\n');
  return `**3連単**\n${tan || '-'}\n**3連複**\n${puku || '-'}`;
}

function formatKoutenBets(bets) {
  if (!bets) return '取得不可';
  const puku = (bets.sanrenpuku || []).map(b => b.join('=')).join('\n');
  const tan  = (bets.nirentan   || []).map(b => b.join('→')).join('\n');
  return `**3連複**\n${puku || '-'}\n**2連単**\n${tan || '-'}`;
}

function format(prediction) {
  const { raceId, venue, results } = prediction;
  const raceNo = parseInt(raceId.slice(-2), 10);

  const { seitenBets, koutenBets, tenun } = results;

  const tenunIndex  = tenun ? tenun.index : 50;
  const tamakiText  = tenun ? stripHtml(tenun.message).slice(0, 300) : '取得不可';
  const color       = TENUN_COLORS[tenunIndex] ?? 0x99AAB5;

  const embed = {
    title:  `🏁 ${venue}  ${raceNo}R`,
    color,
    fields: [
      { name: '🌤 晴天令 買い目', value: formatSeitenBets(seitenBets), inline: true  },
      { name: '🌩 荒天令 買い目', value: formatKoutenBets(koutenBets), inline: true  },
      { name: `☁ 天雲指数  ${tenunIndex}`, value: tamakiText || '取得不可', inline: false },
    ],
    footer:    { text: raceId },
    timestamp: new Date().toISOString(),
  };

  return { embeds: [embed] };
}

module.exports = { format };
