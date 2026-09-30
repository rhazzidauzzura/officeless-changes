#!/usr/bin/env python3
"""
officeless_sync.py — convert Officeless Studio API/MCP responses into a
diff-friendly Git tree, and rebuild payloads from that tree.

Commands
  explode  <kind> <raw.json> --project <slug>   raw response -> files in repo
  assemble workflow <dir>                        files -> payload for studio_update_workflow
  assemble custom_element <dir>                  files -> payload for studio_update_custom_element
  check                                          validate JSON, JS syntax, secrets

kind = workflow | workflows | form | tables | page | custom_layout | custom_element
"""
import argparse, json, os, re, shutil, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PROJECTS = ROOT / "projects"

# Fields that change on every save / are environment specific -> never committed.
VOLATILE = {
    "updated_at", "updated_by", "edited_by", "last_count_timestamp",
    "environment_variable_global", "environment_variable_project",
}
# Keys whose values must never land in Git.
SECRET_KEY_RE = re.compile(r"(secret|password|passwd|token|api[_-]?key|private[_-]?key|client[_-]?secret)", re.I)
SECRET_VALUE_RE = re.compile(
    r"(eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}"   # JWT
    r"|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}"                # GitHub tokens
    r"|AKIA[0-9A-Z]{16}"                                                 # AWS key
    r"|-----BEGIN [A-Z ]*PRIVATE KEY-----)")


def slug(s: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "-", str(s)).strip("-").lower()
    return s[:60] or "unnamed"


def strip_volatile(o):
    if isinstance(o, dict):
        return {k: strip_volatile(v) for k, v in sorted(o.items()) if k not in VOLATILE}
    if isinstance(o, list):
        return [strip_volatile(x) for x in o]
    return o


def dump(path: Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False, sort_keys=True) + "\n", encoding="utf-8")


def write_text(path: Path, text: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text if text.endswith("\n") else text + "\n", encoding="utf-8")


def load_raw(p):
    d = json.loads(Path(p).read_text(encoding="utf-8"))
    return d


# ---------------------------------------------------------------- explode
def explode_workflow(wf: dict, proj: Path):
    """Workflow JSON with every javascript block extracted to its own .js file."""
    wf = strip_volatile(wf)
    d = proj / "workflows" / f"{slug(wf['name'])}__{wf['id']}"
    if d.exists():
        shutil.rmtree(d)
    actions = wf.get("actions") or []

    def walk(acts, prefix):
        for i, a in enumerate(acts or [], 1):
            tag = f"{prefix}{i:02d}"
            js = a.get("javascript")
            if js:
                fn = f"{tag}-{slug(a.get('block_name') or a.get('type'))}.js"
                write_text(d / fn, js)
                a["javascript"] = f"@file:{fn}"
            cond = a.get("conditional") or {}
            walk(cond.get("action_true"), f"{tag}t")
            walk(cond.get("action_false"), f"{tag}f")
            wh = a.get("while") or {}
            walk(wh.get("action_while"), f"{tag}w")
            walk(wh.get("action_done"), f"{tag}d")

    walk(actions, "")
    dump(d / "workflow.json", wf)
    return d


def explode_form(resp: dict, proj: Path):
    form = strip_volatile(resp.get("form", resp))
    dump(proj / "forms" / f"{slug(form['name'])}__{form['id']}.json", form)


def explode_tables(resp: dict, proj: Path):
    tdir = proj / "tables"
    if tdir.exists():
        shutil.rmtree(tdir)
    for t in resp.get("data", resp):
        dump(tdir / f"{slug(t['name'])}__{t['id']}.json", strip_volatile(t))


def explode_page(resp: dict, proj: Path):
    for p in resp.get("pages", [resp]):
        dump(proj / "pages" / f"{slug(p['name'])}__{p['id']}" / "page.json", strip_volatile(p))


def page_dir(proj: Path, page_id: str) -> Path:
    for d in (proj / "pages").glob(f"*__{page_id}"):
        return d
    return proj / "pages" / f"page__{page_id}"


def explode_custom_layout(resp: dict, proj: Path):
    dump(page_dir(proj, resp["page_id"]) / "custom_layout.json", strip_volatile(resp))


def explode_custom_element(resp: dict, proj: Path, page_id: str = None):
    base = page_dir(proj, page_id) if page_id else proj / "custom_elements"
    d = base / "custom_elements" / f"{slug(resp.get('label'))}__{resp['custom_element_id']}"
    meta = {k: v for k, v in resp.items() if k not in ("html", "css", "javascript")}
    dump(d / "element.json", strip_volatile(meta))
    write_text(d / "index.html", resp.get("html") or "")
    write_text(d / "style.css", resp.get("css") or "")
    write_text(d / "script.js", resp.get("javascript") or "")


