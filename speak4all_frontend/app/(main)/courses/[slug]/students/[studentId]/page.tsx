'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from 'primereact/button';
import { Tag } from 'primereact/tag';
import { ProgressBar } from 'primereact/progressbar';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { InputNumber } from 'primereact/inputnumber';
import { Calendar } from 'primereact/calendar';
import { Dropdown } from 'primereact/dropdown';
import { Paginator, PaginatorPageChangeEvent } from 'primereact/paginator';
import { API_BASE, normalizeBackendUrl } from '@/services/apiClient';
import { BackendUser, Role } from '@/services/auth';
import { StudentExerciseStatus, SubmissionStatus } from '@/services/courses';
import { useWebSocket, WebSocketMessage } from '@/hooks/useWebSocket';
import { ObservationsDisplay } from '@/components/ObservationsDisplay';
import { RubricDisplay } from '@/components/RubricDisplay';
import { CategoryPieChart } from '@/components/CategoryPieChart';
import { evaluationService } from '@/services/rubrics';
import { StudentProgressView } from '@/components/StudentProgressView';
import { progressService } from '@/services/rubrics';

interface SubmissionOut {
    id: number;
    student_id: number;
    course_exercise_id: number;
    status: SubmissionStatus;
    media_path: string;
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

    // Debounce para recarga tras eventos WS
    const reloadTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Modal de detalle de entrega
    const [submissionDetailVisible, setSubmissionDetailVisible] = useState(false);
    const [selectedExercise, setSelectedExercise] = useState<StudentExerciseStatus | null>(null);
    const [submissionDetail, setSubmissionDetail] = useState<SubmissionDetailOut | null>(null);
    const [loadingSubmissionDetail, setLoadingSubmissionDetail] = useState(false);
    const [submissionDetailError, setSubmissionDetailError] = useState<string | null>(null);
    const [submissionMediaUrl, setSubmissionMediaUrl] = useState<string | null>(null);
    const [submissionCanceledModal, setSubmissionCanceledModal] = useState(false);
    const [canceledExerciseName, setCanceledExerciseName] = useState<string>('');
    
    // Observaciones y rúbrica
    const [observations, setObservations] = useState<any[]>([]);
    const [evaluation, setEvaluation] = useState<any>(null);
    const [rubric, setRubric] = useState<any>(null);
    const [loadingEval, setLoadingEval] = useState(false);
    const [showObservationForm, setShowObservationForm] = useState(false);
    const [newObservationText, setNewObservationText] = useState('');
    const [addingObservation, setAddingObservation] = useState(false);

    // Puntajes por ejercicio (para mostrar aprobado/reprobado)
    const [exerciseScoresMap, setExerciseScoresMap] = useState<Record<number, {
        score: number | null;
        maxScore: number | null;
        percent: number | null;
        passed: boolean;
        categoryId: number | null;
        categoryName: string | null;
        categoryColor: string | null;
    }>>({});

    // Progreso por categoría
    const [categoryProgress, setCategoryProgress] = useState<Record<string, {
        categoryId: number | null;
        categoryName: string;
        categoryColor: string | null;
        percent: number;
        completed: number;
        total: number;
    }>>({});

    const [overallPercent, setOverallPercent] = useState<number>(0);
    const [pieChartData, setPieChartData] = useState<{ labels: string[]; weights: number[]; performances: number[]; colors: string[] } | null>(null);

    // Estados para filtros y paginación
    const [exerciseNameFilter, setExerciseNameFilter] = useState('');
    const [exerciseStatusFilter, setExerciseStatusFilter] = useState<'all' | 'PENDING' | 'DONE' | 'LATE'>('all');
    const [exerciseDueDateFrom, setExerciseDueDateFrom] = useState<Date | null>(null);
    const [exerciseDueDateTo, setExerciseDueDateTo] = useState<Date | null>(null);
    const [exerciseSubmittedFrom, setExerciseSubmittedFrom] = useState<Date | null>(null);
    const [exerciseSubmittedTo, setExerciseSubmittedTo] = useState<Date | null>(null);
    const [exerciseWithMedia, setExerciseWithMedia] = useState<'all' | 'with' | 'without'>('all');
    const [exercisePage, setExercisePage] = useState(0);
    const [exercisePageSize, setExercisePageSize] = useState(10);
    const [showFilters, setShowFilters] = useState(true);

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

