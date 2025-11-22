'use client';

import { InputTextarea } from 'primereact/inputtextarea';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Tag } from 'primereact/tag';
import { Card } from 'primereact/card';
import AudioPlayer from '../AudioPlayer';

import React, { useEffect, useState } from 'react';



type Role = 'THERAPIST' | 'STUDENT';

interface BackendUser {
    id: number;
    full_name: string;
    email: string;
    role: Role;
}

interface ExercisePreview {
    text: string;
    marked_text: string;
}

interface ExerciseOut {
    id: number;
    name: string;
    prompt?: string | null;
    text: string;
    audio_path: string;
    created_at: string;
}

const AUDIO_BASE_URL = 'http://localhost:8000'; // 👈 ajusta esto si sirves audio en otra ruta

const stripRepTags = (value: string): string => {
    return value
        .replace(/\[REP[^\]]*\]/g, '') // [REP], [REP 2.0], etc.
        .replace(/\[\/REP\]/g, '');
};

const CreateExercisePage: React.FC = () => {
    const [token, setToken] = useState<string | null>(null);
    const [role, setRole] = useState<Role | null>(null);

    const [showSidebar, setShowSidebar] = useState(true);
    const [isMobile, setIsMobile] = useState(false);
    const [showExercisesModal, setShowExercisesModal] = useState(false);

    const [prompt, setPrompt] = useState('');
    const [generating, setGenerating] = useState(false);

    const [preview, setPreview] = useState<ExercisePreview | null>(null);
    const [markedText, setMarkedText] = useState('');
    const [plainText, setPlainText] = useState('');

    const [showNameDialog, setShowNameDialog] = useState(false);
    const [exerciseName, setExerciseName] = useState('');
    const [saving, setSaving] = useState(false);

    const [myExercises, setMyExercises] = useState<ExerciseOut[]>([]);
    const [loadingExercises, setLoadingExercises] = useState(false);

    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    // 🔍 estado para detalles
    const [detailExercise, setDetailExercise] = useState<ExerciseOut | null>(null);
    const [detailVisible, setDetailVisible] = useState(false);

    // 🔍 búsqueda de ejercicios
    const [exerciseSearch, setExerciseSearch] = useState('');

    // lista filtrada según búsqueda
    const filteredExercises = !exerciseSearch.trim()
        ? myExercises
        : myExercises.filter((ex) => {
            const q = exerciseSearch.toLowerCase();
            return (
                ex.name.toLowerCase().includes(q) ||
                (ex.prompt ?? '').toLowerCase().includes(q) ||
                ex.text.toLowerCase().includes(q)
            );
        });

    // ─────────────────────────────
    // Detectar tamaño de pantalla
    // ─────────────────────────────
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const check = () => {
            setIsMobile(window.innerWidth < 992); // breakpoint ~lg
        };

        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    // ─────────────────────────────
    // Cargar usuario + token
    // ─────────────────────────────
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const userRaw = window.localStorage.getItem('backend_user');
        if (userRaw) {
            try {
                const u = JSON.parse(userRaw) as BackendUser;
                setRole(u.role);
            } catch {
                setRole(null);
            }
        }

        const t = window.localStorage.getItem('backend_token');
        setToken(t);
    }, []);

    // ─────────────────────────────
    // Cargar ejercicios existentes
    // ─────────────────────────────
    useEffect(() => {
        if (!token) return;
        if (role !== 'THERAPIST') return;

        const fetchExercises = async () => {
            try {
                setLoadingExercises(true);
                const res = await fetch('http://localhost:8000/exercises/mine', {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });
                if (!res.ok) {
                    console.error('Error listando ejercicios:', await res.text());
                    return;
                }
                const data: ExerciseOut[] = await res.json();
                setMyExercises(data);
            } catch (err) {
                console.error('Error de red listando ejercicios:', err);
            } finally {
                setLoadingExercises(false);
            }
        };

        fetchExercises();
    }, [token, role]);

    useEffect(() => {
        setPlainText(stripRepTags(markedText));
    }, [markedText]);

    // ─────────────────────────────
    // Generar preview con IA
    // ─────────────────────────────
    const handleGeneratePreview = async () => {
        setSuccessMsg(null);
        setErrorMsg(null);

        if (!token) {
            setErrorMsg('No se encontró el token de autenticación.');
            return;
        }
        if (role !== 'THERAPIST') {
            setErrorMsg('Solo los terapeutas pueden crear ejercicios.');
            return;
        }
        if (!prompt.trim()) {
            setErrorMsg('Escribe un prompt para generar el ejercicio.');
            return;
        }

        setGenerating(true);

        try {
            const res = await fetch('http://localhost:8000/exercises/preview', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ prompt: prompt.trim() }),
            });

            if (!res.ok) {
                const text = await res.text();
                console.error('Error generando preview:', text);
                setErrorMsg(text || 'No se pudo generar el ejercicio.');
                return;
            }

            const data: ExercisePreview = await res.json();
            setPreview(data);
            setMarkedText(data.marked_text);
            setPlainText(stripRepTags(data.text));
        } catch (err) {
            console.error('Error de red generando preview:', err);
            setErrorMsg('Error de red al generar el ejercicio.');
        } finally {
            setGenerating(false);
        }
    };

    // ─────────────────────────────
    // Guardar ejercicio
    // ─────────────────────────────
    const openSaveDialog = () => {
        setSuccessMsg(null);
        setErrorMsg(null);

        if (!preview || !markedText.trim() || !plainText.trim()) {
            setErrorMsg('Primero genera y revisa el texto del ejercicio.');
            return;
        }

        setExerciseName('');
        setShowNameDialog(true);
    };

    const handleSaveExercise = async () => {
        if (!token) {
            setErrorMsg('No se encontró el token de autenticación.');
            return;
        }
        if (!exerciseName.trim()) {
            setErrorMsg('El nombre del ejercicio es obligatorio.');
            return;
        }

        setSaving(true);
        setErrorMsg(null);

        try {
            const res = await fetch('http://localhost:8000/exercises/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    name: exerciseName.trim(),
                    prompt: prompt.trim() || null,
                    text: plainText.trim(),
                    marked_text: markedText.trim(),
                }),
            });

            if (!res.ok) {
                const text = await res.text();
                console.error('Error creando ejercicio:', text);
                setErrorMsg(text || 'No se pudo guardar el ejercicio.');
                return;
            }

            const created: ExerciseOut = await res.json();
            setMyExercises((prev) => [created, ...prev]);
            setSuccessMsg('Ejercicio creado correctamente.');
            setShowNameDialog(false);
        } catch (err) {
            console.error('Error de red creando ejercicio:', err);
            setErrorMsg('Error de red al guardar el ejercicio.');
        } finally {
            setSaving(false);
        }
    };

    const openDetails = (exercise: ExerciseOut) => {
        setDetailExercise(exercise);
        setDetailVisible(true);
    };

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
                        La creación de ejercicios está restringida a cuentas de terapeuta.
                    </p>
                </div>
            </div>
        );
    }

    // ─────────────────────────────
    // Lista de ejercicios (sidebar + modal) con búsqueda
    // ─────────────────────────────
    const renderExercisesList = () => (
        <>
            <div className="flex justify-content-between align-items-center mb-3">
                <div>
                    <h3 className="text-lg md:text-xl font-semibold m-0">
                        Tus ejercicios creados
                    </h3>
                    <p className="text-600 m-0 text-sm">
                        Revisa y reutiliza ejercicios que ya has creado.
                    </p>
                </div>
                <Tag value={`${myExercises.length}`} severity="info" />
            </div>

             {/* 🔍 input de búsqueda */}
            {myExercises.length > 0 && (
                <div className="mb-3">
                    <span className="p-input-icon-left w-full">
                        <i className="pi pi-search" />
                        <InputText
                            value={exerciseSearch}
                            onChange={(e) => setExerciseSearch(e.target.value)}
                            placeholder="Buscar por nombre, texto o prompt"
                            className="w-full"
                        />
                    </span>
                </div>
            )}

            {loadingExercises ? (
                <p className="text-600">Cargando ejercicios...</p>
            ) : !myExercises.length ? (
                <p className="text-600">
                    Aún no has creado ejercicios. Cuando guardes uno, aparecerá aquí.
                </p>
            ) : !filteredExercises.length ? (
                <p className="text-600">
                    No se encontraron ejercicios para esa búsqueda.
                </p>
            ) : (
                <div
                    className="flex flex-column gap-2"
                    style={{ maxHeight: '60vh', overflowY: 'auto' }}
                >
                    {filteredExercises.map((ex) => (
                        <Card
                            key={ex.id}
                            className="border-1 surface-border"
                            title={ex.name}
                            subTitle={new Date(ex.created_at).toLocaleString()}
                        >
                            <p className="m-0 text-sm text-700 line-height-3">
                                {ex.text.length > 160 ? ex.text.slice(0, 160) + '…' : ex.text}
                            </p>
                            <div className="flex justify-content-end mt-2">
                                <Button
                                    label="Ver detalles"
                                    icon="pi pi-search"
                                    className="p-button-text p-button-sm"
                                    onClick={() => openDetails(ex)}
                                />
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </>
    );

    return (
        <div className="surface-ground p-3 md:p-4" style={{ minHeight: '60vh' }}>
            {/* Encabezado + toggle */}
            <div className="flex justify-content-between align-items-center mb-3">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold m-0">
                        Creador de ejercicios
                    </h1>
                    <p className="text-600 m-0 mt-1 text-sm md:text-base">
                        Diseña ejercicios con IA y guárdalos en tu biblioteca personal.
                    </p>
                </div>
                <Button
                    type="button"
                    label={
                        isMobile
                            ? 'Ver ejercicios'
                            : showSidebar
                                ? 'Ocultar ejercicios'
                                : 'Ver ejercicios'
                    }
                    icon={isMobile ? 'pi pi-list' : showSidebar ? 'pi pi-panel' : 'pi pi-list'}
                    className="p-button-text md:p-button-link"
                    onClick={() => {
                        if (isMobile) {
                            setShowExercisesModal(true);
                        } else {
                            setShowSidebar((v) => !v);
                        }
                    }}
                />
            </div>

            <div
                className="flex flex-column lg:flex-row gap-3"
                style={{ minHeight: '60vh' }}
            >
                {/* Columna principal */}
                <div className="flex-1" style={{ transition: 'all 0.3s ease' }}>
                    <div className="card">
                        <h2 className="text-xl md:text-2xl font-bold mb-3">
                            Crear ejercicio con IA
                        </h2>

                        <div className="grid">
                            <div className="col-12 md:col-8">
                                <p className="text-600 mb-3 text-sm md:text-base">
                                    Escribe un prompt describiendo el ejercicio que quieres
                                    generar. La IA devolverá un texto donde las partes a
                                    repetir estarán marcadas con <code>[REP]...[/REP]</code>.
                                </p>
                            </div>
                        </div>

                        <div className="field">
                            <label htmlFor="prompt" className="font-medium mb-2 block">
                                Prompt
                            </label>
                            <InputTextarea
                                id="prompt"
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                rows={5}
                                autoResize={false}
                                style={{
                                    width: '100%',
                                    minHeight: '7rem',
                                    maxHeight: '12rem',
                                    overflowY: 'auto',
                                }}
                                placeholder='Ej. "Genera un texto corto para que el niño practique la letra R, marcando las palabras que debe repetir."'
                            />
                            <small className="text-600">
                                Puedes ajustar el prompt y volver a generar tantas veces
                                como quieras.
                            </small>
                        </div>

                        <Button
                            label="Generar texto con IA"
                            icon="pi pi-sparkles"
                            className="mt-3"
                            onClick={handleGeneratePreview}
                            loading={generating}
                        />

                        {errorMsg && (
                            <p className="mt-3 text-sm p-error">{errorMsg}</p>
                        )}
                        {successMsg && (
                            <p className="mt-3 text-sm text-green-600">
                                {successMsg}
                            </p>
                        )}
                    </div>

                    {preview && (
                        <div className="card mt-3">
                            <h3 className="text-lg md:text-xl font-semibold mb-2">
                                Ajustar texto del ejercicio
                            </h3>
                            <p className="text-600 mb-3 text-sm">
                                Edita el texto con etiquetas <code>[REP] ... [/REP]</code>.
                                El texto plano se actualizará automáticamente al lado.
                            </p>

                            <div className="flex flex-column md:flex-row gap-3">
                                <div className="flex-1">
                                    <label
                                        htmlFor="marked-text"
                                        className="font-medium mb-2 block"
                                    >
                                        Texto con etiquetas [REP]
                                    </label>
                                    <InputTextarea
                                        id="marked-text"
                                        value={markedText}
                                        onChange={(e) =>
                                            setMarkedText(e.target.value)
                                        }
                                        autoResize={false}
                                        rows={12}
                                        style={{
                                            width: '100%',
                                            minHeight: '12rem',
                                            maxHeight: '20rem',
                                            overflowY: 'auto',
                                        }}
                                    />
                                    <small className="text-600">
                                        Usa [REP 2.0] ... [/REP] para marcar las palabras
                                        o frases que el niño debe repetir. Las marcas y
                                        tiempos no se mostrarán en el texto plano.
                                    </small>
                                </div>

                                <div className="flex-1">
                                    <label
                                        htmlFor="plain-text"
                                        className="font-medium mb-2 block"
                                    >
                                        Texto plano (solo lectura)
                                    </label>
                                    <InputTextarea
                                        id="plain-text"
                                        value={plainText}
                                        readOnly
                                        autoResize={false}
                                        rows={12}
                                        style={{
                                            width: '100%',
                                            minHeight: '12rem',
                                            maxHeight: '20rem',
                                            overflowY: 'auto',
                                            background: '#f9fafb',
                                        }}
                                    />
                                    <small className="text-600">
                                        Es el texto que verá el estudiante. Se genera
                                        eliminando las etiquetas [REP]/[/REP] y las
                                        marcas de tiempo como [REP 2.0].
                                    </small>
                                </div>
                            </div>

                            <div className="flex justify-content-end mt-3">
                                <Button
                                    label="Guardar ejercicio"
                                    icon="pi pi-save"
                                    onClick={openSaveDialog}
                                    disabled={!plainText.trim()}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Sidebar SOLO en pantallas grandes */}
                {!isMobile && (
                    <div
                        style={{
                            width: showSidebar ? '360px' : '0px',
                            transition: 'width 0.3s ease',
                            overflow: 'hidden',
                        }}
                    >
                        <div
                            className="card h-full flex flex-column"
                            style={{
                                opacity: showSidebar ? 1 : 0,
                                transform: showSidebar
                                    ? 'translateX(0)'
                                    : 'translateX(24px)',
                                transition:
                                    'opacity 0.25s ease, transform 0.25s ease',
                            }}
                        >
                            {renderExercisesList()}
                        </div>
                    </div>
                )}
            </div>

            {/* Dialog para nombre del ejercicio */}
            <Dialog
                header="Guardar ejercicio"
                visible={showNameDialog}
                modal
                style={{ width: '28rem', maxWidth: '95vw' }}
                onHide={() => setShowNameDialog(false)}
            >
                <div className="p-fluid flex flex-column gap-3">
                    <div className="field">
                        <label htmlFor="exercise-name">Nombre</label>
                        <InputText
                            id="exercise-name"
                            value={exerciseName}
                            onChange={(e) => setExerciseName(e.target.value)}
                            maxLength={80}
                            placeholder="Ej. Practicar la letra R: historia corta"
                        />
                        <small className="text-600">
                            Máx. 80 caracteres. Este nombre aparecerá en la lista de
                            ejercicios.
                        </small>
                    </div>

                    {errorMsg && (
                        <small className="p-error">{errorMsg}</small>
                    )}

                    <div className="flex justify-content-end gap-2 mt-2">
                        <Button
                            label="Cancelar"
                            className="p-button-text"
                            onClick={() => setShowNameDialog(false)}
                            disabled={saving}
                        />
                        <Button
                            label="Guardar"
                            icon="pi pi-check"
                            onClick={handleSaveExercise}
                            loading={saving}
                        />
                    </div>
                </div>
            </Dialog>

            {/* Modal con la lista de ejercicios para móviles */}
            <Dialog
                header="Tus ejercicios creados"
                visible={showExercisesModal && isMobile}
                modal
                style={{ width: '95vw', maxWidth: '32rem' }}
                onHide={() => setShowExercisesModal(false)}
            >
                {renderExercisesList()}
            </Dialog>

            {/* Modal de detalles del ejercicio */}
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

export default CreateExercisePage;
