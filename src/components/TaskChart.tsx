import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import type { TaskResponse } from '../types';

interface TaskChartProps {
  tasks: Record<string, TaskResponse[]>;
}

const STATUS_COLOR = {
  todo:        'var(--color-status-todo)',
  in_progress: 'var(--color-status-progress)',
  done:        'var(--color-status-done)',
};

const STATUS_LABEL = {
  todo:        'To Do',
  in_progress: 'In Progress',
  done:        'Done',
};

/** Build the last `days` calendar days as YYYY-MM-DD strings */
function buildDayRange(days: number): string[] {
  const result: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    result.push(d.toISOString().slice(0, 10));
  }
  return result;
}

function toShortLabel(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${parseInt(m)}/${parseInt(d)}`;
}

export default function TaskChart({ tasks }: TaskChartProps) {
  const days = buildDayRange(14);

  // Count tasks created on each day, by status
  const dataMap: Record<string, { todo: number; in_progress: number; done: number }> = {};
  for (const day of days) {
    dataMap[day] = { todo: 0, in_progress: 0, done: 0 };
  }

  for (const [status, list] of Object.entries(tasks)) {
    for (const task of list) {
      const day = task.created_at.slice(0, 10);
      if (dataMap[day]) {
        (dataMap[day] as Record<string, number>)[status] =
          ((dataMap[day] as Record<string, number>)[status] ?? 0) + 1;
      }
    }
  }

  const data = days.map((day) => ({
    day: toShortLabel(day),
    ...dataMap[day],
  }));

  // Totals for the legend pills
  const totals = {
    todo:        tasks['todo']?.length ?? 0,
    in_progress: tasks['in_progress']?.length ?? 0,
    done:        tasks['done']?.length ?? 0,
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-medium text-text-3 uppercase tracking-widest">
          Task activity · last 14 days
        </p>
        <div className="flex items-center gap-3">
          {(['todo', 'in_progress', 'done'] as const).map((s) => (
            <span key={s} className="flex items-center gap-1.5 text-[11px] text-text-2">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: STATUS_COLOR[s] }}
              />
              <span className="font-medium tabular-nums">{totals[s]}</span>
              <span className="text-text-3">{STATUS_LABEL[s]}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="gradTodo" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={STATUS_COLOR.todo}        stopOpacity={0.18} />
                <stop offset="95%" stopColor={STATUS_COLOR.todo}        stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gradProgress" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={STATUS_COLOR.in_progress} stopOpacity={0.18} />
                <stop offset="95%" stopColor={STATUS_COLOR.in_progress} stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gradDone" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={STATUS_COLOR.done}        stopOpacity={0.18} />
                <stop offset="95%" stopColor={STATUS_COLOR.done}        stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--color-border)"
              vertical={false}
            />
            <XAxis
              dataKey="day"
              tick={{ fontSize: 10, fill: 'var(--color-text-3)' }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 10, fill: 'var(--color-text-3)' }}
              axisLine={false}
              tickLine={false}
              width={28}
            />
            <Tooltip
              contentStyle={{
                background: '#fff',
                border: '1px solid var(--color-border)',
                borderRadius: '8px',
                fontSize: '12px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.07)',
                padding: '8px 12px',
              }}
              itemStyle={{ color: 'var(--color-text-2)', padding: '1px 0' }}
              labelStyle={{ color: 'var(--color-text-1)', fontWeight: 600, marginBottom: 4 }}
              cursor={{ stroke: 'var(--color-border)', strokeWidth: 1 }}
            />
            <Area
              type="monotone"
              dataKey="todo"
              name="To Do"
              stroke={STATUS_COLOR.todo}
              strokeWidth={1.5}
              fill="url(#gradTodo)"
              dot={false}
              activeDot={{ r: 3, strokeWidth: 0 }}
            />
            <Area
              type="monotone"
              dataKey="in_progress"
              name="In Progress"
              stroke={STATUS_COLOR.in_progress}
              strokeWidth={1.5}
              fill="url(#gradProgress)"
              dot={false}
              activeDot={{ r: 3, strokeWidth: 0 }}
            />
            <Area
              type="monotone"
              dataKey="done"
              name="Done"
              stroke={STATUS_COLOR.done}
              strokeWidth={1.5}
              fill="url(#gradDone)"
              dot={false}
              activeDot={{ r: 3, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
