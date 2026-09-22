#!/usr/bin/env python3
"""Bundle index.html and js/*.js into one self-contained HTML file.

    python3 build.py > trim-door-takeoff.html          # standalone single file
    python3 build.py --artifact > artifact.html        # fragment for publishing as a Claude artifact
"""
import re, sys, pathlib
root = pathlib.Path(__file__).parent
html = (root / 'index.html').read_text()
html = re.sub(r'<script src="(js/[^"]+)"></script>\n', lambda m: '<script>\n' + (root / m.group(1)).read_text() + '</script>\n', html)
if '--artifact' in sys.argv:
    for pat in [r'<!DOCTYPE html>\n', r'<html lang="en-AU">\n', r'<head>\n', r'<meta charset="utf-8">\n', r'<meta name="viewport"[^\n]*\n', r'</head>\n', r'<body>\n', r'</body>\n', r'</html>\n']:
        html = re.sub(pat, '', html, count=1)
sys.stdout.write(html)
