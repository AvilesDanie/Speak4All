'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useParams } from 'next/navigation';
import { Card } from 'primereact/card';
import { Tag } from 'primereact/tag';
import { ProgressBar } from 'primereact/progressbar';
import { API_BASE, normalizeBackendUrl } from '@/services/apiClient';

interface Submission {
  id: number;
  course_exercise_id: number;
  status: string;
  media_path: string | null;
  created_at: string;
  updated_at: string;
}

interface Observation {
  id: number;
  text: string;
  created_at: string;
  therapist_id?: number;
  therapist_name?: string;
}

interface Evaluation {
  id: number;
  total_score: number;
  notes?: string | null;
  rubric_template: {
    max_score: number;
  };
}

interface ExerciseWithSubmission {
  course_exercise_id: number;
  exercise_name: string;
  due_date: string | null;
  status: string;
  submitted_at: string | null;
  has_media: boolean;
}

export default function StudentExercisesView() {
  const { token, user } = useAuth();
  const params = useParams();
  const courseSlug = params.slug as string;

  const [exercises, setExercises] = useState<ExerciseWithSubmission[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<ExerciseWithSubmission | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [courseId, setCourseId] = useState<number | null>(null);

  useEffect(() => {
    if (!token || !user || user.role !== 'STUDENT') return;

    const loadCourseAndExercises = async () => {
      try {
        setLoading(true);

        // Obtener curso por slug
        const resCourses = await fetch(`${API_BASE}/courses/my`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!resCourses.ok) {
          setError('No se pudo cargar el curso.');
          return;
        }

        const coursesResp = await resCourses.json();
        const courses = coursesResp.items || coursesResp;
        const foundCourse = courses.find(
          (c: any) => c.join_code === courseSlug || c.id === Number(courseSlug)
        );

        if (!foundCourse) {
          setError('Curso no encontrado.');
          return;
        }

        setCourseId(foundCourse.id);

        // Cargar ejercicios del estudiante
        const resExercises = await fetch(
          `${API_BASE}/submissions/courses/${foundCourse.id}/students/${user.id}/exercises-status`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (resExercises.ok) {
          const data: ExerciseWithSubmission[] = await resExercises.json();
          setExercises(data);
        } else {
          setError('No se pudieron cargar los ejercicios.');
        }
      } catch (err) {
        console.error('Error de red:', err);
        setError('Error de red al cargar los datos.');
      } finally {
        setLoading(false);
      }
    };

    loadCourseAndExercises();
  }, [token, user, courseSlug]);

  const loadSubmissionDetail = async (exercise: ExerciseWithSubmission) => {
    if (!token || !user || exercise.status !== 'DONE' || !courseId) return;

    setSelectedExercise(exercise);
    setLoadingDetail(true);
    setError(null);
    setSubmission(null);
    setObservations([]);
    setEvaluation(null);
    setMediaUrl(null);

    try {
      // Cargar detalle de entrega
      const resDetail = await fetch(
        `${API_BASE}/submissions/course-exercises/${exercise.course_exercise_id}/students/${user.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!resDetail.ok) {
        setError('No se pudo cargar el detalle de la entrega.');
        return;
      }

      const detailData = await resDetail.json();
      setSubmission(detailData.submission);

      // Media URL
      if (detailData.submission.media_path) {
        const resMedia = await fetch(
          `${API_BASE}/submissions/${detailData.submission.id}/media-url`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (resMedia.ok) {
          const m = await resMedia.json();
          setMediaUrl(normalizeBackendUrl(m.url));
        }
      }

      // Observaciones
      try {
        const resObs = await fetch(
          `${API_BASE}/observations/submission/${detailData.submission.id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (resObs.ok) {
          const obsData = await resObs.json();
          setObservations(Array.isArray(obsData) ? obsData : obsData.observations || []);
        }
      } catch (err) {
        console.error('Error cargando observaciones', err);
      }

      // Evaluación
      try {
        const resEval = await fetch(
          `${API_BASE}/evaluations/submission/${detailData.submission.id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (resEval.ok) {
          const evalData = await resEval.json();
          setEvaluation(evalData);
        }
      } catch (err) {
        console.error('Error cargando evaluación', err);
      }
    } finally {
      setLoadingDetail(false);
    }
  };

  if (!token || !user || user.role !== 'STUDENT') {
    return (
      <div className="surface-ground p-4">
        <Card>
          <p className="text-600">Debes iniciar sesión como estudiante para ver tus ejercicios.</p>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
        <div className="text-center">
          <i className="pi pi-spin pi-spinner" style={{ fontSize: '2rem' }} />
          <p className="mt-3">Cargando ejercicios...</p>
        </div>
      </div>
    );
  }

  const completedExercises = exercises.filter((e) => e.status === 'DONE');
  const pendingExercises = exercises.filter((e) => e.status === 'PENDING');

  return (
    <div className="surface-ground p-3 md:p-4" style={{ minHeight: '60vh' }}>
      <div className="grid">
        <div className="col-12 lg:col-8">
          <Card title="Mis ejercicios">
            {error && <p className="p-error mb-3">{error}</p>}

            {exercises.length === 0 ? (
              <p className="text-600">No hay ejercicios asignados aún.</p>
            ) : (
              <div className="flex flex-column gap-3">
                {exercises.map((ex) => (
                  <div
                    key={ex.course_exercise_id}
                    className="surface-50 border-round-lg p-3 cursor-pointer hover:surface-100 transition-colors transition-duration-200"
                    onClick={() => ex.status === 'DONE' && loadSubmissionDetail(ex)}
                  >
                    <div className="flex justify-content-between align-items-start mb-2">
                      <h4 className="m-0 text-base font-semibold">{ex.exercise_name}</h4>
                      <Tag
                        value={ex.status === 'DONE' ? 'Entregado' : 'Pendiente'}
                        severity={ex.status === 'DONE' ? 'success' : 'warning'}
                      />
                    </div>
                    {ex.due_date && (
                      <p className="m-0 text-sm text-600">
                        Fecha límite: {new Date(ex.due_date).toLocaleString()}
                      </p>
                    )}
                    {ex.submitted_at && (
                      <p className="m-0 text-sm text-600">
                        Entregado: {new Date(ex.submitted_at).toLocaleString()}
                      </p>
                    )}
                    {ex.status === 'DONE' && (
                      <p className="m-0 text-sm text-primary-600 mt-2">
                        <i className="pi pi-arrow-right mr-1" />
                        Clic para ver detalles
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="col-12 lg:col-4">
          {selectedExercise && submission ? (
            <div className="flex flex-column gap-3">
              <Card title="Detalles de la entrega">
                {loadingDetail ? (
                  <div className="text-center">
                    <i className="pi pi-spin pi-spinner" />
                    <p className="text-sm text-600 mt-2">Cargando...</p>
                  </div>
                ) : (
                  <>
                    {submission.media_path && mediaUrl && (
                      <div className="mb-3">
                        {submission.media_path.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                          <img
                            src={mediaUrl}
                            alt="Evidencia"
                            style={{ maxWidth: '100%', borderRadius: '8px' }}
                          />
                        ) : (
                          <video
                            src={mediaUrl}
                            controls
                            style={{ maxWidth: '100%', borderRadius: '8px' }}
                          >
                            Tu navegador no soporta video.
                          </video>
                        )}
                      </div>
                    )}

                    {evaluation && (
                      <div className="mb-3 p-3 surface-100 border-round">
                        <h5 className="m-0 mb-2 font-semibold">Calificación</h5>
                        <div className="flex align-items-center gap-2 mb-2">
                          <span className="text-3xl font-bold text-primary">
                            {evaluation.total_score}
                          </span>
                          <span className="text-600">
                            / {evaluation.rubric_template?.max_score || 100}
                          </span>
                        </div>
                        <ProgressBar
                          value={
                            (evaluation.total_score /
                              (evaluation.rubric_template?.max_score || 100)) *
                            100
                          }
                          showValue={false}
                          className="h-1rem"
                        />
                        {evaluation.notes && (
                          <div className="mt-3">
                            <p className="m-0 text-sm font-semibold mb-1">Notas del terapeuta:</p>
                            <p className="m-0 text-sm text-600">{evaluation.notes}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {observations.length > 0 && (
                      <div>
                        <h5 className="m-0 mb-2 font-semibold">Observaciones</h5>
                        <div className="flex flex-column gap-2">
                          {observations.map((obs) => (
                            <div key={obs.id} className="p-3 surface-100 border-round">
                              <p className="m-0 text-sm text-600 mb-1">
                                {obs.therapist_name || 'Terapeuta'} -{' '}
                                {new Date(obs.created_at).toLocaleDateString()}
                              </p>
                              <p className="m-0 text-sm">{obs.text}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {!evaluation && observations.length === 0 && (
                      <p className="text-sm text-600">
                        Tu entrega aún no ha sido evaluada por el terapeuta.
                      </p>
                    )}
                  </>
                )}
              </Card>
            </div>
          ) : (
            <Card>
              <p className="text-600 text-sm text-center">
                Selecciona un ejercicio entregado para ver sus detalles y calificación
              </p>
            </Card>
          )}
        </div>
      </div>

      <div className="mt-3">
        <Card title="Resumen">
          <div className="grid">
            <div className="col-6 md:col-3">
              <div className="text-center">
                <i className="pi pi-check-circle text-4xl text-green-500 mb-2" />
                <p className="m-0 text-2xl font-bold">{completedExercises.length}</p>
                <p className="m-0 text-sm text-600">Completados</p>
              </div>
            </div>
            <div className="col-6 md:col-3">
              <div className="text-center">
                <i className="pi pi-clock text-4xl text-orange-500 mb-2" />
                <p className="m-0 text-2xl font-bold">{pendingExercises.length}</p>
                <p className="m-0 text-sm text-600">Pendientes</p>
              </div>
            </div>
            <div className="col-6 md:col-3">
              <div className="text-center">
                <i className="pi pi-list text-4xl text-blue-500 mb-2" />
                <p className="m-0 text-2xl font-bold">{exercises.length}</p>
                <p className="m-0 text-sm text-600">Total</p>
              </div>
            </div>
            <div className="col-6 md:col-3">
              <div className="text-center">
                <i className="pi pi-percentage text-4xl text-purple-500 mb-2" />
                <p className="m-0 text-2xl font-bold">
                  {exercises.length > 0
                    ? Math.round((completedExercises.length / exercises.length) * 100)
                    : 0}
                  %
                </p>
                <p className="m-0 text-sm text-600">Progreso</p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
