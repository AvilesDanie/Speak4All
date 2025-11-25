'use client';

import React, { useState } from 'react';
import { createCourse } from '@/services/courses';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Button } from 'primereact/button';

interface CreateCourseDialogProps {
    visible: boolean;
    onHide: () => void;
    token: string | null;
    onCreated?: () => void;
}

const NAME_LIMIT = 60;
const DESC_LIMIT = 200;

const CreateCourseDialog: React.FC<CreateCourseDialogProps> = ({
    visible,
    onHide,
    token,
    onCreated,
}) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const resetForm = () => {
        setName('');
        setDescription('');
        setError(null);
    };

    const handleClose = () => {
        if (!submitting) {
            resetForm();
            onHide();
        }
    };

    const handleSubmit = async () => {
        if (!token) {
            setError('No se encontró el token de autenticación.');
            return;
        }

        if (!name.trim()) {
            setError('El nombre del curso es obligatorio.');
            return;
        }

        if (name.length > NAME_LIMIT) {
            setError(`El nombre excede el límite de ${NAME_LIMIT} caracteres.`);
            return;
        }

        if (description.length > DESC_LIMIT) {
            setError(`La descripción excede el límite de ${DESC_LIMIT} caracteres.`);
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            await createCourse(token, name.trim(), description.trim() || null);
            if (onCreated) onCreated();
            resetForm();
            onHide();
        } catch (err: any) {
            console.error('Error creando curso:', err);
            setError(err.message || 'Error al crear el curso.');
        } finally {
            setSubmitting(false);
        }
    };

    const footer = (
        <div className="flex justify-content-end gap-2">
            <Button
                label="Cancelar"
                className="p-button-text"
                onClick={handleClose}
                disabled={submitting}
            />
            <Button
                label="Crear"
                icon="pi pi-check"
                onClick={handleSubmit}
                loading={submitting}
            />
        </div>
    );

    return (
        <Dialog
            header="Crear nuevo curso"
            visible={visible}
            style={{ width: '32rem', maxWidth: '95vw' }}
            modal
            onHide={handleClose}
            footer={footer}
        >
            <div className="p-fluid formgrid grid">

                {/* NOMBRE */}
                <div className="field col-12">
                    <label htmlFor="course-name">Nombre del curso</label>
                    <InputText
                        id="course-name"
                        value={name}
                        maxLength={NAME_LIMIT}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ej. Terapia de lenguaje grupo A"
                    />
                    <small className="text-600">
                        {name.length}/{NAME_LIMIT} caracteres
                    </small>
                </div>

                {/* DESCRIPCIÓN */}
                <div className="field col-12">
                    <label htmlFor="course-description">Descripción (opcional)</label>
                    <InputTextarea
                        id="course-description"
                        rows={4}
                        value={description}
                        maxLength={DESC_LIMIT}
                        onChange={(e) => setDescription(e.target.value)}
                        autoResize
                        placeholder="Describe brevemente el propósito del curso."
                    />
                    <small className="text-600">
                        {description.length}/{DESC_LIMIT} caracteres
                    </small>
                </div>

                {error && (
                    <div className="field col-12">
                        <small className="p-error">{error}</small>
                    </div>
                )}
            </div>
        </Dialog>
    );
};

export default CreateCourseDialog;
