(function(app) {
  'use strict';

  const TAMAKI_SPEECHES = {
    index_0: [
        "提示された数字、とっても穏やかな気配ですぅ。晴天令の示す形を、そのまま信じて良さそうですよぉ。",
        "出された結果を見ると、空はとっても澄んでいますぅ。波乱の種は見当たりませんし、このまま静かに見守っていられそうですぅ。",
        "はいー、数字の意味を読み解きましたぁ。どこにも無理のない、綺麗な調和を感じますぅ。晴天令の理が、しっかり通っているみたいですねぇ。",
        "この神託の通り、気配はとっても安定していますぅ。余計な心配はいりませんから、晴天令の導きを大切にしてくださいねぇ。",
        "もう一つ、この数字には安心感がありますねぇ。荒天の兆しはどこにもありませんし、このまま穏やかな時が続きそうですぅ。",
        "ふむふむ、この演算結果、一点の曇りもありませんぅ。晴天令の示す安定感に、素直に身を任せてみるのが一番みたいですよぉ。",
        "出された数値から、確かな平穏を感じますぅ。迷いのない真っ直ぐな道筋が、そこにははっきりと描かれていますねぇ。",
        "はい、こちらの数字、信頼度はとっても高いですぅ。晴天令の法則が、今の景色を完璧に捉えているみたいですよぉ。",
        "えっとですね、この結果、波風ひとつ立たない凪の状態ですぅ。晴天令の示す通りの、静かな決着になりそうですねぇ♪",
        "神託の通りに、天の理が整っていますぅ。この安定した形を信じて、今はゆったりとした気持ちで眺めてみてくださいねぇ。"
    ],
    index_33: [
        "提示された数字、比較的穏やかな気配ですぅ。晴天令の波形を追いながら、荒天令の兆しも少しだけ、一緒に眺めておきませんかぁ？",
        "出された結果を読み取ると、まずまず安定している状態ですぅ。ただ、端の方に少しだけ計算の揺らぎが見えますねぇ。",
        "はいー、数字を詳しく見ると、そこまで荒れる気配はないんですけどぉ、わずかに空気が震えているみたいですぅ。晴天令の形を、静かに見つめてみてくださいねぇ。",
        "この神託の通り、比較的落ち着いた展開が導き出されていますぅ。ただ、荒天令の買い目にも、無視できない数字が混じっているみたいですぅ。",
        "もう一つ、この数字には薄い雲が見えますねぇ。晴天令の理をベースにしながら、少しだけ視野を広げてみるのが良さそうですぅ。",
        "ふむふむ、この演算結果、バランスの取れた気配ですぅ。晴天令の安定感と、荒天令に潜む特異点。両方が絶妙な均衡を保っているみたいですねぇ。",
        "出された数値を見ると、やや穏やかな方向を指していますねぇ。軸となる形ははっきりしていますが、周りには少し遊びを持たせたほうが、理に適っているかもしれませんねぇ。",
        "はい、こちらの数字、そこそこ安定を示していますぅ。晴天令の上位に現れている数値を、まずはじっくりと整理してみてくださいねー。",
        "えっとですね、この結果、まあまあ堅い形には見えますけどぉ、完璧な調和ではないみたいですぅ。このわずかな誤差を、どう受け取るのがいいんでしょうかねぇ。",
        "神託の通り、穏やかだけど、わずかに予測の枠をはみ出す気配がありますねぇ。晴天令の理をベースに、空の変化に備えておいてくださいねぇ。"
    ],
    index_67: [
        "提示された数字、ちょっと雲行きが怪しいですねぇ。天の理が少しだけ複雑に絡み合って、荒天令の数字が顔を出しているみたいですぅ。",
        "出された結果を見ると、天の気配が乱れ始めているみたいですぅ。晴天令だけでは、測りきれない何かが動いているみたいですねぇ。",
        "はいー、数字の意味を追うと、波乱の兆しがかなり濃厚に出ていますぅ。荒天令の特異な数字たちが、じっとこちらを伺っているような気配を感じますぅ。",
        "この神託の通り、荒れる可能性が高いことを示していますぅ。晴天令と荒天令、二つの数字のズレを、ゆっくり見比べてみてくださいねぇ。",
        "もう一つ、この数字には不穏な気配が混ざっていますぅ。実力のある方たちの法則が、少しだけ揺らいで見えますぅ。荒天令の景色も、今は大切かもしれませんねぇ。",
        "ふむふむ、この演算結果、天の法則が揺らいでいる感じがしますねぇ。波乱の波がすぐそこまで来ていることを、数字たちが静かに教えてくれていますぅ。",
        "出された数値から、荒天の気配を強く感じますぅ。晴天令の道筋よりも、荒天令の数字の方が、今ははっきり見えているみたいですぅ。",
        "はい、こちらの数字、かなり波乱含みの状態ですねぇ。綺麗な決着を望むには、少し空が暗すぎるみたいですぅ。荒天令の動きを、静かに追ってみませんかぁ？",
        "えっとですね、この結果、乱れた気配が濃厚ですぅ。荒天令の特異点が、ひとつの指針として浮かび上がってきているみたいですよぉ。",
        "神託の通り、けっこう荒れるサインが出ているんですぅ。いつもの形にこだわらず、今は天の気まぐれに、少しだけ寄り添ってみるのがいいかもしれませんねぇ。"
    ],
    index_100: [
        "【不測】異常値を検知。提示された数値に対し、晴天令による計算は現在機能していません。観測データは荒天令の数値に偏っています。",
        "【不安定】出された結果に不安定な数値が継続しています。上位陣の失速確率が極めて高く、予測モデルを維持できません。荒天令を参照してください。",
        "【不測】法則の連続性を確認できません。この神託における通常の決着パターンは計算上棄却されました。荒天令の数値のみを提示します。",
        "【不確定】提示された数値に重度のノイズを確認。晴天令の論理系は現在有効ではありません。荒天令の示す形のみを、現在の観測結果とします。",
        "【不測】波乱状態が固定。出された数値の中に本命の期待値は検出されません。荒天令の特異点を、演算の基点として出力します。",
        "【不安定】演算結果が定義域を逸脱。通常の論理推論はすべて停止しました。提示された荒天令の波形を、現在の最適解として固定します。",
        "【不確定】予測精度が許容限界を下回りました。この神託に対する通常の観測は継続不可能です。現時点で出力可能な数値は、荒天令のみとなります。",
        "【不確定】不確定要素が全域を被覆。安定した結果を導く変数は消失しています。出された荒天令の数字を、現在の事実として提示します。",
        "【不測】法則の逸脱を確認。この数値群の中に本命の期待値は存在しません。荒天令の特異な数字たちが、現在の演算結果のすべてです。",
        "【不安定】晴天令の信頼性は現在消失しました。計算が成立する地点は、提示された荒天令の数値の中にしか残されていません。"
    ],
        ichiyo: [
        "…あら？ ふわぁ…出された数字の中に、ひとつだけ**とっても綺麗な光（**${id}番**）**が見えますぅ。この数字だけが静かに主張しているみたいですぅ。",
        "…あら？ えっと、この結果に不思議な数値が出ていますぅ。計算の端っこで、誰にも気づかれずに光っている**数字（**${id}番**）**があるみたいですねぇ。",
        "…あら？ はいー、数字の意味を読み解くと、法則の隙間にひとつだけ**強い輝きを放つ特異点（**${id}番**）**を見つけましたぁ。今はその光を信じてみたくなりますねぇ。",
        "…あら？ わぁ、提示された数値を見てくださいですぅ。深い霧の中から、**${id}番**の数字だけが浮かび上がって見えますぅ。とっても珍しい気配を感じるんですぅ♪",
        "…あら？ もう一つ、この数字には**異質な輝き（**${id}番**）**を放っているものがありますぅ。この光がどこへ導いてくれるのか、静かに見守ってみたいですぅ。",
        "…あら？ ふふっ、出された数値の中に**真珠のような輝き（**${id}番**）**を見つけちゃいましたぁ。今のたまきには、この数字が一番真っ直ぐに光って見えているんですよぉ。",
        "…あら？ あのぉ、こちらの結果、ちょっとだけ特別な数値が出ているんですぅ。理を超えた場所で、**${id}番**の数字だけが凛として立っている感覚ですぅ。",
        "…あら？ 演算の結果、ひとつの特異な光が観測されましたぁ。派手な動きではないけれど、消えることのない**確かな輝き（**${id}番**）**が、その数字には宿っているみたいですねぇ。",
        "…あら？ はいー。この神託、法則が重なり合う中心で、ひっそりと強く光る**${id}番**を見つけましたぁ。たまきの目には、そこが一番明るく見えているんですぅ。",
        "…あら？ えへへ、提示された数字に驚いちゃいましたぁ。天の巡りが指し示した、**唯一の特異点（**${id}番**）**。その光が放つメッセージを、どう受け取ってくれますかぁ？"
    ]
};

  const TAMAKI_EXPRESSIONS = {
      index_0: 'smile',
      index_33: 'normal',
      index_67: 'worried',
      index_100: 'shocked',
      ichiyo: 'excited'
  };

  function getTamakiSpeech(tenunIndex, isIchiyo = false, playerId = null) {
      let speechArray;
      if (isIchiyo) {
          speechArray = TAMAKI_SPEECHES.ichiyo;
          const randomSpeech = speechArray[Math.floor(Math.random() * speechArray.length)];
          return randomSpeech.replace(/\$\{id\}/g, playerId);
      }
      if (tenunIndex === 0) speechArray = TAMAKI_SPEECHES.index_0;
      else if (tenunIndex === 33) speechArray = TAMAKI_SPEECHES.index_33;
      else if (tenunIndex === 67) speechArray = TAMAKI_SPEECHES.index_67;
      else if (tenunIndex === 100) speechArray = TAMAKI_SPEECHES.index_100;
      else {
          if (tenunIndex <= 16) speechArray = TAMAKI_SPEECHES.index_0;
          else if (tenunIndex <= 50) speechArray = TAMAKI_SPEECHES.index_33;
          else if (tenunIndex <= 83) speechArray = TAMAKI_SPEECHES.index_67;
          else speechArray = TAMAKI_SPEECHES.index_100;
      }
      return speechArray[Math.floor(Math.random() * speechArray.length)];
  }

  function getTamakiExpression(tenunIndex, isIchiyo = false) {
      if (isIchiyo) return TAMAKI_EXPRESSIONS.ichiyo;
      if (tenunIndex === 0) return TAMAKI_EXPRESSIONS.index_0;
      else if (tenunIndex === 33) return TAMAKI_EXPRESSIONS.index_33;
      else if (tenunIndex === 67) return TAMAKI_EXPRESSIONS.index_67;
      else if (tenunIndex === 100) return TAMAKI_EXPRESSIONS.index_100;
      if (tenunIndex <= 16) return TAMAKI_EXPRESSIONS.index_0;
      else if (tenunIndex <= 50) return TAMAKI_EXPRESSIONS.index_33;
      else if (tenunIndex <= 83) return TAMAKI_EXPRESSIONS.index_67;
      else return TAMAKI_EXPRESSIONS.index_100;
  }

  function generateTamakiTenunHTML(tenunIndex, isIchiyo = false, playerId = null) {
      if (typeof app.logMessage === 'function') {
          app.logMessage(`[TENUN] 天雲指数: ${tenunIndex} ${isIchiyo ? '(壱耀晴乾ノ象発動)' : ''}`);
      }
      const speech = getTamakiSpeech(tenunIndex, isIchiyo, playerId);
      const expression = getTamakiExpression(tenunIndex, isIchiyo);

      let cardClass = isIchiyo ? 'tenun-ichiyo' : (tenunIndex === 0 ? 'tenun-stable' : (tenunIndex <= 50 ? 'tenun-mild' : (tenunIndex <= 83 ? 'tenun-alert' : 'tenun-severe')));

      const expressionImages = {
          'smile': 'tamaki_smile.png',
          'normal': 'tamaki_normal.png',
          'worried': 'tamaki_worried.png',
          'shocked': 'tamaki_shocked.png',
          'excited': 'tamaki_smile.png'
      };
      const expressionImagePath = expressionImages[expression] || expressionImages['normal'];

      const titleText = isIchiyo ? '⚡ 壱耀晴乾ノ象 ⚡' : '天雲指数';
      const titleStyle = isIchiyo ? 'margin-top: 15px;' : 'margin-top: 25px;';

      return `
        <span class="tenun-title" style="font-weight: bold; font-size: 1.1em; color: #8b6d00; ${titleStyle} margin-bottom: 10px; display: block;">${titleText}</span>
        <div class="tenun-index-container ${cardClass}">
            <div class="tamaki-display">
                <div class="tamaki-character">
                    <img src="${expressionImagePath}" alt="環ちゃん" class="tamaki-image" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                    <div class="tamaki-placeholder" style="display: none;"><div class="tamaki-placeholder-icon">🌸</div></div>
                </div>
                <div class="tamaki-speech-bubble">
                    <div class="tamaki-name">🌸 七曜院パラドキサ環</div>
                    <div class="tamaki-speech-text" id="tamaki-speech-text">${speech}</div>
                </div>
            </div>
        </div>`;
  }

  const TAMAKI_CSS = `
<style>
/* タイトルのスタイル修正 */
.tenun-title {
    border-bottom: 2px solid rgba(139, 109, 0, 0.2);
    padding-bottom: 6px;
    letter-spacing: 0.05em;
}

.tenun-index-container {
    margin: 5px 0 25px 0; padding: 20px; border-radius: 12px; border: 3px solid;
    background: linear-gradient(135deg, #ffffff 0%, #fffdf7 100%);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); transition: all 0.3s ease;
}
.tenun-stable { border-color: #557755; background: #f0fff0; }
.tenun-mild { border-color: #698b69; background: #f7fff7; }
.tenun-alert { border-color: #d6a300; background: #fff9e6; }
.tenun-severe { border-color: #c07777; background: #fff0f0; }
.tenun-ichiyo { border-color: #ffd700; background: #fffef0; box-shadow: 0 0 20px rgba(255, 215, 0, 0.3); }

.tamaki-display { display: flex; gap: 15px; align-items: flex-start; }
.tamaki-character { flex-shrink: 0; width: 90px; height: auto; }
.tamaki-image { width: 100%; height: auto; border-radius: 10px; }
.tamaki-speech-bubble {
    flex: 1; background: #fafaf8; border: 2px solid #d6a300; border-radius: 15px;
    padding: 12px; position: relative; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}
.tamaki-speech-bubble::before {
    content: ''; position: absolute; left: -10px; top: 15px;
    border-style: solid; border-width: 8px 10px 8px 0; border-color: transparent #d6a300 transparent transparent;
}
.tamaki-speech-bubble::after {
    content: ''; position: absolute; left: -6px; top: 17px;
    border-style: solid; border-width: 6px 8px 6px 0; border-color: transparent #fafaf8 transparent transparent;
}
.tamaki-name { font-size: 0.85em; font-weight: bold; color: #8b2222; margin-bottom: 5px; }
.tamaki-speech-text { line-height: 1.6; color: #333; font-size: 0.9em; }
.tamaki-speech-text strong { color: #c07777; font-weight: bold; }

@media (max-width: 600px) {
    .tenun-title { font-size: 1.05em !important; margin-top: 20px !important; }
    .tenun-index-container { margin: 5px 0 15px 0; padding: 12px; }
    .tamaki-character { width: 75px; }
    .tamaki-speech-bubble { padding: 10px; }
    .tamaki-speech-text { font-size: 0.85em; line-height: 1.5; }
}
</style>`;

  app.generateTamakiTenunHTML = generateTamakiTenunHTML;
  app.TAMAKI_CSS = TAMAKI_CSS;
})(App);