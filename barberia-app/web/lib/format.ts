const pesos = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

// 10000 -> "$ 10.000"
export const peso = (n: number | null | undefined) => (n == null ? "" : pesos.format(n).replace(/ /g, " "));
