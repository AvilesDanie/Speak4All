"""Utilities to store and retrieve files from the local media folder."""

from pathlib import Path
from typing import IO
import shutil

MEDIA_ROOT = Path.cwd() / "media"
MEDIA_ROOT.mkdir(parents=True, exist_ok=True)


def _safe_path(relative_path: str) -> Path:
    normalized = relative_path.replace("\\", "/").lstrip("/")
    target = (MEDIA_ROOT / normalized).resolve()
    if not str(target).startswith(str(MEDIA_ROOT.resolve())):
        raise ValueError("Invalid media path")
    return target


def _ensure_parent(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def upload_fileobj(
    file_obj: IO[bytes],
    destination_blob_name: str,
    content_type: str | None = None,
) -> str:
    """
    Guarda un archivo desde un file-like object en la carpeta media.
    Devuelve el path relativo final (string).
    """
    target = _safe_path(destination_blob_name)
    _ensure_parent(target)
    with target.open("wb") as out_file:
        shutil.copyfileobj(file_obj, out_file)
    return destination_blob_name


def upload_local_file(
    path: Path,
    destination_blob_name: str,
    content_type: str | None = None,
) -> str:
    """
    Copia un archivo local ya existente a la carpeta media.
    Devuelve el path relativo final.
    """
    target = _safe_path(destination_blob_name)
    _ensure_parent(target)
    shutil.copyfile(path, target)
    return destination_blob_name


def generate_signed_url(
    blob_name: str,
    minutes: int = 60,
    response_disposition: str | None = None,
) -> str:
    """
    Para storage local no se firman URLs. Se devuelve una ruta publica a /media.
    """
    normalized = blob_name.replace("\\", "/").lstrip("/")
    return f"/media/{normalized}"


def delete_blob(blob_name: str) -> None:
    """
    Elimina un archivo de la carpeta media si existe.
    """
    target = _safe_path(blob_name)
    if target.exists():
        target.unlink()


def download_blob(blob_name: str) -> bytes:
    """
    Lee un archivo desde la carpeta media y lo retorna como bytes.
    """
    target = _safe_path(blob_name)
    return target.read_bytes()
