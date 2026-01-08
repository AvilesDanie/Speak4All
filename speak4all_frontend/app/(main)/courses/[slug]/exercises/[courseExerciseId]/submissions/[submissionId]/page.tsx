'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Button } from 'primereact/button';
import { Tag } from 'primereact/tag';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { InputNumber } from 'primereact/inputnumber';
import { Card } from 'primereact/card';
import { RadioButton } from 'primereact/radiobutton';
import { Message } from 'primereact/message';
import { ProgressBar } from 'primereact/progressbar';
import { ObservationsDisplay } from '@/components/ObservationsDisplay';
import { useAuth } from '@/hooks/useAuth';
import { API_BASE } from '@/services/apiClient';
import { evaluationService, rubricService } from '@/services/rubrics';

interface SubmissionDetail {
  submission: {
    id: number;
    course_exercise_id: number;
    status: string;
    media_path: string | null;
    created_at: string;
    updated_at: string;
  };
  student: {
    id: number;
    full_name: string;
    email: string;
  };
}

interface RubricLevel {
  id: number;
  level?: number;
  name: string;
  description: string;
  points: number;
  order?: number;
}

interface RubricCriterion {
  id: number;
  name: string;
  description?: string;
  max_points: number;
  order?: number;
  levels: RubricLevel[];
}

interface RubricTemplate {
  id: number;
  max_score: number;
  criteria: RubricCriterion[];
}

interface Evaluation {
  id: number;
  total_score: number;
  notes?: string | null;
  is_locked?: boolean;
  criterion_scores: Array<{
    rubric_criteria_id: number;
    rubric_level_id: number;
    points_awarded: number;
  }>;
}

interface Observation {
  id: number;
  text: string;
  created_at: string;
  therapist_id?: number;
  therapist_name?: string;
}

