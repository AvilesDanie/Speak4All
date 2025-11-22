'use client';

import React, { useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { Tag } from 'primereact/tag';

type CourseDetails = {
    id: number;
    name: string;
    description?: string | null;
    join_code?: string;
};

interface CourseDetailsDialogProps {
    visible: boolean;
    onHide: () => void;
    course: CourseDetails | null;
}

const CourseDetailsDialog: React.FC<CourseDetailsDialogProps> = ({
    visible,
    onHide,
    course,
}) => {
    const [copied, setCopied] = useState(false);

    if (!course) return null;

    const handleCopy = async () => {
        if (!course.join_code) return;
        try {
            await navigator.clipboard.writeText(course.join_code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (e) {
            console.error('No se pudo copiar', e);
        }
    };

    return (
        <Dialog
            header="Detalles del curso"
            visible={visible}
            modal
            style={{ width: '32rem', maxWidth: '95vw' }}
            onHide={onHide}
        >
            {/* Contenido con scroll vertical */}
            <div
                className="p-fluid flex flex-column gap-3 pr-1"
                style={{
                    maxHeight: '60vh',
                    overflowY: 'auto',
                    overflowX: 'hidden',
                }}
            >
                {/* Nombre del curso */}
                <h2
                    className="m-0 text-xl md:text-2xl font-semibold"
                    style={{
                        wordBreak: 'break-word',
                    }}
                >
                    {course.name}
                </h2>

                {/* Descripción */}
                {course.description && (
                    <div>
                        <h4 className="m-0 mb-2 text-m text-600">Descripción</h4>
                        <p
                            className="m-0 text-700"
                            style={{
                                whiteSpace: 'pre-line',
                                wordBreak: 'break-word',
                            }}
                        >
                            {course.description}
                        </p>
                    </div>
                )}

                {/* Código del curso — NUEVO DISEÑO */}
                {course.join_code && (
                    <div>
                        <h4 className="m-0 mb-2 text-m text-600">Código de curso:</h4>

                        <div className="flex align-items-center justify-content-between gap-3">
                            {/* Código grande */}
                            <span
                                className="px-4 py-2 border-round-xl text-xl font-semibold"
                                style={{
                                    background: '#eef2ff',
                                    color: '#4f46e5',
                                    letterSpacing: '0.08em',
                                }}
                            >
                                {course.join_code}
                            </span>

                            {/* Botón copiar */}
                            <Button
                                icon={copied ? 'pi pi-check' : 'pi pi-copy'}
                                label={copied ? 'Copiado' : 'Copiar'}
                                className="p-button-text"
                                onClick={handleCopy}
                            />
                        </div>
                    </div>
                )}

                <div className="flex justify-content-end mt-4">
                    <Button label="Cerrar" onClick={onHide} />
                </div>
            </div>
        </Dialog>
    );
};

export default CourseDetailsDialog;
