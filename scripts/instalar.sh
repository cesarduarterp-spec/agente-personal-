#!/usr/bin/env bash
# =============================================================================
#  Instalador del Asistente Ejecutivo Voice-First — SOLO para un VPS VACÍO (Ubuntu)
#
#  ⚠ Si tu servidor tiene Coolify (u otro proxy en los puertos 80/443) NO uses este
#    script: levanta su propio Caddy en 80/443. Seguí docs/COOLIFY.md.
#    Por seguridad, el script se detiene solo si detecta Coolify o esos puertos ocupados.
#
#    sudo bash scripts/instalar.sh
#
#  Hace solo: Docker, .env (genera secretos, valida claves), base de datos en
#  Supabase, invitación a la PWA, contenedores, usuario de ntfy, importa y activa
#  los workflows de n8n, conecta el bot de Telegram y manda un mensaje de prueba.
#  Se puede volver a correr: no pisa lo que ya está configurado.
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INFRA="$ROOT/infra"
ENVF="$INFRA/.env"

WF_TELEGRAM=asistTelegram001
WF_RECORDATORIOS=asistRecordat002
WF_BRIEFING=asistBriefing003
WF_GCAL=asistGcalSync004

# ─── Utilidades de salida ────────────────────────────────────────────────────
c_ok=$'\e[32m'; c_warn=$'\e[33m'; c_err=$'\e[31m'; c_b=$'\e[1m'; c_0=$'\e[0m'
ok()    { echo "  ${c_ok}✔${c_0} $*"; }
warn()  { echo "  ${c_warn}⚠${c_0} $*"; PENDIENTES+=("$*"); }
fail()  { echo "  ${c_err}✘ $*${c_0}"; exit 1; }
paso()  { echo; echo "${c_b}▸ $*${c_0}"; }
PENDIENTES=()

