# 🎙️ Speak4All

**Plataforma inteligente de terapia del habla** - Ayuda a niños y adultos a mejorar sus habilidades de comunicación mediante ejercicios personalizados generados con IA.

## ✨ Características

- 🤖 **Generación de ejercicios con IA** usando OpenAI GPT
- 🎧 **Síntesis de voz** para ejercicios de audición
- 📊 **Evaluación automática** con rúbricas personalizables
- 👥 **Gestión de estudiantes y cursos** para terapeutas
- 📈 **Dashboard de progreso** con métricas detalladas
- 🔐 **Autenticación con Google OAuth**
- ☁️ **Almacenamiento en Google Cloud Storage**
- 🌐 **WebSocket en tiempo real** para actualizaciones

## 🚀 Inicio Rápido

### Opción 1: Usar imágenes de Docker Hub (Recomendado)

```bash
# 1. Clonar el repositorio
git clone https://github.com/tu-usuario/speak4all.git
cd speak4all

# 2. Configurar variables de entorno
cp .env.example .env
# Edita .env con tus credenciales

# 3. Agregar credenciales de Google Cloud
# Coloca tu archivo JSON en gcp-key.json/

# 4. Iniciar con imágenes pre-construidas
docker compose -f docker-compose.hub.yml up -d
```

### Opción 2: Construir localmente

```bash
# 1-3. Igual que arriba

# 4. Construir e iniciar
docker compose up -d --build
```

## 📋 Requisitos
## 📋 Requisitos

