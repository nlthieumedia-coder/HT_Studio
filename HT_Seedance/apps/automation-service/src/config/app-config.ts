import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';

export interface AppConfig {
  env: 'development' | 'production' | 'test';
  host: string;
  port: number;
  authToken: string;
  dataDir: string;
  dbPath: string;
  profilesDir: string;
  projectsDir: string;
  downloadsDir: string;
  logsDir: string;
  tempDir: string;
  browsersDir: string;
}

const resolveBaseDataDir = (): string => {
  if (process.env.HT_DOLA_DATA_DIR) {
    return path.resolve(process.env.HT_DOLA_DATA_DIR);
  }

  const isProd = process.env.NODE_ENV === 'production';
  if (isProd && process.platform === 'win32') {
    const appData = process.env.APPDATA || path.join(process.env.USERPROFILE || 'C:\\', 'AppData', 'Roaming');
    return path.join(appData, 'HT_Dola_Studio', 'data');
  }

  // Development / fallback path: repository root / data
  const repoRoot = path.resolve(process.cwd(), '..', '..');
  const devDataDir = path.join(repoRoot, 'data');
  if (fs.existsSync(devDataDir)) {
    return devDataDir;
  }
  return path.resolve(process.cwd(), 'data');
};

const baseDataDir = resolveBaseDataDir();

const ensureDirectories = (base: string) => {
  const dirs = [
    base,
    path.join(base, 'profiles'),
    path.join(base, 'projects'),
    path.join(base, 'downloads'),
    path.join(base, 'logs'),
    path.join(base, 'temp'),
    path.join(base, 'browsers'),
  ];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
};

ensureDirectories(baseDataDir);

const getOrGenerateAuthToken = (logsDir: string): string => {
  if (process.env.HT_DOLA_AUTH_TOKEN) {
    return process.env.HT_DOLA_AUTH_TOKEN;
  }
  const tokenFile = path.join(logsDir, '.auth_token');
  if (fs.existsSync(tokenFile)) {
    try {
      const existing = fs.readFileSync(tokenFile, 'utf8').trim();
      if (existing) return existing;
    } catch {
      // Regenerate if read error
    }
  }
  const newToken = crypto.randomBytes(32).toString('hex');
  try {
    fs.writeFileSync(tokenFile, newToken, 'utf8');
  } catch {
    // Fallback in-memory
  }
  return newToken;
};

const logsDir = path.join(baseDataDir, 'logs');
const browsersDir = process.env.PLAYWRIGHT_BROWSERS_PATH
  ? path.resolve(process.env.PLAYWRIGHT_BROWSERS_PATH)
  : path.join(baseDataDir, 'browsers');

process.env.PLAYWRIGHT_BROWSERS_PATH = browsersDir;
if (!fs.existsSync(browsersDir)) fs.mkdirSync(browsersDir, { recursive: true });

export const appConfig: AppConfig = {
  env: (process.env.NODE_ENV as AppConfig['env']) || 'development',
  host: '127.0.0.1', // Strictly 127.0.0.1, never 0.0.0.0
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3001,
  authToken: getOrGenerateAuthToken(logsDir),
  dataDir: baseDataDir,
  dbPath: path.join(baseDataDir, 'ht_dola_studio.db'),
  profilesDir: path.join(baseDataDir, 'profiles'),
  projectsDir: path.join(baseDataDir, 'projects'),
  downloadsDir: path.join(baseDataDir, 'downloads'),
  logsDir: logsDir,
  tempDir: path.join(baseDataDir, 'temp'),
  browsersDir,
};
