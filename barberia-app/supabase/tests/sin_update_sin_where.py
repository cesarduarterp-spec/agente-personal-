#!/usr/bin/env python3
"""Falla si alguna migración tiene un UPDATE o DELETE sin WHERE.
Supabase activa pg_safeupdate para la API y rechaza esas sentencias; una base común no lo hace,
así que las pruebas locales no lo detectan. Uso: python3 tests/sin_update_sin_where.py"""
import glob, re, sys

malos = []
for f in sorted(glob.glob("migrations/*.sql")):
    s = re.sub(r"--[^\n]*", "", open(f).read())
    for m in re.finditer(r"\b(update\s+(?:public\.)?\w+\s+(?:\w+\s+)?set\b|delete\s+from\s+(?:public\.)?\w+)", s, re.I):
        sent = s[m.start(): s.index(";", m.start())]
        if not re.search(r"\bwhere\b", sent, re.I):
            malos.append(f"{f}: {' '.join(sent.split())[:120]}")
print("\n".join(malos) if malos else "OK: ningún UPDATE/DELETE sin WHERE")
sys.exit(1 if malos else 0)
