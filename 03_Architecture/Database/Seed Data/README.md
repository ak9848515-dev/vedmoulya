# Seed Data

**Version:** 1.0
**Status:** Draft
**Owner:** Chief Technology Officer
**Created:** 2026-07-24
**Updated:** 2026-07-24

## Purpose

Provide reference data, default configurations, sample data, and test fixtures required for application functionality and development workflows.

## Scope

- Reference data (skill taxonomies, career paths, industry codes, etc.)
- Default configuration data
- Sample/demo data for onboarding and testing
- Test fixtures for automated testing
- Environment-specific seed data (dev, staging, prod)
- Idempotent seed scripts

## Responsibilities

- Maintain seed data that reflects production-like scenarios
- Ensure seed scripts are idempotent and safe to re-run
- Version seed data alongside application code
- Provide clear documentation of seed data content and purpose
- Support seed data for local development and CI environments

## Dependencies

- 03_Architecture/Database/Schema
- 03_Architecture/Database/Migrations
- 02_Product/Personas
- 02_Product/Features

## Future Expansion

- Seed data generators for large-scale test scenarios
- Anonymized production data snapshots for staging
- Seed data validation and integrity checks
- User-customizable seed templates for SaaS onboarding
