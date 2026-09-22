#!/usr/bin/env python3
"""
stack-tables.py: the house form for wide data tables on revenuebench.io.

House form (set day 58, 2026-09-22): every table that needs a scroll wrapper
stacks on phones at 760px. The stacking rule is class-driven and lives once, in
assets/site.css. A table opts in with two classes and per-cell labels:

    <div class="tablewrap rb-table-wrap">
      <table class="datatable rb-table" id="...">
        <thead><tr><th>Route</th><th>What the company is buying</th>...</tr></thead>
        <tbody><tr><td>...</td><td data-label="What the company is buying">...</td>...

The first cell of each row becomes the row title and carries no label. Every
other cell carries data-label, and site.css renders it as an inline bold prefix.

A table that must keep its grid on a phone declares the exception. Its wrapper
carries data-rb-scroll="keep", and --check accepts it.
Comparison across columns is the reason to reach for that; no table on the site
needs it today.

Modes:
  --check   exit 1 if any table inside a scroll wrapper is unconverted, missing
            a class, or missing a non-empty data-label
  --apply   add the classes and inject data-label from <thead> (or from a
            per-table override map, used once to preserve authored labels)
  --report  print the inventory
"""
import re, sys, glob, json, os, html

WRAP_RE = re.compile(r'table-scroll|tablewrap|-table-wrap')
SKIP_WRAP_RE = re.compile(r'print-only|\bprose\b')

def pages():
    return sorted(glob.glob('deploy/*.html')) + sorted(glob.glob('deploy/guides/*.html'))

def find_tables(src):
    """Yield (wrapper_open_span, wrapper_class, table_span, table_open_span) for wrapped tables."""
    out = []
    for m in re.finditer(r'<table\b[^>]*>', src):
        # nearest preceding open div
        head = src[:m.start()]
        dm = None
        for d in re.finditer(r'<div\b[^>]*>', head):
            dm = d
        if not dm:
            continue
        cls = re.search(r'class="([^"]*)"', dm.group(0))
        cls = cls.group(1) if cls else ''
        if not WRAP_RE.search(cls) or SKIP_WRAP_RE.search(cls):
            continue
        end = src.find('</table>', m.end())
        out.append({'wrap': (dm.start(), dm.end()), 'wrapcls': cls,
                    'open': (m.start(), m.end()),
                    'body': (m.end(), end), 'full': (m.start(), end + len('</table>'))})
    return out

def table_id(open_tag):
    m = re.search(r'id="([^"]+)"', open_tag)
    return m.group(1) if m else ''

def headers(table_html):
    th = re.search(r'<thead\b.*?</thead>', table_html, re.S)
    if not th:
        return []
    return [strip(x) for x in re.findall(r'<th\b[^>]*>(.*?)</th>', th.group(0), re.S)]

def strip(s):
    s = re.sub(r'<[^>]+>', '', s)
    s = html.unescape(s)
    return re.sub(r'\s+', ' ', s).strip()

def cells_of_rows(body):
    """Return list of (row_html_span_start, [(cell_start,cell_end,tagopen)]) for tbody rows."""
    tb = re.search(r'<tbody\b[^>]*>(.*?)</tbody>', body, re.S)
    region = tb.group(1) if tb else body
    base = body.index(region)
    rows = []
    for rm in re.finditer(r'<tr\b[^>]*>(.*?)</tr>', region, re.S):
        cells = []
        for cm in re.finditer(r'<(td|th)\b([^>]*)>', rm.group(1)):
            cells.append({'tag': cm.group(1), 'attrs': cm.group(2),
                          'start': base + rm.start(1) + cm.start(),
                          'end': base + rm.start(1) + cm.end()})
        rows.append({'attrs': rm.group(0)[:rm.group(0).index('>')], 'cells': cells})
    return rows

def report():
    total = 0
    for f in pages():
        src = open(f, encoding='utf-8').read()
        ts = find_tables(src)
        for t in ts:
            total += 1
            o = src[t['open'][0]:t['open'][1]]
            print(f"{f}\t{table_id(o) or '-'}\t{t['wrapcls']}\t{len(headers(src[t['full'][0]:t['full'][1]]))}cols")
    print(f"total wrapped tables: {total}", file=sys.stderr)

def classes(tag):
    m = re.search(r'class="([^"]*)"', tag)
    return set(m.group(1).split()) if m else set()

