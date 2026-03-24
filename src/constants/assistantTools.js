/** Definiciones de herramientas para Chat Completions (function calling). */
export const ASSISTANT_TOOLS = [
  {
    type: "function",
    function: {
      name: "check_availability",
      description:
        "Consulta mesas libres por franjas (comida/cena) en una fecha concreta. Úsalo cuando el cliente pregunte por huecos o antes de confirmar una hora.",
      parameters: {
        type: "object",
        properties: {
          date: {
            type: "string",
            description: "Fecha en formato YYYY-MM-DD (zona horaria del restaurante).",
          },
        },
        required: ["date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_reservation",
      description:
        "Registra la reserva cuando tengas fecha, hora válida, comensales, nombre, teléfono y correo electrónico del cliente. Tras guardarla, el sistema puede enviar un email de confirmación. Comprueba disponibilidad antes si hay duda.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "YYYY-MM-DD" },
          time: { type: "string", description: "Hora local HH:mm (24h)." },
          party_size: { type: "integer", minimum: 1, maximum: 200 },
          customer_name: { type: "string" },
          customer_phone: { type: "string" },
          customer_email: {
            type: "string",
            description: "Email válido para la confirmación de la reserva.",
          },
        },
        required: [
          "date",
          "time",
          "party_size",
          "customer_name",
          "customer_phone",
          "customer_email",
        ],
      },
    },
  },
];
