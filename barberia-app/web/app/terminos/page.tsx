import PaginaLegal from "@/components/PaginaLegal";

// se lee PLAN_PRECIO, CONTACTO_EMAIL, etc. en cada pedido (no al construir la imagen)
export const dynamic = "force-dynamic";

export const metadata = { title: "Términos y condiciones" };

export default function Terminos() {
  const titular = process.env.TITULAR_LEGAL;
  const contacto = process.env.CONTACTO_EMAIL;
  const dias = process.env.PRUEBA_DIAS ?? "30";
  return (
    <PaginaLegal titulo="Términos y condiciones" actualizado="octubre de 2026">
      <p>
        Estos términos regulan el uso del servicio de agenda online para barberías operado por {titular ? <b>{titular}</b> : "su titular"}.
        Al crear una cuenta o usar el servicio, aceptás estas condiciones.
      </p>

      <h2>1. El servicio</h2>
      <p>
        Ofrecemos una herramienta para que las barberías publiquen sus servicios y horarios, reciban reservas, envíen recordatorios y lleven la
        ficha de sus clientes. La barbería es quien presta el servicio de corte; nosotros solo proveemos la herramienta de gestión.
      </p>

      <h2>2. Cuenta</h2>
      <ul>
        <li>Tenés que dar datos verdaderos y mantener tu contraseña en reserva.</li>
        <li>Sos responsable de lo que ocurre desde tu cuenta.</li>
        <li>Podés tener una barbería por cuenta, con uno o más barberos.</li>
      </ul>

      <h2>3. Prueba gratuita y plan</h2>
      <ul>
        <li>Las barberías nuevas tienen una prueba gratuita de {dias} días, sin cargar medios de pago.</li>
        <li>Después, el uso continuo requiere un plan mensual cuyo precio se informa dentro de la plataforma. Te avisamos antes de que termine la prueba.</li>
        <li>El pago se realiza por los medios indicados en tu panel (por ejemplo, transferencia o link de Mercado Pago) y se registra al acreditarse.</li>
        <li>Si el plan vence y pasan los días de gracia informados, podemos dejar de habilitar nuevas reservas en tu página hasta que se regularice. Tus datos se conservan.</li>
        <li>Podemos modificar el precio con aviso previo.</li>
      </ul>

      <h2>4. Datos de tus clientes</h2>
      <p>
        Vos sos responsable de los datos de tus clientes que cargues o que se carguen al reservar con tu barbería. Debés usarlos solo para gestionar tus turnos y
        tu relación con ellos, respetar la Ley 25.326 y atender sus pedidos de acceso, rectificación o eliminación. Nosotros los almacenamos por tu cuenta, según
        la Política de privacidad.
      </p>

      <h2>5. Uso aceptable</h2>
      <p>No podés usar el servicio para actividades ilegales, para enviar mensajes no solicitados masivos, para cargar contenido ofensivo o que no te pertenezca, ni para intentar vulnerar su seguridad o acceder a datos de otras barberías.</p>

      <h2>6. Contenido que subís</h2>
      <p>
        Tu logo, tus fotos y los datos que cargues siguen siendo tuyos. Nos autorizás a almacenarlos y mostrarlos únicamente para prestarte el servicio. Declarás
        tener derecho a usarlos y, en el caso de fotos de personas, contar con su consentimiento.
      </p>

      <h2>7. Disponibilidad</h2>
      <p>
        Procuramos que el servicio esté disponible de forma continua, pero no garantizamos que funcione sin interrupciones ni errores. Pueden existir
        mantenimientos o fallas de proveedores externos (por ejemplo, de envío de mails). Te recomendamos confirmar los turnos importantes con tus clientes.
      </p>

      <h2>8. Limitación de responsabilidad</h2>
      <p>
        En la máxima medida permitida por la ley, no respondemos por turnos perdidos, por la conducta de los clientes o de la barbería, ni por daños indirectos. Nuestra
        responsabilidad total se limita a lo que hayas pagado por el servicio en los tres meses anteriores al hecho.
      </p>

      <h2>9. Baja y exportación</h2>
      <p>
        Podés dejar de usar el servicio cuando quieras y pedirnos la eliminación de tu cuenta. Antes de la baja, podés solicitar una copia de tus datos.
      </p>

      <h2>10. Cambios y ley aplicable</h2>
      <p>
        Podemos actualizar estos términos y lo informaremos en esta página. Se rigen por las leyes de la República Argentina.
        {contacto ? <> Consultas: <a className="underline" href={`mailto:${contacto}`}>{contacto}</a>.</> : null}
      </p>
    </PaginaLegal>
  );
}
