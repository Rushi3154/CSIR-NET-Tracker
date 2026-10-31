/**
 * Exam Readiness Indicators and Weak-Topic Identification
 * Phase 5: Exam readiness assessment
 */

const ExamReadiness = (() => {
  class ReadinessEngine {
    static assess(topics, progress, daysToExam) {
      const totalMarks = topics.reduce((s, t) => s + t.marks, 0);
      const completed = topics.filter(t => progress?.[t.id]?.status === 'completed');
      const excluded = topics.filter(t => progress?.[t.id]?.status === 'skip');
      const eligible = topics.filter(t => progress?.[t.id]?.status !== 'skip');
      const coveredMarks = completed.reduce((s, t) => s + t.marks, 0);
      const pct = eligible.length ? (coveredMarks / eligible.reduce((s, t) => s + t.marks, 0)) * 100 : 0;

      // Weak topics: high marks + incomplete
      const weak = eligible.map(t => {
        const p = progress?.[t.id] || {};
        const status = p.status || 'remaining';
        const lectures = Math.max(0, parseInt(p.lectures || 0, 10));
        const completeness = status === 'completed' ? 1 : status === 'skip' ? 0 : Math.max(0, 1 - lectures / 5);
        return {
          ...t,
          completeness,
          weaknessScore: (t.marks / Math.max(0.1, totalMarks)) * (1 - completeness),
          isWeak: status !== 'completed' && status !== 'skip'
        };
      }).filter(t => t.isWeak).sort((a, b) => b.weaknessScore - a.weaknessScore).slice(0, 10);

      let level = 'early';
      if (daysToExam <= 7) level = 'critical';
      else if (daysToExam <= 14) level = 'urgent';
      else if (daysToExam <= 30) level = 'preparing';
      else if (daysToExam <= 60) level = 'planning';

      return {
        readinessLevel: level,
        daysRemaining: Math.max(0, daysToExam),
        coveragePercent: pct.toFixed(1),
        completedTopics: completed.length,
        remainingTopics: eligible.length - completed.length,
        excludedTopics: excluded.length,
        weakTopics: weak,
        recommendations: level === 'critical' ? ['Focus on remaining high-mark topics only', 'Complete lecture content for top 3 weak topics', 'Start PYQ/revision for completed topics'] :
                        level === 'urgent' ? ['Complete all high-mark remaining topics', 'Finish lecture content then start tests/revision', 'Maintain daily study pace'] :
                        ['Maintain steady progress', 'Complete lecture content before exam', 'Review completed topics periodically'],
        isReady: pct >= 85 && daysToExam >= 7
      };
    }
  }
  return { ReadinessEngine };
})();
if (typeof window !== 'undefined') window.ExamReadinessModule = ExamReadiness;
