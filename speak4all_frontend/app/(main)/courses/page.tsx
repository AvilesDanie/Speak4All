// app/(main)/courses/page.tsx
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Tag } from 'primereact/tag';
import { Dialog } from 'primereact/dialog';
import { ColorPicker } from 'primereact/colorpicker';
import { Paginator, PaginatorPageChangeEvent } from 'primereact/paginator';
import { Dropdown } from 'primereact/dropdown';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

import CreateCourseDialog from './CreateCourseDialog';
import JoinCourseDialog from './JoinCourseDialog';
import CourseDetailsDialog from './CourseDetailsDialog';

import {
    Course,
    CourseGroup,
    getMyCourses,
    getCourseGroups,
    getGroupCourses,
    createCourseGroup,
    deleteCourseGroup,
    assignCourseToGroup as serviceAssignCourseToGroup,
    removeCourseFromGroup,
    deleteCourse as serviceDeleteCourse,
} from '@/services/courses';

const NAME_LIMIT = 40;
const DESC_LIMIT = 90;


const CoursesPage: React.FC = () => {
    const { token, role, loading: authLoading } = useAuth();
    const router = useRouter();

    // Base
    const [courses, setCourses] = useState<Course[]>([]);
    const [filteredCourses, setFilteredCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    // Paginación
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [totalCourses, setTotalCourses] = useState(0);
    const [totalPages, setTotalPages] = useState(0);

    // Modales curso
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [showJoinDialog, setShowJoinDialog] = useState(false);
    const [detailsVisible, setDetailsVisible] = useState(false);
    const [detailsCourse, setDetailsCourse] = useState<Course | null>(null);
    const [successVisible, setSuccessVisible] = useState(false);
    const [successMessage, setSuccessMessage] = useState('Tu solicitud ha sido enviada correctamente.');
    const [copiedCode, setCopiedCode] = useState<string | null>(null);

    // Eliminación
    const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
    const [courseToDelete, setCourseToDelete] = useState<Course | null>(null);
    const [deleting, setDeleting] = useState(false);

    // Grupos
    const [groups, setGroups] = useState<CourseGroup[]>([]);
    const [groupAssignments, setGroupAssignments] = useState<Record<number, number[]>>({}); // group_id -> course_ids
    const [groupFilter, setGroupFilter] = useState<number | 'ALL'>('ALL');
    const [showCreateGroup, setShowCreateGroup] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupColor, setNewGroupColor] = useState('4f46e5');
    const [savingGroup, setSavingGroup] = useState(false);
    const [assigningGroupCourseId, setAssigningGroupCourseId] = useState<number | null>(null);
    const [assignGroupDialogVisible, setAssignGroupDialogVisible] = useState(false);
    const [assignGroupCourse, setAssignGroupCourse] = useState<Course | null>(null);
    const [selectedGroupId, setSelectedGroupId] = useState<number | ''>('');
    const [deleteGroupVisible, setDeleteGroupVisible] = useState(false);
    const [groupToDelete, setGroupToDelete] = useState<CourseGroup | null>(null);
    const [deletingGroup, setDeletingGroup] = useState(false);
    const [manageGroupsVisible, setManageGroupsVisible] = useState(false);

    // Helper para obtener color de texto contrastante
    const getContrastColor = (hexColor?: string | null): string => {
        if (!hexColor) return '#000000';
        const hex = hexColor.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance > 0.5 ? '#000000' : '#ffffff';
    };

    const openDetails = (course: Course) => {
        setDetailsCourse(course);
        setDetailsVisible(true);
    };

    const handleJoinSuccess = (msg?: string) => {
        setSuccessMessage(
            msg || 'Tu solicitud para unirte al curso ha sido enviada. Espera la aprobación de tu terapeuta.'
        );
        setSuccessVisible(true);
    };

    // Cargar cursos
    const loadCourses = useCallback(async (authToken: string, currentPage: number, currentPageSize: number) => {
        try {
            setLoading(true);
            const data = await getMyCourses(authToken, currentPage, currentPageSize);
            setCourses(data.items);
            setTotalCourses(data.total);
            setTotalPages(data.total_pages);
        } catch (err) {
            console.error('Error obteniendo cursos:', err);
            setCourses([]);
            setTotalCourses(0);
            setTotalPages(0);
        } finally {
            setLoading(false);
        }
    }, []);

    // Cargar grupos
    const loadGroups = useCallback(async (authToken: string) => {
        try {
            const data = await getCourseGroups(authToken);
            setGroups(data);
            const assignments: Record<number, number[]> = {};
            await Promise.all(
                data.map(async (g) => {
                    try {
                        const courses = await getGroupCourses(authToken, g.id);
                        assignments[g.id] = courses.map((c) => c.id);
                    } catch {
                        // ignore individual group fetch errors
                    }
                })
            );
            setGroupAssignments(assignments);
        } catch (err) {
            console.error('Error obteniendo grupos:', err);
        }
    }, []);

    useEffect(() => {
        if (authLoading) return;
        if (!token) {
            setLoading(false);
            return;
        }
        loadCourses(token, page, pageSize);
        loadGroups(token);
    }, [authLoading, token, page, pageSize, loadCourses, loadGroups]);

    // Filtro combinado
    useEffect(() => {
        const base = groupFilter === 'ALL' ? courses : courses.filter((c) => (groupAssignments[groupFilter] || []).includes(c.id));
        if (!search.trim()) {
            setFilteredCourses(base);
            return;
        }
        const lower = search.toLowerCase();
        setFilteredCourses(
            base.filter(
                (c) =>
                    c.name.toLowerCase().includes(lower) ||
                    (c.description ?? '').toLowerCase().includes(lower) ||
                    c.join_code.toLowerCase().includes(lower)
            )
        );
    }, [search, courses, groupFilter, groupAssignments]);

    // Crear grupo
    const handleCreateGroup = async () => {
        if (!token || !newGroupName.trim()) return;
        setSavingGroup(true);
        try {
            const g = await createCourseGroup(token, newGroupName.trim(), newGroupColor);
            setGroups((prev) => [g, ...prev]);
            setGroupAssignments((prev) => ({ ...prev, [g.id]: [] }));
            setShowCreateGroup(false);
            setNewGroupName('');
            await loadGroups(token);
        } catch (err) {
            console.error('Error creando grupo:', err);
        } finally {
            setSavingGroup(false);
        }
    };

    // Asignar curso a grupo (MVP: un grupo máximo)
    const assignCourseToGroup = async (course: Course, targetGroupId: number | null) => {
        if (!token) return;
        setAssigningGroupCourseId(course.id);
        try {
            const current = Object.entries(groupAssignments).filter(([, ids]) => ids.includes(course.id));
            for (const [gid] of current) {
                await removeCourseFromGroup(token, Number(gid), course.id);
            }
            if (targetGroupId !== null) {
                await serviceAssignCourseToGroup(token, targetGroupId, course.id);
            }
            await loadGroups(token);
        } catch (err) {
            console.error('Error asignando curso al grupo:', err);
        } finally {
            setAssigningGroupCourseId(null);
        }
    };

    // Acciones generales
    const handlePrimaryAction = () => {
        if (role === 'THERAPIST') setShowCreateDialog(true);
        else if (role === 'STUDENT') setShowJoinDialog(true);
    };

    const handlePageChange = (event: PaginatorPageChangeEvent) => {
        setPage(event.page + 1); // Paginator usa base 0, backend usa base 1
        setPageSize(event.rows);
    };
    const goToCourse = (course: Course) => router.push(`/courses/${course.join_code}`);
    const primaryLabel = role === 'THERAPIST' ? 'Crear curso' : role === 'STUDENT' ? 'Unirse a un curso' : 'Acción';
    const primaryIcon = role === 'THERAPIST' ? 'pi pi-plus' : 'pi pi-sign-in';

    const handleCopyCode = async (code: string) => {
        try {
            await navigator.clipboard.writeText(code);
            setCopiedCode(code);
            setTimeout(() => setCopiedCode(null), 2000);
        } catch { console.error('No se pudo copiar el código'); }
    };

    const handleDeleteGroup = async () => {
        if (!groupToDelete || !token) return;
        setDeletingGroup(true);
        try {
            await deleteCourseGroup(token, groupToDelete.id);
            await loadGroups(token);
            setDeleteGroupVisible(false);
            setGroupToDelete(null);
            if (groupFilter === groupToDelete.id) setGroupFilter('ALL');
        } catch (err) {
            console.error('Error eliminando grupo:', err);
        } finally {
            setDeletingGroup(false);
        }
    };

    const handleDeleteCourse = async () => {
        if (!courseToDelete || !token) return;
        setDeleting(true);
        try {
            await serviceDeleteCourse(token, courseToDelete.id);
            await loadCourses(token, page, pageSize);
            setDeleteConfirmVisible(false);
            setCourseToDelete(null);
        } catch (err) {
            console.error('Error eliminando curso:', err);
        } finally { setDeleting(false); }
    };

    // Gradientes
    const COURSE_GRADIENTS = [
        'linear-gradient(135deg,#4f46e5 0%,#8b5cf6 40%,#0ea5e9 100%)',
        'linear-gradient(135deg,#ec4899 0%,#f97316 40%,#facc15 100%)',
        'linear-gradient(135deg,#10b981 0%,#22c55e 40%,#14b8a6 100%)',
        'linear-gradient(135deg,#6366f1 0%,#a855f7 40%,#f97316 100%)',
        'linear-gradient(135deg,#0ea5e9 0%,#22c55e 40%,#84cc16 100%)',
        'linear-gradient(135deg,#f97316 0%,#ef4444 40%,#ec4899 100%)',
    ];
    function getCourseGradient(name: string, description?: string | null): string {
        const key = `${name}|${description ?? ''}`; let hash = 0;
        for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
        return COURSE_GRADIENTS[hash % COURSE_GRADIENTS.length];
    }

    // Loading
    if (loading) {
        return (
            <div className="flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
                <div className="text-center">
                    <i className="pi pi-spin pi-spinner" style={{ fontSize: '2rem' }} />
                    <p className="mt-3">Cargando tus cursos...</p>
                </div>
            </div>
        );
    }

    // Sin cursos
    if (!filteredCourses.length && !courses.length) {
        return (
            <div className="flex justify-content-center align-items-center" style={{ minHeight: '70vh' }}>
                <div className="surface-card border-round-3xl shadow-3 p-4 md:p-5 text-center" style={{ maxWidth: '640px', width: '100%' }}>
                    <div className="mb-3">
                        <i className="pi pi-book" style={{ fontSize: '3rem', color: '#4f46e5' }} />
                    </div>
                    <h2 className="text-2xl md:text-3xl font-bold mb-2">
                        {role === 'THERAPIST' ? 'Aún no has creado ningún curso' : role === 'STUDENT' ? 'Todavía no te has unido a ningún curso' : 'No hay cursos disponibles'}
                    </h2>
                    <p className="text-600 mb-4">
                        {role === 'THERAPIST' ? 'Crea tu primer curso para comenzar.' : role === 'STUDENT' ? 'Pide a tu terapeuta el código o espera invitación.' : 'Inicia sesión para ver tus cursos.'}
                    </p>
                    {role && (
                        <Button label={primaryLabel} icon={primaryIcon} onClick={handlePrimaryAction} className="p-button-lg" />
                    )}
                </div>
                <CreateCourseDialog visible={showCreateDialog} onHide={() => setShowCreateDialog(false)} token={token} onCreated={() => token && loadCourses(token, page, pageSize)} />
                <JoinCourseDialog visible={showJoinDialog} onHide={() => setShowJoinDialog(false)} token={token} onJoined={() => token && loadCourses(token, page, pageSize)} onSuccess={handleJoinSuccess} />
                <Dialog header="Solicitud enviada" visible={successVisible} modal style={{ width: '26rem', maxWidth: '95vw' }} onHide={() => setSuccessVisible(false)}>
                    <div className="flex align-items-center justify-content-center flex-column text-center p-3">
                        <i className="pi pi-check-circle mb-3" style={{ fontSize: '3rem', color: '#10b981' }} />
                        <p className="m-0 text-700" style={{ whiteSpace: 'pre-line' }}>{successMessage}</p>
                        <Button label="Aceptar" className="mt-4" onClick={() => setSuccessVisible(false)} />
                    </div>
                </Dialog>
            </div>
        );
    }

    return (
        <div className="surface-ground" style={{ minHeight: '60vh', position: 'relative' }}>
            <div className="flex justify-content-between align-items-center mb-3">
                <div>
                    <h2 className="text-2xl font-bold mb-1">Mis cursos</h2>
                    <p className="text-600 m-0">{totalCourses} curso{totalCourses !== 1 ? 's' : ''} en total</p>
                </div>
                <div className="flex align-items-center gap-2">
                    <span className="p-input-icon-left">
                        <i className="pi pi-search" />
                        <InputText value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar curso o código" style={{ width: '14rem' }} />
                    </span>
                    <Dropdown 
                        value={pageSize} 
                        options={[5, 10, 20, 50].map(v => ({ label: `${v} por página`, value: v }))} 
                        onChange={(e) => {
                            setPageSize(e.value);
                            setPage(1);
                        }} 
                        placeholder="Items por página"
                    />
                </div>
            </div>

            {/* Paginador superior */}
            {totalCourses > 0 && (
                <div className="mb-3">
                    <Paginator
                        first={(page - 1) * pageSize}
                        rows={pageSize}
                        totalRecords={totalCourses}
                        onPageChange={handlePageChange}
                        template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink"
                    />
                </div>
            )}

            <div className="flex justify-content-between align-items-center mb-3">
                <div></div>
                <div className="flex align-items-center gap-2">
                    {groups.length > 0 && (
                        <div className="flex gap-2 flex-wrap">
                            <Button label="Todos" className={groupFilter === 'ALL' ? 'p-button-sm' : 'p-button-text p-button-sm'} onClick={() => setGroupFilter('ALL')} />
                            {groups.map((g) => (
                                <Button
                                    key={g.id}
                                    label={g.name}
                                    className="p-button-sm"
                                    style={{
                                        background: groupFilter === g.id ? g.color || '#4f46e5' : 'transparent',
                                        color: groupFilter === g.id ? getContrastColor(g.color) : '#6b7280',
                                        border: `1px solid ${g.color || '#4f46e5'}`,
                                    }}
                                    onClick={() => setGroupFilter(g.id)}
                                />
                            ))}
                        </div>
                    )}
                    <Button label="Nuevo grupo" icon="pi pi-folder" className="p-button-text" onClick={() => setShowCreateGroup(true)} />
                    {groups.length > 0 && (
                        <Button label="Gestionar grupos" icon="pi pi-cog" className="p-button-text" onClick={() => setManageGroupsVisible(true)} />
                    )}
                </div>
            </div>
            <div className="grid">
                {filteredCourses.map((course) => {
                    const isNameLong = course.name.length > NAME_LIMIT;
                    const isDescLong = (course.description?.length || 0) > DESC_LIMIT;
                    const displayName = isNameLong ? course.name.slice(0, NAME_LIMIT) + '…' : course.name;
                    const displayDesc = course.description && isDescLong ? course.description.slice(0, DESC_LIMIT) + '…' : course.description ?? '';
                    const currentGroupEntry = Object.entries(groupAssignments).find(([, ids]) => ids.includes(course.id));
                    const currentGroup = currentGroupEntry ? groups.find((g) => g.id === Number(currentGroupEntry[0])) : undefined;
                    return (
                        <div key={course.id} className="col-12 sm:col-6 lg:col-4">
                            <div className="card cursor-pointer border-none shadow-3 overflow-hidden h-full transition-all hover:shadow-5" style={{ borderRadius: '1.5rem' }} onClick={() => goToCourse(course)}>
                                <div style={{ background: getCourseGradient(course.name, course.description), color: '#f9fafb', padding: '1.25rem 1.5rem' }}>
                                    <div className="flex align-items-start gap-2">
                                        <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                                            <h3 className="m-0 text-xl md:text-2xl font-semibold tracking-tight" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayName}</h3>
                                            {course.description && (
                                                <p className="m-0 mt-2 text-sm md:text-base" style={{ opacity: 0.96, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties}>{displayDesc}</p>
                                            )}
                                            {(isNameLong || isDescLong) && (
                                                <Button label="Ver más" className="p-button-text p-button-sm p-0 mt-2" style={{ color: '#f9fafb', fontWeight: 500 }} onClick={(e) => { e.stopPropagation(); openDetails(course); }} />
                                            )}
                                        </div>
                                        <i className="pi pi-book" style={{ flex: '0 0 auto', fontSize: '2.2rem', opacity: 0.92 }} />
                                    </div>
                                </div>
                                <div className="p-3 flex flex-column gap-2">
                                    {role === 'THERAPIST' ? (
                                        <>
                                            <span className="text-sm text-600 mb-1">Código de curso:</span>
                                            <div className="flex align-items-center justify-content-between gap-3">
                                                <span className="px-3 py-2 border-round-xl text-lg font-semibold" style={{ background: '#eef2ff', color: '#4f46e5', letterSpacing: '0.08em' }}>{course.join_code}</span>
                                                <Button icon={copiedCode === course.join_code ? 'pi pi-check' : 'pi pi-copy'} label={copiedCode === course.join_code ? 'Copiado' : 'Copiar'} className="p-button-text" onClick={(e) => { e.stopPropagation(); handleCopyCode(course.join_code); }} />
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex align-items-center justify-content-between">
                                            <span className="text-sm text-600">Código de curso:</span>
                                            <Tag value={course.join_code} rounded style={{ background: '#eef2ff', color: '#4f46e5', borderRadius: '999px' }} />
                                        </div>
                                    )}
                                    {role === 'STUDENT' && <p className="text-sm text-600 m-0 mt-2">Curso asignado por tu terapeuta.</p>}
                                    <div className="mt-3 flex justify-content-between align-items-center">
                                        <Button label="Entrar al curso" icon="pi pi-arrow-right" className="p-button-text p-0" onClick={(e) => { e.stopPropagation(); goToCourse(course); }} />
                                        {role === 'THERAPIST' && (
                                            <Button icon="pi pi-trash" className="p-button-text p-button-danger p-0" tooltip="Eliminar curso" tooltipOptions={{ position: 'top' }} onClick={(e) => { e.stopPropagation(); setCourseToDelete(course); setDeleteConfirmVisible(true); }} />
                                        )}
                                    </div>
                                    <div className="mt-2 flex justify-content-between align-items-center">
                                        <div className="flex align-items-center gap-2">
                                            {currentGroup && (
                                                <Tag
                                                    value={currentGroup.name}
                                                    rounded
                                                    style={{
                                                        background: currentGroup.color || '#eef2ff',
                                                        color: '#ffffff',
                                                        borderRadius: '999px',
                                                    }}
                                                />
                                            )}
                                        </div>
                                        <div className="flex align-items-center gap-2">
                                            {groups.length > 0 && (
                                                <Button
                                                    label={currentGroup ? 'Cambiar de grupo' : 'Asignar a grupo'}
                                                    className="p-button-text p-0"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setAssignGroupCourse(course);
                                                        setSelectedGroupId(currentGroupEntry ? Number(currentGroupEntry[0]) : '');
                                                        setAssignGroupDialogVisible(true);
                                                    }}
                                                />
                                            )}
                                            {currentGroup && (
                                                <Button
                                                    label="Quitar del grupo"
                                                    className="p-button-text p-button-danger p-0"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        assignCourseToGroup(course, null);
                                                    }}
                                                />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );  
                })}
            </div>

            {role && (
                <Button label={primaryLabel} icon={primaryIcon} className="p-button-rounded p-button-lg shadow-4" onClick={handlePrimaryAction} style={{ position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 20, background: role === 'THERAPIST' ? 'linear-gradient(135deg,#4f46e5,#8b5cf6)' : 'linear-gradient(135deg,#10b981,#22c55e)', border: 'none' }} />
            )}
            <CreateCourseDialog visible={showCreateDialog} onHide={() => setShowCreateDialog(false)} token={token} onCreated={() => token && loadCourses(token, page, pageSize)} />
            <JoinCourseDialog visible={showJoinDialog} onHide={() => setShowJoinDialog(false)} token={token} onJoined={() => token && loadCourses(token, page, pageSize)} onSuccess={handleJoinSuccess} />
            <Dialog header="Solicitud enviada" visible={successVisible} modal style={{ width: '26rem', maxWidth: '95vw' }} onHide={() => setSuccessVisible(false)}>
                <div className="flex align-items-center justify-content-center flex-column text-center p-3">
                    <i className="pi pi-check-circle mb-3" style={{ fontSize: '3rem', color: '#10b981' }} />
                    <p className="m-0 text-700" style={{ whiteSpace: 'pre-line' }}>{successMessage}</p>
                    <Button label="Aceptar" className="mt-4" onClick={() => setSuccessVisible(false)} />
                </div>
            </Dialog>
            <CourseDetailsDialog visible={detailsVisible} onHide={() => setDetailsVisible(false)} course={detailsCourse} />
            <Dialog header="Confirmar eliminación" visible={deleteConfirmVisible} modal style={{ width: '28rem', maxWidth: '95vw' }} onHide={() => !deleting && setDeleteConfirmVisible(false)}>
                <div className="flex flex-column gap-3">
                    <div className="flex align-items-center gap-3">
                        <i className="pi pi-exclamation-triangle text-yellow-500" style={{ fontSize: '2rem' }} />
                        <div>
                            <p className="m-0 font-semibold">¿Estás seguro de eliminar este curso?</p>
                            {courseToDelete && <p className="m-0 mt-1 text-sm text-600">{courseToDelete.name}</p>}
                        </div>
                    </div>
                    <p className="text-sm text-600 m-0">Esta acción no se puede deshacer. Todos los estudiantes perderán acceso.</p>
                    <div className="flex justify-content-end gap-2 mt-2">
                        <Button label="Cancelar" className="p-button-text" onClick={() => setDeleteConfirmVisible(false)} disabled={deleting} />
                        <Button label="Eliminar" icon="pi pi-trash" className="p-button-danger" onClick={handleDeleteCourse} loading={deleting} />
                    </div>
                </div>
            </Dialog>
            <Dialog header="Asignar a grupo" visible={assignGroupDialogVisible} modal style={{ width: '24rem', maxWidth: '95vw' }} onHide={() => setAssignGroupDialogVisible(false)}>
                <div className="flex flex-column gap-3">
                    {groups.length === 1 ? (
                        <div className="field">
                            <p className="text-700 mb-2">
                                Se asignará al grupo: <strong>{groups[0].name}</strong>
                            </p>
                            <div className="flex align-items-center gap-2">
                                <div
                                    style={{
                                        width: '1.5rem',
                                        height: '1.5rem',
                                        borderRadius: '50%',
                                        backgroundColor: groups[0].color || '#6366f1',
                                    }}
                                />
                                <span className="text-600">{groups[0].name}</span>
                            </div>
                        </div>
                    ) : (
                        <div className="field">
                            <label className="text-sm mb-1">Selecciona grupo</label>
                            <select
                                className="p-inputtext p-component"
                                value={selectedGroupId === '' ? '' : String(selectedGroupId)}
                                onChange={(e) => setSelectedGroupId(e.target.value ? Number(e.target.value) : '')}
                            >
                                {groups.map((g) => (
                                    <option key={g.id} value={g.id}>{g.name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    <div className="flex justify-content-end gap-2">
                        <Button label="Cancelar" className="p-button-text" onClick={() => setAssignGroupDialogVisible(false)} />
                        <Button
                            label="Asignar"
                            icon="pi pi-check"
                            onClick={async () => {
                                if (!assignGroupCourse) return;
                                const groupId = groups.length === 1 ? groups[0].id : selectedGroupId;
                                if (groupId === '') return;
                                await assignCourseToGroup(assignGroupCourse, Number(groupId));
                                setAssignGroupDialogVisible(false);
                            }}
                            disabled={groups.length > 1 && selectedGroupId === ''}
                            loading={assigningGroupCourseId === (assignGroupCourse?.id ?? null)}
                        />
                    </div>
                </div>
            </Dialog>
            <Dialog header="Nuevo grupo" visible={showCreateGroup} modal style={{ width: '26rem', maxWidth: '95vw' }} onHide={() => setShowCreateGroup(false)}>
                <div className="flex flex-column gap-3">
                    <div className="field">
                        <label className="text-sm mb-1">Nombre (máx. 30 caracteres)</label>
                        <InputText value={newGroupName} onChange={(e) => setNewGroupName(e.target.value.slice(0, 30))} placeholder="Ej: Infantil" maxLength={30} />
                        <small className="text-600">{newGroupName.length}/30</small>
                    </div>
                    <div className="field">
                        <label className="text-sm mb-1">Color</label>
                        <div className="flex align-items-center gap-2">
                            <ColorPicker value={newGroupColor} onChange={(e) => setNewGroupColor(typeof e.value === 'string' ? e.value : newGroupColor)} format="hex"/>
                            <span className="text-600 text-xs">#{newGroupColor}</span>
                        </div>
                    </div>
                    <div className="flex justify-content-end gap-2">
                        <Button label="Cancelar" className="p-button-text" onClick={() => setShowCreateGroup(false)} disabled={savingGroup} />
                        <Button label="Crear" icon="pi pi-check" onClick={handleCreateGroup} loading={savingGroup} disabled={!newGroupName.trim()} />
                    </div>
                </div>
            </Dialog>
            <Dialog header="Gestionar grupos" visible={manageGroupsVisible} modal style={{ width: '28rem', maxWidth: '95vw' }} onHide={() => setManageGroupsVisible(false)}>
                <div className="flex flex-column gap-3">
                    {groups.length === 0 ? (
                        <p className="text-600 text-center">No hay grupos creados</p>
                    ) : (
                        groups.map((g) => (
                            <div key={g.id} className="flex justify-content-between align-items-center p-3 border-1 surface-border border-round">
                                <div className="flex align-items-center gap-2">
                                    <div style={{ width: '1.5rem', height: '1.5rem', borderRadius: '50%', background: g.color || '#4f46e5' }}></div>
                                    <span className="font-semibold">{g.name}</span>
                                </div>
                                <Button
                                    icon="pi pi-trash"
                                    className="p-button-text p-button-danger p-button-sm"
                                    onClick={() => {
                                        setGroupToDelete(g);
                                        setDeleteGroupVisible(true);
                                        setManageGroupsVisible(false);
                                    }}
                                />
                            </div>
                        ))
                    )}
                </div>
            </Dialog>
            <Dialog header="Eliminar grupo" visible={deleteGroupVisible} modal style={{ width: '28rem', maxWidth: '95vw' }} onHide={() => !deletingGroup && setDeleteGroupVisible(false)}>
                <div className="flex flex-column gap-3">
                    <div className="flex align-items-center gap-3">
                        <i className="pi pi-exclamation-triangle text-yellow-500" style={{ fontSize: '2rem' }} />
                        <div>
                            <p className="m-0 font-semibold">¿Eliminar este grupo?</p>
                            {groupToDelete && <p className="m-0 mt-1 text-sm text-600">{groupToDelete.name}</p>}
                        </div>
                    </div>
                    <p className="text-sm text-600 m-0">Los cursos no se eliminarán, solo se quitarán del grupo.</p>
                    <div className="flex justify-content-end gap-2 mt-2">
                        <Button label="Cancelar" className="p-button-text" onClick={() => setDeleteGroupVisible(false)} disabled={deletingGroup} />
                        <Button label="Eliminar" icon="pi pi-trash" className="p-button-danger" onClick={handleDeleteGroup} loading={deletingGroup} />
                    </div>
                </div>
            </Dialog>
        </div>
    );
};

export default CoursesPage;