# ---------------------------------------------------------------- assemble
def assemble_workflow(d: Path) -> dict:
    wf = json.loads((d / "workflow.json").read_text(encoding="utf-8"))

    def walk(acts):
        for a in acts or []:
            js = a.get("javascript") or ""
            if js.startswith("@file:"):
                a["javascript"] = (d / js[6:]).read_text(encoding="utf-8").rstrip("\n")
            walk((a.get("conditional") or {}).get("action_true"))
            walk((a.get("conditional") or {}).get("action_false"))
            walk((a.get("while") or {}).get("action_while"))
            walk((a.get("while") or {}).get("action_done"))

    walk(wf.get("actions"))
    return wf


def assemble_custom_element(d: Path) -> dict:
    meta = json.loads((d / "element.json").read_text(encoding="utf-8"))
    for key, fn in (("html", "index.html"), ("css", "style.css"), ("javascript", "script.js")):
        meta[key] = (d / fn).read_text(encoding="utf-8").rstrip("\n")
    return meta


# ---------------------------------------------------------------- check
def scan_secrets(obj, path, problems):
    if isinstance(obj, dict):
        for k, v in obj.items():
            if SECRET_KEY_RE.search(k) and isinstance(v, str) and v and not v.startswith(("_variable", "req.", "@file:")):
                problems.append(f"{path}: key '{k}' has a literal value — use an Environment Variable (Secret)")
            scan_secrets(v, path, problems)
    elif isinstance(obj, list):
        for v in obj:
            scan_secrets(v, path, problems)
    elif isinstance(obj, str) and SECRET_VALUE_RE.search(obj):
        problems.append(f"{path}: looks like a hard-coded credential")


def check() -> int:
    problems = []
    node = shutil.which("node")
    for f in sorted(PROJECTS.rglob("*")):
        rel = f.relative_to(ROOT)
        if f.suffix == ".json":
            try:
                data = json.loads(f.read_text(encoding="utf-8"))
            except Exception as e:
                problems.append(f"{rel}: invalid JSON ({e})")
                continue
            if any(k in VOLATILE for k in (data if isinstance(data, dict) else {})):
                problems.append(f"{rel}: contains volatile/env fields — re-run explode")
            scan_secrets(data, rel, problems)
            if f.name == "workflow.json":
                for ref in re.findall(r'"@file:([^"]+)"', f.read_text(encoding="utf-8")):
                    if not (f.parent / ref).exists():
                        problems.append(f"{rel}: missing referenced file {ref}")
        elif f.suffix in (".js", ".html", ".css"):
            if SECRET_VALUE_RE.search(f.read_text(encoding="utf-8")):
                problems.append(f"{rel}: looks like a hard-coded credential")
            if f.suffix == ".js" and node:
                # Officeless workflow blocks are function bodies (may use top-level return),
                # so wrap before syntax checking.
                src = f.read_text(encoding="utf-8")
                r = subprocess.run([node, "-e", "new Function(require('fs').readFileSync(0,'utf8'))"],
                                   input=src, capture_output=True, text=True)
                if r.returncode != 0:
                    msg = (r.stderr.strip().splitlines() or ["syntax error"])
                    problems.append(f"{rel}: JS syntax error — {[l for l in msg if 'Error' in l][:1] or msg[-1:]}")
    for p in problems:
        print("✗", p)
    print(f"{'FAILED' if problems else 'OK'} — {len(problems)} problem(s)")
    return 1 if problems else 0


# ---------------------------------------------------------------- cli
def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    e = sub.add_parser("explode")
    e.add_argument("kind")
    e.add_argument("raw")
    e.add_argument("--project", required=True, help="project folder slug, e.g. testing-mcp")
    e.add_argument("--page-id", help="for custom_element: page it belongs to")
    a = sub.add_parser("assemble")
    a.add_argument("kind", choices=["workflow", "custom_element"])
    a.add_argument("dir")
    sub.add_parser("check")
    args = ap.parse_args()

    if args.cmd == "check":
        sys.exit(check())
    if args.cmd == "assemble":
        fn = assemble_workflow if args.kind == "workflow" else assemble_custom_element
        print(json.dumps(fn(Path(args.dir)), indent=2, ensure_ascii=False))
        return

    proj = PROJECTS / args.project
    raw = load_raw(args.raw)
    k = args.kind
    if k == "workflows":
        wdir = proj / "workflows"
        if wdir.exists():
            shutil.rmtree(wdir)
        for wf in raw.get("data", []):
            explode_workflow(wf, proj)
    elif k == "workflow":
        explode_workflow(raw.get("data", raw), proj)
    elif k == "form":
        explode_form(raw, proj)
    elif k == "tables":
        explode_tables(raw, proj)
    elif k == "page":
        explode_page(raw, proj)
    elif k == "custom_layout":
        explode_custom_layout(raw, proj)
    elif k == "custom_element":
        explode_custom_element(raw, proj, args.page_id)
    else:
        sys.exit(f"unknown kind {k}")


if __name__ == "__main__":
    main()
