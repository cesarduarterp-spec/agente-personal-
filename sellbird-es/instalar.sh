#!/usr/bin/env bash
# Copia el kit en español a tu carpeta de Sellbird.
# Uso: ./instalar.sh /ruta/a/tu/carpeta/sellbird
# Guarda una copia de cada archivo que reemplaza en <carpeta>/respaldo-es-<fecha>/.
set -euo pipefail

DESTINO="${1:-}"
if [[ -z "$DESTINO" || ! -d "$DESTINO/prompts" || ! -d "$DESTINO/skills" ]]; then
  echo "Indica la carpeta de Sellbird (la que tiene prompts/ y skills/)."
  echo "Ejemplos:"
  echo "  ./instalar.sh ~/sellbird                                   # un clon del repo"
  echo "  ./instalar.sh \"\$HOME/Library/Application Support/sellbird\"  # macOS, instalado con pip"
  echo "  ./instalar.sh ~/.local/share/sellbird                      # Linux, instalado con pip"
  exit 1
fi

KIT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESPALDO="$DESTINO/respaldo-es-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$RESPALDO/prompts" "$RESPALDO/skills"

for f in system writer handler scout; do
  [[ -f "$DESTINO/prompts/$f.md" ]] && cp "$DESTINO/prompts/$f.md" "$RESPALDO/prompts/"
  cp "$KIT/prompts/$f.md" "$DESTINO/prompts/$f.md"
done
for f in email_rules objection_handling; do
  [[ -f "$DESTINO/skills/$f.md" ]] && cp "$DESTINO/skills/$f.md" "$RESPALDO/skills/"
  cp "$KIT/skills/$f.md" "$DESTINO/skills/$f.md"
done

echo "Kit instalado. Respaldo de los originales en: $RESPALDO"
echo
echo "Falta:"
echo "  1. Agregar a sellbird.local.yaml (ver sellbird.local.ejemplo.yaml):"
echo "       writer:"
echo "         email_rules: \"skills/email_rules.md\""
echo "     y la opt_out_line en español."
echo "  2. (Opcional, recomendado) Aplicar el parche al código si usas un clon:"
echo "       cd <tu clon> && git am \"$KIT/parches/0001-filtro-envio-y-baja-en-espanol.patch\""
echo "  3. Revisar los primeros lotes en el Outbox antes de cualquier autopilot."
echo
echo "Para volver atrás: copia de nuevo los archivos de $RESPALDO."
