import { startRecoveryServer, startServer } from './api/server.js';
import { logger } from './logging/logger.js';
import { closeDb, getDb } from './db/database.js';
import { RecoveryService } from './services/RecoveryService.js';
import { auditLog } from './logging/audit-log.js';
import {
  ensureChromiumInstalled,
  getChromiumInstallationStatus,
} from './services/BrowserInstallationService.js';
import { DatabaseRecoveryService } from './services/DatabaseRecoveryService.js';
import { appConfig } from './config/app-config.js';
import fs from 'node:fs';
import { RestoreService } from './services/RestoreService.js';
import { ProductionRunService } from './services/ProductionRunService.js';

logger.info('Initializing HT_Dola_Studio automation service entry point');
let recoveryMode = false;
if (fs.existsSync(appConfig.dbPath)) {
  const integrity = new DatabaseRecoveryService().quickCheck();
  if (!integrity.safe) {
    await startRecoveryServer({ integrity, databasePath: appConfig.dbPath });
    // Recovery server intentionally excludes queue, workers, browsers, and normal database routes.
    recoveryMode = true;
  }
}
if (recoveryMode) {
  // Recovery mode remains active until the process is explicitly stopped.
  await new Promise(() => undefined);
}
auditLog({
  level: 'INFO',
  module: 'service',
  event: 'startup',
  message: 'Automation service initializing.',
});
const pendingRestorePath = `${appConfig.dbPath}.pending-restore.json`;
if (fs.existsSync(pendingRestorePath)) {
  const pending = JSON.parse(fs.readFileSync(pendingRestorePath, 'utf8')) as {
    path: string;
    safetyDestination: string;
  };
  const database = getDb();
  try {
    await new RestoreService(database, appConfig.dbPath).restore(pending.path, {
      confirmation: true,
      safetyDestination: pending.safetyDestination,
      beforeSwitch: closeDb,
    });
    fs.rmSync(pendingRestorePath, { force: true });
    logger.info(
      { event: 'pending_restore_completed' },
      'Pending restore completed; restarting service is required.',
    );
    process.exit(0);
  } catch (error) {
    fs.renameSync(pendingRestorePath, `${pendingRestorePath}.failed-${Date.now()}`);
    logger.fatal(
      { event: 'pending_restore_failed', error },
      'Pending restore failed; original data was preserved.',
    );
    process.exit(1);
  }
}
const interrupted = new RecoveryService(getDb()).recoverStartupInterrupted();
const interruptedRuns = new ProductionRunService(getDb()).recover();
if (interrupted)
  logger.warn({ interrupted }, 'Recovered unsafe active jobs as interrupted after restart');
if (interruptedRuns) logger.warn({ interruptedRuns }, 'Recovered active production runs as interrupted after restart');

if (process.env.HT_DOLA_AUTO_INSTALL_BROWSERS === '1') {
  const status = ensureChromiumInstalled();
  auditLog({
    level: status.ok ? 'INFO' : 'ERROR',
    module: 'playwright',
    event: 'chromium_install_check',
    message: status.ok
      ? 'Chromium is available for Playwright.'
      : 'Chromium is unavailable for Playwright.',
    metadata: {
      browsersDir: status.browsersDir,
      attemptedInstall: status.attemptedInstall,
      error: status.error,
    },
  });
} else {
  const status = getChromiumInstallationStatus();
  logger.info(
    { browsersDir: status.browsersDir, installed: status.installed },
    'Playwright Chromium installation status.',
  );
}

startServer().catch((err) => {
  logger.fatal({ err }, 'Unhandled exception during service startup');
  process.exit(1);
});
