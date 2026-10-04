import type { SqliteDatabase } from '../db/database.js';
import { ProjectRepository } from '../db/repositories/ProjectRepository.js';
import { ConflictError, NotFoundError } from '../api/errors.js';

export class ProjectService {
  readonly repository:ProjectRepository;
  constructor(private readonly database:SqliteDatabase){this.repository=new ProjectRepository(database);}
  restore(id:string){const project=this.repository.restore(id);if(!project)throw new NotFoundError('Project not found.');return project;}
  delete(id:string,confirmRecords=false):void{
    const project=this.repository.getById(id);
    if(!project)throw new NotFoundError('Project not found.');
    if(project.totalJobs&&!confirmRecords)throw new ConflictError('Explicit record deletion confirmation is required.');
    this.database.transaction(()=>{
      if(project.totalJobs){
        this.database.prepare('UPDATE workers SET job_id=NULL WHERE job_id IN (SELECT id FROM jobs WHERE project_id=?)').run(id);
        this.database.prepare('DELETE FROM production_runs WHERE project_id=?').run(id);
        this.database.prepare('DELETE FROM import_history WHERE project_id=?').run(id);
        this.database.prepare('DELETE FROM application_logs WHERE project_id=?').run(id);
        this.database.prepare('DELETE FROM outputs WHERE job_id IN (SELECT id FROM jobs WHERE project_id=?)').run(id);
        this.database.prepare('DELETE FROM job_attempts WHERE job_id IN (SELECT id FROM jobs WHERE project_id=?)').run(id);
        this.database.prepare('DELETE FROM jobs WHERE project_id=?').run(id);
      }
      this.repository.delete(id);
    })();
  }
}
