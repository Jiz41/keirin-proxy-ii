-- execution_logs テーブル
-- スケジューラの実行ログ（found / not_found）
CREATE TABLE execution_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  executed_at TIMESTAMPTZ NOT NULL    DEFAULT now(),
  result      TEXT        NOT NULL    CHECK (result IN ('found', 'not_found')),
  race_id     TEXT,
  venue       TEXT,
  race_num    INT
);

-- サイト側でのポーリング高速化用インデックス
CREATE INDEX execution_logs_executed_at_idx ON execution_logs (executed_at DESC);