def ancestors(src, pos):
    """Class sets of every open, unclosed <div> above pos, outermost first."""
    stack = []
    for m in re.finditer(r'<div\b[^>]*>|</div>', src[:pos]):
        if m.group(0) == '</div>':
            if stack:
                stack.pop()
        else:
            stack.append(m.group(0))
    return stack

def check():
    bad = []
    for f in pages():
        src = open(f, encoding='utf-8').read()
        converted = {t['open'][0] for t in find_tables(src)}
        for m in re.finditer(r'<table\b[^>]*>', src):
            anc = ancestors(src, m.start())
            wrapped = [a for a in anc if WRAP_RE.search(a) and not SKIP_WRAP_RE.search(a)]
            tid = table_id(m.group(0)) or '(no id)'
            if not wrapped:
                continue
            if any('data-rb-scroll="keep"' in a for a in wrapped):
                continue  # declared opt-out: this table keeps its grid on a phone
            if m.start() not in converted:
                bad.append(f"{f} {tid}: inside a scroll wrapper but not converted "
                           f"(the wrapper is not this table's direct parent)")
                continue
            t = next(x for x in find_tables(src) if x['open'][0] == m.start())
            if 'rb-table-wrap' not in classes(src[t['wrap'][0]:t['wrap'][1]]):
                bad.append(f"{f} {tid}: wrapper missing the rb-table-wrap class")
            if 'rb-table' not in classes(m.group(0)):
                bad.append(f"{f} {tid}: table missing the rb-table class")
            body = src[t['body'][0]:t['body'][1]]
            for ri, row in enumerate(cells_of_rows(body)):
                if len(row['cells']) <= 1:
                    continue  # a group-head row spanning the table
                for ci, c in enumerate(row['cells']):
                    if ci == 0:
                        continue
                    lm = re.search(r'data-label="([^"]*)"', c['attrs'])
                    if not lm:
                        bad.append(f"{f} {tid}: row {ri+1} cell {ci+1} has no data-label")
                    elif not html.unescape(lm.group(1)).strip():
                        bad.append(f"{f} {tid}: row {ri+1} cell {ci+1} has an empty data-label")
    for b in bad:
        print("FAIL " + b)
    print(f"{len(bad)} problems", file=sys.stderr)
    return 1 if bad else 0

def apply(overrides):
    changed = 0
    for f in pages():
        src = open(f, encoding='utf-8').read()
        orig = src
        # work back to front so offsets stay valid
        for t in reversed(find_tables(src)):
            full = src[t['full'][0]:t['full'][1]]
            hdrs = headers(full)
            o = src[t['open'][0]:t['open'][1]]
            tid = table_id(o)
            key = f"{os.path.basename(f)}#{tid}"
            ov = overrides.get(key, {})
            body = src[t['body'][0]:t['body'][1]]
            edits = []
            for row in cells_of_rows(body):
                if len(row['cells']) <= 1:
                    continue
                for ci, c in enumerate(row['cells']):
                    if ci == 0 or 'data-label=' in c['attrs']:
                        continue
                    lbl = ov.get(str(ci + 1)) or (hdrs[ci] if ci < len(hdrs) else '')
                    if not lbl:
                        continue
                    lbl = lbl.replace('"', '&quot;')
                    ins = t['body'][0] + c['end'] - 1  # the position of the closing '>'
                    edits.append((ins, f' data-label="{lbl}"'))
            for pos, text in sorted(edits, reverse=True):
                src = src[:pos] + text + src[pos:]
            # table class
            o = src[t['open'][0]:t['open'][1]]
            if 'rb-table' not in o:
                if 'class="' in o:
                    no = o.replace('class="', 'class="rb-table ', 1)
                else:
                    no = o[:-1] + ' class="rb-table">'
                src = src[:t['open'][0]] + no + src[t['open'][1]:]
            # wrapper class
            w = src[t['wrap'][0]:t['wrap'][1]]
            if 'rb-table-wrap' not in w:
                nw = w.replace('class="', 'class="rb-table-wrap ', 1)
                src = src[:t['wrap'][0]] + nw + src[t['wrap'][1]:]
        if src != orig:
            open(f, 'w', encoding='utf-8').write(src)
            changed += 1
    print(f"{changed} files updated", file=sys.stderr)
    return 0

if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else '--check'
    ovf = sys.argv[2] if len(sys.argv) > 2 else None
    ov = json.load(open(ovf)) if ovf and os.path.exists(ovf) else {}
    if mode == '--report':
        report()
    elif mode == '--apply':
        sys.exit(apply(ov))
    else:
        sys.exit(check())
