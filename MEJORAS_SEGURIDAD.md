# 🔒 Mejoras de Seguridad y Configuración - Speak4All

## Resumen de Mejoras Implementadas

Este documento detalla las mejoras de seguridad, configuración y logging implementadas en el backend de Speak4All.

---

## 1. ✅ Validación de Google ID Token

### **Antes**
El frontend enviaba directamente `google_sub`, `email` y `full_name` sin verificación.

```python
# Método inseguro
{
    "google_sub": "123456789",
    "email": "user@example.com",
    "full_name": "Usuario Falso",
    "role": "THERAPIST"
}
```

### **Después**
El sistema ahora valida el `id_token` de Google directamente con la API de Google.

```python
# Método seguro (recomendado)
{
    "id_token": "eyJhbGciOiJSUzI1NiIsImtpZCI...",
    "role": "THERAPIST"
}

# Método legacy (solo si GOOGLE_CLIENT_ID no está configurado)
{
    "google_sub": "123456789",
    "email": "user@example.com",
    "full_name": "Usuario",
    "role": "THERAPIST"
}
```

### **Configuración requerida**
```bash
# .env
GOOGLE_CLIENT_ID=tu-client-id.apps.googleusercontent.com
```

### **Archivos modificados**
- `app/routers/auth.py`: Función `verify_google_token()`
- `app/schemas.py`: `GoogleLoginRequest` actualizado
- `app/config.py`: Nuevo campo `google_client_id`

---

## 2. ✅ CORS Configurable

### **Antes**
CORS hardcoded en el código:
```python
origins = ["http://localhost:3000"]
```

### **Después**
CORS desde variables de entorno:
```python
# .env
CORS_ORIGINS=http://localhost:3000,https://speak4all.com,https://app.speak4all.com
```

### **Beneficios**
- ✅ Fácil configuración para desarrollo/producción
- ✅ Soporte múltiples dominios
- ✅ No requiere cambiar código para diferentes entornos

### **Archivos modificados**
- `app/main.py`: CORS desde `settings.cors_origins`
- `app/config.py`: Nuevo campo `cors_origins`

---

## 3. ✅ Archivos Estáticos Restringidos

### **Antes**
```python
# ⚠️ PELIGRO: Expone todo el directorio del proyecto
app.mount("/media", StaticFiles(directory=Path.cwd()))
```

### **Después**
```python
# ✅ SEGURO: Solo expone carpeta media/
MEDIA_DIR = Path.cwd() / "media"
app.mount("/media", StaticFiles(directory=MEDIA_DIR))
```

### **Estructura recomendada**
```
proyecto/
├── media/                    # ✅ Público
│   ├── submissions/
│   └── tts_build_*/
├── app/                      # ❌ No expuesto
├── alembic/                  # ❌ No expuesto
└── .env                      # ❌ No expuesto
```

### **Archivos modificados**
- `app/main.py`: `MEDIA_DIR = Path.cwd() / "media"`

---

## 4. ✅ Validación de Archivos Subidos

### **Implementación**
```python
def validate_audio_file(file: UploadFile) -> None:
    # Validar tipo MIME
    allowed = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/webm", "audio/ogg"]
    if file.content_type not in allowed:
        raise HTTPException(400, "Tipo de archivo no permitido")
    
    # Validar tamaño (10MB por defecto)
    max_size = 10 * 1024 * 1024
    if file_size > max_size:
        raise HTTPException(413, "Archivo muy grande")
```

### **Configuración**
```bash
# .env
MAX_UPLOAD_SIZE_MB=10
ALLOWED_AUDIO_TYPES=audio/mpeg,audio/mp3,audio/wav,audio/webm,audio/ogg
```

### **Beneficios**
- ✅ Previene subida de archivos maliciosos
- ✅ Evita saturación del servidor
- ✅ Configurable por entorno

### **Archivos modificados**
- `app/routers/submissions.py`: Función `validate_audio_file()`
- `app/config.py`: Campos `max_upload_size_mb`, `allowed_audio_types`

---

## 5. ✅ Logging Mejorado

### **Implementación**

#### Configuración global
```python
# app/main.py
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper()),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
```

#### Logs en módulos clave
```python
# Ejemplo: app/routers/auth.py
logger.info(f"Nuevo usuario creado: {email} (rol: {role})")
logger.warning("Usando método legacy de autenticación")
logger.error(f"Error verificando token: {e}")
```

