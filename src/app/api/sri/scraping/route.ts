import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

export const dynamic = 'force-dynamic';
import mysql from 'mysql2/promise';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { ruc, clave_sri, fecha_desde, fecha_hasta, tipo_comprobante, action_type } = body;

    if (!ruc || !clave_sri || !fecha_desde || !fecha_hasta) {
      return NextResponse.json(
        { error: 'Faltan parámetros requeridos (RUC, clave, fecha_desde, fecha_hasta)' },
        { status: 400 }
      );
    }

    if (!tipo_comprobante) {
      return NextResponse.json(
        { error: 'El tipo de comprobante es obligatorio' },
        { status: 400 }
      );
    }
    const validTipos = ['1', '2', '3', '4', '6', 'todos'];
    if (!validTipos.includes(tipo_comprobante)) {
      return NextResponse.json(
        { error: 'Tipo de comprobante inválido' },
        { status: 400 }
      );
    }

    // Connect to database to queue the job
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'db_sri'
    });

    const finalActionType = action_type || 'DOWNLOAD_RECEIVED';
    const [result] = await connection.execute(
      `INSERT INTO scraping_jobs (ruc, clave_sri, fecha_desde, fecha_hasta, tipo_comprobante, status, action_type) VALUES (?, ?, ?, ?, ?, 'PENDING', ?)`,
      [ruc, clave_sri, fecha_desde, fecha_hasta, tipo_comprobante, finalActionType]
    );
    const jobId = (result as any).insertId;
    await connection.end();

    // Intentar iniciar el worker independiente (scripts/sri-worker.ts) en segundo plano
    try {
      const lockFilePath = path.resolve(process.cwd(), 'sri-worker.lock');
      let isRunning = false;

      if (fs.existsSync(lockFilePath)) {
        try {
          const existingPid = parseInt(fs.readFileSync(lockFilePath, 'utf8').trim(), 10);
          if (existingPid) {
            process.kill(existingPid, 0);
            isRunning = true;
          }
        } catch (e) {
          // El proceso no existe o es una cerradura huérfana
        }
      }

      if (!isRunning) {
        console.log('[API Scraping] Iniciando el worker SRI en segundo plano...');
        const isWin = process.platform === 'win32';
        const cmd = isWin ? 'npm.cmd' : 'npm';
        
        const child = spawn(cmd, ['run', 'worker:sri'], {
          cwd: path.resolve(process.cwd()),
          detached: true,
          stdio: 'ignore',
          shell: isWin
        });
        child.unref();
      } else {
        console.log('[API Scraping] El worker SRI ya se encuentra en ejecución.');
      }
    } catch (workerErr: any) {
      console.error('[API Scraping] Error al intentar iniciar el worker en segundo plano:', workerErr.message);
    }

    return NextResponse.json({
      success: true,
      message: 'Trabajo de descarga de SRI encolado y worker iniciado exitosamente',
      jobId,
    });

  } catch (error: any) {
    console.error('Error al encolar trabajo:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor al encolar la descarga.' },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'db_sri'
    });

    const [rows] = await connection.execute(
      `SELECT id, ruc, fecha_desde, fecha_hasta, tipo_comprobante, mes, anio, status, progress_message, created_at, updated_at FROM scraping_jobs ORDER BY created_at DESC LIMIT 20`
    );
    await connection.end();

    return NextResponse.json({ success: true, jobs: rows });
  } catch (error: any) {
    console.error('Error al obtener trabajos:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor al obtener la lista de trabajos.' },
      { status: 500 }
    );
  }
}
