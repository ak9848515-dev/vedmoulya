# ERD (Entity Relationship Diagrams)

**Version:** 1.0
**Status:** Draft
**Owner:** Chief Technology Officer
**Created:** 2026-07-24
**Updated:** 2026-07-24

## Purpose

Provide visual entity-relationship diagrams that map the complete data model of the VedMoulya platform, enabling clear understanding of data structures and relationships.

## Scope

- Logical ERD (business entities and relationships)
- Physical ERD (actual table implementations)
- Domain-specific ERD views (per service area)
- Relationship cardinality and dependency documentation
- Attribute-level detail for each entity

## Responsibilities

- Maintain up-to-date ERDs that reflect the actual database
- Provide both high-level overview and detailed ERDs
- Document relationship semantics and constraints
- Enable easy navigation between logical and physical models
- Version ERDs alongside schema changes

## Dependencies

- 03_Architecture/Database/Schema
- 03_Architecture/Database/Data Dictionary
- 03_Architecture/Backend (all services)

## Future Expansion

- Interactive web-based ERD viewer
- Automated ERD generation from schema files
- Diff views showing schema changes over time
- Export to popular diagramming tools (dbdiagram, DrawIO, Mermaid)
