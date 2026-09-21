"""Copia las fuentes recuperadas a un workspace sin sobrescribir cambios locales."""
from pathlib import Path
import hashlib
import shutil
import sys


def sync(source, destination):
    source, destination = Path(source).resolve(), Path(destination).resolve()
    if destination == source or source in destination.parents:
        raise ValueError('El workspace no puede estar dentro de las fuentes.')
    files = [p for p in source.rglob('*') if p.is_file() and '__pycache__' not in p.parts]
    conflicts = []
    for p in files:
        target = destination / 'src' / p.relative_to(source)
        if target.exists() and (not target.is_file() or hashlib.sha256(p.read_bytes()).digest() != hashlib.sha256(target.read_bytes()).digest()):
            conflicts.append(str(target))
        if target.is_symlink():
            conflicts.append(str(target))
        # Un enlace simbólico en la ruta podría desviar la copia fuera del workspace.
        cursor = target.parent
        while cursor != destination.parent:
            if cursor.is_symlink():
                conflicts.append(str(cursor))
            if cursor == destination:
                break
            cursor = cursor.parent
    if conflicts:
        raise ValueError('El workspace tiene archivos distintos de las fuentes; se conservan. Use otro --ws:\n'+'\n'.join(sorted(set(conflicts))))
    for p in files:
        target = destination / 'src' / p.relative_to(source)
        if not target.exists():
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(p, target)
    for p in (destination/'src/so_arm_100_hardware/scripts').glob('*.py'):
        p.chmod(p.stat().st_mode | 0o111)
    return len(files)


if __name__ == '__main__':
    print(f'{sync(sys.argv[1], sys.argv[2])} archivos fuente preparados.')
