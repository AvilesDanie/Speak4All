'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from 'primereact/button';
import { Tag } from 'primereact/tag';
import { Dialog } from 'primereact/dialog';
import { InputTextarea } from 'primereact/inputtextarea';
import { InputText } from 'primereact/inputtext';
import { Dropdown } from 'primereact/dropdown';
import { Calendar } from 'primereact/calendar';
import { Paginator, PaginatorPageChangeEvent } from 'primereact/paginator';
import AudioPlayer from '../../../../exercises/AudioPlayer';
import { API_BASE } from '@/services/apiClient';
import { BackendUser, Role } from '@/services/auth';
import { ExerciseOut, getExerciseAudioUrl, getSubmissionAudioUrl, getExercisePdfUrl } from '@/services/exercises';
import { CourseExercise, SubmissionStatus } from '@/services/courses';
import { useWebSocket, WebSocketMessage } from '@/hooks/useWebSocket';

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
    const [exerciseAudioUrl, setExerciseAudioUrl] = useState<string | null>(null);
    const [submissionAudioUrl, setSubmissionAudioUrl] = useState<string | null>(null);
    const [courseId, setCourseId] = useState<number | null>(null);
    const [submissionCanceledModal, setSubmissionCanceledModal] = useState(false);
    const [canceledStudentName, setCanceledStudentName] = useState<string>('');
    const reloadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastDeletedSubmissionRef = useRef<{ course_exercise_id: number; student_id: number } | null>(null);

    // Estados para filtros y paginación
    const [nameFilter, setNameFilter] = useState('');
    const [emailFilter, setEmailFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'submitted' | 'pending'>('all');
    const [hasAudioFilter, setHasAudioFilter] = useState<'all' | 'with' | 'without'>('all');
    const [submittedFrom, setSubmittedFrom] = useState<Date | null>(null);
    const [submittedTo, setSubmittedTo] = useState<Date | null>(null);
    const [currentPage, setCurrentPage] = useState(0);
    const [pageSize, setPageSize] = useState(10);
    const [showFilters, setShowFilters] = useState(true);
    const [downloadingPdf, setDownloadingPdf] = useState(false);

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
                setErrorMsg(null);

                // Primero necesitamos obtener el courseId del slug
                const resCourses = await fetch(
                    `${API_BASE}/courses/my`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );

                if (!resCourses.ok) {
                    const errorText = await resCourses.text();
                    setErrorMsg(`No se pudo cargar el curso: ${errorText}`);
                    return;
                }

                const coursesData = await resCourses.json();
                const courses = coursesData.items || coursesData;
                const foundCourse = courses.find((c: any) => c.join_code === slug);
                
                if (!foundCourse) {
                    setErrorMsg(`Curso no encontrado. Slug buscado: ${slug}`);
                    return;
                }

                setCourseId(foundCourse.id);

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
                        setErrorMsg(`Ejercicio no encontrado en el curso`);
                        return;
                    }
                } else {
                    const errorText = await resExercises.text();
                    setErrorMsg(`No se pudo cargar el ejercicio: ${errorText}`);
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
                    const errorText = await resStudents.text();
                    setErrorMsg(`Error cargando estudiantes: ${errorText}`);
                }
                setLoadingStudents(false);
            } catch (err: any) {
                setErrorMsg(`Error de red: ${err?.message || 'Error desconocido'}`);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [token, role, exerciseId, slug]);

    // WebSocket handler para actualizar entregas y notificar cambios
    const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
        // Debounce: si hay un reload pendiente, cancelarlo
        if (reloadTimeoutRef.current) {
            clearTimeout(reloadTimeoutRef.current);
        }

        if (message.type === 'submission_created' || message.type === 'submission_updated') {
            if (message.data?.course_exercise_id === Number(exerciseId)) {
                // Recargar estudiantes después de 500ms
                reloadTimeoutRef.current = setTimeout(() => {
                    if (token) {
                        fetch(
                            `${API_BASE}/submissions/course-exercises/${exerciseId}/students`,
                            { headers: { Authorization: `Bearer ${token}` } }
                        )
                            .then(res => res.json())
                            .then((data: SubmissionListItem[]) => setStudents(data))
                            .catch(() => {});
                    }
                }, 500);
            }
        } else if (message.type === 'submission_deleted') {
            const data = message.data as any;
            if (data.course_exercise_id === Number(exerciseId)) {
                // Solo mostrar notificación si el modal de detalles está abierto
                if (submissionDetailVisible && selectedSubmission?.student_id === data.student_id) {
                    // Guardar info del estudiante cuya entrega fue anulada
                    setCanceledStudentName(data.student_name || 'Estudiante');
                    setSubmissionCanceledModal(true);
                    
                    // Cerrar el modal de detalles de entrega
                    setSubmissionDetailVisible(false);
                    setSelectedSubmission(null);
                }
                
                // Siempre recargar estudiantes
                if (token) {
                    fetch(
                        `${API_BASE}/submissions/course-exercises/${exerciseId}/students`,
                        { headers: { Authorization: `Bearer ${token}` } }
                    )
                        .then(res => res.json())
                        .then((data: SubmissionListItem[]) => setStudents(data))
                        .catch(() => {});
                }
            }
        }
    }, [exerciseId, token, submissionDetailVisible, selectedSubmission]);

    // Descargar PDF del ejercicio
    const handleDownloadPdf = async () => {
        if (!courseExercise?.exercise?.id || !token) {
            setErrorMsg('Error al descargar el PDF.');
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
            setErrorMsg('Error al descargar el PDF.');
        } finally {
            setDownloadingPdf(false);
        }
    };

    // WebSocket connection
    const { isConnected: wsConnected } = useWebSocket({
        courseId,
        token,
        onMessage: handleWebSocketMessage,
        enabled: !!courseId && !!token,
    });

    // Cargar detalle de entrega cuando se selecciona un estudiante
    useEffect(() => {
        if (!submissionDetailVisible || !selectedSubmission || !token || role !== 'THERAPIST') {
            return;
        }

        const loadDetail = async () => {
            try {
                setSubmissionDetailError(null);
                setLoadingSubmissionDetail(true);
                setSubmissionAudioUrl(null);
                setSubmissionDetail(null);
                
                const res = await fetch(
                    `${API_BASE}/submissions/course-exercises/${selectedSubmission.course_exercise_id}/students/${selectedSubmission.student_id}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                if (!res.ok) {
                    if (res.status === 404) {
                        setSubmissionDetailError('Este estudiante no tiene entrega para este ejercicio o la ha anulado.');
                    } else {
                        const text = await res.text();
                        setSubmissionDetailError(text || 'No se pudo cargar el detalle de la entrega.');
                    }
                    return;
                }
                const data: SubmissionDetailOut = await res.json();
                setSubmissionDetail(data);

                // Obtener URL firmada si hay audio
                if (data.submission.audio_path && token && data.submission.id) {
                    try {
                        const audioUrl = await getSubmissionAudioUrl(data.submission.id, token);
                        setSubmissionAudioUrl(audioUrl);
                    } catch (err) {
                        setSubmissionDetailError('Error obteniendo audio de la entrega.');
                    }
                }
            } catch (err) {
                setSubmissionDetailError('Error de red al cargar la entrega.');
            } finally {
                setLoadingSubmissionDetail(false);
            }
        };

        loadDetail();
    }, [submissionDetailVisible, selectedSubmission, token, role]);

    // Obtener URL firmada de audio del ejercicio
    useEffect(() => {
        if (courseExercise?.exercise?.id && token) {
            getExerciseAudioUrl(courseExercise.exercise.id, token)
                .then(url => setExerciseAudioUrl(url))
                .catch(err => console.error('Error obteniendo URL de audio del ejercicio:', err));
        }
    }, [courseExercise?.exercise?.id, token]);

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
                        {errorMsg || 'Comprueba que has iniciado sesión como terapeuta y vuelve a intentarlo.'}
                    </p>
                </div>
            </div>
        );
    }

    const exercise = courseExercise.exercise;
    const text = exercise?.text ?? '';
    const title = exercise?.name ?? 'Ejercicio';

    // Aplicar filtros
    const filteredStudents = students.filter((s) => {
        // Filtro por nombre
        if (nameFilter && !s.full_name.toLowerCase().includes(nameFilter.toLowerCase())) {
            return false;
        }

        // Filtro por email
        if (emailFilter && !s.email.toLowerCase().includes(emailFilter.toLowerCase())) {
            return false;
        }

        // Filtro por estado de entrega
        if (statusFilter === 'submitted' && !s.submission_id) {
            return false;
        }
        if (statusFilter === 'pending' && s.submission_id) {
            return false;
        }

        // Filtro por audio
        if (hasAudioFilter === 'with' && !s.has_audio) {
            return false;
        }
        if (hasAudioFilter === 'without' && s.has_audio) {
            return false;
        }

        // Filtro por fecha de entrega
        if (s.submitted_at) {
            const submittedDate = new Date(s.submitted_at);
            if (submittedFrom && submittedDate < submittedFrom) {
                return false;
            }
            if (submittedTo && submittedDate > submittedTo) {
                return false;
            }
        }

        return true;
    });

    // Paginación
    const totalStudents = filteredStudents.length;
    const startIndex = currentPage * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedStudents = filteredStudents.slice(startIndex, endIndex);

    const studentsWithSubmission = paginatedStudents.filter(s => s.submission_id);
    const studentsWithoutSubmission = paginatedStudents.filter(s => !s.submission_id);

    return (
        <div className="surface-ground p-3 md:p-4" style={{ minHeight: '60vh' }}>
            
            {/* Barra superior: volver + descargar */}
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
                <div className="flex-1 flex flex-column gap-3" style={{ minWidth: 0 }}>
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

                    {courseExercise.exercise?.audio_path && (
                        <div className="card">
                            <h3 className="text-lg font-semibold mb-2">Audio de referencia</h3>
                            {exerciseAudioUrl ? (
                                <AudioPlayer 
                                    src={exerciseAudioUrl} 
                                    exerciseId={courseExercise.exercise.id}
                                    token={token}
                                    exerciseName={courseExercise.exercise.name}
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

                {/* Columna derecha: Lista de entregas */}
                <div className="card flex-1" style={{ alignSelf: 'flex-start', minWidth: 0 }}>
                    <div className="flex justify-content-between align-items-center mb-3">
                        <h3 className="text-lg font-semibold m-0">Entregas de estudiantes</h3>
                        {students.length > 0 && (
                            <Button
                                label={showFilters ? 'Ocultar filtros' : 'Mostrar filtros'}
                                icon={showFilters ? 'pi pi-eye-slash' : 'pi pi-filter'}
                                className="p-button-text p-button-sm"
                                onClick={() => setShowFilters(!showFilters)}
                            />
                        )}
                    </div>

                    {/* Filtros */}
                    {showFilters && students.length > 0 && (
                        <div className="surface-50 border-round-lg p-3 mb-3">
                            <h4 className="text-sm font-semibold mb-3">Filtros</h4>
                            <div className="flex flex-column gap-3">
                                <div>
                                    <label className="block text-xs font-medium mb-2">Nombre</label>
                                    <InputText
                                        value={nameFilter}
                                        onChange={(e) => {
                                            setNameFilter(e.target.value);
                                            setCurrentPage(0);
                                        }}
                                        placeholder="Buscar por nombre"
                                        className="w-full"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-2">Email</label>
                                    <InputText
                                        value={emailFilter}
                                        onChange={(e) => {
                                            setEmailFilter(e.target.value);
                                            setCurrentPage(0);
                                        }}
                                        placeholder="Buscar por email"
                                        className="w-full"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-2">Estado</label>
                                    <Dropdown
                                        value={statusFilter}
                                        onChange={(e) => {
                                            setStatusFilter(e.value);
                                            setCurrentPage(0);
                                        }}
                                        options={[
                                            { label: 'Todos', value: 'all' },
                                            { label: 'Con entrega', value: 'submitted' },
                                            { label: 'Sin entrega', value: 'pending' }
                                        ]}
                                        placeholder="Seleccionar"
                                        className="w-full"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-2">Con audio</label>
                                    <Dropdown
                                        value={hasAudioFilter}
                                        onChange={(e) => {
                                            setHasAudioFilter(e.value);
                                            setCurrentPage(0);
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
                                <div>
                                    <label className="block text-xs font-medium mb-2">Entregado desde</label>
                                    <Calendar
                                        value={submittedFrom}
                                        onChange={(e) => {
                                            setSubmittedFrom(e.value as Date | null);
                                            setCurrentPage(0);
                                        }}
                                        showIcon
                                        dateFormat="dd/mm/yy"
                                        placeholder="Fecha inicial"
                                        className="w-full"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-2">Entregado hasta</label>
                                    <Calendar
                                        value={submittedTo}
                                        onChange={(e) => {
                                            setSubmittedTo(e.value as Date | null);
                                            setCurrentPage(0);
                                        }}
                                        showIcon
                                        dateFormat="dd/mm/yy"
                                        placeholder="Fecha final"
                                        className="w-full"
                                    />
                                </div>
                                <div>
                                    <Button
                                        label="Limpiar filtros"
                                        icon="pi pi-filter-slash"
                                        className="p-button-text p-button-sm w-full"
                                        onClick={() => {
                                            setNameFilter('');
                                            setEmailFilter('');
                                            setStatusFilter('all');
                                            setHasAudioFilter('all');
                                            setSubmittedFrom(null);
                                            setSubmittedTo(null);
                                            setCurrentPage(0);
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {loadingStudents ? (
                        <p className="text-center text-600">Cargando entregas...</p>
                    ) : students.length === 0 ? (
                        <p className="text-center text-600">No hay estudiantes inscritos en este curso.</p>
                    ) : filteredStudents.length === 0 ? (
                        <p className="text-center text-600">No hay estudiantes que coincidan con los filtros.</p>
                    ) : (
                        <>
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

                        {/* Paginación */}
                        <Paginator
                            first={currentPage * pageSize}
                            rows={pageSize}
                            totalRecords={totalStudents}
                            rowsPerPageOptions={[5, 10, 20, 50]}
                            onPageChange={(e: PaginatorPageChangeEvent) => {
                                setCurrentPage(e.page);
                                setPageSize(e.rows);
                            }}
                            className="mt-3"
                        />
                        </>
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

                        {submissionDetail?.submission.audio_path && (
                            <div className="surface-50 border-round-lg p-3">
                                <h4 className="text-base font-semibold mb-2">Audio de la entrega</h4>
                                {submissionAudioUrl ? (
                                    <AudioPlayer src={submissionAudioUrl} />
                                ) : (
                                    <div className="text-center p-3">
                                        <i className="pi pi-spin pi-spinner" style={{ fontSize: '2rem' }} />
                                        <p className="text-sm text-600 mt-2">Cargando audio...</p>
                                    </div>
                                )}
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

            {/* Modal: Entrega anulada */}
            <Dialog
                header="Entrega anulada"
                visible={submissionCanceledModal}
                modal
                style={{ width: '26rem', maxWidth: '95vw' }}
                onHide={() => setSubmissionCanceledModal(false)}
            >
                <div className="flex flex-column align-items-center gap-3 py-3">
                    <i className="pi pi-info-circle text-orange-500" style={{ fontSize: '3rem' }} />
                    <p className="text-center m-0">
                        {canceledStudentName} ha anulado su entrega. El modal de detalle se ha cerrado.
                    </p>
                    <Button
                        label="Aceptar"
                        className="w-full"
                        onClick={() => setSubmissionCanceledModal(false)}
                    />
                </div>
            </Dialog>
        </div>
    );
};

export default TherapistExerciseDetailPage;