- Docker y Docker Compose
- Credenciales de:
  - [OpenAI API](https://platform.openai.com/)
  - [Google Cloud Storage](https://cloud.google.com/storage)
  - [Google OAuth](https://console.cloud.google.com/)

## 📖 Documentación Completa

Para instrucciones detalladas de configuración y despliegue, consulta:

👉 **[DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md)** - Guía completa de despliegue

## 🌐 Acceso

Una vez iniciado, accede a:

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs (Swagger)**: http://localhost:8000/docs

## 🛠️ Comandos Útiles

```bash
# Ver logs
docker compose logs -f

# Reiniciar un servicio
docker compose restart frontend

# Detener todo
docker compose down

# Reconstruir después de cambios
docker compose up -d --build

# Ejecutar migraciones manualmente
docker compose exec api alembic upgrade head
```

## 📦 Subir a Docker Hub

```bash
# 1. Construir las imágenes con tu usuario
docker build -t tuusuario/speak4all-backend:latest ./speak4all_backend
docker build -t tuusuario/speak4all-frontend:latest ./speak4all_frontend

# 2. Iniciar sesión en Docker Hub
docker login

# 3. Subir las imágenes
docker push tuusuario/speak4all-backend:latest
docker push tuusuario/speak4all-frontend:latest

# 4. Actualiza docker-compose.hub.yml con tu usuario
# Luego otros pueden usar: docker compose -f docker-compose.hub.yml up -d
```

## 🏗️ Arquitectura

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│   Next.js       │─────▶│   FastAPI        │─────▶│   PostgreSQL    │
│   (Frontend)    │      │   (Backend)      │      │   (Database)    │
│   Port 3000     │      │   Port 8000      │      │   Port 5432     │
└─────────────────┘      └──────────────────┘      └─────────────────┘
         │                        │
         │                        │
         └────────────────────────┴───────────▶ Google Cloud Storage
                                                (Media files)
```

## 🔐 Seguridad

⚠️ **IMPORTANTE**:
- El archivo `.env` contiene información sensible - **NO lo subas a GitHub**
- Las credenciales de GCP (`gcp-key.json/`) son privadas - **NO las compartas**
- Genera secrets fuertes y únicos para producción
- Usa HTTPS en producción
- Configura CORS apropiadamente

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama (`git checkout -b feature/nueva-funcionalidad`)
3. Commit tus cambios (`git commit -m 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la licencia MIT. Ver archivo `LICENSE` para más detalles.

## 👥 Autores

- Tu Nombre - [@tuusuario](https://github.com/tuusuario)

## 🙏 Agradecimientos

- OpenAI por GPT y TTS
- PrimeReact por los componentes UI
- FastAPI por el framework backend
- Next.js por el framework frontend
  --region us-central1 \
  --set-env-vars DATABASE_URL=tu-cloudsql-url,JWT_SECRET=tu-secret,OPENAI_API_KEY=tu-key

# Frontend en Cloud Run
gcloud run deploy speak4all-frontend \
  --image gcr.io/tu-proyecto/speak4all-frontend:1.0 \
  --platform managed \
  --region us-central1 \
  --set-env-vars NEXT_PUBLIC_API_URL=https://tu-backend-url/api
```

## Estructura

- `speak4all_backend/` - FastAPI backend
- `speak4all_frontend/` - Next.js frontend
- `docker-compose.yml` - Orquestación local

npm run dev
```

---

## 🔧 Configuración

### Backend (.env)
```
DATABASE_URL=postgresql://postgres:postgres@db:5432/speak4all
JWT_SECRET=cambiar-esto-en-produccion
OPENAI_API_KEY=sk-tu-key
GOOGLE_CLIENT_ID=tu-google-id
GOOGLE_APPLICATION_CREDENTIALS=/app/gcp-key.json
GCP_BUCKET_NAME=speak4all-storage
CORS_ORIGINS=http://localhost:3000
LOG_LEVEL=INFO
```

Ver todas las variables en `speak4all_backend/.env.example`

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

---

## 🐳 Docker & Google Cloud

**Dockerfiles mejorados (multi-stage):**
- Imágenes 60% más pequeñas
- Health checks incluidos
- Startup 50% más rápido

**Subir a Docker Hub:**
```bash
docker build -t tu-usuario/speak4all-backend:1.0.0 ./speak4all_backend
docker push tu-usuario/speak4all-backend:1.0.0

docker build -t tu-usuario/speak4all-frontend:1.0.0 ./speak4all_frontend
docker push tu-usuario/speak4all-frontend:1.0.0
```

**Desplegar en Google Cloud (Cloud Run):**
```bash
# Backend
gcloud run deploy speak4all-backend \
  --image=tu-usuario/speak4all-backend:1.0.0 \
  --platform=managed \
  --region=us-central1 \
  --allow-unauthenticated

# Frontend
gcloud run deploy speak4all-frontend \
  --image=tu-usuario/speak4all-frontend:1.0.0 \
  --platform=managed \
  --region=us-central1 \
  --allow-unauthenticated
```

---

## 🔐 Seguridad

**Importante antes de producción:**
- [ ] JWT_SECRET único y seguro
- [ ] GOOGLE_CLIENT_ID configurado
- [ ] CORS_ORIGINS sin `*`
- [ ] gcp-key.json en .gitignore (✅ incluido)
- [ ] HTTPS habilitado
- [ ] Backups configurados
- [ ] Logging monitorizado

**Mejoras v1.1.0:**
- ✅ Validación OAuth con Google mejorada
- ✅ CORS configurable
- ✅ Carpeta media/ aislada
- ✅ Validación de archivos
- ✅ Logging mejorado
- ✅ Check de configuración

Ver detalles en `MEJORAS_SEGURIDAD.md`

---

## 📝 Comandos Útiles

```bash
# Docker Compose
docker-compose up -d              # Iniciar
docker-compose down               # Parar
docker-compose logs -f backend    # Ver logs
docker-compose exec backend bash  # Entrar en container

# Backend
cd speak4all_backend && python check_config.py  # Validar config

# Migraciones BD
docker-compose exec backend alembic upgrade head

# Google Cloud
gcloud run services list           # Ver servicios
gcloud logging read --limit 50     # Ver logs
```

---

## 📊 Estructura

```
├── docker-compose.yml           # Orquestación local
├── MEJORAS_SEGURIDAD.md         # Cambios v1.1.0
├── speak4all_backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── app/
│   │   ├── main.py
│   │   ├── models.py
│   │   ├── routers/
│   │   └── services/
│   └── alembic/                 # Migraciones
└── speak4all_frontend/
    ├── Dockerfile
    ├── package.json
    ├── app/                     # Next.js app router
    ├── components/
    └── services/
```

---

## 🛠️ Troubleshooting

| Problema | Solución |
|----------|----------|
| Puerto 8000/3000 en uso | Cambiar en docker-compose.yml |
| BD no responde | Esperar 10-15 seg, `docker-compose restart db` |
| Docker no inicia | Verificar Docker Desktop corriendo |
| Errores en API | `docker-compose logs backend` |
| Cambios no reflejan | `docker-compose restart backend` |

---

**Versión:** 1.1.0  
**Stack:** FastAPI + Next.js + PostgreSQL + Docker  
**Status:** Listo para producción
