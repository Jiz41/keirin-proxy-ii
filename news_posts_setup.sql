CREATE TABLE news_posts (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT        NOT NULL,
  url          TEXT        NOT NULL UNIQUE,
  category     TEXT,
  color        INT,
  published_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX news_posts_published_idx ON news_posts (published_at DESC);
