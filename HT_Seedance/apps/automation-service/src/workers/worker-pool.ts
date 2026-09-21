import { Worker } from '@ht-dola/shared';
import { logger } from '../logging/logger.js';

export class WorkerPool {
  private workers: Map<string, Worker> = new Map();

  constructor(maxWorkers: number = 2) {
    for (let i = 0; i < maxWorkers; i++) {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const worker: Worker = {
        id,
        name: `Worker-${i + 1}`,
        status: 'IDLE',
        startedAt: now,
        lastHeartbeatAt: now,
      };
      this.workers.set(id, worker);
    }
  }

  public getAvailableWorker(): Worker | undefined {
    for (const worker of this.workers.values()) {
      if (worker.status === 'IDLE') {
        return worker;
      }
    }
    return undefined;
  }

  public assignJob(workerId: string, jobId: string): void {
    const worker = this.workers.get(workerId);
    if (worker) {
      worker.status = 'BUSY';
      worker.currentJobId = jobId;
      worker.lastHeartbeatAt = new Date().toISOString();
      logger.info({ workerId, jobId }, 'Assigned job to worker');
    }
  }

  public releaseWorker(workerId: string): void {
    const worker = this.workers.get(workerId);
    if (worker) {
      worker.status = 'IDLE';
      delete worker.currentJobId;
      worker.lastHeartbeatAt = new Date().toISOString();
      logger.info({ workerId }, 'Released worker');
    }
  }

  public getActiveWorkerCount(): number {
    let count = 0;
    for (const worker of this.workers.values()) {
      if (worker.status === 'BUSY') count++;
    }
    return count;
  }

  public getAll(): Worker[] {
    return Array.from(this.workers.values());
  }
}

export const workerPool = new WorkerPool();
