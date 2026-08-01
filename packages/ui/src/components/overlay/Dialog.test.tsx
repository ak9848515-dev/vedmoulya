// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Dialog components tests
// Follows DES-001 Constitution — 28px radius, Level 4 shadow
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './Dialog.js';

describe('Dialog primitives', () => {
  it('exports the Radix Root and Trigger', () => {
    expect(Dialog).toBeDefined();
    expect(DialogTrigger).toBeDefined();
  });

  it('renders DialogPortal with children inside an open root', () => {
    render(
      <Dialog open>
        <DialogPortal>
          <span data-testid="portal-child">in portal</span>
        </DialogPortal>
      </Dialog>,
    );
    expect(screen.getByTestId('portal-child').textContent).toBe('in portal');
  });

  it('renders DialogOverlay with className passthrough', () => {
    render(
      <Dialog open>
        <DialogOverlay className="custom-overlay" data-testid="overlay" />
      </Dialog>,
    );
    const overlay = screen.getByTestId('overlay');
    expect(overlay.className).toContain('custom-overlay');
    expect(overlay.className).toContain('fixed');
  });

  it('renders DialogHeader with className passthrough', () => {
    render(<DialogHeader className="header-custom" data-testid="header" />);
    expect(screen.getByTestId('header').className).toContain('header-custom');
  });

  it('renders DialogFooter with className passthrough', () => {
    render(<DialogFooter className="footer-custom" data-testid="footer" />);
    expect(screen.getByTestId('footer').className).toContain('footer-custom');
  });

  it('renders DialogTitle and DialogDescription inside a content', () => {
    render(
      <Dialog open>
        <DialogPortal>
          <DialogTitle data-testid="title">Title</DialogTitle>
          <DialogDescription data-testid="desc">Description</DialogDescription>
        </DialogPortal>
      </Dialog>,
    );
    expect(screen.getByTestId('title').textContent).toBe('Title');
    expect(screen.getByTestId('desc').textContent).toBe('Description');
  });

  it('renders DialogContent with default md size and a close button', () => {
    render(
      <Dialog open>
        <DialogContent data-testid="content">
          <span>Body</span>
        </DialogContent>
      </Dialog>,
    );
    const content = screen.getByTestId('content');
    expect(content.className).toContain('max-w-lg');
    expect(content.textContent).toContain('Body');
    expect(screen.getByText('Close')).toBeDefined();
  });

  it('applies size sm and lg classes', () => {
    const { rerender } = render(
      <Dialog open>
        <DialogContent size="sm" data-testid="sm" />
      </Dialog>,
    );
    expect(screen.getByTestId('sm').className).toContain('max-w-sm');
    rerender(
      <Dialog open>
        <DialogContent size="lg" data-testid="lg" />
      </Dialog>,
    );
    expect(screen.getByTestId('lg').className).toContain('max-w-2xl');
  });
});
