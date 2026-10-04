const { resolve, join } = require('node:path');
const { writeFile, mkdir, copyFile } = require('node:fs/promises');
const { Database } = require('../dist/main/database/index.js');
const { Repositories } = require('../dist/main/database/repositories.js');
const { FFmpegService } = require('../dist/main/services/FFmpegService.js');
const { PythonWorkerBridge } = require('../dist/main/services/PythonWorkerBridge.js');
const { MediaAnalysisEngine } = require('../dist/main/services/MediaAnalysisEngine.js');
const { LocalDatasetConnector } = require('../dist/main/connectors/LocalDatasetConnector.js');
const { DatasetService } = require('../dist/main/services/DatasetService.js');
const { SearchJobService } = require('../dist/main/services/SearchJobService.js');
const { ExportService } = require('../dist/main/services/ExportService.js');

async function waitFor(repo,id){for(let i=0;i<300;i++){const job=await repo.getJob(id);if(['completed','failed','cancelled'].includes(job.status))return job;await new Promise(r=>setTimeout(r,100))}throw new Error('Smoke search timeout')}
async function main(){
 const root=resolve('integration-temp/full-smoke'),media=join(root,'media'),cache=join(root,'cache');await mkdir(media,{recursive:true});await mkdir(cache,{recursive:true});
 const first=join(media,'candidate-near.mp4'),second=join(media,'candidate-far.mp4'),vectorQuery=join(root,'vector-query.mp4'),exactQuery=join(root,'exact-query.mp4');await copyFile(first,exactQuery);
 const manifest=join(root,'dataset.json');await writeFile(manifest,JSON.stringify([{file_path:first,platform:'local',account_name:'Trang Gần',account_url:'local://trang-gan',caption:'Video ứng viên tương đồng'},{file_path:second,platform:'local',account_name:'Trang Khác',account_url:'local://trang-khac',caption:'Video ứng viên khác biệt'}],null,2));
 const db=new Database(join(root,'smoke.db'));await db.init();const repo=new Repositories(db),ffmpeg=new FFmpegService(),worker=new PythonWorkerBridge(resolve('python-worker/app/main.py')),engine=new MediaAnalysisEngine(repo,ffmpeg,worker,cache),datasets=new DatasetService(repo,new LocalDatasetConnector(),engine),search=new SearchJobService(repo,engine),exports=new ExportService(repo);
 const ping=await worker.request('ping');const imported=await datasets.import(manifest,'manifest');
 const rows=await db.client.execute('SELECT di.id,di.file_path,di.file_hash,mf.visual_embedding_path FROM dataset_items di JOIN media_features mf ON mf.dataset_item_id=di.id ORDER BY di.file_path');
 for(const row of rows.rows){const near=String(row.file_path).includes('candidate-near');const path=String(row.visual_embedding_path);await writeFile(path,JSON.stringify(near?[.99,.01,0]:[0,1,0]));}
 const queryAnalysis=await engine.analyze(vectorQuery,false);await writeFile(queryAnalysis.embeddingPath,JSON.stringify([1,0,0]));
 const exact=await search.start({sourceFile:exactQuery,datasetIds:[imported.datasetId],mode:'EXACT_MATCH',limit:2,level:'fast',enableWhisper:false,enableOcr:false});const exactJob=await waitFor(repo,exact.id);const exactResults=await repo.results(exact.id);
 const semantic=await search.start({sourceFile:vectorQuery,datasetIds:[imported.datasetId],mode:'SEMANTIC_SIMILARITY',limit:2,level:'fast',enableWhisper:false,enableOcr:false});const semanticJob=await waitFor(repo,semantic.id);const semanticResults=await repo.results(semantic.id);
 const csv=await exports.export(semantic.id,join(root,'ket-qua.csv'),'csv'),xlsx=await exports.export(semantic.id,join(root,'ket-qua.xlsx'),'xlsx');
 const output={pythonPing:ping,imported,metadata:{duration:queryAnalysis.duration,width:queryAnalysis.width,height:queryAnalysis.height,fps:queryAnalysis.fps},exact:{status:exactJob.status,top:exactResults[0]&&{account:exactResults[0].item.accountName,score:exactResults[0].result.totalScore,evidence:JSON.parse(exactResults[0].result.evidenceJson)}},vector:{status:semanticJob.status,order:semanticResults.map(row=>({account:row.item.accountName,score:row.result.totalScore,evidence:JSON.parse(row.result.evidenceJson)}))},exports:{csv,xlsx}};
 console.log(JSON.stringify(output,null,2));worker.stop();await db.close();
 if(exactJob.status!=='completed'||semanticJob.status!=='completed'||output.vector.order[0]?.account!=='Trang Gần'||!output.vector.order[0]?.evidence.vectorSimilarity)process.exitCode=1;
}
main().catch(error=>{console.error(error);process.exit(1)});
