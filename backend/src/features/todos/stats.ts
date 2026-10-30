import type { Todo } from './types.js';

export interface TodoStats {
  total: number;
  active: number;
  completed: number;
  overdue: number;
  byPriority: Record<Todo['priority'], number>;
}

export function computeStats(todos: Todo[], today: string): TodoStats {
  const stats: TodoStats = { total: todos.length, active: 0, completed: 0, overdue: 0, byPriority: { low: 0, medium: 0, high: 0 } };
  for (const todo of todos) {
    if (todo.completed) stats.completed += 1;
    else stats.active += 1;
    if (!todo.completed && todo.due_date !== null && todo.due_date < today) stats.overdue += 1;
    stats.byPriority[todo.priority] += 1;
  }
  return stats;
}
