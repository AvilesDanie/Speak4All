// app/(main)/courses/page.tsx
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Tag } from 'primereact/tag';
import { Dialog } from 'primereact/dialog';
import { useRouter } from 'next/navigation';

import CreateCourseDialog from './CreateCourseDialog';
import JoinCourseDialog from './JoinCourseDialog';
import CourseDetailsDialog from './CourseDetailsDialog';

type Role = 'THERAPIST' | 'STUDENT';

interface Course {
    id: number;
    name: string;
    description?: string | null;
    join_code: string;
    therapist_id: number;
}

const NAME_LIMIT = 40;
const DESC_LIMIT = 90;


const CoursesPage: React.FC = () => {
    const [role, setRole] = useState<Role | null>(null);
    const [token, setToken] = useState<string | null>(null);

    const [courses, setCourses] = useState<Course[]>([]);
    const [filteredCourses, setFilteredCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [showJoinDialog, setShowJoinDialog] = useState(false);

    const [successVisible, setSuccessVisible] = useState(false);
    const [successMessage, setSuccessMessage] = useState(
        'Tu solicitud ha sido enviada correctamente.'
    );

    const [copiedCode, setCopiedCode] = useState<string | null>(null);


    const [detailsVisible, setDetailsVisible] = useState(false);
    const [detailsCourse, setDetailsCourse] = useState<Course | null>(null);

    const openDetails = (course: Course) => {
        setDetailsCourse(course);
        setDetailsVisible(true);
    };

    const handleJoinSuccess = (msg?: string) => {
        setSuccessMessage(
            msg ||
            'Tu solicitud para unirte al curso ha sido enviada. Espera la aprobación de tu terapeuta.'
        );
        setSuccessVisible(true);
    };

    const router = useRouter();


    // ───────────────────────
    // Cargar user + token + cursos
    // ───────────────────────
    const loadCourses = useCallback(
        async (authToken: string) => {
            try {
                setLoading(true);
                const res = await fetch('http://localhost:8000/courses/my', {
                    headers: {
                        Authorization: `Bearer ${authToken}`,
                    },
                });

                if (!res.ok) {
                    console.error('Error obteniendo cursos:', await res.text());
                    setCourses([]);
                    setFilteredCourses([]);
                    return;
                }

                const data: Course[] = await res.json();
                setCourses(data);
                setFilteredCourses(data);
            } catch (err) {
                console.error('Error de red al obtener cursos:', err);
            } finally {
                setLoading(false);
            }
        },
        []
    );

    useEffect(() => {
        if (typeof window === 'undefined') return;

        // rol desde backend_user
        const userRaw = window.localStorage.getItem('backend_user');
        if (userRaw) {
            try {
                const user = JSON.parse(userRaw);
                setRole(user.role as Role);
            } catch {
                setRole(null);
            }
        }

        const storedToken = window.localStorage.getItem('backend_token');
        setToken(storedToken);

        if (!storedToken) {
            setLoading(false);
            return;
        }

        loadCourses(storedToken);
    }, [loadCourses]);

    // ───────────────────────
    // Filtro de búsqueda
    // ───────────────────────
    useEffect(() => {
        if (!search.trim()) {
            setFilteredCourses(courses);
            return;
        }

        const lower = search.toLowerCase();
        setFilteredCourses(
            courses.filter(
                (c) =>
                    c.name.toLowerCase().includes(lower) ||
                    (c.description ?? '').toLowerCase().includes(lower) ||
                    c.join_code.toLowerCase().includes(lower)
            )
        );
    }, [search, courses]);

    // ───────────────────────
    // Acciones
    // ───────────────────────
    const handlePrimaryAction = () => {
        if (role === 'THERAPIST') {
            setShowCreateDialog(true);
        } else if (role === 'STUDENT') {
            setShowJoinDialog(true);
        }
    };

    const goToCourse = (course: Course) => {
        router.push(`/courses/${course.join_code}`);
    };

    const primaryLabel =
        role === 'THERAPIST' ? 'Crear curso' : role === 'STUDENT' ? 'Unirse a un curso' : 'Acción';

    const primaryIcon = role === 'THERAPIST' ? 'pi pi-plus' : 'pi pi-sign-in';

    // ───────────────────────
    // Copiar código
    // ───────────────────────
    const handleCopyCode = async (code: string) => {
        try {
            if (navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(code);
                setCopiedCode(code);
                setTimeout(() => setCopiedCode(null), 2000);
            }
        } catch (e) {
            console.error('No se pudo copiar el código', e);
        }
    };

    // ───────────────────────
    // Colores
    // ───────────────────────


    // Gradientes disponibles para los cursos
    const COURSE_GRADIENTS = [
        'linear-gradient(135deg,#4f46e5 0%,#8b5cf6 40%,#0ea5e9 100%)',
        'linear-gradient(135deg,#ec4899 0%,#f97316 40%,#facc15 100%)',
        'linear-gradient(135deg,#10b981 0%,#22c55e 40%,#14b8a6 100%)',
        'linear-gradient(135deg,#6366f1 0%,#a855f7 40%,#f97316 100%)',
        'linear-gradient(135deg,#0ea5e9 0%,#22c55e 40%,#84cc16 100%)',
        'linear-gradient(135deg,#f97316 0%,#ef4444 40%,#ec4899 100%)',
    ];

    // Hash simple para obtener siempre el mismo índice por curso
    function getCourseGradient(name: string, description?: string | null): string {
        const key = `${name}|${description ?? ''}`;
        let hash = 0;

        for (let i = 0; i < key.length; i++) {
            hash = (hash * 31 + key.charCodeAt(i)) >>> 0; // >>>0 = entero positivo
        }

        const index = hash % COURSE_GRADIENTS.length;
        return COURSE_GRADIENTS[index];
    }


    // ───────────────────────────
    // 1) Estado de carga
    // ───────────────────────────
    if (loading) {
        return (
            <div
                className="flex justify-content-center align-items-center"
                style={{ minHeight: '60vh' }}
            >
                <div className="text-center">
                    <i className="pi pi-spin pi-spinner" style={{ fontSize: '2rem' }} />
                    <p className="mt-3">Cargando tus cursos...</p>
                </div>

                {/* Modales montados pero ocultos */}
                <CreateCourseDialog
                    visible={false}
                    onHide={() => { }}
                    token={token}
                />
                <JoinCourseDialog
                    visible={false}
                    onHide={() => { }}
                    token={token}
                />
            </div>
        );
    }

    // ───────────────────────────
    // 2) Sin cursos
    // ───────────────────────────
    if (!filteredCourses.length && !courses.length) {
        return (
            <div
                className="flex justify-content-center align-items-center"
                style={{ minHeight: '70vh', position: 'relative' }}
            >
                <div
                    className="surface-card border-round-3xl shadow-3 p-4 md:p-5 text-center"
                    style={{ maxWidth: '640px', width: '100%' }}
                >
                    <div className="mb-3">
                        <i
                            className="pi pi-book"
                            style={{ fontSize: '3rem', color: '#4f46e5' }}
                        />
                    </div>

                    <h2 className="text-2xl md:text-3xl font-bold mb-2">
                        {role === 'THERAPIST'
                            ? 'Aún no has creado ningún curso'
                            : role === 'STUDENT'
                                ? 'Todavía no te has unido a ningún curso'
                                : 'No hay cursos disponibles'}
                    </h2>

                    <p className="text-600 mb-4">
                        {role === 'THERAPIST'
                            ? 'Crea tu primer curso para comenzar a invitar estudiantes y organizar tus sesiones.'
                            : role === 'STUDENT'
                                ? 'Pide a tu terapeuta el código de curso o espera una invitación para unirte.'
                                : 'Inicia sesión o espera a que tu terapeuta te asigne un curso.'}
                    </p>

                    {role && (
                        <Button
                            label={primaryLabel}
                            icon={primaryIcon}
                            onClick={handlePrimaryAction}
                            className="p-button-lg"
                        />
                    )}
                </div>

                {/* Modales */}
                <CreateCourseDialog
                    visible={showCreateDialog}
                    onHide={() => setShowCreateDialog(false)}
                    token={token}
                    onCreated={() => {
                        if (token) loadCourses(token);
                    }}
                />
                <JoinCourseDialog
                    visible={showJoinDialog}
                    onHide={() => setShowJoinDialog(false)}
                    token={token}
                    onJoined={() => {
                        if (token) loadCourses(token);
                    }}
                    onSuccess={handleJoinSuccess}
                />
                <Dialog
                    header="Solicitud enviada"
                    visible={successVisible}
                    modal
                    style={{ width: '26rem', maxWidth: '95vw' }}
                    onHide={() => setSuccessVisible(false)}
                >
                    <div className="flex align-items-center justify-content-center flex-column text-center p-3">
                        <i
                            className="pi pi-check-circle mb-3"
                            style={{ fontSize: '3rem', color: '#10b981' }}
                        />
                        <p className="m-0 text-700" style={{ whiteSpace: 'pre-line' }}>
                            {successMessage}
                        </p>
                        <Button
                            label="Aceptar"
                            className="mt-4"
                            onClick={() => setSuccessVisible(false)}
                        />
                    </div>
                </Dialog>
            </div>
        );
    }

    // ───────────────────────────
    // 3) Hay cursos
    // ───────────────────────────
    return (
        <div className="surface-ground" style={{ minHeight: '60vh', position: 'relative' }}>
            <div className="flex justify-content-between align-items-center mb-3">
                <div>
                    <h2 className="text-2xl font-bold mb-1">Mis cursos</h2>
                    <p className="text-600 m-0">
                        {courses.length} curso{courses.length !== 1 ? 's' : ''} en total
                    </p>
                </div>

                <div className="flex align-items-center gap-2">
                    <span className="p-input-icon-left">
                        <i className="pi pi-search" />
                        <InputText
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Buscar curso o código"
                            style={{ width: '14rem' }}
                        />
                    </span>
                </div>
            </div>

            <div className="grid">
                {filteredCourses.map((course) => {
                    const isNameLong = course.name.length > NAME_LIMIT;
                    const isDescLong = (course.description?.length || 0) > DESC_LIMIT;

                    const displayName = isNameLong
                        ? course.name.slice(0, NAME_LIMIT) + '…'
                        : course.name;

                    const displayDesc =
                        course.description && isDescLong
                            ? course.description.slice(0, DESC_LIMIT) + '…'
                            : course.description ?? '';

                    return (
                        <div key={course.id} className="col-12 sm:col-6 lg:col-4">
                            <div
                                className="card cursor-pointer border-none shadow-3 overflow-hidden h-full transition-all hover:shadow-5"
                                style={{ borderRadius: '1.5rem' }}
                                onClick={() => goToCourse(course)}
                            >
                                {/* Encabezado tipo Classroom, más grande y con color por curso */}
                                <div
                                    style={{
                                        background: getCourseGradient(course.name, course.description),
                                        color: '#f9fafb',
                                        padding: '1.25rem 1.5rem',
                                    }}
                                >
                                    <div className="flex align-items-start gap-2">
                                        {/* Contenedor del título: ocupa el espacio disponible pero deja sitio al icono */}
                                        <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                                            <h3
                                                className="m-0 text-xl md:text-2xl font-semibold tracking-tight"
                                                style={{
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                }}
                                            >
                                                {displayName} {/* o directamente course.name si quieres */}
                                            </h3>

                                            {course.description && (
                                                <p
                                                    className="m-0 mt-2 text-sm md:text-base"
                                                    style={{
                                                        opacity: 0.96,
                                                        display: '-webkit-box',
                                                        WebkitLineClamp: 2,
                                                        WebkitBoxOrient: 'vertical',
                                                        overflow: 'hidden',
                                                    } as React.CSSProperties}
                                                >
                                                    {displayDesc}
                                                </p>
                                            )}

                                            {(isNameLong || isDescLong) && (
                                                <Button
                                                    label="Ver más"
                                                    className="p-button-text p-button-sm p-0 mt-2"
                                                    style={{ color: '#f9fafb', fontWeight: 500 }}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        openDetails(course);
                                                    }}
                                                />
                                            )}
                                        </div>

                                        {/* Icono: ancho fijo, no se deforma ni se va para afuera */}
                                        <i
                                            className="pi pi-book"
                                            style={{
                                                flex: '0 0 auto',
                                                fontSize: '2.2rem',
                                                opacity: 0.92,
                                            }}
                                        />
                                    </div>
                                </div>

                                {/* Body */}
                                <div className="p-3 flex flex-column gap-2">
                                    {role === 'THERAPIST' ? (
                                        // 🔹 Vista TERAPEUTA: código grande + botón copiar
                                        <>
                                            <span className="text-sm text-600 mb-1">
                                                Código de curso:
                                            </span>
                                            <div className="flex align-items-center justify-content-between gap-3">
                                                <span
                                                    className="px-3 py-2 border-round-xl text-lg font-semibold"
                                                    style={{
                                                        background: '#eef2ff',
                                                        color: '#4f46e5',
                                                        letterSpacing: '0.08em',
                                                    }}
                                                >
                                                    {course.join_code}
                                                </span>
                                                <Button
                                                    icon={
                                                        copiedCode === course.join_code
                                                            ? 'pi pi-check'
                                                            : 'pi pi-copy'
                                                    }
                                                    label={
                                                        copiedCode === course.join_code
                                                            ? 'Copiado'
                                                            : 'Copiar'
                                                    }
                                                    className="p-button-text"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleCopyCode(course.join_code);
                                                    }}
                                                />
                                            </div>
                                        </>
                                    ) : (
                                        // 🔹 Vista ESTUDIANTE: mismo estilo anterior
                                        <div className="flex align-items-center justify-content-between">
                                            <span className="text-sm text-600">
                                                Código de curso:
                                            </span>
                                            <Tag
                                                value={course.join_code}
                                                rounded
                                                style={{
                                                    background: '#eef2ff',
                                                    color: '#4f46e5',
                                                    borderRadius: '999px',
                                                }}
                                            />
                                        </div>
                                    )}

                                    {role === 'STUDENT' && (
                                        <p className="text-sm text-600 m-0 mt-2">
                                            Curso asignado por tu terapeuta.
                                        </p>
                                    )}

                                    <div className="mt-3 flex justify-content-between align-items-center">
                                        <Button
                                            label="Entrar al curso"
                                            icon="pi pi-arrow-right"
                                            className="p-button-text p-0"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                goToCourse(course);
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Botón flotante crear/unirse */}
            {role && (
                <Button
                    label={primaryLabel}
                    icon={primaryIcon}
                    className="p-button-rounded p-button-lg shadow-4"
                    onClick={handlePrimaryAction}
                    style={{
                        position: 'fixed',
                        bottom: '2rem',
                        right: '2rem',
                        zIndex: 20,
                        background:
                            role === 'THERAPIST'
                                ? 'linear-gradient(135deg,#4f46e5,#8b5cf6)'
                                : 'linear-gradient(135deg,#10b981,#22c55e)',
                        border: 'none',
                    }}
                />
            )}

            {/* Modales */}
            <CreateCourseDialog
                visible={showCreateDialog}
                onHide={() => setShowCreateDialog(false)}
                token={token}
                onCreated={() => {
                    if (token) loadCourses(token);
                }}
            />
            <JoinCourseDialog
                visible={showJoinDialog}
                onHide={() => setShowJoinDialog(false)}
                token={token}
                onJoined={() => {
                    if (token) loadCourses(token);
                }}
                onSuccess={handleJoinSuccess}
            />

            <Dialog
                header="Solicitud enviada"
                visible={successVisible}
                modal
                style={{ width: '26rem', maxWidth: '95vw' }}
                onHide={() => setSuccessVisible(false)}
            >
                <div className="flex align-items-center justify-content-center flex-column text-center p-3">
                    <i
                        className="pi pi-check-circle mb-3"
                        style={{ fontSize: '3rem', color: '#10b981' }}
                    />
                    <p className="m-0 text-700" style={{ whiteSpace: 'pre-line' }}>
                        {successMessage}
                    </p>
                    <Button
                        label="Aceptar"
                        className="mt-4"
                        onClick={() => setSuccessVisible(false)}
                    />
                </div>
            </Dialog>

            <CourseDetailsDialog
                visible={detailsVisible}
                onHide={() => setDetailsVisible(false)}
                course={detailsCourse}
            />
        </div>

    );
};

export default CoursesPage;
