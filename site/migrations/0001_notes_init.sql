-- 每次应用启动上报一条记录。
-- 不存 IP、不存 UA、不存硬件信息，只有随机 device_id 与请求侧的城市级定位。
CREATE TABLE IF NOT EXISTS launches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  date TEXT NOT NULL,
  country TEXT,
  region TEXT,
  city TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_launches_date ON launches (date);
CREATE INDEX IF NOT EXISTS idx_launches_device ON launches (device_id);
CREATE INDEX IF NOT EXISTS idx_launches_city ON launches (city);
