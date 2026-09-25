const { z } = require('zod');
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
const name = z.string().trim().min(2).max(100);
const email = z.email().trim().toLowerCase().max(150);
const phone = z.string().regex(/^\d{10}$/);
const password = z.string().min(12).max(128).refine((value) => value.trim().length >= 12);
const role = z.enum(['Administrador', 'Usuario']);
const date = z.iso.date().refine((value) => value >= '2000-01-01' && value <= today(), 'La fecha debe estar entre el año 2000 y hoy.');
const schemas = {
  login: z.object({ email, password: z.string().min(1).max(128) }).strict(),
  setup: z.object({ name, email, password, setupToken: z.string().min(1).max(200) }).strict(),
  user: z.object({ name, email, password, role }).strict(),
  userUpdate: z.object({ name, email, password: password.optional(), role }).strict(),
  state: z.object({ active: z.boolean() }).strict(),
  profile: z.object({ name, phone }).strict(),
  donor: z.object({ name, email, phone, person: z.enum(['Persona física','Persona moral']), ownerId: z.string().min(1).nullable(), taxId: z.string().trim().optional(), zipCode: z.string().trim().optional(), taxRegime: z.string().trim().optional() }).strict(),
  donation: z.object({ donorId: z.string().min(1).optional(), type: z.enum(['Efectivo','Especie']), amount: z.number().positive().max(999999999.99).optional(), description: z.string().trim().max(200).optional(), date, notes: z.string().trim().max(1000).default('') }).strict().superRefine((value, ctx) => {
    if (value.type === 'Efectivo' && (!value.amount || Math.abs(value.amount * 100 - Math.round(value.amount * 100)) > 0.001)) ctx.addIssue({ code: 'custom', message: 'Ingresa una cantidad positiva con máximo dos decimales.', path: ['amount'] });
    if (value.type === 'Especie' && !value.description) ctx.addIssue({ code: 'custom', message: 'Describe la aportación en especie.', path: ['description'] });
  })
};

function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ error: 'Revisa los datos del formulario.', fields: result.error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message })) });
    req.validated = result.data;
    next();
  };
}

module.exports = { schemas, validate, today };
