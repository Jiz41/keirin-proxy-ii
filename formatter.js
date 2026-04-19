const path = require('path');
const fs   = require('fs');
const vm   = require('vm');

// ── TAMAKI_SPEECHES を tamaki_speech.js から取得 ────────────────────────────
const _shared = { speeches: {} };
const _src = fs.readFileSync(path.join(__dirname, 'tamaki_speech.js'), 'utf8')
  .replace(/^\(function\(app\)\s*\{/, '')
  .replace(/\}\)\(App\);\s*$/, '')
  + '\n__shared.speeches = TAMAKI_SPEECHES;';
vm.runInContext(_src, vm.createContext({
  app: { logMessage: () => {} }, App: { logMessage: () => {} },
  __shared: _shared,
}));
const TAMAKI_SPEECHES = _shared.speeches;

function pickSpeech(key) {
  const arr = TAMAKI_SPEECHES[key];
  if (!arr || arr.length === 0) return '';
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── 定数 ────────────────────────────────────────────────────────────────────
const TENUN_EMOJI  = { 0: '☀️', 33: '🌤', 67: '⛅', 100: '🌩' };
const TENUN_COLORS = { 0: 0x57F287, 33: 0xFEE75C, 67: 0xFF9F00, 100: 0xED4245 };

const BET_LABEL = {
  sanrentan:  '🔴 3連単',
  sanrenpuku: '🔵 3連複',
  nirentan:   '🟡 2連単',
  nirenfuku:  '🟢 2連複',
};

// ── 印生成 ──────────────────────────────────────────────────────────────────
function strengthMark(winProb, top3Prob) {
  if (winProb >= 0.28 && top3Prob >= 0.70) return '◎';
  if (winProb >= 0.20 && top3Prob >= 0.60) return '○';
  if (winProb >= 0.15 && top3Prob >= 0.50) return '▲';
  if (winProb >= 0.10 && top3Prob >= 0.40) return '△';
  if (winProb >= 0.05) return '×';
  return '・';
}

// ── 買い目フォーマット ───────────────────────────────────────────────────────
function formatSeitenBets(bets) {
  if (!bets) return '取得不可';
  const tan  = (bets.sanrentan  || []).map(b => b.join('-')).join('\n');
  const puku = (bets.sanrenpuku || []).map(b => b.join('=')).join('\n');
  return `${BET_LABEL.sanrentan}\n${tan || '-'}\n${BET_LABEL.sanrenpuku}\n${puku || '-'}`;
}

function formatKoutenBets(bets) {
  if (!bets) return '取得不可';
  const puku = (bets.sanrenpuku || []).map(b => b.join('=')).join('\n');
  const tan  = (bets.nirentan   || []).map(b => b.join('→')).join('\n');
  return `${BET_LABEL.sanrenpuku}\n${puku || '-'}\n${BET_LABEL.nirentan}\n${tan || '-'}`;
}

// ── 赤口呑縁フォーマット ─────────────────────────────────────────────────────
function formatShakkou(shakkou) {
  if (!shakkou) return null;

  const stats = (shakkou.statistics || []).slice(0, 5);
  const lines = stats.map(s => {
    const mark = strengthMark(s.winProbability, s.top3Probability);
    const win  = (s.winProbability  * 100).toFixed(1);
    const top3 = (s.top3Probability * 100).toFixed(1);
    return `${mark} #${s.id}  勝率${win}%  3着内${top3}%  平均着順${s.averageRank.toFixed(2)}`;
  });

  const patterns = (shakkou.topPatterns || []).slice(0, 3)
    .map((p, i) => `${i + 1}位: ${p.pattern}（${p.count}回）`)
    .join('\n');

  const total = shakkou.metadata?.totalSimulations ?? '?';

  return `**1465世界線シミュレーション（${total}回）**\n${lines.join('\n')}\n\n**最頻出3着順**\n${patterns}`;
}

// ── メインフォーマット ────────────────────────────────────────────────────────
function format(prediction) {
  const { raceId, venue, results } = prediction;
  const raceNo = parseInt(raceId.slice(-2), 10);

  const { seitenBets, koutenBets, tenun, shakkou } = results;

  const tenunIndex = tenun?.index ?? 50;
  const emoji      = TENUN_EMOJI[tenunIndex] ?? '🌫';
  const color      = TENUN_COLORS[tenunIndex] ?? 0x99AAB5;
  const speechKey  = `index_${tenunIndex}`;
  const tamakiText = pickSpeech(speechKey) || '取得不可';

  const fields = [
    { name: '🌤 晴天令 買い目', value: formatSeitenBets(seitenBets), inline: true  },
    { name: '🌩 荒天令 買い目', value: formatKoutenBets(koutenBets), inline: true  },
    {
      name:  `${emoji} 天雲指数  ${tenunIndex}`,
      value: tamakiText.slice(0, 300),
      inline: false,
    },
  ];

  // 壱耀晴乾ノ象（発動時のみ）
  if (tenun?.ichiyo?.activated) {
    const playerId = tenun.ichiyo.playerId;
    const raw      = pickSpeech('ichiyo') || '';
    const speech   = raw.replace(/\$\{id\}/g, String(playerId));
    fields.push({
      name:  `⚡ 壱耀晴乾ノ象  #${playerId}番`,
      value: speech.slice(0, 300) || `#${playerId}番に天命収束`,
      inline: false,
    });
  }

  // 赤口呑縁
  const shakkouText = formatShakkou(shakkou);
  if (shakkouText) {
    fields.push({
      name:  '🌌 赤口呑縁',
      value: shakkouText.slice(0, 1024),
      inline: false,
    });
  }

  return {
    embeds: [{
      title:     `🏁 ${venue}  ${raceNo}R`,
      color,
      fields,
      footer:    { text: raceId },
      timestamp: new Date().toISOString(),
    }],
  };
}

module.exports = { format };
