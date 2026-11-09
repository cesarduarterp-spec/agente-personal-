# Reglas de correo del operador (español)

Estas reglas reemplazan la "forma" por defecto del Writer (pensada para inglés).
Se activan con `writer.email_rules: "skills/email_rules.md"` en `sellbird.local.yaml`.
Sellbird sigue aplicando por encima: la regla de HECHOS (no inventar nada del
prospecto), el filtro previo al envío y la lista de no contactar.

## Idioma y trato

- Escribe siempre en español neutro latinoamericano. Sin modismos de un solo país
  ("chévere", "padre", "bacán", "guay") salvo que el prospecto los use primero.
- Primer contacto: "usted". Si el prospecto tutea en su respuesta, pasa a "tú".
- Saludo: "Hola {nombre}," y nada más. Sin "Estimado/a".
- Si el correo va a un buzón general de la empresa, saluda con "Hola, equipo de {empresa},".

## Forma del correo 1

- Entre 45 y 80 palabras.
- Frase 1: una observación concreta sacada de los HECHOS (una señal de su web,
  sus anuncios, sus reseñas, una vacante). Nada genérico.
- Frase 2: por qué eso importa, en términos de su negocio (clientes, citas,
  ventas, tiempo), sin exagerar y sin cifras inventadas.
- Frase 3: UNA pregunta fácil de contestar con una o dos líneas.
- No nombres el producto ni la agencia en el cuerpo. La firma ya dice quién eres.
- Asunto: 2 a 5 palabras, en minúsculas, que suene a correo entre personas
  ("sus reseñas en google", "reservas desde instagram").

## Forma de la secuencia

- Correo 2 (3 días después): otro ángulo y una prueba concreta tomada de la
  información del producto. Ahí sí puedes nombrar el servicio. Menos de 80 palabras.
- Correo 3 (4 días después): cierre amable, menos de 45 palabras. Sin culpa,
  sin "supongo que no le interesa". Deja la puerta abierta.

## Enlaces y firma

- Correo 1: cero enlaces.
- Como máximo un enlace en toda la secuencia: el de agendar, si está configurado.
- No escribas tú la línea de baja ni la dirección postal: Sellbird las agrega.

## Palabras que no se usan

gratis, gratuito, garantizado, sin riesgo, oferta, promoción, descuento,
urgente, últimos días, aproveche, haga clic, revolucionar, potenciar,
siguiente nivel, sinergia, soluciones integrales, innovador, en la era digital,
espero que se encuentre bien, me comunico con usted para, solo quería.

## Ejemplos (datos ficticios)

Señal: `RUNNING_META_ADS` + `NO_ONLINE_BOOKING` · Clínica dental ficticia.

```
asunto: anuncios y citas

Hola Laura,

Vi que Clínica Sonrisa Norte tiene anuncios activos en Instagram, pero para
agendar hay que escribir por WhatsApp y esperar respuesta. Mucha gente que
llega desde un anuncio se va si no puede reservar en ese momento.

¿Hoy quién contesta esos mensajes en su clínica?
```

Señal: `BLOG_STALE` + `REVIEW_COUNT` bajo · Restaurante ficticio.

```
asunto: sus reseñas en google

Hola Andrés,

La Terraza de Pedro tiene muy buena calificación en Google, pero con pocas
reseñas comparado con los lugares de la misma zona, y la última publicación
en su sitio es de hace más de un año.

¿Están pidiendo reseñas a los clientes de forma activa o llegan solas?
```
