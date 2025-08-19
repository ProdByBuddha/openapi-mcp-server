import { z } from 'zod';
import { makeHttpRequest } from './http-client';

function jsonSchemaToZod(schema: any): any {
  const t: any = { string: z.string, number: z.number, integer: z.number, boolean: z.boolean, object: z.object, array: z.array };
  if (!schema || (!schema.type && !schema.anyOf && !schema.oneOf)) return z.any();
  if (schema.anyOf) return z.union(schema.anyOf.map(jsonSchemaToZod));
  if (schema.oneOf) return z.union(schema.oneOf.map(jsonSchemaToZod));
  const zt = t[schema.type]; if (!zt) return z.any();
  if (schema.type === 'object') {
    const shape: any = {}; const req = new Set(Array.isArray(schema.required)?schema.required:[]);
    if (schema.properties) for (const k in schema.properties){ let p=jsonSchemaToZod(schema.properties[k]); if(!req.has(k)) p=p.optional(); shape[k]=p; }
    return zt(shape);
  }
  if (schema.type === 'array') { return zt(schema.items?jsonSchemaToZod(schema.items):z.any()); }
  let zs: any = zt();
  if (schema.description) zs = zs.describe(schema.description);
  if (schema.minLength) zs = zs.min(schema.minLength);
  if (schema.maxLength) zs = zs.max(schema.maxLength);
  if (schema.minimum) zs = zs.gte(schema.minimum);
  if (schema.maximum) zs = zs.lte(schema.maximum);
  if (schema.enum) zs = Array.isArray(schema.enum) && schema.enum.every((v:any)=>typeof v==='string') ? z.enum(schema.enum as any) : z.union((schema.enum||[]).map((v:any)=>z.literal(v)));
  return zs;
}

export const tools = <%= tools %> as const;

export type ToolName = typeof tools[number]['name'];
