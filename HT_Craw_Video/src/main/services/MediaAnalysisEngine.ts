import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { MODEL_VERSION, PIPELINE_VERSION } from '../../shared/constants/defaults';
import { sha256File } from '../../shared/utils';
import type { Repositories } from '../database/repositories';
import type { FFmpegService } from './FFmpegService';
import type { PythonWorkerBridge } from './PythonWorkerBridge';
import { PerceptualHashService } from './PerceptualHashService';
import { AudioFingerprintService } from './AudioFingerprintService';

export class MediaAnalysisEngine {
  private phash = new PerceptualHashService();
  private ahash = new AudioFingerprintService();
  constructor(private repo:Repositories, private ffmpeg:FFmpegService, private worker:PythonWorkerBridge, private cacheRoot:string) {}
  async analyze(path:string, deep=false, signal?:AbortSignal) {
    const hash=await sha256File(path), cached=await this.repo.cached(hash,PIPELINE_VERSION,MODEL_VERSION);
    if(cached)return{hash,...JSON.parse(cached.metadataJson??'{}'),...JSON.parse(cached.fingerprintJson??'{}'),transcript:JSON.parse(cached.transcriptJson??'{}').text??'',ocrText:JSON.parse(cached.ocrJson??'{}').text??'',embeddingPath:cached.embeddingPath??undefined,cacheHit:true};
    const dir=join(this.cacheRoot,hash);await mkdir(dir,{recursive:true});
    const metadata=await this.ffmpeg.metadata(path),thumbnail=await this.ffmpeg.thumbnail(path,dir),frames=await this.ffmpeg.keyframes(path,join(dir,'frames'),8),perceptualHash=await this.phash.compute(frames);
    let audioFingerprint='';if(metadata.hasAudio){const audio=join(dir,'audio.wav');await this.ffmpeg.extractAudio(path,audio,signal);audioFingerprint=await this.ahash.compute(audio)}
    let transcript='',ocrText='',visualEmbedding:number[]=[];
    if(deep){try{if(metadata.hasAudio)transcript=String((await this.worker.request('transcribe_audio',path,{},signal)).text??'')}catch{}try{ocrText=String((await this.worker.request('run_ocr',path,{},signal)).text??'')}catch{}try{visualEmbedding=(await this.worker.request('create_image_embedding',thumbnail,{},signal)).embedding as number[]??[]}catch{}}
    const embeddingPath=join(dir,'embedding.json');await writeFile(embeddingPath,JSON.stringify(visualEmbedding));
    await this.repo.addCache({contentHash:hash,sourcePath:path,pipelineVersion:PIPELINE_VERSION,modelVersion:MODEL_VERSION,metadataJson:JSON.stringify({...metadata,thumbnailPath:thumbnail}),fingerprintJson:JSON.stringify({perceptualHash,audioFingerprint}),transcriptJson:JSON.stringify({text:transcript}),ocrJson:JSON.stringify({text:ocrText}),embeddingPath});
    return{hash,...metadata,thumbnailPath:thumbnail,perceptualHash,audioFingerprint,transcript,ocrText,embeddingPath,cacheHit:false};
  }
}