# ─── .env: lectura / escritura ───────────────────────────────────────────────
getvar() {  # getvar CLAVE → valor (sin comillas ni comentario)
  local line
  line="$(grep -E "^$1=" "$ENVF" 2>/dev/null | head -1 || true)"
  line="${line#*=}"
  if [[ "$line" == \'*\' ]]; then line="${line:1:${#line}-2}"
  elif [[ "$line" == \"*\" ]]; then line="${line:1:${#line}-2}"
  else line="$(sed -E 's/[[:space:]]+#.*$//' <<<"$line")"; fi
  printf '%s' "$line"
}

setvar() {  # setvar CLAVE VALOR → escribe CLAVE='VALOR' (comillas simples: sin interpolación)
  local key="$1" val="${2//\'/}" tmp
  tmp="$(mktemp)"
  if grep -qE "^$key=" "$ENVF"; then
    awk -v k="$key" -v v="$val" 'BEGIN{FS=OFS="="} $1==k {print k "='\''" v "'\''"; next} {print}' "$ENVF" >"$tmp"
  else
    cp "$ENVF" "$tmp"; printf "%s='%s'\n" "$key" "$val" >>"$tmp"
  fi
  cat "$tmp" >"$ENVF"; rm -f "$tmp"
}

es_placeholder() {  # valores de ejemplo de .env.example
  local v="$1"
  [[ -z "$v" || "$v" == *"..."* || "$v" == *midominio* || "$v" == *xxxxxxxx* || "$v" == cambiar* \
     || "$v" == generar* || "$v" == 123456789* || "$v" == MiAsistenteBot || "$v" == yo@* ]]
}

preguntar() {  # preguntar CLAVE "texto" [secreto] — solo si falta o es de ejemplo
  local key="$1" texto="$2" secreto="${3:-}" actual val
  actual="$(getvar "$key")"
  if ! es_placeholder "$actual"; then ok "$key ya configurada"; return; fi
  while true; do
    if [[ -n "$secreto" ]]; then read -rsp "  $texto: " val; echo; else read -rp "  $texto: " val; fi
    [[ -n "$val" ]] && break
  done
  setvar "$key" "$val"
}

generar_si_falta() {
  local actual; actual="$(getvar "$1")"
  if es_placeholder "$actual"; then setvar "$1" "$(openssl rand -hex "${2:-32}")"; ok "$1 generada"; fi
}

dc()   { docker compose -f "$INFRA/docker-compose.yml" --env-file "$ENVF" "$@"; }
psql_sb() { docker run --rm -i postgres:16-alpine psql "$(getvar SUPABASE_DB_URL)" -v ON_ERROR_STOP=1 -q "$@"; }
n8n_ok() {  # healthcheck dentro del contenedor (node siempre está en la imagen)
  dc exec -T n8n node -e "fetch('http://localhost:5678/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1
}
http_code() { curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$@" || echo 000; }

# ─── Pasos ───────────────────────────────────────────────────────────────────
servidor_compartido() {  # ¿Coolify o algo ya escuchando en 80/443?
  [[ -d /data/coolify ]] && return 0
  if command -v docker >/dev/null && docker ps --format '{{.Names}}' 2>/dev/null | grep -qiE 'coolify|traefik'; then return 0; fi
  if command -v ss >/dev/null && ss -ltnH 2>/dev/null | awk '{print $4}' | grep -qE '(^|:)(80|443)$'; then return 0; fi
  return 1
}

paso_docker() {
  paso "1/9 Docker"
  [[ $EUID -eq 0 ]] || fail "Corré el instalador con sudo: sudo bash scripts/instalar.sh"
  if servidor_compartido; then
    fail "Este servidor ya tiene Coolify/Traefik o algo en los puertos 80/443. No toqué nada. Seguí docs/COOLIFY.md."
  fi
  if command -v docker >/dev/null && docker compose version >/dev/null 2>&1; then
    ok "Docker ya instalado ($(docker --version | cut -d, -f1))"
  else
    curl -fsSL https://get.docker.com | sh
    ok "Docker instalado"
  fi
  command -v openssl >/dev/null || apt-get install -y openssl >/dev/null
  if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
    ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null; ufw allow 443/udp >/dev/null
    ok "Firewall: puertos 80 y 443 abiertos"
  fi
}

paso_env() {
  paso "2/9 Configuración (.env)"
  [[ -f "$ENVF" ]] || cp "$INFRA/.env.example" "$ENVF"
  chmod 600 "$ENVF"

  generar_si_falta N8N_ENCRYPTION_KEY 32
  generar_si_falta N8N_DB_PASSWORD 24
  generar_si_falta TELEGRAM_WEBHOOK_SECRET 24
  generar_si_falta GCAL_SYNC_SECRET 24

  echo "  Completá lo que falta (Enter para confirmar cada dato):"
  preguntar DOMAIN "Dominio (ej: midominio.com, sin https)"
  preguntar ACME_EMAIL "Email para los certificados SSL"
  preguntar USER_NAME "¿Cómo querés que te llame el asistente?"
  preguntar TELEGRAM_BOT_TOKEN "Token del bot de Telegram (@BotFather)" secreto
  preguntar GEMINI_API_KEY "API key de Gemini (aistudio.google.com)" secreto
  preguntar XAI_API_KEY "API key de xAI/Grok (console.x.ai)" secreto
  preguntar SUPABASE_URL "Supabase Project URL (https://xxxx.supabase.co)"
  preguntar SUPABASE_ANON_KEY "Supabase anon key" secreto
  preguntar SUPABASE_SERVICE_ROLE_KEY "Supabase service_role key" secreto
  preguntar SUPABASE_DB_URL "Supabase connection string (Connect → Session pooler → URI, con tu password)" secreto
  preguntar RESEND_API_KEY "API key de Resend" secreto
  preguntar BRIEFING_EMAIL_TO "Tu email (briefing diario y acceso a la app)"
  preguntar BRIEFING_EMAIL_FROM "Remitente del briefing (ej: Asistente <asistente@tudominio.com>)"

  # Nombre del bot: se obtiene solo
  local token me
  token="$(getvar TELEGRAM_BOT_TOKEN)"
  me="$(curl -s --max-time 15 "https://api.telegram.org/bot$token/getMe" || true)"
  if grep -q '"ok":true' <<<"$me"; then
    setvar TELEGRAM_BOT_USERNAME "$(sed -E 's/.*"username":"([^"]+)".*/\1/' <<<"$me")"
    ok "Bot de Telegram: @$(getvar TELEGRAM_BOT_USERNAME)"
  else
    fail "El token de Telegram no es válido. Corregilo en $ENVF y volvé a correr."
  fi

  # Tu chat id: se detecta mandándole un mensaje al bot
  if es_placeholder "$(getvar TELEGRAM_ALLOWED_CHAT_ID)"; then
    curl -s "https://api.telegram.org/bot$token/deleteWebhook" >/dev/null
    echo "  ${c_b}Abrí Telegram, mandale \"hola\" a @$(getvar TELEGRAM_BOT_USERNAME) y apretá Enter acá.${c_0}"
    read -r _
    local upd chat
    upd="$(curl -s "https://api.telegram.org/bot$token/getUpdates")"
    chat="$(grep -oE '"chat":\{"id":-?[0-9]+' <<<"$upd" | tail -1 | grep -oE -- '-?[0-9]+$' || true)"
    if [[ -n "$chat" ]]; then setvar TELEGRAM_ALLOWED_CHAT_ID "$chat"; ok "Tu chat id: $chat"
    else preguntar TELEGRAM_ALLOWED_CHAT_ID "No lo detecté. Escribí tu chat id (@userinfobot)"; fi
  fi
}

paso_validar() {
  paso "3/9 Validando claves"
  local c
  c="$(http_code "https://generativelanguage.googleapis.com/v1beta/models/$(getvar GEMINI_MODEL)" -H "x-goog-api-key: $(getvar GEMINI_API_KEY)")"
  [[ "$c" == 200 ]] && ok "Gemini OK" || warn "Gemini respondió $c: revisá GEMINI_API_KEY"
  c="$(http_code https://api.x.ai/v1/models -H "Authorization: Bearer $(getvar XAI_API_KEY)")"
  [[ "$c" == 200 ]] && ok "Grok (xAI) OK" || warn "xAI respondió $c: revisá XAI_API_KEY (el respaldo no va a funcionar)"
  c="$(http_code "$(getvar SUPABASE_URL)/rest/v1/" -H "apikey: $(getvar SUPABASE_SERVICE_ROLE_KEY)" -H "Authorization: Bearer $(getvar SUPABASE_SERVICE_ROLE_KEY)")"
  [[ "$c" == 200 ]] && ok "Supabase API OK" || fail "Supabase respondió $c: revisá SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY"
  c="$(http_code https://api.resend.com/domains -H "Authorization: Bearer $(getvar RESEND_API_KEY)")"
  [[ "$c" == 200 ]] && ok "Resend OK" || warn "Resend respondió $c: el email del briefing no va a salir"

  local ip dom sub res
  ip="$(curl -s --max-time 10 https://api.ipify.org || true)"
  dom="$(getvar DOMAIN)"
  for sub in n8n ntfy app; do
    res="$(getent ahostsv4 "$sub.$dom" | awk 'NR==1{print $1}' || true)"
    if [[ -n "$ip" && "$res" == "$ip" ]]; then ok "DNS $sub.$dom → $ip"
    else warn "DNS: $sub.$dom apunta a '${res:-nada}' y este VPS es $ip. Creá el registro A (el SSL fallará hasta entonces)"; fi
  done
}

paso_base_datos() {
  paso "4/9 Base de datos (Supabase)"
  psql_sb -f - <"$ROOT/database/001_init.sql" >/dev/null 2>&1 || {
    psql_sb -f - <"$ROOT/database/001_init.sql" 2>&1 | grep -iE "error" | head -3
    fail "No se pudo aplicar 001_init.sql. Revisá SUPABASE_DB_URL (usá la URI del Session pooler)."
  }
  ok "Esquema, funciones y seguridad aplicados"
  psql_sb -v email="$(getvar BRIEFING_EMAIL_TO)" -f - >/dev/null <<'SQL'
insert into public.app_users (email) values (:'email') on conflict do nothing;
SQL
  ok "Acceso a la app habilitado para $(getvar BRIEFING_EMAIL_TO)"
  psql_sb -f - <"$ROOT/database/002_gcal_webhook.sql" >/dev/null
  psql_sb -v n8n_url="https://n8n.$(getvar DOMAIN)/webhook/gcal-sync" -v secret="$(getvar GCAL_SYNC_SECRET)" -f - >/dev/null <<'SQL'
select public.fn_config_gcal_webhook(:'n8n_url', :'secret');
SQL
  ok "Webhook de tareas → n8n (Google Calendar) creado"

  local c
  c="$(curl -s -o /dev/null -w '%{http_code}' -X POST "$(getvar SUPABASE_URL)/auth/v1/invite" \
        -H "apikey: $(getvar SUPABASE_SERVICE_ROLE_KEY)" -H "Authorization: Bearer $(getvar SUPABASE_SERVICE_ROLE_KEY)" \
        -H 'Content-Type: application/json' -d "{\"email\":\"$(getvar BRIEFING_EMAIL_TO)\"}" || true)"
  case "$c" in
    200) ok "Invitación enviada a $(getvar BRIEFING_EMAIL_TO)" ;;
    422) ok "Tu usuario ya existía en Supabase Auth" ;;
    *)   warn "No pude invitar el usuario ($c). Hacelo en Supabase → Authentication → Users → Invite user" ;;
  esac
}

paso_contenedores() {
  paso "5/9 Levantando contenedores (la primera vez tarda unos minutos)"
  dc up -d --build

  for _ in $(seq 1 60); do
    n8n_ok && break
    sleep 3
  done
  n8n_ok && ok "n8n en marcha" || fail "n8n no arrancó: docker compose -f $INFRA/docker-compose.yml logs n8n"
}

paso_ntfy() {
  paso "6/9 Notificaciones push (ntfy)"
  if ! es_placeholder "$(getvar NTFY_TOKEN)"; then ok "ntfy ya configurado"; return; fi
  local user=asistente pass out token
  pass="$(openssl rand -hex 12)"
  dc exec -T -e NTFY_PASSWORD="$pass" ntfy ntfy user add --role=admin "$user" >/dev/null 2>&1 \
    || dc exec -T -e NTFY_PASSWORD="$pass" ntfy ntfy user change-pass "$user" >/dev/null
  out="$(dc exec -T ntfy ntfy token add --label=n8n "$user" 2>&1)"
  token="$(grep -oE 'tk_[A-Za-z0-9]+' <<<"$out" | head -1)"
  [[ -n "$token" ]] || fail "No pude crear el token de ntfy: $out"
  setvar NTFY_TOKEN "$token"
  setvar NTFY_USER "$user"
  setvar NTFY_PASSWORD "$pass"
  dc up -d n8n >/dev/null
  ok "Usuario ntfy '$user' creado (la contraseña queda en infra/.env → NTFY_PASSWORD)"
}

paso_workflows() {
  paso "7/9 Workflows de n8n"
  dc exec -T n8n n8n import:workflow --separate --input=/workflows >/dev/null
  ok "4 workflows importados"
  local id
  for id in "$WF_TELEGRAM" "$WF_RECORDATORIOS" "$WF_BRIEFING"; do
    dc exec -T n8n n8n publish:workflow --id="$id" >/dev/null && ok "Activado $id" || warn "No pude activar $id: activalo a mano en n8n"
  done
  dc restart n8n >/dev/null
  for id in $(seq 1 40); do n8n_ok && break; sleep 3; done
  warn "Workflow 04 ($WF_GCAL, Google Calendar) queda apagado hasta que cargues la credencial de Google (ver abajo)"
}

paso_telegram() {
  paso "8/9 Conectando Telegram"
  local token res
  token="$(getvar TELEGRAM_BOT_TOKEN)"
  for _ in $(seq 1 20); do   # esperar el certificado SSL de n8n
    [[ "$(http_code "https://n8n.$(getvar DOMAIN)/healthz")" == 200 ]] && break
    sleep 6
  done
  res="$(curl -s "https://api.telegram.org/bot$token/setWebhook" \
          --data-urlencode "url=https://n8n.$(getvar DOMAIN)/webhook/telegram" \
          --data-urlencode "secret_token=$(getvar TELEGRAM_WEBHOOK_SECRET)" \
          --data-urlencode 'allowed_updates=["message","callback_query"]')"
  grep -q '"ok":true' <<<"$res" && ok "Webhook de Telegram configurado" || warn "setWebhook falló: $res"
  curl -s "https://api.telegram.org/bot$token/sendMessage" \
    --data-urlencode "chat_id=$(getvar TELEGRAM_ALLOWED_CHAT_ID)" \
    --data-urlencode "text=✅ Asistente conectado. Mandame una nota de voz con tu primera tarea." >/dev/null
  ok "Mensaje de prueba enviado a tu Telegram"
}

paso_resumen() {
  local dom; dom="$(getvar DOMAIN)"
  paso "9/9 Listo"
  cat <<EOF

  ${c_b}Ya funciona:${c_0} bot de Telegram (voz y texto, Gemini + respaldo Grok), recordatorios,
  briefing de las 08:00, app en https://app.$dom

  ${c_b}Te falta hacer a mano (solo una vez):${c_0}
   1. n8n:      abrí https://n8n.$dom y creá tu usuario administrador.
   2. Supabase: Authentication → URL Configuration → Site URL = https://app.$dom
   3. Google:   console.cloud.google.com → activá "Google Calendar API" → OAuth client (Web)
                con redirect https://n8n.$dom/rest/oauth2-credential/callback
                En n8n: Credentials → Google Calendar OAuth2 API → elegila en los 4 nodos "GCal ·"
                del workflow 04 y activalo.
   4. Resend:   verificá el dominio del remitente (Domains → Add domain).
   5. Celular:  abrí https://app.$dom, entrá con el link del email y "Agregar a pantalla de inicio".
                App ntfy → servidor https://ntfy.$dom, usuario asistente, contraseña en infra/.env
                (NTFY_PASSWORD), suscribite al tema "$(getvar NTFY_TOPIC)".
EOF
  if ((${#PENDIENTES[@]})); then
    echo; echo "  ${c_warn}${c_b}Avisos a revisar:${c_0}"
    printf '   - %s\n' "${PENDIENTES[@]}"
  fi
  echo
}

main() {
  paso_docker
  paso_env
  paso_validar
  paso_base_datos
  paso_contenedores
  paso_ntfy
  paso_workflows
  paso_telegram
  paso_resumen
}

# Permite `source scripts/instalar.sh` para pruebas sin ejecutar nada
if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then main "$@"; fi
