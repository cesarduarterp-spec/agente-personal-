# Sellbird en español: kit de adaptación

Kit para que [Sellbird](https://github.com/ethanplusai/sellbird) (antes Harvey,
fork en `PastorStudio/harvey`) prospecte, escriba y responda **en español**
para el mercado hispano. Está hecho para Sellbird 0.4.0 (commit `8257fae`).

La mayor parte **no toca el código**: Sellbird lee sus prompts y skills de
archivos Markdown que puedes editar en tu carpeta, y tiene un mecanismo oficial
(`writer.email_rules`) para imponer reglas de redacción propias. El kit usa esas
dos vías. El parche opcional cubre lo que sí requiere código.

## Contenido

| Archivo | Qué hace |
|---|---|
| `prompts/system.md` | Identidad y reglas duras del agente, con instrucción de idioma |
| `prompts/writer.md` | Reglas de redacción del correo en frío, adaptadas al español (trato de usted o tú, frases de IA y spam en español) |
| `prompts/handler.md` | Respuestas a prospectos en su idioma; bajas y temas legales de LATAM (LFPDPPP, Habeas Data) |
| `prompts/scout.md` | Puntuación y notas de personalización en español; buzones genéricos en español (contacto@, ventas@) |
| `skills/email_rules.md` | Reglas del operador: forma del correo 1 y de la secuencia, con ejemplos ficticios. Reemplaza la forma por defecto pensada para inglés |
| `skills/objection_handling.md` | Objeciones típicas de pymes hispanas ("lo hace mi sobrino", WhatsApp) |
| `sellbird.local.ejemplo.yaml` | Configuración de ejemplo para una agencia de social media en México y Colombia |
| `instalar.sh` | Copia el kit a tu carpeta de Sellbird y respalda los originales |
| `parches/0001-…patch` | Cambio de código opcional (ver abajo) |

Las variables `{{...}}` de cada prompt son exactamente las del original; si les
cambias el nombre, Sellbird las deja sin rellenar.

## Instalación

```bash
# 1. Sellbird instalado y funcionando en inglés (ver su README)
# 2. Copia el kit
./sellbird-es/instalar.sh /ruta/a/tu/sellbird
# 3. Fusiona sellbird.local.ejemplo.yaml con tu sellbird.local.yaml
# 4. Revisa los primeros lotes en el Outbox (sellbird dashboard)
```

## El parche `0001-filtro-envio-y-baja-en-espanol.patch`

Arregla dos cosas del código que encontré al analizarlo:

1. **El filtro previo al envío (`sellbird/gate.py`) solo bloquea frases en
   inglés.** Si el modelo escribe "haga clic aquí" o "espero que se encuentre
   bien", el correo pasa. El parche agrega el equivalente en español de la lista
   (spam y señales de IA), con y sin tildes.
2. **El validador de `opt_out_line` (`sellbird/config.py`) rechaza
   "no le vuelvo a escribir"**, que es la forma más natural de decirlo. Solo
   aceptaba "no le volveré". El parche acepta también "vuelvo", "escribo" y
   "molesto".

Incluye `tests/test_spanish_gate.py`. **Probado el 9 nov 2026** sobre el commit
`8257fae`, con Python 3.13 en Linux: la suite completa de Sellbird da
3.383 tests aprobados, 29 omitidos y 0 fallos. Los 29 omitidos son tests que
el propio Sellbird salta en este entorno, no fallos del parche. Para aplicarlo
en tu clon:

```bash
cd <tu clon de sellbird>
git am /ruta/a/sellbird-es/parches/0001-filtro-envio-y-baja-en-espanol.patch
python -m pytest -q tests/test_spanish_gate.py tests/test_compliance_footer.py
```

Si pasa, conviene proponerlo como PR al proyecto original: es un aporte que
cualquier usuario hispano agradecería.

## Análisis técnico: lo que hay que saber antes de usarlo en español

**Lo que ya funciona en español sin tocar nada**
- Detección de bajas: `sellbird/agents/handler.py` tiene un detector muy fino de
  bajas en español ("darme de baja", "no me escriba", "no, gracias"), sin
  tildes, línea por línea, y distingue "dar de baja a nuestro proveedor"
  (una señal de compra) de una baja real.
- La `opt_out_line` acepta frases en español.
- El texto se maneja en UTF-8, así que tildes y eñes no dan problemas.

**Lo que asume inglés y el kit corrige**
- Todos los prompts y las skills están en inglés y no hay ningún parámetro de
  idioma. Sin el kit, Sellbird escribe en inglés a una clínica de Bogotá.
- Los límites de palabras (75 y 40) están calibrados para inglés. El español
  necesita entre un 15 y un 25 % más de palabras; el kit sube a 80 y 45.
- El límite duro del filtro (220 palabras, 1 enlace) aplica igual. Está bien.

**Lo que sigue en inglés aunque instales el kit**
- Algunas instrucciones van fijas en el código del Writer
  (`sellbird/agents/writer.py`), por ejemplo "open with 'Hi there'" para buzones
  generales. Las reglas del operador (`email_rules.md`) tienen prioridad cuando
  chocan, pero vigila esos casos en el Outbox.
- El dashboard y la CLI están en inglés.
- Las señales (29) usan Google y Meta, que funcionan igual en LATAM, pero la
  fuente gratuita (OpenStreetMap) tiene menos cobertura de negocios en LATAM
  que en Estados Unidos. Prueba primero con `sellbird discover` en tu ciudad y
  mide cuántos encuentra.
- El cumplimiento legal está pensado para CAN-SPAM, GDPR y PECR. En LATAM aplica
  la ley de datos de cada país (México: LFPDPPP; Colombia: Ley 1581 y Habeas
  Data; Argentina: Ley 25.326; Chile: Ley 19.628, reformada por la 21.719).
  Esto no es asesoría legal: consúltalo con un abogado antes de enviar en volumen.

## Señales que más sirven a una agencia de social media

| Señal | Ángulo del correo |
|---|---|
| `RUNNING_META_ADS` + `NO_ONLINE_BOOKING` | Pagan anuncios pero el interesado no puede reservar |
| `REVIEW_COUNT` bajo + `REVIEW_RATING` alto | Buen servicio que no se ve; estrategia de reseñas |
| `BLOG_STALE` | Contenido abandonado; constancia |
| `HIRING_ROLE` ("community manager") | Están buscando resolver esto; alternativa a contratar |
| `INCUMBENT_AGENCY` | Ya invierten; ofrecer algo complementario, no reemplazar |
| `MAPS_RANK` 4-20 | Visibles pero no ganan; perfil de Google y contenido local |

Confírmalas con `sellbird signals --confirm ...` o desde la pestaña Signals.
