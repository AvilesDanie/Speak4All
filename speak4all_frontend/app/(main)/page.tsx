'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card } from 'primereact/card';
import { Tag } from 'primereact/tag';
import { ProgressBar } from 'primereact/progressbar';
import { Badge } from 'primereact/badge';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { getMyCourses, getCourseStudentsProgress, getCourseExercises, getStudentExercisesForCourse, getCourseJoinRequests, decideJoinRequest, type JoinRequest } from '@/services/courses';
import { useStoredNotifications } from '@/contexts/StoredNotificationContext';
import { useRouter } from 'next/navigation';

export default function Dashboard() {
    const { user, token, role, loading } = useAuth();
    const { notifications } = useStoredNotifications();
    const router = useRouter();
    
    const isTherapist = role === 'THERAPIST';
    const [loadingData, setLoadingData] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [overview, setOverview] = useState<{ title: string; value: number; delta: string; color: string; icon: string }[]>([]);
    const [progressBars, setProgressBars] = useState<{ label: string; value: number; courseId?: number }[]>([]);
    const [spotlight, setSpotlight] = useState<{ name: string; metric: string; color: string; courseId: number; slug?: string }[]>([]);
    const [studentsData, setStudentsData] = useState<any[]>([]);
    const [recentExercises, setRecentExercises] = useState<any[]>([]);
    const [studentCourses, setStudentCourses] = useState<any[]>([]);
    const [joinRequests, setJoinRequests] = useState<(JoinRequest & { courseName: string; studentEmail?: string })[]>([]);
    const [processingRequest, setProcessingRequest] = useState<number | null>(null);

    useEffect(() => {
        if (!token) return;

        const colors = ['#4f46e5', '#10b981', '#f59e0b', '#8b5cf6', '#6366f1', '#22c55e'];

        const loadTherapist = async () => {
            try {
                const coursesRes = await getMyCourses(token, 1, 10);
                const courses = (coursesRes as any).items || coursesRes || [];

                // Cargar datos completos de estudiantes por curso
                const studentsDataByCourse: any[] = [];
                const allExercises: any[] = [];

                for (const course of courses) {
                    const [studentsProgress, exercises] = await Promise.all([
                        getCourseStudentsProgress(token, course.id).catch(() => []),
                        getCourseExercises(token, course.id).catch(() => []),
                    ]);

                    // Agregar ejercicios a la lista global
                    (exercises as any[]).forEach((ex) => {
                        allExercises.push({
                            ...ex,
                            courseName: course.name,
                            courseId: course.id,
                        });
                    });

                    // Agregar estudiantes con info del curso
                    (studentsProgress as any[]).forEach((student) => {
                        studentsDataByCourse.push({
                            studentName: student.full_name || student.email || 'Sin nombre',
                            studentEmail: student.email || '',
                            courseName: course.name,
                            courseId: course.id,
                            totalExercises: student.total_exercises || 0,
                            doneExercises: student.done_exercises || 0,
                            progress: student.total_exercises > 0 
                                ? Math.round((student.done_exercises / student.total_exercises) * 100) 
                                : 0,
                        });
                    });
                }

                // Ordenar ejercicios por fecha de creación (más recientes primero)
                const sortedExercises = allExercises.sort((a, b) => {
                    const dateA = new Date(a.created_at || 0).getTime();
                    const dateB = new Date(b.created_at || 0).getTime();
                    return dateB - dateA;
                });

                setStudentsData(studentsDataByCourse);
                setRecentExercises(sortedExercises.slice(0, 5));

                // Cargar solicitudes de ingreso pendientes de todos los cursos
                const allRequests: (JoinRequest & { courseName: string })[] = [];
                for (const course of courses) {
                    try {
                        const requests = await getCourseJoinRequests(token, course.id);
                        (requests as JoinRequest[]).forEach((req) => {
                            if (req.status === 'PENDING') {
                                allRequests.push({
                                    ...req,
                                    courseName: course.name,
                                });
                            }
                        });
                    } catch (err) {
                        console.error(`Error loading requests for course ${course.id}:`, err);
                    }
                }
                setJoinRequests(allRequests);

                const totalStudents = studentsDataByCourse.length;
                const totalExercises = allExercises.length;
                const avgProgress = studentsDataByCourse.length > 0 
                    ? Math.round(studentsDataByCourse.reduce((acc, s) => acc + s.progress, 0) / studentsDataByCourse.length) 
                    : 0;

                setOverview([
                    { title: 'Cursos activos', value: courses.length, delta: 'gestionando', color: '#4f46e5', icon: 'pi-book' },
                    { title: 'Estudiantes', value: totalStudents, delta: 'totales', color: '#10b981', icon: 'pi-users' },
                    { title: 'Ejercicios publicados', value: totalExercises, delta: 'en tus cursos', color: '#8b5cf6', icon: 'pi-file' },
                ]);

                setProgressBars([]);
                setSpotlight([]);
            } catch (err: any) {
                setErrorMsg(err?.message || 'No se pudieron cargar datos');
            } finally {
                setLoadingData(false);
            }
        };

        const loadStudent = async () => {
            try {
                const coursesRes = await getMyCourses(token, 1, 10);
                const courses = (coursesRes as any).items || coursesRes || [];

                const perCourse = await Promise.all(
                    courses.slice(0, 5).map(async (course: any, idx: number) => {
                        const exercisesForMe = await getStudentExercisesForCourse(token, course.id).catch(() => []);
                        const total = (exercisesForMe as any[]).length;
                        const done = (exercisesForMe as any[]).filter((e: any) => e.status === 'DONE').length;
                        const pending = total - done;
                        const progress = total > 0 ? Math.round((done / total) * 100) : 0;
                        return {
                            name: course.name,
                            courseId: course.id,
                            slug: course.slug,
                            exercisesCount: total,
                            done,
                            pending,
                            progress,
                            color: colors[idx % colors.length],
                        };
                    })
                );

                const totalExercises = perCourse.reduce((acc, c) => acc + c.exercisesCount, 0);
                const totalDone = perCourse.reduce((acc, c) => acc + c.done, 0);
                const totalPending = perCourse.reduce((acc, c) => acc + c.pending, 0);
                const avgProgress = perCourse.length > 0 ? Math.round(perCourse.reduce((acc, c) => acc + c.progress, 0) / perCourse.length) : 0;

                setOverview([
                    { title: 'Cursos inscritos', value: courses.length, delta: `${perCourse.length} activos`, color: '#4f46e5', icon: 'pi-book' },
                    { title: 'Ejercicios completados', value: totalDone, delta: 'hechos', color: '#10b981', icon: 'pi-check-circle' },
                    { title: 'Ejercicios pendientes', value: totalPending, delta: 'por entregar', color: '#f59e0b', icon: 'pi-clock' },
                    { title: 'Progreso promedio', value: avgProgress, delta: '% de avance', color: '#8b5cf6', icon: 'pi-chart-line' },
                ]);

                setProgressBars(
                    perCourse.map((c) => ({
                        label: c.name,
                        value: c.progress,
                        courseId: c.courseId,
                    }))
                );

                setSpotlight(
                    perCourse.slice(0, 4).map((c) => ({ 
                        name: c.name, 
                        metric: `${c.progress}% completado`, 
                        color: c.color,
                        courseId: c.courseId,
                        slug: c.slug
                    }))
                );

                setStudentCourses(perCourse);
            } catch (err: any) {
                setErrorMsg(err?.message || 'No se pudieron cargar datos');
            } finally {
                setLoadingData(false);
            }
        };

        if (isTherapist) {
            loadTherapist();
        } else {
            loadStudent();
        }
    }, [token, isTherapist]);

    const timeline = useMemo(() => {
        const items = notifications?.slice(0, 4) || [];
        return items.map((n) => ({
            label: n.summary,
            detail: n.detail || '',
            time: n.timestamp ? new Date(n.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : ''
        }));
    }, [notifications]);

    const handleJoinRequestDecision = async (requestId: number, courseId: number, accept: boolean) => {
        if (!token) return;
        setProcessingRequest(requestId);
        try {
            await decideJoinRequest(token, courseId, requestId, accept);
            // Remover la solicitud de la lista
            setJoinRequests(prev => prev.filter(req => req.id !== requestId));
            // Recargar datos si se aceptó (para actualizar lista de estudiantes)
            if (accept && isTherapist) {
                const coursesRes = await getMyCourses(token, 1, 10);
                const courses = (coursesRes as any).items || coursesRes || [];
                const studentsDataByCourse: any[] = [];
                for (const course of courses) {
                    const studentsProgress = await getCourseStudentsProgress(token, course.id).catch(() => []);
                    (studentsProgress as any[]).forEach((student) => {
                        studentsDataByCourse.push({
                            studentName: student.full_name || student.email || 'Sin nombre',
                            studentEmail: student.email || '',
                            courseName: course.name,
                            courseId: course.id,
                            totalExercises: student.total_exercises || 0,
                            doneExercises: student.done_exercises || 0,
                            progress: student.total_exercises > 0 
                                ? Math.round((student.done_exercises / student.total_exercises) * 100) 
                                : 0,
                        });
                    });
                }
                setStudentsData(studentsDataByCourse);
            }
        } catch (err: any) {
            console.error('Error processing join request:', err);
            setErrorMsg(err?.message || 'Error al procesar la solicitud');
        } finally {
            setProcessingRequest(null);
        }
    };

    if (loading || loadingData) {
        return (
            <div className="flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
                <div className="text-center">
                    <i className="pi pi-spin pi-spinner" style={{ fontSize: '2rem' }} />
                    <p className="mt-3">Cargando tu dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="surface-ground min-h-screen p-4" style={{ maxWidth: '1200px', margin: '0 auto' }}>
            {/* Header con gradiente y datos del usuario */}
            <div
                className="p-5 mb-5 border-round-2xl"
                style={{
                    background: role === 'THERAPIST'
                        ? 'linear-gradient(135deg, var(--primary-color) 0%, var(--purple-500) 100%)'
                        : 'linear-gradient(135deg, var(--green-500) 0%, var(--green-400) 100%)',
                    color: 'var(--primary-color-text)'
                }}
            >
                <div className="flex align-items-center justify-content-between flex-wrap gap-3">
                    <div>
                        <div className="flex align-items-center gap-2 mb-2">
                            <i className="pi pi-comments" style={{ fontSize: '2rem' }} />
                            <h1 className="text-4xl font-bold m-0">Speak4All</h1>
                        </div>
                        <p className="text-xl m-0 opacity-90">
                            Bienvenido{user?.full_name ? `, ${user.full_name}` : ''}
                        </p>
                        <div className="flex align-items-center gap-2 mt-2">
                            <span
                                className="px-3 py-1 border-round-2xl text-sm font-semibold"
                                style={{ background: 'rgba(255,255,255,0.25)', backdropFilter: 'blur(10px)' }}
                            >
                                {role === 'THERAPIST' ? '👨‍⚕️ Terapeuta' : '👤 Estudiante'}
                            </span>
                            {user?.email && (
                                <span className="text-sm opacity-80">
                                    <i className="pi pi-envelope mr-1" />
                                    {user.email}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

                        {/* Solicitudes de ingreso (solo para terapeutas) */}
                        {isTherapist && (
                            <div className="col-12">
                                <Card className="shadow-2 border-round-xl">
                                    <div className="flex align-items-center justify-content-between mb-4">
                                        <h3 className="m-0 font-bold">
                                            <i className="pi pi-user-plus mr-2" style={{ color: 'var(--orange-500)' }} />
                                            Solicitudes de ingreso
                                        </h3>
                                        <Tag value={`${joinRequests.length} pendientes`} severity={joinRequests.length > 0 ? 'warning' : 'success'} />
                                    </div>
                                    {joinRequests.length === 0 ? (
                                        <div className="text-center p-5">
                                            <i className="pi pi-check-circle text-5xl mb-3 block" style={{ color: 'var(--text-color-secondary)' }} />
                                            <p className="m-0" style={{ color: 'var(--text-color-secondary)' }}>No hay solicitudes pendientes</p>
                                            <p className="m-0 text-sm mt-1" style={{ color: 'var(--text-color-secondary)', opacity: 0.7 }}>Las nuevas solicitudes aparecerán aquí</p>
                                        </div>
                                    ) : (
                                        <div className="flex flex-column gap-3">
                                            {joinRequests.map((request) => (
                                                <div 
                                                    key={request.id}
                                                    className="p-3 border-round-lg"
                                                    style={{ 
                                                        border: '1px solid var(--surface-border)',
                                                        background: 'var(--surface-50)'
                                                    }}
                                                >
                                                    <div className="flex align-items-start justify-content-between gap-3">
                                                        <div className="flex-1">
                                                            <div className="flex align-items-center gap-2 mb-2">
                                                                <i className="pi pi-user text-sm" style={{ color: 'var(--primary-color)' }} />
                                                                <span className="font-semibold">Nuevo estudiante</span>
                                                            </div>
                                                            <div className="flex align-items-center gap-2 mb-1">
                                                                <i className="pi pi-book text-xs" style={{ color: 'var(--text-color-secondary)' }} />
                                                                <span className="text-sm" style={{ color: 'var(--text-color-secondary)' }}>{request.courseName}</span>
                                                            </div>
                                                            <div className="flex align-items-center gap-2">
                                                                <i className="pi pi-calendar text-xs" style={{ color: 'var(--text-color-secondary)' }} />
                                                                <span className="text-xs" style={{ color: 'var(--text-color-secondary)' }}>
                                                                    {new Date(request.created_at).toLocaleDateString('es-ES', {
                                                                        year: 'numeric',
                                                                        month: 'short',
                                                                        day: 'numeric',
                                                                        hour: '2-digit',
                                                                        minute: '2-digit'
                                                                    })}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <Button 
                                                                icon="pi pi-check" 
                                                                severity="success"
                                                                size="small"
                                                                rounded
                                                                outlined
                                                                disabled={processingRequest === request.id}
                                                                loading={processingRequest === request.id}
                                                                onClick={() => handleJoinRequestDecision(request.id, request.course_id, true)}
                                                                tooltip="Aceptar"
                                                                tooltipOptions={{ position: 'top' }}
                                                            />
                                                            <Button 
                                                                icon="pi pi-times" 
                                                                severity="danger"
                                                                size="small"
                                                                rounded
                                                                outlined
                                                                disabled={processingRequest === request.id}
                                                                onClick={() => handleJoinRequestDecision(request.id, request.course_id, false)}
                                                                tooltip="Rechazar"
                                                                tooltipOptions={{ position: 'top' }}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </Card>
                            </div>
                        )}

            {errorMsg && (
                <Card className="shadow-1 border-round-2xl mb-4" style={{ border: '1px solid #f59e0b' }}>
                    <p className="m-0 text-700 text-sm">{errorMsg}</p>
                </Card>
            )}

            {/* Sección de métricas principales */}
            <div className="grid">
                <div className="col-12">
                    <div className="grid">
                        {overview.map((item) => (
                            <div key={item.title} className={`col-12 md:col-6 lg:col-${isTherapist ? '4' : '3'}`}>
                                <Card className="shadow-2 border-round-xl h-full" style={{ background: 'var(--surface-card)' }}>
                                    <div className="flex align-items-start justify-content-between mb-3">
                                        <div 
                                            className="flex align-items-center justify-content-center border-round-circle" 
                                            style={{ 
                                                width: '48px', 
                                                height: '48px', 
                                                backgroundColor: `${item.color}20`
                                            }}
                                        >
                                            <i className={`pi ${item.icon}`} style={{ fontSize: '1.5rem', color: item.color }} />
                                        </div>
                                        <Badge value={item.value} style={{ background: item.color, fontSize: '0.875rem' }} />
                                    </div>
                                    <h3 className="font-semibold mb-2" style={{ fontSize: '0.875rem', color: 'var(--text-color)' }}>{item.title}</h3>
                                    <p className="m-0" style={{ fontSize: '0.75rem', color: 'var(--text-color-secondary)' }}>{item.delta}</p>
                                </Card>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Columna izquierda: Tabla de estudiantes (terapeuta) o Progreso (estudiante) */}
                <div className="col-12 lg:col-8">
                    <div className="grid">
                        {isTherapist ? (
                            <div className="col-12">
                                <Card className="shadow-2 border-round-xl">
                                    <div className="flex align-items-center justify-content-between mb-4">
                                        <h3 className="m-0 font-bold">
                                            <i className="pi pi-users mr-2" style={{ color: 'var(--primary-color)' }} />
                                            Estudiantes y progreso por curso
                                        </h3>
                                        <Tag value={`${studentsData.length} estudiantes`} severity="success" icon="pi pi-check-circle" />
                                    </div>
                                    {studentsData.length === 0 ? (
                                        <p className="m-0 text-center p-4" style={{ color: 'var(--text-color-secondary)' }}>No hay estudiantes para mostrar</p>
                                    ) : (
                                        <DataTable 
                                            value={studentsData} 
                                            paginator 
                                            rows={10}
                                            className="p-datatable-sm"
                                        >
                                            <Column field="studentName" header="Estudiante" sortable />
                                            <Column field="courseName" header="Curso" sortable body={(rowData) => (
                                                <span 
                                                    className="cursor-pointer text-primary hover:underline"
                                                    onClick={() => router.push(`/courses/${rowData.courseId}`)}
                                                >
                                                    {rowData.courseName}
                                                </span>
                                            )} />
                                            <Column field="doneExercises" header="Completados" sortable body={(rowData) => (
                                                <span>{rowData.doneExercises} / {rowData.totalExercises}</span>
                                            )} />
                                            <Column field="progress" header="Progreso" sortable body={(rowData) => (
                                                <div className="flex align-items-center gap-2">
                                                    <ProgressBar 
                                                        value={rowData.progress} 
                                                        showValue={false}
                                                        style={{ width: '100px', height: '8px' }}
                                                        color={rowData.progress > 70 ? '#10b981' : rowData.progress > 40 ? '#f59e0b' : '#ef4444'}
                                                    />
                                                    <span className="font-semibold" style={{ color: rowData.progress > 70 ? '#10b981' : rowData.progress > 40 ? '#f59e0b' : '#ef4444' }}>
                                                        {rowData.progress}%
                                                    </span>
                                                </div>
                                            )} />
                                        </DataTable>
                                    )}
                                </Card>
                            </div>
                        ) : (
                            <>
                                <div className="col-12">
                                    <Card className="shadow-2 border-round-xl">
                                        <div className="flex align-items-center justify-content-between mb-4">
                                            <h3 className="m-0 font-bold">
                                                <i className="pi pi-chart-bar mr-2" style={{ color: 'var(--primary-color)' }} />
                                                Mi progreso en cursos
                                            </h3>
                                            <Tag value={`${progressBars.length} cursos`} severity="success" icon="pi pi-check-circle" />
                                        </div>
                                        <div className="flex flex-column gap-4">
                                            {progressBars.length === 0 && (
                                                <p className="m-0 text-center p-4" style={{ color: 'var(--text-color-secondary)' }}>No hay cursos para mostrar</p>
                                            )}
                                            {progressBars.map((bar) => (
                                                <div 
                                                    key={bar.label}
                                                    className="cursor-pointer hover:surface-50 p-2 border-round transition-colors"
                                                    onClick={() => bar.courseId && router.push(`/courses/${bar.courseId}`)}
                                                >
                                                    <div className="flex justify-content-between align-items-center mb-2">
                                                        <span className="font-semibold" style={{ fontSize: '0.875rem', color: 'var(--text-color)' }}>{bar.label}</span>
                                                        <span className="font-bold" style={{ fontSize: '1.125rem', color: bar.value > 70 ? '#10b981' : bar.value > 40 ? '#f59e0b' : '#ef4444' }}>{bar.value}%</span>
                                                    </div>
                                                    <ProgressBar 
                                                        value={bar.value} 
                                                        showValue={false} 
                                                        style={{ height: '0.75rem' }}
                                                        color={bar.value > 70 ? '#10b981' : bar.value > 40 ? '#f59e0b' : '#ef4444'}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </Card>
                                </div>

                                <div className="col-12">
                                    <Card className="shadow-2 border-round-xl">
                                        <div className="flex align-items-center justify-content-between mb-4">
                                            <h3 className="m-0 font-bold">
                                                <i className="pi pi-list mr-2" style={{ color: 'var(--green-500)' }} />
                                                Cursos y pendientes
                                            </h3>
                                            <Tag value={`${studentCourses.length} cursos`} severity="info" />
                                        </div>
                                        {studentCourses.length === 0 ? (
                                            <p className="m-0 text-center p-4" style={{ color: 'var(--text-color-secondary)' }}>No hay cursos para mostrar</p>
                                        ) : (
                                            <DataTable value={studentCourses} paginator rows={5} className="p-datatable-sm">
                                                <Column field="name" header="Curso" sortable body={(rowData) => (
                                                    <span 
                                                        className="cursor-pointer text-primary hover:underline"
                                                        onClick={() => rowData.courseId && router.push(`/courses/${rowData.courseId}`)}
                                                    >
                                                        {rowData.name}
                                                    </span>
                                                )} />
                                                <Column field="done" header="Completados" sortable body={(rowData) => (
                                                    <span>{rowData.done} / {rowData.exercisesCount}</span>
                                                )} />
                                                <Column field="pending" header="Pendientes" sortable />
                                                <Column field="progress" header="Progreso" sortable body={(rowData) => (
                                                    <div className="flex align-items-center gap-2">
                                                        <ProgressBar 
                                                            value={rowData.progress} 
                                                            showValue={false}
                                                            style={{ width: '100px', height: '8px' }}
                                                            color={rowData.progress > 70 ? '#10b981' : rowData.progress > 40 ? '#f59e0b' : '#ef4444'}
                                                        />
                                                        <span className="font-semibold" style={{ color: rowData.progress > 70 ? '#10b981' : rowData.progress > 40 ? '#f59e0b' : '#ef4444' }}>
                                                            {rowData.progress}%
                                                        </span>
                                                    </div>
                                                )} />
                                            </DataTable>
                                        )}
                                    </Card>
                                </div>
                            </>
                        )}

                        <div className="col-12">
                            <Card className="shadow-2 border-round-xl">
                                <div className="flex align-items-center justify-content-between mb-4">
                                    <h3 className="m-0 font-bold">
                                        <i className="pi pi-clock mr-2" style={{ color: 'var(--purple-500)' }} />
                                        Actividad reciente
                                    </h3>
                                    <Tag value={`${timeline.length} eventos`} severity="info" />
                                </div>
                                <div className="flex flex-column gap-3">
                                    {timeline.length === 0 && (
                                        <div className="text-center p-5">
                                            <i className="pi pi-inbox text-5xl mb-3 block" style={{ color: 'var(--text-color-secondary)' }} />
                                            <p className="m-0" style={{ color: 'var(--text-color-secondary)' }}>Sin actividad reciente</p>
                                            <p className="m-0 text-sm mt-1" style={{ color: 'var(--text-color-secondary)', opacity: 0.7 }}>Las notificaciones aparecerán aquí automáticamente</p>
                                        </div>
                                    )}
                                    {timeline.map((item, idx) => (
                                        <div key={idx} className="flex align-items-start gap-3 p-3 border-round-lg hover:surface-100 transition-colors">
                                            <div className="flex align-items-center justify-content-center border-round-circle" style={{ minWidth: '36px', height: '36px', background: 'var(--primary-color)', opacity: 0.2 }}>
                                                <i className="pi pi-bell" style={{ color: 'var(--primary-color)' }} />
                                            </div>
                                            <div className="flex-1">
                                                <p className="m-0 font-semibold" style={{ color: 'var(--text-color)' }}>{item.label}</p>
                                                <p className="m-0 text-sm mt-1" style={{ color: 'var(--text-color-secondary)' }}>{item.detail}</p>
                                            </div>
                                            <span className="text-xs white-space-nowrap" style={{ color: 'var(--text-color-secondary)' }}>{item.time}</span>
                                        </div>
                                    ))}
                                </div>
                            </Card>
                        </div>
                    </div>
                </div>

                {/* Columna derecha: Ejercicios recientes (terapeuta) o Cursos destacados (estudiante) */}
                <div className="col-12 lg:col-4">
                    {isTherapist ? (
                        <Card className="shadow-2 border-round-xl h-full">
                            <div className="flex align-items-center justify-content-between mb-4">
                                <h3 className="m-0 font-bold">
                                    <i className="pi pi-file-edit mr-2" style={{ color: 'var(--purple-500)' }} />
                                    Ejercicios recientes
                                </h3>
                                <Tag value={`${recentExercises.length}`} severity="info" />
                            </div>
                            <div className="flex flex-column gap-3 mb-4">
                                {recentExercises.length === 0 && (
                                    <div className="text-center p-4">
                                        <i className="pi pi-inbox text-4xl mb-2 block" style={{ color: 'var(--text-color-secondary)' }} />
                                        <p className="m-0 text-sm" style={{ color: 'var(--text-color-secondary)' }}>No hay ejercicios recientes</p>
                                    </div>
                                )}
                                {recentExercises.map((exercise, idx) => (
                                    <div 
                                        key={exercise.id || idx} 
                                        className="p-3 border-round-lg hover:surface-100 transition-colors"
                                        style={{ 
                                            borderLeft: '4px solid var(--purple-500)',
                                            background: 'var(--surface-50)'
                                        }}
                                    >
                                        <div className="flex align-items-start justify-content-between mb-2">
                                            <span className="font-semibold text-sm" style={{ color: 'var(--text-color)' }}>{exercise.exercise?.name || exercise.name || exercise.title || 'Sin título'}</span>
                                        </div>
                                        <div className="flex align-items-center gap-2 mb-1">
                                            <i className="pi pi-book text-xs" style={{ color: 'var(--text-color-secondary)' }} />
                                            <span className="text-xs" style={{ color: 'var(--text-color-secondary)' }}>{exercise.courseName}</span>
                                        </div>
                                        {exercise.created_at && (
                                            <div className="flex align-items-center gap-2">
                                                <i className="pi pi-calendar text-xs" style={{ color: 'var(--text-color-secondary)' }} />
                                                <span className="text-xs" style={{ color: 'var(--text-color-secondary)' }}>
                                                    {new Date(exercise.created_at).toLocaleDateString('es-ES')}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <Button 
                                label="Ver todos los ejercicios" 
                                icon="pi pi-arrow-right" 
                                className="w-full" 
                                severity="secondary"
                                onClick={() => router.push('/exercises')}
                            />
                        </Card>
                    ) : (
                        <Card className="shadow-2 border-round-xl h-full">
                            <div className="flex align-items-center justify-content-between mb-4">
                                <h3 className="m-0 font-bold">
                                    <i className="pi pi-bookmark mr-2" style={{ color: 'var(--green-500)' }} />
                                    Mis cursos
                                </h3>
                                <Tag value="Aprendiendo" severity="success" />
                            </div>
                            <div className="flex flex-column gap-3">
                                {spotlight.length === 0 && (
                                    <div className="text-center p-4">
                                        <i className="pi pi-book text-4xl mb-2 block" style={{ color: 'var(--text-color-secondary)' }} />
                                        <p className="m-0 text-sm" style={{ color: 'var(--text-color-secondary)' }}>No hay cursos disponibles</p>
                                    </div>
                                )}
                                {spotlight.map((course, idx) => (
                                    <div 
                                        key={course.name} 
                                        className="p-3 border-round-lg cursor-pointer hover:surface-100 transition-colors"
                                        style={{ 
                                            borderLeft: `4px solid ${course.color}`,
                                            background: 'var(--surface-50)'
                                        }}
                                        onClick={() => router.push(`/courses/${course.courseId}`)}
                                    >
                                        <div className="flex align-items-center justify-content-between mb-2">
                                            <span className="font-semibold" style={{ color: 'var(--text-color)' }}>{course.name}</span>
                                            <i className="pi pi-arrow-right text-sm" style={{ color: 'var(--text-color-secondary)' }} />
                                        </div>
                                        <div className="flex align-items-center gap-2">
                                            <i className="pi pi-chart-pie text-xs" style={{ color: course.color }} />
                                            <span className="text-sm font-medium" style={{ color: course.color }}>{course.metric}</span>
                                        </div>
                                        <ProgressBar 
                                            value={parseInt(course.metric) || 0} 
                                            showValue={false} 
                                            style={{ height: '4px', marginTop: '0.5rem' }}
                                            color={course.color}
                                        />
                                    </div>
                                ))}
                            </div>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}
