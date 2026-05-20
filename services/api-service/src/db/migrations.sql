CREATE TYPE media_status AS ENUM ('uploaded', 'processing', 'ready', 'failed');

CREATE TABLE media_files (
  id BIGSERIAL PRIMARY KEY,
  user_id VARCHAR(256) NOT NULL,
  file_url TEXT,
  status media_status NOT NULL DEFAULT 'uploaded',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_media_user_created ON media_files(user_id, created_at DESC);
CREATE INDEX idx_media_status_created ON media_files(status, created_at);
