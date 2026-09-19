"""Archive and real local Git failure tests; no GitHub/network credentials."""
import hashlib
import importlib.util
import json
from pathlib import Path
import stat
import subprocess
import tempfile
import unittest
import zipfile

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("mobile_release", ROOT / "scripts/mobile_release.py")
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)


def run(*command, cwd=None):
    return subprocess.run(command, cwd=cwd, check=True, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE).stdout.strip()


class ReleaseTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.base = Path(self.temporary.name)
        self.repo = self.base / "repo"
        self.repo.mkdir()
        self.archive = self.repo / release.ARCHIVE
        self.staging = self.base / "staging"
        self.files = {name: b"fixture\n" for name in release.REQUIRED}
        for name in release.WORKFLOWS:
            content = (ROOT / name).read_bytes()
            self.files[name] = content
            path = self.repo / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(content)
        self.set_version("0.1.1")
        (self.repo / "package.json").write_text('{"name":"logic-core","version":"0.1.0"}')

    def set_version(self, value):
        self.files["package.json"] = json.dumps({"name": "logic-core", "version": value,
            "scripts": {"test": "node -e 'process.exit(0)'", "typecheck": "tsc --noEmit", "build": "vite build"}}).encode()
        self.files["package-lock.json"] = json.dumps({"name": "logic-core", "version": value,
            "lockfileVersion": 3, "packages": {"": {"name": "logic-core", "version": value}}}).encode()

    def zip(self, extra=()):
        with zipfile.ZipFile(self.archive, "w", zipfile.ZIP_DEFLATED) as target:
            for name, content in self.files.items():
                target.writestr(name, content)
            for name, content in extra:
                target.writestr(name, content)
        return self.archive

    def rejected_without_extract(self):
        before = (self.repo / "package.json").read_bytes()
        with self.assertRaises(release.ReleaseError):
            release.stage(self.archive, self.repo, self.staging)
        self.assertFalse(self.staging.exists())
        self.assertEqual((self.repo / "package.json").read_bytes(), before)
        self.assertTrue(self.archive.exists())

    def git_repository(self):
        run("git", "init", "-b", "main", str(self.repo))
        run("git", "config", "user.name", "Test", cwd=self.repo)
        run("git", "config", "user.email", "test@example.invalid", cwd=self.repo)
        (self.repo / "src").mkdir()
        (self.repo / "src/obsolete.ts").write_text("remove this managed source")
        (self.repo / "NOTICE").write_text("preserve repository metadata")
        (self.repo / ".github/CODEOWNERS").write_text("preserve workflow metadata")
        self.zip()
        run("git", "add", ".", cwd=self.repo)
        run("git", "commit", "-m", "ZIP upload", cwd=self.repo)
        self.origin = self.base / "origin.git"
        run("git", "init", "--bare", str(self.origin))
        run("git", "remote", "add", "origin", str(self.origin), cwd=self.repo)
        run("git", "push", "-u", "origin", "main", cwd=self.repo)
        return run("git", "rev-parse", "HEAD", cwd=self.repo)

    def digest(self):
        return hashlib.sha256(self.archive.read_bytes()).hexdigest()

    def test_valid_snapshot_stages_without_changing_source(self):
        self.zip()
        value, digest = release.stage(self.archive, self.repo, self.staging)
        self.assertEqual(value, "0.1.1")
        self.assertEqual(digest, self.digest())
        self.assertEqual((self.staging / "src/main.tsx").read_bytes(), self.files["src/main.tsx"])
        self.assertEqual(json.loads((self.repo / "package.json").read_text())["version"], "0.1.0")
        release.verify_stage(self.archive, self.repo, self.staging, digest)

    def test_missing_zip(self):
        with self.assertRaises(release.ReleaseError):
            release.stage(self.archive, self.repo, self.staging)

    def test_corrupt_zip(self):
        self.archive.write_bytes(b"not a zip")
        self.rejected_without_extract()

    def test_wrong_root_directory(self):
        self.files = {"logic-core-v0.1.1/" + name: value for name, value in self.files.items()}
        self.zip()
        self.rejected_without_extract()

    def test_every_required_file_is_enforced(self):
        complete = self.files.copy()
        for name in release.REQUIRED:
            with self.subTest(missing=name):
                self.files = {key: value for key, value in complete.items() if key != name}
                self.zip()
                self.rejected_without_extract()

    def test_unsafe_archive_paths(self):
        for name in ("../outside", "src/../../outside", "/absolute", "C:/drive", "src\\evil.ts", "src/./evil.ts", "src//evil.ts"):
            with self.subTest(path=name):
                self.zip([(name, b"bad")])
                self.rejected_without_extract()

    def test_forbidden_payloads(self):
        for name in (".git/config", "src/.git/config", "node_modules/a.js", "dist/index.html", "src/.env.production", "src/private.key", "scripts/__pycache__/test.pyc", ".npmrc"):
            with self.subTest(path=name):
                self.zip([(name, b"bad")])
                self.rejected_without_extract()

    def test_unmanaged_payload(self):
        self.zip([("surprise.txt", b"bad")])
        self.rejected_without_extract()

    def test_symlink_payload(self):
        info = zipfile.ZipInfo("src/link")
        info.create_system = 3
        info.external_attr = (stat.S_IFLNK | 0o777) << 16
        self.zip([(info, b"../../outside")])
        self.rejected_without_extract()

    def test_special_file_payload(self):
        info = zipfile.ZipInfo("src/pipe")
        info.external_attr = (stat.S_IFIFO | 0o644) << 16
        self.zip([(info, b"")])
        self.rejected_without_extract()

    def test_case_collision(self):
        self.zip([("src/Main.tsx", b"collision")])
        self.rejected_without_extract()

    def test_file_directory_collision(self):
        self.zip([("src/main.tsx/child", b"collision")])
        self.rejected_without_extract()

    def test_size_limit(self):
        self.zip([("src/large.txt", b"0" * (release.MAX_FILE + 1))])
        self.rejected_without_extract()

    def test_equal_and_lower_versions(self):
        for value in ("0.1.0", "0.0.9"):
            with self.subTest(version=value):
                self.set_version(value)
                self.zip()
                self.rejected_without_extract()

    def test_shell_like_versions_rejected(self):
        for value in ("0.1.1;echo unsafe", "$(id)", "0.1.1-beta", "01.1.1"):
            with self.subTest(version=value):
                self.set_version(value)
                self.zip()
                self.rejected_without_extract()

    def test_mismatching_lock_rejected(self):
        self.files["package-lock.json"] = b'{"version":"0.1.2"}'
        self.zip()
        self.rejected_without_extract()

    def test_workflows_are_protected(self):
        for name in release.WORKFLOWS:
            with self.subTest(workflow=name):
                original = self.files[name]
                self.files[name] += b"# unauthorized workflow change\n"
                self.zip()
                self.rejected_without_extract()
                self.files[name] = original

    def test_existing_staging_not_destroyed(self):
        self.zip()
        self.staging.mkdir()
        marker = self.staging / "keep"
        marker.write_text("keep")
        with self.assertRaises(release.ReleaseError):
            release.stage(self.archive, self.repo, self.staging)
        self.assertEqual(marker.read_text(), "keep")

    def test_changed_artifact_rejected(self):
        self.zip()
        with self.assertRaises(release.ReleaseError):
            release.stage(self.archive, self.repo, self.staging, "0" * 64)

    def test_changed_staged_source_rejected_after_build(self):
        self.zip()
        release.stage(self.archive, self.repo, self.staging)
        (self.staging / "src/main.tsx").write_text("changed by lifecycle script")
        with self.assertRaises(release.ReleaseError):
            release.verify_stage(self.archive, self.repo, self.staging, self.digest())

    def test_generated_managed_file_rejected_after_build(self):
        self.zip()
        release.stage(self.archive, self.repo, self.staging)
        (self.staging / "src/surprise.ts").write_text("unreviewed")
        with self.assertRaises(release.ReleaseError):
            release.verify_stage(self.archive, self.repo, self.staging, self.digest())

    def test_real_install_commit_push_and_metadata_preservation(self):
        sha = self.git_repository()
        workflows = {name: (self.repo / name).read_bytes() for name in release.WORKFLOWS}
        value, commit = release.install(self.archive, self.repo, self.staging, self.digest(), sha)
        self.assertEqual(value, "0.1.1")
        self.assertFalse(self.archive.exists())
        self.assertFalse((self.repo / "src/obsolete.ts").exists())
        self.assertEqual((self.repo / "NOTICE").read_text(), "preserve repository metadata")
        self.assertEqual((self.repo / ".github/CODEOWNERS").read_text(), "preserve workflow metadata")
        self.assertTrue((self.repo / ".git").is_dir())
        self.assertEqual(run("git", "--git-dir", str(self.origin), "rev-parse", "main"), commit)
        self.assertEqual(run("git", "log", "-1", "--format=%s", cwd=self.repo), "Install Logic Core v0.1.1 mobile release")
        self.assertEqual(run("git", "log", "-1", "--format=%an", cwd=self.repo), "github-actions[bot]")
        for name, content in workflows.items():
            self.assertEqual((self.repo / name).read_bytes(), content)

    def test_push_failure_leaves_remote_source_and_zip_unchanged(self):
        sha = self.git_repository()
        hook = self.origin / "hooks/pre-receive"
        hook.write_text("#!/bin/sh\nexit 1\n")
        hook.chmod(0o755)
        with self.assertRaises(subprocess.CalledProcessError):
            release.install(self.archive, self.repo, self.staging, self.digest(), sha)
        self.assertEqual(run("git", "--git-dir", str(self.origin), "rev-parse", "main"), sha)
        self.assertIn("0.1.0", run("git", "--git-dir", str(self.origin), "show", "main:package.json"))
        self.assertEqual(run("git", "--git-dir", str(self.origin), "ls-tree", "--name-only", "main", release.ARCHIVE), release.ARCHIVE)

    def test_remote_advance_stops_before_install(self):
        sha = self.git_repository()
        other = self.base / "other"
        run("git", "clone", "--branch", "main", str(self.origin), str(other))
        run("git", "-c", "user.name=Other", "-c", "user.email=other@example.invalid", "commit", "--allow-empty", "-m", "Newer work", cwd=other)
        run("git", "push", "origin", "main", cwd=other)
        with self.assertRaises(release.ReleaseError):
            release.install(self.archive, self.repo, self.staging, self.digest(), sha)
        self.assertFalse(self.staging.exists())
        self.assertTrue(self.archive.exists())
        self.assertEqual(run("git", "rev-parse", "HEAD", cwd=self.repo), sha)

    def test_existing_source_symlink_blocks_install(self):
        sha = self.git_repository()
        (self.repo / "src/link").symlink_to(self.base / "outside")
        run("git", "add", "src/link", cwd=self.repo)
        run("git", "commit", "-m", "symlink", cwd=self.repo)
        run("git", "push", "origin", "main", cwd=self.repo)
        sha = run("git", "rev-parse", "HEAD", cwd=self.repo)
        with self.assertRaises(release.ReleaseError):
            release.install(self.archive, self.repo, self.staging, self.digest(), sha)
        self.assertTrue(self.archive.exists())
        self.assertTrue((self.repo / "src/obsolete.ts").exists())

    def test_embedded_controller_matches_auditable_source(self):
        run("python3", "-B", str(ROOT / "scripts/generate-mobile-workflow.py"), "--check")
        workflow = (ROOT / release.WORKFLOWS[1]).read_text()
        embedded = workflow.split("  RELEASE_DRIVER: |\n", 1)[1].split("\njobs:\n", 1)[0].rstrip()
        extracted = "\n".join(line[4:] for line in embedded.splitlines()) + "\n"
        self.assertEqual(extracted, (ROOT / "scripts/mobile_release.py").read_text())
        compile(extracted, "embedded controller", "exec")

    def test_workflow_gate_order_and_permissions(self):
        standard = (ROOT / release.WORKFLOWS[0]).read_text()
        mobile = (ROOT / release.WORKFLOWS[1]).read_text().split("\njobs:\n", 1)[1]
        self.assertNotIn("contents: write", standard)
        self.assertIn("paths-ignore: [logic-core-mobile-release.zip]", standard)
        self.assertIn("test -e logic-core-mobile-release.zip", standard)
        self.assertNotIn("unzip", standard)
        build, rest = mobile.split("\n  install:\n", 1)
        install, deploy = rest.split("\n  deploy:\n", 1)
        self.assertNotIn("contents: write", build + deploy)
        self.assertIn("contents: write", install)
        self.assertNotIn("npm ", install)
        self.assertIn("needs: build", install)
        self.assertIn("needs: [build, install]", deploy)
        self.assertLess(build.index("npm ci"), build.index("npm test"))
        self.assertLess(build.index("npm test"), build.index("npm run build"))
        self.assertLess(build.index("npm run build"), build.index('"$RELEASE_DRIVER" verify'))
        self.assertIn("persist-credentials: false", build)
        self.assertIn("actions/deploy-pages@", deploy)
        self.assertIn("EXPECTED_SHA", deploy)


if __name__ == "__main__":
    unittest.main()