### **Configuración**
```bash
# .env
LOG_LEVEL=INFO  # DEBUG, INFO, WARNING, ERROR, CRITICAL
```

### **Logs agregados en**
- ✅ Autenticación (login, creación de usuarios)
- ✅ Creación de cursos
- ✅ Generación de ejercicios con IA
- ✅ Generación de audio
- ✅ Subida de archivos
- ✅ Errores de validación

### **Archivos modificados**
- `app/main.py`: Configuración de logging
- `app/routers/auth.py`: Logs de autenticación
- `app/routers/courses.py`: Logs de cursos
- `app/routers/submissions.py`: Logs de entregas
- `app/services/ai_exercises.py`: Logs de generación IA

---

## 6. ✅ Configuración Centralizada

### **Nuevas variables en `app/config.py`**

```python
class Settings(BaseSettings):
    # === OAuth ===
    google_client_id: str | None = None
    
    # === CORS ===
    cors_origins: str = "http://localhost:3000"
    
    # === Límites ===
    max_upload_size_mb: int = 10
    allowed_audio_types: str = "audio/mpeg,audio/mp3,audio/wav,..."
    
    # === Logging ===
    log_level: str = "INFO"
```

---

## 📋 Checklist de Migración

### Para Desarrollo
```bash
# 1. Actualizar .env con nuevas variables
cp speak4all_backend/.env.example speak4all_backend/.env

# 2. Configurar GOOGLE_CLIENT_ID (opcional pero recomendado)
GOOGLE_CLIENT_ID=tu-client-id.apps.googleusercontent.com

# 3. Verificar CORS
CORS_ORIGINS=http://localhost:3000

# 4. Reiniciar backend
docker compose restart backend
```

### Para Producción
```bash
# 1. OBLIGATORIO: Cambiar JWT_SECRET
JWT_SECRET=$(openssl rand -hex 32)

# 2. OBLIGATORIO: Configurar GOOGLE_CLIENT_ID
GOOGLE_CLIENT_ID=production-client-id.apps.googleusercontent.com

# 3. OBLIGATORIO: Actualizar CORS
CORS_ORIGINS=https://speak4all.com,https://app.speak4all.com

# 4. Ajustar límites según necesidad
MAX_UPLOAD_SIZE_MB=20

# 5. Nivel de logging apropiado
LOG_LEVEL=WARNING
```

---

## 🔐 Recomendaciones Adicionales

### Inmediatas
1. ✅ **Implementadas**: Todas las mejoras de este documento
2. ⚠️ **Pendiente**: Implementar rate limiting (ej: SlowAPI)
3. ⚠️ **Pendiente**: HTTPS en producción (nginx/traefik reverse proxy)
4. ⚠️ **Pendiente**: Sanitización de inputs (prevenir SQL injection adicional)

### Mediano Plazo
1. Agregar tests automatizados
2. Implementar refresh tokens
3. Auditoría de seguridad completa
4. Backup automático de base de datos
5. Monitoreo con Sentry/Datadog

### Largo Plazo
1. Migrar a autenticación con roles más granulares
2. Implementar 2FA (Two-Factor Authentication)
3. Encriptación de datos sensibles en BD
4. Cumplimiento GDPR/HIPAA si aplica

---

## 📊 Comparación Antes/Después

| Aspecto | Antes | Después |
|---------|-------|---------|
| **Validación OAuth** | ❌ Solo frontend | ✅ Backend + Google API |
| **CORS** | 🟡 Hardcoded | ✅ Variable de entorno |
| **Archivos estáticos** | ❌ Todo el proyecto | ✅ Solo carpeta media |
| **Validación uploads** | ❌ Sin validar | ✅ Tipo y tamaño |
| **Logging** | 🟡 Básico | ✅ Completo y configurable |
| **Configuración** | 🟡 Parcial | ✅ Centralizada |

---

## 🚀 Próximos Pasos

1. **Frontend**: Actualizar para enviar `id_token` en lugar de `google_sub`
2. **Testing**: Crear suite de tests de seguridad
3. **Documentación**: Actualizar Swagger/OpenAPI
4. **Monitoreo**: Implementar alertas de seguridad

---

## 📞 Soporte

Para dudas sobre estas mejoras:
- Revisar código en `app/routers/auth.py`
- Consultar `.env.example` actualizado
- Verificar logs con `LOG_LEVEL=DEBUG`

**Fecha de implementación**: 25 de noviembre de 2025
**Versión**: 1.1.0
