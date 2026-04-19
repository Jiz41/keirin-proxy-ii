(function(app) {
  if (app && typeof app.logMessage === 'function') {
    app.logMessage('[DEBUG] shakkou_donperi_core.js 開始');
  }
// ============================================================================
// 儀術『赤口呑縁（しゃっこうどんぺり）』コア実装
// ============================================================================
// 五更斎アメンティア清音による、1465の並行世界シミュレーション
// ============================================================================

// ----------------------------------------------------------------------------
// 🔧 parseLines：カオス事象用ライン解析ラッパー
// ----------------------------------------------------------------------------
function parseLines(lineInput) {
    if (!lineInput) return [];
    const processedInput = lineInput.replace(/\s/g, '');
    const segments = processedInput.split(',');
    return segments.map(seg => {
        // 競り記法 1(2) → 両選手をライン員として扱う
        const clean = seg.replace(/\((\d)\)/g, '$1');
        return clean.split('').map(Number).filter(id => id > 0);
    }).filter(line => line.length > 0);
}

// ----------------------------------------------------------------------------
// 🌌 世界線定義テーブル
// ----------------------------------------------------------------------------

// weight値：各世界線の出現頻度（各grade合計 = TOTAL_ITERATIONSの1465に統一）
// S級：W0(879/1465≒60%) が支配的 ── 実力通りに決まりやすい
// チャレンジ：W0=W1=366 ── 純正と崩壊が同率の混沌設計
// weight = その世界線が選ばれる世界線数として直読できる
const SHAKKOU_WORLD_TABLE = {
    's-kyu': [
        { id: 'W0', name: '物理純正世界', weight: 879, events: [] },
        { id: 'W1', name: 'ライン微崩壊', weight: 147, events: ['line_breakdown_mild'] },
        { id: 'W2', name: '早仕掛け単発', weight: 117, events: ['early_attack'] },
        { id: 'W3', name: '突風世界', weight: 103, events: ['wind_gust'] },
        { id: 'W4', name: '競り番狂わせ', weight: 88, events: ['seri_upset'] },
        { id: 'W5', name: '複合カオスA', weight: 59, events: ['line_breakdown_mild', 'early_attack'] },
        { id: 'W6', name: '複合カオスB', weight: 44, events: ['wind_gust', 'seri_upset'] },
        { id: 'W7', name: '落車世界', weight: 28, events: ['crash'] }
    ],
    
    'a-kyu': [
        { id: 'W0', name: '物理純正世界', weight: 586, events: [] },
        { id: 'W1', name: 'ライン崩壊', weight: 293, events: ['line_breakdown'] },
        { id: 'W2', name: '早仕掛け失敗', weight: 176, events: ['early_attack_fail'] },
        { id: 'W3', name: '早仕掛け成功', weight: 88, events: ['early_attack_success'] },
        { id: 'W4', name: '突風世界', weight: 117, events: ['wind_gust'] },
        { id: 'W5', name: '競り番狂わせ', weight: 103, events: ['seri_upset'] },
        { id: 'W6', name: '複合カオスA', weight: 59, events: ['line_breakdown', 'wind_gust'] },
        { id: 'W7', name: '複合カオスB', weight: 29, events: ['early_attack', 'seri_upset'] },
        { id: 'W8', name: '落車世界', weight: 14, events: ['crash'] }
    ],
    
    'a-chal': [
        { id: 'W0', name: '物理純正世界', weight: 249, events: [] },
        { id: 'W1', name: 'ライン完全崩壊', weight: 366, events: ['line_breakdown_severe'] },
        { id: 'W2', name: '無謀な早仕掛け', weight: 220, events: ['reckless_attack'] },
        { id: 'W3', name: 'ルーキー暴走', weight: 147, events: ['rookie_rampage'] },
        { id: 'W4', name: '捲り自滅', weight: 117, events: ['makuri_suicide'] },
        { id: 'W5', name: 'ダークホース覚醒', weight: 103, events: ['dark_horse'] },
        { id: 'W6', name: '複合カオスA', weight: 59, events: ['line_breakdown', 'early_attack'] },
        { id: 'W7', name: '複合カオスB', weight: 44, events: ['rookie_rampage', 'crash'] },
        { id: 'W8', name: '落車世界', weight: 29, events: ['crash'] },
        { id: 'W9', name: '完全崩壊世界', weight: 14, events: ['line_breakdown_severe', 'crash', 'dark_horse'] },
        { id: 'W10', name: '逃げ切り成功', weight: 117, events: ['escape_success'] }
    ],
    
    'girls': [
        { id: 'W0', name: '物理純正世界', weight: 733, events: [] },
        { id: 'W1', name: 'ライン微崩壊', weight: 220, events: ['line_breakdown_mild'] },
        { id: 'W2', name: '早仕掛け', weight: 147, events: ['early_attack'] },
        { id: 'W3', name: '突風世界', weight: 147, events: ['wind_gust'] },
        { id: 'W4', name: '競り番狂わせ', weight: 117, events: ['seri_upset'] },
        { id: 'W5', name: '複合カオス', weight: 73, events: ['line_breakdown_mild', 'early_attack'] },
        { id: 'W6', name: '落車世界', weight: 28, events: ['crash'] }
    ]
};

// ----------------------------------------------------------------------------
// 🎲 世界線抽選関数
// ----------------------------------------------------------------------------

function selectWorldLine(grade) {
    const worldTable = SHAKKOU_WORLD_TABLE[grade];
    if (!worldTable) {
        console.error(`[赤口呑縁] 未知の階級: ${grade}`);
        return { id: 'W0', name: '物理純正世界', weight: 1, events: [] };
    }
    
    const totalWeight = worldTable.reduce((sum, w) => sum + w.weight, 0);
    const rand = Math.random() * totalWeight;
    
    let cumulative = 0;
    for (const world of worldTable) {
        cumulative += world.weight;
        if (rand < cumulative) {
            return world;
        }
    }
    
    return worldTable[0];
}

// ----------------------------------------------------------------------------
// 🧪 カオス注入関数（メイン）
// ----------------------------------------------------------------------------

function applyChaos(players, events, context) {
    const occurredEvents = [];
    
    events.forEach(eventType => {
        switch (eventType) {
            case 'line_breakdown_mild':
                applyLineBreakdownMild(players, context);
                occurredEvents.push('ライン微崩壊');
                break;
                
            case 'line_breakdown':
                applyLineBreakdown(players, context);
                occurredEvents.push('ライン崩壊');
                break;
                
            case 'line_breakdown_severe':
                applyLineBreakdownSevere(players, context);
                occurredEvents.push('ライン完全崩壊');
                break;
                
            case 'early_attack':
                applyEarlyAttack(players, context, 0.60);
                occurredEvents.push('早仕掛け');
                break;
                
            case 'early_attack_success':
                applyEarlyAttack(players, context, 1.0);
                occurredEvents.push('早仕掛け成功');
                break;
                
            case 'early_attack_fail':
                applyEarlyAttack(players, context, 0.0);
                occurredEvents.push('早仕掛け失敗');
                break;
                
            case 'reckless_attack':
                applyRecklessAttack(players, context);
                occurredEvents.push('無謀な早仕掛け');
                break;
                
            case 'wind_gust':
                applyWindGust(players, context);
                occurredEvents.push('突風');
                break;
                
            case 'seri_upset':
                applySeriUpset(players, context);
                occurredEvents.push('競り番狂わせ');
                break;
                
            case 'crash':
                applyCrash(players, context);
                occurredEvents.push('落車');
                break;
                
            case 'dark_horse':
                applyDarkHorse(players, context);
                occurredEvents.push('ダークホース覚醒');
                break;
                
            case 'rookie_rampage':
                applyRookieRampage(players, context);
                occurredEvents.push('ルーキー暴走');
                break;
                
            case 'makuri_suicide':
                applyMakuriSuicide(players, context);
                occurredEvents.push('捲り自滅');
                break;
            
            case 'escape_success':
                applyEscapeSuccess(players);
                occurredEvents.push('逃げ切り成功');
                break;
        }
    });
    
    return occurredEvents;
}

// ----------------------------------------------------------------------------
// 🔥 個別カオス事象関数
// ----------------------------------------------------------------------------

function applyLineBreakdownMild(players, context) {
    const lines = parseLines(context.lineInput);
    
    lines.forEach(line => {
        if (line.length < 2) return;
        
        const leader = players.find(p => p.id === line[0]);
        const bante = players.find(p => p.id === line[1]);
        
        if (leader) leader.final_score *= 0.85;
        if (bante) {
            bante.final_score *= (Math.random() < 0.5 ? 1.10 : 0.90);
        }
        
        players.forEach(p => {
            if (p.style === '追' && !line.some(lid => lid === p.id)) {
                p.final_score *= 1.15;
            }
        });
    });
}

function applyLineBreakdown(players, context) {
    const lines = parseLines(context.lineInput);
    
    lines.forEach(line => {
        if (line.length < 2) return;
        
        const leader = players.find(p => p.id === line[0]);
        const bante = players.find(p => p.id === line[1]);
        
        if (leader) leader.final_score *= 0.65;
        
        if (bante) {
            if (Math.random() < 0.60) {
                bante.final_score *= 1.25;
            } else {
                bante.final_score *= 0.75;
            }
        }
        
        line.slice(2).forEach(pid => {
            const player = players.find(pl => pl.id === pid);
            if (player) player.final_score *= 0.85;
        });
        
        players.forEach(p => {
            if (p.style === '追' && !line.some(lid => lid === p.id)) {
                p.final_score *= 1.30;
            }
        });
    });
}

function applyLineBreakdownSevere(players, context) {
    const lines = parseLines(context.lineInput);
    
    lines.forEach(line => {
        line.forEach(pid => {
            const player = players.find(p => p.id === pid);
            if (player) player.final_score *= 0.50;
        });
    });
    
    players.forEach(p => {
        if (p.style === '追' && !lines.some(line => line.includes(p.id))) {
            p.final_score *= 1.50;
        }
    });
}

function applyEarlyAttack(players, context, successRate) {
    const selfStarterIds = players.filter(p => p.style === '逃' || p.style === '自' || p.style === '両').map(p => p.id);
    
    if (selfStarterIds.length === 0) return;
    
    const attacker = players.find(p => p.id === selfStarterIds[Math.floor(Math.random() * selfStarterIds.length)]);
    
    if (!attacker) return;
    
    if (Math.random() < successRate) {
        attacker.final_score *= 1.40;
        
        players.forEach(p => {
            if (p.id !== attacker.id && p.style === '追') {
                p.final_score *= 1.10;
            } else if (p.id !== attacker.id) {
                p.final_score *= 0.85;
            }
        });
    } else {
        attacker.final_score *= 0.60;
        players.forEach(p => {
            if (p.id !== attacker.id) {
                p.final_score *= 1.05;
            }
        });
    }
}

function applyRecklessAttack(players, context) {
    const selfStarterIds = players.filter(p => p.style === '自' || p.style === '両').map(p => p.id);
    
    if (selfStarterIds.length === 0) return;
    
    const attacker = players.find(p => p.id === selfStarterIds[Math.floor(Math.random() * selfStarterIds.length)]);
    
    if (!attacker) return;
    
    attacker.final_score *= 0.40;
    
    players.forEach(p => {
        if (p.id !== attacker.id && p.style === '追') {
            p.final_score *= 1.30;
        }
    });
}

function applyWindGust(players, context) {
    const rand = Math.random(); // 突風の方向を1回だけ決定
    
    if (rand < 0.33) {
        // 追い風：先行・自走型に有利
        players.forEach(p => {
            if (p.style === '逃' || p.style === '自' || p.style === '両') {
                p.final_score *= 1.15;
            } else {
                p.final_score *= 0.95;
            }
        });
    } else if (rand < 0.66) {
        // 向かい風：差し・追い込みに有利
        players.forEach(p => {
            if (p.style === '追' || p.style === '両') {
                p.final_score *= 1.15;
            } else {
                p.final_score *= 0.90;
            }
        });
    }
    // 0.66以上：横風（影響なし）
}

function applySeriUpset(players, context) {
    if (players.length < 2) return;
    
    const randomIdx = Math.floor(Math.random() * players.length);
    const upsetPlayer = players[randomIdx];
    
    upsetPlayer.final_score *= 1.25;
}

function applyCrash(players, context) {
    if (players.length < 2) return;
    
    const crashVictim = players[Math.floor(Math.random() * players.length)];
    crashVictim.final_score *= 0.20;
}

function applyDarkHorse(players, context) {
    const lowScorePlayers = players.filter(p => p.score < 85);
    
    if (lowScorePlayers.length === 0) return;
    
    const darkHorse = lowScorePlayers[Math.floor(Math.random() * lowScorePlayers.length)];
    darkHorse.final_score *= 1.50;
}

function applyRookieRampage(players, context) {
    const rookies = players.filter(p => p.score < 90);
    
    if (rookies.length === 0) return;
    
    const rampager = rookies[Math.floor(Math.random() * rookies.length)];
    
    if (Math.random() < 0.40) {
        rampager.final_score *= 1.60;
    } else {
        rampager.final_score *= 0.50;
    }
}

function applyMakuriSuicide(players, context) {
    const makuriPlayers = players.filter(p => p.style === '両');
    
    if (makuriPlayers.length === 0) return;
    
    const suicider = makuriPlayers[Math.floor(Math.random() * makuriPlayers.length)];
    suicider.final_score *= 0.45;
    
    players.forEach(p => {
        if (p.id !== suicider.id && p.style === '追') {
            p.final_score *= 1.20;
        }
    });
}

function applyEscapeSuccess(players) {
    const escapers = players.filter(p => p.style === '逃');
    if (escapers.length === 0) return;
    
    const escaperId = escapers[
        Math.floor(Math.random() * escapers.length)
    ].id;
    
    players.forEach(p => {
        if (p.id === escaperId) {
            p.final_score *= 1.50;
        } else {
            p.final_score *= 0.85;
        }
    });
}

// ----------------------------------------------------------------------------
// 🎯 メイン実行関数：儀術発動
// ----------------------------------------------------------------------------

async function invokeShakkouDonperi(basePlayers, context) {
    // 1465：ドクター・ストレンジが観測した並行世界数へのオマージュ
    // （Marvel『インフィニティ・ウォー』：1400万605の未来から勝利への道を探す）
    // 競輪における「唯一の正解」を探す儀術として設定
    const TOTAL_ITERATIONS = 1465;
    // 50件ずつ非同期分割処理：UI応答性を確保するためのバッチサイズ
    // await setTimeout(0) と組み合わせてメインスレッドのブロックを防止
    const BATCH_SIZE = 50;

    app.logMessage(`[赤口] 世界蛇回路:嚥下開始 (${TOTAL_ITERATIONS}世界線)`);

    const allResults = [];

    for (let start = 0; start < TOTAL_ITERATIONS; start += BATCH_SIZE) {
        const end = Math.min(start + BATCH_SIZE, TOTAL_ITERATIONS);

        for (let i = start; i < end; i++) {
            const world = selectWorldLine(context.grade);
            const players = JSON.parse(JSON.stringify(basePlayers));

            players.forEach(p => {
                p.final_score = p.score * p.c_score_adj * p.c_recent * p.c_wmark * p.c_s1 * p.c_b1 * p.c_l * p.c_e;
            });

            const occurredEvents = applyChaos(players, world.events, context);

            const flutterMap = {
                's-kyu':  { min: 0.90, range: 0.20 },
                'a-kyu':  { min: 0.85, range: 0.30 },
                'girls':  { min: 0.85, range: 0.30 },
                'a-chal': { min: 0.80, range: 0.40 },
            };
            const flutter = flutterMap[context.grade] 
                || { min: 0.90, range: 0.20 };

            players.forEach(p => {
                p.final_score *= (flutter.min + Math.random() * flutter.range);
            });

            players.sort((a, b) => b.final_score - a.final_score);

            allResults.push({
                worldId: world.id,
                ranking: players.map((p, idx) => ({
                    id: p.id,
                    rank: idx + 1,
                    score: p.final_score
                })),
                events: occurredEvents
            });
        }

        // 500刻みで進捗ログ
        app.logMessage(`[赤口] 世界蛇回路:嚥下中... ${end} / ${TOTAL_ITERATIONS}`);

        await new Promise(resolve => setTimeout(resolve, 0));
    }

    const cosmosResult = cosmosObserver(allResults, basePlayers);

    app.logMessage(`[赤口] 世界蛇回路:嚥下完了`);

    return cosmosResult;
}

// ----------------------------------------------------------------------------
// 🔮 結果集計関数：魂の蒸留器
// ----------------------------------------------------------------------------

function cosmosObserver(allResults, basePlayers) {
    const rankCounter = {};
    const eventCounter = {};
    const worldCounter = {};
    
    // 初期化（7車固定）
    for (let i = 1; i <= 7; i++) {
        rankCounter[i] = {
            1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0
        };
    }
    
    // 集計
    allResults.forEach(result => {
        result.ranking.forEach(r => {
            if (rankCounter[r.id]) {
                rankCounter[r.id][r.rank]++;
            }
        });
        
        result.events.forEach(event => {
            eventCounter[event] = (eventCounter[event] || 0) + 1;
        });
        
        const worldId = result.worldId || 'W0';
        worldCounter[worldId] = (worldCounter[worldId] || 0) + 1;
    });
    
    // 統計値計算
    const statistics = [];
    for (let i = 1; i <= 7; i++) {
        const counts = rankCounter[i];
        const total = allResults.length;
        
        const winCount = counts[1];
        const rank2Count = counts[2];
        const rank3Count = counts[3];
        // 修正: 圏外は4着以下（1着〜3着を除いたもの）
        const outsideCount = total - winCount - rank2Count - rank3Count;
        
        const winProb = winCount / total;
        const top3Prob = (winCount + rank2Count + rank3Count) / total;
        
        const avgRank = Object.keys(counts).reduce((sum, rank) => {
            return sum + (parseInt(rank) * counts[rank]);
        }, 0) / total;
        
        const variance = Object.keys(counts).reduce((sum, rank) => {
            return sum + Math.pow(parseInt(rank) - avgRank, 2) * counts[rank];
        }, 0) / total;
        const stdDev = Math.sqrt(variance);
        
        statistics.push({
            id: i,
            winCount: winCount,
            rank2Count: rank2Count,
            rank3Count: rank3Count,
            outsideCount: outsideCount,
            winProbability: winProb,
            top3Probability: top3Prob,
            averageRank: avgRank,
            stdDev: stdDev,
            distribution: counts
        });
    }
    
    // 勝率順にソート
    statistics.sort((a, b) => b.winProbability - a.winProbability);
    
    // イベント別の最頻出目を計算
    const eventPatterns = {};
    Object.keys(eventCounter).forEach(eventName => {
        const eventResults = allResults.filter(r => r.events.includes(eventName));
        const patternCount = {};
        
        eventResults.forEach(r => {
            const top3 = r.ranking.slice(0, 3).map(p => p.id).join('-');
            patternCount[top3] = (patternCount[top3] || 0) + 1;
        });
        
        const sortedPatterns = Object.entries(patternCount)
            .sort((a, b) => b[1] - a[1]);
        
        if (sortedPatterns.length > 0) {
            eventPatterns[eventName] = {
                pattern: sortedPatterns[0][0],
                count: sortedPatterns[0][1],
                totalEventOccurrences: eventCounter[eventName]
            };
        }
    });
    
    // 全体の最頻出目（上位3つ）
    const allPatternCount = {};
    allResults.forEach(r => {
        const top3 = r.ranking.slice(0, 3).map(p => p.id).join('-');
        allPatternCount[top3] = (allPatternCount[top3] || 0) + 1;
    });
    
    const topPatterns = Object.entries(allPatternCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([pattern, count]) => ({ pattern, count }));
    
    // イベント統計
    const eventStats = Object.keys(eventCounter).map(event => ({
        event: event,
        occurrences: eventCounter[event],
        frequency: ((eventCounter[event] / allResults.length) * 100).toFixed(1) + '%',
        mostFrequentPattern: eventPatterns[event]
    }));
    
    return {
        statistics: statistics,
        topPatterns: topPatterns,
        eventStats: eventStats,
        worldStats: Object.keys(worldCounter).map(worldId => ({
            worldId: worldId,
            occurrences: worldCounter[worldId]
        })),
        metadata: {
            totalSimulations: allResults.length
        }
    };
}

// ----------------------------------------------------------------------------
// 🔗 既存コードとの統合用ラッパー関数
// ----------------------------------------------------------------------------

/**
 * 勝率をグレード1〜10に変換する
 * 7車レースの均等分布なら理論勝率≒14.3%
 * 30%以上で最高グレード10、2%未満で最低グレード1
 */
function calculateGradeFromProbability(winProb) {
    if (winProb >= 0.30) return 10;
    if (winProb >= 0.25) return 9;
    if (winProb >= 0.20) return 8;
    if (winProb >= 0.15) return 7;
    if (winProb >= 0.12) return 6;
    if (winProb >= 0.09) return 5;
    if (winProb >= 0.06) return 4;
    if (winProb >= 0.04) return 3;
    if (winProb >= 0.02) return 2;
    return 1;
}

/**
 * 勝率・3着内確率から競輪印（◎〇▲△×・）を返す
 * 勝率28%以上かつ3着内70%以上で本命◎
 * 勝率5%未満は消し（・）
 */
function generateStrengthMark(winProb, top3Prob) {
    if (winProb >= 0.28 && top3Prob >= 0.70) return '◎';
    if (winProb >= 0.20 && top3Prob >= 0.60) return '○';
    if (winProb >= 0.15 && top3Prob >= 0.50) return '▲';
    if (winProb >= 0.10 && top3Prob >= 0.40) return '△';
    if (winProb >= 0.05) return '×';
    return '・';
}
  
if (app && typeof app.logMessage === 'function') {
    app.logMessage('[DEBUG] invokeShakkouDonperi 実行開始');
  }
  app.invokeShakkouDonperi = invokeShakkouDonperi;
  
console.log('[赤口呑縁] コアシステム初期化完了');
})(App);
