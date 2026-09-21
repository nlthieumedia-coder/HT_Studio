import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ProjectCreateSchema,ProjectDeleteSchema,ProjectListQuerySchema,ProjectUpdateSchema } from '@ht-dola/shared';
import { getDb,type SqliteDatabase } from '../../db/database.js';
import { ProjectService } from '../../services/ProjectService.js';
import { MediaOutputManager } from '../../services/MediaOutputManager.js';
import { NotFoundError } from '../errors.js';

const params=z.object({id:z.string().uuid()});
export const createProjectsRoutes=(database:SqliteDatabase=getDb()):FastifyPluginAsync=>async(fastify)=>{
 const service=new ProjectService(database),repository=service.repository,media=new MediaOutputManager(database);
 fastify.get('/api/projects',async(request)=>({data:repository.list(ProjectListQuerySchema.parse(request.query))}));
 fastify.get('/api/projects/:id',async(request)=>{const project=repository.getById(params.parse(request.params).id);if(!project)throw new NotFoundError('Project not found.');return{data:project};});
 fastify.post('/api/projects',async(request,reply)=>reply.code(201).send({data:repository.create(ProjectCreateSchema.parse(request.body))}));
 fastify.patch('/api/projects/:id',async(request)=>{const project=repository.update(params.parse(request.params).id,ProjectUpdateSchema.parse(request.body));if(!project)throw new NotFoundError('Project not found.');return{data:project};});
 fastify.post('/api/projects/:id/archive',async(request)=>{const project=repository.archive(params.parse(request.params).id);if(!project)throw new NotFoundError('Project not found.');return{data:project};});
 fastify.post('/api/projects/:id/restore',async(request)=>({data:service.restore(params.parse(request.params).id)}));
 fastify.post('/api/projects/:id/export/manifest',async(request)=>({data:media.exportProjectManifest(params.parse(request.params).id)}));
 fastify.delete('/api/projects/:id',async(request,reply)=>{service.delete(params.parse(request.params).id,ProjectDeleteSchema.parse(request.query).confirmRecords);return reply.code(204).send();});
};
