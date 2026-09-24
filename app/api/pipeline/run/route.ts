import { NextResponse } from 'next/server';
import { execSync } from 'child_process';
import path from 'path';

export async function POST() {
  try {
    const pipelinePath = path.join(process.cwd(), 'scripts', 'pipeline.ts');
    const tsxPath = path.join(process.cwd(), 'node_modules', '.bin', 'tsx');
    execSync(`"${tsxPath}" "${pipelinePath}"`, {
      cwd: process.cwd(),
      timeout: 60000,
      stdio: 'pipe',
    });
    return NextResponse.json({ ok: true, message: 'Pipeline run completed' });
  } catch (err) {
    console.error('Pipeline run error:', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
