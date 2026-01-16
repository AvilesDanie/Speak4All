'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from 'primereact/button';
import { Tag } from 'primereact/tag';
import { ProgressBar } from 'primereact/progressbar';
import { Dialog } from 'primereact/dialog';
import { InputTextarea } from 'primereact/inputtextarea';
import { Card } from 'primereact/card';
import { Message } from 'primereact/message';
import { RadioButton } from 'primereact/radiobutton';
import AudioPlayer from '../../../exercises/AudioPlayer';
import { API_BASE } from '@/services/apiClient';
import { BackendUser, Role } from '@/services/auth';
import { ExerciseOut, getExerciseAudioUrl, getExercisePdfUrl } from '@/services/exercises';
import { CourseExercise, StudentExerciseStatus, SubmissionStatus } from '@/services/courses';
import { useWebSocket, WebSocketMessage } from '@/hooks/useWebSocket';

type CourseExerciseOut = CourseExercise;

interface SubmissionOut {
    id: number;
    student_id: number;
    course_exercise_id: number;
    status: SubmissionStatus;
    media_path: string;  // Obligatorio: foto o video
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

const AUDIO_BASE_URL = API_BASE;


// ──────────────────────────────────────────
// Página de detalle / entrega
// ──────────────────────────────────────────

const decodeSlug = (
    slug: string
): { courseId: number; courseExerciseId: number } | null => {
    try {
        const decoded = atob(slug);
        const [courseIdStr, courseExerciseIdStr] = decoded.split(':');
        const courseId = Number(courseIdStr);
        const courseExerciseId = Number(courseExerciseIdStr);
        if (Number.isNaN(courseId) || Number.isNaN(courseExerciseId)) return null;
        return { courseId, courseExerciseId };
    } catch {
        return null;
    }
};

const CourseExerciseDetailPage: React.FC = () => {
    const params = useParams() as { slug: string; exerciseSlug: string };
    const { slug, exerciseSlug } = params;


    const router = useRouter();

    const [token, setToken] = useState<string | null>(null);
    const [role, setRole] = useState<Role | null>(null);

    const [courseId, setCourseId] = useState<number | null>(null);
    const [courseExerciseId, setCourseExerciseId] = useState<number | null>(null);

    const [courseExercise, setCourseExercise] = useState<CourseExerciseOut | null>(
        null
    );
    const [studentStatus, setStudentStatus] =
        useState<StudentExerciseStatus | null>(null);

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [showErrorModal, setShowErrorModal] = useState(false);
    const [modalErrorMsg, setModalErrorMsg] = useState<string>('');
    const [exerciseDeletedModal, setExerciseDeletedModal] = useState(false);

    const [file, setFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [exerciseAudioUrl, setExerciseAudioUrl] = useState<string | null>(null);
    const [downloadingPdf, setDownloadingPdf] = useState(false);
    
    const [observations, setObservations] = useState<Observation[]>([]);
    const [rubric, setRubric] = useState<RubricTemplate | null>(null);
    const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
    const [submissionId, setSubmissionId] = useState<number | null>(null);

    // Cargar user + token + ids desde el slug
    // Cargar user + token + ids desde el exerciseSlug
useEffect(() => {
    if (typeof window === 'undefined') return;

    const decoded = decodeSlug(exerciseSlug);
    if (!decoded) {
        setErrorMsg('Enlace de ejercicio no válido.');
        setLoading(false);
        return;
    }

    setCourseId(decoded.courseId);
    setCourseExerciseId(decoded.courseExerciseId);

    const userRaw = window.localStorage.getItem('backend_user');
    if (userRaw) {
        try {
            const u = JSON.parse(userRaw) as BackendUser;
            setRole(u.role);
        } catch {
            setRole(null);
        }
    }

    const t = window.localStorage.getItem('backend_token');
    setToken(t ?? null);
}, [exerciseSlug]);


    // Cargar datos del ejercicio + estado del alumno
    useEffect(() => {
        const loadData = async () => {
            if (!token || !role) {
                setLoading(false);
                return;
            }
            if (courseId == null || courseExerciseId == null) {
                setLoading(false);
                return;
            }

            // Para estudiantes, cargar ejercicio + estado
            if (role !== 'STUDENT') {
                setLoading(false);
                return;
            }

            try {
                setLoading(true);

                // 1) Ejercicios del curso
                const resExercises = await fetch(
                    `${API_BASE}/course-exercises/${courseId}`,
                    {
                        headers: { Authorization: `Bearer ${token}` },
                    }
                );

                if (resExercises.ok) {
                    const list: CourseExerciseOut[] = await resExercises.json();
                    const found = list.find((ce) => ce.id === courseExerciseId);
                    if (found) {
                        setCourseExercise(found);
                    }
                } else {
                    console.error(
                        'Error obteniendo ejercicio:',
                        await resExercises.text()
                    );
                }

                // 2) Estado de ejercicios del alumno
                const resStatus = await fetch(
                    `${API_BASE}/course-students/${courseId}/me/exercises`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );

                if (resStatus.ok) {
                    const statusList: StudentExerciseStatus[] =
                        await resStatus.json();
                    const s = statusList.find(
                        (st) => st.course_exercise_id === courseExerciseId
                    );
                    if (s) setStudentStatus(s);
                } else {
                    console.error(
                        'Error obteniendo estado de ejercicios:',
                        await resStatus.text()
                    );
                }
            } catch (err) {
                console.error('Error de red:', err);
                setErrorMsg('Error de red al cargar el ejercicio.');
            } finally {
                setLoading(false);
            }
        };

        if (token && role && courseId != null && courseExerciseId != null) {
            loadData();
        }
    }, [token, role, courseId, courseExerciseId]);

    // Efecto para obtener URL firmada del audio del ejercicio
    useEffect(() => {
        if (courseExercise?.exercise?.id && token) {
            getExerciseAudioUrl(courseExercise.exercise.id, token)
                .then(url => {
                    setExerciseAudioUrl(url);
                })
                .catch(err => {
                    console.error('Error obteniendo URL de audio:', err);
                    setExerciseAudioUrl(null);
                });
        }
    }, [courseExercise?.exercise?.id, token]);

    // Cargar observaciones, rúbrica y evaluación cuando el estudiante tiene entrega
    useEffect(() => {
        const loadStudentFeedback = async () => {
            if (!token || !courseExerciseId || studentStatus?.status !== 'DONE') {
                return;
            }

            const subId = studentStatus.submission_id;
            if (!subId) {
                console.log('No submission_id disponible en studentStatus');
                return;
            }

            setSubmissionId(subId);

            try {
                // 1. Cargar observaciones
                try {
                    const resObs = await fetch(
                        `${API_BASE}/observations/submission/${subId}`,
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                    if (resObs.ok) {
                        const obsData = await resObs.json();
                        setObservations(Array.isArray(obsData) ? obsData : obsData.observations || []);
                    }
                } catch (err) {
                    console.error('Error cargando observaciones:', err);
                }

                // 2. Cargar evaluación
                try {
                    const resEval = await fetch(
                        `${API_BASE}/evaluations/submission/${subId}`,
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                    if (resEval.ok) {
                        const evalData = await resEval.json();
                        if (evalData) {
                            setEvaluation(evalData);

                            // 3. Cargar rúbrica si existe evaluación
                            try {
                                const resRubric = await fetch(
                                    `${API_BASE}/rubrics/${courseExerciseId}`,
                                    { headers: { Authorization: `Bearer ${token}` } }
                                );
                                if (resRubric.ok) {
                                    const rubricData = await resRubric.json();
                                    setRubric(rubricData);
                                }
                            } catch (err) {
                                console.error('Error cargando rúbrica:', err);
                            }
                        }
                    }
                } catch (err) {
                    console.error('Error cargando evaluación:', err);
                }
            } catch (err) {
                console.error('Error obteniendo feedback del estudiante:', err);
            }
        };

        loadStudentFeedback();
    }, [token, courseExerciseId, studentStatus?.status, studentStatus?.submission_id]);

    // WebSocket para actualizaciones en tiempo real
    const { message } = useWebSocket({ 
        courseId, 
        token, 
        enabled: !!courseId && !!token && role === 'STUDENT' 
    });

    // Manejar mensajes de WebSocket
    useEffect(() => {
        if (!message || !courseId || !courseExerciseId) return;

        if (message.type === 'exercise_deleted') {
            const data = message.data as any;
            // Si el ejercicio eliminado es el que está viendo el estudiante
            if (data.course_exercise_id === courseExerciseId || data.id === courseExerciseId) {
                setExerciseDeletedModal(true);
            }
        } else if (message.type === 'submission_deleted') {
            const data = message.data as any;
            // Si el evento es para este ejercicio y es para el estudiante actual
            if (data.course_exercise_id === courseExerciseId) {
                // Actualizar estado local para mostrar que no hay entrega
                setStudentStatus((prev) =>
                    prev
                        ? {
                              ...prev,
                              status: 'PENDING',
                              submitted_at: null,
                          }
                        : prev
                );
            }
        } else if (message.type === 'submission_created' || message.type === 'submission_updated') {
            const data = message.data as any;
            if (data.course_exercise_id === courseExerciseId) {
                // Recargar estado del estudiante si hay cambios
                if (token && courseId && courseExerciseId) {
                    fetch(
                        `${API_BASE}/course-students/${courseId}/me/exercises`,
                        { headers: { Authorization: `Bearer ${token}` } }
                    )
                        .then((res) => res.json())
                        .then((statusList: StudentExerciseStatus[]) => {
                            const s = statusList.find(
                                (st) => st.course_exercise_id === courseExerciseId
                            );
                            if (s) setStudentStatus(s);
                        })
                        .catch((err) => console.error('Error reloading status:', err));
                }
            }
        } else if (message.type === 'observation_created' || message.type === 'evaluation_created' || message.type === 'evaluation_updated') {
            // Recargar observaciones y evaluación cuando el terapeuta agregue feedback
            const data = message.data as any;
            if (data.course_exercise_id === courseExerciseId && submissionId) {
                // Recargar observaciones
                if (message.type === 'observation_created') {
                    fetch(
                        `${API_BASE}/observations/submission/${submissionId}`,
                        { headers: { Authorization: `Bearer ${token}` } }
                    )
                        .then((res) => res.json())
                        .then((obsData) => {
                            setObservations(Array.isArray(obsData) ? obsData : obsData.observations || []);
                        })
                        .catch((err) => console.error('Error reloading observations:', err));
                }
                
                // Recargar evaluación
                if (message.type === 'evaluation_created' || message.type === 'evaluation_updated') {
                    fetch(
                        `${API_BASE}/evaluations/submission/${submissionId}`,
                        { headers: { Authorization: `Bearer ${token}` } }
                    )
                        .then((res) => res.json())
                        .then((evalData) => {
                            if (evalData) {
                                setEvaluation(evalData);
                                
                                // Cargar rúbrica si aún no está cargada
                                if (!rubric && courseExerciseId) {
                                    fetch(
                                        `${API_BASE}/rubrics/${courseExerciseId}`,
                                        { headers: { Authorization: `Bearer ${token}` } }
                                    )
                                        .then((res) => res.json())
                                        .then((rubricData) => setRubric(rubricData))
                                        .catch((err) => console.error('Error loading rubric:', err));
                                }
                            }
                        })
                        .catch((err) => console.error('Error reloading evaluation:', err));
                }
            }
        }
    }, [message, courseId, courseExerciseId, token, submissionId, rubric]);

    const statusTag = () => {
        if (!studentStatus) return null;
        const now = new Date();
        const due = studentStatus.due_date
            ? new Date(studentStatus.due_date)
            : null;
        const isLate =
            studentStatus.status === 'PENDING' && due && due < now;

        if (studentStatus.status === 'DONE') {
            return <Tag value="Entregado" severity="success" />;
        }
        if (isLate) {
            return <Tag value="Retrasado" severity="danger" />;
        }
        return <Tag value="Pendiente" severity="warning" />;
    };

    const progressValue =
        studentStatus?.status === 'DONE' ? 100 : 40; // solo decorativo

    const handleSubmit = async () => {
        if (!token || courseExerciseId == null) {
            setModalErrorMsg('No se pudo enviar la entrega (falta token).');
            setShowErrorModal(true);
            return;
        }

        if (!file) {
            setModalErrorMsg('Debes seleccionar una foto o video para entregar el ejercicio.');
            setShowErrorModal(true);
            return;
        }

        setSubmitting(true);
        setSuccessMsg(null);
        setErrorMsg(null);

        try {
            const formData = new FormData();
            formData.append('media', file);

            const res = await fetch(
                `${API_BASE}/submissions/course-exercises/${courseExerciseId}/submit`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                    body: formData,
                }
            );

            if (!res.ok) {
                const text = await res.text();
                console.error('Error enviando entrega:', text);
                setModalErrorMsg(text || 'No se pudo enviar la entrega.');
                setShowErrorModal(true);
                return;
            }

            const data: SubmissionOut = await res.json();

            // Actualizamos estado local
            setStudentStatus((prev) =>
                prev
                    ? {
                          ...prev,
                          status: data.status,
                          submitted_at: data.updated_at,
                      }
                    : prev
            );

            setShowSuccessModal(true);
            setFile(null); // Limpiar archivo después de envío exitoso
        } catch (err) {
            console.error('Error de red al enviar entrega:', err);
            setModalErrorMsg('Error de red al enviar la entrega.');
            setShowErrorModal(true);
        } finally {
            setSubmitting(false);
        }
    };

    const handleCancelSubmission = async () => {
        if (!token || courseExerciseId == null) {
            setModalErrorMsg('No se pudo anular la entrega.');
            setShowErrorModal(true);
            return;
        }

        setSubmitting(true);

        try {
            const res = await fetch(
                `${API_BASE}/submissions/course-exercises/${courseExerciseId}/cancel`,
                {
                    method: 'DELETE',
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            if (!res.ok) {
                const text = await res.text();
                console.error('Error anulando entrega:', text);
                setModalErrorMsg(text || 'No se pudo anular la entrega.');
                setShowErrorModal(true);
                return;
            }

            // Actualizamos estado local
            setStudentStatus((prev) =>
                prev
                    ? {
                          ...prev,
                          status: 'PENDING',
                          submitted_at: null,
                      }
                    : prev
            );

            setSuccessMsg('Entrega anulada correctamente.');
        } catch (err) {
            console.error('Error de red al anular entrega:', err);
            setModalErrorMsg('Error de red al anular la entrega.');
            setShowErrorModal(true);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDownloadPdf = async () => {
        if (!courseExercise?.exercise?.id || !token) {
            setModalErrorMsg('Error al descargar el PDF.');
            setShowErrorModal(true);
            return;
        }

        setDownloadingPdf(true);
        try {
            const pdfUrl = await getExercisePdfUrl(courseExercise.exercise.id, token);
            
            // Descargar el PDF
            const link = document.createElement('a');
            link.href = pdfUrl;
            link.download = `${courseExercise.exercise.name || 'ejercicio'}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            console.error('Error descargando PDF:', err);
            setModalErrorMsg('Error al descargar el PDF.');
            setShowErrorModal(true);
        } finally {
            setDownloadingPdf(false);
        }
    };

    if (loading) {
        return (
            <div
                className="flex justify-content-center align-items-center"
                style={{ minHeight: '60vh' }}
            >
                <div className="text-center">
                    <i className="pi pi-spin pi-spinner" style={{ fontSize: '2rem' }} />
                    <p className="mt-3">Cargando ejercicio...</p>
                </div>
            </div>
        );
    }

    // Verificar terapeuta ANTES de verificar si hay token
    if (role === 'THERAPIST' && courseExerciseId) {
        const reviewUrl = `/courses/${slug}/exercises/${courseExerciseId}`;
        
        return (
            <div className="surface-ground p-3 md:p-4" style={{ minHeight: '60vh' }}>
                <div className="card p-4 border-round-2xl">
                    <h2 className="text-xl font-semibold mb-2">
                        Vista de estudiante
                    </h2>
                    <p className="text-600 m-0 mb-3">
                        Esta es la vista que ven los estudiantes. Como terapeuta, puedes revisar las entregas desde la página de gestión.
                    </p>
                    <Button
                        label="Ir a revisar entregas"
                        icon="pi pi-eye"
                        className="mt-2"
                        onClick={() => router.push(reviewUrl)}
                    />
                </div>
            </div>
        );
    }

    if (!token) {
        return (
            <div className="surface-ground p-3 md:p-4" style={{ minHeight: '60vh' }}>
                <div className="card p-4 border-round-2xl">
                    <h2 className="text-xl font-semibold mb-2">
                        No se pudo cargar el ejercicio
                    </h2>
                    <p className="text-600 m-0">
                        Debes iniciar sesión para ver este ejercicio.
                    </p>
                </div>
            </div>
        );
    }

    if (role !== 'STUDENT' || !courseExercise) {
        return (
            <div className="surface-ground p-3 md:p-4" style={{ minHeight: '60vh' }}>
                <div className="card p-4 border-round-2xl">
                    <h2 className="text-xl font-semibold mb-2">
                        No se pudo cargar el ejercicio
                    </h2>
                    <p className="text-600 m-0">
                        Comprueba que has iniciado sesión como estudiante y vuelve a
                        abrir el ejercicio desde el curso.
                    </p>
                </div>
            </div>
        );
    }

    const exercise = courseExercise.exercise;
    const text = exercise?.text ?? '';
    const title = studentStatus?.exercise_name ?? exercise?.name ?? '';
    const dueDate = studentStatus?.due_date
        ? new Date(studentStatus.due_date).toLocaleString()
        : null;
    const submittedAt = studentStatus?.submitted_at
        ? new Date(studentStatus.submitted_at).toLocaleString()
        : null;

    return (
        <div className="surface-ground p-3 md:p-4" style={{ minHeight: '60vh' }}>
            {/* Barra superior: volver + botones + estado */}
            <div className="flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                <Button
                    type="button"
                    icon="pi pi-arrow-left"
                    className="p-button-text p-button-rounded"
                    label="Volver al curso"
                    onClick={() => router.push(`/courses/${slug}`)}
                />

                <Button
                    type="button"
                    icon="pi pi-download"
                    className="p-button-text p-button-rounded"
                    label="Descargar PDF"
                    loading={downloadingPdf}
                    disabled={downloadingPdf}
                    onClick={handleDownloadPdf}
                />

                <div className="flex flex-column align-items-end gap-1">
                    <span className="text-xs text-600">Estado del ejercicio</span>
                    <div className="flex align-items-center gap-2">
                        {statusTag()}
                    </div>
                </div>
            </div>

            {/* Header grande con título */}
            <div className="card mb-3 border-none" style={{ borderRadius: '1.5rem' }}>
                <div
                    className="p-3 md:p-4"
                    style={{
                        borderRadius: '1.25rem',
                        background:
                            'linear-gradient(135deg,#4f46e5 0%,#8b5cf6 40%,#0ea5e9 100%)',
                        color: '#f9fafb',
                    }}
                >
                    <div className="flex justify-content-between align-items-start gap-3 flex-wrap">
                        <div>
                            <h1 className="m-0 text-2xl md:text-3xl font-semibold">
                                {title}
                            </h1>
                            {/* Prompt como objetivo */}
                            {/*exercise?.prompt && (
                                <p className="m-0 mt-2 text-sm md:text-base">
                                    <span className="font-medium">Objetivo: </span>
                                    {exercise.prompt}
                                </p>
                            )*/}
                        </div>

                        <div style={{ minWidth: '220px' }}>
                            <ProgressBar
                                value={progressValue}
                                showValue={false}
                                style={{ height: '0.5rem', borderRadius: '999px' }}
                            />
                            <div className="flex justify-content-between text-xs mt-2 text-indigo-100">
                                <span>
                                    {studentStatus?.status === 'DONE'
                                        ? 'Ejercicio entregado'
                                        : 'Ejercicio pendiente'}
                                </span>
                                {dueDate && <span>Fecha límite: {dueDate}</span>}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Contenido principal: texto + entrega */}
            <div className="flex flex-column lg:flex-row gap-3">
                {/* Columna izquierda: texto + audio */}
                <div className="flex-1 flex flex-column gap-3">
                    <div className="card">
                        <h3 className="text-lg font-semibold mb-2">
                            Texto del ejercicio
                        </h3>
                        <p className="text-600 text-sm mb-3">
                            Escucha primero el audio del terapeuta (si está disponible) y
                            luego realiza tu propia grabación leyendo el texto.
                        </p>
                        <div
                            className="surface-50 border-round-lg p-3"
                            style={{ minHeight: '10rem' }}
                        >
                            <InputTextarea
                                value={text}
                                readOnly
                                autoResize={false}
                                rows={10}
                                style={{
                                    width: '100%',
                                    border: 'none',
                                    background: 'transparent',
                                    resize: 'none',
                                }}
                            />
                        </div>
                    </div>

                    {exercise?.audio_path && (
                        <div className="card">
                            <h3 className="text-lg font-semibold mb-2">
                                Audio de referencia
                            </h3>
                            <p className="text-600 text-sm mb-3">
                                Escucha cómo se pronuncia el ejercicio antes de grabarte.
                            </p>
                            {exerciseAudioUrl ? (
                                <AudioPlayer 
                                    src={exerciseAudioUrl} 
                                    exerciseId={courseExercise?.exercise?.id}
                                    token={token}
                                    exerciseName={courseExercise?.exercise?.name}
                                />
                            ) : (
                                <div className="text-center p-3">
                                    <i className="pi pi-spin pi-spinner" style={{ fontSize: '2rem' }} />
                                    <p className="text-sm text-600 mt-2">Cargando audio...</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Columna derecha: entrega */}
                <div
                    className="card"
                    style={{ width: '100%', maxWidth: '420px', alignSelf: 'flex-start' }}
                >
                    <h3 className="text-lg font-semibold mb-2">Entregar ejercicio</h3>
                    <p className="text-600 text-sm mb-3">
                        Sube una <strong>foto o video</strong> como evidencia de que realizaste el ejercicio. Es obligatorio para marcar el ejercicio como completado.
                    </p>

                    <div className="field mb-3">
    <label className="font-medium text-sm mb-2 block">
        Foto o Video <span className="text-red-500">*</span>
    </label>

    {/* Caja estilizada */}
    <div className="surface-50 border-round-lg p-3 flex flex-column gap-2">
        <div className="flex align-items-center justify-content-between gap-3 flex-wrap">
            <div className="flex align-items-center gap-2">
                <i className={`pi ${file ? (file.type.startsWith('image/') ? 'pi-image' : 'pi-video') : 'pi-camera'} text-lg`} />
                <div className="flex flex-column">
                    <span className="text-sm font-medium text-800">
                        {file ? file.name : 'Ningún archivo seleccionado'}
                    </span>
                    <span className="text-xs text-600">
                        {file
                            ? `${(file.size / 1024 / 1024).toFixed(1)} MB`
                            : 'JPG, PNG, MP4, WebM · máx. 50MB'}
                    </span>
                </div>
            </div>

            <Button
                type="button"
                icon="pi pi-folder-open"
                label={file ? 'Cambiar archivo' : 'Seleccionar archivo'}
                className="p-button-sm"
                onClick={() => fileInputRef.current?.click()}
            />
        </div>
    </div>

    {/* Input real oculto */}
    <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        style={{ display: 'none' }}
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
    />
</div>


                    {submittedAt && (
                        <p className="text-600 text-sm mb-3">
                            Última entrega:{' '}
                            <span className="font-medium">{submittedAt}</span>
                        </p>
                    )}

                    {studentStatus?.status === 'DONE' ? (
                        <div className="flex flex-column gap-2">
                            <Button
                                label="Cambiar evidencia"
                                icon="pi pi-upload"
                                className="w-full"
                                onClick={handleSubmit}
                                loading={submitting}
                                disabled={!file}
                            />
                            <Button
                                label="Anular entrega"
                                icon="pi pi-times"
                                className="w-full p-button-danger p-button-outlined"
                                onClick={handleCancelSubmission}
                                loading={submitting}
                                disabled={submitting || evaluation !== null}
                                tooltip={evaluation ? "No se puede anular una entrega ya calificada" : ""}
                                tooltipOptions={{ position: "top" }}
                            />
                        </div>
                    ) : (
                        <Button
                            label="Enviar entrega"
                            icon="pi pi-upload"
                            className="w-full mt-2"
                            onClick={handleSubmit}
                            loading={submitting}
                            disabled={!file}
                        />
                    )}
                </div>
            </div>

            {/* Sección de Observaciones y Evaluación (solo si hay entrega) */}
            {studentStatus?.status === 'DONE' && (observations.length > 0 || evaluation) && (
                <div className="grid mt-3">
                    {/* Observaciones */}
                    {observations.length > 0 && (
                        <div className="col-12 lg:col-6">
                            <Card title="Observaciones del terapeuta">
                                <div className="flex flex-column gap-3">
                                    {observations.map((obs) => (
                                        <div key={obs.id} className="surface-50 border-round p-3">
                                            <p className="m-0 text-800">{obs.text}</p>
                                            <div className="flex justify-content-between align-items-center mt-2">
                                                <small className="text-600">
                                                    {obs.therapist_name || `Terapeuta #${obs.therapist_id}`}
                                                </small>
                                                <small className="text-600">
                                                    {new Date(obs.created_at).toLocaleString()}
                                                </small>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </Card>
                        </div>
                    )}

                    {/* Evaluación con Rúbrica */}
                    {evaluation && rubric && (
                        <div className="col-12 lg:col-6">
                            <Card title="Evaluación">
                                <div className="flex flex-column gap-3">
                                    <Message severity="success" text="✔️ Tu ejercicio ha sido evaluado" />
                                    
                                    <div className="p-3 bg-gray-50 border-round">
                                        <p className="text-sm text-600 m-0">
                                            Puntuación máxima: <strong>{rubric.max_score} pts</strong>
                                        </p>
                                        <p className="text-sm text-600 m-0">
                                            Obtenida: <strong className="text-blue-600">{evaluation.total_score} pts</strong>
                                        </p>
                                        <ProgressBar 
                                            value={Math.min((evaluation.total_score / rubric.max_score) * 100, 100)} 
                                            showValue={false} 
                                            className="mt-2" 
                                        />
                                    </div>

                                    {rubric.criteria.map((crit) => {
                                        const score = evaluation.criterion_scores.find(
                                            s => s.rubric_criteria_id === crit.id
                                        );
                                        const selectedLevel = score 
                                            ? crit.levels.find(l => l.id === score.rubric_level_id)
                                            : null;

                                        return (
                                            <div key={crit.id} className="border border-round p-3">
                                                <div className="flex justify-content-between align-items-start mb-2">
                                                    <div>
                                                        <h4 className="m-0 text-base font-semibold">{crit.name}</h4>
                                                        <p className="m-0 text-sm text-600">Máximo: {crit.max_points} pts</p>
                                                    </div>
                                                    <span className="font-bold text-blue-600">
                                                        {score?.points_awarded ?? 0} / {crit.max_points}
                                                    </span>
                                                </div>

                                                <div className="grid">
                                                    {crit.levels
                                                        .slice()
                                                        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                                                        .map((lvl) => (
                                                            <div key={lvl.id} className="col-12 md:col-6 flex align-items-start gap-2">
                                                                <RadioButton
                                                                    inputId={`crit-${crit.id}-lvl-${lvl.id}`}
                                                                    name={`crit-${crit.id}`}
                                                                    value={lvl.id}
                                                                    checked={selectedLevel?.id === lvl.id}
                                                                    disabled
                                                                />
                                                                <label htmlFor={`crit-${crit.id}-lvl-${lvl.id}`} className="flex flex-column">
                                                                    <span className={`font-semibold ${selectedLevel?.id === lvl.id ? 'text-blue-600' : ''}`}>
                                                                        {lvl.name}: {lvl.points} pts
                                                                    </span>
                                                                    <span className="text-sm text-600">{lvl.description}</span>
                                                                </label>
                                                            </div>
                                                        ))}
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {evaluation.notes && (
                                        <div className="flex flex-column gap-2">
                                            <label className="text-sm font-semibold text-700">Notas del terapeuta</label>
                                            <div className="surface-50 border-round p-3">
                                                <p className="m-0 text-800">{evaluation.notes}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </Card>
                        </div>
                    )}
                </div>
            )}

            {/* Modal de éxito */}
            <Dialog
                header="¡Entrega enviada!"
                visible={showSuccessModal}
                modal
                style={{ width: '26rem', maxWidth: '95vw' }}
                onHide={() => setShowSuccessModal(false)}
            >
                <div className="flex flex-column align-items-center gap-3 py-3">
                    <i className="pi pi-check-circle text-green-500" style={{ fontSize: '3rem' }} />
                    <p className="text-center m-0">
                        Tu entrega ha sido enviada correctamente. El terapeuta podrá revisarla pronto.
                    </p>
                    <Button
                        label="Entendido"
                        className="w-full"
                        onClick={() => setShowSuccessModal(false)}
                    />
                </div>
            </Dialog>

            {/* Modal de error */}
            <Dialog
                header="Error al enviar"
                visible={showErrorModal}
                modal
                style={{ width: '26rem', maxWidth: '95vw' }}
                onHide={() => setShowErrorModal(false)}
            >
                <div className="flex flex-column align-items-center gap-3 py-3">
                    <i className="pi pi-times-circle text-red-500" style={{ fontSize: '3rem' }} />
                    <p className="text-center m-0">
                        {modalErrorMsg}
                    </p>
                    <Button
                        label="Cerrar"
                        className="w-full p-button-outlined"
                        onClick={() => setShowErrorModal(false)}
                    />
                </div>
            </Dialog>

            {/* Modal de error genérico (no usado ahora) */}
            <Dialog
                header="Error"
                visible={!!errorMsg && !submitting}
                modal
                style={{ width: '26rem', maxWidth: '95vw' }}
                onHide={() => setErrorMsg(null)}
            >
                <p>{errorMsg}</p>
            </Dialog>

            {/* Modal: Ejercicio eliminado */}
            <Dialog
                header="Ejercicio eliminado"
                visible={exerciseDeletedModal}
                modal
                style={{ width: '26rem', maxWidth: '95vw' }}
                closable={false}
                onHide={() => {
                    setExerciseDeletedModal(false);
                    router.push(`/courses/${slug}`);
                }}
            >
                <div className="flex flex-column align-items-center gap-3 py-3">
                    <i className="pi pi-info-circle text-orange-500" style={{ fontSize: '3rem' }} />
                    <p className="text-center m-0">
                        El ejercicio en el que se encontrabas ha sido eliminado por tu terapeuta. Serás redirigido a la lista de ejercicios.
                    </p>
                    <Button
                        label="Aceptar"
                        className="w-full"
                        onClick={() => {
                            setExerciseDeletedModal(false);
                            router.push(`/courses/${slug}`);
                        }}
                    />
                </div>
            </Dialog>
        </div>
    );
};

export default CourseExerciseDetailPage;
