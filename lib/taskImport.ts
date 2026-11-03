// Reads tasks written as plain text (for example by ChatGPT or Claude) and turns them into a list the app can create.
//
// One block per task, any order of lines, labels are forgiving about case and markdown:
//
//   Member Name: Kawsar Habib
//   Task Title: Design the hero section
//   Description: Make the hero for the new landing page.
//   To-do:
//   - Wireframe the layout
//   - Pick the images
//   Priority: high          (optional: low | normal | high | urgent)
//   Due: 2026-11-10         (optional: YYYY-MM-DD or DD/MM/YYYY)
//
// A "Member" line starts a new block. A second "Task" line under the same member starts another task for that member.

export type ParsedPriority = 'low' | 'normal' | 'high' | 'urgent';

export type ParsedTask = {
  memberName: string;
  title: string;
  description: string;
  todos: string[];
  priority: ParsedPriority | null;
  dueDate: string | null; // YYYY-MM-DD
};

type Field = 'member' | 'title' | 'description' | 'todo' | 'priority' | 'due';

const LABELS: { field: Field; names: string }[] = [
  { field: 'member', names: 'member\\s*name|member|assignee|assigned\\s*to|team\\s*member|name' },
  { field: 'title', names: 'task\\s*title|task\\s*name|task|title' },
  { field: 'description', names: 'description|details?|desc' },
  { field: 'todo', names: 'to[\\s-]*dos?|checklist|sub[\\s-]*tasks?|steps' },
  { field: 'priority', names: 'priority' },
  { field: 'due', names: 'due\\s*date|due|deadline' },
];

const LABEL_LINE = new RegExp(
  `^\\s*(?:[-*•]\\s*)?(?:\\d+[.)]\\s*)?(${LABELS.map((l) => `(?:${l.names})`).join('|')})\\s*[:：]\\s*(.*)$`,
  'i'
);
const BULLET = /^\s*(?:[-*•▪◦►]|\[[ xX]?\]|[☐☑✔✓]|\d+[.)])\s+(.*)$/;

function fieldOf(label: string): Field | null {
  const l = label.toLowerCase().trim();
  for (const { field, names } of LABELS) {
    if (new RegExp(`^(?:${names})$`, 'i').test(l)) return field;
  }
  return null;
}

function clean(line: string): string {
  return line
    .replace(/\*\*/g, '')
    .replace(/__/g, '')
    .replace(/`/g, '')
    .replace(/\\+\s*$/, '') // the backslash some chat tools put at the end of a line (a markdown line break)
    .replace(/\\([-*_#.[\]()])/g, '$1') // escaped characters such as \- or \.
    .replace(/^\s*#{1,6}\s*/, '')
    .replace(/\s+$/, '');
}

function parsePriority(value: string): ParsedPriority | null {
  const v = value.toLowerCase();
  if (/urgent|critical|asap/.test(v)) return 'urgent';
  if (/high|important/.test(v)) return 'high';
  if (/low/.test(v)) return 'low';
  if (/normal|medium|mid|regular/.test(v)) return 'normal';
  return null;
}

function parseDue(value: string): string | null {
  const v = value.trim();
  let m = /(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(v);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = /(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/.exec(v);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

export function parseTaskText(text: string): ParsedTask[] {
  const tasks: ParsedTask[] = [];
  let cur: ParsedTask | null = null;
  let mode: Field | null = null;
  let lastMember = '';

  const blank = (member: string): ParsedTask => ({ memberName: member, title: '', description: '', todos: [], priority: null, dueDate: null });
  const finish = () => {
    if (cur && cur.memberName.trim() && cur.title.trim()) {
      cur.title = cur.title.trim();
      cur.description = cur.description.trim();
      tasks.push(cur);
    }
    cur = null;
    mode = null;
  };

  for (const raw of text.replace(/\r\n/g, '\n').split('\n')) {
    const line = clean(raw);
    const m = LABEL_LINE.exec(line);
    if (m) {
      const field = fieldOf(m[1]);
      const value = m[2].trim();
      if (field === 'member') {
        finish();
        cur = blank(value);
        lastMember = value;
        mode = 'member';
        continue;
      }
      if (field === 'title') {
        if (!cur || cur.title.trim()) {
          // a new task: under the same member when there is no new Member line
          const member = cur ? cur.memberName : lastMember;
          finish();
          cur = blank(member);
        }
        cur.title = value;
        mode = 'title';
        continue;
      }
      if (!cur) cur = blank(lastMember);
      if (field === 'description') {
        cur.description = value;
        mode = 'description';
      } else if (field === 'todo') {
        mode = 'todo';
        if (value) cur.todos.push(value.replace(BULLET, '$1'));
      } else if (field === 'priority') {
        cur.priority = parsePriority(value);
        mode = 'priority';
      } else if (field === 'due') {
        cur.dueDate = parseDue(value);
        mode = 'due';
      }
      continue;
    }
    if (!cur) continue;
    const content = line.trim();
    if (mode === 'todo') {
      if (!content) continue;
      const b = BULLET.exec(line);
      cur.todos.push((b ? b[1] : content).trim());
    } else if (mode === 'description') {
      cur.description += (content ? '\n' + content : cur.description.endsWith('\n') ? '' : '\n');
    } else if (mode === 'title' && content) {
      cur.title += ' ' + content;
    }
  }
  finish();
  return tasks;
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}

// Finds the team member a written name belongs to: the full name first, then a first name (only when it is unique), then a
// name that contains or is contained in a member's name. Returns null when nothing fits or when two members fit equally.
export function matchMember<T extends { id: string; full_name: string }>(name: string, members: T[]): T | null {
  const n = norm(name);
  if (!n) return null;
  const exact = members.filter((p) => norm(p.full_name) === n);
  if (exact.length === 1) return exact[0];
  const firstWord = (p: T) => norm(p.full_name).split(' ')[0];
  const byFirst = members.filter((p) => firstWord(p) === n.split(' ')[0] && (n.split(' ').length === 1 || norm(p.full_name).includes(n) || n.includes(norm(p.full_name))));
  if (byFirst.length === 1) return byFirst[0];
  const loose = members.filter((p) => norm(p.full_name).includes(n) || n.includes(norm(p.full_name)));
  return loose.length === 1 ? loose[0] : null;
}
