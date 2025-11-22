'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from 'primereact/button';
import { TabMenu } from 'primereact/tabmenu';
import { Tag } from 'primereact/tag';
import { ProgressBar } from 'primereact/progressbar';
import { Dialog } from 'primereact/dialog';

import PublishExerciseDialog from './PublishExerciseDialog';

type Role = 'THERAPIST' | 'STUDENT';

interface BackendUser {
    id: number;
    full_name: string;
    email: string;
    role: Role;
}

interface Course {
    id: number;
    name: string;
    description?: string | null;
    join_code: string;
    therapist_id: number;
}

interface JoinRequest {
    id: number;
    course_id: number;
    student_id: number;
    status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
    created_at: string;
}

interface StudentInCourse {
    course_student_id: number;
    student_id: number;
    student_name: string;
    completed_exercises: number;
    total_exercises: number;
    last_submission_at?: string | null;
}

interface StudentProgressSummary {
    student_id: number;
    full_name: string;
    email: string;
    total_exercises: number;
    done_exercises: number;
    last_submission_at?: string | null;
}

interface CourseExercise {
    id: number;
    course_id: number;
    exercise_id: number;
    published_at: string;
    due_date?: string | null;
    is_deleted: boolean;
    exercise?: {
        id: number;
        name: string;
        text: string;
        created_at: string;
    } | null;
}

type SubmissionStatus = 'PENDING' | 'DONE';

interface StudentExerciseStatus {
    course_exercise_id: number;
    exercise_name: string;
    due_date?: string | null;
    status: SubmissionStatus;
    submitted_at?: string | null;
}

type StudentExerciseFilter = 'ALL' | 'PENDING' | 'DONE' | 'LATE';

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

    const showError = (msg: string) => setErrorMsg(msg);

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
                const res = await fetch('http://localhost:8000/courses/my', {
                    headers: { Authorization: `Bearer ${authToken}` },
                });

                if (!res.ok) {
                    console.error('Error obteniendo cursos:', await res.text());
                    showError('No se pudo obtener la información del curso.');
                    return;
                }

                const data: Course[] = await res.json();
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
                const res = await fetch(
                    `http://localhost:8000/course-exercises/${courseId}`,
                    {
                        headers: { Authorization: `Bearer ${token}` },
                    }
                );
                if (!res.ok) {
                    console.error('Error obteniendo ejercicios:', await res.text());
                    return;
                }
                const data: CourseExercise[] = await res.json();
                setExercises(data.filter((ce) => !ce.is_deleted));
            } catch (err) {
                console.error('Error de red al obtener ejercicios:', err);
            } finally {
                setLoadingExercises(false);
            }
        };

        if (role === 'THERAPIST') {
            const fetchRequests = async () => {
                try {
                    setLoadingRequests(true);
                    const res = await fetch(
                        `http://localhost:8000/courses/${courseId}/requests`,
                        {
                            headers: { Authorization: `Bearer ${token}` },
                        }
                    );
                    if (!res.ok) {
                        console.error('Error obteniendo solicitudes:', await res.text());
                        return;
                    }
                    const data: JoinRequest[] = await res.json();
                    setJoinRequests(data);
                } catch (err) {
                    console.error('Error de red al obtener solicitudes:', err);
                } finally {
                    setLoadingRequests(false);
                }
            };

            const fetchStudents = async () => {
                try {
                    setLoadingStudents(true);
                    const res = await fetch(
                        `http://localhost:8000/courses/${courseId}/students`,
                        {
                            headers: { Authorization: `Bearer ${token}` },
                        }
                    );
                    if (!res.ok) {
                        console.error('Error obteniendo estudiantes:', await res.text());
                        return;
                    }
                    const data: StudentInCourse[] = await res.json();
                    setStudents(data);
                } catch (err) {
                    console.error('Error de red al obtener estudiantes:', err);
                } finally {
                    setLoadingStudents(false);
                }
            };

            const fetchProgress = async () => {
                try {
                    setLoadingProgress(true);
                    const res = await fetch(
                        `http://localhost:8000/course-students/${courseId}/students/progress`,
                        {
                            headers: { Authorization: `Bearer ${token}` },
                        }
                    );
                    if (!res.ok) {
                        console.error('Error obteniendo progreso:', await res.text());
                        return;
                    }
                    const data: StudentProgressSummary[] = await res.json();
                    setProgressList(data);
                } catch (err) {
                    console.error('Error de red al obtener progreso:', err);
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
                    const res = await fetch(
                        `http://localhost:8000/course-students/${courseId}/me/exercises`,
                        {
                            headers: { Authorization: `Bearer ${token}` },
                        }
                    );
                    if (!res.ok) {
                        console.error(
                            'Error obteniendo ejercicios del estudiante:',
                            await res.text()
                        );
                        return;
                    }
                    const data: StudentExerciseStatus[] = await res.json();
                    setStudentExercises(data);
                } catch (err) {
                    console.error(
                        'Error de red al obtener ejercicios del estudiante:',
                        err
                    );
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
            const res = await fetch(
                `http://localhost:8000/courses/${course.id}/requests/${requestId}/decision`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ accept }),
                }
            );

            if (!res.ok) {
                const text = await res.text();
                console.error('Error actualizando solicitud:', text);
                showError(text || 'No se pudo actualizar la solicitud.');
                return;
            }

            setJoinRequests((prev) => prev.filter((r) => r.id !== requestId));
        } catch (err) {
            console.error('Error de red:', err);
            showError('Error de red al actualizar la solicitud.');
        }
    };

    const removeStudent = async (courseStudentId: number) => {
        if (!token || !course) return;
        if (!confirm('¿Eliminar a este estudiante del curso?')) return;

        try {
            const res = await fetch(
                `http://localhost:8000/courses/${course.id}/students/${courseStudentId}`,
                {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            if (!res.ok) {
                const text = await res.text();
                console.error('Error eliminando estudiante:', text);
                showError(text || 'No se pudo eliminar al estudiante.');
                return;
            }

            setStudents((prev) =>
                prev.filter((s) => s.course_student_id !== courseStudentId)
            );
        } catch (err) {
            console.error('Error de red:', err);
            showError('Error de red al eliminar estudiante.');
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
                                <div className="card flex flex-column gap-2">
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
                                <tr key={p.student_id} className="text-sm">
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
                                                onClick={() =>
                                                    router.push(
                                                        `/course-exercises/${ex.course_exercise_id}`
                                                    )
                                                }
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
                            <span className="text-xs text-indigo-100">
                                Código de curso
                            </span>
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
                {role === 'STUDENT' && activeTabIndex === 0 && renderStudentExercisesTab()}
            </div>

            {/* Modal publicar ejercicio (solo terapeuta) */}
            {role === 'THERAPIST' && course && token && (
                <PublishExerciseDialog
                    visible={publishVisible}
                    onHide={() => setPublishVisible(false)}
                    token={token}
                    courseId={course.id}
                    onPublished={() => {
                        // Recargar ejercicios publicados al cerrar
                        window.location.reload();
                    }}
                />
            )}

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

export default CoursePage;
