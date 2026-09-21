import {
  VideoProvider,
  ProviderSessionValidation,
  ProviderJobSubmissionResult,
  ProviderJobStatusResult,
  Job,
  JobInput,
  JobOutput,
  BrowserProfile,
} from '@ht-dola/shared';

export abstract class BaseProvider implements VideoProvider {
  public abstract readonly id: string;
  public abstract readonly name: string;
  public abstract readonly version: string;

  public async initialize(_profile: BrowserProfile): Promise<void> {
    // Base setup
  }

  public async validateSession(_profile: BrowserProfile): Promise<ProviderSessionValidation> {
    return { isValid: false, authError: 'Base provider session validation not implemented' };
  }

  public async prepareJob(_job: Job, _input: JobInput): Promise<void> {
    // Base prepare logic
  }

  public abstract submit(job: Job, input: JobInput): Promise<ProviderJobSubmissionResult>;

  public abstract checkStatus(externalJobId: string): Promise<ProviderJobStatusResult>;

  public abstract downloadResult(externalJobId: string, targetPath: string): Promise<JobOutput>;

  public async cleanup(): Promise<void> {
    // Base cleanup logic
  }
}
