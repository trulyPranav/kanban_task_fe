import { useState, useCallback } from 'react';
import {
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { api } from '@/api';
import type { TaskResponse, TaskStatus } from '@/types';
import type { TasksByStatus } from './useBoard';

export function useDragAndDrop(
  tasks: TasksByStatus,
  setTasks: React.Dispatch<React.SetStateAction<TasksByStatus>>,
  setError: (msg: string) => void,
) {
  const [activeTask, setActiveTask] = useState<TaskResponse | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const findTask = useCallback(
    (id: string): TaskResponse | undefined => {
      for (const list of Object.values(tasks)) {
        const found = list.find((t) => t.id === id);
        if (found) return found;
      }
    },
    [tasks],
  );

  const getStatusFromId = useCallback(
    (id: string): TaskStatus | null => {
      if (['todo', 'in_progress', 'done'].includes(id)) return id as TaskStatus;
      return findTask(id)?.status ?? null;
    },
    [findTask],
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveTask(findTask(event.active.id as string) ?? null);
  }, [findTask]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);
    if (!over) return;

    const taskId = active.id as string;
    const newStatus = getStatusFromId(over.id as string);
    if (!newStatus) return;

    const task = findTask(taskId);
    if (!task || task.status === newStatus) return;

    const oldStatus = task.status;
    setTasks((prev) => ({
      ...prev,
      [oldStatus]: prev[oldStatus].filter((t) => t.id !== taskId),
      [newStatus]: [...prev[newStatus], { ...task, status: newStatus }],
    }));

    try {
      const updated = await api.patchTaskStatus(taskId, newStatus);
      setTasks((prev) => ({
        ...prev,
        [newStatus]: prev[newStatus].map((t) => (t.id === taskId ? updated : t)),
      }));
    } catch {
      setTasks((prev) => ({
        ...prev,
        [newStatus]: prev[newStatus].filter((t) => t.id !== taskId),
        [oldStatus]: [...prev[oldStatus], task],
      }));
      setError('Failed to move task. Please try again.');
    }
  }, [findTask, getStatusFromId, setTasks, setError]);

  return { activeTask, sensors, handleDragStart, handleDragEnd };
}
