"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from 'primereact/button';
import { TabMenu } from 'primereact/tabmenu';
import { Tag } from 'primereact/tag';
import { ProgressBar } from 'primereact/progressbar';
import { Dialog } from 'primereact/dialog';
import PublishExerciseDialog from './PublishExerciseDialog';
import AudioPlayer from '../../exercises/AudioPlayer';
import { API_BASE } from '@/services/apiClient';
import {
    getMyCourses,
    getCourseJoinRequests,
    decideJoinRequest,
    getCourseStudents,
    removeCourseStudent,
    getCourseStudentsProgress,
    getCourseExercises,
    deleteCourseExercise,
    getStudentExercisesForCourse,
    Course,
    JoinRequest,
    StudentInCourse,
    StudentProgressSummary,
    CourseExercise,
    StudentExerciseStatus,
    SubmissionStatus,
} from '@/services/courses';
import { BackendUser } from '@/services/auth';
import { useWebSocket, WebSocketMessage } from '@/hooks/useWebSocket';

const AUDIO_BASE_URL = API_BASE;

type Role = 'THERAPIST' | 'STUDENT';
type StudentExerciseFilter = 'ALL' | 'PENDING' | 'DONE' | 'LATE';

// --- Tipos del backend para listados de entregas del terapeuta ---
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

// Codificamos "courseId:courseExerciseId" en base64 para no mostrar ids crudos
const encodeCourseExerciseSlug = (courseId: number, courseExerciseId: number) => {
    if (typeof window === 'undefined') return '';
    return window.btoa(`${courseId}:${courseExerciseId}`);
};

