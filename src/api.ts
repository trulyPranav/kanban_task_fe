import type {
  TaskResponse,
  UserResponse,
  CommentResponse,
  PaginatedResponse,
  CreateTaskPayload,
  UpdateTaskPayload,
  CreateCommentPayload,
  CreateUserPayload,
  TaskStatus,
  TaskPriority,
} from './types';

const BASE_URL = 'http://localhost:8000/api/v1';

export class ApiError extends Error {
  status: number;
  detail: unknown;

  constructor(status: number, detail: unknown) {
    super(
      status === 429
        ? 'Rate limit exceeded. Please wait before trying again.'
        : typeof detail === 'string'
        ? detail
        : 'An error occurred. Please try again.',
    );
    this.status = status;
    this.detail = detail;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (response.status === 204) {
    return null as T;
  }

  const data = await response.json();
  if (!response.ok) {
    throw new ApiError(response.status, data.detail);
  }

  return data;
}

function buildQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  }
  const qs = query.toString();
  return qs ? `?${qs}` : '';
}

export const api = {
  // ── Tasks ──────────────────────────────────────────────────────────────────
  getTasks(params: {
    status?: TaskStatus;
    priority?: TaskPriority;
    assigned_to_id?: string;
    search?: string;
    page?: number;
    page_size?: number;
  } = {}): Promise<PaginatedResponse<TaskResponse>> {
    return request(`/tasks/${buildQuery(params)}`);
  },

  getTask(id: string): Promise<TaskResponse> {
    return request(`/tasks/${id}`);
  },

  createTask(payload: CreateTaskPayload): Promise<TaskResponse> {
    return request('/tasks/', { method: 'POST', body: JSON.stringify(payload) });
  },

  updateTask(id: string, payload: UpdateTaskPayload): Promise<TaskResponse> {
    return request(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
  },

  patchTaskStatus(id: string, status: TaskStatus): Promise<TaskResponse> {
    return request(`/tasks/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  deleteTask(id: string): Promise<void> {
    return request(`/tasks/${id}`, { method: 'DELETE' });
  },

  // ── Users ──────────────────────────────────────────────────────────────────
  getUsers(params: {
    search?: string;
    page?: number;
    page_size?: number;
  } = {}): Promise<PaginatedResponse<UserResponse>> {
    return request(`/users/${buildQuery(params)}`);
  },

  getUser(id: string): Promise<UserResponse> {
    return request(`/users/${id}`);
  },

  createUser(payload: CreateUserPayload): Promise<UserResponse> {
    return request('/users/', { method: 'POST', body: JSON.stringify(payload) });
  },

  updateUser(id: string, payload: Partial<CreateUserPayload>): Promise<UserResponse> {
    return request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
  },

  deleteUser(id: string): Promise<void> {
    return request(`/users/${id}`, { method: 'DELETE' });
  },

  // ── Comments ───────────────────────────────────────────────────────────────
  getComments(
    taskId: string,
    params: { page?: number; page_size?: number } = {},
  ): Promise<PaginatedResponse<CommentResponse>> {
    return request(`/tasks/${taskId}/comments/${buildQuery(params)}`);
  },

  createComment(taskId: string, payload: CreateCommentPayload): Promise<CommentResponse> {
    return request(`/tasks/${taskId}/comments/`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateComment(taskId: string, commentId: string, content: string): Promise<CommentResponse> {
    return request(`/tasks/${taskId}/comments/${commentId}`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    });
  },

  deleteComment(taskId: string, commentId: string): Promise<void> {
    return request(`/tasks/${taskId}/comments/${commentId}`, { method: 'DELETE' });
  },
};
