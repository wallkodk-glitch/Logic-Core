"""Trusted mobile-release controller. Python standard library only.

Embedded verbatim in the protected workflow so the first v0.1 upgrade works.
Never execute this file from the uploaded archive with a write-enabled token.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys
import zipfile

ARCHIVE = "logic-core-mobile-release.zip"
DIRECTORIES = ("src", "public", "scripts", "tests", "docs")
ROOT_FILES = (".gitignore", "README.md", "index.html", "package.json",
              "package-lock.json", "tsconfig.json", "vite.config.ts", "LICENSE")
WORKFLOWS = (".github/workflows/deploy.yml", ".github/workflows/mobile-release.yml")
REQUIRED = set(ROOT_FILES) - {"LICENSE"} | set(WORKFLOWS) | {
    "src/main.tsx", "src/config.ts", "public/manifest.webmanifest",
    "scripts/build-pwa.mjs", "scripts/verify-build.mjs", "scripts/config.mjs",
    "scripts/mobile_release.py", "tests/storage.test.ts", "tests/test_release.py",
}
FORBIDDEN = {".git", "node_modules", "dist", "__pycache__", ".cache",
             ".npmrc", ".env", ".ds_store", "test-results", ".venv"}
MAX_ARCHIVE = 10 * 1024 * 1024
MAX_FILE = 5 * 1024 * 1024
MAX_TOTAL = 30 * 1024 * 1024


class ReleaseError(Exception):
    pass


def require(condition, message):
    if not condition:
        raise ReleaseError(message)


def managed(name):
    return name in ROOT_FILES or name.split("/")[0] in DIRECTORIES


def version(value):
    require(isinstance(value, str) and re.fullmatch(r"(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)", value),
            "Version must be a stable major.minor.patch number.")
    return tuple(int(part) for part in value.split("."))


def document(raw, label):
    try:
        value = json.loads(raw)
    except (ValueError, UnicodeError) as error:
        raise ReleaseError(f"Invalid {label}: {error}") from error
    require(isinstance(value, dict), f"{label} must be an object.")
    return value


def inspect_archive(archive, repository, expected_digest=None):
    archive, repository = Path(archive), Path(repository)
    require(archive.is_file() and not archive.is_symlink(), "Release ZIP is missing or is a symlink.")
    require(archive.stat().st_size <= MAX_ARCHIVE, "ZIP exceeds 10 MiB.")
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    require(expected_digest is None or digest == expected_digest, "ZIP differs from the tested artifact.")
    files, entries, folded, total = {}, set(), set(), 0
    try:
        with zipfile.ZipFile(archive) as source:
            require(0 < len(source.infolist()) <= 1000, "ZIP must contain 1–1000 entries.")
            for info in source.infolist():
                name = info.filename.rstrip("/")
                parts = name.split("/")
                require(info.orig_filename == info.filename and name and
                        all(re.fullmatch(r"[A-Za-z0-9_.-]+", part) and part not in (".", "..") for part in parts),
                        "Unsafe archive path (absolute, traversal, backslash, or unsupported characters).")
                require(not any(part.lower() in FORBIDDEN or part.lower().startswith(".env") or
                                part.lower().endswith((".pem", ".key", ".local", ".tsbuildinfo")) for part in parts),
                        f"Forbidden payload: {name}")
                require(name not in entries and name.lower() not in folded, f"Duplicate/case-colliding path: {name}")
                entries.add(name)
                folded.add(name.lower())
                mode = stat.S_IFMT(info.external_attr >> 16)
                require(mode in (0, stat.S_IFDIR if info.is_dir() else stat.S_IFREG), f"Symlink/special file: {name}")
                require(not info.flag_bits & 1 and info.compress_type in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED),
                        "Encrypted or unsupported ZIP compression.")
                if info.is_dir():
                    require(parts[0] in DIRECTORIES or name in (".github", ".github/workflows"), f"Unexpected directory: {name}")
                    continue
                require(managed(name) or name in WORKFLOWS, f"Unexpected repository root/file: {name}")
                total += info.file_size
                require(info.file_size <= MAX_FILE and total <= MAX_TOTAL, "ZIP expanded size exceeds limits.")
                files[name] = source.read(info)  # Also checks CRC before any extraction.
    except (zipfile.BadZipFile, RuntimeError, OSError, NotImplementedError) as error:
        raise ReleaseError(f"Cannot read release ZIP: {error}") from error
    require(REQUIRED <= files.keys(), f"Incomplete root snapshot; missing: {', '.join(sorted(REQUIRED - files.keys()))}")
    for name in entries:
        require(not any("/".join(name.split("/")[:i]) in files for i in range(1, len(name.split("/")))),
                f"File/directory collision: {name}")
    for name in WORKFLOWS:
        installed = repository / name
        require(installed.is_file() and not installed.is_symlink() and installed.read_bytes() == files[name],
                f"Protected workflow differs: {name}. Install the exact supplied workflow manually first.")
    package = document(files["package.json"], "package.json")
    lock = document(files["package-lock.json"], "package-lock.json")
    current = document((repository / "package.json").read_bytes(), "installed package.json")
    release_version = package.get("version")
    require(package.get("name") == "logic-core", "Unexpected package name.")
    require(version(release_version) > version(current.get("version")), "Release version must be HIGHER than the installed version; equal/downgrade rejected.")
    lock_root = lock.get("packages", {}).get("") if isinstance(lock.get("packages"), dict) else None
    require(lock.get("version") == release_version and isinstance(lock_root, dict) and lock_root.get("version") == release_version and
            lock.get("name") == "logic-core" and lock_root.get("name") == "logic-core", "Package/lock name or version mismatch.")
    require(isinstance(package.get("scripts"), dict) and all(package["scripts"].get(key) for key in ("test", "typecheck", "build")), "Required npm scripts missing.")
    return files, release_version, digest


def stage(archive, repository, destination, expected_digest=None):
    files, release_version, digest = inspect_archive(archive, repository, expected_digest)
    destination = Path(destination).absolute()
    require(not destination.exists(), "Staging directory must not already exist.")
    require(not destination.is_relative_to(Path(repository).resolve()), "Staging must be outside the checkout.")
    destination.mkdir(parents=True)
    for name, content in files.items():
        target = destination / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)
    return release_version, digest


def source_files(root):
    root = Path(root)
    result = set()
    for name in ROOT_FILES + DIRECTORIES + (".github",):
        path = root / name
        require(not path.is_symlink(), f"Managed path is a symlink: {name}")
        if not path.exists():
            continue
        paths = [path] if path.is_file() else path.rglob("*")
        for item in paths:
            require(not item.is_symlink(), f"Symlink in source: {item}")
            if item.is_file():
                relative = item.relative_to(root).as_posix()
                if managed(relative) or relative in WORKFLOWS:
                    result.add(relative)
    return result


def verify_stage(archive, repository, destination, expected_digest):
    files, release_version, digest = inspect_archive(archive, repository, expected_digest)
    destination = Path(destination)
    require(source_files(destination) == files.keys(), "Build changed the staged source file list.")
    for name, content in files.items():
        require((destination / name).read_bytes() == content, f"Build changed staged source: {name}")
    return release_version, digest


def git(repository, *arguments):
    result = subprocess.run(["git", "-C", str(repository), *arguments], check=True, text=True, stdout=subprocess.PIPE)
    return result.stdout.strip()


def assert_current(repository, expected_sha):
    require(re.fullmatch(r"[0-9a-f]{40}", expected_sha), "Invalid expected commit SHA.")
    require(git(repository, "rev-parse", "HEAD") == expected_sha, "Checkout is not the uploaded commit.")
    remote = git(repository, "ls-remote", "--exit-code", "origin", "refs/heads/main").split()[0]
    require(remote == expected_sha, "main changed after upload. Nothing installed; retry against current main.")
    require(not git(repository, "status", "--porcelain"), "Checkout is not clean.")


def install(archive, repository, destination, expected_digest, expected_sha):
    repository = Path(repository)
    assert_current(repository, expected_sha)
    stage(archive, repository, destination, expected_digest)
    files, release_version, _ = inspect_archive(archive, repository, expected_digest)
    # Preflight all paths before syncing. .git/.github and unrelated metadata are never removed.
    previous = source_files(repository)
    for name in sorted(previous - files.keys()):
        if managed(name):
            (repository / name).unlink()
    for name, content in files.items():
        if managed(name):
            target = repository / name
            target.parent.mkdir(parents=True, exist_ok=True)
            require(not target.is_symlink(), f"Refusing symlink target: {name}")
            target.write_bytes(content)
    (repository / ARCHIVE).unlink()
    paths = sorted({name for name in previous | files.keys() if managed(name)} | {ARCHIVE})
    git(repository, "add", "--", *paths)
    changed = git(repository, "diff", "--cached", "--name-only").splitlines()
    require(changed and all(managed(name) or name == ARCHIVE for name in changed), "Commit would modify protected/unmanaged files.")
    git(repository, "-c", "user.name=github-actions[bot]", "-c", "user.email=41898282+github-actions[bot]@users.noreply.github.com",
        "commit", "-m", f"Install Logic Core v{release_version} mobile release")
    # No force push; a concurrent source commit is a failure, never silently overwritten.
    git(repository, "push", "origin", "HEAD:refs/heads/main")
    return release_version, git(repository, "rev-parse", "HEAD")


def output(values):
    for key, value in values.items():
        print(f"{key}={value}")
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as target:
            for key, value in values.items():
                target.write(f"{key}={value}\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("stage", "verify", "install"))
    parser.add_argument("--archive", required=True)
    parser.add_argument("--repository", required=True)
    parser.add_argument("--staging", required=True)
    parser.add_argument("--digest")
    parser.add_argument("--sha")
    args = parser.parse_args()
    try:
        if args.command == "stage":
            release_version, digest = stage(args.archive, args.repository, args.staging, args.digest)
            output({"version": release_version, "digest": digest})
        elif args.command == "verify":
            require(args.digest, "Expected digest required.")
            verify_stage(args.archive, args.repository, args.staging, args.digest)
            print("Staged source and archive unchanged after build.")
        else:
            require(args.digest and args.sha, "Tested digest and upload SHA required.")
            release_version, commit = install(args.archive, args.repository, args.staging, args.digest, args.sha)
            output({"version": release_version, "commit": commit})
    except (ReleaseError, OSError, subprocess.CalledProcessError) as error:
        print(f"Release stopped: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
