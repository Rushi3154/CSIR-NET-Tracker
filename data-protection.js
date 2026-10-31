/**
 * Data Protection and Backup System for CSIR-NET Chemistry Tracker
 * Phase 0: Data protection and backup
 *
 * Provides schema versioning, full JSON backup/restore, and data migration capabilities.
 * Works with both desktop (Electron) and browser (localStorage) storage.
 */

// Schema versions - increment when making breaking changes
const SCHEMA_VERSIONS = {
    CURRENT: '2.1.0', // Current schema version
    V2_0_0: '2.0.0',  // Original v2.0 schema
    V1_0_0: '1.0.0',  // Legacy v1.0 schema (if needed)
};

class DataProtection {
    constructor() {
        this.version = SCHEMA_VERSIONS.CURRENT;
        this.migrationHistory = [];
    }

    /**
     * Create a backup of current data with full metadata
     * @param {Object} data - Current tracker data
     * @param {string} mode - 'manual' or 'auto'
     * @returns {Object} Backup data with metadata
     */
    createBackup(data, mode = 'manual') {
        const now = new Date();
        const backupId = `backup_${now.getTime()}_${Math.random().toString(36).substring(2, 9)}`;

        const backup = {
            metadata: {
                id: backupId,
                timestamp: now.toISOString(),
                version: this.version,
                mode: mode,
                source: (typeof window !== 'undefined' && window.api) ? 'desktop' : 'browser',
                checksum: this._calculateChecksum(data)
            },
            schema: {
                version: this.version,
                fields: this._getSchemaDescription(),
                compatibility: ['2.0.0', '2.1.0'] // Compatible schema versions
            },
            data: this._deepClone(data)
        };

        // Store in browser backup history (last 10 backups)
        this._storeBackupHistory(backup);

        return backup;
    }

    /**
     * Restore data from backup with validation
     * @param {Object} backup - Backup data to restore
     * @param {boolean} dryRun - If true, validate without applying
     * @returns {Object} Result with success status and data
     */
    restoreBackup(backup, dryRun = false) {
        const payloadData = (backup && backup.data) ? backup.data : backup;
        const schemaVer = (backup && backup.schema && backup.schema.version)
            ? backup.schema.version
            : (backup && backup.schemaVersion)
            ? String(backup.schemaVersion)
            : '2.0.0';

        const result = {
            success: false,
            message: '',
            warnings: [],
            data: null,
            metadata: (backup && backup.metadata) ? backup.metadata : {
                timestamp: new Date().toISOString(),
                version: schemaVer,
                mode: 'import'
            }
        };

        // Validate backup structure
        if (!this._validateBackup(backup)) {
            result.message = 'Invalid backup format: missing required fields';
            return result;
        }

        // Check schema compatibility
        const compatibility = this._checkSchemaCompatibility(schemaVer);
        if (!compatibility.compatible) {
            result.message = `Schema version ${schemaVer} is not compatible. ${compatibility.reason}`;
            return result;
        }

        // Validate checksum if present
        if (backup && backup.metadata && backup.metadata.checksum && !this._validateChecksum(payloadData, backup.metadata.checksum)) {
            result.warnings.push('Checksum validation failed - data may be corrupted');
        }

        // Migrate data if needed
        const migratedData = this._migrateData(payloadData, schemaVer);

        // Validate migrated data structure
        const validation = this._validateDataStructure(migratedData);
        if (!validation.valid) {
            result.message = `Data validation failed: ${validation.errors.join(', ')}`;
            return result;
        }

        result.success = true;
        result.message = `Backup restored successfully from ${result.metadata.timestamp || 'unknown date'}`;
        result.data = migratedData;

        // Record migration if needed
        if (backup.schema?.version !== this.version) {
            this.migrationHistory.push({
                fromVersion: backup.schema?.version,
                toVersion: this.version,
                timestamp: new Date().toISOString(),
                backupId: backup.metadata?.id
            });
        }

        return result;
    }

