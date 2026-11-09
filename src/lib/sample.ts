import type { Tactica } from './schema';
import { derive, todayISO, uid } from './calc';

/**
 * Caso real de negocio: "Tueste Norte", tostadora de café de especialidad DTC
 * (ecommerce, ticket medio 38 USD, 1.200 clientes activos). Objetivo trimestral:
 * subir ingresos recurrentes por suscripción.
 */
export function sampleData(now = new Date()): Tactica[] {
  const d = (days: number) => todayISO(new Date(now.getTime() + days * 86400000));
  const iso = now.toISOString();
  const base = (p: Omit<Tactica, 'id' | 'createdAt' | 'updatedAt'>): Tactica =>
    derive({ ...p, id: uid(), createdAt: iso, updatedAt: iso });

  return [
    base({
      nombre: 'Flujo de recompra por email a los 21 días',
      canal: 'Email',
      fechaInicio: d(2),
      estado: 'aprobada',
      mediciones: [],
      pasos: {
        1: {
          evidenciaJustifica:
            'El 64 % de las recompras ocurre entre los días 18 y 25 (Shopify, últimos 6 meses). Hoy no hay ningún recordatorio automático.',
          fuentes: ['Shopify Analytics – cohortes 2026', 'Benchmark Klaviyo alimentación 2026'],
        },
        2: {
          planPasoAPaso: [
            'Segmentar compradores de bolsa 250 g/1 kg',
            'Escribir 3 emails (día 18, 21, 25) con cupón escalonado',
            'Configurar flujo en Klaviyo y test A/B de asunto',
            'Lanzar al 100 % y revisar tasa de recompra semanal',
          ],
        },
        3: { responsable: 'Laura (CRM)', equipo: ['Diseñador freelance', 'Copywriter'] },
        4: { herramientas: [{ nombre: 'Klaviyo', costoMensual: 150 }] },
        5: {
          riesgoPrincipal: 'Fatiga de la audiencia por exceso de emails y aumento de bajas',
          mitigacion: 'Límite de frecuencia de 2 emails/semana y exclusión de quien abrió en 48 h',
          probabilidad: 2,
          impacto: 3,
        },
        6: {
          inversionEstimada: 0,
          desglose: [
            { concepto: 'Diseño y copy', monto: 900 },
            { concepto: 'Herramientas (Klaviyo 6 meses)', monto: 900 },
          ],
        },
        7: {
          kpiExito: 'Tasa de recompra a 30 días',
          formulaMedicion: 'Clientes con 2.ª compra en ≤30 días / clientes con 1.ª compra del periodo',
          frecuencia: 'semanal',
        },
        8: { retornoEsperado: 7200, horizonteMeses: 6, roiProyectado: 0 },
      },
    }),
    base({
      nombre: 'Campaña Meta Ads de prospección "Prueba tu origen"',
      canal: 'Meta Ads',
      fechaInicio: d(-45),
      estado: 'ejecutando',
      mediciones: [
        { id: uid(), fecha: d(-30), valorKpi: 41, retornoReal: 1400, nota: 'Semana 2, CPA alto' },
        { id: uid(), fecha: d(-7), valorKpi: 38, retornoReal: 2900, nota: 'Nuevo creativo UGC' },
      ],
      pasos: {
        1: {
          evidenciaJustifica:
            'Los kits de degustación convierten 2,3× más que las bolsas sueltas en tráfico frío (test de 2 semanas con 600 USD).',
          fuentes: ['Meta Ads Manager – test marzo', 'Encuesta post-compra (n=212)'],
        },
        2: {
          planPasoAPaso: [
            'Producir 6 creativos UGC con baristas',
            'Lanzar campaña Advantage+ con kit de degustación',
            'Retargeting a visitantes de 7 días',
            'Escalar 20 % semanal los conjuntos con CPA < 30 USD',
          ],
        },
        3: { responsable: 'Diego (Growth)', equipo: ['Agencia de paid media', 'Creadora UGC'] },
        4: {
          herramientas: [
            { nombre: 'Meta Ads Manager', costoMensual: 0 },
            { nombre: 'Triple Whale', costoMensual: 129 },
          ],
        },
        5: {
          riesgoPrincipal: 'Saturación de audiencia y fatiga creativa que eleva el CPA',
          mitigacion: 'Rotar creativos cada 10 días y abrir audiencias similares al 3 %',
          probabilidad: 4,
          impacto: 4,
        },
        6: {
          inversionEstimada: 0,
          desglose: [
            { concepto: 'Pauta (3 meses)', monto: 9000 },
            { concepto: 'Producción UGC', monto: 1500 },
            { concepto: 'Fee agencia', monto: 2400 },
          ],
        },
        7: {
          kpiExito: 'CPA de primer pedido',
          formulaMedicion: 'Inversión en pauta / pedidos nuevos atribuidos (ventana 7 días clic)',
          frecuencia: 'semanal',
        },
        8: { retornoEsperado: 19500, horizonteMeses: 3, roiProyectado: 0 },
      },
    }),
    base({
      nombre: 'Retargeting Meta a carritos abandonados',
      canal: 'Meta Ads',
      fechaInicio: d(14),
      estado: 'draft',
      mediciones: [],
      pasos: {
        1: {
          evidenciaJustifica:
            'Se abandonan 380 carritos/mes con ticket medio de 41 USD; el email de abandono recupera solo el 4 %.',
          fuentes: ['Shopify – checkouts abandonados'],
        },
        2: { planPasoAPaso: ['Crear audiencia de carritos 14 días', 'Anuncio dinámico de catálogo', ''] },
        3: { responsable: 'Diego (Growth)', equipo: [''] },
        4: { herramientas: [{ nombre: 'Catálogo Meta', costoMensual: 0 }] },
        5: {
          riesgoPrincipal: 'Saturación de audiencia pequeña y frecuencia excesiva',
          mitigacion: 'Tope de frecuencia 3/semana',
          probabilidad: 3,
          impacto: 2,
        },
        6: { inversionEstimada: 0, desglose: [{ concepto: 'Pauta (2 meses)', monto: 2400 }] },
        7: { kpiExito: '', formulaMedicion: '', frecuencia: '' },
        8: { retornoEsperado: 3100, horizonteMeses: 2, roiProyectado: 0 },
      },
    }),
    base({
      nombre: 'Colaboración con 5 microinfluencers de cafetería en casa',
      canal: 'Influencers',
      fechaInicio: d(5),
      estado: 'aprobada',
      mediciones: [],
      pasos: {
        1: {
          evidenciaJustifica:
            'Los códigos de 2 creadoras en 2025 trajeron 140 pedidos con 0 inversión en pauta; el engagement medio del nicho es 6 %.',
          fuentes: ['Histórico de cupones 2025', 'Modash – benchmark nicho café'],
        },
        2: {
          planPasoAPaso: [
            'Shortlist de 15 perfiles (10k-50k seguidores)',
            'Negociar fee + comisión del 10 %',
            'Enviar kit y guion abierto',
            'Publicación + stories con código único',
          ],
        },
        3: { responsable: 'Sofía (Marca)', equipo: ['Community manager'] },
        4: { herramientas: [{ nombre: 'Modash', costoMensual: 199 }] },
        5: {
          riesgoPrincipal: 'Contenido de baja calidad o saturación de audiencia con códigos de descuento',
          mitigacion: 'Aprobación previa del guion y un solo código por creadora',
          probabilidad: 3,
          impacto: 3,
        },
        6: {
          inversionEstimada: 0,
          desglose: [
            { concepto: 'Fees creadoras', monto: 4000 },
            { concepto: 'Producto y envíos', monto: 1800 },
          ],
        },
        7: {
          kpiExito: 'Pedidos con código de creadora',
          formulaMedicion: 'Suma de pedidos con códigos únicos / 5 creadoras',
          frecuencia: 'quincenal',
        },
        8: { retornoEsperado: 4900, horizonteMeses: 2, roiProyectado: 0 },
      },
    }),
    base({
      nombre: 'Programa de suscripción con envío gratis',
      canal: 'Web',
      fechaInicio: d(-120),
      estado: 'medida',
      mediciones: [
        { id: uid(), fecha: d(-90), valorKpi: 80, retornoReal: 4200, nota: 'Mes 1' },
        { id: uid(), fecha: d(-60), valorKpi: 145, retornoReal: 9800, nota: 'Mes 2' },
        { id: uid(), fecha: d(-30), valorKpi: 210, retornoReal: 16600, nota: 'Cierre del horizonte' },
      ],
      pasos: {
        1: {
          evidenciaJustifica:
            'El 38 % de los encuestados compraría cada mes si el envío fuese gratis; el LTV de suscriptores en la competencia es 3× mayor.',
          fuentes: ['Encuesta clientes (n=212)', 'Recharge – informe suscripciones 2026'],
        },
        2: {
          planPasoAPaso: [
            'Configurar planes 2 y 4 semanas en Recharge',
            'Landing de suscripción con calculadora de ahorro',
            'Email a base actual con primer mes -15 %',
            'Medir churn mensual',
          ],
        },
        3: { responsable: 'Laura (CRM)', equipo: ['Desarrollador Shopify'] },
        4: { herramientas: [{ nombre: 'Recharge', costoMensual: 99 }] },
        5: {
          riesgoPrincipal: 'Churn alto tras el primer mes por descuento agresivo',
          mitigacion: 'Descuento solo en el primer envío y encuesta de salida',
          probabilidad: 3,
          impacto: 4,
        },
        6: {
          inversionEstimada: 0,
          desglose: [
            { concepto: 'Desarrollo landing', monto: 2500 },
            { concepto: 'Subsidio de envíos', monto: 3600 },
            { concepto: 'Herramientas (Recharge)', monto: 300 },
          ],
        },
        7: {
          kpiExito: 'Suscriptores activos',
          formulaMedicion: 'Suscripciones activas al cierre de mes (Recharge)',
          frecuencia: 'mensual',
        },
        8: { retornoEsperado: 12000, horizonteMeses: 3, roiProyectado: 0 },
      },
    }),
  ];
}
