/**
 * Weekly/Monthly Analytics and Performance Visualizations
 * Phase 4: Analytics dashboard with charts
 */

const AnalyticsModule = (() => {
  const STORAGE_KEY = "csir-tracker-analytics";

  class AnalyticsEngine {
    static generateWeeklyReport(topics, progress, studyHistory = []) {
      const now = new Date();
      const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay());
      const weekSessions = studyHistory.filter(s => new Date(s.date) >= startOfWeek);
      const completedThisWeek = topics.filter(t => (progress?.[t.id]?.status || '') === 'completed' && progress[t.id].lastUpdated >= startOfWeek.toISOString());
      const doneBefore = topics.filter(t => (progress?.[t.id]?.status || '') === 'completed');
      const remaining = topics.filter(t => (progress?.[t.id]?.status || '') !== 'completed' && (progress?.[t.id]?.status || '') !== 'skip');

      const weeklyProgress = (doneBefore.length / Math.max(topics.length - (topics.filter(t => (progress?.[t.id]?.status || '') === 'skip').length), 1)) * 100;
      const lecturesThisWeek = weekSessions.reduce((sum, s) => sum + (s.lecturesCompleted || 0), 0);
      const avgSessionDuration = weekSessions.length ? weekSessions.reduce((sum, s) => sum + (s.durationMs || 0), 0) / weekSessions.length : 0;

      return {
        weekOf: startOfWeek.toLocaleDateString(),
        sessionCount: weekSessions.length,
        lecturesThisWeek,
        avgDurationMinutes: Math.round(avgSessionDuration / 60000),
        newCompletions: completedThisWeek.length,
        totalCompleted: doneBefore.length,
        weeklyProgressPercent: weeklyProgress.toFixed(1),
        remainingTopics: remaining.length
      };
    }

    static generateMonthlyReport(topics, progress, studyHistory = []) {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthSessions = studyHistory.filter(s => new Date(s.date) >= monthStart);

      const completedThisMonth = topics.filter(t => {
        const p = progress?.[t.id];
        return p?.status === 'completed' && p.lastUpdated && new Date(p.lastUpdated) >= monthStart;
      });

      const totalLectures = monthSessions.reduce((sum, s) => sum + (s.lecturesCompleted || 0), 0);
      const totalDuration = monthSessions.reduce((sum, s) => sum + (s.durationMs || 0), 0);
      const avgDailyMinutes = monthSessions.length ? Math.round(totalDuration / 60000 / Math.max(1, monthSessions.length)) : 0;
      const studyDays = new Set(monthSessions.map(s => s.date)).size;

      return {
        monthName: now.toLocaleString('default', { month: 'long', year: 'numeric' }),
        sessions: monthSessions.length,
        studyDays,
        lecturesCompleted: totalLectures,
        totalStudyMinutes: Math.round(totalDuration / 60000),
        avgDailyMinutes,
        newCompletions: completedThisMonth.length,
        consistencyScore: studyDays / Math.max(1, new Date().getDate()) * 100
      };
    }

    static getPerformanceTrend(topics, progress, days = 30) {
      const trend = { improving: true, completedToday: 0, completedWeek: 0, trendDirection: 'stable' };
      const today = new Date();
      const weekAgo = new Date(); weekAgo.setDate(today.getDate() - 7);
      const dayAgo = new Date(); dayAgo.setDate(today.getDate() - 1);

      const completedToday = topics.filter(t => (progress?.[t.id]?.status || '') === 'completed' && progress[t.id].lastUpdated && new Date(progress[t.id].lastUpdated).toDateString() === today.toDateString()).length;
      const completedWeek = topics.filter(t => (progress?.[t.id]?.status || '') === 'completed' && progress[t.id].lastUpdated && new Date(progress[t.id].lastUpdated) >= weekAgo).length;
      const completedYesterday = topics.filter(t => (progress?.[t.id]?.status || '') === 'completed' && progress[t.id].lastUpdated && new Date(progress[t.id].lastUpdated).toDateString() === dayAgo.toDateString()).length;

      trend.completedToday = completedToday;
      trend.completedWeek = completedWeek;
      trend.trendDirection = completedToday > completedYesterday ? 'up' : (completedToday < completedYesterday ? 'down' : 'stable');
      trend.improving = completedWeek > 0;
      return trend;
    }
  }

  return { AnalyticsEngine };
})();

if (typeof window !== 'undefined') window.AnalyticsModule = AnalyticsModule;
