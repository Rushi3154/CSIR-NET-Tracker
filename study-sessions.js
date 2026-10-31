/**
 * Daily Study Sessions and Activity Tracking
 * Phase 2: Study session management with targets and history
 */

const StudyHistory = (() => {
  const STORAGE_KEY = "csir-tracker-study-history";
  const MAX_ENTRIES = 365; // Keep 1 year of daily records

  // Session tracking
  let currentSession = null;

  class StudyTracker {
    static startSession(dateStr = null) {
      const today = dateStr || new Date().toISOString().split('T')[0];
      currentSession = {
        date: today,
        startTime: Date.now(),
        topicsStudied: [],
        lecturesCompleted: 0,
        notes: "",
        targetMet: false
      };
      return currentSession;
    }

    static endSession() {
      if (!currentSession) return null;
      const session = { ...currentSession, endTime: Date.now(), durationMs: Date.now() - currentSession.startTime };
      StudyTracker.recordSession(session);
      currentSession = null;
      return session;
    }

    static recordSession(session) {
      try {
        const history = StudyTracker.getHistory();
        const existingIndex = history.findIndex(s => s.date === session.date);
        if (existingIndex >= 0) {
          history[existingIndex] = session;
        } else {
          history.push(session);
        }
        // Sort by date and keep only last MAX_ENTRIES
        const sorted = history.sort((a, b) => new Date(a.date) - new Date(b.date));
        const trimmed = sorted.slice(-MAX_ENTRIES);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
        return true;
      } catch (e) {
        console.warn("Failed to save study session:", e);
        return false;
      }
    }

    static getHistory() {
      try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
      } catch {
        return [];
      }
    }

    static getTodayRecord() {
      const today = new Date().toISOString().split('T')[0];
      const history = StudyTracker.getHistory();
      return history.find(s => s.date === today) || null;
    }

    static getWeeklySummary() {
      const history = StudyTracker.getHistory();
      const today = new Date();
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      const weekSessions = history.filter(s => new Date(s.date) >= startOfWeek);
      const totalDuration = weekSessions.reduce((sum, s) => sum + (s.durationMs || 0), 0);
      const totalLectures = weekSessions.reduce((sum, s) => sum + (s.lecturesCompleted || 0), 0);
      const topicsStudied = new Set();
      weekSessions.forEach(s => (s.topicsStudied || []).forEach(t => topicsStudied.add(t)));
      return {
        sessionCount: weekSessions.length,
        totalDurationMs: totalDuration,
        totalLectures,
        uniqueTopics: topicsStudied.size,
        sessions: weekSessions
      };
    }

    static getMonthlyStats() {
      const history = StudyTracker.getHistory();
      const now = new Date();
      const thisMonth = now.getMonth();
      const thisYear = now.getFullYear();
      const monthSessions = history.filter(s => {
        const d = new Date(s.date);
        return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
      });
      const totalDuration = monthSessions.reduce((sum, s) => sum + (s.durationMs || 0), 0);
      const avgDailyLectures = monthSessions.length ? Math.round(monthSessions.reduce((sum, s) => sum + (s.lecturesCompleted || 0), 0) / monthSessions.length) : 0;
      return {
        sessionCount: monthSessions.length,
        totalDurationMs: totalDuration,
        avgDailyLectures,
        sessions: monthSessions
      };
    }

    static getStreak() {
      const history = StudyTracker.getHistory();
      if (!history.length) return 0;
      const sorted = [...history].sort((a, b) => new Date(b.date) - new Date(a.date));
      let streak = 0;
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      const lastSessionDate = sorted[0].date;

      if (lastSessionDate !== today && lastSessionDate !== yesterdayStr) return 0;

      for (let i = 0; i < sorted.length; i++) {
        const sessionDate = sorted[i].date;
        const expectedDate = new Date();
        expectedDate.setDate(today.getDate() - i);
        const expectedStr = expectedDate.toISOString().split('T')[0];
        if (sessionDate === expectedStr) {
          streak++;
        } else {
          break;
        }
      }
      return streak;
    }
  }

  return { StudyTracker };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = StudyHistory;
} else if (typeof window !== 'undefined') {
  window.StudyHistoryModule = StudyHistory;
}
