'use client';

import React, { useEffect, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Accordion, AccordionTab } from 'primereact/accordion';
import { InputNumber } from 'primereact/inputnumber';
import { InputTextarea } from 'primereact/inputtextarea';
import { Message } from 'primereact/message';
import { getMyExercises } from '@/services/exercises';
import { publishCourseExercise } from '@/services/courses';
import { rubricService } from '@/services/rubrics';

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
    const [configureRubric, setConfigureRubric] = useState(false);
    const [rubricCriteria, setRubricCriteria] = useState<Array<{
        name: string;
        max_points: number;
        levels: Array<{ name: string; description: string; points: number; order: number }>;
    }>>([
        {
            name: 'Pronunciación',
            max_points: 25,
            levels: [
                { name: 'Excelente', description: 'Pronunciación clara y correcta', points: 25, order: 0 },
                { name: 'Bueno', description: 'Pronunciación con errores menores', points: 20, order: 1 },
                { name: 'Aceptable', description: 'Pronunciación con errores notorios', points: 15, order: 2 },
                { name: 'Insuficiente', description: 'Pronunciación difícil de entender', points: 0, order: 3 },
            ],
        },
    ]);

    useEffect(() => {
        if (!visible) return;
        const load = async () => {
            try {
                setLoading(true);
                const data = await getMyExercises(token, 1, 1000);
                setExercises(data.items);
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
            // Publicar ejercicio
            const published = await publishCourseExercise(token, courseId, selectedId, dueDate ? new Date(dueDate).toISOString() : null);
            
            // Crear rúbrica si está configurada
            if (configureRubric && rubricCriteria.length > 0) {
                try {
                    // Crear rúbrica vacía (sin criterios por defecto)
                    const totalPoints = rubricCriteria.reduce((sum, c) => sum + c.max_points, 0);
                    const rubric = await rubricService.createEmpty(published.id, token);
                    
                    // Actualizar puntuación máxima
                    await rubricService.updateRubric(published.id, { max_score: totalPoints }, token);
                    
                    // Agregar criterios configurados
                    for (const crit of rubricCriteria) {
                        const created = await rubricService.addCriteria(published.id, {
                            name: crit.name,
                            max_points: crit.max_points,
                        }, token);
                        
                        // Agregar niveles
                        for (const level of crit.levels) {
                            await rubricService.addLevel(created.id, level, token);
                        }
                    }
                } catch (rubricErr) {
                    console.error('Error creando rúbrica:', rubricErr);
                    // No fallar la publicación si la rúbrica falla
                }
            }
            
            onPublished?.();
            onHide();
            setSelectedId(null);
            setDueDate('');
            setConfigureRubric(false);
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
            style={{ width: '50rem', maxWidth: '95vw' }}
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

                    <div className="flex align-items-center gap-2">
                        <input
                            type="checkbox"
                            id="config-rubric"
                            checked={configureRubric}
                            onChange={(e) => setConfigureRubric(e.target.checked)}
                            className="p-checkbox"
                        />
                        <label htmlFor="config-rubric" className="text-sm font-medium">
                            Configurar rúbrica de evaluación
                        </label>
                    </div>

                    {configureRubric && (
                        <div className="surface-50 border-round p-3">
                            <Message severity="info" text="Define los criterios y niveles de evaluación para este ejercicio" className="mb-2" />
                            <Message severity="warn" text="⚠️ Una vez que se evalúe alguna entrega, la rúbrica quedará bloqueada y no se podrá modificar" className="mb-3" />
                            
                            {rubricCriteria.map((crit, critIdx) => (
                                <Accordion key={critIdx} className="mb-2">
                                    <AccordionTab header={`${crit.name} (${crit.max_points} pts)`}>
                                        <div className="flex flex-column gap-2">
                                            <InputText
                                                value={crit.name}
                                                onChange={(e) => {
                                                    const updated = [...rubricCriteria];
                                                    updated[critIdx].name = e.target.value;
                                                    setRubricCriteria(updated);
                                                }}
                                                placeholder="Nombre del criterio"
                                            />
                                            <InputNumber
                                                value={crit.max_points}
                                                onValueChange={(e) => {
                                                    const updated = [...rubricCriteria];
                                                    updated[critIdx].max_points = e.value ?? 25;
                                                    setRubricCriteria(updated);
                                                }}
                                                prefix="Puntos: "
                                                min={1}
                                                max={100}
                                                showButtons
                                            />

                                            <h5 className="mt-2 mb-1">Niveles</h5>
                                            {crit.levels.map((lvl, lvlIdx) => (
                                                <div key={lvlIdx} className="flex gap-2 p-2 surface-100 border-round">
                                                    <div className="flex-1">
                                                        <InputText
                                                            value={lvl.name}
                                                            onChange={(e) => {
                                                                const updated = [...rubricCriteria];
                                                                updated[critIdx].levels[lvlIdx].name = e.target.value;
                                                                setRubricCriteria(updated);
                                                            }}
                                                            placeholder="Nombre"
                                                            className="mb-1"
                                                        />
                                                        <InputTextarea
                                                            value={lvl.description}
                                                            onChange={(e) => {
                                                                const updated = [...rubricCriteria];
                                                                updated[critIdx].levels[lvlIdx].description = e.target.value;
                                                                setRubricCriteria(updated);
                                                            }}
                                                            placeholder="Descripción"
                                                            autoResize
                                                            rows={2}
                                                        />
                                                        <InputNumber
                                                            value={lvl.points}
                                                            onValueChange={(e) => {
                                                                const updated = [...rubricCriteria];
                                                                updated[critIdx].levels[lvlIdx].points = e.value ?? 0;
                                                                setRubricCriteria(updated);
                                                            }}
                                                            suffix=" pts"
                                                            min={0}
                                                            max={crit.max_points}
                                                            className="mt-1"
                                                        />
                                                    </div>
                                                    <Button
                                                        icon="pi pi-trash"
                                                        className="p-button-text p-button-danger"
                                                        onClick={() => {
                                                            const updated = [...rubricCriteria];
                                                            updated[critIdx].levels = updated[critIdx].levels.filter((_, i) => i !== lvlIdx);
                                                            setRubricCriteria(updated);
                                                        }}
                                                    />
                                                </div>
                                            ))}
                                            <Button
                                                label="Agregar nivel"
                                                icon="pi pi-plus"
                                                className="p-button-text p-button-sm"
                                                onClick={() => {
                                                    const updated = [...rubricCriteria];
                                                    updated[critIdx].levels.push({
                                                        name: `Nivel ${crit.levels.length + 1}`,
                                                        description: '',
                                                        points: 0,
                                                        order: crit.levels.length,
                                                    });
                                                    setRubricCriteria(updated);
                                                }}
                                            />
                                            <Button
                                                label="Eliminar criterio"
                                                icon="pi pi-trash"
                                                className="p-button-danger p-button-sm mt-2"
                                                onClick={() => {
                                                    setRubricCriteria(rubricCriteria.filter((_, i) => i !== critIdx));
                                                }}
                                            />
                                        </div>
                                    </AccordionTab>
                                </Accordion>
                            ))}

                            <Button
                                label="Agregar criterio"
                                icon="pi pi-plus"
                                className="p-button-outlined"
                                onClick={() => {
                                    setRubricCriteria([
                                        ...rubricCriteria,
                                        {
                                            name: `Criterio ${rubricCriteria.length + 1}`,
                                            max_points: 25,
                                            levels: [
                                                { name: 'Excelente', description: '', points: 25, order: 0 },
                                                { name: 'Bueno', description: '', points: 15, order: 1 },
                                                { name: 'Insuficiente', description: '', points: 0, order: 2 },
                                            ],
                                        },
                                    ]);
                                }}
                            />
                        </div>
                    )}

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
