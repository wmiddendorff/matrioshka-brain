# Mudpuppy Documentation

This directory contains comprehensive documentation for all modules and systems in Mudpuppy.

## Documentation Structure

Each module has its own directory with detailed documentation:

- **[config/](./config/)** - Configuration system and settings management
- **[memory/](./memory/)** - Memory persistence, hybrid search, embeddings (Phase 3)
- **[soul/](./soul/)** - Soul/Identity system, bootstrap files (Phase 2)
- **[autonomy/](./autonomy/)** - Heartbeat engine, cron scheduling (Phase 4)
- **[telegram/](./telegram/)** - Telegram bot integration (Phase 1)
- **[tools/](./tools/)** - Agent tools and tool registry
- **[security/](./security/)** - Approval system, audit logging (Phase 5)
- **[architecture/](./architecture/)** - Overall system architecture and design decisions

## Documentation Standards

Each module directory should contain:

1. **README.md** - Overview, purpose, and quick start
2. **API.md** - Public API documentation with examples
3. **IMPLEMENTATION.md** - Implementation details and internals
4. **TESTING.md** - Testing strategy and test cases
5. **DECISIONS.md** - Architectural decisions and rationale

## When to Update Documentation

Documentation must be updated during development, not after:

- **During implementation**: Document as you build
- **When adding features**: Update API.md with new interfaces
- **When making decisions**: Log in DECISIONS.md
- **When writing tests**: Document test strategy in TESTING.md
- **Before phase completion**: Review and finalize all docs

## Documentation Guidelines

### Writing Style
- Clear and concise
- Use code examples
- Include diagrams where helpful (ASCII art is fine)
- Link to related docs
- Keep it up to date

### Code Examples
- Should be runnable
- Include imports
- Show expected output
- Cover common use cases

### Internal vs External
- Internal: Implementation details, performance notes, gotchas
- External: Public API, usage examples, configuration

## Module Status

| Module | Phase | Status | Docs Complete |
|--------|-------|--------|---------------|
| Config | Phase 0 | ✅ Complete | ✅ Complete |
| Telegram | Phase 1 | ⬜ Not Started | ⬜ Not Started |
| Soul | Phase 2 | ⬜ Not Started | ⬜ Not Started |
| Memory | Phase 3 | ⬜ Not Started | ⬜ Not Started |
| Autonomy | Phase 4 | ⬜ Not Started | ⬜ Not Started |
| Security | Phase 5 | ⬜ Not Started | ⬜ Not Started |

## Quick Links

- [Main README](../README.md)
- [PRD](../PRD.md)
- [PROGRESS](../PROGRESS.md)
- [CLAUDE.md](../CLAUDE.md)
