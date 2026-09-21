import { Job, JobState } from '@ht-dola/shared';
import { logger } from '../logging/logger.js';

export class JobQueue {
  private queue: Job[] = [];

  public enqueue(job: Job): void {
    job.state = JobState.QUEUED;
    this.queue.push(job);
    logger.info({ jobId: job.id, queueLength: this.queue.length }, 'Enqueued job');
  }

  public dequeue(): Job | undefined {
    return this.queue.shift();
  }

  public peek(): Job | undefined {
    return this.queue[0];
  }

  public size(): number {
    return this.queue.length;
  }

  public remove(jobId: string): boolean {
    const index = this.queue.findIndex((j) => j.id === jobId);
    if (index !== -1) {
      this.queue.splice(index, 1);
      logger.info({ jobId }, 'Removed job from queue');
      return true;
    }
    return false;
  }

  public getAll(): ReadonlyArray<Job> {
    return [...this.queue];
  }
}

export const jobQueue = new JobQueue();
