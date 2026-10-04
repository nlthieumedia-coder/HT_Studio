import { EventEmitter } from 'node:events';
import type { JobStatus, ProgressEvent, SearchMode, SearchRequest } from '../../shared/types';
import type { Repositories } from '../database/repositories';
import type { MediaAnalysisEngine } from './MediaAnalysisEngine';
import { rank } from './SimilarityEngine';
import { VectorRetrievalService } from './VectorRetrievalService';

export class SearchJobService extends EventEmitter {
  private controllers = new Map<string, AbortController>();
  constructor(private repo: Repositories, private engine: MediaAnalysisEngine, private vectors = new VectorRetrievalService()) { super(); }
  private async progress(id: string, progress: number, step: string, status: JobStatus = 'running') {
    await this.repo.updateJob(id, { progress, currentStep: step, status });
    this.emit('progress', { jobId: id, progress, step, status } satisfies ProgressEvent);
  }
  async start(input: SearchRequest) {
    const job = await this.repo.createJob({ sourceFile: input.sourceFile, searchMode: input.mode, datasetIds: JSON.stringify(input.datasetIds) });
    const controller = new AbortController(); this.controllers.set(job.id, controller); void this.run(job.id, input, controller.signal);
    return { ...job, searchMode: input.mode as SearchMode, datasetIds: input.datasetIds };
  }
  private async run(id: string, input: SearchRequest, signal: AbortSignal) {
    try {
      await this.progress(id, 5, 'Phân tích video mẫu');
      const source = await this.engine.analyze(input.sourceFile, input.level !== 'fast', signal);
      if (signal.aborted) throw new Error('Đã hủy tác vụ');
      await this.progress(id, 30, 'Lọc ứng viên');
      const all = await this.repo.candidates(input.datasetIds);
      const cheap = all.map(x => ({ x, score: rank(input.mode, source, { ...(x.features ?? {}), ...x.item }).totalScore, vectorScore: 0 })).sort((a, b) => b.score - a.score).slice(0, input.level === 'fast' ? 100 : 300);
      await this.repo.updateJob(id, { candidateCount: cheap.length });
      await this.progress(id, 45, 'Truy xuất véc-tơ cục bộ');
      const retrieval = await this.vectors.retrieve(source.embeddingPath, cheap.map(row => ({ id: row.x.item.id, embeddingPath: row.x.features?.visualEmbeddingPath ?? null, contentHash: row.x.item.fileHash })), cheap.length);
      const vectorScores = new Map(retrieval?.matches.map(match => [match.id, match.score]) ?? []);
      for (const row of cheap) row.vectorScore = vectorScores.get(row.x.item.id) ?? 0;
      cheap.sort((a, b) => (b.score * .8 + b.vectorScore * 20) - (a.score * .8 + a.vectorScore * 20));
      const deepLimit = Math.min(input.level === 'deep' ? 50 : input.level === 'balanced' ? 30 : 20, cheap.length);
      await this.progress(id, 55, 'Xếp hạng và tạo bằng chứng');
      let done = 0;
      for (const row of cheap.slice(0, input.limit)) {
        if (signal.aborted) throw new Error('Đã hủy tác vụ');
        const score = rank(input.mode, source, { ...(row.x.features ?? {}), ...row.x.item });
        if (retrieval) { score.totalScore = Math.round(Math.min(100, score.totalScore * .8 + row.vectorScore * 20) * 100) / 100; score.visualScore = Math.max(score.visualScore, row.vectorScore * 100); Object.assign(score.evidence, { vectorSimilarity: row.vectorScore, vectorIndex: retrieval.kind, vectorDimension: retrieval.dimension }); }
        await this.repo.addResult({ searchJobId: id, datasetItemId: row.x.item.id, matchType: input.mode, ...score, evidenceJson: JSON.stringify(score.evidence), confidence: score.totalScore >= 80 ? 'high' : score.totalScore >= 50 ? 'medium' : 'low', feedback: null });
        done++; await this.progress(id, 55 + Math.round(40 * done / Math.max(1, Math.min(input.limit, cheap.length))), 'Đang lưu kết quả');
      }
      await this.repo.updateJob(id, { status: 'completed', progress: 100, currentStep: 'Hoàn tất', deepAnalysisCount: deepLimit, completedAt: new Date().toISOString() });
      this.emit('progress', { jobId: id, progress: 100, step: 'Hoàn tất', status: 'completed' } satisfies ProgressEvent);
    } catch (error) {
      const cancelled = signal.aborted; const status: JobStatus = cancelled ? 'cancelled' : 'failed';
      await this.repo.updateJob(id, { status, currentStep: cancelled ? 'Đã hủy' : 'Lỗi', errorMessage: error instanceof Error ? error.message : String(error), completedAt: new Date().toISOString() });
      this.emit('progress', { jobId: id, progress: 0, step: cancelled ? 'Đã hủy' : 'Lỗi', status } satisfies ProgressEvent);
    } finally { this.controllers.delete(id); }
  }
  cancel(id: string) { this.controllers.get(id)?.abort(); }
}
