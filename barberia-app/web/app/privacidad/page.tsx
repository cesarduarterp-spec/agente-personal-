import PaginaLegal from "@/components/PaginaLegal";

// se lee PLAN_PRECIO, CONTACTO_EMAIL, etc. en cada pedido (no al construir la imagen)
export const dynamic = "force-dynamic";

export const metadata = { title: "Política de privacidad" };

export default function Privacidad() {
  const titular = process.env.TITULAR_LEGAL;
  const contacto = process.env.CONTACTO_EMAIL;
  return (
    <PaginaLegal titulo="Política de privacidad" actualizado="octubre de 2026">
      <p>
        Esta política explica qué datos personales trata este servicio de agenda online para barberías, para qué los usa y cómo
        podés ejercer tus derechos, de acuerdo con la Ley 25.326 de Protección de los Datos Personales de la República Argentina.
      </p>

      <h2>1. Quién es responsable</h2>
      <p>
        El servicio es operado por {titular ? <b>{titular}</b> : "su titular"}.{" "}
        {contacto ? <>Para cualquier consulta sobre tus datos escribinos a <a className="underline" href={`mailto:${contacto}`}>{contacto}</a>.</> : "Para cualquier consulta sobre tus datos, usá el contacto indicado en el sitio."}
      </p>
      <p>Hay dos situaciones distintas:</p>
      <ul>
        <li><b>Barberos (usuarios del servicio):</b> somos responsables de los datos de tu cuenta.</li>
        <li><b>Clientes de una barbería:</b> la barbería que te atiende es la responsable de tus datos. Nosotros los almacenamos y procesamos por su cuenta y bajo sus instrucciones, para que pueda gestionar sus turnos.</li>
      </ul>

      <h2>2. Qué datos tratamos</h2>
      <ul>
        <li><b>De los barberos:</b> mail, nombre y dirección de la barbería, servicios, precios, horarios, logo y color de marca, y datos de pago o de plan.</li>
        <li><b>De los clientes de una barbería:</b> nombre, apellido, teléfono, mail, edad (si el barbero la carga), dirección y ubicación (si pedís atención a domicilio), observaciones, historial de turnos y de cortes, y fotos de los cortes que el barbero decida guardar.</li>
        <li><b>Datos técnicos:</b> cookies necesarias para mantener la sesión iniciada y registros de seguridad (por ejemplo, direcciones IP) para prevenir abusos.</li>
      </ul>

      <h2>3. Para qué los usamos</h2>
      <ul>
        <li>Gestionar reservas, reprogramaciones y cancelaciones.</li>
        <li>Enviar confirmaciones y recordatorios de turnos por mail.</li>
        <li>Que el barbero lleve la ficha y el historial de sus clientes.</li>
        <li>Administrar la cuenta y el plan de los barberos, y brindar soporte.</li>
        <li>Mantener la seguridad del servicio y prevenir fraudes o reservas falsas.</li>
      </ul>
      <p>No vendemos datos personales ni los usamos para publicidad de terceros.</p>

      <h2>4. Consentimiento</h2>
      <p>
        Al reservar un turno, el cliente acepta expresamente que la barbería guarde sus datos (y, en su caso, fotos de sus cortes)
        para su historial. El consentimiento puede retirarse en cualquier momento pidiéndole a la barbería, o a nosotros, que
        elimine los datos.
      </p>

      <h2>5. Con quién compartimos datos</h2>
      <p>Usamos proveedores que procesan datos para que el servicio funcione:</p>
      <ul>
        <li>Supabase: base de datos, autenticación y almacenamiento de archivos.</li>
        <li>Resend: envío de mails de confirmación y recordatorio.</li>
        <li>Google: inicio de sesión con Google y mapas (Google Maps).</li>
        <li>Cloudflare: red, seguridad y verificación anti-spam (Turnstile).</li>
        <li>Proveedores de pago (por ejemplo Mercado Pago o Lemon Squeezy), solo para el cobro del plan de los barberos.</li>
        <li>Nuestro proveedor de servidores, donde se aloja la aplicación.</li>
      </ul>
      <p>Algunos de estos proveedores pueden almacenar o procesar datos fuera de la Argentina.</p>

      <h2>6. Cuánto tiempo los conservamos</h2>
      <p>
        Mientras la cuenta de la barbería esté activa. Si la cuenta se da de baja, eliminamos o anonimizamos los datos, salvo los que debamos
        conservar por obligación legal. Podés pedir la eliminación de tus datos en cualquier momento.
      </p>

      <h2>7. Tus derechos</h2>
      <p>
        Podés acceder a tus datos, rectificarlos, actualizarlos o pedir su supresión. Escribinos y respondemos dentro de los plazos legales.
        Si sos cliente de una barbería, también podés dirigirte directamente a ella.
      </p>
      <p>
        El titular de los datos personales tiene la facultad de ejercer el derecho de acceso a los mismos en forma gratuita a intervalos no
        inferiores a seis meses, salvo que acredite un interés legítimo al efecto conforme lo establecido en el artículo 14, inciso 3 de la Ley
        Nº 25.326. La Agencia de Acceso a la Información Pública, en su carácter de Órgano de Control de la Ley Nº 25.326, tiene la atribución
        de atender las denuncias y reclamos que interpongan quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes
        en materia de protección de datos personales.
      </p>

      <h2>8. Seguridad</h2>
      <p>
        La información de cada barbería es privada: solo su dueño puede verla. Las conexiones están cifradas y las fotos de los cortes se
        guardan en almacenamiento privado. Ningún sistema es infalible, pero aplicamos medidas razonables para proteger los datos.
      </p>

      <h2>9. Cookies</h2>
      <p>Usamos únicamente cookies necesarias para mantener tu sesión iniciada. No usamos cookies de publicidad.</p>

      <h2>10. Cambios</h2>
      <p>Si modificamos esta política, publicaremos la nueva versión en esta página con su fecha de actualización.</p>
    </PaginaLegal>
  );
}
