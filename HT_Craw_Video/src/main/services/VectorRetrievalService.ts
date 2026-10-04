import { readFile } from 'node:fs/promises';
import { MODEL_VERSION } from '../../shared/constants/defaults';
import { CosineVectorIndex, type VectorMatch } from './VectorIndex';

export interface VectorCandidate { id:string; embeddingPath:string|null; contentHash:string|null }
export class VectorRetrievalService {
  async retrieve(queryPath:string|undefined,candidates:VectorCandidate[],limit:number):Promise<{kind:'cosine';dimension:number;matches:VectorMatch[]}|null>{
    const query=await this.read(queryPath);if(!query.length)return null;
    const index=new CosineVectorIndex(query.length);
    for(const candidate of candidates){const vector=await this.read(candidate.embeddingPath??undefined);if(vector.length!==query.length)continue;index.upsert({id:candidate.id,vector,contentHash:candidate.contentHash??candidate.id,modelVersion:MODEL_VERSION})}
    return{kind:index.kind,dimension:index.dimension,matches:index.search(query,limit)};
  }
  private async read(path?:string){if(!path)return[];try{const value=JSON.parse(await readFile(path,'utf8'));return Array.isArray(value)&&value.every(Number.isFinite)?value as number[]:[]}catch{return[]}}
}
