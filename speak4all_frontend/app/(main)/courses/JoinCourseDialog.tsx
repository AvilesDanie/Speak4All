// app/(main)/courses/JoinCourseDialog.tsx
'use client';

import React, { useState } from 'react';
import { joinCourse } from '@/services/courses';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';

interface JoinCourseDialogProps {
    visible: boolean;
    onHide: () => void;
    token: string | null;
    onJoined?: () => void;              // para recargar lista, etc.
    onSuccess?: (message?: string) => void;  // 👈 nuevo callback
}

const JoinCourseDialog: React.FC<JoinCourseDialogProps> = ({
    visible,
    onHide,
    token,
    onJoined,
    onSuccess,
}) => {
    const [joinCode, setJoinCode] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const resetForm = () => {
        setJoinCode('');
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
        if (!joinCode.trim()) {
            setError('El código de curso es obligatorio.');
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            await joinCourse(token, joinCode.trim());
            if (onJoined) onJoined();
            if (onSuccess)
                onSuccess(
                    'Tu solicitud para unirte al curso ha sido enviada. ' +
                        'Espera a que tu terapeuta la acepte.'
                );
            resetForm();
            onHide();
        } catch (err: any) {
            console.error('Error uniéndose al curso:', err);
            setError(err.message || 'No se pudo enviar la solicitud.');
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
                label="Enviar solicitud"
                icon="pi pi-sign-in"
                onClick={handleSubmit}
                loading={submitting}
            />
        </div>
    );

    return (
        <Dialog
            header="Unirse a un curso"
            visible={visible}
            style={{ width: '28rem', maxWidth: '95vw' }}
            modal
            onHide={handleClose}
            footer={footer}
        >
            <div className="p-fluid formgrid grid">
                <div className="field col-12">
                    <label htmlFor="join-code">Código de curso</label>
                    <InputText
                        id="join-code"
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value)}
                        placeholder="Ej. sKds_a"
                    />
                    <small className="text-600">
                        Introduce el código que te compartió tu terapeuta.
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

export default JoinCourseDialog;
