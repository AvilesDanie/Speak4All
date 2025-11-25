#!/usr/bin/env python3
"""
Script de verificación de configuración para Speak4All Backend
Verifica que todas las variables de entorno necesarias estén configuradas
"""

import os
import sys
from pathlib import Path
from typing import List, Tuple

# Colores para terminal
GREEN = '\033[92m'
YELLOW = '\033[93m'
RED = '\033[91m'
BLUE = '\033[94m'
RESET = '\033[0m'
BOLD = '\033[1m'


def check_env_file() -> bool:
    """Verifica que exista el archivo .env"""
    env_path = Path(__file__).parent / '.env'
    if not env_path.exists():
        print(f"{RED}❌ No se encontró el archivo .env{RESET}")
        print(f"{YELLOW}💡 Copia .env.example a .env y configúralo:{RESET}")
        print(f"   {BLUE}cp .env.example .env{RESET}")
        return False
    print(f"{GREEN}✅ Archivo .env encontrado{RESET}")
    return True


def load_env_vars() -> dict:
    """Carga variables de entorno desde .env"""
    env_path = Path(__file__).parent / '.env'
    env_vars = {}
    
    try:
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    env_vars[key.strip()] = value.strip()
    except Exception as e:
        print(f"{RED}❌ Error leyendo .env: {e}{RESET}")
        return {}
    
    return env_vars


def check_required_vars(env_vars: dict) -> List[Tuple[str, bool, str]]:
    """
    Verifica variables requeridas
    Retorna: [(nombre_var, existe, mensaje)]
    """
    checks = []
    
    # Variables OBLIGATORIAS
    required = {
        'DATABASE_URL': 'URL de conexión a PostgreSQL',
        'JWT_SECRET': 'Secreto para firmar JWT (cámbialo en producción!)',
        'OPENAI_API_KEY': 'API Key de OpenAI para generación de ejercicios',
    }
    
    for var, description in required.items():
        value = env_vars.get(var, '')
        exists = bool(value and value != '')
        
        # Verificaciones específicas
        if var == 'JWT_SECRET' and value == 'change_this_secret':
            checks.append((var, False, f'{description} - ⚠️ Usando valor por defecto'))
        elif var == 'OPENAI_API_KEY' and (not value or value.startswith('sk-your-')):
            checks.append((var, False, f'{description} - ⚠️ API Key inválida'))
        else:
            checks.append((var, exists, description))
    
    return checks


def check_optional_vars(env_vars: dict) -> List[Tuple[str, bool, str]]:
    """Verifica variables opcionales pero recomendadas"""
    checks = []
    
    optional = {
        'GOOGLE_CLIENT_ID': 'Client ID de Google OAuth (RECOMENDADO para seguridad)',
        'CORS_ORIGINS': 'Orígenes permitidos para CORS',
        'MAX_UPLOAD_SIZE_MB': 'Tamaño máximo de archivos (MB)',
        'LOG_LEVEL': 'Nivel de logging (INFO, DEBUG, etc.)',
    }
    
    for var, description in optional.items():
        value = env_vars.get(var, '')
        exists = bool(value and value != '')
        
        # Advertencias especiales
        if var == 'GOOGLE_CLIENT_ID' and (not value or 'your-google-client' in value):
            checks.append((var, False, f'{description} - ⚠️ Usando autenticación legacy'))
        else:
            checks.append((var, exists, description))
    
    return checks


def check_media_directory() -> bool:
    """Verifica que exista la carpeta media"""
    media_path = Path(__file__).parent / 'media'
    if not media_path.exists():
        print(f"{YELLOW}⚠️  Carpeta media/ no existe, creándola...{RESET}")
        try:
            media_path.mkdir(parents=True, exist_ok=True)
            print(f"{GREEN}✅ Carpeta media/ creada{RESET}")
            return True
        except Exception as e:
            print(f"{RED}❌ Error creando carpeta media/: {e}{RESET}")
            return False
    print(f"{GREEN}✅ Carpeta media/ existe{RESET}")
    return True


def print_results(required: List[Tuple[str, bool, str]], 
                 optional: List[Tuple[str, bool, str]]) -> bool:
    """Imprime resultados de verificación"""
    
    print(f"\n{BOLD}{'='*60}{RESET}")
    print(f"{BOLD}📋 VARIABLES OBLIGATORIAS{RESET}")
    print(f"{BOLD}{'='*60}{RESET}\n")
    
    all_required_ok = True
    for var, exists, desc in required:
        status = f"{GREEN}✅" if exists else f"{RED}❌"
        print(f"{status} {var:<25} {RESET}{desc}")
        if not exists:
            all_required_ok = False
    
    print(f"\n{BOLD}{'='*60}{RESET}")
    print(f"{BOLD}🔧 VARIABLES OPCIONALES (Recomendadas){RESET}")
    print(f"{BOLD}{'='*60}{RESET}\n")
    
    for var, exists, desc in optional:
        status = f"{GREEN}✅" if exists else f"{YELLOW}⚠️ "
        print(f"{status} {var:<25} {RESET}{desc}")
    
    return all_required_ok


def print_summary(all_ok: bool):
    """Imprime resumen final"""
    print(f"\n{BOLD}{'='*60}{RESET}")
    
    if all_ok:
        print(f"{GREEN}{BOLD}✅ ¡Configuración correcta!{RESET}")
        print(f"\n{BLUE}Puedes iniciar el backend con:{RESET}")
        print(f"   {BOLD}uvicorn app.main:app --reload{RESET}")
        print(f"   {BOLD}o con Docker:{RESET}")
        print(f"   {BOLD}docker compose up --build{RESET}\n")
    else:
        print(f"{RED}{BOLD}❌ Configuración incompleta{RESET}")
        print(f"\n{YELLOW}Acciones requeridas:{RESET}")
        print(f"  1. Edita el archivo .env")
        print(f"  2. Completa las variables marcadas con ❌")
        print(f"  3. Ejecuta este script nuevamente\n")
        
        print(f"{BLUE}Documentación:{RESET}")
        print(f"  - Ver: {BOLD}MEJORAS_SEGURIDAD.md{RESET}")
        print(f"  - Ejemplo: {BOLD}.env.example{RESET}\n")
    
    print(f"{BOLD}{'='*60}{RESET}\n")


def main():
    print(f"\n{BOLD}{BLUE}🔍 Verificador de Configuración - Speak4All Backend{RESET}\n")
    
    # 1. Verificar archivo .env
    if not check_env_file():
        sys.exit(1)
    
    # 2. Cargar variables
    print(f"{BLUE}📖 Cargando variables de entorno...{RESET}")
    env_vars = load_env_vars()
    
    if not env_vars:
        print(f"{RED}❌ No se pudieron cargar variables{RESET}")
        sys.exit(1)
    
    print(f"{GREEN}✅ {len(env_vars)} variables cargadas{RESET}\n")
    
    # 3. Verificar carpeta media
    check_media_directory()
    
    # 4. Verificar variables
    required = check_required_vars(env_vars)
    optional = check_optional_vars(env_vars)
    
    # 5. Mostrar resultados
    all_ok = print_results(required, optional)
    
    # 6. Resumen
    print_summary(all_ok)
    
    # 7. Exit code
    sys.exit(0 if all_ok else 1)


if __name__ == '__main__':
    main()