export default function SubmissionDetailPage() {
  const { slug, courseExerciseId, submissionId } = useParams() as {
    slug: string;
    courseExerciseId: string;
    submissionId: string;
  };
  const searchParams = useSearchParams();
  const router = useRouter();
  const { token, user, loading: authLoading } = useAuth();

  const [studentId, setStudentId] = useState<number | null>(() => {
    const v = searchParams?.get('studentId');
    return v ? parseInt(v) : null;
  });
  const [detail, setDetail] = useState<SubmissionDetail | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [rubric, setRubric] = useState<RubricTemplate | null>(null);
  const [creatingDefaultRubric, setCreatingDefaultRubric] = useState(false);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [notes, setNotes] = useState('');
  const [selectedLevels, setSelectedLevels] = useState<Record<number, { levelId: number; points: number }>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingEval, setSavingEval] = useState(false);
  const [addingObs, setAddingObs] = useState(false);

  const numericSubmissionId = useMemo(() => parseInt(submissionId), [submissionId]);
  const numericCourseExerciseId = useMemo(() => parseInt(courseExerciseId), [courseExerciseId]);

  useEffect(() => {
    if (!token || authLoading) return;
    if (user?.role !== 'THERAPIST') {
      setError('Solo los terapeutas pueden acceder a esta entrega.');
      setLoading(false);
      return;
    }

    const loadAll = async () => {
      try {
        setError(null);
        setLoading(true);

        let targetStudentId = studentId;
        if (!targetStudentId) {
          // Buscar el studentId a partir del listado de entregas
          const resList = await fetch(
            `${API_BASE}/submissions/course-exercises/${numericCourseExerciseId}/students`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (resList.ok) {
            const list = await resList.json();
            const found = list.find((item: any) => item.submission_id === numericSubmissionId);
            if (found?.student_id) {
              targetStudentId = found.student_id;
              setStudentId(found.student_id);
            }
          }
        }

        if (!targetStudentId) {
          setError('No se pudo identificar al estudiante de esta entrega.');
          return;
        }

        // Detalle de la entrega
        const resDetail = await fetch(
          `${API_BASE}/submissions/course-exercises/${numericCourseExerciseId}/students/${targetStudentId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!resDetail.ok) {
          const txt = await resDetail.text();
          setError(txt || 'No se pudo cargar la entrega.');
          return;
        }
        const detailData: SubmissionDetail = await resDetail.json();
        setDetail(detailData);

        // Media firmada
        if (detailData.submission.media_path) {
          const resMedia = await fetch(
            `${API_BASE}/submissions/${detailData.submission.id}/media-url`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (resMedia.ok) {
            const m = await resMedia.json();
            setMediaUrl(m.url);
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

        // Rúbrica - solo cargar si existe, NO crear automáticamente
        try {
          const rubricData = await rubricService.getRubric(numericCourseExerciseId, token);
          setRubric(rubricData);
        } catch (err) {
          console.error('Sin rúbrica configurada para este ejercicio', err);
          setRubric(null);
        }

        // Evaluación existente
        try {
          const evalData = await evaluationService.getEvaluationBySubmission(numericSubmissionId, token);
          if (evalData) {
            setEvaluation(evalData);
            setNotes(evalData.notes || '');
            const preset: Record<number, { levelId: number; points: number }> = {};
            evalData.criterion_scores.forEach((c: any) => {
              preset[c.rubric_criteria_id] = {
                levelId: c.rubric_level_id,
                points: c.points_awarded,
              };
            });
            setSelectedLevels(preset);
          }
        } catch (err) {
          console.error('Error cargando evaluación', err);
        }
      } finally {
        setLoading(false);
      }
    };

    loadAll();
  }, [token, user, authLoading, numericCourseExerciseId, numericSubmissionId, studentId]);

  const totalScore = useMemo(() => {
    if (!rubric) return 0;
    return rubric.criteria.reduce((acc, crit) => {
      const selected = selectedLevels[crit.id];
      return acc + (selected?.points || 0);
    }, 0);
  }, [rubric, selectedLevels]);

  const handleSelectLevel = (criterionId: number, level: RubricLevel) => {
    setSelectedLevels((prev) => ({
      ...prev,
      [criterionId]: { levelId: level.id, points: level.points },
    }));
  };

  const handleSaveEvaluation = async () => {
    if (!token || !rubric || !detail) return;
    const missing = rubric.criteria.find((c) => !selectedLevels[c.id]);
    if (missing) {
      setError(`Selecciona un nivel para "${missing.name}"`);
      return;
    }

    const payload = {
      criterion_scores: rubric.criteria.map((c) => ({
        rubric_criteria_id: c.id,
        rubric_level_id: selectedLevels[c.id].levelId,
        points_awarded: selectedLevels[c.id].points,
      })),
      notes,
    };

    console.log('Guardando evaluación:', payload);

    try {
      setSavingEval(true);
      setError(null);
      let saved;
      if (evaluation?.id) {
        console.log('Actualizando evaluación', evaluation.id);
        saved = await evaluationService.updateEvaluation(evaluation.id, payload, token);
      } else {
        console.log('Creando nueva evaluación');
        saved = await evaluationService.createEvaluation(
          {
            submission_id: detail.submission.id,
            rubric_template_id: rubric.id,
            ...payload,
          },
          token
        );
      }
      console.log('Evaluación guardada:', saved);
      setEvaluation(saved as Evaluation);
      alert('Evaluación guardada correctamente');
    } catch (err: any) {
      console.error('Error guardando evaluación:', err);
      setError(err?.message || 'No se pudo guardar la evaluación.');
    } finally {
      setSavingEval(false);
    }
  };

  const handleAddObservation = async (text: string) => {
    if (!token || !detail) return;
    try {
      setAddingObs(true);
      const res = await fetch(`${API_BASE}/observations/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ submission_id: detail.submission.id, text }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || 'No se pudo agregar la observación');
      }
      const created = await res.json();
      setObservations((prev) => [...prev, created]);
    } finally {
      setAddingObs(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
        <div className="text-center">
          <i className="pi pi-spin pi-spinner" style={{ fontSize: '2rem' }} />
          <p className="mt-3">Cargando entrega...</p>
        </div>
      </div>
    );
  }

  if (!token || user?.role !== 'THERAPIST') {
    return (
      <div className="surface-ground p-4">
        <div className="card p-4 border-round-2xl">
          <h2 className="text-xl font-semibold mb-2">Acceso restringido</h2>
          <p className="text-600">Debes iniciar sesión como terapeuta para ver esta entrega.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="surface-ground p-3 md:p-4" style={{ minHeight: '60vh' }}>
      <div className="flex justify-content-between align-items-center mb-3">
        <Button
          type="button"
          icon="pi pi-arrow-left"
          className="p-button-text p-button-rounded"
          label="Volver"
          onClick={() => router.push(`/courses/${slug}/exercises/${courseExerciseId}/submissions`)}
        />
        <h2 className="m-0 text-xl font-semibold">Detalle de entrega</h2>
      </div>

      {error && (
        <Message severity="error" text={error} className="mb-3" />
      )}

      {detail ? (
        <div className="grid">
          <div className="col-12 lg:col-7">
            <Card title="Información de la entrega" className="mb-3">
              <div className="flex flex-column gap-2">
                <div className="flex justify-content-between align-items-center">
                  <span className="text-600">Estado</span>
                  <Tag
                    value={detail.submission.status === 'DONE' ? 'Entregado' : 'Pendiente'}
                    severity={detail.submission.status === 'DONE' ? 'success' : 'warning'}
                  />
                </div>
                <div className="flex justify-content-between align-items-center">
                  <span className="text-600">Fecha</span>
                  <span className="font-medium">{new Date(detail.submission.updated_at).toLocaleString()}</span>
                </div>
                <div className="flex justify-content-between align-items-center">
                  <span className="text-600">Estudiante</span>
                  <span className="font-medium">{detail.student.full_name}</span>
                </div>
                <div className="flex justify-content-between align-items-center">
                  <span className="text-600">Correo</span>
                  <span className="font-medium">{detail.student.email || 'No indicado'}</span>
                </div>
              </div>
            </Card>

            {detail.submission.media_path && (
              <Card title="Evidencia" className="mb-3">
                {mediaUrl ? (
                  detail.submission.media_path.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                    <img
                      src={mediaUrl}
                      alt="Evidencia"
                      style={{ maxWidth: '100%', maxHeight: '500px', borderRadius: '8px' }}
                    />
                  ) : (
                    <video
                      src={mediaUrl}
                      controls
                      style={{ maxWidth: '100%', maxHeight: '500px', borderRadius: '8px' }}
                    >
                      Tu navegador no soporta video.
                    </video>
                  )
                ) : (
                  <div className="text-center p-3">
                    <i className="pi pi-spin pi-spinner" style={{ fontSize: '2rem' }} />
                    <p className="text-sm text-600 mt-2">Cargando evidencia...</p>
                  </div>
                )}
              </Card>
            )}

            <Card title="Observaciones" className="mb-3">
              <ObservationsDisplay
                observations={observations}
                isTherapist
                onAddObservation={addingObs ? undefined : handleAddObservation}
              />
            </Card>
          </div>

          <div className="col-12 lg:col-5">
            <Card title="Rúbrica y evaluación">
              {!rubric ? (
                <Message severity="warn" text="No hay rúbrica configurada para este ejercicio. Configura una al publicar el ejercicio." />
              ) : rubric.criteria.length === 0 ? (
                <Message severity="warn" text="La rúbrica no tiene criterios definidos." />
              ) : (
                <div className="flex flex-column gap-3">
                  {evaluation?.is_locked && (
                    <Message severity="success" text="✔️ Evaluación finalizada. Los valores no se pueden modificar." className="mb-2" />
                  )}
                  
                  <div className="p-3 bg-gray-50 border-round">
                    <p className="text-sm text-600 m-0">
                      Puntuación máxima: <strong>{rubric.max_score} pts</strong>
                    </p>
                    <p className="text-sm text-600 m-0">
                      Obtenida: <strong>{totalScore}</strong>
                    </p>
                    <ProgressBar value={Math.min((totalScore / rubric.max_score) * 100, 100)} showValue={false} className="mt-2" />
                  </div>

                  {rubric.criteria.map((crit) => (
                    <div key={crit.id} className="border border-round p-3">
                      <div className="flex justify-content-between align-items-start mb-2">
                        <div>
                          <h4 className="m-0 text-base font-semibold">{crit.name}</h4>
                          <p className="m-0 text-sm text-600">Máximo: {crit.max_points} pts</p>
                        </div>
                        <span className="font-bold text-blue-600">
                          {selectedLevels[crit.id]?.points ?? 0} / {crit.max_points}
                        </span>
                      </div>

                      <div className="grid">
                        {crit.levels
                          .slice()
                          .sort((a, b) => (a.level ?? 0) - (b.level ?? 0))
                          .map((lvl) => (
                            <div key={lvl.id} className="col-12 md:col-6 flex align-items-start gap-2">
                              <RadioButton
                                inputId={`crit-${crit.id}-lvl-${lvl.id}`}
                                name={`crit-${crit.id}`}
                                value={lvl.id}
                                onChange={() => handleSelectLevel(crit.id, lvl)}
                                checked={selectedLevels[crit.id]?.levelId === lvl.id}
                                disabled={evaluation?.is_locked}
                              />
                              <label htmlFor={`crit-${crit.id}-lvl-${lvl.id}`} className="flex flex-column">
                                <span className="font-semibold">Nivel {lvl.level}: {lvl.points} pts</span>
                                <span className="text-sm text-600">{lvl.description}</span>
                              </label>
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}

                  <div className="flex flex-column gap-2">
                    <label className="text-sm text-600">Notas adicionales</label>
                    <InputTextarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      autoResize
                      rows={3}
                      className="w-full"
                      placeholder="Comentarios sobre el desempeño..."
                      disabled={evaluation?.is_locked}
                    />
                  </div>

                  <div className="flex justify-content-end gap-2">
                    <Button
                      label={savingEval ? 'Guardando...' : evaluation ? 'Actualizar evaluación' : 'Guardar evaluación'}
                      icon="pi pi-save"
                      loading={savingEval}
                      onClick={handleSaveEvaluation}
                      disabled={evaluation?.is_locked}
                    />
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      ) : (
        <Card>
          <p>No se encontró la entrega.</p>
        </Card>
      )}
    </div>
  );
}
