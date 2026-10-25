# Cobros y administración

## Cómo funciona
- Cada barbería nueva arranca con una **prueba gratis** (30 días, configurable en `/admin/configuracion`).
- El estado del plan vive en tablas aparte (`suscripciones`, `pagos`): el barbero **solo puede leerlas**; solo el
  administrador o el proveedor de pagos (webhook) las modifican.
- **Exigir el pago viene APAGADO** (no cobra nada solo: los pagos los registrás vos a mano). Mientras esté apagado, ninguna barbería se bloquea por falta de pago
  (solo las que vos suspendas a mano). Cuando lo actives, una barbería con la prueba vencida o sin pago deja de
  recibir reservas después de los días de gracia (7 por defecto) y se le avisa en el panel.

## Primer administrador (una sola vez)
En el SQL Editor de Supabase, con TU mail (el de tu cuenta de la app):
```sql
insert into public.administradores (user_id) select id from auth.users where email = 'tu@mail.com';
```
Después aparece el link **Admin** en tu panel (`/admin`). Para cualquier otra persona, esa dirección responde 404.

## Panel de administrador (`/admin`)
- **Resumen:** usuarios registrados, cuántos armaron su barbería y cuántos **no** (son contactos para escribirles),
  en prueba, pagando, vencidas, turnos de los últimos 30 días y lo cobrado.
- **Usuarios:** todos los que se registraron (aunque no hayan armado su barbería), con búsqueda y filtros.
- **Gestionar** una barbería: registrar un pago a mano (transferencia, Mercado Pago, efectivo → activa el plan por N
  meses), extender la prueba, cambiar el estado o suspender.
- **Pagos:** historial y total.
- **Plazos:** exigir el pago o no, días de prueba y de gracia, precio e instrucciones de pago.

## Cobro en pesos por transferencia o link de Mercado Pago (el que se usa hoy)
1. En `/admin/configuracion` escribí el **precio** y las **instrucciones de pago** (alias o CBU, link de Mercado Pago,
   a dónde mandar el comprobante). Cada barbero las ve en **Mi plan**; los links se vuelven clickeables.
2. En `/admin/usuarios`, el filtro **Por vencer (7 días)** te muestra a quién cobrarle esta semana.
3. Cuando te llega un pago: **Gestionar** esa barbería → **Registrar un pago** (monto, moneda, método, meses que cubre).
   El plan queda **Pagando** y se suma ese tiempo a lo que ya tuviera pagado.
4. Con **Exigir el pago** apagado nadie se bloquea; cuando lo enciendas, una barbería sin pago deja de recibir
   reservas después de los días de gracia, y el barbero lo ve en un aviso rojo en su panel.

Como no se conecta con Mercado Pago, **el pago no se detecta solo**: lo registrás vos. Si el volumen crece, el paso
siguiente es una suscripción automática con Mercado Pago (cobro mensual con aviso de cada pago al sistema).

## Cobrar en dólares con Lemon Squeezy (opcional, para clientes fuera de Argentina)
Lemon Squeezy actúa como "merchant of record": cobra al cliente, se ocupa de los impuestos de venta y te paga a vos.
Según su página oficial, **Argentina figura entre los países con pago por transferencia bancaria (en USD)**, y también
ofrece PayPal. Los pagos se liquidan dos veces por mes (los días 1 y 15). Tiene comisiones por venta y por retiro:
revisalas en su sitio antes de fijar el precio. Confirmá todo esto en su documentación vigente.

### Puesta en marcha
1. Crear la cuenta y la tienda en lemonsqueezy.com y completar la verificación para poder cobrar y retirar.
2. Crear un **producto con suscripción mensual** (el precio en USD). Copiar su **link de compra**
   (`https://TU-TIENDA.lemonsqueezy.com/checkout/buy/ID`).
3. Crear el **webhook** (Settings → Webhooks):
   - URL: `https://agenda.wameta.app/api/webhooks/lemonsqueezy`
   - Signing secret: un texto largo y aleatorio (guardalo)
   - Eventos: todos los `subscription_*` (creada, actualizada, cancelada, reanudada, expirada, pausada,
     y los `subscription_payment_*`).
4. En Coolify, cargar las variables (y redesplegar):
   - `LEMONSQUEEZY_WEBHOOK_SECRET` = el signing secret del paso 3
   - `LEMONSQUEEZY_CHECKOUT_URL` = el link de compra del paso 2
   - `PLAN_PRECIO` = por ejemplo `USD 15 por mes` (opcional; también `CONTACTO_EMAIL`, que se muestra si todavía no hay link de pago)
5. Probar en **modo de prueba** de Lemon Squeezy con una tarjeta de prueba, y verificar que el pago aparezca en
   `/admin/pagos` y que el plan pase a "Pagando".
6. **Verificar con el primer pago real** que el monto se registra bien (el sistema interpreta el total del aviso en
   centavos). Si no coincidiera, avisame.

### Seguridad
Cada aviso se verifica con la firma `X-Signature` (HMAC-SHA256 sobre el cuerpo recibido) antes de procesarse.
Un aviso repetido o que llega fuera de orden no duplica pagos ni retrocede fechas, y una suspensión hecha por el
administrador no se pisa con un aviso del proveedor.

## Pesos con Mercado Pago
Hoy se puede cobrar en pesos **a mano** (transferencia o link de Mercado Pago) y registrarlo en `/admin` ("Registrar
un pago"). Una suscripción automática con Mercado Pago es el siguiente paso si la querés.

## Impuestos y cambio de divisas (consultá a un contador)
Recibir dólares del exterior tiene implicancias impositivas y cambiarias (facturación, monotributo o sociedad,
liquidación de divisas). No lo resolvemos en el sistema: conviene definirlo con un contador antes de cobrar.
Además, cobrarles en dólares a barberos argentinos puede restarte ventas (compran con tarjeta en pesos y las fuentes
consultadas no coinciden sobre los recargos vigentes): evaluá ofrecer también el precio en pesos.
