/**
 * CSIR-NET Chemistry Tracker - Storage & Data Protection Module
 * Independent module providing schema versioning, data validation,
 * crash-safe backups, and JSON export/restore.
 */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.CSIRStorage = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const SCHEMA_VERSION = 1;
  const CURRENT_APP_VERSION = "2.1.0";
  const APP_NAME = "CSIR-NET Chemistry Tracker";

  const STORAGE_KEYS = {
    DATA: "csir-tracker-data",
    AUTO_SNAPSHOT: "csir-tracker-data-backup-auto",
    THEME: "csir-tracker-theme"
  };

  const VALID_CATEGORIES = new Set(["bumper", "major", "minor"]);
  const VALID_STATUSES = new Set(["remaining", "doing", "completed", "skip"]);

  function isValidTopicId(id) {
    return (
      typeof id === "string" &&
      /^[a-zA-Z0-9_-]+$/.test(id) &&
      !Object.prototype.hasOwnProperty.call(Object.prototype, id)
    );
  }

  function isValidDeadline(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return false;
    }
    const [year, month, day] = value.split("-").map(Number);
    const parsed = new Date(year, month - 1, day);
    return (
      parsed.getFullYear() === year &&
      parsed.getMonth() === month - 1 &&
      parsed.getDate() === day
    );
  }

  function validateTopic(topic) {
    if (!topic || typeof topic !== "object") {
      return { valid: false, error: "Topic record must be an object." };
    }
    if (!isValidTopicId(topic.id)) {
      return { valid: false, error: `Invalid topic ID: "${topic.id}".` };
    }
    if (
      typeof topic.name !== "string" ||
      !topic.name.trim() ||
      topic.name.length > 160
    ) {
      return {
        valid: false,
        error: `Topic "${topic.id}" has an invalid name (must be 1-160 characters).`
      };
    }
    if (!VALID_CATEGORIES.has(topic.cat)) {
      return {
        valid: false,
        error: `Topic "${topic.id}" has an invalid category: "${topic.cat}".`
      };
    }
    if (!Number.isFinite(Number(topic.marks)) || Number(topic.marks) <= 0) {
      return {
        valid: false,
        error: `Topic "${topic.id}" has invalid marks (must be a positive number).`
      };
    }
    return { valid: true };
  }

  function validateProgress(item, id) {
    if (!item || typeof item !== "object") {
      return { valid: false, error: `Progress for topic "${id}" must be an object.` };
    }
    const status = item.status || "remaining";
    if (!VALID_STATUSES.has(status)) {
      return {
        valid: false,
        error: `Progress for topic "${id}" has an invalid status: "${status}".`
      };
    }
    if (item.lectures !== undefined && item.lectures !== null) {
      const num = Number(item.lectures);
      if (!Number.isFinite(num) || num < 0) {
        return {
          valid: false,
          error: `Progress for topic "${id}" has an invalid lecture count.`
        };
      }
    }
    if (item.note !== undefined && item.note !== null) {
      if (typeof item.note !== "string" || item.note.length > 10000) {
        return {
          valid: false,
          error: `Note for topic "${id}" exceeds maximum length of 10,000 characters.`
        };
      }
    }
    return { valid: true };
  }

  /**
   * Normalizes raw loaded data into versioned schema format without discarding
   * any unrecognized fields (preserves user data and extensions).
   */
  function normalizeTrackerData(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return {
        schemaVersion: SCHEMA_VERSION,
        appVersion: CURRENT_APP_VERSION,
        updatedAt: new Date().toISOString(),
        username: "",
        deadline: "2026-12-19",
        lectureDeadline: "",
        topics: [],
        progress: {}
      };
    }

    const isLegacy = raw.schemaVersion === undefined;
    const incomingSchemaVersion = isLegacy ? 0 : Number(raw.schemaVersion) || 0;

    let username = typeof raw.username === "string" ? raw.username.trim().slice(0, 50) : "";
    let deadline = isValidDeadline(raw.deadline) ? raw.deadline : "2026-12-19";
    let lectureDeadline = isValidDeadline(raw.lectureDeadline) ? raw.lectureDeadline : "";

    const rawTopics = Array.isArray(raw.topics) ? raw.topics : [];
    const topics = [];
    const seenTopicIds = new Set();

    for (const t of rawTopics) {
      if (t && isValidTopicId(t.id) && !seenTopicIds.has(t.id)) {
        seenTopicIds.add(t.id);
        topics.push({
          id: t.id,
          name: typeof t.name === "string" ? t.name.trim().slice(0, 160) : "Untitled Topic",
          cat: VALID_CATEGORIES.has(t.cat) ? t.cat : "minor",
          marks: Number.isFinite(Number(t.marks)) && Number(t.marks) > 0 ? Number(t.marks) : 1
        });
      }
    }

    const rawProgress = raw.progress && typeof raw.progress === "object" && !Array.isArray(raw.progress)
      ? raw.progress
      : isLegacy && !Array.isArray(raw)
      ? raw // In very early versions, the root object was the progress map
      : {};

    const progress = {};
    for (const [id, item] of Object.entries(rawProgress)) {
      if (!isValidTopicId(id) || !item || typeof item !== "object") continue;
      const status = VALID_STATUSES.has(item.status) ? item.status : "remaining";
      const lectures = item.lectures !== undefined && Number.isFinite(Number(item.lectures))
        ? Math.max(0, Math.floor(Number(item.lectures)))
        : 0;
      const pyq = Boolean(item.pyq);
      const revision = Boolean(item.revision);
      const test = Boolean(item.test);
      const note = typeof item.note === "string" ? item.note.slice(0, 10000) : "";

      // Preserve any additional fields from newer versions or other extensions
      const extraFields = {};
      for (const [k, v] of Object.entries(item)) {
        if (!["status", "lectures", "pyq", "revision", "test", "note"].includes(k)) {
          extraFields[k] = v;
        }
      }

      progress[id] = {
        status,
        lectures,
        pyq,
        revision,
        test,
        note,
        ...extraFields
      };
    }

    // Preserve any top-level unrecognized fields (like sessions, planner data, etc.)
    const topLevelExtra = {};
    for (const [k, v] of Object.entries(raw)) {
      if (!["schemaVersion", "appVersion", "updatedAt", "username", "deadline", "lectureDeadline", "topics", "progress"].includes(k)) {
        topLevelExtra[k] = v;
      }
    }

    return {
      schemaVersion: SCHEMA_VERSION,
      appVersion: CURRENT_APP_VERSION,
      updatedAt: new Date().toISOString(),
      originalSchemaVersion: incomingSchemaVersion,
      username,
      deadline,
      lectureDeadline,
      topics,
      progress,
      ...topLevelExtra
    };
  }

  /**
   * Generates a complete, portable JSON backup payload.
   */
  function createBackupPayload({
    topics = [],
    progress = {},
    username = "",
    deadline = "2026-12-19",
    lectureDeadline = "",
    theme = "light",
    extra = {}
  }) {
    return {
      appName: APP_NAME,
      appVersion: CURRENT_APP_VERSION,
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      theme: theme === "dark" ? "dark" : "light",
      username: typeof username === "string" ? username.trim() : "",
      deadline: isValidDeadline(deadline) ? deadline : "2026-12-19",
      lectureDeadline: isValidDeadline(lectureDeadline) ? lectureDeadline : "",
      topics: Array.isArray(topics) ? topics.map(t => ({ ...t })) : [],
      progress: progress && typeof progress === "object" ? JSON.parse(JSON.stringify(progress)) : {},
      extra: extra && typeof extra === "object" ? JSON.parse(JSON.stringify(extra)) : {}
    };
  }

  /**
   * Validates and inspects an incoming JSON backup string or parsed object.
   * Returns a validation result with summary metrics for user confirmation.
   */
  function inspectAndValidateBackup(input) {
    let raw;
    if (typeof input === "string") {
      try {
        raw = JSON.parse(input.replace(/^\uFEFF/, ""));
      } catch (err) {
        return { valid: false, error: `Invalid JSON syntax: ${err.message}` };
      }
    } else if (input && typeof input === "object") {
      raw = input;
    } else {
      return { valid: false, error: "Backup file is empty or not a valid JSON document." };
    }

    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return { valid: false, error: "Backup payload must be a JSON object." };
    }

    // Check topics
    const rawTopics = raw.topics;
    if (rawTopics !== undefined && !Array.isArray(rawTopics)) {
      return { valid: false, error: 'Backup field "topics" must be an array.' };
    }

    const seenIds = new Set();
    if (Array.isArray(rawTopics)) {
      for (const [index, topic] of rawTopics.entries()) {
        const check = validateTopic(topic);
        if (!check.valid) {
          return { valid: false, error: `Topic at index ${index}: ${check.error}` };
        }
        if (seenIds.has(topic.id)) {
          return { valid: false, error: `Duplicate topic ID "${topic.id}" found in backup.` };
        }
        seenIds.add(topic.id);
      }
    }

    // Check progress
    const rawProgress = raw.progress;
    if (rawProgress !== undefined && (typeof rawProgress !== "object" || Array.isArray(rawProgress))) {
      return { valid: false, error: 'Backup field "progress" must be an object map.' };
    }

    if (rawProgress && typeof rawProgress === "object") {
      for (const [id, item] of Object.entries(rawProgress)) {
        if (!isValidTopicId(id)) {
          return { valid: false, error: `Invalid topic ID "${id}" in progress map.` };
        }
        const check = validateProgress(item, id);
        if (!check.valid) {
          return { valid: false, error: check.error };
        }
      }
    }

    // Metadata validation
    if (raw.deadline !== undefined && raw.deadline !== "" && !isValidDeadline(raw.deadline)) {
      return { valid: false, error: `Invalid deadline date format in backup: "${raw.deadline}".` };
    }
    if (raw.lectureDeadline !== undefined && raw.lectureDeadline !== "" && !isValidDeadline(raw.lectureDeadline)) {
      return { valid: false, error: `Invalid lecture deadline date format in backup: "${raw.lectureDeadline}".` };
    }

    const normalized = normalizeTrackerData(raw);

    // Compute preview summary
    let completedCount = 0;
    let coveredMarks = 0;
    let totalMarks = 0;
    let remainingLectures = 0;

    for (const topic of normalized.topics) {
      totalMarks += topic.marks;
      const prog = normalized.progress[topic.id] || {};
      if (prog.status === "completed") {
        completedCount++;
        coveredMarks += topic.marks;
      } else if (prog.status !== "skip") {
        remainingLectures += Math.max(0, parseInt(prog.lectures, 10) || 0);
      }
    }

    return {
      valid: true,
      summary: {
        appName: raw.appName || APP_NAME,
        appVersion: raw.appVersion || "Legacy / Unversioned",
        schemaVersion: raw.schemaVersion ?? 0,
        exportedAt: raw.exportedAt || null,
        username: normalized.username || "(Not set)",
        deadline: normalized.deadline,
        lectureDeadline: normalized.lectureDeadline || "(Not set)",
        theme: raw.theme === "dark" ? "dark" : "light",
        topicCount: normalized.topics.length,
        completedCount,
        coveredMarks: Math.round(coveredMarks * 10) / 10,
        totalMarks: Math.round(totalMarks * 10) / 10,
        remainingLectures
      },
      data: normalized
    };
  }

  /**
   * Creates an automatic local snapshot before destructive actions.
   */
  function saveSafetySnapshot(storageObj, data, reason = "pre-operation") {
    if (!storageObj) return false;
    try {
      const snapshot = {
        snapshotTime: new Date().toISOString(),
        reason,
        data: normalizeTrackerData(data)
      };
      storageObj.setItem(STORAGE_KEYS.AUTO_SNAPSHOT, JSON.stringify(snapshot));
      return true;
    } catch (err) {
      console.warn("Could not save automatic safety snapshot:", err);
      return false;
    }
  }

  /**
   * Retrieves the latest automatic safety snapshot.
   */
  function getLatestSafetySnapshot(storageObj) {
    if (!storageObj) return null;
    try {
      const raw = storageObj.getItem(STORAGE_KEYS.AUTO_SNAPSHOT);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      console.warn("Could not load safety snapshot:", err);
      return null;
    }
  }

  return {
    SCHEMA_VERSION,
    CURRENT_APP_VERSION,
    APP_NAME,
    STORAGE_KEYS,
    isValidTopicId,
    isValidDeadline,
    validateTopic,
    validateProgress,
    normalizeTrackerData,
    createBackupPayload,
    inspectAndValidateBackup,
    saveSafetySnapshot,
    getLatestSafetySnapshot
  };
});
