'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from 'primereact/button';
import { Tag } from 'primereact/tag';
import { ProgressBar } from 'primereact/progressbar';
import { Dialog } from 'primereact/dialog';
import AudioPlayer from '../../../../exercises/AudioPlayer';
import { API_BASE } from '@/services/apiClient';
import { BackendUser, Role } from '@/services/auth';
import { StudentExerciseStatus, SubmissionStatus } from '@/services/courses';

const AUDIO_BASE_URL = API_BASE;

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

interface StudentInfo {
    id: number;
    full_name: string;
    email: string;
}

const StudentProgressPage: React.FC = () => {
    const params = useParams() as { slug: string; studentId: string };
    const { slug, studentId } = params;
    const router = useRouter();

    const [token, setToken] = useState<string | null>(null);
    const [role, setRole] = useState<Role | null>(null);
    const [courseId, setCourseId] = useState<number | null>(null);

    const [studentInfo, setStudentInfo] = useState<StudentInfo | null>(null);
    const [exercises, setExercises] = useState<StudentExerciseStatus[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Modal de detalle de entrega
    const [submissionDetailVisible, setSubmissionDetailVisible] = useState(false);
    const [selectedExercise, setSelectedExercise] = useState<StudentExerciseStatus | null>(null);
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

    // Cargar datos del estudiante y sus ejercicios
    useEffect(() => {
        if (!token || !role || role !== 'THERAPIST' || !studentId) {
            setLoading(false);
            return;
        }

        const loadData = async () => {
            try {
                setLoading(true);

                // Obtener el curso por el slug
                const resCourses = await fetch(`${API_BASE}/courses/my`, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (!resCourses.ok) {
                    setErrorMsg('No se pudo cargar el curso.');
                    return;
                }

                const courses = await resCourses.json();
                const foundCourse = courses.find(
                    (c: any) => c.join_code === slug || c.id === Number(slug)
                );

                if (!foundCourse) {
                    setErrorMsg('Curso no encontrado.');
                    return;
                }

                setCourseId(foundCourse.id);

                // Cargar información del estudiante
                const resStudents = await fetch(
                    `${API_BASE}/courses/${foundCourse.id}/students`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );

                if (resStudents.ok) {
                    const studentsList = await resStudents.json();
                    const student = studentsList.find(
                        (s: any) => s.student_id === Number(studentId)
                    );

                    if (student) {
                        setStudentInfo({
                            id: student.student_id,
                            full_name: student.student_name,
                            email: '', // No tenemos email en este endpoint
                        });
                    }
                }

                // Cargar ejercicios del estudiante
                const resExercises = await fetch(
                    `${API_BASE}/submissions/courses/${foundCourse.id}/students/${studentId}/exercises-status`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );

                if (resExercises.ok) {
                    const data: StudentExerciseStatus[] = await resExercises.json();
                    setExercises(data);
                } else {
                    const text = await resExercises.text();
                    console.error('Error cargando ejercicios:', text);
                    setErrorMsg('No se pudieron cargar los ejercicios del estudiante.');
                }
            } catch (err) {
                console.error('Error de red:', err);
                setErrorMsg('Error de red al cargar los datos.');
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [token, role, studentId, slug]);

    // Cargar detalle de entrega cuando se selecciona un ejercicio
    useEffect(() => {
        if (!submissionDetailVisible || !selectedExercise || !token || role !== 'THERAPIST') {
            return;
        }

        const loadDetail = async () => {
            try {
                setSubmissionDetailError(null);
                setLoadingSubmissionDetail(true);
                const res = await fetch(
                    `${API_BASE}/submissions/course-exercises/${selectedExercise.course_exercise_id}/students/${studentId}`,
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
    }, [submissionDetailVisible, selectedExercise, token, role, studentId]);

    const getSubmissionAudioSrc = (sub?: SubmissionOut | null) => {
        if (!sub?.audio_path) return null;
        const normalized = sub.audio_path.replace(/\\/g, '/');
        return sub.audio_path.startsWith('http')
            ? sub.audio_path
            : `${AUDIO_BASE_URL}/media/${normalized}`;
    };

    const statusTag = (status: SubmissionStatus, dueDate?: string | null) => {
        const now = new Date();
        const due = dueDate ? new Date(dueDate) : null;
        const isLate = status === 'PENDING' && due && due < now;

        if (status === 'DONE') {
            return <Tag value="Entregado" severity="success" />;
        }
        if (isLate) {
            return <Tag value="Retrasado" severity="danger" />;
        }
        return <Tag value="Pendiente" severity="warning" />;
    };

    if (loading) {
        return (
            <div className="flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
                <div className="text-center">
                    <i className="pi pi-spin pi-spinner" style={{ fontSize: '2rem' }} />
                    <p className="mt-3">Cargando progreso del estudiante...</p>
                </div>
            </div>
        );
    }

    if (!token || role !== 'THERAPIST' || !studentInfo) {
        return (
            <div className="surface-ground p-3 md:p-4" style={{ minHeight: '60vh' }}>
                <div className="card p-4 border-round-2xl">
                    <h2 className="text-xl font-semibold mb-2">No se pudo cargar la información</h2>
                    <p className="text-600 m-0">
                        Comprueba que has iniciado sesión como terapeuta y vuelve a intentarlo.
                    </p>
                </div>
            </div>
        );
    }

    const completedExercises = exercises.filter((e) => e.status === 'DONE');
    const pendingExercises = exercises.filter((e) => e.status === 'PENDING');
    const lateExercises = pendingExercises.filter((e) => {
        if (!e.due_date) return false;
        return new Date(e.due_date) < new Date();
    });

    const progressPercent = exercises.length
        ? Math.round((completedExercises.length / exercises.length) * 100)
        : 0;

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
            </div>

            {/* Header del estudiante */}
            <div className="card mb-3 border-none" style={{ borderRadius: '1.5rem' }}>
                <div
                    className="p-3 md:p-4"
                    style={{
                        borderRadius: '1.25rem',
                        background: 'linear-gradient(135deg,#10b981 0%,#22c55e 100%)',
                        color: '#f9fafb',
                    }}
                >
                    <div className="flex justify-content-between align-items-start gap-3 flex-wrap">
                        <div>
                            <h1 className="m-0 text-2xl md:text-3xl font-semibold">
                                {studentInfo.full_name}
                            </h1>
                            <p className="m-0 mt-1 text-sm md:text-base opacity-90">
                                Progreso del estudiante
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="m-0 text-xs opacity-80">Avance general</p>
                            <p className="m-0 text-3xl font-bold">{progressPercent}%</p>
                            <p className="m-0 text-sm">
                                {completedExercises.length} de {exercises.length} ejercicios
                            </p>
                        </div>
                    </div>

                    <div className="mt-3">
                        <ProgressBar
                            value={progressPercent}
                            showValue={false}
                            style={{ height: '0.75rem', borderRadius: '999px' }}
                        />
                    </div>
                </div>
            </div>

            {/* Resumen */}
            <div className="grid mb-3">
                <div className="col-12 md:col-4">
                    <div className="card text-center">
                        <i className="pi pi-check-circle text-4xl mb-2" style={{ color: '#10b981' }} />
                        <h3 className="text-2xl font-bold m-0">{completedExercises.length}</h3>
                        <p className="text-600 text-sm m-0">Ejercicios completados</p>
                    </div>
                </div>
                <div className="col-12 md:col-4">
                    <div className="card text-center">
                        <i className="pi pi-clock text-4xl mb-2" style={{ color: '#f59e0b' }} />
                        <h3 className="text-2xl font-bold m-0">{pendingExercises.length}</h3>
                        <p className="text-600 text-sm m-0">Ejercicios pendientes</p>
                    </div>
                </div>
                <div className="col-12 md:col-4">
                    <div className="card text-center">
                        <i className="pi pi-exclamation-triangle text-4xl mb-2" style={{ color: '#ef4444' }} />
                        <h3 className="text-2xl font-bold m-0">{lateExercises.length}</h3>
                        <p className="text-600 text-sm m-0">Ejercicios retrasados</p>
                    </div>
                </div>
            </div>

            {/* Lista de ejercicios */}
            <div className="card">
                <h3 className="text-lg font-semibold mb-3">Todos los ejercicios</h3>

                {!exercises.length ? (
                    <p className="text-center text-600">No hay ejercicios asignados en este curso.</p>
                ) : (
                    <div className="flex flex-column gap-2">
                        {exercises.map((ex) => {
                            const now = new Date();
                            const due = ex.due_date ? new Date(ex.due_date) : null;
                            const isLate = ex.status === 'PENDING' && due && due < now;

                            return (
                                <div
                                    key={ex.course_exercise_id}
                                    className="surface-50 border-round-lg p-3 flex justify-content-between align-items-center gap-3"
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="flex align-items-center gap-2 mb-1">
                                            <p className="m-0 font-semibold text-base">{ex.exercise_name}</p>
                                            {statusTag(ex.status, ex.due_date)}
                                        </div>
                                        <div className="flex flex-wrap gap-3 text-xs text-600">
                                            {ex.due_date && (
                                                <span>
                                                    <i className="pi pi-calendar mr-1" />
                                                    Fecha límite: {new Date(ex.due_date).toLocaleString()}
                                                </span>
                                            )}
                                            {ex.submitted_at && (
                                                <span>
                                                    <i className="pi pi-check mr-1" />
                                                    Entregado: {new Date(ex.submitted_at).toLocaleString()}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        {ex.status === 'DONE' ? (
                                            <Button
                                                icon="pi pi-eye"
                                                label="Ver entrega"
                                                className="p-button-sm"
                                                onClick={() => {
                                                    setSelectedExercise(ex);
                                                    setSubmissionDetailVisible(true);
                                                }}
                                            />
                                        ) : (
                                            <Tag
                                                value="Sin entrega"
                                                severity={isLate ? 'danger' : 'warning'}
                                            />
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Modal detalle de entrega */}
            <Dialog
                header="Detalle de entrega"
                visible={submissionDetailVisible}
                modal
                style={{ width: '80vw', maxWidth: '900px' }}
                onHide={() => {
                    setSubmissionDetailVisible(false);
                    setSelectedExercise(null);
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
                    <p>No hay datos de entrega para este ejercicio.</p>
                ) : (
                    <div className="flex flex-column gap-3">
                        <div className="surface-50 border-round-lg p-3">
                            <h4 className="text-base font-semibold mb-2">Ejercicio</h4>
                            <p className="m-0 font-medium">{selectedExercise?.exercise_name}</p>
                        </div>

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

export default StudentProgressPage;
