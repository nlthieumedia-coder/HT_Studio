import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const steps = [
  [
    'Welcome',
    'HT Dola Studio stores production data locally and uses authorized browser sessions only.',
  ],
  [
    'Storage',
    'Database, projects, profiles, downloads, logs, backups, and temporary files are stored under the Windows application-data directory.',
  ],
  [
    'System checks',
    'Open System Health to validate the local service, database, Chromium, FFmpeg, storage, and workers.',
  ],
  [
    'Safe defaults',
    'Worker concurrency starts conservatively. Browser profiles and generated outputs are excluded from backups by default.',
  ],
  [
    'Protect your work',
    'Configure automatic backups with retention 5 after setup. Account login is not required during onboarding.',
  ],
] as const;

export const FirstRunSetup: React.FC = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(() => localStorage.getItem('ht-first-run-1.0') !== 'complete');
  const [step, setStep] = useState(0);
  if (!open) return null;
  const current = steps[step] ?? steps[0];
  const finish = () => {
    localStorage.setItem('ht-first-run-1.0', 'complete');
    setOpen(false);
  };
  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="first-run-title"
      >
        <h2 id="first-run-title">{current[0]}</h2>
        <p>{current[1]}</p>
        <p className="muted">
          Step {step + 1} of {steps.length}
        </p>
        <div className="dialog-actions">
          {step > 0 && (
            <button className="button secondary" onClick={() => setStep(step - 1)}>
              Back
            </button>
          )}
          {step < steps.length - 1 ? (
            <button className="button primary" onClick={() => setStep(step + 1)}>
              Next
            </button>
          ) : (
            <>
              <button
                className="button secondary"
                onClick={() => {
                  finish();
                  navigate('/health');
                }}
              >
                System Health
              </button>
              <button
                className="button secondary"
                onClick={() => {
                  finish();
                  navigate('/settings');
                }}
              >
                Backup Settings
              </button>
              <button className="button primary" onClick={finish}>
                Finish
              </button>
            </>
          )}
        </div>
      </section>
    </div>
  );
};
