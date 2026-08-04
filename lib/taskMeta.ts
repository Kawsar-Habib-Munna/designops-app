// tasks, dashboard ও project-details পেজ — সবখানে ব্যবহৃত টাস্ক স্ট্যাটাস/প্রায়োরিটি/
// workflow-stage লেবেল ও ক্লাস ম্যাপিং। CSS ক্লাসগুলো (s-*, p-*, rc-*) প্রতিটা পেজের
// scoped stylesheet-এ (dashboard.css, tasks.css, project.css) একই নামে ডিফাইন করা আছে।

export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done';
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

export const STATUS_META: Record<TaskStatus, { label: string; cls: string }> = {
  todo: { label: 'বাকি', cls: 's-todo' },
  in_progress: { label: 'চলছে', cls: 's-progress' },
  review: { label: 'রিভিউ', cls: 's-review' },
  done: { label: 'শেষ', cls: 's-done' },
};

export const PRIORITY_META: Record<TaskPriority, { label: string; cls: string }> = {
  low: { label: 'কম', cls: 'p-low' },
  normal: { label: 'নরমাল', cls: 'p-normal' },
  high: { label: 'হাই', cls: 'p-high' },
  urgent: { label: 'জরুরি', cls: 'p-urgent' },
};

export const STAGE_LABEL: Record<string, string> = {
  backlog: 'Backlog',
  ready: 'Ready',
  wireframing: 'Wireframing',
  ui_design: 'UI Design',
  ux_review: 'UX Review',
  client_review: 'Client Review',
  revision: 'Revision',
  handoff: 'Handoff',
  completed: 'Completed',
};

export function reviewChip(workflowStage: string, isBlocked: boolean): { cls: string; label: string } | null {
  if (isBlocked) return { cls: 'rc-blocked', label: 'Blocked' };
  switch (workflowStage) {
    case 'revision':
      return { cls: 'rc-revision', label: 'Revision Required' };
    case 'client_review':
      return { cls: 'rc-client', label: 'Client Feedback' };
    case 'ux_review':
      return { cls: 'rc-needs', label: 'Needs Review' };
    case 'handoff':
    case 'completed':
      return { cls: 'rc-approved', label: 'Approved' };
    default:
      return null;
  }
}
