import { cosineSimilarity } from "../../shared/utils";

export interface VectorRecord {
  id: string;
  vector: number[];
  contentHash: string;
  modelVersion: string;
}
export interface VectorMatch {
  id: string;
  score: number;
}
export interface VectorIndex {
  readonly kind: "hnswlib" | "cosine";
  readonly dimension: number;
  upsert(record: VectorRecord): void;
  search(vector: number[], limit: number): VectorMatch[];
  clear(): void;
}

export class CosineVectorIndex implements VectorIndex {
  readonly kind = "cosine" as const;
  private records = new Map<string, VectorRecord>();
  private cacheKeys = new Set<string>();
  constructor(readonly dimension: number) {
    if (!Number.isInteger(dimension) || dimension <= 0)
      throw new Error("Kích thước vector phải là số nguyên dương");
  }
  upsert(record: VectorRecord) {
    if (record.vector.length !== this.dimension)
      throw new Error(`Vector phải có ${this.dimension} chiều`);
    const cacheKey = `${record.contentHash}:${record.modelVersion}:${record.vector.length}`;
    if (this.cacheKeys.has(cacheKey)) return;
    this.records.set(record.id, record);
    this.cacheKeys.add(cacheKey);
  }
  search(vector: number[], limit: number) {
    if (vector.length !== this.dimension)
      throw new Error(`Vector truy vấn phải có ${this.dimension} chiều`);
    return [...this.records.values()]
      .map((record) => ({
        id: record.id,
        score: cosineSimilarity(vector, record.vector),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(0, limit));
  }
  clear() {
    this.records.clear();
    this.cacheKeys.clear();
  }
}
