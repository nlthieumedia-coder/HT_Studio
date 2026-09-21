import React from 'react';
import { JobState } from '@ht-dola/shared';

export interface StatusIndicatorProps {
  state: JobState | string;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({ state }) => {
  const getColor = (s: string) => {
    switch (s) {
      case JobState.COMPLETED:
        return 'bg-emerald-500';
      case JobState.FAILED:
      case JobState.INTERRUPTED:
        return 'bg-red-500';
      case JobState.CANCELLED:
        return 'bg-slate-500';
      case JobState.QUEUED:
      case JobState.WAITING_FOR_WORKER:
        return 'bg-amber-500 animate-pulse';
      case JobState.STARTING_BROWSER:
      case JobState.PREPARING:
      case JobState.SUBMITTING:
      case JobState.GENERATING:
      case JobState.DOWNLOADING:
      case JobState.PROCESSING:
        return 'bg-blue-500 animate-pulse';
      default:
        return 'bg-slate-400';
    }
  };

  return (
    <div className="flex items-center gap-2">
      <span className={`h-2 w-2 rounded-full ${getColor(state)}`} />
      <span className="text-xs font-medium text-slate-300">{state}</span>
    </div>
  );
};
