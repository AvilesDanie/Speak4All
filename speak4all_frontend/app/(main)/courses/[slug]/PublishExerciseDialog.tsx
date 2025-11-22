'use client';

import React, { useEffect, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';

interface PublishExerciseDialogProps {
    visible: boolean;
    onHide: () => void;
    token: string;
    courseId: number;
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
    onPublished,
}) => {
    const [exercises, setExercises] = useState<Exercise[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [dueDate, setDueDate] = useState<string>('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!visible) return;

        const fetchExercises = async () => {
            try {
                setLoading(true);
                const res = await fetch('http://localhost:8000/exercises/mine', {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (!res.ok) {
                    const text = await res.text();
                    console.error('Error obteniendo ejercicios:', text);
                    setError(text || 'No se pudieron obtener los ejercicios.');
                    return;
                }
                const data: Exercise[] = await res.json();
                setExercises(data);
            } catch (err) {
                console.error('Error de red:', err);
                setError('Error de red al obtener ejercicios.');
            } finally {
                setLoading(false);
            }
        };

        fetchExercises();
    }, [visible, token]);

    const handlePublish = async () => {
        if (!selectedId) {
            setError('Selecciona un ejercicio.');
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            const body: any = {
                course_id: courseId,
                exercise_id: selectedId,
                due_date: dueDate ? new Date(dueDate).toISOString() : null,
            };

            const res = await fetch('http://localhost:8000/course-exercises/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const text = await res.text();
                console.error('Error publicando ejercicio:', text);
                setError(text || 'No se pudo publicar el ejercicio.');
                return;
            }

            if (onPublished) onPublished();
            onHide();
            setSelectedId(null);
            setDueDate('');
        } catch (err) {
            console.error('Error de red:', err);
            setError('Error de red al publicar el ejercicio.');
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
            ) : (
                <div className="p-fluid flex flex-column gap-3">
                    <div>
                        <h4 className="m-0 mb-2 text-sm text-600">
                            Selecciona un ejercicio
                        </h4>
                        <div className="card p-0" style={{ maxHeight: '14rem', overflowY: 'auto' }}>
                            {exercises.map((ex) => (
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
