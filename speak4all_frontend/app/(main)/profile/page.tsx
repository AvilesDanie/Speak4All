'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Password } from 'primereact/password';
import { FileUpload, FileUploadHandlerEvent } from 'primereact/fileupload';
import { Avatar } from 'primereact/avatar';
import { Toast } from 'primereact/toast';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { ProgressSpinner } from 'primereact/progressspinner';
import { Divider } from 'primereact/divider';
import { Dialog } from 'primereact/dialog';
import Cropper, { Area } from 'react-easy-crop';
import {
    getMyProfile,
    updateMyProfile,
    uploadAvatar,
    deleteAvatar,
    getMyAvatarUrl,
    changePassword,
    UserProfile
} from '@/services/profile';
import { API_BASE } from '@/services/apiClient';

const EMAIL_MIN_LENGTH = 5;
const EMAIL_MAX_LENGTH = 254;
const EMAIL_FORMAT_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN_LENGTH = 6;
const PASSWORD_MAX_LENGTH = 72;
const FULL_NAME_MAX_LENGTH = 80;
const FULL_NAME_ALLOWED_REGEX = /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü\s]+$/;

const createImage = (url: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.onload = () => resolve(image);
        image.onerror = (error) => reject(error);
        image.src = url;
    });

const getCroppedImg = async (imageSrc: string, pixelCrop: Area): Promise<Blob> => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No canvas context');

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height
    );

    return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Canvas is empty'));
        }, 'image/jpeg');
    });
};

