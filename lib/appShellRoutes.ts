// Which scoped CSS root (the per-page stylesheet class) and which sidebar item belong to each dashboard route. The shared
// shell keeps one wrapper element alive and only swaps this class when you navigate, so every page keeps its own look
// while the sidebar and top bar stay on screen. A route that returns null (e.g. the printable receipt) gets no shell.
export type ShellRoute = { root: string; active: string };

const RULES: { test: RegExp; route: ShellRoute | null }[] = [
  { test: /^\/dashboard\/?$/, route: { root: 'dashboard-root', active: 'Dashboard' } },
  { test: /^\/board\/?$/, route: { root: 'kanban-root', active: 'Tasks' } },
  { test: /^\/calendar\/?$/, route: { root: 'calendar-root', active: 'Calendar' } },
  { test: /^\/clients\/[^/]+\/create-project\/?$/, route: { root: 'clientslist-root client-detail-root create-project-root', active: 'Clients' } },
  { test: /^\/clients\/[^/]+\/?$/, route: { root: 'clientslist-root client-detail-root', active: 'Clients' } },
  { test: /^\/clients\/?$/, route: { root: 'clientslist-root', active: 'Clients' } },
  { test: /^\/discussions\/?$/, route: { root: 'discussions-root', active: 'Discussions' } },
  { test: /^\/files\/?$/, route: { root: 'files-root', active: 'Files' } },
  { test: /^\/notifications\/?$/, route: { root: 'notif-root', active: 'Notifications' } },
  { test: /^\/portfolio\/?$/, route: { root: 'portfolio-root', active: 'Portfolio' } },
  { test: /^\/projects\/[^/]+\/payments\/[^/]+\/receipt\/?$/, route: null },
  { test: /^\/projects\/[^/]+\/messages\/?$/, route: { root: 'projdetail-root admin-msg-root', active: 'Projects' } },
  { test: /^\/projects\/[^/]+\/payments\/?$/, route: { root: 'projdetail-root payments-admin-root', active: 'Projects' } },
  { test: /^\/projects\/[^/]+\/sow\/?$/, route: { root: 'projdetail-root sow-admin-root', active: 'Projects' } },
  { test: /^\/projects\/[^/]+(\/(approvals|change-requests|feedback|files|updates))?\/?$/, route: { root: 'projdetail-root', active: 'Projects' } },
  { test: /^\/projects\/?$/, route: { root: 'projectslist-root', active: 'Projects' } },
  { test: /^\/sows\/?$/, route: { root: 'sowslist-root', active: '' } },
  { test: /^\/tasks\/?$/, route: { root: 'tasklist-root', active: 'Tasks' } },
  { test: /^\/team\/?$/, route: { root: 'teamworkload-root', active: 'Team' } },
  { test: /^\/todos\/?$/, route: { root: 'todos-root', active: 'To-Do' } },
];

export function shellRouteFor(pathname: string): ShellRoute | null {
  for (const rule of RULES) if (rule.test.test(pathname)) return rule.route;
  return null;
}
