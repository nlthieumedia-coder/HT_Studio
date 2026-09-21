import path from 'node:path';
import fs from 'node:fs';
import pino from 'pino';
import { appConfig } from '../config/app-config.js';

const logFilePath = path.join(appConfig.logsDir, 'automation-service.log');
const maxLogBytes = Number(process.env.HT_DOLA_LOG_MAX_BYTES ?? 5 * 1024 * 1024);
const maxRotatedFiles = Number(process.env.HT_DOLA_LOG_ROTATIONS ?? 5);

const rotateLogs = () => {
  try {
    if (!fs.existsSync(logFilePath) || fs.statSync(logFilePath).size < maxLogBytes) return;
    for (let index = maxRotatedFiles - 1; index >= 1; index -= 1) {
      const source = `${logFilePath}.${index}`;
      const target = `${logFilePath}.${index + 1}`;
      if (fs.existsSync(source)) fs.renameSync(source, target);
    }
    fs.renameSync(logFilePath, `${logFilePath}.1`);
  } catch {
    // Logging must never stop service startup.
  }
};

rotateLogs();

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  timestamp: pino.stdTimeFunctions.isoTime,
  base: null,
  redact: {
    paths: [
      'authToken',
      'token',
      '*.authToken',
      '*.token',
      '*.password',
      '*.cookies',
      '*.storageState',
      'req.headers.authorization',
      'req.headers.cookie',
    ],
    censor: '[REDACTED]',
  },
  transport: {
    targets: [
      {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      },
      {
        target: 'pino/file',
        options: {
          destination: logFilePath,
          mkdir: true,
        },
      },
    ],
  },
});
