import { Text } from '../../../design-system'
import type { Todo } from '../types'
import { summarizeTodos } from '../utils/todos'

export function TodoStats({ todos }: { todos: Todo[] }) {
  const summary = summarizeTodos(todos)
  if (summary.total === 0) return null
  const parts = [`${summary.active} active`, `${summary.completed} completed`]
  if (summary.overdue > 0) parts.push(`${summary.overdue} overdue`)
  return (
    <Text muted size="small" aria-label="Task summary">
      {parts.join(' · ')}
    </Text>
  )
}