const CoursePage: React.FC = () => {
    const params = useParams();
    const router = useRouter();
    const slug = params?.slug as string; // join_code en la URL

    const [token, setToken] = useState<string | null>(null);
    const [role, setRole] = useState<Role | null>(null);
    const [studentId, setStudentId] = useState<number | null>(null);

    const [course, setCourse] = useState<Course | null>(null);
    const [loadingCourse, setLoadingCourse] = useState(true);

    const [activeTabIndex, setActiveTabIndex] = useState(0);

    // Datos terapeuta
    const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
    const [students, setStudents] = useState<StudentInCourse[]>([]);
    const [progressList, setProgressList] = useState<StudentProgressSummary[]>([]);
    const [exercises, setExercises] = useState<CourseExercise[]>([]);

    const [loadingRequests, setLoadingRequests] = useState(false);
    const [loadingStudents, setLoadingStudents] = useState(false);
    const [loadingProgress, setLoadingProgress] = useState(false);
    const [loadingExercises, setLoadingExercises] = useState(false);

    // Datos estudiante
    const [studentExercises, setStudentExercises] = useState<StudentExerciseStatus[]>([]);
    const [studentExerciseFilter, setStudentExerciseFilter] =
        useState<StudentExerciseFilter>('ALL');
    const [loadingStudentExercises, setLoadingStudentExercises] = useState(false);

    // UI
    const [copiedCode, setCopiedCode] = useState(false);
    const [publishVisible, setPublishVisible] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [deleteExerciseConfirmVisible, setDeleteExerciseConfirmVisible] = useState(false);
    const [exerciseToDelete, setExerciseToDelete] = useState<CourseExercise | null>(null);
    const [deletingExercise, setDeletingExercise] = useState(false);

    const showError = (msg: string) => setErrorMsg(msg);

    // WebSocket connection for real-time updates
    const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
        console.log('Received WebSocket message:', message);

        switch (message.type) {
            case 'exercise_published':
                // Add new exercise to list
                if (message.data && !exercises.some(ex => ex.id === message.data.id)) {
                    setExercises(prev => [message.data, ...prev]);
                }
                break;

            case 'exercise_deleted':
                // Remove exercise from list
                if (message.data?.course_exercise_id) {
                    setExercises(prev => prev.filter(ex => ex.id !== message.data.course_exercise_id));
                }
                break;

            case 'submission_created':
            case 'submission_updated':
                // Reload progress data for therapists
                if (role === 'THERAPIST' && course) {
                    getCourseStudentsProgress(token!, course.id)
                        .then(setProgressList)
                        .catch(console.error);
                }
                // Reload student exercises for students
                if (role === 'STUDENT' && course) {
                    getStudentExercisesForCourse(token!, course.id)
                        .then(setStudentExercises)
                        .catch(console.error);
                }
                break;

            case 'student_joined':
                // Add new student to list
                if (message.data && role === 'THERAPIST') {
                    getCourseStudents(token!, course!.id)
                        .then(setStudents)
                        .catch(console.error);
                }
                break;

            case 'student_removed':
                // Remove student from list
                if (message.data?.student_id) {
                    setStudents(prev => prev.filter(s => s.student_id !== message.data.student_id));
                }
                break;

            case 'join_request':
                // Add new join request
                if (message.data && role === 'THERAPIST') {
                    setJoinRequests(prev => [message.data, ...prev]);
                }
                break;
        }
    }, [exercises, role, course, token]);

    const { isConnected } = useWebSocket({
        courseId: course?.id || null,
        token,
        onMessage: handleWebSocketMessage,
        enabled: !!course && !!token,
    });

    const handleCopyCode = async () => {
        if (!course?.join_code) return;
        try {
            await navigator.clipboard.writeText(course.join_code);
            setCopiedCode(true);
            setTimeout(() => setCopiedCode(false), 2000);
        } catch (e) {
            console.error('No se pudo copiar el código', e);
        }
    };

    const handleDeletePublishedExercise = async () => {
        if (!exerciseToDelete || !token || !course) return;
        setDeletingExercise(true);
        try {
            await deleteCourseExercise(token, exerciseToDelete.id);
            // Reload exercises
            setLoadingExercises(true);
            const data = await getCourseExercises(token, course.id);
            setExercises(data.filter((ce) => !ce.is_deleted));
            setDeleteExerciseConfirmVisible(false);
            setExerciseToDelete(null);
        } catch (err: any) {
            console.error('Error eliminando ejercicio publicado:', err);
            showError(err?.message || 'No se pudo eliminar el ejercicio del curso.');
        } finally {
            setLoadingExercises(false);
            setDeletingExercise(false);
        }
    };

    const findCourseFromSlug = (courses: Course[], slug: string): Course | null => {
        const byCode = courses.find((c) => c.join_code === slug);
        if (byCode) return byCode;

        const numericId = Number(slug);
        if (!Number.isNaN(numericId)) {
            const byId = courses.find((c) => c.id === numericId);
            if (byId) return byId;
        }
        return null;
    };

    // Cargar token, usuario y curso
    const loadCourse = useCallback(
        async (authToken: string) => {
            try {
                setLoadingCourse(true);
                const data = await getMyCourses(authToken);
                const found = findCourseFromSlug(data, slug);

                if (!found) {
                    showError('Curso no encontrado.');
                    return;
                }

                setCourse(found);
            } catch (err) {
                console.error('Error de red al obtener curso:', err);
                showError('Error de red al obtener el curso.');
            } finally {
                setLoadingCourse(false);
            }
        },
        [slug]
    );

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const userRaw = window.localStorage.getItem('backend_user');
        if (userRaw) {
            try {
                const user = JSON.parse(userRaw) as BackendUser;
                setRole(user.role);
                if (user.role === 'STUDENT') {
                    setStudentId(user.id);
                }
            } catch {
                setRole(null);
            }
        }

        const storedToken = window.localStorage.getItem('backend_token');
        setToken(storedToken);

        if (storedToken) {
            loadCourse(storedToken);
        } else {
            setLoadingCourse(false);
            showError('No se encontró token de autenticación.');
        }
    }, [loadCourse]);

    // Fetch de datos de tabs según rol
    useEffect(() => {
        if (!course || !token || !role) return;

        const courseId = course.id;

        const fetchExercises = async () => {
            try {
                setLoadingExercises(true);
                const data = await getCourseExercises(token, courseId);
                setExercises(data.filter((ce) => !ce.is_deleted));
            } catch (err) {
                console.error('Error obteniendo ejercicios:', err);
            } finally {
                setLoadingExercises(false);
            }
        };

        if (role === 'THERAPIST') {
            const fetchRequests = async () => {
                try {
                    setLoadingRequests(true);
                    const data = await getCourseJoinRequests(token, courseId);
                    setJoinRequests(data);
                } catch (err) {
                    console.error('Error obteniendo solicitudes:', err);
                } finally {
                    setLoadingRequests(false);
                }
            };

            const fetchStudents = async () => {
                try {
                    setLoadingStudents(true);
                    const data = await getCourseStudents(token, courseId);
                    setStudents(data);
                } catch (err) {
                    console.error('Error obteniendo estudiantes:', err);
                } finally {
                    setLoadingStudents(false);
                }
            };

            const fetchProgress = async () => {
                try {
                    setLoadingProgress(true);
                    const data = await getCourseStudentsProgress(token, courseId);
                    setProgressList(data);
                } catch (err) {
                    console.error('Error obteniendo progreso:', err);
                } finally {
                    setLoadingProgress(false);
                }
            };

            fetchRequests();
            fetchStudents();
            fetchProgress();
            fetchExercises();
        } else if (role === 'STUDENT' && studentId != null) {
            const fetchStudentExercises = async () => {
                try {
                    setLoadingStudentExercises(true);
                    const data = await getStudentExercisesForCourse(token, courseId);
                    setStudentExercises(data);
                } catch (err) {
                    console.error('Error obteniendo ejercicios del estudiante:', err);
                } finally {
                    setLoadingStudentExercises(false);
                }
            };

            fetchExercises();
            fetchStudentExercises();
        }
    }, [course, token, role, studentId]);

    // ─────────────────────────────
    // Acciones terapeuta
    // ─────────────────────────────
    const updateJoinRequest = async (requestId: number, accept: boolean) => {
        if (!token || !course) return;
        try {
            await decideJoinRequest(token, course.id, requestId, accept);
            setJoinRequests((prev) => prev.filter((r) => r.id !== requestId));
        } catch (err: any) {
            console.error('Error actualizando solicitud:', err);
            showError(err?.message || 'No se pudo actualizar la solicitud.');
        }
    };

    const removeStudent = async (courseStudentId: number) => {
        if (!token || !course) return;
        if (!confirm('¿Eliminar a este estudiante del curso?')) return;
        try {
            await removeCourseStudent(token, course.id, courseStudentId);
            setStudents((prev) => prev.filter((s) => s.course_student_id !== courseStudentId));
        } catch (err: any) {
            console.error('Error eliminando estudiante:', err);
            showError(err?.message || 'No se pudo eliminar al estudiante.');
        }
    };

    // ─────────────────────────────
    // Tabs
    // ─────────────────────────────
    const therapistTabs = [
        { label: 'Solicitudes', icon: 'pi pi-users' },
        { label: 'Estudiantes', icon: 'pi pi-user' },
        { label: 'Ejercicios', icon: 'pi pi-book' },
        { label: 'Progreso', icon: 'pi pi-chart-bar' },
    ];

    const studentTabs = [{ label: 'Ejercicios', icon: 'pi pi-book' }];

    const tabItems = role === 'THERAPIST' ? therapistTabs : studentTabs;

    // ─────────────────────────────
    // Render tabs terapeuta
    // ─────────────────────────────
    const renderRequestsTab = () => {
        if (role !== 'THERAPIST') return null;

        if (loadingRequests) return <p>Cargando solicitudes...</p>;
        if (!joinRequests.length)
            return <p className="text-600">No hay solicitudes pendientes.</p>;

        return (
            <div className="grid">
                {joinRequests.map((r) => (
                    <div key={r.id} className="col-12 md:col-6">
                        <div className="card flex flex-column gap-2">
                            <div className="flex justify-content-between align-items-center">
                                <div>
                                    <h4 className="m-0 text-base font-semibold">
                                        Solicitud #{r.id}
                                    </h4>
                                    <p className="m-0 text-600 text-sm">
                                        Alumno ID: {r.student_id}
                                    </p>
                                </div>
                                <span className="text-700 text-sm">
                                    {new Date(r.created_at).toLocaleString()}
                                </span>
                            </div>
                            <div className="flex justify-content-end gap-2 mt-2">
                                <Button
                                    label="Rechazar"
                                    icon="pi pi-times"
                                    className="p-button-text p-button-danger"
                                    onClick={() => updateJoinRequest(r.id, false)}
                                />
                                <Button
                                    label="Aceptar"
                                    icon="pi pi-check"
                                    className="p-button-success"
                                    onClick={() => updateJoinRequest(r.id, true)}
                                />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    const renderStudentsTab = () => {
        if (role !== 'THERAPIST') return null;
        if (loadingStudents) return <p>Cargando estudiantes...</p>;
        if (!students.length)
            return (
                <p className="text-600">
                    Aún no hay estudiantes inscritos en este curso.
                </p>
            );

        return (
            <div className="grid">
                {students.map((s) => {
                    const total = s.total_exercises || 0;
                    const done = s.completed_exercises || 0;
                    const percent = total ? Math.round((done / total) * 100) : 0;

                    return (
                        <div key={s.course_student_id} className="col-12 md:col-6">
                            <div className="card flex flex-column gap-2">
                                <div className="flex justify-content-between align-items-center">
                                    <div>
                                        <h4 className="m-0 text-base font-semibold">
                                            {s.student_name}
                                        </h4>
                                        <p className="m-0 text-600 text-sm">
                                            ID estudiante: {s.student_id}
                                        </p>
                                    </div>
                                    <Tag
                                        value={`${done}/${total}`}
                                        severity={
                                            percent >= 70
                                                ? 'success'
                                                : percent >= 40
                                                    ? 'warning'
                                                    : 'danger'
                                        }
                                    />
                                </div>

                                <ProgressBar value={percent} showValue={false} />

                                <p className="m-0 text-600 text-sm">
                                    Última entrega:{' '}
                                    {s.last_submission_at
                                        ? new Date(
                                            s.last_submission_at
                                        ).toLocaleString()
                                        : 'Sin entregas aún'}
                                </p>

                                <div className="flex justify-content-end mt-2">
                                    <Button
                                        icon="pi pi-user-minus"
                                        className="p-button-text p-button-danger"
                                        label="Eliminar del curso"
                                        onClick={() =>
                                            removeStudent(s.course_student_id)
                                        }
                                    />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    const renderTherapistExercisesTab = () => {
        if (role !== 'THERAPIST') return null;
        if (loadingExercises) return <p>Cargando ejercicios...</p>;

        return (
            <>
                <div className="flex justify-content-between align-items-center mb-3">
                    <div className="flex gap-2">
                        <Button
                            icon="pi pi-share-alt"
                            label="Publicar ejercicio"
                            onClick={() => setPublishVisible(true)}
                        />
                        <Button
                            icon="pi pi-plus"
                            label="Crear ejercicio nuevo"
                            className="p-button-text"
                            onClick={() => router.push('/exercises/create')}
                        />
                    </div>
                </div>

                {!exercises.length ? (
                    <p className="text-600">
                        Aún no se han publicado ejercicios en este curso.
                    </p>
                ) : (
                    <div className="grid">
                        {exercises.map((ce) => (
                            <div key={ce.id} className="col-12 md:col-6">
                                <div className="card flex flex-column gap-2 h-full">
                                    <div className="flex justify-content-between align-items-start">
                                        <div>
                                            <h4 className="m-0 text-base font-semibold">
                                                {ce.exercise?.name || 'Ejercicio'}
                                            </h4>
                                            <p className="m-0 text-600 text-sm">
                                                Publicado:{' '}
                                                {new Date(
                                                    ce.published_at
                                                ).toLocaleString()}
                                            </p>
                                            {ce.due_date && (
                                                <p className="m-0 text-600 text-sm">
                                                    Fecha límite:{' '}
                                                    {new Date(
                                                        ce.due_date
                                                    ).toLocaleString()}
                                                </p>
                                            )}
                                        </div>
                                        <i className="pi pi-book text-2xl text-500" />
                                    </div>

                                    {ce.exercise?.text && (
                                        <p className="m-0 text-sm text-700 line-height-3">
                                            {ce.exercise.text.length > 140
                                                ? ce.exercise.text.slice(0, 140) +
                                                '…'
                                                : ce.exercise.text}
                                        </p>
                                    )}

                                    <div className="flex justify-content-between align-items-center mt-2">
                                        <Button
                                            label="Ver detalles / entregas"
                                            icon="pi pi-arrow-right"
                                            className="p-button-text"
                                            onClick={() => {
                                                router.push(`/courses/${slug}/exercises/${ce.id}`);
                                            }}
                                        />
                                        <Button
                                            icon="pi pi-trash"
                                            className="p-button-text p-button-danger"
                                            tooltip="Eliminar del curso"
                                            tooltipOptions={{ position: 'top' }}
                                            onClick={() => {
                                                setExerciseToDelete(ce);
                                                setDeleteExerciseConfirmVisible(true);
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </>
        );
    };

    const renderProgressTab = () => {
        if (role !== 'THERAPIST') return null;
        if (loadingProgress) return <p>Cargando progreso...</p>;
        if (!progressList.length)
            return (
                <p className="text-600">
                    Aún no hay datos de progreso para este curso.
                </p>
            );

        return (
            <div className="card p-0 overflow-auto">
                <table className="w-full">
                    <thead>
                        <tr className="text-left text-sm text-600">
                            <th className="p-3">Estudiante</th>
                            <th className="p-3">Email</th>
                            <th className="p-3">Completados</th>
                            <th className="p-3">% Avance</th>
                            <th className="p-3">Última entrega</th>
                            <th className="p-3 text-right">Acción</th>
                        </tr>
                    </thead>
                    <tbody>
                        {progressList.map((p) => {
                            const total = p.total_exercises || 0;
                            const done = p.done_exercises || 0;
                            const percent = total
                                ? Math.round((done / total) * 100)
                                : 0;

                            const severity =
                                percent >= 70
                                    ? 'success'
                                    : percent >= 40
                                        ? 'warning'
                                        : 'danger';

                            const severityColor =
                                severity === 'success'
                                    ? '#16a34a'
                                    : severity === 'warning'
                                        ? '#f59e0b'
                                        : '#ef4444';

                            return (
                                <tr 
                                    key={p.student_id} 
                                    className="text-sm cursor-pointer hover:surface-100"
                                    onClick={() => router.push(`/courses/${slug}/students/${p.student_id}`)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <td className="p-3 font-medium text-800">
                                        {p.full_name}
                                    </td>
                                    <td className="p-3 text-700">{p.email}</td>
                                    <td className="p-3 text-700">
                                        {done}/{total}
                                    </td>
                                    <td className="p-3">
                                        <div className="flex align-items-center gap-2">
                                            <div
                                                style={{
                                                    flex: 1,
                                                    height: '0.5rem',
                                                    borderRadius: '999px',
                                                    background: '#e5e7eb',
                                                    overflow: 'hidden',
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        width: `${percent}%`,
                                                        height: '100%',
                                                        background: severityColor,
                                                    }}
                                                />
                                            </div>
                                            <span className="text-700">
                                                {percent}%
                                            </span>
                                        </div>
                                    </td>
                                    <td className="p-3 text-700">
                                        {p.last_submission_at
                                            ? new Date(
                                                p.last_submission_at
                                            ).toLocaleString()
                                            : 'Sin entregas'}
                                    </td>
                                    <td className="p-3 text-right">
                                        <Button
                                            icon="pi pi-arrow-right"
                                            className="p-button-text p-button-sm"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                router.push(`/courses/${slug}/students/${p.student_id}`);
                                            }}
                                        />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        );
    };

    // ─────────────────────────────
    // Render tab de ejercicios para ESTUDIANTE
    // ─────────────────────────────
    const filteredStudentExercises = (() => {
        const now = new Date();

        return studentExercises.filter((ex) => {
            const due = ex.due_date ? new Date(ex.due_date) : null;
            const isLate = ex.status === 'PENDING' && due && due < now;

            switch (studentExerciseFilter) {
                case 'PENDING':
                    return ex.status === 'PENDING' && !isLate;
                case 'DONE':
                    return ex.status === 'DONE';
                case 'LATE':
                    return isLate;
                default:
                    return true;
            }
        });
    })();

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

    const renderStudentExercisesTab = () => {
        if (role !== 'STUDENT') return null;

        if (loadingExercises || loadingStudentExercises) {
            return <p>Cargando ejercicios...</p>;
        }

        if (!studentExercises.length) {
            return (
                <p className="text-600">
                    Aún no tienes ejercicios asignados en este curso.
                </p>
            );
        }

        const filters: { key: StudentExerciseFilter; label: string }[] = [
            { key: 'ALL', label: 'Todos' },
            { key: 'PENDING', label: 'Pendientes' },
            { key: 'DONE', label: 'Entregados' },
            { key: 'LATE', label: 'Retrasados' },
        ];

        return (
            <>
                <div className="flex flex-wrap gap-2 mb-3">
                    {filters.map((f) => (
                        <Button
                            key={f.key}
                            label={f.label}
                            className={
                                studentExerciseFilter === f.key
                                    ? ''
                                    : 'p-button-text'
                            }
                            onClick={() => setStudentExerciseFilter(f.key)}
                        />
                    ))}
                </div>

                {!filteredStudentExercises.length ? (
                    <p className="text-600">
                        No hay ejercicios en esta categoría.
                    </p>
                ) : (
                    <div className="grid">
                        {filteredStudentExercises.map((ex) => {
                            const ce = exercises.find(
                                (c) => c.id === ex.course_exercise_id
                            );
                            const textPreview = ce?.exercise?.text ?? '';

                            return (
                                <div
                                    key={ex.course_exercise_id}
                                    className="col-12 md:col-6"
                                >
                                    <div className="card flex flex-column gap-2 h-full">
                                        <div className="flex justify-content-between align-items-start">
                                            <div>
                                                <h4 className="m-0 text-base font-semibold">
                                                    {ex.exercise_name}
                                                </h4>
                                                {ex.due_date && (
                                                    <p className="m-0 text-600 text-sm">
                                                        Fecha límite:{' '}
                                                        {new Date(
                                                            ex.due_date
                                                        ).toLocaleString()}
                                                    </p>
                                                )}
                                                {ex.submitted_at && (
                                                    <p className="m-0 text-600 text-sm">
                                                        Entregado:{' '}
                                                        {new Date(
                                                            ex.submitted_at
                                                        ).toLocaleString()}
                                                    </p>
                                                )}
                                            </div>
                                            {statusTag(ex.status, ex.due_date)}
                                        </div>

                                        {textPreview && (
                                            <p className="m-0 text-sm text-700 line-height-3">
                                                {textPreview.length > 140
                                                    ? textPreview.slice(0, 140) +
                                                    '…'
                                                    : textPreview}
                                            </p>
                                        )}

                                        <div className="flex justify-content-end mt-2">
                                            <Button
                                                label="Ver detalle / entregar"
                                                icon="pi pi-arrow-right"
                                                className="p-button-text"
                                                onClick={() => {
                                                    if (!course) return;
                                                    const exerciseSlug =
                                                        encodeCourseExerciseSlug(
                                                            course.id,
                                                            ex.course_exercise_id
                                                        );
                                                    router.push(
                                                        `/courses/${params.slug}/${exerciseSlug}`
                                                    );
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </>
        );
    };

    // ─────────────────────────────
    // Render principal
    // ─────────────────────────────
    if (loadingCourse || !course || !role) {
        return (
            <div
                className="flex justify-content-center align-items-center"
                style={{ minHeight: '60vh' }}
            >
                <div className="text-center">
                    <i className="pi pi-spin pi-spinner" style={{ fontSize: '2rem' }} />
                    <p className="mt-3">Cargando curso...</p>
                </div>

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
    }

    // helper para audio de submission
    const getSubmissionAudioSrc = (sub?: SubmissionOut | null) => {
        if (!sub?.audio_path) return null;
        const normalized = sub.audio_path.replace(/\\/g, '/');
        return sub.audio_path.startsWith('http')
            ? sub.audio_path
            : `${AUDIO_BASE_URL}/media/${normalized}`;
    };

    return (
        <div className="surface-ground" style={{ minHeight: '60vh' }}>
            {/* Encabezado del curso */}
            <div className="card border-none mb-3" style={{ borderRadius: '1.5rem' }}>
                <div
                    className="p-3 md:p-4"
                    style={{
                        borderRadius: '1.25rem',
                        background:
                            'linear-gradient(135deg,#4f46e5 0%,#8b5cf6 40%,#0ea5e9 100%)',
                        color: '#f9fafb',
                    }}
                >
                    <div className="flex justify-content-between align-items-start flex-wrap gap-3">
                        <div style={{ maxWidth: '32rem' }}>
                            <h1 className="m-0 text-2xl md:text-3xl font-semibold tracking-tight">
                                {course.name}
                            </h1>
                            {course.description && (
                                <p
                                    className="m-0 mt-2 text-sm md:text-base"
                                    style={{ opacity: 0.96 }}
                                >
                                    {course.description.length > 160
                                        ? course.description.slice(0, 160) + '…'
                                        : course.description}
                                </p>
                            )}
                        </div>

                        <div className="flex flex-column align-items-end gap-2">
                            <div className="flex align-items-center gap-2">
                                <span className="text-xs text-indigo-100">
                                    Código de curso
                                </span>
                                {isConnected && (
                                    <Tag 
                                        value="En vivo" 
                                        severity="success" 
                                        icon="pi pi-circle-fill"
                                        className="text-xs"
                                        style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}
                                    />
                                )}
                            </div>
                            <div className="flex align-items-center gap-2">
                                <span
                                    className="px-3 py-2 border-round-xl text-lg font-semibold bg-indigo-100"
                                    style={{
                                        color: '#4f46e5',
                                        letterSpacing: '0.08em',
                                    }}
                                >
                                    {course.join_code}
                                </span>
                                <Button
                                    icon={copiedCode ? 'pi pi-check' : 'pi pi-copy'}
                                    className="p-button-text p-button-sm p-button-rounded"
                                    onClick={handleCopyCode}
                                    tooltip={copiedCode ? 'Copiado' : 'Copiar código'}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs principales (depende de rol) */}
            <div className="card">
                <TabMenu
                    model={tabItems}
                    activeIndex={activeTabIndex}
                    onTabChange={(e) => setActiveTabIndex(e.index)}
                    className="mb-4"
                />

                {/* Terapeuta */}
                {role === 'THERAPIST' && (
                    <>
                        {activeTabIndex === 0 && renderRequestsTab()}
                        {activeTabIndex === 1 && renderStudentsTab()}
                        {activeTabIndex === 2 && renderTherapistExercisesTab()}
                        {activeTabIndex === 3 && renderProgressTab()}
                    </>
                )}

                {/* Estudiante */}
                {role === 'STUDENT' &&
                    activeTabIndex === 0 &&
                    renderStudentExercisesTab()}
            </div>

            {/* Modal publicar ejercicio (solo terapeuta) */}
            {role === 'THERAPIST' && course && token && (
                <PublishExerciseDialog
                    visible={publishVisible}
                    onHide={() => setPublishVisible(false)}
                    token={token}
                    courseId={course.id}
                    publishedExerciseIds={exercises.map((ce) => ce.exercise_id)}
                    onPublished={() => {
                        window.location.reload();
                    }}
                />
            )}

            {/* Modal error global */}
            <Dialog
                header="Error"
                visible={!!errorMsg}
                modal
                style={{ width: '26rem', maxWidth: '95vw' }}
                onHide={() => setErrorMsg(null)}
            >
                <p>{errorMsg}</p>
            </Dialog>

            {/* Modal de confirmación de eliminación de ejercicio publicado */}
            <Dialog
                header="Confirmar eliminación"
                visible={deleteExerciseConfirmVisible}
                modal
                style={{ width: '28rem', maxWidth: '95vw' }}
                onHide={() => !deletingExercise && setDeleteExerciseConfirmVisible(false)}
            >
                <div className="flex flex-column gap-3">
                    <div className="flex align-items-center gap-3">
                        <i className="pi pi-exclamation-triangle text-yellow-500" style={{ fontSize: '2rem' }} />
                        <div>
                            <p className="m-0 font-semibold">¿Estás seguro de eliminar este ejercicio del curso?</p>
                            {exerciseToDelete && (
                                <p className="m-0 mt-1 text-sm text-600">
                                    {exerciseToDelete.exercise?.name || 'Ejercicio'}
                                </p>
                            )}
                        </div>
                    </div>
                    <p className="text-sm text-600 m-0">
                        Esta acción no se puede deshacer. Los estudiantes ya no podrán ver ni entregar este ejercicio.
                    </p>
                    <div className="flex justify-content-end gap-2 mt-2">
                        <Button
                            label="Cancelar"
                            className="p-button-text"
                            onClick={() => setDeleteExerciseConfirmVisible(false)}
                            disabled={deletingExercise}
                        />
                        <Button
                            label="Eliminar"
                            icon="pi pi-trash"
                            className="p-button-danger"
                            onClick={handleDeletePublishedExercise}
                            loading={deletingExercise}
                        />
                    </div>
                </div>
            </Dialog>
        </div>
    );
};

export default CoursePage;
