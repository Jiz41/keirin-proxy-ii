const fetch = require('node-fetch');
const cheerio = require('cheerio');

const BANK_NAME_MAP = {
  '函館':'🦑函館', '青森':'🍎青森', 'いわき平':'🏝️いわき平',
  '弥彦':'⛩️弥彦', '前橋':'🏔️前橋', '取手':'🐓取手',
  '宇都宮':'🥟宇都宮', '大宮':'🌸大宮', '西武園':'🎡西武園',
  '京王閣':'🏦京王閣', '立川':'🏙️立川', '松戸':'🏰松戸',
  '川崎':'🏭川崎', '平塚':'🎋平塚', '小田原':'🏯小田原',
  '伊東':'♨️伊東', '静岡':'🗻静岡', '富山':'🐟富山',
  '名古屋':'🏯名古屋', '岐阜':'🎣岐阜', '大垣':'💧大垣',
  '豊橋':'🧨豊橋', '松阪':'🥩松阪', '四日市':'🌃四日市',
  '福井':'🦖福井', '奈良':'🦌奈良', '向日町':'🎋向日町',
  '和歌山':'🍊和歌山', '岸和田':'🏮岸和田', '玉野':'🛳️玉野',
  '広島':'🍁広島', '防府':'⛩️防府', '高松':'🍜高松',
  '小松島':'🦝小松島', '高知':'🐳高知', '松山':'🍊松山',
  '小倉':'🚂小倉', '久留米':'🍜久留米', '武雄':'♨️武雄',
  '佐世保':'🍔佐世保', '別府':'♨️別府', '熊本':'🏯熊本',
};

