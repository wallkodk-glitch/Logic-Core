import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { ExportButton } from './ExportButton.tsx';

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Logic Core runtime error', error, info.componentStack); }
  render() {
    if (this.state.failed) return <main className="error-screen"><h1>Logic Core kunne ikke vise siden.</h1><p>Der opstod en fejl i appen. Genindlæs for at prøve igen. Dine gemte data bliver ikke nulstillet.</p><button className="button" onClick={() => window.location.reload()}>Genindlæs appen</button><ExportButton /></main>;
    return this.props.children;
  }
}
