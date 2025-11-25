'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Tag } from 'primereact/tag';
import { Card } from 'primereact/card';
import { Dialog } from 'primereact/dialog';
import { ColorPicker } from 'primereact/colorpicker';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import AudioPlayer from './AudioPlayer';
import {
    ExerciseOut,
    ExerciseFolder,
    getMyExercises,
    getFolders,
    assignExerciseFolder,
    createFolder,
    deleteExercise as apiDeleteExercise,
    deleteFolder as apiDeleteFolder,
} from '@/services/exercises';
import { API_BASE } from '@/services/apiClient';

// Audio base URL centralizado (usa API_BASE para evitar duplicar host)
const AUDIO_BASE_URL = API_BASE;

// ===================== PAGE: LISTA DE EJERCICIOS =====================

const NAME_LIMIT = 50;
const TEXT_LIMIT = 140;

const ExerciseListPage: React.FC = () => {
    const { user, token, role, loading: authLoading } = useAuth();

    const [exercises, setExercises] = useState<ExerciseOut[]>([]);
    const [filteredExercises, setFilteredExercises] = useState<ExerciseOut[]>([]);
    const [folders, setFolders] = useState<ExerciseFolder[]>([]);
    const [folderFilter, setFolderFilter] = useState<number | 'ALL'>('ALL');
    const [showCreateFolder, setShowCreateFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [newFolderColor, setNewFolderColor] = useState('6366f1');
    const [savingFolder, setSavingFolder] = useState(false);
    const [updatingFolder, setUpdatingFolder] = useState(false);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    const [detailVisible, setDetailVisible] = useState(false);
    const [detailExercise, setDetailExercise] = useState<ExerciseOut | null>(null);
    const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
    const [exerciseToDelete, setExerciseToDelete] = useState<ExerciseOut | null>(null);
    const [deleting, setDeleting] = useState(false);
    const router = useRouter();

    // Asignación de carpeta (modal)
    const [assignDialogVisible, setAssignDialogVisible] = useState(false);
    const [assignExercise, setAssignExercise] = useState<ExerciseOut | null>(null);
    const [selectedFolderId, setSelectedFolderId] = useState<number | ''>('');
    const [deleteFolderVisible, setDeleteFolderVisible] = useState(false);
    const [folderToDelete, setFolderToDelete] = useState<ExerciseFolder | null>(null);
    const [deletingFolder, setDeletingFolder] = useState(false);
    const [manageFoldersVisible, setManageFoldersVisible] = useState(false);

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

    // cargar user + token
    // Ya no es necesario, el hook useAuth lo hace

    // cargar ejercicios
    const loadExercises = useCallback(async (authToken: string) => {
        try {
            setLoading(true);
            const data = await getMyExercises(authToken);
            setExercises(data);
            setFilteredExercises(
                folderFilter === 'ALL'
                    ? data
                    : data.filter((ex) => ex.folder_id === folderFilter)
            );
        } catch (err) {
            console.error('Error obteniendo ejercicios:', err);
            setExercises([]);
            setFilteredExercises([]);
        } finally {
            setLoading(false);
        }
    }, [folderFilter]);

    const loadFolders = useCallback(async (authToken: string) => {
        try {
            const data = await getFolders(authToken);
            setFolders(data);
        } catch (err) {
            console.error('Error obteniendo carpetas:', err);
        }
    }, []);

    useEffect(() => {
        if (authLoading) return;
        
        if (!token || role !== 'THERAPIST') {
            setLoading(false);
            return;
        }
        loadExercises(token);
        loadFolders(token);
    }, [authLoading, token, role, loadExercises]);

    // filtro de búsqueda
    useEffect(() => {
        // aplicar búsqueda + filtro de carpeta
        const base = folderFilter === 'ALL'
            ? exercises
            : exercises.filter((ex) => ex.folder_id === folderFilter);

        if (!search.trim()) {
            setFilteredExercises(base);
            return;
        }
        const lower = search.toLowerCase();
        setFilteredExercises(
            base.filter(
                (ex) =>
                    ex.name.toLowerCase().includes(lower) ||
                    (ex.prompt ?? '').toLowerCase().includes(lower) ||
                    ex.text.toLowerCase().includes(lower)
            )
        );
    }, [search, exercises, folderFilter]);

    const openDetails = (exercise: ExerciseOut) => {
        setDetailExercise(exercise);
        setDetailVisible(true);
    };

    const handleDeleteExercise = async () => {
        if (!exerciseToDelete || !token) return;
        setDeleting(true);
        try {
            await apiDeleteExercise(exerciseToDelete.id, token);
            await loadExercises(token);
            setDeleteConfirmVisible(false);
            setExerciseToDelete(null);
        } catch (err) {
            console.error('Error eliminando ejercicio:', err);
            alert('No se pudo eliminar el ejercicio.');
        } finally {
            setDeleting(false);
        }
    };

    const handleAssignFolder = async (exercise: ExerciseOut, folderId: number | null) => {
        if (!token) return;
        setUpdatingFolder(true);
        try {
            const updated = await assignExerciseFolder(exercise.id, token, folderId);
            setExercises((prev) => prev.map((ex) => (ex.id === updated.id ? updated : ex)));
            setDetailExercise((prev) => (prev && prev.id === updated.id ? updated : prev));
            setAssignExercise((prev) => (prev && prev.id === updated.id ? updated : prev));
        } catch (err) {
            console.error('Error asignando carpeta:', err);
        } finally {
            setUpdatingFolder(false);
        }
    };

    const handleCreateFolder = async () => {
        if (!token || !newFolderName.trim()) return;
        setSavingFolder(true);
        try {
            const folder = await createFolder(token, newFolderName.trim(), newFolderColor);
            setFolders((prev) => [folder, ...prev]);
            setShowCreateFolder(false);
            setNewFolderName('');
        } catch (err) {
            console.error('Error creando carpeta:', err);
        } finally {
            setSavingFolder(false);
        }
    };

    const handleDeleteFolder = async () => {
        if (!folderToDelete || !token) return;
        setDeletingFolder(true);
        try {
            await apiDeleteFolder(folderToDelete.id, token);
            await loadFolders(token);
            await loadExercises(token);
            setDeleteFolderVisible(false);
            setFolderToDelete(null);
            if (folderFilter === folderToDelete.id) setFolderFilter('ALL');
        } catch (err) {
            console.error('Error al eliminar carpeta:', err);
        } finally {
            setDeletingFolder(false);
        }
    };

    // --- estados especiales ---

    if (loading) {
        return (
            <div
                className="flex justify-content-center align-items-center"
                style={{ minHeight: '60vh' }}
            >
                <div className="text-center">
                    <i className="pi pi-spin pi-spinner" style={{ fontSize: '2rem' }} />
                    <p className="mt-3">Cargando tus ejercicios...</p>
                </div>
            </div>
        );
    }

    if (role && role !== 'THERAPIST') {
        return (
            <div
                className="flex justify-content-center align-items-center"
                style={{ minHeight: '60vh' }}
            >
                <div className="surface-card p-4 shadow-3 border-round-2xl text-center">
                    <i
                        className="pi pi-lock mb-3"
                        style={{ fontSize: '2.5rem', color: '#4b5563' }}
                    />
                    <h2 className="text-xl font-semibold mb-2">Solo terapeutas</h2>
                    <p className="text-600 m-0">
                        El panel de ejercicios guardados está disponible solo para terapeutas.
                    </p>
                </div>
            </div>
        );
    }

    if (!filteredExercises.length && !exercises.length) {
        return (
            <div
                className="flex justify-content-center align-items-center"
                style={{ minHeight: '70vh' }}
            >
                <div
                    className="surface-card border-round-3xl shadow-3 p-4 md:p-5 text-center"
                    style={{ maxWidth: '640px', width: '100%' }}
                >
                    <div className="mb-3">
                        <i
                            className="pi pi-microphone"
                            style={{ fontSize: '3rem', color: '#4f46e5' }}
                        />
                    </div>

                    <h2 className="text-2xl md:text-3xl font-bold mb-2">
                        Aún no has creado ejercicios
                    </h2>

                    <p className="text-600 mb-4">
                        Cuando generes y guardes ejercicios en la sección &quot;Creador de
                        ejercicios&quot;, aparecerán aquí para que puedas reutilizarlos.
                    </p>

                    <Button
                        label="Crear ejercicio"
                        icon="pi pi-plus"
                        className="p-button-lg"
                        onClick={() => router.push('/exercises/create')}
                        style={{
                            border: 'none'
                        }}
                    />
                </div>
            </div>
        );
    }

    // --- vista principal ---

    return (
        <div className="surface-ground" style={{ minHeight: '60vh', position: 'relative' }}>
            <div className="flex justify-content-between align-items-center mb-3">
                <div>
                    <h2 className="text-2xl font-bold mb-1">Mis ejercicios</h2>
                    <p className="text-600 m-0">
                        {exercises.length} ejercicio
                        {exercises.length !== 1 ? 's' : ''} guardado
                        {exercises.length !== 1 ? 's' : ''}
                    </p>
                </div>

                <div className="flex align-items-center gap-2">
                    <span className="p-input-icon-left mr-2">
                        <i className="pi pi-search" />
                        <InputText
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Buscar por nombre, texto o prompt"
                            style={{ width: '18rem' }}
                        />
                    </span>

                    {/* Filtro de carpeta */}
                    {folders.length > 0 && (
                        <div className="flex gap-2 flex-wrap">
                            <Button
                                label="Todos"
                                className={folderFilter === 'ALL' ? 'p-button-sm' : 'p-button-text p-button-sm'}
                                onClick={() => setFolderFilter('ALL')}
                            />
                            {folders.map((f) => (
                                <Button
                                    key={f.id}
                                    label={f.name}
                                    className="p-button-sm"
                                    style={{
                                        background: folderFilter === f.id ? f.color || '#6366f1' : 'transparent',
                                        color: folderFilter === f.id ? getContrastColor(f.color) : '#6b7280',
                                        border: `1px solid ${f.color || '#6366f1'}`,
                                    }}
                                    onClick={() => setFolderFilter(f.id)}
                                />
                            ))}
                        </div>
                    )}

                    <Button
                        label="Nueva carpeta"
                        icon="pi pi-folder"
                        className="p-button-text"
                        onClick={() => setShowCreateFolder(true)}
                    />
                    {folders.length > 0 && (
                        <Button
                            label="Gestionar carpetas"
                            icon="pi pi-cog"
                            className="p-button-text"
                            onClick={() => setManageFoldersVisible(true)}
                        />
                    )}

                    {role === 'THERAPIST' && (
                        <Button
                            label="Crear ejercicio"
                            icon="pi pi-plus"
                            className="p-button-rounded p-button-lg shadow-4"
                            onClick={() => router.push('/exercises/create')}
                            style={{
                                position: 'fixed',
                                bottom: '2rem',
                                right: '2rem',
                                zIndex: 20,
                                background: 'linear-gradient(135deg,#8b5cf6,#6366f1)',
                                border: 'none',
                            }}
                        />
                    )}

                </div>
            </div>


            <div className="grid">
                {filteredExercises.map((ex) => {
                    const isNameLong = ex.name.length > NAME_LIMIT;
                    const isTextLong = ex.text.length > TEXT_LIMIT;

                    const displayName = isNameLong
                        ? ex.name.slice(0, NAME_LIMIT) + '…'
                        : ex.name;

                    const displayText = isTextLong
                        ? ex.text.slice(0, TEXT_LIMIT) + '…'
                        : ex.text;

                    const created = new Date(ex.created_at).toLocaleString();

                    return (
                        <div key={ex.id} className="col-12 sm:col-6 lg:col-4">
                            <Card
                                className="shadow-2 border-round-2xl h-full flex flex-column"
                                title={
                                    <div className="flex justify-content-between align-items-start gap-2">
                                        <span
                                            className="text-lg font-semibold"
                                            style={{
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                            }}
                                        >
                                            {displayName}
                                        </span>
                                        <Tag
                                            value="Ejercicio"
                                            icon="pi pi-microphone"
                                            severity="info"
                                        />
                                    </div>
                                }
                                subTitle={
                                    <span className="text-600 text-xs">
                                        Creado: {created}
                                    </span>
                                }
                            >
                                <div className="flex flex-column gap-2">
                                    {ex.prompt && (
                                        <p className="text-xs text-600 m-0">
                                            <span className="font-semibold">Prompt:</span>{' '}
                                            {ex.prompt.length > 80
                                                ? ex.prompt.slice(0, 80) + '…'
                                                : ex.prompt}
                                        </p>
                                    )}

                                    <p className="text-sm text-700 m-0 line-height-3">
                                        {displayText}
                                    </p>

                                    <div className="flex justify-content-between align-items-center mt-3">
                                        <Button
                                            label="Ver detalles"
                                            icon="pi pi-search"
                                            className="p-button-text p-0"
                                            onClick={() => openDetails(ex)}
                                        />
                                        <Button
                                            icon="pi pi-trash"
                                            className="p-button-text p-button-danger p-0"
                                            tooltip="Eliminar ejercicio"
                                            tooltipOptions={{ position: 'top' }}
                                            onClick={() => {
                                                setExerciseToDelete(ex);
                                                setDeleteConfirmVisible(true);
                                            }}
                                        />
                                    </div>
                                    <div className="flex justify-content-between align-items-center mt-2">
                                        <div className="flex align-items-center gap-2">
                                            {ex.folder_id && (
                                                <Tag
                                                    value={folders.find((f) => f.id === ex.folder_id)?.name || 'Carpeta'}
                                                    severity="info"
                                                />
                                            )}
                                        </div>
                                        <div className="flex align-items-center gap-2">
                                            {folders.length > 0 && (
                                                <Button
                                                    label={ex.folder_id ? 'Cambiar carpeta' : 'Asignar carpeta'}
                                                    className="p-button-text p-0"
                                                    onClick={() => {
                                                        setAssignExercise(ex);
                                                        setSelectedFolderId(ex.folder_id ?? '');
                                                        setAssignDialogVisible(true);
                                                    }}
                                                />
                                            )}
                                            {ex.folder_id && (
                                                <Button
                                                    label="Quitar de carpeta"
                                                    className="p-button-text p-button-danger p-0"
                                                    onClick={() => handleAssignFolder(ex, null)}
                                                />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        </div>
                    );
                })}
            </div>

            <Dialog
                header={detailExercise?.name || 'Detalles del ejercicio'}
                visible={detailVisible}
                modal
                style={{ width: '95vw', maxWidth: '40rem' }}
                onHide={() => setDetailVisible(false)}
            >
                {detailExercise && (
                    <div className="flex flex-column gap-3">
                        <div>
                            <p className="m-0 text-600 text-sm">
                                Creado:{' '}
                                {new Date(detailExercise.created_at).toLocaleString()}
                            </p>
                            {detailExercise.prompt && (
                                <p className="mt-2 text-sm text-700">
                                    <span className="font-medium">Prompt:</span>{' '}
                                    {detailExercise.prompt}
                                </p>
                            )}
                        </div>

                        <div>
                            <h4 className="text-sm text-600 mb-1">Texto completo</h4>
                            <div
                                className="surface-100 border-round p-3"
                                style={{
                                    maxHeight: '16rem',
                                    overflowY: 'auto',
                                    whiteSpace: 'pre-wrap',
                                }}
                            >
                                {detailExercise.text}
                            </div>
                        </div>

                        {/* Asignar carpeta */}
                        <div className="flex flex-column gap-2">
                            <h4 className="text-sm text-600 mb-1">Carpeta</h4>
                            <div className="flex gap-2 flex-wrap">
                                <Button
                                    label={detailExercise.folder_id ? 'Quitar de carpeta' : 'Sin carpeta'}
                                    className="p-button-sm p-button-outlined"
                                    onClick={() => handleAssignFolder(detailExercise, null)}
                                    disabled={updatingFolder}
                                />
                                {folders.map((f) => (
                                    <Button
                                        key={f.id}
                                        label={f.name}
                                        className={detailExercise.folder_id === f.id ? 'p-button-sm' : 'p-button-text p-button-sm'}
                                        style={f.color ? { background: detailExercise.folder_id === f.id ? f.color : undefined } : undefined}
                                        onClick={() => handleAssignFolder(detailExercise, f.id)}
                                        disabled={updatingFolder}
                                    />
                                ))}
                            </div>
                        </div>

                        {detailExercise.audio_path && (() => {
                            const normalizedPath = detailExercise.audio_path.replace(/\\/g, '/');
                            const src = detailExercise.audio_path.startsWith('http')
                                ? detailExercise.audio_path
                                : `${AUDIO_BASE_URL}/media/${normalizedPath}`;

                            return (
                                <div>
                                    <h4 className="text-sm text-600 mb-1">Audio generado</h4>
                                    <AudioPlayer src={src} />
                                </div>
                            );
                        })()}
                    </div>
                )}
            </Dialog>

            {/* Crear carpeta */}
            <Dialog
                header="Nueva carpeta"
                visible={showCreateFolder}
                modal
                style={{ width: '26rem', maxWidth: '95vw' }}
                onHide={() => setShowCreateFolder(false)}
            >
                <div className="flex flex-column gap-3">
                    <div className="field">
                        <label className="text-sm mb-1">Nombre (máx. 30 caracteres)</label>
                        <InputText
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value.slice(0, 30))}
                            placeholder="Ej: Fonética"
                            maxLength={30}
                        />
                        <small className="text-600">{newFolderName.length}/30</small>
                    </div>
                    <div className="field">
                        <label className="text-sm mb-1">Color</label>
                        <div className="flex align-items-center gap-2">
                            <ColorPicker value={newFolderColor} onChange={(e) => setNewFolderColor(typeof e.value === 'string' ? e.value : newFolderColor)} format="hex" />
                            <span className="text-600 text-xs">#{newFolderColor}</span>
                        </div>
                    </div>
                    <div className="flex justify-content-end gap-2">
                        <Button
                            label="Cancelar"
                            className="p-button-text"
                            onClick={() => setShowCreateFolder(false)}
                            disabled={savingFolder}
                        />
                        <Button
                            label="Crear"
                            icon="pi pi-check"
                            onClick={handleCreateFolder}
                            loading={savingFolder}
                            disabled={!newFolderName.trim()}
                        />
                    </div>
                </div>
            </Dialog>

            {/* Modal de confirmación de eliminación */}
            <Dialog
                header="Confirmar eliminación"
                visible={deleteConfirmVisible}
                modal
                style={{ width: '28rem', maxWidth: '95vw' }}
                onHide={() => !deleting && setDeleteConfirmVisible(false)}
            >
                <div className="flex flex-column gap-3">
                    <div className="flex align-items-center gap-3">
                        <i className="pi pi-exclamation-triangle text-yellow-500" style={{ fontSize: '2rem' }} />
                        <div>
                            <p className="m-0 font-semibold">¿Estás seguro de eliminar este ejercicio?</p>
                            {exerciseToDelete && (
                                <p className="m-0 mt-1 text-sm text-600">{exerciseToDelete.name}</p>
                            )}
                        </div>
                    </div>
                    <p className="text-sm text-600 m-0">
                        Esta acción no se puede deshacer. El ejercicio se eliminará de todos los cursos donde esté publicado.
                    </p>
                    <div className="flex justify-content-end gap-2 mt-2">
                        <Button
                            label="Cancelar"
                            className="p-button-text"
                            onClick={() => setDeleteConfirmVisible(false)}
                            disabled={deleting}
                        />
                        <Button
                            label="Eliminar"
                            icon="pi pi-trash"
                            className="p-button-danger"
                            onClick={handleDeleteExercise}
                            loading={deleting}
                        />
                    </div>
                </div>
            </Dialog>

            {/* Gestionar carpetas */}
            <Dialog
                header="Gestionar carpetas"
                visible={manageFoldersVisible}
                modal
                style={{ width: '30rem', maxWidth: '95vw' }}
                onHide={() => setManageFoldersVisible(false)}
            >
                <div className="flex flex-column gap-2">
                    {folders.length === 0 && <p className="text-center text-600">No hay carpetas creadas.</p>}
                    {folders.map((folder) => (
                        <div key={folder.id} className="flex align-items-center justify-content-between p-2 border-1 border-200 border-round">
                            <div className="flex align-items-center gap-2">
                                <div
                                    style={{
                                        width: '1.5rem',
                                        height: '1.5rem',
                                        borderRadius: '50%',
                                        backgroundColor: folder.color || '#6366f1',
                                    }}
                                />
                                <span className="font-semibold">{folder.name}</span>
                            </div>
                            <Button
                                icon="pi pi-trash"
                                className="p-button-text p-button-danger p-button-sm"
                                onClick={() => {
                                    setFolderToDelete(folder);
                                    setDeleteFolderVisible(true);
                                }}
                            />
                        </div>
                    ))}
                </div>
            </Dialog>

            {/* Eliminar carpeta (confirmación) */}
            <Dialog
                header="Eliminar carpeta"
                visible={deleteFolderVisible}
                modal
                style={{ width: '26rem', maxWidth: '95vw' }}
                onHide={() => setDeleteFolderVisible(false)}
            >
                {folderToDelete && (
                    <div className="flex flex-column gap-3">
                        <p className="text-700">
                            ¿Estás seguro de que deseas eliminar la carpeta <strong>{folderToDelete.name}</strong>?
                        </p>
                        <p className="text-600 text-sm">
                            Los ejercicios no se eliminarán, solo se quitarán de la carpeta.
                        </p>
                        <div className="flex justify-content-end gap-2">
                            <Button
                                label="Cancelar"
                                className="p-button-text"
                                onClick={() => setDeleteFolderVisible(false)}
                                disabled={deletingFolder}
                            />
                            <Button
                                label="Eliminar"
                                icon="pi pi-trash"
                                className="p-button-danger"
                                onClick={handleDeleteFolder}
                                loading={deletingFolder}
                            />
                        </div>
                    </div>
                )}
            </Dialog>

            {/* Asignar carpeta (modal rápido) */}
            <Dialog
                header="Asignar carpeta"
                visible={assignDialogVisible}
                modal
                style={{ width: '22rem', maxWidth: '95vw' }}
                onHide={() => setAssignDialogVisible(false)}
            >
                <div className="flex flex-column gap-3">
                    {folders.length === 1 ? (
                        <div className="field">
                            <p className="text-700 mb-2">
                                Se asignará a la carpeta: <strong>{folders[0].name}</strong>
                            </p>
                            <div className="flex align-items-center gap-2">
                                <div
                                    style={{
                                        width: '1.5rem',
                                        height: '1.5rem',
                                        borderRadius: '50%',
                                        backgroundColor: folders[0].color || '#6366f1',
                                    }}
                                />
                                <span className="text-600">{folders[0].name}</span>
                            </div>
                        </div>
                    ) : (
                        <div className="field">
                            <label className="text-sm mb-1">Selecciona carpeta</label>
                            <select
                                className="p-inputtext p-component"
                                value={selectedFolderId === '' ? '' : String(selectedFolderId)}
                                onChange={(e) => setSelectedFolderId(e.target.value ? Number(e.target.value) : '')}
                            >
                                {folders.map((f) => (
                                    <option key={f.id} value={f.id}>{f.name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    <div className="flex justify-content-end gap-2">
                        <Button
                            label="Cancelar"
                            className="p-button-text"
                            onClick={() => setAssignDialogVisible(false)}
                        />
                        <Button
                            label="Asignar"
                            icon="pi pi-check"
                            onClick={() => {
                                if (!assignExercise) return;
                                const folderId = folders.length === 1 ? folders[0].id : selectedFolderId;
                                if (folderId === '') return;
                                handleAssignFolder(assignExercise, Number(folderId));
                                setAssignDialogVisible(false);
                            }}
                            disabled={folders.length > 1 && selectedFolderId === ''}
                            loading={updatingFolder}
                        />
                    </div>
                </div>
            </Dialog>
        </div>
    );
};

export default ExerciseListPage;
