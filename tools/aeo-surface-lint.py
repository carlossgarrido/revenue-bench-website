#!/usr/bin/env python3
"""
aeo-surface-lint.py — the surfaces voice-lint.sh cannot see.

voice-lint.sh strips <script> blocks and every tag attribute before it scans, so meta
descriptions, all og:/twitter: strings, img@alt and every JSON-LD string are never checked.
Those are exactly the strings an answer engine lifts. This scans them.

It also closes a second gap, found 2026-09-11 (day 49) with four live instances on the
homepage and for-employers: voice-lint.sh does not decode HTML entities, so a banned
CHARACTER written as an entity in ordinary body copy ("$200K&ndash;$250K") renders as the
banned character in every browser while both lints see nothing. The body-text pass below
decodes entities and applies the character-class bans only, deliberately narrow so it does
not duplicate voice-lint.sh's word bans over the whole site.

Usage:  python3 tools/aeo-surface-lint.py [path ...]      (default: deploy/)
Exit 0 = clean. Exit 1 = at least one HARD hit.

Standing gate step, set 2026-08-29 (day 36), tooled 2026-08-30 (day 37).
"""
import sys, os, re, glob, json, html

HARD = [
    ("em/en dash",                 r"[—–]"),
    ("'actually'",                 r"\bactually\b"),
    ("room lexicon",               r"\bthe rooms?\b|in the building|in the seat|in the chair|opens? the room"),
    ("'seam/seams'",               r"\bseams?\b"),
    ("quiet/quietly",              r"\bquiet(ly)?\b"),
    ("'the ask'",                  r"\bthe ask\b"),
    ("'craft'",                    r"\bcraft(ed|ing|s)?\b"),
    ("'stance'",                   r"\bstance\b"),
    ("negation-then-reframe",      r"We are not|We're not|You are not|You're not|It'?s not a|That'?s not a|This is not a|This isn'?t"),
    ("AI bridge phrase",           r"Here'?s (why|the|what)|The shift happened|I used to think that"),
    ("banned vocab",               r"\bleverage\b|\bunlock\b|\bsynergy\b|\bunpack\b|\bfoster\b|\bcultivate\b|\becosystem\b|\bbandwidth\b|game.changer|deep dive|circle back|touch base|level up|crush it|moving forward"),
    ("AI-tell words",              r"\bdelve\b|\bembark\b|\btapestry\b|\bpivotal\b|\bharness\b|groundbreaking|cutting.edge|\btestament\b|skyrocket|revolutioni|\butilize\b|ever.evolving|shed light|in a world where"),
    ("transition adverbs",         r"\bMoreover\b|\bFurthermore\b|\bAdditionally\b"),
    ("theatrical idiom",           r"\bhiding\b|heavy lifting|on the table|walk into|watched weekly|dressed (up )?in"),
    ("'plainly'",                  r"\bplainly\b"),
]
# An entity inside a word renders as the banned text while a grep over source sees nothing.
INWORD_ENTITY = re.compile(r"[A-Za-z]&#[0-9a-fA-F]+;|&#[0-9a-fA-F]+;[A-Za-z]")

# Character-class bans that an HTML entity can hide inside visible body copy.
# Narrow on purpose: voice-lint.sh already scans body text for the word bans, and its
# only blind spot is the entity encoding, so this pass decodes and checks characters.
BODY_CHAR_HARD = [
    ("em/en dash in body copy (entity-decoded)", r"[\u2014\u2013]"),
]

JSON_KEYS = ("headline", "name", "description", "text", "alternateName", "articleBody",
             "caption", "jobTitle", "slogan", "about")

def surfaces(path):
    """Yield (label, raw_string) for every string an engine can extract."""
    src = open(path, encoding="utf-8").read()
    for m in re.finditer(r"<title[^>]*>(.*?)</title>", src, re.S | re.I):
        yield "title", m.group(1)
    for m in re.finditer(r"<meta\b[^>]*>", src, re.I):
        tag = m.group(0)
        key = re.search(r'(?:name|property)\s*=\s*["\']([^"\']+)["\']', tag, re.I)
        val = re.search(r'content\s*=\s*["\']([^"\']*)["\']', tag, re.I)
        if key and val and re.match(r"description|og:|twitter:|author|keywords", key.group(1), re.I):
            yield f"meta[{key.group(1)}]", val.group(1)
    for m in re.finditer(r"<img\b[^>]*>", src, re.I):
        val = re.search(r'alt\s*=\s*["\']([^"\']*)["\']', m.group(0), re.I)
        if val:
            yield "img@alt", val.group(1)
    for m in re.finditer(r'<script[^>]*application/ld\+json[^>]*>(.*?)</script>', src, re.S | re.I):
        try:
            data = json.loads(m.group(1))
        except Exception as e:
            yield "JSON-LD:INVALID", f"{e}"
            continue
        def walk(node, trail="ld"):
            if isinstance(node, dict):
                for k, v in node.items():
                    if k in JSON_KEYS and isinstance(v, str):
                        yield f"{trail}.{k}", v
                    else:
                        yield from walk(v, f"{trail}.{k}")
            elif isinstance(node, list):
                for i, v in enumerate(node):
                    yield from walk(v, f"{trail}[{i}]")
        yield from walk(data)

def body_text(path):
    """Visible body copy with <style>/<script> and all tags removed, entities decoded."""
    src = open(path, encoding="utf-8").read()
    src = re.sub(r"<style[^>]*>.*?</style>", " ", src, flags=re.S | re.I)
    src = re.sub(r"<script[^>]*>.*?</script>", " ", src, flags=re.S | re.I)
    src = re.sub(r"<[^>]+>", " ", src)
    return html.unescape(src)


def main(argv):
    targets = argv[1:] or ["deploy"]
    files = []
    for t in targets:
        files.extend(sorted(glob.glob(os.path.join(t, "**", "*.html"), recursive=True)) if os.path.isdir(t) else [t])
    hard = 0
    for f in files:
        for label, raw in surfaces(f):
            if label == "JSON-LD:INVALID":
                print(f"[HARD] invalid JSON-LD  {f}\n    {raw}"); hard += 1; continue
            if INWORD_ENTITY.search(raw):
                print(f"[HARD] entity inside a word  {f}  ({label})\n    {raw.strip()[:160]}"); hard += 1
            text = html.unescape(raw)
            for name, pat in HARD:
                if re.search(pat, text, re.I if name != "transition adverbs" else 0):
                    print(f"[HARD] {name}  {f}  ({label})\n    {text.strip()[:160]}"); hard += 1
        text = body_text(f)
        for name, pat in BODY_CHAR_HARD:
            for m in re.finditer(pat, text):
                a, b = max(0, m.start() - 60), m.end() + 60
                print(f"[HARD] {name}  {f}\n    ...{text[a:b].strip()}..."); hard += 1
    print(f"\n{len(files)} files scanned. {hard} HARD hit(s) on extraction surfaces and in body copy.")
    return 1 if hard else 0

if __name__ == "__main__":
    sys.exit(main(sys.argv))
