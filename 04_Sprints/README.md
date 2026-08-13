# Sprints & Epics

> Sprint and epic management for VedMoulya — the operating cadence of the roadmap.
> Owner: Program Management · Updated: 2026-08-03 (DOC-001)

## Purpose

Manage epics, sprints, and the master roadmap. This folder is the forward-looking planning home: EPIC folders hold epic briefs, ENTERPRISE_INTELLIGENCE holds the EI program, OPEN_SOURCE holds the OSR program, and MASTER_ROADMAP.md is the single planning spine.

## Scope

- Master roadmap (missions, epics, sprints, backlog)
- Epic briefs (EPIC-001…EPIC-007)
- Enterprise Intelligence program (EI-001…EI-010)
- Open Source program (OSR-001…OSR-004)

Legacy sprint records live in `10_Sprints/` (historical ROADMAP, mission tracker) and in `09_Documents/` (completion and certification reports). This folder is the forward-looking planning home.

## Current Status

- **Active sprint:** DOC-001 (Documentation & Governance Foundation)
- **Most recent engineering sprint:** EPIC-003 / AC-002.5 — complete, verdict 🟢 CLIENT READY
- **Roadmap:** MISSION-001…020 released (v1.0.0); next wave = EI + OSR programs

## Architecture

```
04_Sprints/
  MASTER_ROADMAP.md        ← planning spine (12 sections)
  README.md
  EPIC-001…007/            ← epic briefs
  ENTERPRISE_INTELLIGENCE/ ← EI-001…EI-010 design series
  OPEN_SOURCE/             ← OSR-001…OSR-004 program
```

## Responsibilities

- Program Management: maintain MASTER_ROADMAP and sprint status
- Epic owners: keep epic briefs current
- All contributors: reference epics/sprints in commits and docs

## Deliverables

- Master roadmap
- Epic briefs and EI/OSR program documents
- Sprint status tracking

## Dependencies

- `00_Foundation/` (mission, constitution)
- `10_Sprints/` (historical records)
- `docs/` (reports, certification)

## Future Work

- Sprint retrospectives
- Roadmap automation (issue sync)

## References

- [MASTER_ROADMAP.md](./MASTER_ROADMAP.md)
- [../03_Architecture/ENTERPRISE_INTELLIGENCE.md](../03_Architecture/ENTERPRISE_INTELLIGENCE.md)
- [../10_Sprints/ROADMAP.md](../10_Sprints/ROADMAP.md)
