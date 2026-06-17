import { NextResponse } from 'next/server';
import { existsSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import * as forge from 'node-forge';
import { verifyAuth } from '@/lib/sri-api/auth-helper';
import { db } from '@/lib/sri-api/db';
import { config } from '@/lib/sri-api/config';
import { encryption } from '@/lib/sri-api/encryption';
import { xmlSigner } from '@/lib/sri-api/xml-signer';

export async function POST(req: Request) {
  let tempFilePath: string | null = null;

  try {
    const user = await verifyAuth(req);

    // Parsear el multipart form data
    const formData = await req.formData();
    const file = formData.get('cert') as File | null;
    const password = formData.get('password') as string | null;
    const ruc = formData.get('ruc') as string | null;

    if (!file) {
      return NextResponse.json(
        { message: 'No se proporcionó ningún archivo de certificado' },
        { status: 400 }
      );
    }

    if (!password) {
      return NextResponse.json(
        { message: 'Se requiere la contraseña del certificado para validar su vigencia' },
        { status: 400 }
      );
    }

    // Validar acceso si se proporciona RUC
    if (ruc && user.rol !== 'SUPERADMIN') {
      const emisorCheck = await db.queryOne(
        'SELECT id, tenant_id FROM emisores WHERE ruc = ? AND activo = true',
        [ruc]
      );
      if (!emisorCheck || emisorCheck.tenant_id !== user.tenantId) {
        return NextResponse.json(
          { message: 'Acceso denegado a este emisor' },
          { status: 403 }
        );
      }
    }

    // Guardar el archivo temporalmente / permanentemente en la carpeta certs
    const buffer = Buffer.from(await file.arrayBuffer());
    const certsDir = config.directories.certs;
    const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = join(certsDir, sanitizedFilename);
    tempFilePath = filePath;

    writeFileSync(filePath, buffer);

    // Extraer y validar info del certificado P12
    let certInfo: { expiryDate: Date; startDate: Date; subjectName: string };
    try {
      certInfo = extractCertInfo(buffer, password);
    } catch (err: any) {
      // Si la validación de node-forge falla (p.ej. contraseña incorrecta)
      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }
      return NextResponse.json(
        { message: `Certificado inválido o contraseña incorrecta: ${err.message}` },
        { status: 400 }
      );
    }

    const now = new Date();
    if (now > certInfo.expiryDate) {
      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }
      return NextResponse.json(
        { message: `El certificado está expirado desde el ${certInfo.expiryDate.toLocaleDateString()}` },
        { status: 400 }
      );
    }

    if (now < certInfo.startDate) {
      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }
      return NextResponse.json(
        { message: `El certificado aún no está vigente (válido desde el ${certInfo.startDate.toLocaleDateString()})` },
        { status: 400 }
      );
    }

    const daysUntilExpiry = Math.ceil(
      (certInfo.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    const responseData: any = {
      message: 'Certificado subido y validado correctamente',
      fileName: sanitizedFilename,
      size: file.size,
      validation: {
        isValid: true,
        expiryDate: certInfo.expiryDate.toISOString(),
        daysUntilExpiry,
        subject: certInfo.subjectName,
      }
    };

    // Vincular al emisor en base de datos si se provee el RUC
    if (ruc) {
      const emisor = await db.queryOne(
        'SELECT id FROM emisores WHERE ruc = ? AND activo = true',
        [ruc]
      );

      if (!emisor) {
        if (existsSync(filePath)) {
          unlinkSync(filePath);
        }
        return NextResponse.json(
          { message: `No existe emisor con RUC ${ruc}` },
          { status: 404 }
        );
      }

      // Encriptar contraseña
      const passwordEncrypted = await encryption.encrypt(password);

      // Guardar en base de datos
      await db.query(
        `UPDATE emisores SET 
          certificado_p12 = ?,
          password_certificado = ?,
          cert_valido_hasta = ?,
          cert_valido_desde = ?,
          updated_at = NOW()
        WHERE ruc = ? AND activo = true`,
        [
          buffer,
          passwordEncrypted,
          certInfo.expiryDate.toISOString().split('T')[0],
          certInfo.startDate.toISOString().split('T')[0],
          ruc,
        ]
      );

      writeFileSync(join(certsDir, `${ruc}.p12`), buffer);

      // Limpiar caché en el XmlSigner
      xmlSigner.clearEmisorCache(ruc);

      responseData.emisorBinding = {
        ruc,
        message: 'Certificado vinculado al emisor correctamente',
      };
    }

    return NextResponse.json({
      success: true,
      data: responseData,
    });
  } catch (error: any) {
    console.error('[Upload Cert Error]', error);
    // Intentar borrar archivo temporal si existe
    if (tempFilePath && existsSync(tempFilePath)) {
      try {
        unlinkSync(tempFilePath);
      } catch {}
    }

    return NextResponse.json(
      { message: error.message || 'Error interno del servidor al procesar el certificado' },
      { status: error.message?.startsWith('No autorizado') ? 401 : 500 }
    );
  }
}

// Función auxiliar usando node-forge para parsear y validar P12
function extractCertInfo(p12Buffer: Buffer, password: string) {
  const p12Der = forge.util.createBuffer(p12Buffer.toString('binary'));
  const p12Asn1 = forge.asn1.fromDer(p12Der);
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);

  let signingCert: forge.pki.Certificate | null = null;

  p12.safeContents.forEach((safeContent) => {
    safeContent.safeBags.forEach((safeBag) => {
      if (safeBag.type === forge.pki.oids.certBag && safeBag.cert) {
        if (!signingCert) {
          signingCert = safeBag.cert;
        } else {
          const isCA =
            safeBag.cert.extensions &&
            safeBag.cert.extensions.some(
              (ext: any) => ext.name === 'basicConstraints' && ext.cA === true
            );
          if (!isCA) {
            signingCert = safeBag.cert;
          }
        }
      }
    });
  });

  if (!signingCert) {
    throw new Error('No se pudo extraer el certificado del archivo P12');
  }

  const subject = (signingCert as forge.pki.Certificate).subject;
  const startDate = (signingCert as forge.pki.Certificate).validity.notBefore;
  const expiryDate = (signingCert as forge.pki.Certificate).validity.notAfter;

  const subjectName = subject.attributes
    .map((attr) => `${attr.shortName || attr.name}=${attr.value}`)
    .join(', ');

  return {
    expiryDate,
    startDate,
    subjectName,
  };
}
