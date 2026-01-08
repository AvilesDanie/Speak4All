import { fetchJSON } from './apiClient';

// Rúbricas
export const rubricService = {
  createEmpty: (courseExerciseId: number, token: string) =>
    fetchJSON(`/rubrics/${courseExerciseId}/create-empty`, {
      method: 'POST',
      token,
    }),

  createDefault: (courseExerciseId: number, token: string) =>
    fetchJSON(`/rubrics/${courseExerciseId}/create-default`, {
      method: 'POST',
      token,
    }),

  getRubric: (courseExerciseId: number, token: string) =>
    fetchJSON(`/rubrics/${courseExerciseId}`, { token }),

  checkHasEvaluations: (courseExerciseId: number, token: string) =>
    fetchJSON(`/rubrics/${courseExerciseId}/has-evaluations`, { token }),

  updateRubric: (courseExerciseId: number, data: { max_score?: number }, token: string) =>
    fetchJSON(`/rubrics/${courseExerciseId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
      token,
    }),

  addCriteria: (courseExerciseId: number, data: any, token: string) =>
    fetchJSON(`/rubrics/${courseExerciseId}/criteria`, {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),

  updateCriteria: (criteriaId: number, data: any, token: string) =>
    fetchJSON(`/rubrics/criteria/${criteriaId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
      token,
    }),

  deleteCriteria: (criteriaId: number, token: string) =>
    fetchJSON(`/rubrics/criteria/${criteriaId}`, {
      method: 'DELETE',
      token,
    }),

  addLevel: (criteriaId: number, data: any, token: string) =>
    fetchJSON(`/rubrics/criteria/${criteriaId}/levels`, {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),

  updateLevel: (criteriaId: number, levelId: number, data: any, token: string) =>
    fetchJSON(`/rubrics/criteria/${criteriaId}/levels/${levelId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
      token,
    }),

  deleteLevel: (criteriaId: number, levelId: number, token: string) =>
    fetchJSON(`/rubrics/criteria/${criteriaId}/levels/${levelId}`, {
      method: 'DELETE',
      token,
    }),
};

// Evaluaciones
export const evaluationService = {
  createEvaluation: (data: any, token: string) =>
    fetchJSON('/evaluations/', {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),

  getEvaluation: (evaluationId: number, token: string) =>
    fetchJSON(`/evaluations/${evaluationId}`, { token }),

  getEvaluationBySubmission: (submissionId: number, token: string) =>
    fetchJSON(`/evaluations/submission/${submissionId}`, { token }).catch(() => null),

  updateEvaluation: (evaluationId: number, data: any, token: string) =>
    fetchJSON(`/evaluations/${evaluationId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
      token,
    }),

  deleteEvaluation: (evaluationId: number, token: string) =>
    fetchJSON(`/evaluations/${evaluationId}`, {
      method: 'DELETE',
      token,
    }),

  listExerciseEvaluations: (courseExerciseId: number, token: string) =>
    fetchJSON(`/evaluations/exercise/${courseExerciseId}/all`, { token }),
};

// Progreso
export const progressService = {
  setWeighting: (data: any, token: string) =>
    fetchJSON('/progress/weightings', {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),

  getWeighting: (courseExerciseId: number, token: string) =>
    fetchJSON(`/progress/weightings/${courseExerciseId}`, { token }).catch(() => null),

  getCourseWeightings: (courseId: number, token: string) =>
    fetchJSON(`/progress/course/${courseId}/weightings`, { token }).catch(() => []),

  getStudentProgress: (studentId: number, courseId: number, token: string) =>
    fetchJSON(`/progress/student/${studentId}/course/${courseId}`, { token }).catch(() => null),

  getCourseProgress: (courseId: number, token: string) =>
    fetchJSON(`/progress/course/${courseId}/all`, { token }).catch(() => []),

  getSubmissionComplete: (submissionId: number, token: string) =>
    fetchJSON(`/progress/submission/${submissionId}/complete`, { token }).catch(() => null),
};
