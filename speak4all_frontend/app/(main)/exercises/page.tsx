'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Tag } from 'primereact/tag';
import { Card } from 'primereact/card';
import { Dialog } from 'primereact/dialog';
import { useRouter } from 'next/navigation';
import AudioPlayer from './AudioPlayer';

type Role = 'THERAPIST' | 'STUDENT';

interface BackendUser {
    id: number;
    full_name: string;
    email: string;
    role: Role;
}

interface ExerciseOut {
    id: number;
    name: string;
    prompt?: string | null;
    text: string;
    audio_path: string;
    created_at: string;
}

const AUDIO_BASE_URL = 'http://localhost:8000';

// ===================== PAGE: LISTA DE EJERCICIOS =====================

const NAME_LIMIT = 50;
const TEXT_LIMIT = 140;

const ExerciseListPage: React.FC = () => {
    const [role, setRole] = useState<Role | null>(null);
    const [token, setToken] = useState<string | null>(null);

    const [exercises, setExercises] = useState<ExerciseOut[]>([]);
    const [filteredExercises, setFilteredExercises] = useState<ExerciseOut[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    const [detailVisible, setDetailVisible] = useState(false);
    const [detailExercise, setDetailExercise] = useState<ExerciseOut | null>(null);
    const router = useRouter();

    // cargar user + token
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

    // cargar ejercicios
    const loadExercises = useCallback(
        async (authToken: string) => {
            try {
                setLoading(true);
                const res = await fetch('http://localhost:8000/exercises/mine', {
                    headers: {
                        Authorization: `Bearer ${authToken}`,
                    },
                });

                if (!res.ok) {
                    console.error('Error obteniendo ejercicios:', await res.text());
                    setExercises([]);
                    setFilteredExercises([]);
                    return;
                }

                const data: ExerciseOut[] = await res.json();
                setExercises(data);
                setFilteredExercises(data);
            } catch (err) {
                console.error('Error de red al obtener ejercicios:', err);
            } finally {
                setLoading(false);
            }
        },
        []
    );

    useEffect(() => {
        if (!token) {
            setLoading(false);
            return;
        }
        if (role !== 'THERAPIST') {
            setLoading(false);
            return;
        }
        loadExercises(token);
    }, [token, role, loadExercises]);

    // filtro de búsqueda
    useEffect(() => {
        if (!search.trim()) {
            setFilteredExercises(exercises);
            return;
        }

        const lower = search.toLowerCase();
        setFilteredExercises(
            exercises.filter(
                (ex) =>
                    ex.name.toLowerCase().includes(lower) ||
                    (ex.prompt ?? '').toLowerCase().includes(lower) ||
                    ex.text.toLowerCase().includes(lower)
            )
        );
    }, [search, exercises]);

    const openDetails = (exercise: ExerciseOut) => {
        setDetailExercise(exercise);
        setDetailVisible(true);
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

                    <p className="text-600 text-sm m-0">
                        Usa el menú &quot;Ejercicios &gt; Crear&quot; para generar tu primer
                        ejercicio.
                    </p>
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
        </div>
    );
};

export default ExerciseListPage;
