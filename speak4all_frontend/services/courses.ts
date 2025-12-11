// Centralized API service for courses-related endpoints

import { API_BASE, fetchJSON } from './apiClient';
import type { ExerciseOut } from './exercises';

// ==== PAGINATION ====
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// Tipos mínimos (expandir según backend)
export interface Course {
  id: number;
  name: string;
  description?: string | null;
  join_code: string;
  therapist_id: number;
}

export interface CourseGroup {
  id: number;
  user_id: number;
  name: string;
  color?: string | null;
  created_at: string;
}

// Cursos
export function getMyCourses(token: string, page = 1, pageSize = 10) {
  const url = `/courses/my?page=${page}&page_size=${pageSize}`;
  return fetchJSON<PaginatedResponse<Course>>(url, { token });
}

export function createCourse(token: string, name: string, description: string | null) {
  return fetchJSON<Course>('/courses/', {
    token,
    method: 'POST',
    body: JSON.stringify({ name, description }),
  });
}

export function deleteCourse(token: string, courseId: number) {
  return fetchJSON<void>(`/courses/${courseId}`, { token, method: 'DELETE', skipJson: true });
}

export function joinCourse(token: string, joinCode: string) {
  return fetchJSON('/courses/join', {
    token,
    method: 'POST',
    body: JSON.stringify({ join_code: joinCode }),
  });
}

// Grupos
export function getCourseGroups(token: string) {
  return fetchJSON<CourseGroup[]>('/course-groups/', { token });
}

export function getGroupCourses(token: string, groupId: number) {
  return fetchJSON<Course[]>(`/course-groups/${groupId}/courses`, { token });
}

export function createCourseGroup(token: string, name: string, color: string) {
  return fetchJSON<CourseGroup>('/course-groups/', {
    token,
    method: 'POST',
    body: JSON.stringify({ name, color: color.startsWith('#') ? color : `#${color}` }),
  });
}

export function deleteCourseGroup(token: string, groupId: number) {
  return fetchJSON<void>(`/course-groups/${groupId}`, { token, method: 'DELETE', skipJson: true });
}

export function assignCourseToGroup(token: string, groupId: number, courseId: number) {
  return fetchJSON(`/course-groups/${groupId}/courses`, {
    token,
    method: 'POST',
    body: JSON.stringify({ course_id: courseId }),
  });
}

export function removeCourseFromGroup(token: string, groupId: number, courseId: number) {
  return fetchJSON<void>(`/course-groups/${groupId}/courses/${courseId}`, {
    token,
    method: 'DELETE',
    skipJson: true,
  });
}

// ─────────────────────────────────────────────
// Página de curso (slug) - tipos y funciones
// ─────────────────────────────────────────────

export type SubmissionStatus = 'PENDING' | 'DONE';

export interface JoinRequest {
  id: number;
  course_id: number;
  student_id: number;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  created_at: string;
  student_full_name?: string | null;
  student_email?: string | null;
  student_avatar_path?: string | null;
  student_avatar_url?: string | null;
}

export interface StudentInCourse {
  course_student_id: number;
  student_id: number;
  student_name: string;
  avatar_path?: string | null;
  completed_exercises: number;
  total_exercises: number;
  last_submission_at?: string | null;
}

export interface StudentProgressSummary {
  student_id: number;
  full_name: string;
  email: string;
  avatar_path?: string | null;
  total_exercises: number;
  done_exercises: number;
  last_submission_at?: string | null;
}

export interface CourseExercise {
  id: number;
  course_id: number;
  exercise_id: number;
  published_at: string;
  due_date?: string | null;
  is_deleted: boolean;
  exercise?: ExerciseOut | null;
}

export interface StudentExerciseStatus {
  course_exercise_id: number;
  exercise_name: string;
  due_date?: string | null;
  status: SubmissionStatus;
  submitted_at?: string | null;
  has_audio?: boolean;
}

export type JoinRequestStatusFilter = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'ALL';

export function getCourseJoinRequests(
  token: string,
  courseId: number,
  options?: { status?: JoinRequestStatusFilter; from_date?: string; to_date?: string }
) {
  const params = new URLSearchParams();
  if (options?.status) params.append('status', options.status);
  if (options?.from_date) params.append('from_date', options.from_date);
  if (options?.to_date) params.append('to_date', options.to_date);

  const qs = params.toString();
  const url = `/courses/${courseId}/requests${qs ? `?${qs}` : ''}`;
  return fetchJSON<JoinRequest[]>(url, { token });
}

export function decideJoinRequest(token: string, courseId: number, requestId: number, accept: boolean) {
  return fetchJSON<void>(`/courses/${courseId}/requests/${requestId}/decision`, {
    token,
    method: 'POST',
    body: JSON.stringify({ accept }),
    skipJson: true,
  });
}

export function getCourseStudents(token: string, courseId: number) {
  return fetchJSON<StudentInCourse[]>(`/courses/${courseId}/students`, { token });
}

export function removeCourseStudent(token: string, courseId: number, courseStudentId: number) {
  return fetchJSON<void>(`/courses/${courseId}/students/${courseStudentId}`, {
    token,
    method: 'DELETE',
    skipJson: true,
  });
}

export function getCourseStudentsProgress(token: string, courseId: number) {
  return fetchJSON<StudentProgressSummary[]>(`/course-students/${courseId}/students/progress`, { token });
}

export function getCourseExercises(token: string, courseId: number) {
  return fetchJSON<CourseExercise[]>(`/course-exercises/${courseId}`, { token });
}

export function publishCourseExercise(token: string, courseId: number, exerciseId: number, dueDate?: string | null) {
  return fetchJSON<CourseExercise>(`/course-exercises/`, {
    token,
    method: 'POST',
    body: JSON.stringify({ course_id: courseId, exercise_id: exerciseId, due_date: dueDate ?? null }),
  });
}

export function deleteCourseExercise(token: string, courseExerciseId: number) {
  return fetchJSON<void>(`/course-exercises/${courseExerciseId}`, { token, method: 'DELETE', skipJson: true });
}

export function getStudentExercisesForCourse(token: string, courseId: number) {
  return fetchJSON<StudentExerciseStatus[]>(`/course-students/${courseId}/me/exercises`, { token });
}
