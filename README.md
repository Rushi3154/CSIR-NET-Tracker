# CSIR-NET Chemistry Advanced Study Management System

## Overview

This is an upgraded version of the CSIR-NET Chemistry Topic Tracker v2.0, now transformed into an advanced, modular study management system. The system includes data protection, backup/restore functionality, and is ready for additional phases of development.

## Current Status: Phase 0 (Data Protection & Backup)

✅ **Completed Features:**

1. **Schema Versioning**: Implemented version control for data structure compatibility
2. **Full JSON Backup/Restore**: Complete data protection with checksum validation
3. **Backup History Management**: Automatic backup tracking with cleanup
4. **Cross-Platform Support**: Works in both Electron (desktop) and browser (web) environments
5. **Auto-Backup System**: Intelligent backup before critical operations
6. **Data Migration**: Smooth migration between schema versions
7. **Validation & Error Handling**: Comprehensive input validation and error recovery

## Key Features

### Data Protection
- **Schema versioning**: Track and manage data structure versions
- **Checksum validation**: Ensure data integrity
- **Backup history**: Automatic tracking of all backups
- **Auto-backup**: Protects against data loss during operations

### Backup & Restore
- **JSON export**: Complete data backup with full metadata
- **Import/Export**: Cross-platform data transfer
- **Selective restore**: Preview and validate before restoring
- **Quick access**: LocalStorage backup for browser environment

### Compatibility
- Maintains backward compatibility with v2.0.0
- Forward-ready for future schema versions
- Works in both Electron and browser environments
- Preserves all existing functionality

## Storage Architecture

The system uses a dual storage approach:

1. **Desktop (Electron)**: CSV-based storage in user documents folder
2. **Browser**: JSON-based storage in localStorage

Both approaches are abstracted through the storage interface, ensuring consistent behavior across platforms.

## Running the Application

### Prerequisites
- Node.js (for development only)
- Electron (for desktop version)

### Development
```bash
# Clone the repository
# Navigate to project directory
# Install dependencies (if needed)
# Run: npm run dist  # Build for distribution
```

### Production
```bash
# The application is ready for distribution
# Use the generated installer or packaged build
```

## Testing

After each phase of development, comprehensive testing is performed:

1. **Functionality Tests**: Verify existing features work correctly
2. **Storage Integrity**: Ensure data saving/loading works properly
3. **Backup/Restore**: Test backup creation and data recovery
4. **Cross-Platform**: Verify both desktop and browser environments
5. **Responsive Design**: Test on different screen sizes
6. **Console Checks**: Monitor for JavaScript errors

## Development Roadmap

Current Phase: 0/6

### Upcoming Phases
1. **Interface Refinement** (Phase 1): UI/UX improvements, lecture counter, undo, keyboard shortcuts
2. **Daily Study Sessions** (Phase 2): Activity tracking and history
3. **Smart Study Planner** (Phase 3): Priority recommendations and planning
4. **Analytics** (Phase 4): Weekly/monthly performance visualizations
5. **Exam Readiness** (Phase 5): Weak topic identification and readiness indicators
6. **Advanced Features** (Phase 6): Focus mode, Pomodoro, reminders, and reporting

## Data Migration

The system includes automatic data migration capabilities:
- Version 2.1.0 → 2.0.0 forward-compatible
- Preserves all topic IDs, data, and progress
- Maintains existing CSV import/export functionality
- No data loss during upgrades

## Security & Privacy

- All data is stored locally on the user's device
- No cloud synchronization without explicit user consent
- LocalStorage operations include error handling
- Backup files are optional and user-initiated

## Acknowledgments

This project builds upon the foundation of CSIR-NET Chemistry Topic Tracker v2.0, adding enterprise-grade data protection and backup capabilities for enhanced reliability and user confidence.