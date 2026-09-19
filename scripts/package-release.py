"""Create the single mobile upload. Run in the build environment, never on iPhone."""
import argparse
import hashlib
from pathlib import Path
import subprocess
import tempfile
import zipfile

from mobile_release import WORKFLOWS, inspect_archive, source_files

root = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--output", required=True, help="Output directory outside the source checkout")
args = parser.parse_args()
output = Path(args.output).resolve()
if output.is_relative_to(root):
    raise SystemExit("Place release artifacts outside the source checkout.")
subprocess.run(["python3", "-B", str(root / "scripts/generate-mobile-workflow.py"), "--check"], check=True)
output.mkdir(parents=True, exist_ok=True)
archive = output / "logic-core-mobile-release.zip"
names = sorted(source_files(root))
with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as target:
    for name in names:
        info = zipfile.ZipInfo(name, (2026, 1, 1, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o100644 << 16
        target.writestr(info, (root / name).read_bytes())
# Reuse the actual installer validator; emulate an older installed version only
# for package structure validation. A real install always checks real main.
with tempfile.TemporaryDirectory() as temporary:
    baseline = Path(temporary)
    (baseline / "package.json").write_text('{"name":"logic-core","version":"0.0.0"}')
    for name in WORKFLOWS:
        target = baseline / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes((root / name).read_bytes())
    _, release_version, digest = inspect_archive(archive, baseline)
for name in WORKFLOWS:
    (output / Path(name).name).write_bytes((root / name).read_bytes())
(output / "SHA256SUMS.txt").write_text("".join(
    f"{hashlib.sha256((output / name).read_bytes()).hexdigest()}  {name}\n"
    for name in (archive.name, "mobile-release.yml", "deploy.yml")))
print(f"Packaged Logic Core {release_version}: {len(names)} files, {archive.stat().st_size} bytes")
print(f"SHA-256 {digest}")
print(archive)
