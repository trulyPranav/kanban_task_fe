export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface UserSummary {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
}

export interface UserResponse {
  id: string;
  username: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskResponse {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  assigned_to_id: string | null;
  created_by_id: string | null;
  created_at: string;
  updated_at: string;
  assignee: UserSummary | null;
  creator: UserSummary | null;
  comment_count: number;
}

export interface CommentResponse {
  id: string;
  task_id: string;
  user_id: string | null;
  content: string;
  created_at: string;
  updated_at: string;
  author: UserSummary | null;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface CreateTaskPayload {
  title: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  due_date?: string | null;
  assigned_to_id?: string | null;
  created_by_id?: string | null;
}

export interface UpdateTaskPayload {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  due_date?: string | null;
  assigned_to_id?: string | null;
}

export interface CreateCommentPayload {
  content: string;
  user_id?: string | null;
}

export interface CreateUserPayload {
  username: string;
  email: string;
  full_name: string;
  avatar_url?: string | null;
}
