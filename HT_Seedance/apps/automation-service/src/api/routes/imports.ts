import type { FastifyPluginAsync } from 'fastify';
import { ImportAnalyzeSchema,ImportCommitSchema } from '@ht-dola/shared';
import { getDb,type SqliteDatabase } from '../../db/database.js';
import { ImportService } from '../../services/ImportService.js';
export const createImportRoutes=(database:SqliteDatabase=getDb()):FastifyPluginAsync=>async(fastify)=>{
 const service=new ImportService(database);const id=(request:{params:unknown})=>(request.params as {id:string}).id;
 fastify.post('/api/projects/:id/import/analyze',async(request)=>({data:service.analyze(id(request),ImportAnalyzeSchema.parse(request.body))}));
 fastify.get('/api/projects/:id/import/sessions/:sessionId',async(request)=>({data:service.get((request.params as {sessionId:string}).sessionId)}));
 fastify.post('/api/projects/:id/import/commit',async(request)=>({data:service.commit(ImportCommitSchema.parse(request.body).sessionId)}));
 fastify.get('/api/projects/:id/export/csv',async(request,reply)=>reply.type('text/csv; charset=utf-8').header('content-disposition','attachment; filename="jobs.csv"').send(`\uFEFF${service.exportCsv(id(request))}`));
 fastify.get('/api/import/template.csv',async(_request,reply)=>reply.type('text/csv; charset=utf-8').send('\uFEFFscene,prompt,image,video,audio,duration,aspect_ratio,resolution,provider,priority\r\n'));
};