const VENUE_MAP = {
  '11': 'hakodate',  '12': 'aomori',    '13': 'iwakitaira',
  '21': 'yahiko',    '22': 'maebashi',  '23': 'toride',
  '24': 'utsunomiya','25': 'omiya',     '26': 'seibuen',
  '27': 'keiokaku',  '28': 'tachikawa', '31': 'matsudo',
  '32': 'chiba',     '34': 'kawasaki',  '35': 'hiratsuka',
  '36': 'odawara',   '37': 'ito',       '38': 'shizuoka',
  '42': 'nagoya',    '43': 'gifu',      '44': 'ogaki',
  '45': 'toyohashi', '46': 'toyama',    '47': 'matsusaka',
  '48': 'yokkaichi', '51': 'fukui',     '53': 'nara',
  '54': 'mukomachi', '55': 'wakayama',  '56': 'kishiwada',
  '61': 'tamano',    '62': 'hiroshima', '63': 'hofu',
  '71': 'takamatsu', '73': 'komatsushima','74': 'kochi',
  '75': 'matsuyama', '81': 'kokura',    '83': 'kurume',
  '84': 'takeo',     '85': 'sasebo',    '86': 'beppu',
  '87': 'kumamoto'
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ------------------------------------------------------------
// 直近成績セル解析: 落車・棄権・失格 → "9"
// ------------------------------------------------------------
function parseRecentCell(text) {
  if (!text || text.trim() === '') return [];
  const results = [];
  const tokens = text.trim().split(/[\s\u3000]+/).filter(t => t.length > 0);
  for (const token of tokens) {
    const n = parseInt(token, 10);
    if (!isNaN(n) && n >= 1 && n <= 9) {
      results.push(String(n));
    } else if (token.length > 0 && /[^\d]/.test(token)) {
      // 落車(F)・棄権(D)・失格(X)・その他非数字 → 9
      results.push('9');
    }
  }
  return results;
}

function extractRecent($, tds, indexOffset) {
  // 今場所(16) → 前場所(17) → 前々場所(18) の順で最新5走を抽出
  const colIndices = [16 + indexOffset, 17 + indexOffset, 18 + indexOffset];
  const results = [];
  for (const idx of colIndices) {
    if (!tds[idx]) continue;
    const cellText = $(tds[idx]).text().trim();
    const digits = parseRecentCell(cellText);
    results.push(...digits);
    if (results.length >= 5) break;
  }
  return results.slice(0, 5).join('');
}

// ------------------------------------------------------------
// 並び予想パーサー（提供：アオケイ）
// ------------------------------------------------------------
// 「数字+脚質語」ペアで先頭/後続を判定してライン分割
// 先頭役（新グループ開始）: 先行/押え先/逃/自在/まくり/捲り/捲/両
// 後続役（現グループ継続）: 追込/追/差/マーク/マ
const LEADER_STYLES = new Set(['先行', '押え先', '逃', '自在', 'まくり', '捲り', '捲', '両']);
const PAIR_RE = /([1-9])(先行|押え先|逃|自在|まくり|捲り|捲|追込|追|差|マーク|マ|両)/g;

function parseLineFormationText(raw) {
  // 方法1: 「数字+脚質語」ペアパース（Kドリームス形式 "3先行 5追込 1自在..."）
  const lines = [];
  let cur = null;
  let m;
  PAIR_RE.lastIndex = 0;
  while ((m = PAIR_RE.exec(raw)) !== null) {
    const num = parseInt(m[1], 10);
    const style = m[2];
    if (LEADER_STYLES.has(style) || cur === null) {
      cur = { members: [num] };
      lines.push(cur);
    } else {
      cur.members.push(num);
    }
  }
  if (lines.length > 0) return lines;

  // 方法2: ハイフン区切り（"1-2-3" / "1－2－3"）または連続数字（フォールバック）
  let cleaned = raw
    .replace(/並び予想[^\n]*/g, '')
    .replace(/アオケイ/g, '')
    .replace(/提供/g, '')
    .replace(/[先行押え逃自在まくり捲追込追差両マーク自]/g, ' ');

  const groups = cleaned.split(/[\s\n\u3000・｜|]+/).filter(g => g.length > 0);
  for (const group of groups) {
    if (/^\d[-－]\d/.test(group) || group.includes('-') || group.includes('－')) {
      const members = group.split(/[-－]/)
        .map(n => parseInt(n.trim(), 10))
        .filter(n => !isNaN(n) && n >= 1 && n <= 9);
      if (members.length > 0) lines.push({ members });
    } else if (/^\d+$/.test(group) && group.length <= 7) {
      const members = group.split('').map(Number).filter(n => n >= 1 && n <= 9);
      if (members.length > 0) lines.push({ members });
    }
  }
  return lines;
}

function extractLineFormation($) {
  let raw = '';

  // 方法1: "並び予想" テキストを含む要素を探索
  $('*').each((_, el) => {
    const text = $(el).text();
    if (
      text.includes('並び予想') &&
      text.length < 600 &&
      text.length > 5
    ) {
      const candidate = $(el).text().trim();
      if (candidate.length > raw.length) raw = candidate;
    }
  });

  // 方法2: "アオケイ" テキストを含む要素
  if (!raw) {
    $('*').each((_, el) => {
      const text = $(el).text();
      if (text.includes('アオケイ') && text.length < 600) {
        raw = $(el).text().trim();
        return false;
      }
    });
  }

  if (!raw) return null;

  const lines = parseLineFormationText(raw);
  if (lines.length === 0) return null;

  return { raw: raw.replace(/\s+/g, ' ').slice(0, 200), lines };
}

// ------------------------------------------------------------
// メインスクレイパー
// ------------------------------------------------------------
async function scrapeRace(raceId) {
  const venueCode = raceId.slice(0, 2);
  const slug = VENUE_MAP[venueCode];
  if (!slug) throw new Error('Invalid venue code');

  const url = `https://keirin.kdreams.jp/${slug}/racedetail/${raceId}/`;

  await sleep(1000);
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'PoliteKeirinBot/1.0 (on-demand only, no flood; say the word and I vanish; DM: https://x.com/kayoutouidou01)',
      'Accept': 'text/html',
      'Accept-Language': 'ja-JP'
    }
  });
  const body = await response.text();
  const $ = cheerio.load(body);

  const titleText = $('title').text();
  const venueMatch = titleText.match(/(.+)競輪 レース詳細/);
  const venue = BANK_NAME_MAP[venueMatch ? venueMatch[1] : ''] || (venueMatch ? venueMatch[1] : '');

  // ライン予想（並び予想セクション）
  const lineFormation = extractLineFormation($);

  // 出走表テーブル特定
  const riders = [];
  let raceTable = null;
  $('table').each((_, table) => {
    const thText = $(table).find('th').first().text();
    if (thText.includes('予想') && !thText.includes('周回')) {
      raceTable = table;
      return false;
    }
  });

  if (raceTable) {
    $(raceTable).find('tbody tr').each((_, el) => {
      const rowText = $(el).text();
      if (rowText.includes('誘導員')) return;

      const tds = $(el).find('td');
      if (tds.length === 0) return;

      // indexOffset: 印列の有無で列ずれを補正
      const indexOffset = tds.length <= 22 ? -1 : 0;

      // 車番特定
      let number = null;
      const numberCellIndex = 4 + indexOffset;
      if (tds[numberCellIndex]) {
        const numText = $(tds[numberCellIndex]).text().trim();
        const parsed = parseInt(numText, 10);
        if (!isNaN(parsed) && parsed > 0 && parsed < 10) number = parsed;
      }
      if (number === null) {
        tds.each((_, td) => {
          const t = $(td).text().trim();
          if (/^[1-9]$/.test(t)) { number = parseInt(t, 10); return false; }
        });
      }
      if (number === null) return;

      const isScratched = rowText.includes('（欠車）') || rowText.includes('欠');

      const rider = {
        bracket:      null,
        number,
        name:         '',
        pref:         null,
        age:          null,
        term:         null,
        grade:        '',
        styleRaw:     null,
        gear:         null,
        score:        null,
        winningMoves: { nige: 0, makuri: 0, sashi: 0, mark: 0 },
        recent:       '',
        isScratched
      };

      if (!isScratched) {
        try {
          // 枠番
          const bracketIdx = 3 + indexOffset;
          if (tds[bracketIdx]) {
            const b = parseInt($(tds[bracketIdx]).text().trim());
            rider.bracket = isNaN(b) ? null : b;
          }

          // 選手名・都府県・年齢・期
          const nameIdx = 5 + indexOffset;
          const nameCellText = tds[nameIdx]
            ? $(tds[nameIdx]).text().replace(/　/g, ' ').trim()
            : '';
          const detailRegex = /([^\s/]+(?:\s[^\s/]+)?)\s*\/\s*(\d+)\s*\/\s*(\d+)/;
          const detailMatch = nameCellText.match(detailRegex);
          if (detailMatch) {
            rider.name = nameCellText.substring(0, detailMatch.index).replace(/\s+/g, ' ').trim();
            rider.pref = (detailMatch[1] || '').replace(/\s/g, '');
            rider.age  = parseInt(detailMatch[2]) || null;
            rider.term = parseInt(detailMatch[3]) || null;
          } else {
            rider.name = nameCellText.replace(/\s+/g, ' ').trim();
          }

          // 選手グレード
          rider.grade = tds[6 + indexOffset]
            ? $(tds[6 + indexOffset]).text().trim()
            : '';

          // 脚質（生データのみ）
          rider.styleRaw = tds[7 + indexOffset]
            ? $(tds[7 + indexOffset]).text().trim()
            : null;

          // ギア比
          const gearVal = parseFloat(tds[8 + indexOffset]
            ? $(tds[8 + indexOffset]).text().trim() : '');
          rider.gear = isNaN(gearVal) ? null : gearVal;

          // 競走得点
          const scoreVal = parseFloat(tds[9 + indexOffset]
            ? $(tds[9 + indexOffset]).text().trim() : '');
          rider.score = isNaN(scoreVal) ? null : scoreVal;

          // 決まり手カウント
          rider.winningMoves = {
            nige:   parseInt($(tds[12 + indexOffset]).text().trim(), 10) || 0,
            makuri: parseInt($(tds[13 + indexOffset]).text().trim(), 10) || 0,
            sashi:  parseInt($(tds[14 + indexOffset]).text().trim(), 10) || 0,
            mark:   parseInt($(tds[15 + indexOffset]).text().trim(), 10) || 0,
          };

          // 直近成績（今場所→前場所→前々場所 最新5走）
          rider.recent = extractRecent($, tds, indexOffset);

        } catch (e) {
          console.error(`Row parse error for #${number}: ${e.message}`);
        }
      }

      riders.push(rider);
    });
  }

  // シリーズ判定
  const grades = riders.filter(r => !r.isScratched).map(r => r.grade);
  let series = 'A級';
  if      (grades.some(g => g === 'L1'))          series = 'ガールズ';
  else if (grades.some(g => g && g.startsWith('S'))) series = 'S級';
  else if (grades.some(g => g === 'A3'))           series = 'A級チャレンジ';

  return { raceId, venue, series, riders, lineFormation };
}

module.exports = { scrapeRace };
