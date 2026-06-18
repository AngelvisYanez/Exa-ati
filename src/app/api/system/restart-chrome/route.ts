import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

export const dynamic = 'force-dynamic';

export async function POST() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ success: false, error: 'Solo disponible en desarrollo' }, { status: 403 });
  }

  const scriptPath = path.resolve(process.cwd(), 'scripts/chrome-debug-restart.ps1');
  if (!fs.existsSync(scriptPath)) {
    return NextResponse.json({ success: false, error: 'Script no encontrado' }, { status: 500 });
  }

  try {
    const proc = spawn('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-File', scriptPath,
    ], {
      detached: true,
      stdio: 'ignore',
    });
    proc.unref();

    return NextResponse.json({
      success: true,
      message: 'Reiniciando Chrome con puerto de depuración...',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
