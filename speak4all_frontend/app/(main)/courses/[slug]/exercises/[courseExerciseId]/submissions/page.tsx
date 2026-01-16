'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useParams, useRouter } from 'next/navigation';
import { API_BASE } from '@/services/apiClient';
import { Button } from 'primereact/button';
import { Tag } from 'primereact/tag';

interface Submission {
  id: number;
  student_id: number;
  student_name: string;
  student_avatar?: string;
  created_at: string;
  is_evaluated: boolean;
  score?: number;
  max_score?: number;
  passed?: boolean;
  percent?: number | null;
}

export default function ExerciseSubmissionsPage() {
  const { token, user } = useAuth();
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const courseExerciseId = parseInt(params.courseExerciseId as string);

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rubricMax, setRubricMax] = useState<number | null>(null);

  useEffect(() => {
    if (!token) return;
    loadSubmissions();
  }, [courseExerciseId, token]);

  const loadSubmissions = async () => {
    if (!token) return;

    try {
      setLoading(true);
      // Obtener rúbrica del ejercicio para conocer la puntuación máxima real
      let maxScore: number | null = null;
      try {
        const rubRes = await fetch(`${API_BASE}/rubrics/${courseExerciseId}` , {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (rubRes.ok) {
          const rubric = await rubRes.json();
          maxScore = typeof rubric?.max_score === 'number' ? rubric.max_score : null; 
          setRubricMax(maxScore);
        }
      } catch {}
      // GET /submissions/course-exercises/{course_exercise_id}/students
      const response = await fetch(
        `${API_BASE}/submissions/course-exercises/${courseExerciseId}/students`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'No se pudo obtener las entregas');
      }
      const data = await response.json();
      
      // Transformar los datos a formato compatible con el componente
      const baseList: Submission[] = data
        .filter((item: any) => item.submission_id)
        .map((item: any) => ({
          id: item.submission_id,
          student_id: item.student_id,
          student_name: item.full_name,
          student_avatar: null, // El endpoint no devuelve avatar, se podría agregar
          created_at: item.submitted_at,
          is_evaluated: false, // Se podría hacer query a evaluations
          score: null,
          max_score: maxScore,
          passed: false,
          percent: null,
        }));

      // Para cada submission, intentar obtener evaluación y rúbrica para calcular si aprueba
      const withScores = await Promise.all(
        baseList.map(async (s) => {
          try {
            const evalRes = await fetch(`${API_BASE}/evaluations/submission/${s.id}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (!evalRes.ok) return s; // sin evaluación, mantener como no evaluada
            const evaluation = await evalRes.json();
            const totalScore: number | undefined = evaluation?.total_score;
            const localMax = s.max_score ?? rubricMax;
            if (totalScore == null || localMax == null) return s; // sin puntaje válido, no marcar como evaluada

            const passed = typeof totalScore === 'number' && typeof localMax === 'number' && localMax > 0
              ? totalScore / localMax >= 0.7
              : false;
            const percent = typeof totalScore === 'number' && typeof localMax === 'number' && localMax > 0
              ? Math.round((totalScore / localMax) * 100)
              : null;
            return { ...s, is_evaluated: true, score: totalScore, max_score: localMax, passed, percent };
          } catch {
            return s;
          }
        })
      );

      setSubmissions(withScores);
      setError(null);
    } catch (err: any) {
      console.error('Error loading submissions:', err);
      setError(err?.message || 'Error al cargar las entregas');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="container mx-auto px-4 py-6">
        <p className="text-red-600">Debes iniciar sesión</p>
      </div>
    );
  }

  if (user?.role !== 'THERAPIST') {
    return (
      <div className="container mx-auto px-4 py-6">
        <p className="text-red-600">No tienes permisos para acceder a esta página</p>
      </div>
    );
  }

  return (
    <div className="surface-ground p-3 md:p-4" style={{ minHeight: '60vh' }}>
      <Button
              type="button"
              icon="pi pi-arrow-left"
              className="p-button-text p-button-rounded"
              label="Volver al curso"
              onClick={() => router.push(`/courses/${slug}`)}
            />
      <div className="card border-round-2xl p-3 md:p-4">
        
        <div className="flex justify-content-between align-items-center mb-3">
          
          <div className="flex align-items-center gap-2">
            
            <div>
              <h2 className="m-0 text-xl font-semibold">Entregas del ejercicio</h2>
            </div>
          </div>
        </div>

        {loading && (
          <div className="flex align-items-center gap-2 text-600">
            <i className="pi pi-spin pi-spinner" />
            <span>Cargando entregas...</span>
          </div>
        )}

        {error && <p className="p-error mb-3">{error}</p>}

        {!loading && submissions.length > 0 && (
          <div className="grid">
            {submissions.map((submission) => (
              <div key={submission.id} className="col-12 md:col-6 lg:col-4">
                <div className="surface-50 border-round-lg p-3 h-full flex flex-column gap-3">
                  <div className="flex align-items-center gap-3">
                    <div className="flex align-items-center justify-content-center bg-primary-50 text-primary-600 border-round" style={{ width: '3rem', height: '3rem' }}>
                      <i className="pi pi-user" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="m-0 text-base font-semibold text-900 text-overflow-ellipsis white-space-nowrap">
                        {submission.student_name}
                      </h4>
                      <p className="m-0 text-xs text-600">{new Date(submission.created_at).toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="flex align-items-center justify-content-between">
                    <div className="flex align-items-center gap-2">
                      {submission.is_evaluated ? (
                        <div className="text-sm">
                          <span className="text-green-600 font-semibold">Evaluada</span>
                          <p className="m-0 text-600">
                            {submission.score ?? '-'} / {submission.max_score ?? '-'}
                          </p>
                        </div>
                      ) : (
                        <span className="text-yellow-600 font-semibold text-sm">Pendiente</span>
                      )}
                      {submission.is_evaluated && (
                        <Tag
                          value={`${submission.passed ? 'Aprobado' : 'Reprobado'}${typeof submission.percent === 'number' ? ` ${submission.percent}%` : ''}`}
                          severity={submission.passed ? 'success' : 'danger'}
                        />
                      )}
                    </div>
                    <Button
                      label="Ver"
                      icon="pi pi-arrow-right"
                      className="p-button-text"
                      onClick={() => router.push(`/courses/${slug}/exercises/${courseExerciseId}/submissions/${submission.id}?studentId=${submission.student_id}`)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && submissions.length === 0 && (
          <div className="text-600">No hay entregas para este ejercicio</div>
        )}
      </div>
    </div>
  );
}
