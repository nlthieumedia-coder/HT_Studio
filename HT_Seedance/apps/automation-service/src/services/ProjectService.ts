import type { SqliteDatabase } from '../db/database.js';
import { ProjectRepository } from '../db/repositories/ProjectRepository.js';
import { ConflictError, NotFoundError } from '../api/errors.js';

export class ProjectService {
  readonly repository:ProjectRepository;
  constructor(private readonly database:SqliteDatabase){this.repository=new ProjectRepository(database);}
  restore(id:string){const project=this.repository.restore(id);if(!project)throw new NotFoundError('Project not found.');return project;}
  delete(id:string,confirmRecords=false):void{const project=this.repository.getById(id);if(!project)throw new NotFoundError('Project not found.');if(project.totalJobs&&!confirmRecords)throw new ConflictError('Explicit record deletion confirmation is required.');this.database.transaction(()=>{if(project.totalJobs){const output=(this.database.prepare('SELECT 1 FROM outputs o JOIN jobs j ON j.id=o.job_id WHERE j.project_id=? LIMIT 1').get(id));if(output)throw new ConflictError('Projects with output records cannot be deleted.');this.database.prepare('DELETE FROM application_logs WHERE project_id=?').run(id);this.database.prepare('DELETE FROM job_attempts WHERE job_id IN (SELECT id FROM jobs WHERE project_id=?)').run(id);this.database.prepare('DELETE FROM jobs WHERE project_id=?').run(id);}this.repository.delete(id);})();}
}
