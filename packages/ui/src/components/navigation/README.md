# Navigation Components

## Usage

```tsx
import { TabsRoot, TabsList, TabsTrigger, TabsContent, NavBar, Sidebar, Breadcrumb, Search } from '@vedmoulya/ui';
import { Home, Settings, User } from 'lucide-react';

// Tabs
<TabsRoot defaultValue="tab1">
  <TabsList>
    <TabsTrigger value="tab1">Account</TabsTrigger>
    <TabsTrigger value="tab2">Password</TabsTrigger>
  </TabsList>
  <TabsContent value="tab1">Account settings</TabsContent>
  <TabsContent value="tab2">Password settings</TabsContent>
</TabsRoot>

// NavBar
<NavBar
  logo={<span className="font-bold text-[#2B5FD9]">VedMoulya</span>}
  leftItems={<button>Dashboard</button>}
  rightItems={<Avatar alt="Profile" />}
  onMobileMenuToggle={() => setMenuOpen(!menuOpen)}
/>

// Sidebar
<Sidebar
  groups={[
    { label: 'Main', items: [
      { id: 'home', label: 'Home', icon: <Home />, active: true, onClick: () => {} },
      { id: 'settings', label: 'Settings', icon: <Settings />, onClick: () => {} },
    ]},
  ]}
  collapsed={false}
/>

// Breadcrumb
<Breadcrumb items={[
  { label: 'Home', href: '/' },
  { label: 'Projects', href: '/projects' },
  { label: 'Design System' },
]} />

// Search
<Search
  placeholder="Search..."
  onSearch={(value) => console.log(value)}
  recentSearches={['Design tokens', 'Components']}
/>
```

## Props Overview

### NavBar

| Prop               | Type              | Default | Description                         |
| ------------------ | ----------------- | ------- | ----------------------------------- |
| logo               | `React.ReactNode` | —       | Logo/brand element                  |
| leftItems          | `React.ReactNode` | —       | Navigation links (hidden on mobile) |
| rightItems         | `React.ReactNode` | —       | Actions (hidden on mobile)          |
| mobileMenuOpen     | `boolean`         | —       | Mobile menu state                   |
| onMobileMenuToggle | `() => void`      | —       | Toggle handler                      |

### Sidebar

| Prop             | Type                        | Default | Description                  |
| ---------------- | --------------------------- | ------- | ---------------------------- |
| groups           | `SidebarGroup[]` (required) | —       | Navigation groups with items |
| collapsed        | `boolean`                   | `false` | Collapsed state (icons only) |
| onToggleCollapse | `() => void`                | —       | Collapse toggle handler      |

### Breadcrumb

| Prop  | Type                          | Default | Description                   |
| ----- | ----------------------------- | ------- | ----------------------------- |
| items | `BreadcrumbItem[]` (required) | —       | Trail items (last is current) |

### Search

| Prop           | Type              | Default       | Description               |
| -------------- | ----------------- | ------------- | ------------------------- |
| value          | `string`          | —             | Controlled value          |
| onChange       | `(value) => void` | —             | Change handler            |
| onSearch       | `(value) => void` | —             | Enter key handler         |
| placeholder    | `string`          | `'Search...'` | Input placeholder         |
| recentSearches | `string[]`        | —             | Recent search suggestions |

## Accessibility

- Tabs use Radix UI primitives with full ARIA support (tablist, tab, tabpanel roles)
- NavBar uses semantic `<header>` and `<nav>` elements
- Mobile menu button has dynamic `aria-label` ("Open menu" / "Close menu")
- Sidebar items in collapsed mode use `aria-label` for icon-only buttons
- Breadcrumb uses `aria-label="Breadcrumb"` on the `<nav>` element
- Search input uses `aria-label` set to placeholder text

## Performance Notes

- Tabs use Radix UI's lazy mounting by default
- Sidebar uses CSS transitions for collapse/expand animation (250ms)
- Search has a debounce-ready onChange pattern

## Engineering Notes

- Tabs are composed of individual exports (Root, List, Trigger, Content)
- NavBar uses responsive classes: `hidden md:flex` for desktop items
- Sidebar supports badges on items (strings or numbers)
- Search detects controlled vs uncontrolled via `value !== undefined`
- Search dropdown uses `setTimeout` for blur handling to allow click

## Design References

- DES-001 Constitution v1.0 — Navigation section
- DES-010A/D07 Component Behaviour — Navigation specifications
- Sidebar: 280px expanded / 64px collapsed
