# app/services/storage.py
import os
from datetime import timedelta
from pathlib import Path
from typing import IO

from google.cloud import storage
from app.config import settings

# Aseguramos que la lib de Google sepa dónde están las credenciales
if settings.google_application_credentials:
    os.environ.setdefault(
        "GOOGLE_APPLICATION_CREDENTIALS",
        settings.google_application_credentials,
    )

_storage_client = storage.Client()
_bucket = _storage_client.bucket(settings.gcp_bucket_name)


def upload_fileobj(
    file_obj: IO[bytes],
    destination_blob_name: str,
    content_type: str | None = None,
) -> str:
    """
    Sube un archivo desde un file-like object (por ejemplo UploadFile.file).
    Devuelve el blob_name final (string).
    """
    blob = _bucket.blob(destination_blob_name)
    blob.upload_from_file(file_obj, content_type=content_type)
    return blob.name


def upload_local_file(
    path: Path,
    destination_blob_name: str,
    content_type: str | None = None,
) -> str:
    """
    Sube un archivo que ya está en disco local (Path).
    Devuelve el blob_name final.
    """
    blob = _bucket.blob(destination_blob_name)
    blob.upload_from_filename(str(path), content_type=content_type)
    return blob.name


def generate_signed_url(blob_name: str, minutes: int = 60, response_disposition: str = None) -> str:
    """
    Genera una URL firmada temporal para acceder al objeto.
    
    Args:
        blob_name: Nombre del blob en storage
        minutes: Duración en minutos de la URL
        response_disposition: Opcionalmente 'attachment' para forzar descarga (para PDFs, etc.)
    """
    blob = _bucket.blob(blob_name)
    
    if response_disposition == 'attachment':
        # Forzar descarga en lugar de mostrar en el navegador
        url = blob.generate_signed_url(
            expiration=timedelta(minutes=minutes),
            response_disposition='attachment'
        )
    else:
        url = blob.generate_signed_url(expiration=timedelta(minutes=minutes))
    
    return url


def delete_blob(blob_name: str) -> None:
    """
    Elimina un archivo de Google Cloud Storage.
    """
    blob = _bucket.blob(blob_name)
    blob.delete()


def download_blob(blob_name: str) -> bytes:
    """
    Descarga un archivo desde Google Cloud Storage y lo retorna como bytes.
    
    Args:
        blob_name: Nombre del blob en storage
        
    Returns:
        Bytes del archivo
    """
    blob = _bucket.blob(blob_name)
    return blob.download_as_bytes()
