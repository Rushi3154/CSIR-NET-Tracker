/**
 * Daily Study Sessions, Targets and Activity History
 * Phase 2: Study session management with targets, streak calculation, and activity history
 */

const StudyHistory = (() => {
  const SESSIONS_STORAGE_KEY = "csir-tracker-study-history";
  const TARGETS_STORAGE_KEY = "csir-tracker-daily-targets";
  const ACTIVE_SESSION_STORAGE_KEY = "csir-tracker-active-session";
  const MAX_ENTRIES = 365; // Retain 1 full year of daily study records

  // Fallback in-memory store for environments without localStorage (e.g. testing)
  const inMemoryStore = {};
  function getStorage() {
    if (typeof localStorage !== "undefined") return localStorage;
    return {
      getItem: (k) => inMemoryStore[k] || null,
      setItem: (k, v) => { inMemoryStore[k] = String(v); },
      removeItem: (k) => { delete inMemoryStore[k]; }
    };
  }

  // Active in-progress study session
  let activeSession = null;

  function toDateString(dateObj = new Date()) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, "0");
    const d = String(dateObj.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  class StudyTracker {
    /**
     * Start a new active timer session
     */
    static startSession(dateStr = null) {
      if (activeSession) {
        return { ...activeSession };
      }
      const existing = StudyTracker.getActiveSession();
      if (existing) {
        return existing;
      }

      const today = dateStr || toDateString();
      activeSession = {
        id: `sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        date: today,
        startTime: Date.now(),
        topicsStudied: [],
        lecturesCompleted: 0,
        notes: "",
        durationMs: 0
      };

      try {
        const storage = getStorage();
        storage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(activeSession));
      } catch {}

      return activeSession;
    }

    /**
     * Get the active session if one is running
     */
    static getActiveSession() {
      if (!activeSession) {
        try {
          const storage = getStorage();
          const stored = storage.getItem(ACTIVE_SESSION_STORAGE_KEY);
          if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed && typeof parsed === "object" && parsed.startTime) {
              activeSession = parsed;
            }
          }
        } catch {}
      }

      if (!activeSession) return null;
      return {
        ...activeSession,
        currentDurationMs: Math.max(0, Date.now() - activeSession.startTime)
      };
    }

    static isSessionActive() {
      return StudyTracker.getActiveSession() !== null;
    }

    /**
     * Update in-progress session metrics
     */
    static updateActiveSession(updates = {}) {
      if (!activeSession) {
        StudyTracker.getActiveSession();
      }
      if (!activeSession) return null;

      if (Number.isFinite(updates.lecturesCompleted) && updates.lecturesCompleted >= 0) {
        activeSession.lecturesCompleted = updates.lecturesCompleted;
      }
      if (Array.isArray(updates.topicsStudied)) {
        activeSession.topicsStudied = [...updates.topicsStudied];
      }
      if (typeof updates.notes === "string") {
        activeSession.notes = updates.notes;
      }

      try {
        const storage = getStorage();
        storage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(activeSession));
      } catch {}

      return activeSession;
    }

    /**
     * End active session, calculate duration, and record
     */
    static endSession() {
      if (!activeSession) {
        StudyTracker.getActiveSession();
      }
      if (!activeSession) return null;

      const now = Date.now();
      const durationMs = Math.max(0, now - activeSession.startTime);
      const sessionToSave = {
        ...activeSession,
        endTime: now,
        durationMs
      };

      StudyTracker.recordSession(sessionToSave);
      activeSession = null;

      try {
        const storage = getStorage();
        if (typeof storage.removeItem === "function") {
          storage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
        } else {
          storage.setItem(ACTIVE_SESSION_STORAGE_KEY, "");
        }
      } catch {}

      return sessionToSave;
    }

    /**
     * Cancel active session without saving
     */
    static cancelSession() {
      const canceled = activeSession || StudyTracker.getActiveSession();
      activeSession = null;

      try {
        const storage = getStorage();
        if (typeof storage.removeItem === "function") {
          storage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
        } else {
          storage.setItem(ACTIVE_SESSION_STORAGE_KEY, "");
        }
      } catch {}

      return canceled;
    }

    /**
     * Record or update a daily study record. Multiple sessions in the same day aggregate
     * lectures and duration.
     */
    static recordSession(session) {
      if (!session || typeof session !== "object" || !session.date) return false;
      try {
        const storage = getStorage();
        const history = StudyTracker.getHistory();
        const existingIndex = history.findIndex(s => s.date === session.date);

        const newNotes = typeof session.notes === "string" ? session.notes.trim() : "";

        if (existingIndex >= 0) {
          const existing = history[existingIndex];
          // Merge topics
          const mergedTopics = Array.from(new Set([
            ...(existing.topicsStudied || []),
            ...(session.topicsStudied || [])
          ]));

          let combinedNotes = existing.notes || "";
          if (newNotes) {
            combinedNotes = combinedNotes ? `${combinedNotes} | ${newNotes}` : newNotes;
          }

          history[existingIndex] = {
            ...existing,
            durationMs: (existing.durationMs || 0) + (Number(session.durationMs) || 0),
            lecturesCompleted: (existing.lecturesCompleted || 0) + (Number(session.lecturesCompleted) || 0),
            topicsStudied: mergedTopics,
            notes: combinedNotes
          };
        } else {
          history.push({
            id: session.id || `sess_${Date.now()}`,
            date: session.date,
            durationMs: Math.max(0, Number(session.durationMs) || 0),
            lecturesCompleted: Math.max(0, Number(session.lecturesCompleted) || 0),
            topicsStudied: Array.isArray(session.topicsStudied) ? session.topicsStudied : [],
            notes: newNotes
          });
        }

        // Sort chronologically and limit history
        history.sort((a, b) => (a.date > b.date ? 1 : -1));
        const trimmed = history.slice(-MAX_ENTRIES);
        storage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(trimmed));
        return true;
      } catch (e) {
        console.warn("Failed to record study session:", e);
        return false;
      }
    }

    /**
     * Manually log a completed study session (e.g. offline study)
     */
    static logManualSession({
      date = toDateString(),
      durationMinutes = 60,
      lecturesCompleted = 0,
      topicsStudied = [],
      notes = ""
    }) {
      const durationMs = Math.max(0, Math.round((Number(durationMinutes) || 0) * 60 * 1000));
      return StudyTracker.recordSession({
        id: `manual_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        date,
        durationMs,
        lecturesCompleted: Math.max(0, parseInt(lecturesCompleted, 10) || 0),
        topicsStudied: Array.isArray(topicsStudied) ? topicsStudied : (topicsStudied ? [topicsStudied] : []),
        notes: typeof notes === "string" ? notes.trim() : ""
      });
    }

    /**
     * Delete a session record for a given date or ID
     */
    static deleteSession(dateOrId) {
      try {
        const storage = getStorage();
        const history = StudyTracker.getHistory();
        const filtered = history.filter(s => s.date !== dateOrId && s.id !== dateOrId);
        storage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(filtered));
        return true;
      } catch (e) {
        console.warn("Failed to delete session:", e);
        return false;
      }
    }

    /**
     * Clear all history (primarily for tests)
     */
    static clearAllHistory() {
      try {
        const storage = getStorage();
        if (typeof storage.removeItem === "function") {
          storage.removeItem(SESSIONS_STORAGE_KEY);
          storage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
        } else {
          storage.setItem(SESSIONS_STORAGE_KEY, "[]");
          storage.setItem(ACTIVE_SESSION_STORAGE_KEY, "");
        }
        activeSession = null;
        return true;
      } catch {
        return false;
      }
    }

    /**
     * Retrieve all historical daily session records
     */
    static getHistory() {
      try {
        const storage = getStorage();
        const data = storage.getItem(SESSIONS_STORAGE_KEY);
        if (!data) return [];
        const parsed = JSON.parse(data);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }

    /**
     * Retrieve daily targets
     */
    static getTargets() {
      try {
        const storage = getStorage();
        const data = storage.getItem(TARGETS_STORAGE_KEY);
        if (data) {
          const parsed = JSON.parse(data);
          return {
            dailyLectures: Math.max(1, parseInt(parsed.dailyLectures, 10) || 2),
            dailyMinutes: Math.max(15, parseInt(parsed.dailyMinutes, 10) || 60)
          };
        }
      } catch {}
      return { dailyLectures: 2, dailyMinutes: 60 };
    }

    /**
     * Set daily targets
     */
    static setTargets({ dailyLectures, dailyMinutes }) {
      try {
        const storage = getStorage();
        const targets = {
          dailyLectures: Math.max(1, parseInt(dailyLectures, 10) || 2),
          dailyMinutes: Math.max(15, parseInt(dailyMinutes, 10) || 60)
        };
        storage.setItem(TARGETS_STORAGE_KEY, JSON.stringify(targets));
        return targets;
      } catch (e) {
        console.warn("Failed to save daily targets:", e);
        return { dailyLectures: 2, dailyMinutes: 60 };
      }
    }

    /**
     * Get record for today
     */
    static getTodayRecord() {
      const today = toDateString();
      const history = StudyTracker.getHistory();
      return history.find(s => s.date === today) || null;
    }

    /**
     * Get summary metrics for today (lectures, duration, targets met)
     */
    static getTodayProgress() {
      const today = StudyTracker.getTodayRecord();
      const targets = StudyTracker.getTargets();
      const streak = StudyTracker.getStreak();

      let lecturesCompleted = today ? Number(today.lecturesCompleted) || 0 : 0;
      let durationMs = today ? Number(today.durationMs) || 0 : 0;

      const active = StudyTracker.getActiveSession();
      if (active && active.date === toDateString()) {
        durationMs += Math.max(0, Date.now() - active.startTime);
        lecturesCompleted += (Number(active.lecturesCompleted) || 0);
      }

      const durationMinutes = Math.round(durationMs / 60000);

      const lecturesMet = lecturesCompleted >= targets.dailyLectures;
      const timeMet = durationMinutes >= targets.dailyMinutes;

      return {
        date: toDateString(),
        lecturesCompleted,
        targetLectures: targets.dailyLectures,
        durationMinutes,
        targetMinutes: targets.dailyMinutes,
        lecturesMet,
        timeMet,
        overallTargetMet: lecturesMet || timeMet,
        streak,
        isTimerRunning: StudyTracker.isSessionActive()
      };
    }

    /**
     * Calculate current streak in consecutive days
     */
    static getStreak() {
      const history = StudyTracker.getHistory();
      if (!history.length) return 0;

      // Filter sessions that have either >0 lectures or >0 minutes duration
      const activeDays = new Set(
        history
          .filter(s => (s.lecturesCompleted && s.lecturesCompleted > 0) || (s.durationMs && s.durationMs >= 60000))
          .map(s => s.date)
      );

      // If active session is running today with duration or lectures, count today as active
      const active = StudyTracker.getActiveSession();
      const now = new Date();
      const todayStr = toDateString(now);
      if (active && active.date === todayStr && (active.lecturesCompleted > 0 || (Date.now() - active.startTime) >= 60000)) {
        activeDays.add(todayStr);
      }

      if (activeDays.size === 0) return 0;

      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const yesterdayStr = toDateString(yesterday);

      // If neither today nor yesterday has activity, streak is 0
      if (!activeDays.has(todayStr) && !activeDays.has(yesterdayStr)) {
        return 0;
      }

      let streak = 0;
      // Start counting backwards from today or yesterday
      let checkDate = new Date(now);
      if (!activeDays.has(todayStr)) {
        checkDate = yesterday;
      }

      while (true) {
        const checkStr = toDateString(checkDate);
        if (activeDays.has(checkStr)) {
          streak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }

      return streak;
    }

    /**
     * Weekly aggregated statistics
     */
    static getWeeklySummary() {
      const history = StudyTracker.getHistory();
      const now = new Date();
      const dayOfWeek = now.getDay();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1)); // Start on Monday
      startOfWeek.setHours(0, 0, 0, 0);

      const startOfWeekStr = toDateString(startOfWeek);
      const weekSessions = history.filter(s => s.date >= startOfWeekStr);
      const totalDuration = weekSessions.reduce((sum, s) => sum + (s.durationMs || 0), 0);
      const totalLectures = weekSessions.reduce((sum, s) => sum + (s.lecturesCompleted || 0), 0);

      const topicsStudied = new Set();
      weekSessions.forEach(s => (s.topicsStudied || []).forEach(t => topicsStudied.add(t)));

      return {
        sessionCount: weekSessions.length,
        totalDurationMs: totalDuration,
        totalDurationMinutes: Math.round(totalDuration / 60000),
        totalLectures,
        uniqueTopics: topicsStudied.size,
        sessions: weekSessions
      };
    }

    /**
     * Monthly aggregated statistics
     */
    static getMonthlyStats() {
      const history = StudyTracker.getHistory();
      const now = new Date();
      const thisMonth = now.getMonth();
      const thisYear = now.getFullYear();

      const monthSessions = history.filter(s => {
        const [y, m] = s.date.split("-").map(Number);
        return y === thisYear && m === thisMonth + 1;
      });

      const totalDuration = monthSessions.reduce((sum, s) => sum + (s.durationMs || 0), 0);
      const totalLectures = monthSessions.reduce((sum, s) => sum + (s.lecturesCompleted || 0), 0);
      const avgDailyLectures = monthSessions.length
        ? Math.round((totalLectures / monthSessions.length) * 10) / 10
        : 0;

      return {
        sessionCount: monthSessions.length,
        totalDurationMs: totalDuration,
        totalDurationMinutes: Math.round(totalDuration / 60000),
        totalLectures,
        avgDailyLectures,
        sessions: monthSessions
      };
    }
  }

  return { StudyTracker };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = StudyHistory;
} else if (typeof window !== "undefined") {
  window.StudyHistoryModule = StudyHistory;
}
