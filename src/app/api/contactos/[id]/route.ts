import { NextResponse } from 'next/server';
import { verifyAuth, requireTenantId } from '@/lib/sri-api/auth-helper';
import { db } from '@/lib/sri-api/db';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth(req);
    const tenantId = requireTenantId(user);
    const { id } = await params;

    const contacto = await db.queryOne<any>(
      `SELECT c.id, c.tipo_identificacion, c.identificacion, c.razon_social,
              c.nombre_comercial, c.email, c.telefono, c.direccion,
              c.tipo_contribuyente_sri, c.obligado_contabilidad,
              c.agente_retencion, c.es_cliente, c.es_proveedor,
              c.activo, c.created_at, c.updated_at
       FROM contactos c
       WHERE c.id = $1 AND c.tenant_id = $2`,
      [id, tenantId]
    );

    if (!contacto) {
      return NextResponse.json(
        { message: `Contacto con ID ${id} no encontrado` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: {
        id: contacto.id,
        tipoIdentificacion: contacto.tipo_identificacion,
        identificacion: contacto.identificacion,
        razonSocial: contacto.razon_social,
        nombreComercial: contacto.nombre_comercial,
        email: contacto.email,
        telefono: contacto.telefono,
        direccion: contacto.direccion,
        tipoContribuyenteSri: contacto.tipo_contribuyente_sri,
        obligadoContabilidad: contacto.obligado_contabilidad,
        agenteRetencion: Boolean(contacto.agente_retencion),
        esCliente: Boolean(contacto.es_cliente),
        esProveedor: Boolean(contacto.es_proveedor),
        activo: Boolean(contacto.activo),
        createdAt: contacto.created_at,
        updatedAt: contacto.updated_at,
      },
    });
  } catch (error: any) {
    console.error('[Get Contacto Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno del servidor' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth(req);
    const tenantId = requireTenantId(user);
    const { id } = await params;
    const body = await req.json();

    const contacto = await db.queryOne(
      'SELECT id FROM contactos WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    if (!contacto) {
      return NextResponse.json(
        { message: `Contacto con ID ${id} no encontrado` },
        { status: 404 }
      );
    }

    const { razonSocial, nombreComercial, email, telefono, direccion,
            tipoContribuyenteSri, obligadoContabilidad, agenteRetencion,
            esCliente, esProveedor, activo } = body;

    const updates: Record<string, any> = {};
    if (razonSocial !== undefined) updates.razon_social = razonSocial;
    if (nombreComercial !== undefined) updates.nombre_comercial = nombreComercial;
    if (email !== undefined) updates.email = email;
    if (telefono !== undefined) updates.telefono = telefono;
    if (direccion !== undefined) updates.direccion = direccion;
    if (tipoContribuyenteSri !== undefined) updates.tipo_contribuyente_sri = tipoContribuyenteSri;
    if (obligadoContabilidad !== undefined) updates.obligado_contabilidad = obligadoContabilidad;
    if (agenteRetencion !== undefined) updates.agente_retencion = agenteRetencion;
    if (esCliente !== undefined) updates.es_cliente = esCliente;
    if (esProveedor !== undefined) updates.es_proveedor = esProveedor;
    if (activo !== undefined) updates.activo = activo;
    updates.updated_at = new Date();

    if (Object.keys(updates).length > 1) {
      await db.update('contactos', updates, 'id = $1', [id]);
    }

    const updated = await db.queryOne<any>(
      'SELECT * FROM contactos WHERE id = $1',
      [id]
    );

    return NextResponse.json({
      data: {
        id: updated.id,
        tipoIdentificacion: updated.tipo_identificacion,
        identificacion: updated.identificacion,
        razonSocial: updated.razon_social,
        nombreComercial: updated.nombre_comercial,
        email: updated.email,
        telefono: updated.telefono,
        direccion: updated.direccion,
        tipoContribuyenteSri: updated.tipo_contribuyente_sri,
        obligadoContabilidad: updated.obligado_contabilidad,
        agenteRetencion: Boolean(updated.agente_retencion),
        esCliente: Boolean(updated.es_cliente),
        esProveedor: Boolean(updated.es_proveedor),
        activo: Boolean(updated.activo),
        createdAt: updated.created_at,
        updatedAt: updated.updated_at,
      },
    });
  } catch (error: any) {
    console.error('[Put Contacto Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno del servidor' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth(req);
    const tenantId = requireTenantId(user);
    const { id } = await params;

    const contacto = await db.queryOne(
      'SELECT id FROM contactos WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    if (!contacto) {
      return NextResponse.json(
        { message: `Contacto con ID ${id} no encontrado` },
        { status: 404 }
      );
    }

    await db.query(
      'UPDATE contactos SET activo = false, updated_at = NOW() WHERE id = $1',
      [id]
    );

    return NextResponse.json({ message: 'Contacto desactivado correctamente' });
  } catch (error: any) {
    console.error('[Delete Contacto Error]', error);
    return NextResponse.json(
      { message: error.message || 'Error interno del servidor' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}
