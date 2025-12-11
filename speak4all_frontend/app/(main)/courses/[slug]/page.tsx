"use client";

import React, { useCallback, useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from 'primereact/button';
import { TabMenu } from 'primereact/tabmenu';
import { Tag } from 'primereact/tag';
import { ProgressBar } from 'primereact/progressbar';
import { Avatar } from 'primereact/avatar';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { InputNumber } from 'primereact/inputnumber';
import { Calendar } from 'primereact/calendar';
import { Dropdown } from 'primereact/dropdown';
import { Paginator, PaginatorPageChangeEvent } from 'primereact/paginator';
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
import { useExerciseNotifications } from '@/contexts/ExerciseNotificationContext';

const AUDIO_BASE_URL = API_BASE;

// El backend ahora devuelve URLs firmadas de Google Cloud Storage directamente
const buildAvatarUrl = (path?: string | null) => {
    // Si es null o undefined, no hay avatar
    if (!path) return null;
    // Si ya es una URL completa (http/https), devolverla tal cual
    if (path.startsWith('http')) return path;
    // Si es una ruta relativa del backend (por compatibilidad con almacenamiento local)
    const normalized = path.startsWith('/') ? path : `/${path}`;
    return `${API_BASE}${normalized}`;
};

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
    const [requestStatusFilter, setRequestStatusFilter] = useState<'PENDING' | 'ACCEPTED' | 'REJECTED' | 'ALL'>('PENDING');
    const [requestFromDate, setRequestFromDate] = useState<Date | null>(null);
    const [requestToDate, setRequestToDate] = useState<Date | null>(null);
    const [showRequestsFilters, setShowRequestsFilters] = useState(true);
    // Paginación - Solicitudes (terapeuta)
    const [requestsPage, setRequestsPage] = useState(0);
    const [requestsPageSize, setRequestsPageSize] = useState(10);
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

    // Paginación y filtros - Pestaña Estudiantes (tarjetas)
    const [studentsPage, setStudentsPage] = useState(0);
    const [studentsPageSize, setStudentsPageSize] = useState(10);
    const [studentsNameFilter, setStudentsNameFilter] = useState('');
    const [studentsProgressMin, setStudentsProgressMin] = useState<number | null>(null);
    const [studentsProgressMax, setStudentsProgressMax] = useState<number | null>(null);
    const [studentsLastSubmissionFrom, setStudentsLastSubmissionFrom] = useState<Date | null>(null);
    const [studentsLastSubmissionTo, setStudentsLastSubmissionTo] = useState<Date | null>(null);

    // Paginación y filtros - Pestaña Ejercicios Terapeuta
    const [therapistExercisesPage, setTherapistExercisesPage] = useState(0);
    const [therapistExercisesPageSize, setTherapistExercisesPageSize] = useState(10);
    const [therapistExercisesNameFilter, setTherapistExercisesNameFilter] = useState('');
    const [therapistExercisesTextFilter, setTherapistExercisesTextFilter] = useState('');
    const [therapistExercisesPublishedFrom, setTherapistExercisesPublishedFrom] = useState<Date | null>(null);
    const [therapistExercisesPublishedTo, setTherapistExercisesPublishedTo] = useState<Date | null>(null);

    // Paginación y filtros - Pestaña Progreso (tabla)
    const [progressPage, setProgressPage] = useState(0);
    const [progressPageSize, setProgressPageSize] = useState(10);
    const [progressNameFilter, setProgressNameFilter] = useState('');
    const [progressEmailFilter, setProgressEmailFilter] = useState('');
    const [progressMin, setProgressMin] = useState<number | null>(null);
    const [progressMax, setProgressMax] = useState<number | null>(null);
    const [progressLastSubmissionFrom, setProgressLastSubmissionFrom] = useState<Date | null>(null);
    const [progressLastSubmissionTo, setProgressLastSubmissionTo] = useState<Date | null>(null);

    // Paginación y filtros - Ejercicios Estudiante
    const [studentExercisesPage, setStudentExercisesPage] = useState(0);
    const [studentExercisesPageSize, setStudentExercisesPageSize] = useState(10);
    const [studentExercisesNameFilter, setStudentExercisesNameFilter] = useState('');
    const [studentExercisesTextFilter, setStudentExercisesTextFilter] = useState('');
    const [studentExercisesPublishedFrom, setStudentExercisesPublishedFrom] = useState<Date | null>(null);
    const [studentExercisesPublishedTo, setStudentExercisesPublishedTo] = useState<Date | null>(null);
    const [studentExercisesWithAudio, setStudentExercisesWithAudio] = useState<'all' | 'with' | 'without'>('all');

    // Estados para mostrar/ocultar filtros
    const [showStudentsFilters, setShowStudentsFilters] = useState(true);
    const [showTherapistExercisesFilters, setShowTherapistExercisesFilters] = useState(true);
    const [showProgressFilters, setShowProgressFilters] = useState(true);
    const [showStudentExercisesFilters, setShowStudentExercisesFilters] = useState(true);

    const showError = (msg: string) => setErrorMsg(msg);

    // Debounce para recargar progreso
    const progressReloadTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const reloadProgressWithDebounce = useCallback((authToken: string, courseId: number) => {
        if (progressReloadTimeoutRef.current) {
            clearTimeout(progressReloadTimeoutRef.current);
        }

        progressReloadTimeoutRef.current = setTimeout(async () => {
            try {
                const data = await getCourseStudentsProgress(authToken, courseId);
                setProgressList(data);
            } catch (err) {
                console.error('Error reloading progress:', err);
            }
        }, 500);
    }, []);

    // ─────────────────────────────
    // Solicitudes (fetch + filtros)
    // ─────────────────────────────
    const fetchRequests = useCallback(async () => {
        if (!token || !course) return;
        try {
            setLoadingRequests(true);
            const data = await getCourseJoinRequests(token, course.id, {
                status: requestStatusFilter,
                from_date: requestFromDate ? requestFromDate.toISOString() : undefined,
                to_date: requestToDate ? requestToDate.toISOString() : undefined,
            });
            setJoinRequests(data);
        } catch (err) {
            console.error('Error obteniendo solicitudes:', err);
        } finally {
            setLoadingRequests(false);
        }
    }, [token, course, requestStatusFilter, requestFromDate, requestToDate]);

    // WebSocket connection for real-time updates
    const { addNotification, triggerRefresh } = useExerciseNotifications();
    const roleRef = useRef(role);
    const courseRef = useRef(course);
    
    // Keep refs in sync
    useEffect(() => {
        roleRef.current = role;
        courseRef.current = course;
    }, [role, course]);
    
    const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
        switch (message.type) {
            case 'exercise_published':
                // Add new exercise to list
                if (message.data) {
                    setExercises(prev => {
                        if (prev.some(ex => ex.id === message.data.id)) {
                            return prev;
                        }
                        return [message.data, ...prev];
                    });
                    
                    // Notify students
                    if (roleRef.current === 'STUDENT' && courseRef.current) {
                        addNotification({
                            courseId: courseRef.current.id,
                            exerciseId: message.data.course_exercise_id || message.data.id,
                            courseSlug: slug,
                            courseName: message.data.course_name,
                            exerciseName: message.data.exercise_name || message.data.name || 'Nuevo ejercicio',
                            therapistName: message.data.therapist_name,
                            summary: 'Nuevo ejercicio',
                            detail: `${message.data.therapist_name || 'El terapeuta'} ha publicado "${message.data.exercise_name || message.data.name || 'Nuevo ejercicio'}" en el curso "${message.data.course_name || 'Curso'}"`,
                        });
                        triggerRefresh(courseRef.current.id);
                    }
                }
                break;

            case 'exercise_deleted':
                // Remove exercise from list and notify
                if (message.data?.course_exercise_id) {
                    setExercises(prev => prev.filter(ex => ex.id !== message.data.course_exercise_id));

                    // Keep student exercise list in sync immediately
                    if (roleRef.current === 'STUDENT') {
                        setStudentExercises(prev =>
                            prev.filter((ex) => ex.course_exercise_id !== message.data.course_exercise_id)
                        );
                    }

                    // Notify students
                    if (roleRef.current === 'STUDENT' && courseRef.current) {
                        addNotification({
                            courseId: courseRef.current.id,
                            exerciseId: message.data.course_exercise_id || message.data.id,
                            courseSlug: slug,
                            courseName: message.data.course_name,
                            exerciseName: message.data.exercise_name || message.data.name || 'Ejercicio',
                            therapistName: message.data.therapist_name,
                            summary: 'Ejercicio eliminado',
                            detail: `${message.data.therapist_name || 'El terapeuta'} eliminó "${message.data.exercise_name || 'Ejercicio'}" del curso "${message.data.course_name || 'Curso'}"`,
                            severity: 'warn',
                        });
                        triggerRefresh(courseRef.current.id);
                    }
                }
                break;

            case 'submission_created':
            case 'submission_updated':
            case 'submission_deleted':
                // Reload progress data for therapists
                if (roleRef.current === 'THERAPIST' && courseRef.current && token) {
                    reloadProgressWithDebounce(token, courseRef.current.id);
                    // También recargar la lista de estudiantes para refrescar barra y última entrega
                    getCourseStudents(token, courseRef.current.id)
                        .then(setStudents)
                        .catch(console.error);
                }
                // Reload student exercises for students
                if (roleRef.current === 'STUDENT' && courseRef.current && token) {
                    getStudentExercisesForCourse(token, courseRef.current.id)
                        .then(setStudentExercises)
                        .catch(console.error);
                }
                break;

            case 'student_joined':
                // Reload students list
                if (roleRef.current === 'THERAPIST' && courseRef.current && token) {
                    getCourseStudents(token, courseRef.current.id)
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
                // Recargar solicitudes con filtros actuales
                if (message.data && roleRef.current === 'THERAPIST' && token && courseRef.current) {
                    fetchRequests();
                }
                break;
        }
    }, [token, reloadProgressWithDebounce, addNotification, triggerRefresh, fetchRequests]);

    const { isConnected } = useWebSocket({
        courseId: course?.id || null,
        token,
        onMessage: handleWebSocketMessage,
        enabled: !!course && !!token,
    });

    // Listen for refresh triggers (e.g., new exercise published)
    const { refreshTrigger } = useExerciseNotifications();
    
    useEffect(() => {
        if (!refreshTrigger || !courseRef.current || !token) return;

        // Only reload if the refresh is for this course
        if (refreshTrigger.courseId !== courseRef.current.id) return;

        // Reload exercises for students (full list + status list)
        if (roleRef.current === 'STUDENT') {
            setLoadingExercises(true);
            setLoadingStudentExercises(true);

            Promise.all([
                getCourseExercises(token, courseRef.current.id),
                getStudentExercisesForCourse(token, courseRef.current.id),
            ])
                .then(([data, studentData]) => {
                    setExercises(data.filter((ce) => !ce.is_deleted));
                    setStudentExercises(studentData);
                })
                .catch(console.error)
                .finally(() => {
                    setLoadingExercises(false);
                    setLoadingStudentExercises(false);
                });
        }
    }, [refreshTrigger, token]);

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
                const data = await getMyCourses(authToken, 1, 1000);
                const found = findCourseFromSlug(data.items, slug);

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
    }, [course, token, role, studentId, fetchRequests]);

    // ─────────────────────────────
    // Acciones terapeuta
    // ─────────────────────────────
    const updateJoinRequest = async (requestId: number, accept: boolean) => {
        if (!token || !course) return;
        try {
            await decideJoinRequest(token, course.id, requestId, accept);
            await fetchRequests();
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

        // Paginación cliente para solicitudes
        const totalRequests = joinRequests.length;
        const startIndex = requestsPage * requestsPageSize;
        const endIndex = startIndex + requestsPageSize;
        const paginatedRequests = joinRequests.slice(startIndex, endIndex);

        const statusOptions = [
            { label: 'Pendientes', value: 'PENDING' },
            { label: 'Aceptadas', value: 'ACCEPTED' },
            { label: 'Rechazadas', value: 'REJECTED' },
            { label: 'Todas', value: 'ALL' },
        ];

        const statusLabel: Record<string, string> = {
            PENDING: 'Pendiente',
            ACCEPTED: 'Aceptada',
            REJECTED: 'Rechazada',
        };

        const statusSeverity: Record<string, "success" | "warning" | "danger" | "info"> = {
            PENDING: 'warning',
            ACCEPTED: 'success',
            REJECTED: 'danger',
        };

        return (
            <>
                {/* Botón toggle filtros */}
                <div className="flex justify-content-end mb-2">
                    <Button
                        label={showRequestsFilters ? 'Ocultar filtros' : 'Mostrar filtros'}
                        icon={showRequestsFilters ? 'pi pi-eye-slash' : 'pi pi-filter'}
                        className="p-button-text p-button-sm"
                        onClick={() => setShowRequestsFilters(!showRequestsFilters)}
                    />
                </div>

                {showRequestsFilters && (
                <div className="card mb-3">
                    <div className="flex flex-wrap gap-3 align-items-end">
                        <div className="flex flex-column gap-2" style={{ minWidth: 200 }}>
                            <label className="text-sm text-600">Estado</label>
                            <Dropdown
                                value={requestStatusFilter}
                                options={statusOptions}
                                optionLabel="label"
                                optionValue="value"
                                onChange={(e) => setRequestStatusFilter(e.value)}
                                className="w-full"
                            />
                        </div>
                        <div className="flex flex-column gap-2" style={{ minWidth: 200 }}>
                            <label className="text-sm text-600">Desde</label>
                            <Calendar
                                value={requestFromDate}
                                onChange={(e) => setRequestFromDate(e.value as Date | null)}
                                dateFormat="dd/mm/yy"
                                showIcon
                                className="w-full"
                            />
                        </div>
                        <div className="flex flex-column gap-2" style={{ minWidth: 200 }}>
                            <label className="text-sm text-600">Hasta</label>
                            <Calendar
                                value={requestToDate}
                                onChange={(e) => setRequestToDate(e.value as Date | null)}
                                dateFormat="dd/mm/yy"
                                showIcon
                                className="w-full"
                            />
                        </div>
                        <div className="flex gap-2">
                            
                            <Button
                                label="Limpiar"
                                icon="pi pi-filter-slash"
                                className="p-button-text"
                                onClick={() => {
                                    setRequestStatusFilter('PENDING');
                                    setRequestFromDate(null);
                                    setRequestToDate(null);
                                }}
                                disabled={
                                    requestStatusFilter === 'PENDING' && !requestFromDate && !requestToDate
                                }
                            />
                        </div>
                    </div>
                </div>
                )}

                {!joinRequests.length && (
                    <p className="text-600">No hay solicitudes para los filtros seleccionados.</p>
                )}

                <div className="grid">
                    {paginatedRequests.map((r) => (
                        <div key={r.id} className="col-12 md:col-6">
                            <div className="card flex flex-column gap-2">
                                <div className="flex justify-content-between align-items-start gap-3">
                                    <div className="flex align-items-center gap-3">
                                        <Avatar
                                            image={(r.student_avatar_url || buildAvatarUrl(r.student_avatar_path)) || undefined}
                                            label={!(r.student_avatar_url || buildAvatarUrl(r.student_avatar_path)) ? (r.student_full_name || 'Alumno').charAt(0).toUpperCase() : undefined}
                                            shape="circle"
                                            size="large"
                                        />
                                        <div className="flex flex-column gap-1">
                                            <div className="flex align-items-center gap-2 flex-wrap">
                                                <h4 className="m-0 text-base font-semibold">
                                                    {r.student_full_name || `Alumno #${r.student_id}`}
                                                </h4>
                                                <Tag value={`Solicitud #${r.id}`} severity="info" />
                                                <Tag
                                                    value={statusLabel[r.status] || r.status}
                                                    severity={statusSeverity[r.status] || 'info'}
                                                />
                                            </div>
                                            <p className="m-0 text-600 text-sm">
                                                {r.student_email || `ID: ${r.student_id}`}
                                            </p>
                                            <p className="m-0 text-500 text-xs">
                                                Enviada: {new Date(r.created_at).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-content-end gap-2 mt-2 flex-wrap">
                                    <Button
                                        label="Rechazar"
                                        icon="pi pi-times"
                                        className="p-button-text p-button-danger"
                                        onClick={() => updateJoinRequest(r.id, false)}
                                        disabled={r.status === 'REJECTED' || r.status === 'ACCEPTED'}
                                    />
                                    <Button
                                        label={r.status === 'REJECTED' ? 'Aceptar (rehabilitar)' : 'Aceptar'}
                                        icon="pi pi-check"
                                        className="p-button-success"
                                        onClick={() => updateJoinRequest(r.id, true)}
                                        disabled={r.status === 'ACCEPTED'}
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Paginación */}
                {totalRequests > requestsPageSize && (
                    <div className="card mt-3">
                        <Paginator
                            first={startIndex}
                            rows={requestsPageSize}
                            totalRecords={totalRequests}
                            onPageChange={(e: PaginatorPageChangeEvent) => {
                                const nextPage = Math.floor((e.first ?? 0) / (e.rows ?? requestsPageSize));
                                setRequestsPage(nextPage);
                                setRequestsPageSize(e.rows ?? requestsPageSize);
                            }}
                        />
                    </div>
                )}
            </>
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

        // Filtrar estudiantes
        let filteredStudents = students.filter((s) => {
            // Filtro por nombre
            if (studentsNameFilter && !s.student_name.toLowerCase().includes(studentsNameFilter.toLowerCase())) {
                return false;
            }

            // Filtro por progreso
            const total = s.total_exercises || 0;
            const done = s.completed_exercises || 0;
            const percent = total ? Math.round((done / total) * 100) : 0;
            
            if (studentsProgressMin !== null && percent < studentsProgressMin) {
                return false;
            }
            if (studentsProgressMax !== null && percent > studentsProgressMax) {
                return false;
            }

            // Filtro por fecha de última entrega
            if (s.last_submission_at) {
                const submissionDate = new Date(s.last_submission_at);
                if (studentsLastSubmissionFrom && submissionDate < studentsLastSubmissionFrom) {
                    return false;
                }
                if (studentsLastSubmissionTo && submissionDate > studentsLastSubmissionTo) {
                    return false;
                }
            }

            return true;
        });

        // Paginación
        const totalStudents = filteredStudents.length;
        const startIndex = studentsPage * studentsPageSize;
        const endIndex = startIndex + studentsPageSize;
        const paginatedStudents = filteredStudents.slice(startIndex, endIndex);

        return (
            <>
                {/* Botón toggle filtros */}
                <div className="flex justify-content-end mb-2">
                    <Button
                        label={showStudentsFilters ? 'Ocultar filtros' : 'Mostrar filtros'}
                        icon={showStudentsFilters ? 'pi pi-eye-slash' : 'pi pi-filter'}
                        className="p-button-text p-button-sm"
                        onClick={() => setShowStudentsFilters(!showStudentsFilters)}
                    />
                </div>

                {/* Filtros */}
                {showStudentsFilters && (
                    <div className="card mb-3">
                        <h4 className="text-base font-semibold mb-3">Filtros</h4>
                        <div className="grid">
                        <div className="col-12 md:col-3">
                            <label className="block text-sm font-medium mb-2">Nombre</label>
                            <InputText
                                value={studentsNameFilter}
                                onChange={(e) => {
                                    setStudentsNameFilter(e.target.value);
                                    setStudentsPage(0);
                                }}
                                placeholder="Buscar por nombre"
                                className="w-full"
                            />
                        </div>
                        <div className="col-12 md:col-2">
                            <label className="block text-sm font-medium mb-2">Progreso mín (%)</label>
                            <InputNumber
                                value={studentsProgressMin}
                                onValueChange={(e) => {
                                    setStudentsProgressMin(e.value ?? null);
                                    setStudentsPage(0);
                                }}
                                placeholder="0"
                                min={0}
                                max={100}
                                className="w-full"
                            />
                        </div>
                        <div className="col-12 md:col-2">
                            <label className="block text-sm font-medium mb-2">Progreso máx (%)</label>
                            <InputNumber
                                value={studentsProgressMax}
                                onValueChange={(e) => {
                                    setStudentsProgressMax(e.value ?? null);
                                    setStudentsPage(0);
                                }}
                                placeholder="100"
                                min={0}
                                max={100}
                                className="w-full"
                            />
                        </div>
                        <div className="col-12 md:col-2">
                            <label className="block text-sm font-medium mb-2">Última entrega desde</label>
                            <Calendar
                                value={studentsLastSubmissionFrom}
                                onChange={(e) => {
                                    setStudentsLastSubmissionFrom(e.value as Date | null);
                                    setStudentsPage(0);
                                }}
                                showIcon
                                dateFormat="dd/mm/yy"
                                placeholder="Fecha inicial"
                                className="w-full"
                            />
                        </div>
                        <div className="col-12 md:col-2">
                            <label className="block text-sm font-medium mb-2">Última entrega hasta</label>
                            <Calendar
                                value={studentsLastSubmissionTo}
                                onChange={(e) => {
                                    setStudentsLastSubmissionTo(e.value as Date | null);
                                    setStudentsPage(0);
                                }}
                                showIcon
                                dateFormat="dd/mm/yy"
                                placeholder="Fecha final"
                                className="w-full"
                            />
                        </div>
                        <div className="col-12 md:col-1 flex align-items-end">
                            <Button
                                label="Limpiar"
                                icon="pi pi-filter-slash"
                                className="p-button-text"
                                onClick={() => {
                                    setStudentsNameFilter('');
                                    setStudentsProgressMin(null);
                                    setStudentsProgressMax(null);
                                    setStudentsLastSubmissionFrom(null);
                                    setStudentsLastSubmissionTo(null);
                                    setStudentsPage(0);
                                }}
                            />
                        </div>
                    </div>
                </div>
                )}

                <div className="grid">
                    {paginatedStudents.map((s) => {
                        const total = s.total_exercises || 0;
                        const done = s.completed_exercises || 0;
                        const percent = total ? Math.round((done / total) * 100) : 0;
                        const avatarUrl = buildAvatarUrl(s.avatar_path);

                        return (
                            <div key={s.course_student_id} className="col-12 md:col-6">
                                <div className="card flex flex-column gap-2">
                                    <div className="flex justify-content-between align-items-center gap-3">
                                        <div className="flex align-items-center gap-3">
                                            <Avatar
                                                {...(avatarUrl ? { image: avatarUrl } : { label: s.student_name?.charAt(0).toUpperCase() })}
                                                shape="circle"
                                                size="large"
                                            />
                                            <div>
                                                <h4 className="m-0 text-base font-semibold">
                                                    {s.student_name}
                                                </h4>
                                                <p className="m-0 text-600 text-sm">
                                                    ID estudiante: {s.student_id}
                                                </p>
                                            </div>
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

                {/* Paginación */}
                <Paginator
                    first={studentsPage * studentsPageSize}
                    rows={studentsPageSize}
                    totalRecords={totalStudents}
                    rowsPerPageOptions={[5, 10, 20, 50]}
                    onPageChange={(e: PaginatorPageChangeEvent) => {
                        setStudentsPage(e.page);
                        setStudentsPageSize(e.rows);
                    }}
                    className="mt-3"
                />
            </>
        );
    };

    const renderTherapistExercisesTab = () => {
        if (role !== 'THERAPIST') return null;
        if (loadingExercises) return <p>Cargando ejercicios...</p>;

        // Filtrar ejercicios
        let filteredExercises = exercises.filter((ce) => {
            // Filtro por nombre
            if (therapistExercisesNameFilter && !ce.exercise?.name?.toLowerCase().includes(therapistExercisesNameFilter.toLowerCase())) {
                return false;
            }

            // Filtro por texto
            if (therapistExercisesTextFilter && !ce.exercise?.text?.toLowerCase().includes(therapistExercisesTextFilter.toLowerCase())) {
                return false;
            }

            // Filtro por fecha de publicación
            if (ce.published_at) {
                const publishedDate = new Date(ce.published_at);
                if (therapistExercisesPublishedFrom && publishedDate < therapistExercisesPublishedFrom) {
                    return false;
                }
                if (therapistExercisesPublishedTo && publishedDate > therapistExercisesPublishedTo) {
                    return false;
                }
            }

            return true;
        });

        // Paginación
        const totalExercises = filteredExercises.length;
        const startIndex = therapistExercisesPage * therapistExercisesPageSize;
        const endIndex = startIndex + therapistExercisesPageSize;
        const paginatedExercises = filteredExercises.slice(startIndex, endIndex);

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

                {/* Botón toggle filtros */}
                <div className="flex justify-content-end mb-2">
                    <Button
                        label={showTherapistExercisesFilters ? 'Ocultar filtros' : 'Mostrar filtros'}
                        icon={showTherapistExercisesFilters ? 'pi pi-eye-slash' : 'pi pi-filter'}
                        className="p-button-text p-button-sm"
                        onClick={() => setShowTherapistExercisesFilters(!showTherapistExercisesFilters)}
                    />
                </div>

                {/* Filtros */}
                {showTherapistExercisesFilters && (
                    <div className="card mb-3">
                        <h4 className="text-base font-semibold mb-3">Filtros</h4>
                    <div className="grid">
                        <div className="col-12 md:col-3">
                            <label className="block text-sm font-medium mb-2">Nombre/Título</label>
                            <InputText
                                value={therapistExercisesNameFilter}
                                onChange={(e) => {
                                    setTherapistExercisesNameFilter(e.target.value);
                                    setTherapistExercisesPage(0);
                                }}
                                placeholder="Buscar por nombre"
                                className="w-full"
                            />
                        </div>
                        <div className="col-12 md:col-3">
                            <label className="block text-sm font-medium mb-2">Texto del ejercicio</label>
                            <InputText
                                value={therapistExercisesTextFilter}
                                onChange={(e) => {
                                    setTherapistExercisesTextFilter(e.target.value);
                                    setTherapistExercisesPage(0);
                                }}
                                placeholder="Buscar en texto"
                                className="w-full"
                            />
                        </div>
                        <div className="col-12 md:col-2">
                            <label className="block text-sm font-medium mb-2">Publicado desde</label>
                            <Calendar
                                value={therapistExercisesPublishedFrom}
                                onChange={(e) => {
                                    setTherapistExercisesPublishedFrom(e.value as Date | null);
                                    setTherapistExercisesPage(0);
                                }}
                                showIcon
                                dateFormat="dd/mm/yy"
                                placeholder="Fecha inicial"
                                className="w-full"
                            />
                        </div>
                        <div className="col-12 md:col-2">
                            <label className="block text-sm font-medium mb-2">Publicado hasta</label>
                            <Calendar
                                value={therapistExercisesPublishedTo}
                                onChange={(e) => {
                                    setTherapistExercisesPublishedTo(e.value as Date | null);
                                    setTherapistExercisesPage(0);
                                }}
                                showIcon
                                dateFormat="dd/mm/yy"
                                placeholder="Fecha final"
                                className="w-full"
                            />
                        </div>
                        <div className="col-12 md:col-2 flex align-items-end">
                            <Button
                                label="Limpiar"
                                icon="pi pi-filter-slash"
                                className="p-button-text"
                                onClick={() => {
                                    setTherapistExercisesNameFilter('');
                                    setTherapistExercisesTextFilter('');
                                    setTherapistExercisesPublishedFrom(null);
                                    setTherapistExercisesPublishedTo(null);
                                    setTherapistExercisesPage(0);
                                }}
                            />
                        </div>
                    </div>
                </div>
                )}

                {!paginatedExercises.length ? (
                    <p className="text-600">
                        {exercises.length === 0
                            ? 'Aún no se han publicado ejercicios en este curso.'
                            : 'No se encontraron ejercicios con los filtros aplicados.'}
                    </p>
                ) : (
                    <div className="grid">
                        {paginatedExercises.map((ce) => (
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

                {/* Paginación */}
                {totalExercises > 0 && (
                    <Paginator
                        first={therapistExercisesPage * therapistExercisesPageSize}
                        rows={therapistExercisesPageSize}
                        totalRecords={totalExercises}
                        rowsPerPageOptions={[5, 10, 20, 50]}
                        onPageChange={(e: PaginatorPageChangeEvent) => {
                            setTherapistExercisesPage(e.page);
                            setTherapistExercisesPageSize(e.rows);
                        }}
                        className="mt-3"
                    />
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

        // Filtrar progreso
        let filteredProgress = progressList.filter((p) => {
            // Filtro por nombre
            if (progressNameFilter && !p.full_name.toLowerCase().includes(progressNameFilter.toLowerCase())) {
                return false;
            }

            // Filtro por email
            if (progressEmailFilter && !p.email.toLowerCase().includes(progressEmailFilter.toLowerCase())) {
                return false;
            }

            // Filtro por progreso
            const total = p.total_exercises || 0;
            const done = p.done_exercises || 0;
            const percent = total ? Math.round((done / total) * 100) : 0;
            
            if (progressMin !== null && percent < progressMin) {
                return false;
            }
            if (progressMax !== null && percent > progressMax) {
                return false;
            }

            // Filtro por fecha de última entrega
            if (p.last_submission_at) {
                const submissionDate = new Date(p.last_submission_at);
                if (progressLastSubmissionFrom && submissionDate < progressLastSubmissionFrom) {
                    return false;
                }
                if (progressLastSubmissionTo && submissionDate > progressLastSubmissionTo) {
                    return false;
                }
            }

            return true;
        });

        // Paginación
        const totalProgress = filteredProgress.length;
        const startIndex = progressPage * progressPageSize;
        const endIndex = startIndex + progressPageSize;
        const paginatedProgress = filteredProgress.slice(startIndex, endIndex);

        return (
            <>
                {/* Botón toggle filtros */}
                <div className="flex justify-content-end mb-2">
                    <Button
                        label={showProgressFilters ? 'Ocultar filtros' : 'Mostrar filtros'}
                        icon={showProgressFilters ? 'pi pi-eye-slash' : 'pi pi-filter'}
                        className="p-button-text p-button-sm"
                        onClick={() => setShowProgressFilters(!showProgressFilters)}
                    />
                </div>

                {/* Filtros */}
                {showProgressFilters && (
                    <div className="card mb-3">
                        <h4 className="text-base font-semibold mb-3">Filtros</h4>
                    <div className="grid">
                        <div className="col-12 md:col-3">
                            <label className="block text-sm font-medium mb-2">Nombre</label>
                            <InputText
                                value={progressNameFilter}
                                onChange={(e) => {
                                    setProgressNameFilter(e.target.value);
                                    setProgressPage(0);
                                }}
                                placeholder="Buscar por nombre"
                                className="w-full"
                            />
                        </div>
                        <div className="col-12 md:col-3">
                            <label className="block text-sm font-medium mb-2">Email</label>
                            <InputText
                                value={progressEmailFilter}
                                onChange={(e) => {
                                    setProgressEmailFilter(e.target.value);
                                    setProgressPage(0);
                                }}
                                placeholder="Buscar por email"
                                className="w-full"
                            />
                        </div>
                        <div className="col-12 md:col-1">
                            <label className="block text-sm font-medium mb-2">Progreso mín (%)</label>
                            <InputNumber
                                value={progressMin}
                                onValueChange={(e) => {
                                    setProgressMin(e.value ?? null);
                                    setProgressPage(0);
                                }}
                                placeholder="0"
                                min={0}
                                max={100}
                                className="w-full"
                            />
                        </div>
                        <div className="col-12 md:col-1">
                            <label className="block text-sm font-medium mb-2">Progreso máx (%)</label>
                            <InputNumber
                                value={progressMax}
                                onValueChange={(e) => {
                                    setProgressMax(e.value ?? null);
                                    setProgressPage(0);
                                }}
                                placeholder="100"
                                min={0}
                                max={100}
                                className="w-full"
                            />
                        </div>
                        <div className="col-12 md:col-2">
                            <label className="block text-sm font-medium mb-2">Última entrega desde</label>
                            <Calendar
                                value={progressLastSubmissionFrom}
                                onChange={(e) => {
                                    setProgressLastSubmissionFrom(e.value as Date | null);
                                    setProgressPage(0);
                                }}
                                showIcon
                                dateFormat="dd/mm/yy"
                                placeholder="Fecha inicial"
                                className="w-full"
                            />
                        </div>
                        <div className="col-12 md:col-2">
                            <label className="block text-sm font-medium mb-2">Última entrega hasta</label>
                            <Calendar
                                value={progressLastSubmissionTo}
                                onChange={(e) => {
                                    setProgressLastSubmissionTo(e.value as Date | null);
                                    setProgressPage(0);
                                }}
                                showIcon
                                dateFormat="dd/mm/yy"
                                placeholder="Fecha final"
                                className="w-full"
                            />
                        </div>
                        <div className="col-12 flex align-items-end">
                            <Button
                                label="Limpiar filtros"
                                icon="pi pi-filter-slash"
                                className="p-button-text"
                                onClick={() => {
                                    setProgressNameFilter('');
                                    setProgressEmailFilter('');
                                    setProgressMin(null);
                                    setProgressMax(null);
                                    setProgressLastSubmissionFrom(null);
                                    setProgressLastSubmissionTo(null);
                                    setProgressPage(0);
                                }}
                            />
                        </div>
                    </div>
                </div>
                )}

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
                            {paginatedProgress.map((p) => {
                                const total = p.total_exercises || 0;
                                const done = p.done_exercises || 0;
                                const percent = total
                                    ? Math.round((done / total) * 100)
                                    : 0;
                                const avatarUrl = buildAvatarUrl(p.avatar_path);

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
                                        <td className="p-3">
                                            <div className="flex align-items-center gap-3">
                                                <Avatar
                                                    {...(avatarUrl ? { image: avatarUrl } : { label: p.full_name?.charAt(0).toUpperCase() })}
                                                    shape="circle"
                                                    size="large"
                                                />
                                                <span className="font-medium text-800">{p.full_name}</span>
                                            </div>
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

                {/* Paginación */}
                <Paginator
                    first={progressPage * progressPageSize}
                    rows={progressPageSize}
                    totalRecords={totalProgress}
                    rowsPerPageOptions={[5, 10, 20, 50]}
                    onPageChange={(e: PaginatorPageChangeEvent) => {
                        setProgressPage(e.page);
                        setProgressPageSize(e.rows);
                    }}
                    className="mt-3"
                />
            </>
        );
    };

    // ─────────────────────────────
    // Render tab de ejercicios para ESTUDIANTE
    // ─────────────────────────────
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

        // Filtrar ejercicios de estudiante
        const now = new Date();
        let filteredExercises = studentExercises.filter((ex) => {
            // Filtro por estado (PENDING/DONE/LATE)
            const due = ex.due_date ? new Date(ex.due_date) : null;
            const isLate = ex.status === 'PENDING' && due && due < now;

            switch (studentExerciseFilter) {
                case 'PENDING':
                    if (!(ex.status === 'PENDING' && !isLate)) return false;
                    break;
                case 'DONE':
                    if (ex.status !== 'DONE') return false;
                    break;
                case 'LATE':
                    if (!isLate) return false;
                    break;
                default:
                    break;
            }

            // Filtro por nombre
            if (studentExercisesNameFilter && !ex.exercise_name.toLowerCase().includes(studentExercisesNameFilter.toLowerCase())) {
                return false;
            }

            // Filtro por texto
            if (studentExercisesTextFilter) {
                const ce = exercises.find((c) => c.id === ex.course_exercise_id);
                const text = ce?.exercise?.text ?? '';
                if (!text.toLowerCase().includes(studentExercisesTextFilter.toLowerCase())) {
                    return false;
                }
            }

            // Filtro por fecha de publicación
            const ce = exercises.find((c) => c.id === ex.course_exercise_id);
            if (ce?.published_at) {
                const publishedDate = new Date(ce.published_at);
                if (studentExercisesPublishedFrom && publishedDate < studentExercisesPublishedFrom) {
                    return false;
                }
                if (studentExercisesPublishedTo && publishedDate > studentExercisesPublishedTo) {
                    return false;
                }
            }

            // Filtro por con/sin audio
            if (studentExercisesWithAudio === 'with' && !ex.has_audio) {
                return false;
            }
            if (studentExercisesWithAudio === 'without' && ex.has_audio) {
                return false;
            }

            return true;
        });

        // Paginación
        const totalExercises = filteredExercises.length;
        const startIndex = studentExercisesPage * studentExercisesPageSize;
        const endIndex = startIndex + studentExercisesPageSize;
        const paginatedExercises = filteredExercises.slice(startIndex, endIndex);

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
                            onClick={() => {
                                setStudentExerciseFilter(f.key);
                                setStudentExercisesPage(0);
                            }}
                        />
                    ))}
                </div>

                {/* Botón toggle filtros */}
                <div className="flex justify-content-end mb-2">
                    <Button
                        label={showStudentExercisesFilters ? 'Ocultar filtros' : 'Mostrar filtros'}
                        icon={showStudentExercisesFilters ? 'pi pi-eye-slash' : 'pi pi-filter'}
                        className="p-button-text p-button-sm"
                        onClick={() => setShowStudentExercisesFilters(!showStudentExercisesFilters)}
                    />
                </div>

                {/* Filtros adicionales */}
                {showStudentExercisesFilters && (
                    <div className="card mb-3">
                        <h4 className="text-base font-semibold mb-3">Filtros adicionales</h4>
                    <div className="grid">
                        <div className="col-12 md:col-3">
                            <label className="block text-sm font-medium mb-2">Nombre</label>
                            <InputText
                                value={studentExercisesNameFilter}
                                onChange={(e) => {
                                    setStudentExercisesNameFilter(e.target.value);
                                    setStudentExercisesPage(0);
                                }}
                                placeholder="Buscar por nombre"
                                className="w-full"
                            />
                        </div>
                        <div className="col-12 md:col-3">
                            <label className="block text-sm font-medium mb-2">Texto</label>
                            <InputText
                                value={studentExercisesTextFilter}
                                onChange={(e) => {
                                    setStudentExercisesTextFilter(e.target.value);
                                    setStudentExercisesPage(0);
                                }}
                                placeholder="Buscar en texto"
                                className="w-full"
                            />
                        </div>
                        <div className="col-12 md:col-2">
                            <label className="block text-sm font-medium mb-2">Publicado desde</label>
                            <Calendar
                                value={studentExercisesPublishedFrom}
                                onChange={(e) => {
                                    setStudentExercisesPublishedFrom(e.value as Date | null);
                                    setStudentExercisesPage(0);
                                }}
                                showIcon
                                dateFormat="dd/mm/yy"
                                placeholder="Fecha inicial"
                                className="w-full"
                            />
                        </div>
                        <div className="col-12 md:col-2">
                            <label className="block text-sm font-medium mb-2">Publicado hasta</label>
                            <Calendar
                                value={studentExercisesPublishedTo}
                                onChange={(e) => {
                                    setStudentExercisesPublishedTo(e.value as Date | null);
                                    setStudentExercisesPage(0);
                                }}
                                showIcon
                                dateFormat="dd/mm/yy"
                                placeholder="Fecha final"
                                className="w-full"
                            />
                        </div>
                        <div className="col-12 md:col-2">
                            <label className="block text-sm font-medium mb-2">Con audio</label>
                            <Dropdown
                                value={studentExercisesWithAudio}
                                onChange={(e) => {
                                    setStudentExercisesWithAudio(e.value);
                                    setStudentExercisesPage(0);
                                }}
                                options={[
                                    { label: 'Todos', value: 'all' },
                                    { label: 'Con audio', value: 'with' },
                                    { label: 'Sin audio', value: 'without' }
                                ]}
                                placeholder="Seleccionar"
                                className="w-full"
                            />
                        </div>
                        <div className="col-12 flex align-items-end">
                            <Button
                                label="Limpiar filtros"
                                icon="pi pi-filter-slash"
                                className="p-button-text"
                                onClick={() => {
                                    setStudentExercisesNameFilter('');
                                    setStudentExercisesTextFilter('');
                                    setStudentExercisesPublishedFrom(null);
                                    setStudentExercisesPublishedTo(null);
                                    setStudentExercisesWithAudio('all');
                                    setStudentExercisesPage(0);
                                }}
                            />
                        </div>
                    </div>
                </div>
                )}

                {!paginatedExercises.length ? (
                    <p className="text-600">
                        {filteredExercises.length === 0 && studentExercises.length > 0 
                            ? 'No hay ejercicios que coincidan con los filtros.' 
                            : 'No hay ejercicios en esta categoría.'}
                    </p>
                ) : (
                    <div className="grid">
                        {paginatedExercises.map((ex) => {
                            const ce = exercises.find((c) => c.id === ex.course_exercise_id);
                            const textPreview = ce?.exercise?.text ?? '';
                            return (
                                <div key={ex.course_exercise_id} className="col-12 md:col-6">
                                    <div className="card flex flex-column gap-2 h-full">
                                        <div className="flex justify-content-between align-items-start">
                                            <div>
                                                <h4 className="m-0 text-base font-semibold">{ex.exercise_name}</h4>
                                                {ex.due_date && (
                                                    <p className="m-0 text-600 text-sm">
                                                        Fecha límite: {new Date(ex.due_date).toLocaleString()}
                                                    </p>
                                                )}
                                                {ex.submitted_at && (
                                                    <p className="m-0 text-600 text-sm">
                                                        Entregado: {new Date(ex.submitted_at).toLocaleString()}
                                                    </p>
                                                )}
                                            </div>
                                            {statusTag(ex.status, ex.due_date)}
                                        </div>
                                        {textPreview && (
                                            <p className="m-0 text-sm text-700 line-height-3">
                                                {textPreview.length > 140 ? textPreview.slice(0, 140) + '…' : textPreview}
                                            </p>
                                        )}
                                        <div className="flex justify-content-end mt-2">
                                            <Button
                                                label="Ver detalle / entregar"
                                                icon="pi pi-arrow-right"
                                                className="p-button-text"
                                                onClick={() => {
                                                    if (!course) return;
                                                    let exerciseSlug = '';
                                                    if (typeof window !== 'undefined') {
                                                        exerciseSlug = window.btoa(`${course.id}:${ex.course_exercise_id}`);
                                                        exerciseSlug = exerciseSlug.replace(/=+$/, '');
                                                    }
                                                    router.push(`/courses/${params.slug}/${exerciseSlug}`);
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {/* Paginación ejercicios del estudiante: ya está más abajo */}
                    </div>
                )}

                {/* Paginación */}
                <Paginator
                    first={studentExercisesPage * studentExercisesPageSize}
                    rows={studentExercisesPageSize}
                    totalRecords={totalExercises}
                    rowsPerPageOptions={[5, 10, 20, 50]}
                    onPageChange={(e: PaginatorPageChangeEvent) => {
                        setStudentExercisesPage(e.page);
                        setStudentExercisesPageSize(e.rows);
                    }}
                    className="mt-3"
                />
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
                    onPublished={async () => {
                        // Refetch exercises and update state instead of reloading the page
                        if (!token || !course?.id) return;
                        try {
                            setLoadingExercises(true);
                            const data = await getCourseExercises(token, course.id);
                            setExercises(data.filter((ce) => !ce.is_deleted));
                        } catch (err) {
                            console.error('Error reloading exercises after publish:', err);
                        } finally {
                            setLoadingExercises(false);
                        }
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
