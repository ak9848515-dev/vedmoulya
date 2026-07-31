// ──────────────────────────────────────────────────────────────────
// VedMoulya — Card Stories
// BLD-003A Design System Quality & Documentation
// Covers: Card, AICard, KnowledgeCard, MemoryCard, CareerCard,
//         BusinessCard, MarketplaceCard, LifeOSCard
// ──────────────────────────────────────────────────────────────────

import type React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { Card } from '../components/card/Card.js';
import { AICard } from '../components/card/AICard.js';
import {
  KnowledgeCard,
  MemoryCard,
  CareerCard,
  BusinessCard,
  MarketplaceCard,
  LifeOSCard,
} from '../components/card/ModuleCards.js';

const meta: Meta<typeof Card> = {
  title: 'Components/Card',
  component: Card,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['standard', 'elevated', 'ghost', 'interactive'] },
    padding: { control: 'select', options: ['none', 'sm', 'md', 'lg'] },
    as: { control: 'select', options: ['div', 'article', 'section'] },
  },
  args: {
    children:
      'Card content goes here. This is a flexible container for grouping related information.',
  },
  parameters: {
    docs: {
      description: {
        component:
          'Container component with 4 variants and 4 padding options. All variants use 24px border-radius per DES-001 Constitution.',
      },
    },
  },
};

export default meta;
type CardStory = StoryObj<typeof Card>;

export const Standard: CardStory = { args: { variant: 'standard' } };
export const Elevated: CardStory = { args: { variant: 'elevated' } };
export const Ghost: CardStory = { args: { variant: 'ghost' } };

export const Interactive: CardStory = {
  args: {
    variant: 'interactive',
    onClick: fn(),
    children: 'Click me — I have hover/active states and keyboard support.',
  },
  parameters: {
    docs: {
      description: {
        story: 'Interactive card with hover lift, click handler, and full keyboard accessibility.',
      },
    },
  },
};

export const AllPaddingSizes: CardStory = {
  render: () => (
    <div className="flex flex-col gap-4">
      <Card padding="none">
        <div className="p-4">Padding: none</div>
      </Card>
      <Card padding="sm">
        <div>Padding: sm (16px)</div>
      </Card>
      <Card padding="md">
        <div>Padding: md (24px)</div>
      </Card>
      <Card padding="lg">
        <div>Padding: lg (32px)</div>
      </Card>
    </div>
  ),
  name: '📐 All Padding Sizes',
};

export const SemanticArticle: CardStory = {
  args: { as: 'article', variant: 'standard', children: 'Rendered as <article>' },
  name: '📄 Semantic — article',
};

export const SemanticSection: CardStory = {
  args: { as: 'section', variant: 'standard', children: 'Rendered as <section>' },
  name: '📄 Semantic — section',
};

export const CardGrid: CardStory = {
  render: () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <Card variant="standard">
        <div className="p-4">Card 1</div>
      </Card>
      <Card variant="elevated">
        <div className="p-4">Card 2</div>
      </Card>
      <Card variant="ghost">
        <div className="p-4">Card 3</div>
      </Card>
      <Card variant="interactive" onClick={fn()}>
        <div className="p-4">Card 4</div>
      </Card>
      <Card variant="standard">
        <div className="p-4">Card 5</div>
      </Card>
      <Card variant="elevated">
        <div className="p-4">Card 6</div>
      </Card>
    </div>
  ),
  name: '🔲 Card Grid',
};

export const CardDarkMode: CardStory = {
  args: { variant: 'standard', children: 'Dark mode card' },
  decorators: [
    (Story): React.JSX.Element => (
      <div className="dark bg-[#0F172A] p-8">
        <Story />
      </div>
    ),
  ],
};

// ── AI Card ───────────────────────────────────────────────────────────────

export const AIWithConfidence: StoryObj = {
  render: () => (
    <AICard
      confidence={85}
      source="User Profile Analysis"
      onTalk={fn()}
      onDismiss={fn()}
      onWhy={fn()}
    >
      Based on your recent activity, you&apos;ve shown strong interest in product design.
    </AICard>
  ),
  name: 'AI Card — With Confidence',
};

export const AIMinimal: StoryObj = {
  render: () => <AICard onTalk={fn()}>Your focus score is optimal right now.</AICard>,
  name: 'AI Card — Minimal',
};

// ── Knowledge Card ─────────────────────────────────────────────────────────

export const KnowledgeDefault: StoryObj = {
  render: () => (
    <KnowledgeCard
      title="Understanding Design Tokens"
      summary="Design tokens are the visual atoms of the design system."
      source="Design Docs"
      confidence={92}
      tags={['design-tokens', 'css']}
      connections={5}
      onExpand={fn()}
      onSave={fn()}
    />
  ),
  name: 'Knowledge Card',
};

// ── Memory Card ────────────────────────────────────────────────────────────

export const MemoryFresh: StoryObj = {
  render: () => (
    <MemoryCard
      title="Morning Reflection"
      content="Today I realized the importance of consistent habits."
      timestamp="2h ago"
      freshness="fresh"
      onSave={fn()}
      onShare={fn()}
    />
  ),
  name: 'Memory Card — Fresh',
};

export const MemoryAging: StoryObj = {
  render: () => (
    <MemoryCard
      title="Old Memory"
      content="A memory from weeks ago."
      timestamp="3 weeks ago"
      freshness="aging"
      onDismiss={fn()}
    />
  ),
  name: 'Memory Card — Aging',
};

// ── Career Card ────────────────────────────────────────────────────────────

export const CareerDefault: StoryObj = {
  render: () => (
    <CareerCard
      title="Senior Frontend Engineer"
      organization="Tech Corp"
      stage="growth"
      trustScore={88}
      skills={['React', 'TypeScript']}
      onApply={fn()}
      onSave={fn()}
    />
  ),
  name: 'Career Card',
};

// ── Business Card ──────────────────────────────────────────────────────────

export const BusinessDefault: StoryObj = {
  render: () => (
    <BusinessCard
      title="Design System SaaS"
      venture="VedMoulya Inc."
      stage="mvp"
      category="Developer Tools"
      onView={fn()}
      onConnect={fn()}
    />
  ),
  name: 'Business Card',
};

// ── Marketplace Card ───────────────────────────────────────────────────────

export const MarketplaceDefault: StoryObj = {
  render: () => (
    <MarketplaceCard
      title="AI Life Coaching"
      provider="Elara AI"
      price="$49/mo"
      rating={4.7}
      category="AI Services"
      trustScore={94}
      onViewDetails={fn()}
      onEnroll={fn()}
    />
  ),
  name: 'Marketplace Card',
};

// ── Life OS Card ───────────────────────────────────────────────────────────

export const LifeOSDefault: StoryObj = {
  render: () => (
    <LifeOSCard
      title="Morning Routine"
      state="morning"
      progress={65}
      dailyScore={82}
      onStart={fn()}
      onView={fn()}
    />
  ),
  name: 'Life OS Card',
};
