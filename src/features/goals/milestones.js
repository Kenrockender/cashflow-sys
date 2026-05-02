/* ══════════════════════════════════════════════════════════
   CASHFLOW.SYS — milestones.js
   Goal milestone tracking and celebrations
   Depends on: state.js, helpers.js
══════════════════════════════════════════════════════════ */

function checkGoalMilestones(goalId) {
  const goal = S.goals.find(g => g.id === goalId);
  if (!goal || goal.target <= 0) return;
  const pct = (goal.saved / goal.target) * 100;
  const milestones = [25, 50, 75, 100];
  const lastShown = S.lastMilestones[goalId] || 0;
  for (const ms of milestones) {
    if (pct >= ms && lastShown < ms) {
      showMilestone(goal, ms);
      S.lastMilestones[goalId] = ms;
      localStorage.setItem('cf-milestones', JSON.stringify(S.lastMilestones));
      break;
    }
  }
}
