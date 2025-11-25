'use client';

import React, { useEffect, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { getMyExercises } from '@/services/exercises';
import { publishCourseExercise } from '@/services/courses';

interface PublishExerciseDialogProps {
    visible: boolean;
    onHide: () => void;
    token: string;
    courseId: number;
    publishedExerciseIds?: number[];
    onPublished?: () => void;
}

interface Exercise {
    id: number;
    name: string;
    text: string;
    created_at: string;
}

const PublishExerciseDialog: React.FC<PublishExerciseDialogProps> = ({
    visible,
    onHide,
    token,
    courseId,
    publishedExerciseIds = [],
    onPublished,
}) => {
    const [exercises, setExercises] = useState<Exercise[]>([]);
    const [availableExercises, setAvailableExercises] = useState<Exercise[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [dueDate, setDueDate] = useState<string>('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!visible) return;
        const load = async () => {
            try {
                setLoading(true);
                const data = await getMyExercises(token);
                setExercises(data);
            } catch (err: any) {
                console.error('Error obteniendo ejercicios:', err);
                setError(err?.message || 'No se pudieron obtener los ejercicios.');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [visible, token]);

    // Filtrar ejercicios ya publicados
    useEffect(() => {
        const filtered = exercises.filter(
            (ex) => !publishedExerciseIds.includes(ex.id)
        );
        setAvailableExercises(filtered);
    }, [exercises, publishedExerciseIds]);

    const handlePublish = async () => {
        if (!selectedId) {
            setError('Selecciona un ejercicio.');
            return;
        }
        setSubmitting(true);
        setError(null);
        try {
            await publishCourseExercise(token, courseId, selectedId, dueDate ? new Date(dueDate).toISOString() : null);
            onPublished?.();
            onHide();
            setSelectedId(null);
            setDueDate('');
        } catch (err: any) {
            console.error('Error publicando ejercicio:', err);
            setError(err?.message || 'No se pudo publicar el ejercicio.');
        } finally {
            setSubmitting(false);
        }
    };

    const footer = (
        <div className="flex justify-content-end gap-2">
            <Button
                label="Cancelar"
                className="p-button-text"
                onClick={onHide}
                disabled={submitting}
            />
            <Button
                label="Publicar"
                icon="pi pi-share-alt"
                onClick={handlePublish}
                loading={submitting}
            />
        </div>
    );

    return (
        <Dialog
            header="Publicar ejercicio en el curso"
            visible={visible}
            modal
            style={{ width: '32rem', maxWidth: '95vw' }}
            onHide={onHide}
            footer={footer}
        >
            {loading ? (
                <p>Cargando ejercicios...</p>
            ) : !exercises.length ? (
                <p className="text-600">
                    No tienes ejercicios creados. Crea uno primero y vuelve aquí.
                </p>
            ) : !availableExercises.length ? (
                <p className="text-600">
                    Todos tus ejercicios ya están publicados en este curso.
                </p>
            ) : (
                <div className="p-fluid flex flex-column gap-3">
                    <div>
                        <h4 className="m-0 mb-2 text-sm text-600">
                            Selecciona un ejercicio
                        </h4>
                        <div className="card p-0" style={{ maxHeight: '14rem', overflowY: 'auto' }}>
                            {availableExercises.map((ex) => (
                                <div
                                    key={ex.id}
                                    className={`flex flex-column p-3 cursor-pointer border-bottom-1 surface-border ${
                                        selectedId === ex.id ? 'surface-100' : ''
                                    }`}
                                    onClick={() => setSelectedId(ex.id)}
                                >
                                    <div className="flex justify-content-between align-items-center mb-1">
                                        <span className="font-semibold text-800">
                                            {ex.name}
                                        </span>
                                        {selectedId === ex.id && (
                                            <i className="pi pi-check text-green-500" />
                                        )}
                                    </div>
                                    <p className="m-0 text-sm text-700 line-height-3">
                                        {ex.text.length > 100
                                            ? ex.text.slice(0, 100) + '…'
                                            : ex.text}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label htmlFor="due" className="text-sm text-700 mb-1 block">
                            Fecha límite (opcional)
                        </label>
                        <InputText
                            id="due"
                            type="datetime-local"
                            value={dueDate}
                            onChange={(e) => setDueDate(e.target.value)}
                        />
                        <small className="text-600">
                            Si la dejas vacía, el ejercicio no tendrá fecha límite.
                        </small>
                    </div>

                    {error && (
                        <small className="p-error" style={{ display: 'block' }}>
                            {error}
                        </small>
                    )}
                </div>
            )}
        </Dialog>
    );
};

export default PublishExerciseDialog;
