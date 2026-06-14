/**
 * PM2 Ecosystem Config – Bà Miên Vote
 *
 * Lệnh thường dùng:
 *   pm2 start ecosystem.config.cjs      # Khởi động
 *   pm2 restart bamien-vote             # Restart
 *   pm2 reload bamien-vote              # Zero-downtime reload
 *   pm2 stop bamien-vote                # Dừng
 *   pm2 logs bamien-vote                # Xem log real-time
 *   pm2 status                          # Xem trạng thái
 *   pm2 startup && pm2 save             # Tự chạy khi reboot server
 */

const fs = require("fs");
const path = require("path");

// Đọc .env thủ công (không cần thư viện dotenv)
function loadEnv(envPath) {
  const env = {};
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
      env[key] = val;
    }
  }
  return env;
}

const envVars = loadEnv(path.join(__dirname, ".env"));

module.exports = {
  apps: [
    {
      name: "bamien-vote",
      script: "bun",
      args: "run src/index.ts",
      cwd: __dirname,

      // Không dùng --watch trong production; PM2 tự restart khi crash
      watch: false,

      // Biến môi trường – đọc từ .env
      env: {
        NODE_ENV: "production",
        PORT: envVars.PORT || "3005",
        ADMIN_PASSWORD: envVars.ADMIN_PASSWORD || "",
      },

      // Tự restart nếu crash
      max_restarts: 10,
      restart_delay: 3000,
      min_uptime: "5s",

      // Log files
      out_file: "/home/mayddns-bamien/logs/bamien-vote.out.log",
      error_file: "/home/mayddns-bamien/logs/bamien-vote.err.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss",

      // Dùng bun trực tiếp, không qua node interpreter
      interpreter: "none",
    },
  ],
};
