'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from 'primereact/button';
import { Tag } from 'primereact/tag';
import { Dialog } from 'primereact/dialog';
import { InputTextarea } from 'primereact/inputtextarea';
import AudioPlayer from '../../../../exercises/AudioPlayer';
import { API_BASE } from '@/services/apiClient';
import { BackendUser, Role } from '@/services/auth';
import { ExerciseOut } from '@/services/exercises';
import { CourseExercise, SubmissionStatus } from '@/services/courses';

const AUDIO_BASE_URL = API_BASE;

interface SubmissionListItem {
    student_id: number;
    full_name: string;
    email: string;
    submission_id?: number | null;
    status?: SubmissionStatus | null;
    has_audio?: boolean;
    audio_path?: string | null;
    submitted_at?: string | null;
}

interface SubmissionOut {
    id: number;
    student_id: number;
    course_exercise_id: number;
    status: SubmissionStatus;
    audio_path?: string | null;
    created_at: string;
    updated_at: string;
}

interface SubmissionDetailOut {
    submission: SubmissionOut;
    student: {
        id: number;
        full_name: string;
        email: string;
        role: Role;
        created_at: string;
    };
}

const TherapistExerciseDetailPage: React.FC = () => {
    const params = useParams() as { slug: string; exerciseId: string };
    const { slug, exerciseId } = params;
    const router = useRouter();

    const [token, setToken] = useState<string | null>(null);
    const [role, setRole] = useState<Role | null>(null);

    const [courseExercise, setCourseExercise] = useState<CourseExercise | null>(null);
    const [students, setStudents] = useState<SubmissionListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingStudents, setLoadingStudents] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [showExerciseText, setShowExerciseText] = useState(true);

    // Modal de detalle de entrega
    const [submissionDetailVisible, setSubmissionDetailVisible] = useState(false);
    const [selectedSubmission, setSelectedSubmission] = useState<{
        course_exercise_id: number;
        student_id: number;
    } | null>(null);
    const [submissionDetail, setSubmissionDetail] = useState<SubmissionDetailOut | null>(null);
    const [loadingSubmissionDetail, setLoadingSubmissionDetail] = useState(false);
    const [submissionDetailError, setSubmissionDetailError] = useState<string | null>(null);

    // Cargar token y role
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const userRaw = window.localStorage.getItem('backend_user');
        if (userRaw) {
            try {
                const user = JSON.parse(userRaw) as BackendUser;
                setRole(user.role);
            } catch {
                setRole(null);
            }
        }

        const storedToken = window.localStorage.getItem('backend_token');
        setToken(storedToken);
    }, []);

    // Cargar ejercicio y estudiantes
    useEffect(() => {
        if (!token || !role || role !== 'THERAPIST' || !exerciseId) {
            setLoading(false);
            return;
        }

        const loadData = async () => {
            try {
                setLoading(true);

                // Primero necesitamos obtener el courseId del slug
                const resCourses = await fetch(
                    `${API_BASE}/courses/my`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );

                if (!resCourses.ok) {
                    setErrorMsg('No se pudo cargar el curso.');
                    return;
                }

                const courses = await resCourses.json();
                const foundCourse = courses.find((c: any) => c.join_code === slug || c.id === Number(slug));
                
                if (!foundCourse) {
                    setErrorMsg('Curso no encontrado.');
                    return;
                }

                // Cargar ejercicios del curso
                const resExercises = await fetch(
                    `${API_BASE}/course-exercises/${foundCourse.id}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );

                if (resExercises.ok) {
                    const list: CourseExercise[] = await resExercises.json();
                    const found = list.find((ce) => ce.id === Number(exerciseId));
                    if (found) {
                        setCourseExercise(found);
                    } else {
                        setErrorMsg('Ejercicio no encontrado.');
                        return;
                    }
                } else {
                    console.error('Error obteniendo ejercicio:', await resExercises.text());
                    setErrorMsg('No se pudo cargar el ejercicio.');
                    return;
                }

                // Cargar lista de estudiantes con sus entregas
                setLoadingStudents(true);
                const resStudents = await fetch(
                    `${API_BASE}/submissions/course-exercises/${exerciseId}/students`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );

                if (resStudents.ok) {
                    const data: SubmissionListItem[] = await resStudents.json();
                    setStudents(data);
                } else {
                    console.error('Error cargando estudiantes:', await resStudents.text());
                }
                setLoadingStudents(false);
            } catch (err) {
                console.error('Error de red:', err);
                setErrorMsg('Error de red al cargar los datos.');
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [token, role, exerciseId, slug]);

    // Cargar detalle de entrega cuando se selecciona un estudiante
    useEffect(() => {
        if (!submissionDetailVisible || !selectedSubmission || !token || role !== 'THERAPIST') {
            return;
        }

        const loadDetail = async () => {
            try {
                setSubmissionDetailError(null);
                setLoadingSubmissionDetail(true);
                const res = await fetch(
                    `${API_BASE}/submissions/course-exercises/${selectedSubmission.course_exercise_id}/students/${selectedSubmission.student_id}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                if (!res.ok) {
                    const text = await res.text();
                    console.error('Error obteniendo detalle de entrega:', text);
                    setSubmissionDetailError(text || 'No se pudo cargar el detalle de la entrega.');
                    return;
                }
                const data: SubmissionDetailOut = await res.json();
                setSubmissionDetail(data);
            } catch (err) {
                console.error('Error de red al obtener detalle de entrega:', err);
                setSubmissionDetailError('Error de red al cargar la entrega.');
            } finally {
                setLoadingSubmissionDetail(false);
            }
        };

        loadDetail();
    }, [submissionDetailVisible, selectedSubmission, token, role]);

    const getSubmissionAudioSrc = (sub?: SubmissionOut | null) => {
        if (!sub?.audio_path) return null;
        const normalized = sub.audio_path.replace(/\\/g, '/');
        return sub.audio_path.startsWith('http')
            ? sub.audio_path
            : `${AUDIO_BASE_URL}/media/${normalized}`;
    };

    if (loading) {
        return (
            <div className="flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
                <div className="text-center">
                    <i className="pi pi-spin pi-spinner" style={{ fontSize: '2rem' }} />
                    <p className="mt-3">Cargando ejercicio...</p>
                </div>
            </div>
        );
    }

    if (!token || role !== 'THERAPIST' || !courseExercise) {
        return (
            <div className="surface-ground p-3 md:p-4" style={{ minHeight: '60vh' }}>
                <div className="card p-4 border-round-2xl">
                    <h2 className="text-xl font-semibold mb-2">No se pudo cargar el ejercicio</h2>
                    <p className="text-600 m-0">
                        Comprueba que has iniciado sesión como terapeuta y vuelve a intentarlo.
                    </p>
                </div>
            </div>
        );
    }

    const exercise = courseExercise.exercise;
    const text = exercise?.text ?? '';
    const title = exercise?.name ?? 'Ejercicio';

    let audioSrc: string | null = null;
    if (exercise?.audio_path) {
        const normalized = exercise.audio_path.replace(/\\/g, '/');
        audioSrc = exercise.audio_path.startsWith('http')
            ? exercise.audio_path
            : `${AUDIO_BASE_URL}/media/${normalized}`;
    }

    const studentsWithSubmission = students.filter(s => s.submission_id);
    const studentsWithoutSubmission = students.filter(s => !s.submission_id);

    return (
        <div className="surface-ground p-3 md:p-4" style={{ minHeight: '60vh' }}>
            {/* Barra superior: volver */}
            <div className="flex justify-content-between align-items-center mb-3">
                <Button
                    type="button"
                    icon="pi pi-arrow-left"
                    className="p-button-text p-button-rounded"
                    label="Volver al curso"
                    onClick={() => router.push(`/courses/${slug}`)}
                />

                <div className="flex align-items-center gap-2">
                    <Tag value={`${studentsWithSubmission.length}/${students.length} entregados`} severity="info" />
                </div>
            </div>

            {/* Header del ejercicio */}
            <div className="card mb-3 border-none" style={{ borderRadius: '1.5rem' }}>
                <div
                    className="p-3 md:p-4"
                    style={{
                        borderRadius: '1.25rem',
                        background: 'linear-gradient(135deg,#4f46e5 0%,#8b5cf6 40%,#0ea5e9 100%)',
                        color: '#f9fafb',
                    }}
                >
                    <div className="flex justify-content-between align-items-start gap-3 flex-wrap">
                        <div>
                            <h1 className="m-0 text-2xl md:text-3xl font-semibold">{title}</h1>
                            {exercise?.prompt && (
                                <p className="m-0 mt-2 text-sm md:text-base opacity-90">
                                    <span className="font-medium">Objetivo: </span>
                                    {exercise.prompt}
                                </p>
                            )}
                        </div>
                        {courseExercise.due_date && (
                            <div className="text-right">
                                <p className="m-0 text-xs opacity-80">Fecha límite</p>
                                <p className="m-0 text-sm font-medium">
                                    {new Date(courseExercise.due_date).toLocaleString()}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Contenido principal */}
            <div className="flex flex-column lg:flex-row gap-3">
                {/* Columna izquierda: Texto + Audio */}
                <div className="flex-1 flex flex-column gap-3">
                    <div className="card">
                        <div className="flex justify-content-between align-items-center mb-3">
                            <h3 className="text-lg font-semibold m-0">Texto del ejercicio</h3>
                            <Button
                                icon={showExerciseText ? 'pi pi-eye-slash' : 'pi pi-eye'}
                                label={showExerciseText ? 'Ocultar' : 'Mostrar'}
                                className="p-button-text p-button-sm"
                                onClick={() => setShowExerciseText(!showExerciseText)}
                            />
                        </div>

                        {showExerciseText && (
                            <div className="surface-50 border-round-lg p-3" style={{ minHeight: '10rem' }}>
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
                        )}
                    </div>

                    {audioSrc && (
                        <div className="card">
                            <h3 className="text-lg font-semibold mb-2">Audio de referencia</h3>
                            <AudioPlayer src={audioSrc} />
                        </div>
                    )}
                </div>

                {/* Columna derecha: Lista de entregas */}
                <div className="card" style={{ width: '100%', maxWidth: '520px', alignSelf: 'flex-start' }}>
                    <h3 className="text-lg font-semibold mb-3">Entregas de estudiantes</h3>

                    {loadingStudents ? (
                        <p className="text-center text-600">Cargando entregas...</p>
                    ) : students.length === 0 ? (
                        <p className="text-center text-600">No hay estudiantes inscritos en este curso.</p>
                    ) : (
                        <div className="flex flex-column gap-2">
                            {/* Estudiantes con entrega */}
                            {studentsWithSubmission.length > 0 && (
                                <>
                                    <h4 className="text-sm font-semibold text-600 mb-2">Con entrega ({studentsWithSubmission.length})</h4>
                                    {studentsWithSubmission.map((s) => (
                                        <div
                                            key={s.student_id}
                                            className="surface-50 border-round-lg p-3 flex justify-content-between align-items-center gap-3"
                                        >
                                            <div className="flex-1 min-w-0">
                                                <p className="m-0 font-semibold text-sm">{s.full_name}</p>
                                                <p className="m-0 text-xs text-600 truncate">{s.email}</p>
                                                {s.submitted_at && (
                                                    <p className="m-0 text-xs text-500 mt-1">
                                                        {new Date(s.submitted_at).toLocaleString()}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="flex align-items-center gap-2">
                                                {s.has_audio && (
                                                    <Tag icon="pi pi-microphone" value="Audio" severity="success" />
                                                )}
                                                <Button
                                                    icon="pi pi-eye"
                                                    label="Ver"
                                                    className="p-button-sm"
                                                    onClick={() => {
                                                        setSelectedSubmission({
                                                            course_exercise_id: Number(exerciseId),
                                                            student_id: s.student_id,
                                                        });
                                                        setSubmissionDetailVisible(true);
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </>
                            )}

                            {/* Estudiantes sin entrega */}
                            {studentsWithoutSubmission.length > 0 && (
                                <>
                                    <h4 className="text-sm font-semibold text-600 mb-2 mt-3">Sin entrega ({studentsWithoutSubmission.length})</h4>
                                    {studentsWithoutSubmission.map((s) => (
                                        <div
                                            key={s.student_id}
                                            className="surface-100 border-round-lg p-3 flex justify-content-between align-items-center gap-3 opacity-60"
                                        >
                                            <div className="flex-1 min-w-0">
                                                <p className="m-0 font-semibold text-sm">{s.full_name}</p>
                                                <p className="m-0 text-xs text-600 truncate">{s.email}</p>
                                            </div>
                                            <Tag value="Pendiente" severity="warning" />
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Modal detalle de entrega */}
            <Dialog
                header="Detalle de entrega"
                visible={submissionDetailVisible}
                modal
                style={{ width: '80vw', maxWidth: '900px' }}
                onHide={() => {
                    setSubmissionDetailVisible(false);
                    setSelectedSubmission(null);
                    setSubmissionDetail(null);
                    setSubmissionDetailError(null);
                }}
            >
                {submissionDetailError && (
                    <p className="p-error text-sm mb-3">{submissionDetailError}</p>
                )}

                {loadingSubmissionDetail ? (
                    <p>Cargando detalle de la entrega...</p>
                ) : !submissionDetail ? (
                    <p>No hay datos de entrega para este estudiante.</p>
                ) : (
                    <div className="flex flex-column gap-3">
                        <div className="surface-50 border-round-lg p-3">
                            <h4 className="text-base font-semibold mb-2">Información del estudiante</h4>
                            <div className="flex flex-column gap-2">
                                <div className="flex align-items-center gap-2">
                                    <i className="pi pi-user text-600" />
                                    <span className="font-medium">{submissionDetail.student.full_name}</span>
                                </div>
                                <div className="flex align-items-center gap-2">
                                    <i className="pi pi-envelope text-600" />
                                    <span className="text-sm text-600">{submissionDetail.student.email}</span>
                                </div>
                            </div>
                        </div>

                        <div className="surface-50 border-round-lg p-3">
                            <h4 className="text-base font-semibold mb-2">Detalles de la entrega</h4>
                            <div className="flex flex-column gap-2">
                                <div className="flex justify-content-between">
                                    <span className="text-600">Estado:</span>
                                    <Tag
                                        value={submissionDetail.submission.status === 'DONE' ? 'Entregado' : 'Pendiente'}
                                        severity={submissionDetail.submission.status === 'DONE' ? 'success' : 'warning'}
                                    />
                                </div>
                                <div className="flex justify-content-between">
                                    <span className="text-600">Fecha de entrega:</span>
                                    <span className="font-medium">
                                        {new Date(submissionDetail.submission.updated_at).toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {submissionDetail.submission.audio_path && (
                            <div className="surface-50 border-round-lg p-3">
                                <h4 className="text-base font-semibold mb-2">Audio de la entrega</h4>
                                <AudioPlayer src={getSubmissionAudioSrc(submissionDetail.submission) || ''} />
                            </div>
                        )}
                    </div>
                )}
            </Dialog>

            {/* Modal error */}
            <Dialog
                header="Error"
                visible={!!errorMsg}
                modal
                style={{ width: '26rem', maxWidth: '95vw' }}
                onHide={() => setErrorMsg(null)}
            >
                <p>{errorMsg}</p>
            </Dialog>
        </div>
    );
};

export default TherapistExerciseDetailPage;
