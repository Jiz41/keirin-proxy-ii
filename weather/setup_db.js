// setup_db.js — ~/keirin_weather.db の初期化
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(process.env.HOME || '/root', 'keirin_weather.db');
const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS races (
    date     TEXT    NOT NULL,
    venue    TEXT    NOT NULL,
    race_no  INTEGER NOT NULL,
    rank_1   INTEGER,
    rank_2   INTEGER,
    rank_3   INTEGER,
    rank_4   INTEGER,
    rank_5   INTEGER,
    rank_6   INTEGER,
    rank_7   INTEGER,
    rank_8   INTEGER,
    rank_9   INTEGER,
    kimari   TEXT,
    temp     REAL,
    humidity REAL,
    PRIMARY KEY (date, venue, race_no)
  )
`);

console.log('DB initialized:', DB_PATH);
db.close();
