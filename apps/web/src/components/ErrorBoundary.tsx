'use client';

import React from 'react';
import { Card, Button } from '@vedmoulya/ui';
import { AlertTriangle, RefreshCw } from 'lucide-react';

// ── State ───────────────────────────────────────────────────────────────────

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  section?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// ── Error Boundary Component ────────────────────────────────────────────────

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error(
      `[ErrorBoundary${this.props.section ? `:${this.props.section}` : ''}]`,
      error,
      info.componentStack,
    );
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center h-[40vh] gap-4">
          <Card variant="standard" padding="lg" className="max-w-md text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="p-3 rounded-full bg-[#FEF2F2]">
                <AlertTriangle className="h-6 w-6 text-[#EF4444]" />
              </div>
              <h2 className="text-[18px] font-heading font-semibold text-[#111827]">
                {this.props.section
                  ? `Unable to load ${this.props.section}`
                  : 'Something went wrong'}
              </h2>
              <p className="text-[14px] text-[#64748B]">
                {this.state.error?.message ?? 'An unexpected error occurred. Please try again.'}
              </p>
              <Button variant="primary" size="md" onClick={this.handleRetry}>
                <RefreshCw className="h-4 w-4" /> Try Again
              </Button>
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