                const coursesResp = await resCourses.json();
                const courses = coursesResp.items || coursesResp;
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
                            email: student.email || '',
                        });
                    } else {
                        setErrorMsg('Estudiante no encontrado en este curso.');
                    }
                } else {
                    setErrorMsg('No se pudo cargar la lista de estudiantes.');
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

                // Cargar progreso para obtener puntajes por ejercicio
                try {
                    const progress = await progressService.getStudentProgress(Number(studentId), foundCourse.id, token);
                    if (progress?.exercise_scores) {
                        const map: Record<number, {
                            score: number | null;
                            maxScore: number | null;
                            percent: number | null;
                            passed: boolean;
                            categoryId: number | null;
                            categoryName: string | null;
                            categoryColor: string | null;
                        }> = {};
                        
                        const categoryData: Record<string, {
                            categoryId: number | null;
                            categoryName: string;
                            categoryColor: string | null;
                            percent: number;
                            completed: number;
                            total: number;
                            percentSum: number;
                        }> = {};

                        for (const ex of progress.exercise_scores) {
                            const score = typeof ex.score === 'number' ? ex.score : null;
                            const max = typeof ex.max_score === 'number' ? ex.max_score : null;
                            const percent = score != null && max && max > 0 ? Math.round((score / max) * 100) : null;
                            const passed = percent != null ? percent >= 70 : false;
                            
                            map[ex.course_exercise_id] = {
                                score,
                                maxScore: max,
                                percent,
                                passed,
                                categoryId: ex.category_id || null,
                                categoryName: ex.category_name || null,
                                categoryColor: ex.category_color || null,
                            };

                            // Agrupar por categoría
                            const categoryKey = ex.category_name || 'Sin categoría';
                            if (!categoryData[categoryKey]) {
                                categoryData[categoryKey] = {
                                    categoryId: ex.category_id || null,
                                    categoryName: categoryKey,
                                    categoryColor: ex.category_color || null,
                                    percent: 0,
                                    completed: 0,
                                    total: 0,
                                    percentSum: 0,
                                };
                            }
                            
                            categoryData[categoryKey].total++;
                            // Sumar el porcentaje para calcular el promedio después
                            if (percent !== null) {
                                categoryData[categoryKey].percentSum += percent;
                            }
                            // Contar como completado si tiene evaluación y porcentaje >= 70
                            if (percent !== null && percent >= 70) {
                                categoryData[categoryKey].completed++;
                            }
                        }

                        // Calcular porcentaje general como promedio de todos los ejercicios
                        const totalExercises = progress.exercise_scores.length;
                        const totalPercentSum = Object.values(categoryData).reduce((sum, cat) => sum + cat.percentSum, 0);
                        const generalPercent = totalExercises > 0 ? Math.round(totalPercentSum / totalExercises) : 0;
                        setOverallPercent(generalPercent);

                        // Calcular porcentaje por categoría como PROMEDIO de los porcentajes
                        for (const categoryKey in categoryData) {
                            const cat = categoryData[categoryKey];
                            cat.percent = cat.total > 0 ? Math.round(cat.percentSum / cat.total) : 0;
                        }

                        setExerciseScoresMap(map);
                        setCategoryProgress(categoryData);

                        // Preparar datos para gráfica de pastel con dos capas
                        const chartLabels = Object.values(categoryData).map(cat => cat.categoryName);
                        const totalCategoriesExercises = Object.values(categoryData).reduce((sum, cat) => sum + cat.total, 0);
                        
                        // Calcular peso de cada categoría (proporción de ejercicios)
                        const chartWeights = Object.values(categoryData).map(cat => (cat.total / totalCategoriesExercises) * 100);
                        
                        // El desempeño de cada categoría ya está calculado
                        const chartPerformances = Object.values(categoryData).map(cat => cat.percent);
                        
                        const chartColors = Object.values(categoryData).map((cat, idx) => {
                            if (cat.categoryColor) return cat.categoryColor;
                            const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#C9CBCF'];
                            return colors[idx % colors.length];
                        });
                        
                        const finalChartData = {
                            labels: chartLabels,
                            weights: chartWeights,
                            performances: chartPerformances,
                            colors: chartColors,
                        };
                        
                        console.log('Chart data:', finalChartData);
                        setPieChartData(finalChartData);
                    }
                } catch (err) {
                    console.error('Error cargando progreso para puntajes:', err);
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

    // Reload helper
    const reloadExercises = useCallback(async () => {
        if (!token || !courseId) return;
        try {
            const resExercises = await fetch(
                `${API_BASE}/submissions/courses/${courseId}/students/${studentId}/exercises-status`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (resExercises.ok) {
                const data: StudentExerciseStatus[] = await resExercises.json();
                setExercises(data);
            }
        } catch (err) {
            console.error('Error reloading student exercises:', err);
        }
    }, [token, courseId, studentId]);

    // WebSocket: actualizar lista ante eventos de entregas
    const handleWsMessage = useCallback((msg: WebSocketMessage) => {
        if (role !== 'THERAPIST') return;
        const data: any = msg.data || {};
        if (data.student_id !== Number(studentId)) return;

        if (msg.type === 'submission_created' || msg.type === 'submission_updated') {
            if (reloadTimeoutRef.current) clearTimeout(reloadTimeoutRef.current);
            reloadTimeoutRef.current = setTimeout(() => {
                reloadExercises();
            }, 300);
        } else if (msg.type === 'submission_deleted') {
            // Solo mostrar modal si el detalle está abierto
            if (submissionDetailVisible && selectedExercise && selectedExercise.course_exercise_id === data.course_exercise_id) {
                setCanceledExerciseName(selectedExercise.exercise_name || 'Ejercicio');
                setSubmissionCanceledModal(true);
                
                // Cerrar modal de detalles
                setSubmissionDetailVisible(false);
                setSelectedExercise(null);
                setSubmissionDetail(null);
            }
            
            // Siempre recargar datos
            if (reloadTimeoutRef.current) clearTimeout(reloadTimeoutRef.current);
            reloadTimeoutRef.current = setTimeout(() => {
                reloadExercises();
            }, 200);
        }
    }, [role, studentId, reloadExercises, submissionDetailVisible, selectedExercise]);

    useWebSocket({
        courseId,
        token,
        onMessage: handleWsMessage,
        enabled: !!courseId && !!token && role === 'THERAPIST',
    });

    // Cargar detalle de entrega cuando se selecciona un ejercicio
    useEffect(() => {
        if (!submissionDetailVisible || !selectedExercise || !token || role !== 'THERAPIST') {
            return;
        }

        const loadDetail = async () => {
            try {
                setSubmissionDetailError(null);
                setLoadingSubmissionDetail(true);
                setSubmissionMediaUrl(null);
                setObservations([]);
                setEvaluation(null);
                setRubric(null);
                setLoadingEval(true);
                
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

                // Obtener URL firmada de la evidencia (foto/video)
                if (data.submission.media_path && token && data.submission.id) {
                    try {
                        const mediaUrlRes = await fetch(
                            `${API_BASE}/submissions/${data.submission.id}/media-url`,
                            { headers: { Authorization: `Bearer ${token}` } }
                        );
                        if (mediaUrlRes.ok) {
                            const mediaData = await mediaUrlRes.json();
                            setSubmissionMediaUrl(normalizeBackendUrl(mediaData.url));
                        } else {
                            setSubmissionDetailError('Error obteniendo evidencia de la entrega.');
                        }
                    } catch (err) {
                        setSubmissionDetailError('Error obteniendo evidencia de la entrega.');
                    }
                }
                
                // Cargar observaciones
                try {
                    const obsRes = await fetch(
                        `${API_BASE}/observations/submission/${data.submission.id}`,
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                    if (obsRes.ok) {
                        const obsData = await obsRes.json();
                        setObservations(Array.isArray(obsData) ? obsData : obsData.observations || []);
                    }
                } catch (err) {
                    console.error('Error cargando observaciones:', err);
                }
                
                // Cargar evaluación
                try {
                    const evalRes = await fetch(
                        `${API_BASE}/evaluations/submission/${data.submission.id}`,
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                    if (evalRes.ok) {
                        const evalData = await evalRes.json();
                        setEvaluation(evalData);
                        
                        // Cargar rúbrica si existe evaluación
                        if (evalData && selectedExercise) {
                            try {
                                const rubricRes = await fetch(
                                    `${API_BASE}/rubrics/${selectedExercise.course_exercise_id}`,
                                    { headers: { Authorization: `Bearer ${token}` } }
                                );
                                if (rubricRes.ok) {
                                    const rubricData = await rubricRes.json();
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
                console.error('Error de red al obtener detalle de entrega:', err);
                setSubmissionDetailError('Error de red al cargar la entrega.');
            } finally {
                setLoadingSubmissionDetail(false);
                setLoadingEval(false);
            }
        };

        loadDetail();
    }, [submissionDetailVisible, selectedExercise, token, role, studentId]);


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

            {/* Progreso por categoría */}
            {courseId && Object.keys(categoryProgress).length > 0 && (
                <div className="card mb-3">
                    <h3 className="text-lg font-semibold m-0 mb-3">Desempeño por categoría</h3>
                    
                    {/* Grid: Gráfica de pastel y estadísticas */}
                    <div className="grid">
                        {/* Gráfica de pastel */}
                        <div className="col-12 lg:col-5">
                            <div className="surface-50 border-round-lg p-3">
                                <h4 className="text-base font-semibold text-center m-0 mb-3">
                                    Distribución por categoría
                                </h4>
                                {pieChartData && pieChartData.labels && pieChartData.labels.length > 0 ? (
                                    <CategoryPieChart
                                        labels={pieChartData.labels}
                                        weights={pieChartData.weights}
                                        performances={pieChartData.performances}
                                        colors={pieChartData.colors}
                                    />
                                ) : (
                                    <div style={{ height: '280px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
                                        Cargando datos...
                                    </div>
                                )}
                                <div className="text-center border-top pt-3 mt-3">
                                    <p className="text-xs text-600 m-0 mb-1">Porcentaje general</p>
                                    <p className="text-2xl font-bold m-0" style={{ color: '#10b981' }}>
                                        {overallPercent}%
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Detalles por categoría */}
                        <div className="col-12 lg:col-7">
                            <div className="flex flex-column gap-2">
                                {Object.entries(categoryProgress)
                                    .sort((a, b) => b[1].percent - a[1].percent)
                                    .map(([categoryKey, catData]) => (
                                        <div
                                            key={categoryKey}
                                            className="surface-50 border-round-lg p-3"
                                        >
                                            <div className="flex align-items-center justify-content-between mb-2">
                                                <div className="flex align-items-center gap-2 flex-1">
                                                    {catData.categoryColor && (
                                                        <div
                                                            style={{
                                                                width: '10px',
                                                                height: '10px',
                                                                borderRadius: '50%',
                                                                backgroundColor: catData.categoryColor,
                                                                flexShrink: 0,
                                                            }}
                                                        />
                                                    )}
                                                    <span className="font-semibold text-sm">{catData.categoryName}</span>
                                                </div>
                                                <span className="font-bold text-sm" style={{ minWidth: '45px', textAlign: 'right' }}>
                                                    {catData.percent}%
                                                </span>
                                            </div>
                                            <ProgressBar
                                                value={catData.percent}
                                                showValue={false}
                                                style={{ height: '6px', borderRadius: '3px' }}
                                            />
                                            <p className="text-xs text-600 m-0 mt-1">
                                                {catData.completed} / {catData.total}
                                            </p>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Progreso general alternativo si no hay datos de categoría */}
            {courseId && Object.keys(categoryProgress).length === 0 && (
                <div className="card mb-3">
                    <h3 className="text-lg font-semibold m-0 mb-3">Progreso general del estudiante</h3>
                    <StudentProgressView studentId={Number(studentId)} courseId={courseId} />
                </div>
            )}

            {/* Lista de ejercicios agrupados por categoría */}
            <div className="card">
                <div className="flex justify-content-between align-items-center mb-3">
                    <h3 className="text-lg font-semibold m-0">Desempeño por categoría</h3>
                    {exercises.length > 0 && (
                        <Button
                            label={showFilters ? 'Ocultar filtros' : 'Mostrar filtros'}
                            icon={showFilters ? 'pi pi-eye-slash' : 'pi pi-filter'}
                            className="p-button-text"
                            onClick={() => setShowFilters(!showFilters)}
                        />
                    )}
                </div>

                {!exercises.length ? (
                    <p className="text-center text-600">No hay ejercicios asignados en este curso.</p>
                ) : (
                    <>
                        {/* Filtros */}
                        {showFilters && (
                            <div className="surface-50 border-round-lg p-3 mb-3">
                                <h4 className="text-base font-semibold mb-3">Filtros</h4>
                            <div className="grid">
                                <div className="col-12 md:col-3">
                                    <label className="block text-sm font-medium mb-2">Nombre</label>
                                    <InputText
                                        value={exerciseNameFilter}
                                        onChange={(e) => {
                                            setExerciseNameFilter(e.target.value);
                                            setExercisePage(0);
                                        }}
                                        placeholder="Buscar por nombre"
                                        className="w-full"
                                    />
                                </div>
                                <div className="col-12 md:col-2">
                                    <label className="block text-sm font-medium mb-2">Estado</label>
                                    <Dropdown
                                        value={exerciseStatusFilter}
                                        onChange={(e) => {
                                            setExerciseStatusFilter(e.value);
                                            setExercisePage(0);
                                        }}
                                        options={[
                                            { label: 'Todos', value: 'all' },
                                            { label: 'Pendiente', value: 'PENDING' },
                                            { label: 'Entregado', value: 'DONE' },
                                            { label: 'Retrasado', value: 'LATE' }
                                        ]}
                                        placeholder="Seleccionar"
                                        className="w-full"
                                    />
                                </div>
                                <div className="col-12 md:col-2">
                                    <label className="block text-sm font-medium mb-2">Fecha límite desde</label>
                                    <Calendar
                                        value={exerciseDueDateFrom}
                                        onChange={(e) => {
                                            setExerciseDueDateFrom(e.value as Date | null);
                                            setExercisePage(0);
                                        }}
                                        showIcon
                                        dateFormat="dd/mm/yy"
                                        placeholder="Fecha inicial"
                                        className="w-full"
                                    />
                                </div>
                                <div className="col-12 md:col-2">
                                    <label className="block text-sm font-medium mb-2">Fecha límite hasta</label>
                                    <Calendar
                                        value={exerciseDueDateTo}
                                        onChange={(e) => {
                                            setExerciseDueDateTo(e.value as Date | null);
                                            setExercisePage(0);
                                        }}
                                        showIcon
                                        dateFormat="dd/mm/yy"
                                        placeholder="Fecha final"
                                        className="w-full"
                                    />
                                </div>
                                <div className="col-12 md:col-2">
                                    <label className="block text-sm font-medium mb-2">Entregado desde</label>
                                    <Calendar
                                        value={exerciseSubmittedFrom}
                                        onChange={(e) => {
                                            setExerciseSubmittedFrom(e.value as Date | null);
                                            setExercisePage(0);
                                        }}
                                        showIcon
                                        dateFormat="dd/mm/yy"
                                        placeholder="Fecha inicial"
                                        className="w-full"
                                    />
                                </div>
                                <div className="col-12 md:col-2">
                                    <label className="block text-sm font-medium mb-2">Entregado hasta</label>
                                    <Calendar
                                        value={exerciseSubmittedTo}
                                        onChange={(e) => {
                                            setExerciseSubmittedTo(e.value as Date | null);
                                            setExercisePage(0);
                                        }}
                                        showIcon
                                        dateFormat="dd/mm/yy"
                                        placeholder="Fecha final"
                                        className="w-full"
                                    />
                                </div>
                                <div className="col-12 md:col-2">
                                            <label className="block text-sm font-medium mb-2">Con evidencia</label>
                                    <Dropdown
                                                value={exerciseWithMedia}
                                        onChange={(e) => {
                                                    setExerciseWithMedia(e.value);
                                            setExercisePage(0);
                                        }}
                                        options={[
                                            { label: 'Todos', value: 'all' },
                                                    { label: 'Con evidencia', value: 'with' },
                                                    { label: 'Sin evidencia', value: 'without' }
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
                                            setExerciseNameFilter('');
                                            setExerciseStatusFilter('all');
                                            setExerciseDueDateFrom(null);
                                            setExerciseDueDateTo(null);
                                            setExerciseSubmittedFrom(null);
                                            setExerciseSubmittedTo(null);
                                            setExerciseWithMedia('all');
                                            setExercisePage(0);
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                        )}

                        {(() => {
                            const now = new Date();
                            
                            // Aplicar filtros
                            let filteredExercises = exercises.filter((ex) => {
                                // Filtro por nombre
                                if (exerciseNameFilter && !ex.exercise_name.toLowerCase().includes(exerciseNameFilter.toLowerCase())) {
                                    return false;
                                }

                                // Filtro por estado
                                const due = ex.due_date ? new Date(ex.due_date) : null;
                                const isLate = ex.status === 'PENDING' && due && due < now;
                                
                                if (exerciseStatusFilter === 'PENDING' && (ex.status !== 'PENDING' || isLate)) {
                                    return false;
                                }
                                if (exerciseStatusFilter === 'DONE' && ex.status !== 'DONE') {
                                    return false;
                                }
                                if (exerciseStatusFilter === 'LATE' && !isLate) {
                                    return false;
                                }

                                // Filtro por fecha límite
                                if (ex.due_date) {
                                    const dueDate = new Date(ex.due_date);
                                    if (exerciseDueDateFrom && dueDate < exerciseDueDateFrom) {
                                        return false;
                                    }
                                    if (exerciseDueDateTo && dueDate > exerciseDueDateTo) {
                                        return false;
                                    }
                                }

                                // Filtro por fecha de entrega
                                if (ex.submitted_at) {
                                    const submittedDate = new Date(ex.submitted_at);
                                    if (exerciseSubmittedFrom && submittedDate < exerciseSubmittedFrom) {
                                        return false;
                                    }
                                    if (exerciseSubmittedTo && submittedDate > exerciseSubmittedTo) {
                                        return false;
                                    }
                                }

                                // Filtro por con/sin evidencia
                                if (exerciseWithMedia === 'with' && !ex.has_media) {
                                    return false;
                                }
                                if (exerciseWithMedia === 'without' && ex.has_media) {
                                    return false;
                                }

                                return true;
                            });

                            // Paginación
                            const totalExercises = filteredExercises.length;
                            const startIndex = exercisePage * exercisePageSize;
                            const endIndex = startIndex + exercisePageSize;
                            const paginatedExercises = filteredExercises.slice(startIndex, endIndex);

                            return (
                                <>
                                    {!paginatedExercises.length ? (
                                        <p className="text-center text-600">
                                            {filteredExercises.length === 0 && exercises.length > 0
                                                ? 'No hay ejercicios que coincidan con los filtros.'
                                                : 'No hay ejercicios asignados en este curso.'}
                                        </p>
                                    ) : (
                                        <div className="flex flex-column gap-3">
                                            {(() => {
                                                // Agrupar ejercicios por categoría
                                                const groupedByCategory: Record<string, typeof paginatedExercises> = {};
                                                for (const ex of paginatedExercises) {
                                                    const scoreInfo = exerciseScoresMap[ex.course_exercise_id];
                                                    const categoryName = scoreInfo?.categoryName || 'Sin categoría';
                                                    if (!groupedByCategory[categoryName]) {
                                                        groupedByCategory[categoryName] = [];
                                                    }
                                                    groupedByCategory[categoryName].push(ex);
                                                }

                                                return Object.entries(groupedByCategory).map(([categoryName, categoryExercises]) => {
                                                    const categoryInfo = categoryProgress[categoryName];
                                                    const firstExercise = categoryExercises[0];
                                                    const scoreInfo = exerciseScoresMap[firstExercise.course_exercise_id];
                                                    const categoryColor = scoreInfo?.categoryColor || '#6366f1';

                                                    return (
                                                        <div
                                                            key={categoryName}
                                                            className="surface-card border-round-lg overflow-hidden"
                                                            style={{ border: `2px solid ${categoryColor}40` }}
                                                        >
                                                            {/* Header de categoría */}
                                                            <div
                                                                className="p-3 flex justify-content-between align-items-center"
                                                                style={{ backgroundColor: `${categoryColor}15`, borderLeft: `4px solid ${categoryColor}` }}
                                                            >
                                                                <div className="flex align-items-center gap-2">
                                                                    <div
                                                                        style={{
                                                                            width: '12px',
                                                                            height: '12px',
                                                                            borderRadius: '50%',
                                                                            backgroundColor: categoryColor,
                                                                        }}
                                                                    />
                                                                    <h4 className="m-0 font-semibold">{categoryName}</h4>
                                                                </div>
                                                                <div className="flex gap-3 align-items-center">
                                                                    {categoryInfo && (
                                                                        <>
                                                                            <span className="text-sm font-medium">
                                                                                {categoryInfo.completed} / {categoryInfo.total}
                                                                            </span>
                                                                            <Tag
                                                                                value={`${categoryInfo.percent}%`}
                                                                                severity={categoryInfo.percent >= 70 ? 'success' : categoryInfo.percent >= 40 ? 'warning' : 'danger'}
                                                                            />
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* Lista de ejercicios de la categoría */}
                                                            <div className="p-3 flex flex-column gap-2">
                                                                {categoryExercises.map((ex) => {
                                                                    const due = ex.due_date ? new Date(ex.due_date) : null;
                                                                    const isLate = ex.status === 'PENDING' && due && due < now;
                                                                    const scoreInfo = exerciseScoresMap[ex.course_exercise_id];

                                                                    return (
                                                                        <div
                                                                            key={ex.course_exercise_id}
                                                                            className="surface-50 border-round-lg p-2 flex justify-content-between align-items-center gap-3 text-sm"
                                                                        >
                                                                            <div className="flex-1 min-w-0">
                                                                                <div className="flex align-items-center gap-2 mb-1">
                                                                                    <p className="m-0 font-semibold">{ex.exercise_name}</p>
                                                                                    {statusTag(ex.status, ex.due_date)}
                                                                                    {scoreInfo && scoreInfo.percent != null && (
                                                                                        <Tag
                                                                                            value={`${scoreInfo.passed ? 'Aprobado' : 'Reprobado'} ${scoreInfo.percent}%`}
                                                                                            severity={scoreInfo.passed ? 'success' : 'danger'}
                                                                                        />
                                                                                    )}
                                                                                </div>
                                                                                <div className="flex flex-wrap gap-3 text-xs text-600">
                                                                                    {ex.due_date && (
                                                                                        <span>
                                                                                            <i className="pi pi-calendar mr-1" />
                                                                                            {new Date(ex.due_date).toLocaleString()}
                                                                                        </span>
                                                                                    )}
                                                                                    {ex.submitted_at && (
                                                                                        <span>
                                                                                            <i className="pi pi-check mr-1" />
                                                                                            {new Date(ex.submitted_at).toLocaleString()}
                                                                                        </span>
                                                                                    )}
                                                                                    {scoreInfo && scoreInfo.score != null && scoreInfo.maxScore != null && (
                                                                                        <span>
                                                                                            <i className="pi pi-chart-line mr-1" />
                                                                                            {scoreInfo.score} / {scoreInfo.maxScore}
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                            <div>
                                                                                {ex.status === 'DONE' ? (
                                                                                    <Button
                                                                                        icon="pi pi-eye"
                                                                                        label="Ver"
                                                                                        className="p-button-sm p-button-text"
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
                                                        </div>
                                                    );
                                                });
                                            })()}
                                        </div>
                                    )}

                                    {/* Paginación */}
                                    <Paginator
                                        first={exercisePage * exercisePageSize}
                                        rows={exercisePageSize}
                                        totalRecords={totalExercises}
                                        rowsPerPageOptions={[5, 10, 20, 50]}
                                        onPageChange={(e: PaginatorPageChangeEvent) => {
                                            setExercisePage(e.page);
                                            setExercisePageSize(e.rows);
                                        }}
                                        className="mt-3"
                                    />
                                </>
                            );
                        })()}
                    </>
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

                        {submissionDetail.submission.media_path && (
                            <div className="surface-50 border-round-lg p-3">
                                <h4 className="text-base font-semibold mb-2">Evidencia de la entrega</h4>
                                {submissionMediaUrl ? (
                                    <div className="flex justify-content-center">
                                        {submissionDetail.submission.media_path.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                                            <img 
                                                src={submissionMediaUrl} 
                                                alt="Evidencia del estudiante"
                                                style={{ maxWidth: '100%', maxHeight: '500px', borderRadius: '8px' }}
                                            />
                                        ) : (
                                            <video 
                                                src={submissionMediaUrl} 
                                                controls
                                                style={{ maxWidth: '100%', maxHeight: '500px', borderRadius: '8px' }}
                                            >
                                                Tu navegador no soporta la reproducción de video.
                                            </video>
                                        )}
                                    </div>
                                ) : (
                                    <div className="text-center p-3">
                                        <i className="pi pi-spin pi-spinner" style={{ fontSize: '2rem' }} />
                                        <p className="text-sm text-600 mt-2">Cargando evidencia...</p>
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {/* Observaciones */}
                        <div className="surface-50 border-round-lg p-3">
                            <div className="flex justify-content-between align-items-center mb-3">
                                <h4 className="text-base font-semibold m-0">Observaciones</h4>
                                <Button
                                    icon="pi pi-plus"
                                    label="Agregar"
                                    className="p-button-text p-button-sm"
                                    disabled={loadingEval || !submissionDetail}
                                    onClick={() => setShowObservationForm(true)}
                                />
                            </div>
                            
                            {/* Formulario de nueva observación */}
                            {showObservationForm && (
                                <div className="mb-3 p-3 surface-100 border-round">
                                    <InputTextarea
                                        value={newObservationText}
                                        onChange={(e) => setNewObservationText(e.target.value)}
                                        placeholder="Escribe una observación sobre el desempeño del estudiante..."
                                        rows={3}
                                        className="w-full mb-2"
                                    />
                                    <div className="flex gap-2 justify-content-end">
                                        <Button
                                            label="Cancelar"
                                            icon="pi pi-times"
                                            className="p-button-text p-button-sm"
                                            onClick={() => {
                                                setShowObservationForm(false);
                                                setNewObservationText('');
                                            }}
                                            disabled={addingObservation}
                                        />
                                        <Button
                                            label="Guardar"
                                            icon="pi pi-check"
                                            className="p-button-sm"
                                            onClick={async () => {
                                                if (!token || !submissionDetail || !newObservationText.trim()) return;
                                                setAddingObservation(true);
                                                try {
                                                    const res = await fetch(`${API_BASE}/observations/`, {
                                                        method: 'POST',
                                                        headers: {
                                                            'Content-Type': 'application/json',
                                                            Authorization: `Bearer ${token}`,
                                                        },
                                                        body: JSON.stringify({ 
                                                            submission_id: submissionDetail.submission.id, 
                                                            text: newObservationText.trim() 
                                                        }),
                                                    });
                                                    if (!res.ok) {
                                                        const t = await res.text();
                                                        throw new Error(t || 'No se pudo agregar');
                                                    }
                                                    const created = await res.json();
                                                    setObservations((prev) => [...prev, created]);
                                                    setNewObservationText('');
                                                    setShowObservationForm(false);
                                                } catch (err) {
                                                    console.error('Error agregando observación', err);
                                                    setSubmissionDetailError('No se pudo agregar la observación');
                                                } finally {
                                                    setAddingObservation(false);
                                                }
                                            }}
                                            loading={addingObservation}
                                            disabled={!newObservationText.trim()}
                                        />
                                    </div>
                                </div>
                            )}
                            
                            {loadingEval ? (
                                <p className="text-sm text-600">Cargando observaciones...</p>
                            ) : observations && observations.length > 0 ? (
                                <ObservationsDisplay
                                    observations={observations}
                                    isTherapist={true}
                                    onAddObservation={async (text: string) => {
                                        if (!token || !submissionDetail) return;
                                        const res = await fetch(`${API_BASE}/observations/`, {
                                            method: 'POST',
                                            headers: {
                                                'Content-Type': 'application/json',
                                                Authorization: `Bearer ${token}`,
                                            },
                                            body: JSON.stringify({ submission_id: submissionDetail.submission.id, text }),
                                        });
                                        if (!res.ok) {
                                            const t = await res.text();
                                            throw new Error(t || 'No se pudo agregar');
                                        }
                                        const created = await res.json();
                                        setObservations((prev) => [...prev, created]);
                                    }}
                                />
                            ) : (
                                <p className="text-sm text-600">Sin observaciones</p>
                            )}
                        </div>
                        
                        {/* Rúbrica y Evaluación */}
                        <div className="surface-50 border-round-lg p-3">
                            <div className="flex justify-content-between align-items-center mb-3">
                                <h4 className="text-base font-semibold m-0">Rúbrica y Evaluación</h4>
                                <Button
                                    label="Evaluar"
                                    icon="pi pi-pencil"
                                    className="p-button-text p-button-sm"
                                    onClick={() => {
                                        if (submissionDetail?.submission.id) {
                                            router.push(`/courses/${slug}/exercises/${selectedExercise?.course_exercise_id}/submissions/${submissionDetail.submission.id}?studentId=${studentId}`);
                                        }
                                    }}
                                />
                            </div>
                            {loadingEval ? (
                                <p className="text-sm text-600">Cargando evaluación...</p>
                            ) : evaluation && rubric ? (
                                <RubricDisplay
                                    rubric={rubric}
                                    evaluation={evaluation}
                                />
                            ) : evaluation ? (
                                <p className="text-sm text-600">Evaluación sin rúbrica disponible</p>
                            ) : (
                                <p className="text-sm text-600">Sin evaluación</p>
                            )}
                        </div>
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
                        La entrega del ejercicio &quot;{canceledExerciseName}&quot; ha sido anulada. El modal de detalle se ha cerrado.
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

export default StudentProgressPage;