export default function ProfilePage() {
    const router = useRouter();
    const toast = useRef<Toast>(null);
    const fileUploadRef = useRef<FileUpload>(null);

    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

    // Cropper
    const [cropModalVisible, setCropModalVisible] = useState(false);
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [selectedFileName, setSelectedFileName] = useState<string>('');
    const [cropperReady, setCropperReady] = useState(false);

    // Formulario de perfil
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');

    // Formulario de cambio de contraseña
    const [showPasswordSection, setShowPasswordSection] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [changingPassword, setChangingPassword] = useState(false);

    // Detectar cambios
    const hasProfileChanges = profile && (fullName !== profile.full_name || email !== profile.email);
    const hasPasswordInput = profile?.has_password
        ? (currentPassword.trim() !== '' || newPassword.trim() !== '' || confirmPassword.trim() !== '')
        : (newPassword.trim() !== '' || confirmPassword.trim() !== '');

    const onCropComplete = (_: Area, croppedPixels: Area) => {
        setCroppedAreaPixels(croppedPixels);
    };

    const readFileAsDataURL = (file: File) =>
        new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });

    useEffect(() => {
        const storedToken = window.localStorage.getItem('backend_token');
        if (!storedToken) {
            router.push('/auth/login2');
            return;
        }
        setToken(storedToken);
        loadProfile(storedToken);
    }, [router]);

    const loadProfile = async (authToken: string) => {
        try {
            setLoading(true);
            const data = await getMyProfile(authToken);
            setProfile(data);
            setFullName(data.full_name);
            setEmail(data.email);

            // Cargar avatar si existe
            if (data.avatar_path) {
                const avatarData = await getMyAvatarUrl(authToken);
                if (avatarData.url) {
                    const url = avatarData.url.startsWith('http') ? avatarData.url : `${API_BASE}${avatarData.url}`;
                    setAvatarUrl(url);
                    window.localStorage.setItem('backend_user', JSON.stringify({ ...(data as any), avatar_path: data.avatar_path }));
                    window.dispatchEvent(
                        new CustomEvent('avatar-updated', {
                            detail: {
                                avatarPath: data.avatar_path,
                                url,
                            },
                        })
                    );
                }
            }
        } catch (err) {
            console.error('Error loading profile:', err);
            toast.current?.show({
                severity: 'error',
                summary: 'Error',
                detail: 'No se pudo cargar el perfil',
                life: 3000,
            });
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateProfile = async () => {
        const normalizedFullName = fullName.trim();
        const normalizedEmail = email.trim();

        if (!token || !normalizedFullName || !normalizedEmail) {
            toast.current?.show({
                severity: 'warn',
                summary: 'Campos requeridos',
                detail: 'Nombre y email son obligatorios',
                life: 3000,
            });
            return;
        }

        if (normalizedEmail.length < EMAIL_MIN_LENGTH || normalizedEmail.length > EMAIL_MAX_LENGTH) {
            toast.current?.show({
                severity: 'warn',
                summary: 'Email inválido',
                detail: `El correo debe tener entre ${EMAIL_MIN_LENGTH} y ${EMAIL_MAX_LENGTH} caracteres`,
                life: 3000,
            });
            return;
        }

        if (!EMAIL_FORMAT_REGEX.test(normalizedEmail)) {
            toast.current?.show({
                severity: 'warn',
                summary: 'Email inválido',
                detail: 'Ingresa un correo válido (ejemplo@dominio.com)',
                life: 3000,
            });
            return;
        }

        if (normalizedFullName.length > FULL_NAME_MAX_LENGTH) {
            toast.current?.show({
                severity: 'warn',
                summary: 'Nombre inválido',
                detail: `El nombre debe tener máximo ${FULL_NAME_MAX_LENGTH} caracteres`,
                life: 3000,
            });
            return;
        }

        if (!FULL_NAME_ALLOWED_REGEX.test(normalizedFullName)) {
            toast.current?.show({
                severity: 'warn',
                summary: 'Nombre inválido',
                detail: 'El nombre solo puede contener letras y espacios',
                life: 3000,
            });
            return;
        }

        try {
            setSaving(true);
            const updated = await updateMyProfile(token, {
                full_name: normalizedFullName,
                email: normalizedEmail,
            });
            setProfile(updated);

            // Actualizar localStorage si cambió el nombre
            const userRaw = window.localStorage.getItem('backend_user');
            if (userRaw) {
                const user = JSON.parse(userRaw);
                user.full_name = updated.full_name;
                user.email = updated.email;
                window.localStorage.setItem('backend_user', JSON.stringify(user));
            }

            // Disparar evento personalizado para notificar cambios de nombre al sidebar
            window.dispatchEvent(
                new CustomEvent('profile-updated', {
                    detail: {
                        fullName: updated.full_name,
                        email: updated.email,
                    },
                })
            );

            toast.current?.show({
                severity: 'success',
                summary: 'Perfil actualizado',
                detail: 'Los cambios se guardaron correctamente',
                life: 3000,
            });
        } catch (err: any) {
            console.error('Error updating profile:', err);
            toast.current?.show({
                severity: 'error',
                summary: 'Error',
                detail: err.message || 'No se pudo actualizar el perfil',
                life: 3000,
            });
        } finally {
            setSaving(false);
        }
    };

    const handleAvatarUpload = async (event: FileUploadHandlerEvent) => {
        if (!token || !event.files || event.files.length === 0) return;

        const file = event.files[0];

        // Validar tamaño (5MB)
        if (file.size > 5 * 1024 * 1024) {
            toast.current?.show({
                severity: 'error',
                summary: 'Archivo muy grande',
                detail: 'El tamaño máximo es 5MB',
                life: 3000,
            });
            fileUploadRef.current?.clear();
            return;
        }

        try {
            const updated = await uploadAvatar(token, file);
            setProfile(updated);

            // Recargar URL del avatar
            const avatarData = await getMyAvatarUrl(token);
            if (avatarData.url) {
                const url = avatarData.url.startsWith('http') ? avatarData.url : `${API_BASE}${avatarData.url}`;
                setAvatarUrl(url + (url.includes('?') ? '&' : '?') + `t=${Date.now()}`);
                // Persistir en localStorage y notificar al menú
                window.localStorage.setItem('backend_user', JSON.stringify({ ...(updated as any), avatar_path: updated.avatar_path }));
                window.dispatchEvent(
                    new CustomEvent('avatar-updated', {
                        detail: {
                            avatarPath: updated.avatar_path,
                            url,
                        },
                    })
                );
            }

            toast.current?.show({
                severity: 'success',
                summary: 'Avatar actualizado',
                detail: 'La foto de perfil se actualizó correctamente',
                life: 3000,
            });
            fileUploadRef.current?.clear();
        } catch (err: any) {
            console.error('Error uploading avatar:', err);
            toast.current?.show({
                severity: 'error',
                summary: 'Error',
                detail: err.message || 'No se pudo subir el avatar',
                life: 3000,
            });
            fileUploadRef.current?.clear();
        }
    };

    const handleDeleteAvatar = () => {
        confirmDialog({
            message: '¿Estás seguro de que deseas eliminar tu foto de perfil?',
            header: 'Confirmar eliminación',
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: 'Sí, eliminar',
            rejectLabel: 'Cancelar',
            accept: async () => {
                if (!token) return;

                try {
                    const updated = await deleteAvatar(token);
                    setProfile(updated);
                    setAvatarUrl(null);
                    window.localStorage.setItem('backend_user', JSON.stringify({ ...(updated as any), avatar_path: null }));
                    window.dispatchEvent(
                        new CustomEvent('avatar-updated', {
                            detail: {
                                avatarPath: null,
                                url: null,
                            },
                        })
                    );

                    toast.current?.show({
                        severity: 'success',
                        summary: 'Avatar eliminado',
                        detail: 'La foto de perfil se eliminó correctamente',
                        life: 3000,
                    });
                } catch (err: any) {
                    console.error('Error deleting avatar:', err);
                    toast.current?.show({
                        severity: 'error',
                        summary: 'Error',
                        detail: 'No se pudo eliminar el avatar',
                        life: 3000,
                    });
                }
            },
        });
    };

    const handleChangePassword = async () => {
        if (!token) return;

        // Validar que al menos la nueva contraseña esté presente
        if (!newPassword || !confirmPassword) {
            toast.current?.show({
                severity: 'warn',
                summary: 'Campos requeridos',
                detail: 'Debes ingresar la nueva contraseña y confirmarla',
                life: 3000,
            });
            return;
        }

        if (newPassword !== confirmPassword) {
            toast.current?.show({
                severity: 'warn',
                summary: 'Contraseñas no coinciden',
                detail: 'La nueva contraseña y su confirmación deben ser iguales',
                life: 3000,
            });
            return;
        }

        if (newPassword.length < 6) {
            toast.current?.show({
                severity: 'warn',
                summary: 'Contraseña débil',
                detail: 'La contraseña debe tener al menos 6 caracteres',
                life: 3000,
            });
            return;
        }

        if (newPassword.length > PASSWORD_MAX_LENGTH) {
            toast.current?.show({
                severity: 'warn',
                summary: 'Contraseña inválida',
                detail: `La contraseña debe tener entre ${PASSWORD_MIN_LENGTH} y ${PASSWORD_MAX_LENGTH} caracteres`,
                life: 3000,
            });
            return;
        }

        try {
            setChangingPassword(true);

            // Si hay contraseña actual ingresada, enviarla. Si no, el backend lo manejará
            await changePassword(token, {
                current_password: currentPassword || undefined,
                new_password: newPassword,
            });

            toast.current?.show({
                severity: 'success',
                summary: 'Contraseña actualizada',
                detail: currentPassword ? 'Tu contraseña se cambió correctamente' : 'Contraseña establecida correctamente',
                life: 3000,
            });

            // Limpiar campos
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (err: any) {
            console.error('Error changing password:', err);
            toast.current?.show({
                severity: 'error',
                summary: 'Error',
                detail: err.message || 'No se pudo cambiar la contraseña',
                life: 3000,
            });
        } finally {
            setChangingPassword(false);
        }
    };

    if (loading) {
        return (
            <div className="flex align-items-center justify-content-center" style={{ minHeight: '400px' }}>
                <ProgressSpinner />
            </div>
        );
    }

    return (
        <>
            <div className="grid">
                <Toast ref={toast} />
                <ConfirmDialog />

                <div className="col-12">
                    <div className="card">
                        <h5>Mi Perfil</h5>
                        <p className="text-color-secondary">Administra tu información personal y configuración de cuenta</p>
                    </div>
                </div>

                {/* Avatar y datos básicos */}
                <div className="col-12 lg:col-4">
                    <Card title="Foto de perfil">
                        <div className="flex flex-column align-items-center gap-3">
                            <Avatar
                                image={avatarUrl || undefined}
                                icon={!avatarUrl ? 'pi pi-user' : undefined}
                                size="xlarge"
                                shape="circle"
                                style={{ width: '150px', height: '150px', fontSize: '4rem' }}
                            />

                            <FileUpload
                                ref={fileUploadRef}
                                mode="basic"
                                name="avatar"
                                accept="image/*"
                                maxFileSize={5000000}
                                chooseLabel="Cambiar foto"
                                customUpload={false}
                                auto={false}
                                className="w-full"
                                onSelect={async (e) => {
                                    const file = e.files?.[0];
                                    if (!file) return;
                                    setSelectedFileName(file.name || 'avatar');
                                    try {
                                        const dataUrl = await readFileAsDataURL(file);
                                        setImageSrc(dataUrl);
                                        setCropModalVisible(true);
                                        setCrop({ x: 0, y: 0 });
                                        setZoom(1);
                                        setCroppedAreaPixels(null);
                                        setCropperReady(false);
                                        setCropModalVisible(true);
                                    } catch (err) {
                                        console.error('Error leyendo archivo:', err);
                                    }
                                }}
                            />

                            {avatarUrl && (
                                <Button
                                    label="Eliminar foto"
                                    icon="pi pi-trash"
                                    severity="danger"
                                    outlined
                                    onClick={handleDeleteAvatar}
                                    className="w-full"
                                />
                            )}

                            <small className="text-color-secondary text-center">
                                Formatos: JPG, PNG, GIF, WEBP<br />
                                Tamaño máximo: 5MB
                            </small>
                        </div>
                    </Card>
                </div>

                {/* Información del perfil */}
                <div className="col-12 lg:col-8">
                    <Card title="Información personal">
                        <div className="flex flex-column gap-3">
                            <div className="field">
                                <label htmlFor="fullName">Nombre completo *</label>
                                <InputText
                                    id="fullName"
                                    value={fullName}
                                    onChange={(e) => {
                                        const nextValue = e.target.value;
                                        if (nextValue.length <= FULL_NAME_MAX_LENGTH) {
                                            setFullName(nextValue);
                                        }
                                    }}
                                    maxLength={FULL_NAME_MAX_LENGTH}
                                    className="w-full"
                                />
                            </div>

                            <div className="field">
                                <label htmlFor="email">Email *</label>
                                <InputText
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    minLength={EMAIL_MIN_LENGTH}
                                    maxLength={EMAIL_MAX_LENGTH}
                                    className="w-full"
                                />
                            </div>

                            <div className="field">
                                <label>Rol</label>
                                <InputText
                                    value={profile?.role === 'THERAPIST' ? 'Terapeuta' : 'Estudiante'}
                                    disabled
                                    className="w-full"
                                />
                            </div>

                            <div className="flex justify-content-end gap-2">
                                <Button
                                    label="Cancelar"
                                    icon="pi pi-times"
                                    outlined
                                    onClick={() => {
                                        setFullName(profile?.full_name || '');
                                        setEmail(profile?.email || '');
                                    }}
                                />
                                <Button
                                    label="Guardar cambios"
                                    icon="pi pi-check"
                                    loading={saving}
                                    disabled={!hasProfileChanges}
                                    onClick={handleUpdateProfile}
                                />
                            </div>
                        </div>
                    </Card>

                    <Divider />

                    {/* Configurar/Cambiar contraseña */}
                    <Card title={profile?.has_password ? "Cambiar contraseña" : "Configurar contraseña"}>
                        {!showPasswordSection ? (
                            <div className="text-center py-3">
                                <Button
                                    label={profile?.has_password ? "Cambiar mi contraseña" : "Configurar contraseña"}
                                    icon="pi pi-lock"
                                    outlined
                                    onClick={() => setShowPasswordSection(true)}
                                />
                            </div>
                        ) : (
                            <>
                                {profile?.role && (
                                    <div className="flex flex-column gap-3">
                                        {profile.has_password ? (
                                            // Usuario CON contraseña - Mostrar formulario de cambio
                                            <>
                                                <small className="text-color-secondary mb-2">
                                                    Para cambiar tu contraseña, ingresa tu contraseña actual y la nueva.
                                                </small>

                                                <div className="field">
                                                    <label htmlFor="currentPassword">Contraseña actual *</label>
                                                    <Password
                                                        id="currentPassword"
                                                        value={currentPassword}
                                                        onChange={(e) => setCurrentPassword(e.target.value)}
                                                        toggleMask
                                                        feedback={false}
                                                        className="w-full"
                                                        inputClassName="w-full"
                                                    />
                                                </div>

                                                <div className="field">
                                                    <label htmlFor="newPassword">Nueva contraseña *</label>
                                                    <Password
                                                        id="newPassword"
                                                        value={newPassword}
                                                        onChange={(e) => {
                                                            const nextValue = e.target.value;
                                                            if (nextValue.length <= PASSWORD_MAX_LENGTH) {
                                                                setNewPassword(nextValue);
                                                            }
                                                        }}
                                                        toggleMask
                                                        className="w-full"
                                                        inputClassName="w-full"
                                                    />
                                                </div>

                                                <div className="field">
                                                    <label htmlFor="confirmPassword">Confirmar nueva contraseña *</label>
                                                    <Password
                                                        id="confirmPassword"
                                                        value={confirmPassword}
                                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                                        toggleMask
                                                        feedback={false}
                                                        className="w-full"
                                                        inputClassName="w-full"
                                                    />
                                                </div>

                                                <div className="flex justify-content-end gap-2">
                                                    <Button
                                                        label="Cancelar"
                                                        icon="pi pi-times"
                                                        outlined
                                                        onClick={() => {
                                                            setShowPasswordSection(false);
                                                            setCurrentPassword('');
                                                            setNewPassword('');
                                                            setConfirmPassword('');
                                                        }}
                                                    />
                                                    <Button
                                                        label="Cambiar contraseña"
                                                        icon="pi pi-lock"
                                                        loading={changingPassword}
                                                        disabled={!hasPasswordInput}
                                                        onClick={handleChangePassword}
                                                    />
                                                </div>
                                            </>
                                        ) : (
                                            // Usuario SIN contraseña - Mostrar formulario de configuración
                                            <>
                                                <div className="mb-3 p-3 border-round" style={{ backgroundColor: 'var(--surface-100)' }}>
                                                    <div className="flex align-items-center gap-2 mb-2">
                                                        <i className="pi pi-info-circle text-primary"></i>
                                                        <strong>Configura una contraseña</strong>
                                                    </div>
                                                    <small className="text-color-secondary">
                                                        Actualmente accedes con Google. Configura una contraseña para poder
                                                        iniciar sesión también con tu email y contraseña.
                                                    </small>
                                                </div>

                                                <div className="field">
                                                    <label htmlFor="newPassword">Nueva contraseña *</label>
                                                    <Password
                                                        id="newPassword"
                                                        value={newPassword}
                                                        onChange={(e) => {
                                                            const nextValue = e.target.value;
                                                            if (nextValue.length <= PASSWORD_MAX_LENGTH) {
                                                                setNewPassword(nextValue);
                                                            }
                                                        }}
                                                        toggleMask
                                                        className="w-full"
                                                        inputClassName="w-full"
                                                        placeholder="Mínimo 6 caracteres"
                                                    />
                                                </div>

                                                <div className="field">
                                                    <label htmlFor="confirmPassword">Confirmar contraseña *</label>
                                                    <Password
                                                        id="confirmPassword"
                                                        value={confirmPassword}
                                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                                        toggleMask
                                                        feedback={false}
                                                        className="w-full"
                                                        inputClassName="w-full"
                                                        placeholder="Repite la contraseña"
                                                    />
                                                </div>

                                                <div className="flex justify-content-end gap-2">
                                                    <Button
                                                        label="Cancelar"
                                                        icon="pi pi-times"
                                                        outlined
                                                        onClick={() => {
                                                            setShowPasswordSection(false);
                                                            setNewPassword('');
                                                            setConfirmPassword('');
                                                        }}
                                                    />
                                                    <Button
                                                        label="Establecer contraseña"
                                                        icon="pi pi-lock"
                                                        loading={changingPassword}
                                                        disabled={!hasPasswordInput}
                                                        onClick={handleChangePassword}
                                                    />
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </Card>
                </div>
            </div>

            <Dialog
                header="Ajusta tu foto"
                visible={cropModalVisible}
                style={{ width: '450px' }}
                onShow={() => {
                    setTimeout(() => setCropperReady(true), 0);
                }}
                onHide={() => {
                    if (!uploadingAvatar) {
                        setCropModalVisible(false);
                        setImageSrc(null);
                        setCropperReady(false);
                    }
                }}
                footer={
                    <div className="flex justify-content-end gap-2">
                        <Button
                            label="Cancelar"
                            icon="pi pi-times"
                            outlined
                            onClick={() => {
                                if (uploadingAvatar) return;
                                setCropModalVisible(false);
                                setImageSrc(null);
                                fileUploadRef.current?.clear();
                            }}
                        />
                        <Button
                            label={uploadingAvatar ? 'Guardando...' : 'Usar foto'}
                            icon="pi pi-check"
                            loading={uploadingAvatar}
                            onClick={async () => {
                                if (!imageSrc || !croppedAreaPixels || !token) return;
                                try {
                                    setUploadingAvatar(true);
                                    const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
                                    const finalFile = new File([croppedBlob], selectedFileName || 'avatar.jpg', {
                                        type: 'image/jpeg',
                                    });

                                    const updated = await uploadAvatar(token, finalFile);
                                    setProfile(updated);

                                    const avatarData = await getMyAvatarUrl(token);
                                    if (avatarData.url) {
                                        const url = avatarData.url.startsWith('http') ? avatarData.url : `${API_BASE}${avatarData.url}`;
                                        setAvatarUrl(url + (url.includes('?') ? '&' : '?') + `t=${Date.now()}`);
                                        window.localStorage.setItem('backend_user', JSON.stringify({ ...(updated as any), avatar_path: updated.avatar_path }));
                                        window.dispatchEvent(
                                            new CustomEvent('avatar-updated', {
                                                detail: { avatarPath: updated.avatar_path, url },
                                            })
                                        );
                                    }

                                    toast.current?.show({
                                        severity: 'success',
                                        summary: 'Avatar actualizado',
                                        detail: 'La foto de perfil se actualizó correctamente',
                                        life: 3000,
                                    });
                                } catch (err: any) {
                                    console.error('Error uploading avatar:', err);
                                    toast.current?.show({
                                        severity: 'error',
                                        summary: 'Error',
                                        detail: err?.message || 'No se pudo subir el avatar',
                                        life: 3000,
                                    });
                                } finally {
                                    setUploadingAvatar(false);
                                    setCropModalVisible(false);
                                    setImageSrc(null);
                                    fileUploadRef.current?.clear();
                                }
                            }}
                        />
                    </div>
                }
            >
                {imageSrc && cropperReady ? (
                    <div style={{ position: 'relative', width: '100%', height: 320 }}>
                        <Cropper
                            image={imageSrc}
                            crop={crop}
                            zoom={zoom}
                            aspect={1}
                            onCropChange={setCrop}
                            onCropComplete={onCropComplete}
                            onZoomChange={setZoom}
                            cropShape="round"
                            showGrid={false}
                        />
                    </div>
                ) : (
                    <div className="flex justify-content-center align-items-center" style={{ height: 320 }}>
                        <ProgressSpinner />
                    </div>
                )}
                <div className="flex align-items-center gap-3 mt-3">
                    <span className="text-sm text-600">Zoom</span>
                    <input
                        type="range"
                        min={1}
                        max={3}
                        step={0.1}
                        value={zoom}
                        onChange={(e) => setZoom(Number(e.target.value))}
                        style={{ flex: 1 }}
                    />
                </div>
            </Dialog>
        </>
    );
}