    /**
     * Export data to JSON file
     * @param {Object} data - Data to export
     * @param {string} fileName - Optional custom filename
     * @returns {Promise<boolean>} Success status
     */
    async exportJsonBackup(data, fileName = null) {
        try {
            const backup = this.createBackup(data, 'export');
            const jsonData = JSON.stringify(backup, null, 2);
            const defaultName = `csir-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
            const finalName = fileName || defaultName;

            // Desktop environment - use Electron save dialog
            if (window.api && typeof window.api.exportJson === 'function') {
                const result = await window.api.exportJson(jsonData, finalName);
                if (result) {
                    this._storeLocalBackup(backup);
                }
                return result;
            }

            // Browser environment
            const blob = new Blob([jsonData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = finalName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);

            // Also store in localStorage for quick restore
            this._storeLocalBackup(backup);
            return true;
        } catch (error) {
            console.error('Export failed:', error);
            return false;
        }
    }

    /**
     * Import data from JSON file
     * @param {File|string} fileOrContent - File object or JSON string
     * @returns {Promise<Object>} Restore result
     */
    async importJsonBackup(fileOrContent) {
        try {
            let backup;

            if (typeof fileOrContent === 'string') {
                backup = JSON.parse(fileOrContent);
            } else if (fileOrContent instanceof File) {
                const content = await fileOrContent.text();
                backup = JSON.parse(content);
            } else {
                throw new Error('Invalid input type');
            }

            const result = this.restoreBackup(backup);

            if (result.success && result.data) {
                // Store successful import as recent backup
                this._storeLocalBackup(this.createBackup(result.data, 'import'));
            }

            return result;
        } catch (error) {
            console.error('Import failed:', error);
            return {
                success: false,
                message: `Import failed: ${error.message}`,
                data: null
            };
        }
    }

    /**
     * Get backup history (last 10 backups)
     * @returns {Array} List of backup metadata
     */
    getBackupHistory() {
        try {
            if (typeof localStorage === 'undefined') return [];
            const history = localStorage.getItem('csir-tracker-backup-history');
            return history ? JSON.parse(history) : [];
        } catch {
            return [];
        }
    }

    /**
     * Clear old backups (keep only last N)
     * @param {number} keepCount - Number of backups to keep
     */
    cleanupOldBackups(keepCount = 10) {
        try {
            if (typeof localStorage === 'undefined') return;
            const history = this.getBackupHistory();
            if (history.length > keepCount) {
                const sorted = history.sort((a, b) =>
                    new Date(b.timestamp) - new Date(a.timestamp)
                );
                const toKeep = sorted.slice(0, keepCount);
                localStorage.setItem('csir-tracker-backup-history', JSON.stringify(toKeep));
            }
        } catch (error) {
            console.warn('Backup cleanup failed:', error);
        }
    }

    /**
     * Auto-backup before significant operations
     * @param {Object} currentData - Current data to backup
     * @returns {boolean} Success status
     */
    autoBackup(currentData) {
        try {
            const backup = this.createBackup(currentData, 'auto');
            this._storeLocalBackup(backup);

            // Clean up old auto-backups (keep last 5)
            const history = this.getBackupHistory();
            const autoBackups = history.filter(b => b.mode === 'auto');
            if (autoBackups.length > 5) {
                this.cleanupOldBackups(5);
            }

            return true;
        } catch (error) {
            console.warn('Auto-backup failed:', error);
            return false;
        }
    }

    // Private methods

    _deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    _calculateChecksum(data) {
        const str = JSON.stringify(data);
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(36);
    }

    _validateChecksum(data, checksum) {
        return this._calculateChecksum(data) === checksum;
    }

    _getSchemaDescription() {
        return {
            topics: {
                type: 'array',
                required: true,
                fields: {
                    id: { type: 'string', pattern: /^[a-zA-Z0-9_-]+$/, required: true },
                    name: { type: 'string', maxLength: 160, required: true },
                    cat: { type: 'string', enum: ['bumper', 'major', 'minor'], required: true },
                    marks: { type: 'number', min: 0.1, required: true }
                }
            },
            progress: {
                type: 'object',
                required: true,
                patternProperties: {
                    '^[a-zA-Z0-9_-]+$': {
                        status: { type: 'string', enum: ['remaining', 'doing', 'completed', 'skip'] },
                        pyq: { type: 'boolean' },
                        revision: { type: 'boolean' },
                        test: { type: 'boolean' },
                        lectures: { type: 'number', min: 0 },
                        note: { type: 'string', maxLength: 10000 }
                    }
                }
            },
            metadata: {
                username: { type: 'string', maxLength: 50 },
                deadline: { type: 'string', format: 'date' },
                lectureDeadline: { type: 'string', format: 'date' }
            }
        };
    }

    _validateBackup(backup) {
        if (!backup || typeof backup !== 'object') return false;
        if (backup.metadata && backup.data) {
            return backup.data.topics !== undefined || backup.data.progress !== undefined;
        }
        return backup.topics !== undefined || backup.progress !== undefined;
    }

    _checkSchemaCompatibility(version) {
        const v = String(version || '');
        if (v === this.version || v === '2.1.0' || v === '2.0.0' || v === '1.0.0' || v === '1') {
            return { compatible: true, reason: '' };
        }

        return {
            compatible: false,
            reason: `Version ${version} is not compatible with ${this.version}`
        };
    }

    _migrateData(data, fromVersion) {
        if (fromVersion === this.version) {
            return data;
        }

        // Migration from v2.0.0 to v2.1.0
        if (fromVersion === '2.0.0' && this.version === '2.1.0') {
            const migrated = this._deepClone(data);

            // Ensure all progress entries have lectures field
            if (migrated.progress) {
                Object.keys(migrated.progress).forEach(id => {
                    if (migrated.progress[id].lectures === undefined) {
                        migrated.progress[id].lectures = 0;
                    }
                });
            }

            return migrated;
        }

        // Return as-is for other versions (should be validated first)
        return data;
    }

    _validateDataStructure(data) {
        const errors = [];

        // Check topics array
        if (!Array.isArray(data.topics)) {
            errors.push('topics must be an array');
        } else {
            data.topics.forEach((topic, index) => {
                if (!topic.id || !/^[a-zA-Z0-9_-]+$/.test(topic.id)) {
                    errors.push(`topic ${index} has invalid id`);
                }
                if (!topic.name || topic.name.length > 160) {
                    errors.push(`topic ${index} has invalid name`);
                }
                if (!['bumper', 'major', 'minor'].includes(topic.cat)) {
                    errors.push(`topic ${index} has invalid category`);
                }
                if (!topic.marks || typeof topic.marks !== 'number' || topic.marks <= 0) {
                    errors.push(`topic ${index} has invalid marks`);
                }
            });
        }

        // Check progress object
        if (data.progress && typeof data.progress !== 'object') {
            errors.push('progress must be an object');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    _storeBackupHistory(backup) {
        try {
            if (typeof localStorage === 'undefined') return;
            const history = this.getBackupHistory();
            history.unshift({
                id: backup.metadata.id,
                timestamp: backup.metadata.timestamp,
                version: backup.metadata.version,
                mode: backup.metadata.mode,
                checksum: backup.metadata.checksum,
                topicCount: backup.data.topics?.length || 0
            });

            // Keep only last 10 backups
            if (history.length > 10) {
                history.length = 10;
            }

            localStorage.setItem('csir-tracker-backup-history', JSON.stringify(history));
        } catch (error) {
            console.warn('Failed to store backup history:', error);
        }
    }

    _storeLocalBackup(backup) {
        try {
            if (typeof localStorage === 'undefined') return;
            // Store complete backup in localStorage with limited size
            const backupKey = `csir-tracker-backup-${backup.metadata.id}`;
            const backupData = JSON.stringify(backup);

            // Check size (localStorage has ~5MB limit)
            if (backupData.length < 4 * 1024 * 1024) { // 4MB
                localStorage.setItem(backupKey, backupData);

                // Clean up old backups
                this._cleanupLocalStorageBackups();
            } else {
                console.warn('Backup too large for localStorage');
            }
        } catch (error) {
            console.warn('Failed to store local backup:', error);
        }
    }

    _cleanupLocalStorageBackups() {
        try {
            if (typeof localStorage === 'undefined') return;
            const backups = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('csir-tracker-backup-')) {
                    backups.push(key);
                }
            }

            // Sort by timestamp (extracted from key)
            backups.sort((a, b) => {
                const timeA = parseInt(a.split('_')[1]) || 0;
                const timeB = parseInt(b.split('_')[1]) || 0;
                return timeB - timeA;
            });

            // Keep only last 5 complete backups
            for (let i = 5; i < backups.length; i++) {
                localStorage.removeItem(backups[i]);
            }
        } catch (error) {
            console.warn('Failed to cleanup localStorage backups:', error);
        }
    }
}

// Export for both browser and Node.js environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DataProtection, SCHEMA_VERSIONS };
} else if (typeof window !== 'undefined') {
    window.CSIRDataProtection = { DataProtection, SCHEMA_VERSIONS };
}