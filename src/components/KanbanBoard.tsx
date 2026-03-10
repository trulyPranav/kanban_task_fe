import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
} from '@dnd-kit/core';
import { useBoard } from '@/hooks/useBoard';
import { useDragAndDrop } from '@/hooks/useDragAndDrop';
import { useCurrentUser } from '@/contexts/CurrentUserContext';
import KanbanColumn from '@/components/KanbanColumn';
import TaskModal from '@/components/TaskModal';
import { TaskCardOverlay } from '@/components/TaskCard';
import TaskChart from '@/components/TaskChart';
import BoardHeader from '@/components/board/BoardHeader';
import type { TaskResponse, TaskStatus } from '@/types';

const COLUMNS: { status: TaskStatus; title: string }[] = [
  { status: 'todo', title: 'To Do' },
  { status: 'in_progress', title: 'In Progress' },
  { status: 'done', title: 'Done' },
];

export default function KanbanBoard() {
  const {
    tasks, setTasks, loading, error, setError,
    search, handleSearchChange,
    hasMore, colLoadingMore, totals, overallTotal,
    loadMoreForColumn,
    handleTaskSaved, handleTaskDeleted,
    fetchAll,
  } = useBoard();

  const { currentUser } = useCurrentUser();
  const { activeTask, sensors, handleDragStart, handleDragEnd } = useDragAndDrop(tasks, setTasks, setError);

  const [chartOpen, setChartOpen] = useState(true);
  const [selectedTask, setSelectedTask] = useState<TaskResponse | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [createStatus, setCreateStatus] = useState<TaskStatus>('todo');
  const [isCreating, setIsCreating] = useState(false);

  const openCreate = (status: TaskStatus) => {
    setCreateStatus(status);
    setIsCreating(true);
    setSelectedTask(null);
    setModalOpen(true);
  };

  const openDetail = (task: TaskResponse) => {
    setSelectedTask(task);
    setIsCreating(false);
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setSelectedTask(null);
  };

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <BoardHeader
        overallTotal={overallTotal}
        search={search}
        chartOpen={chartOpen}
        onSearch={handleSearchChange}
        onToggleChart={() => setChartOpen((o) => !o)}
        onNewTask={() => openCreate('todo')}
      />

      {error && (
        <div className="flex items-center justify-between gap-3 px-6 py-2.5 bg-(--color-danger-light) text-(--color-danger) border-b border-(--color-border) text-[13px]">
          <span>{error}</span>
          <button
            className="bg-transparent border-none cursor-pointer text-[13px] font-medium text-(--color-danger) underline hover:no-underline"
            onClick={() => { setError(''); fetchAll(search); }}
          >
            Retry
          </button>
        </div>
      )}

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <main className="flex gap-5 px-6 py-5 overflow-x-auto flex-1 items-start">
            {COLUMNS.map((col) => (
              <KanbanColumn
                key={col.status}
                status={col.status}
                title={col.title}
                tasks={tasks[col.status]}
                loading={loading}
                onTaskClick={openDetail}
                onAddTask={openCreate}
                total={totals[col.status]}
                hasMore={hasMore[col.status]}
                loadingMore={colLoadingMore[col.status]}
                onLoadMore={loadMoreForColumn}
              />
            ))}
          </main>

          <DragOverlay dropAnimation={{ duration: 180, easing: 'ease' }}>
            {activeTask ? <TaskCardOverlay task={activeTask} /> : null}
          </DragOverlay>
        </DndContext>

        {chartOpen && (
          <aside className="w-1/3 shrink-0 border-l border-(--color-border) bg-white flex flex-col p-5 overflow-y-auto">
            <TaskChart tasks={tasks} />
          </aside>
        )}
      </div>

      {modalOpen && (
        <TaskModal
          task={isCreating ? null : selectedTask}
          initialStatus={createStatus}
          currentUser={currentUser}
          onClose={handleModalClose}
          onSaved={handleTaskSaved}
          onDeleted={handleTaskDeleted}
        />
      )}
    </div>
  );
}