/* eslint-disable security/detect-object-injection -- Heuristic rule
   false-positive: dynamic member access here uses typed/closed-union keys,
   constant environment names, or fixed internal lists — never
   attacker-controlled property names. */
// ──────────────────────────────────────────────────────────────────
// VedMoulya — Module-Specific Card Components
// Follows DES-010A/D07 Component Behaviour specifications
// KnowledgeCard, MemoryCard, CareerCard, BusinessCard, MarketplaceCard, LifeOSCard
// ──────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import { BookOpen, Clock, Building2, Activity } from 'lucide-react';
import { Card } from './Card.js';
import { cn } from '../../utilities/cn.js';
import { Badge } from '../display/Display.js';

// ── Knowledge Card ─────────────────────────────────────────────────────────

export interface KnowledgeCardProps {
  title: string;
  summary: string;
  source?: string;
  confidence?: number;
  tags?: string[];
  connections?: number;
  onExpand?: () => void;
  onConnect?: () => void;
  onSave?: () => void;
  className?: string;
}

export function KnowledgeCard({
  title,
  summary,
  source,
  confidence,
  tags,
  connections,
  onExpand,
  onConnect,
  onSave,
  className,
}: KnowledgeCardProps): React.JSX.Element {
  return (
    <Card variant="standard" padding="md" className={cn('group', className)}>
      <div className="flex items-start gap-3 mb-3">
        <BookOpen className="h-5 w-5 text-[#64748B] mt-0.5 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h4 className="text-[16px] font-semibold text-[#1F2937] truncate">{title}</h4>
          {source && (
            <Badge variant="default" size="sm">
              {source}
            </Badge>
          )}
        </div>
        {confidence !== undefined && (
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[12px] text-[#64748B]">{String(confidence)}%</span>
            <div className="h-2 w-12 rounded-full bg-[#E2E8F0] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#2B5FD9] transition-all"
                style={{ width: `${String(confidence)}%` }}
              />
            </div>
          </div>
        )}
      </div>
      <p className="text-[14px] text-[#64748B] leading-[22px] line-clamp-2 mb-3">{summary}</p>
      {tags && tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {tags.map((tag) => (
            <span
              key={tag}
              className="text-[12px] text-[#64748B] bg-[#F1F5F9] px-2 py-0.5 rounded-full"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between pt-2 border-t border-[#E8EDF5]">
        {connections !== undefined && (
          <span className="text-[12px] text-[#94A3B8]">{connections} connections</span>
        )}
        <div className="flex gap-2 ml-auto">
          {onConnect && <ActionButton onClick={onConnect}>Connect</ActionButton>}
          {onExpand && <ActionButton onClick={onExpand}>Expand</ActionButton>}
          {onSave && <ActionButton onClick={onSave}>Save</ActionButton>}
        </div>
      </div>
    </Card>
  );
}

// ── Memory Card ────────────────────────────────────────────────────────────

export interface MemoryCardProps {
  title: string;
  content: string;
  timestamp: string;
  freshness?: 'fresh' | 'recent' | 'aging';
  source?: string;
  onSave?: () => void;
  onDismiss?: () => void;
  onShare?: () => void;
  className?: string;
}

export function MemoryCard({
  title,
  content,
  timestamp,
  freshness = 'recent',
  source,
  onSave,
  onDismiss,
  onShare,
  className,
}: MemoryCardProps): React.JSX.Element {
  const freshnessColors = {
    fresh: 'bg-[#22C55E]',
    recent: 'bg-[#F59E0B]',
    aging: 'bg-[#94A3B8]',
  };

  return (
    <Card variant="standard" padding="md" className={cn('group', className)}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-[#64748B]" aria-hidden="true" />
          <span className="text-[12px] text-[#64748B]">{timestamp}</span>
          <div
            className={cn('h-2 w-2 rounded-full', freshnessColors[freshness])}
            aria-label={`${freshness} memory`}
          />
        </div>
        {source && <span className="text-[12px] text-[#94A3B8]">{source}</span>}
      </div>
      <h4 className="text-[14px] font-medium text-[#1F2937] mb-1">{title}</h4>
      <p className="text-[13px] text-[#64748B] leading-[20px] line-clamp-2">{content}</p>
      <div className="flex justify-end gap-2 mt-3 pt-2 border-t border-[#E8EDF5]">
        {onSave && <ActionButton onClick={onSave}>Save</ActionButton>}
        {onShare && <ActionButton onClick={onShare}>Share</ActionButton>}
        {onDismiss && (
          <ActionButton onClick={onDismiss} variant="ghost">
            Dismiss
          </ActionButton>
        )}
      </div>
    </Card>
  );
}

// ── Career Card ────────────────────────────────────────────────────────────

export interface CareerCardProps {
  title: string;
  organization?: string;
  stage?: 'entry' | 'growth' | 'established' | 'expert' | 'leader';
  trustScore?: number;
  skills?: string[];
  onApply?: () => void;
  onSave?: () => void;
  onWhy?: () => void;
  className?: string;
}

export function CareerCard({
  title,
  organization,
  stage,
  trustScore,
  skills,
  onApply,
  onSave,
  onWhy,
  className,
}: CareerCardProps): React.JSX.Element {
  const stageColors: Record<string, string> = {
    entry: 'bg-[#EFF4FE] text-[#2B5FD9]',
    growth: 'bg-[#E8F8F9] text-[#0EA5A9]',
    established: 'bg-[#F5F3FF] text-[#7C3AED]',
    expert: 'bg-[#FFF4F2] text-[#FF6B5B]',
    leader: 'bg-[#FFFBEB] text-[#C89B3C]',
  };

  return (
    <Card variant="standard" padding="md" className={cn('group', className)}>
      <div className="flex items-start justify-between mb-2">
        <div className="min-w-0 flex-1">
          <h4 className="text-[16px] font-semibold text-[#1F2937] truncate">{title}</h4>
          {organization && <p className="text-[14px] text-[#64748B]">{organization}</p>}
        </div>
        {stage && (
          <span
            className={cn(
              'text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0',
              stageColors[stage],
            )}
          >
            {stage}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 mb-3">
        {trustScore !== undefined && (
          <div className="flex items-center gap-1">
            <span className="text-[12px] text-[#64748B]">Trust</span>
            <span className="text-[13px] font-medium text-[#1F2937]">{trustScore}%</span>
          </div>
        )}
      </div>
      {skills && skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {skills.map((skill) => (
            <span
              key={skill}
              className="text-[12px] text-[#64748B] bg-[#F1F5F9] px-2 py-0.5 rounded-full"
            >
              {skill}
            </span>
          ))}
        </div>
      )}
      <div className="flex justify-end gap-2 pt-2 border-t border-[#E8EDF5]">
        {onWhy && <ActionButton onClick={onWhy}>Why?</ActionButton>}
        {onSave && <ActionButton onClick={onSave}>Save</ActionButton>}
        {onApply && (
          <ActionButton onClick={onApply} variant="primary">
            Apply
          </ActionButton>
        )}
      </div>
    </Card>
  );
}

// ── Business Card ──────────────────────────────────────────────────────────

export interface BusinessCardProps {
  title: string;
  venture?: string;
  stage?: 'idea' | 'mvp' | 'growth' | 'scale' | 'enterprise';
  category?: string;
  onView?: () => void;
  onConnect?: () => void;
  onSave?: () => void;
  className?: string;
}

export function BusinessCard({
  title,
  venture,
  stage,
  category,
  onView,
  onConnect,
  onSave,
  className,
}: BusinessCardProps): React.JSX.Element {
  return (
    <Card variant="standard" padding="md" className={cn('group', className)}>
      <div className="flex items-center gap-3 mb-3">
        <Building2 className="h-5 w-5 text-[#64748B] shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h4 className="text-[16px] font-semibold text-[#1F2937] truncate">{title}</h4>
          {venture && <p className="text-[13px] text-[#64748B]">{venture}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2 mb-3">
        {stage && (
          <Badge variant="default" size="sm">
            {stage}
          </Badge>
        )}
        {category && (
          <Badge variant="default" size="sm">
            {category}
          </Badge>
        )}
      </div>
      <div className="flex justify-end gap-2 pt-2 border-t border-[#E8EDF5]">
        {onSave && <ActionButton onClick={onSave}>Save</ActionButton>}
        {onConnect && <ActionButton onClick={onConnect}>Connect</ActionButton>}
        {onView && (
          <ActionButton onClick={onView} variant="primary">
            View
          </ActionButton>
        )}
      </div>
    </Card>
  );
}

// ── Marketplace Card ───────────────────────────────────────────────────────

export interface MarketplaceCardProps {
  title: string;
  provider?: string;
  price?: string;
  rating?: number;
  category?: string;
  deliveryTime?: string;
  trustScore?: number;
  onViewDetails?: () => void;
  onEnroll?: () => void;
  onSave?: () => void;
  className?: string;
}

export function MarketplaceCard({
  title,
  provider,
  price,
  rating,
  category,
  deliveryTime,
  trustScore,
  onViewDetails,
  onEnroll,
  onSave,
  className,
}: MarketplaceCardProps): React.JSX.Element {
  return (
    <Card variant="standard" padding="md" className={cn('group', className)}>
      <div className="flex items-start justify-between mb-2">
        <div className="min-w-0 flex-1">
          <h4 className="text-[16px] font-semibold text-[#1F2937] truncate">{title}</h4>
          {provider && <p className="text-[13px] text-[#64748B]">{provider}</p>}
        </div>
        {price && (
          <span className="text-[18px] font-bold text-[#1F2937] shrink-0 ml-2">{price}</span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {category && (
          <Badge variant="default" size="sm">
            {category}
          </Badge>
        )}
        {deliveryTime && (
          <Badge variant="default" size="sm">
            {deliveryTime}
          </Badge>
        )}
        {trustScore !== undefined && (
          <Badge variant="info" size="sm">
            Trust {trustScore}%
          </Badge>
        )}
      </div>
      {rating !== undefined && (
        <div className="flex items-center gap-1 mb-3">
          {Array.from({ length: 5 }, (_, i) => (
            <span
              key={i}
              className={cn(
                'text-sm',
                i < Math.round(rating) ? 'text-[#F59E0B]' : 'text-[#E2E8F0]',
              )}
            >
              ★
            </span>
          ))}
          <span className="text-[12px] text-[#64748B] ml-1">{rating.toFixed(1)}</span>
        </div>
      )}
      <div className="flex justify-end gap-2 pt-2 border-t border-[#E8EDF5]">
        {onSave && <ActionButton onClick={onSave}>Save</ActionButton>}
        {onViewDetails && <ActionButton onClick={onViewDetails}>Details</ActionButton>}
        {onEnroll && (
          <ActionButton onClick={onEnroll} variant="primary">
            Enroll
          </ActionButton>
        )}
      </div>
    </Card>
  );
}

// ── Life OS Card ───────────────────────────────────────────────────────────

export interface LifeOSCardProps {
  title: string;
  state?: 'morning' | 'afternoon' | 'evening' | 'focus' | 'recovery';
  progress?: number;
  dailyScore?: number;
  onStart?: () => void;
  onView?: () => void;
  onWhy?: () => void;
  className?: string;
}

export function LifeOSCard({
  title,
  state,
  progress,
  dailyScore,
  onStart,
  onView,
  onWhy,
  className,
}: LifeOSCardProps): React.JSX.Element {
  return (
    <Card variant="standard" padding="md" className={cn('group', className)}>
      <div className="flex items-center gap-3 mb-3">
        <Activity className="h-5 w-5 text-[#2B5FD9] shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h4 className="text-[16px] font-semibold text-[#1F2937] truncate">{title}</h4>
          {state && <p className="text-[13px] text-[#64748B] capitalize">{state} mode</p>}
        </div>
      </div>
      {progress !== undefined && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[12px] text-[#64748B]">Progress</span>
            <span className="text-[12px] font-medium text-[#1F2937]">{progress}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-[#E2E8F0] overflow-hidden">
            <div
              className="h-full rounded-full bg-[#2B5FD9] transition-all"
              style={{ width: `${String(progress)}%` }}
            />
          </div>
        </div>
      )}
      {dailyScore !== undefined && (
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[12px] text-[#64748B]">Daily Score</span>
          <span
            className={cn(
              'text-[14px] font-semibold',
              dailyScore >= 80
                ? 'text-[#22C55E]'
                : dailyScore >= 50
                  ? 'text-[#F59E0B]'
                  : 'text-[#EF4444]',
            )}
          >
            {dailyScore}
          </span>
        </div>
      )}
      <div className="flex justify-end gap-2 pt-2 border-t border-[#E8EDF5]">
        {onWhy && <ActionButton onClick={onWhy}>Why?</ActionButton>}
        {onView && <ActionButton onClick={onView}>View</ActionButton>}
        {onStart && (
          <ActionButton onClick={onStart} variant="primary">
            Start
          </ActionButton>
        )}
      </div>
    </Card>
  );
}

// ── Shared Action Button ───────────────────────────────────────────────────

function ActionButton({
  children,
  onClick,
  variant = 'ghost',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'ghost';
}): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      className={cn(
        'text-[12px] font-medium transition-colors px-2 py-1 rounded-md',
        variant === 'primary'
          ? 'bg-[#2B5FD9] text-white hover:bg-[#3B6FE3]'
          : 'text-[#2B5FD9] hover:bg-[#F1F5F9]',
      )}
    >
      {children}
    </button>
  );
}
