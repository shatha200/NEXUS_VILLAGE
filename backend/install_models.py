"""Install only the two needed rain models from Colab's exported model archive."""
from pathlib import Path
import zipfile
import sys

if len(sys.argv) != 2:
    raise SystemExit("Usage: python install_models.py /path/to/nexus24_outputs.zip")
archive = Path(sys.argv[1]); dest=Path(__file__).resolve().parent/'models'
dest.mkdir(exist_ok=True)
with zipfile.ZipFile(archive) as z:
    for name in ('rain_classifier.joblib','rain_amount.joblib'):
        matches=[p for p in z.namelist() if p.split('/')[-1]==name]
        if len(matches)!=1: raise ValueError(f'Expected exactly one {name} in ZIP')
        (dest/name).write_bytes(z.read(matches[0]))
        print('installed', name)
print('Restart backend process to load model artifacts.')
