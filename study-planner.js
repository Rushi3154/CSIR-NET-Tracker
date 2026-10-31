/**
 * Smart Study Planner and Priority Recommendations
 * Phase 3: Study planning with priority recommendations
 *
 * Provides intelligent topic recommendations based on:
 * - Deadline proximity
 * - Marks weight
 * - Completion status
 * - Study patterns
 * - Exam readiness indicators
 */

const StudyPlanner = (() => {
  const WEIGHT_DEADLINE = 0.30;
  const WEIGHT_MARKS = 0.35;
  const WEIGHT_PROGRESS = 0.25;
  const WEIGHT_COMPLETION = 0.10;

  class PlannerEngine {
    static calculatePriority(topicProgress, daysToDeadline, studyHistory, userPatterns) {
      const p = topicProgress || {};
      const status = p.status || 'remaining';
      const lectures = Math.max(0, parseInt(p.lectures || 0, 10));
      const completed = status === 'completed';
      const inProgress = status === 'doing';
      const excluded = status === 'skip';

      // Skip excluded topics
      if (excluded) return { score: -1, reason: 'Excluded topic', recommendation: 'skip' };

      // Completed topics get low priority
      if (completed) return { score: 0.05, reason: 'Already completed', recommendation: 'review' };

      // Calculate urgency based on deadline
      let urgency = 1.0;
      if (daysToDeadline > 0) {
        urgency = Math.max(0.1, Math.min(1.0, 30 / daysToDeadline));
      }

      // Marks importance (higher marks = higher priority)
      const marks = parseFloat(topicProgress.marks || 1);
      const marksScore = Math.min(1.0, marks / 32); // Normalize: 32 marks = 1.0

      // Progress score: incomplete lectures = higher priority
      const progressScore = lectures > 0 ? Math.max(0, 1 - (lectures / 10)) : 1.0;

      // Category weight: bumper > major > minor for urgency
      let categoryBoost = 1.0;
      if (topicProgress.cat === 'bumper') categoryBoost = 1.25;
      else if (topicProgress.cat === 'major') categoryBoost = 1.1;
      else if (topicProgress.cat === 'minor') categoryBoost = 0.9;

      // Check if topic has recent study activity
      const recentActivity = studyHistory && studyHistory.length > 0
        ? studyHistory.slice(-7).filter(s => s.topicsStudied?.includes(topicProgress.id)).length
        : 0;
      const activityFactor = Math.min(1.0, 1 + (recentActivity * 0.2));

      // Combine scores
      const score = (
        (urgency * WEIGHT_DEADLINE) +
        (marksScore * WEIGHT_MARKS) +
        (progressScore * WEIGHT_PROGRESS) +
        (activityFactor * WEIGHT_COMPLETION)
      ) * categoryBoost;

      // Generate recommendation
      let recommendation = 'continue';
      if (score > 0.75) recommendation = 'high_priority';
      else if (score > 0.45) recommendation = 'medium_priority';
      else if (score < 0.15) recommendation = 'low_priority';
      if (inProgress && lectures === 0) recommendation = 'near_completion';

      return {
        score,
        reason: `Marks: ${marks}, Lectures: ${lectures}, Status: ${status}, Urgency: ${(urgency * 100).toFixed(0)}%`,
        recommendation,
        details: {
          urgency: urgency.toFixed(2),
          marksScore: marksScore.toFixed(2),
          progressScore: progressScore.toFixed(2),
          categoryBoost: categoryBoost,
          finalScore: score
        }
      };
    }

    static recommendNextTopics(topics, progress, daysToDeadline = 30, studyHistory = []) {
      const recommendations = [];
      const priorities = {};

      topics.forEach(topic => {
        const p = progress?.[topic.id] || { status: 'remaining', lectures: 0 };
        const result = PlannerEngine.calculatePriority(
          { ...topic, ...p },
          daysToDeadline,
          studyHistory,
          null
        );
        priorities[topic.id] = { ...topic, priority: result };
      });

      // Sort by priority score (descending)
      const sorted = Object.values(priorities)
        .filter(t => t.priority.score >= 0)
        .sort((a, b) => b.priority.score - a.priority.score);

      return {
        recommendations: sorted.slice(0, 10), // Top 10 recommendations
        allPriorities: priorities,
        summary: {
          highPriorityCount: sorted.filter(s => s.priority.recommendation === 'high_priority').length,
          nearCompletionCount: sorted.filter(s => s.priority.recommendation === 'near_completion').length,
          totalTopics: topics.length
        }
      };
    }

    static generateWeeklyPlan(topics, progress, daysToDeadline, studyHistory) {
      const plan = PlannerEngine.recommendNextTopics(topics, progress, daysToDeadline, studyHistory);
      const highPriority = plan.recommendations.filter(t => t.priority.recommendation === 'high_priority');
      const nearCompletion = plan.recommendations.filter(t => t.priority.recommendation === 'near_completion');
      const mediumPriority = plan.recommendations.filter(t => t.priority.recommendation === 'medium_priority');

      return {
        planName: `Study Plan - ${new Date().toLocaleDateString()}`,
        targetDays: Math.max(1, daysToDeadline),
        recommendations: {
          thisWeek: highPriority.slice(0, 3).map(t => ({
            id: t.id,
            name: t.name,
            category: t.cat,
            marks: t.marks,
            reason: `High priority: ${t.priority.details.urgency} urgency, ${t.marks} marks`,
            action: 'Start completing lectures and PYQ/revision'
          })),
          nearCompletion: nearCompletion.slice(0, 2).map(t => ({
            id: t.id,
            name: t.name,
            marks: t.marks,
            reason: 'Almost done - finish remaining lectures',
            action: 'Complete remaining lectures to finish'
          })),
          maintainProgress: mediumPriority.slice(0, 3).map(t => ({
            id: t.id,
            name: t.name,
            marks: t.marks,
            reason: 'Medium priority - maintain steady progress',
            action: 'Continue study at current pace'
          }))
        },
        statistics: plan.summary,
        priorityBreakdown: {
          high: highPriority.length,
          nearComplete: nearCompletion.length,
          medium: mediumPriority.length,
          low: plan.recommendations.filter(t => t.priority.recommendation === 'low_priority').length
        }
      };
    }

    static getExamReadiness(topics, progress, daysToDeadline) {
      const totalTopics = topics.length;
      const completed = topics.filter(t => (progress?.[t.id]?.status || '') === 'completed').length;
      const doing = topics.filter(t => (progress?.[t.id]?.status || '') === 'doing').length;
      const excluded = topics.filter(t => (progress?.[t.id]?.status || '') === 'skip').length;
      const remaining = totalTopics - completed - excluded;
      const coveredMarks = topics.filter(t => (progress?.[t.id]?.status || '') === 'completed').reduce((sum, t) => sum + t.marks, 0);
      const totalMarks = topics.reduce((sum, t) => sum + t.marks, 0);
      const pct = totalMarks ? (coveredMarks / totalMarks) * 100 : 0;

      // Readiness indicators
      let readiness = 'early';
      if (daysToDeadline <= 7) readiness = 'critical';
      else if (daysToDeadline <= 14) readiness = 'urgent';
      else if (daysToDeadline <= 30) readiness = 'preparing';
      else if (daysToDeadline <= 60) readiness = 'planning';

      // Calculate weak topics (high marks + low progress)
      const weakTopics = topics.map(t => {
        const p = progress?.[t.id] || { status: 'remaining', lectures: 0, pyq: false, revision: false };
        const marksRatio = t.marks / Math.max(0.1, totalMarks);
        const progressRatio = (p.status === 'completed') ? 1 : (p.status === 'skip' ? 0 : (Math.max(0, 1 - (parseInt(p.lectures || 0, 10) / 5))));
        const weaknessScore = marksRatio * (1 - progressRatio);
        return { ...t, weaknessScore, progressRatio, p };
      }).filter(t => t.weaknessScore > 0.03)
        .sort((a, b) => b.weaknessScore - a.weaknessScore)
        .slice(0, 5);

      return {
        readinessLevel: readiness,
        daysRemaining: Math.max(0, daysToDeadline),
        completionRate: pct,
        completedTopics: completed,
        inProgressTopics: doing,
        remainingTopics: remaining,
        excludedTopics: excluded,
        weakTopics,
        recommendations: readiness === 'critical' ? [
          'Focus exclusively on high-mark remaining topics',
          'Complete lecture content for weak topics immediately',
          'Prioritize topics with highest weakness scores'
        ] : readiness === 'urgent' ? [
          'Complete all remaining high-mark topics',
          'Finish lectures and start PYQ/revision',
          'Maintain daily study targets'
        ] : [
          'Maintain steady progress across all categories',
          'Complete lectures before exam deadline',
          'Review completed topics periodically'
        ]
      };
    }
  }

  return { PlannerEngine };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = StudyPlanner;
} else if (typeof window !== 'undefined') {
  window.StudyPlannerModule = StudyPlanner;
}
