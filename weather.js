const VENUE_LATLNG = {
  '🦑函館':     [41.7686, 140.7288],
  '🍎青森':     [40.7822, 140.7380],
  '🏝️いわき平': [37.0574, 140.8877],
  '⛩️弥彦':     [37.6517, 138.8272],
  '🏔️前橋':     null,
  '🐓取手':     [35.9103, 140.0780],
  '🥟宇都宮':   [36.5658, 139.8836],
  '🌸大宮':     [35.9065, 139.6244],
  '🎡西武園':   [35.7897, 139.4731],
  '🏦京王閣':   [35.6297, 139.4503],
  '🏙️立川':     [35.7042, 139.4139],
  '🏰松戸':     [35.7878, 139.9026],
  '🏭川崎':     [35.5308, 139.7032],
  '🎋平塚':     [35.3303, 139.3497],
  '🏯小田原':   [35.2481, 139.1542],
  '♨️伊東':     [34.9657, 139.0991],
  '🗻静岡':     [34.9756, 138.3831],
  '🐟富山':     [36.6953, 137.2113],
  '🏯名古屋':   [35.1815, 136.9066],
  '🎣岐阜':     [35.4231, 136.7608],
  '💧大垣':     [35.3597, 136.6194],
  '🧨豊橋':     [34.7694, 137.3917],
  '🥩松阪':     [34.5781, 136.5272],
  '🌃四日市':   [34.9731, 136.6242],
  '🦖福井':     [36.0641, 136.2197],
  '🦌奈良':     [34.6853, 135.8326],
  '🎋向日町':   [34.9408, 135.7103],
  '🍊和歌山':   [34.2261, 135.1669],
  '🏮岸和田':   [34.4608, 135.3628],
  '🛳️玉野':     [34.4878, 133.9458],
  '🍁広島':     [34.3853, 132.4733],
  '⛩️防府':     [34.0531, 131.5617],
  '🍜高松':     [34.3403, 134.0461],
  '🦝小松島':   [33.9778, 134.5897],
  '🐳高知':     [33.5597, 133.5317],
  '🍊松山':     [33.8331, 132.7658],
  '🚂小倉':     null,
  '🍜久留米':   [33.3197, 130.5081],
  '♨️武雄':     [33.1928, 130.0194],
  '🍔佐世保':   [33.1597, 129.7186],
  '♨️別府':     [33.2797, 131.4975],
  '🏯熊本':     [32.7903, 130.7419],
};

function degToDirection(deg) {
  const dirs = ['北', '北東', '東', '南東', '南', '南西', '西', '北西'];
  return dirs[Math.round(deg / 45) % 8];
}

function kmhToMs(kmh) {
  return Math.round((kmh / 3.6) * 2) / 2;
}

async function getWeather(venueName) {
  const latlng = VENUE_LATLNG[venueName];

  if (latlng === null) {
    return { windSpeed: null, windDirection: null, error: '位置情報なし' };
  }
  if (latlng === undefined) {
    return { windSpeed: null, windDirection: null, error: 'バンクが見つかりません' };
  }

  const [lat, lon] = latlng;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=wind_speed_10m,wind_direction_10m&timezone=Asia/Tokyo`;

  const res     = await fetch(url);
  const json    = await res.json();
  const current = json.current;

  if (!res.ok || !current || current.wind_speed_10m === undefined) {
    throw new Error('open-meteo APIからデータを取得できませんでした');
  }

  const windSpeed     = kmhToMs(current.wind_speed_10m);
  const windDirection = windSpeed < 1.0 ? '無風' : degToDirection(current.wind_direction_10m);

  return { windSpeed, windDirection };
}

module.exports = { getWeather };
