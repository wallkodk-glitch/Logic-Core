"""Keep the one-time bootstrap controller identical to the auditable source."""
from pathlib import Path
import sys

root = Path(__file__).resolve().parent.parent
template = (root / "scripts/mobile-workflow.template.yml").read_text()
driver = (root / "scripts/mobile_release.py").read_text()
generated = template.replace("__RELEASE_DRIVER__", "\n".join("    " + line if line else "" for line in driver.splitlines()))
target = root / ".github/workflows/mobile-release.yml"
if "--check" in sys.argv:
    if not target.exists() or target.read_text() != generated:
        raise SystemExit("mobile-release.yml differs from its template/controller; regenerate it.")
    print("Mobile workflow and trusted controller match.")
else:
    target.write_text(generated)
    print(target)
