import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface State { failed: boolean; }
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  override state: State = { failed: false };
  static getDerivedStateFromError(): State { return { failed: true }; }
  override componentDidCatch(error: Error): void { console.error('Desktop UI error', error); }
  override render(): React.ReactNode {
    if (this.state.failed) return <div className="fatal-error"><AlertTriangle size={32} /><h1>HT Dola Studio encountered a UI error</h1><p>Your local service and data are unaffected. Reload the application to continue.</p><button className="button primary" onClick={() => window.location.reload()}>Reload application</button></div>;
    return this.props.children;
  }
}
