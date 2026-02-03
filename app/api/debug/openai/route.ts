import { NextRequest, NextResponse } from 'next/server'

// Debug endpoint (safe): returns whether OPENAI_API_KEY is set and which model is configured.
// WARNING: this endpoint intentionally does NOT return the secret value itself.
// Only enabled in non-production environments to avoid accidental exposure.
export const GET = (req: NextRequest) => {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not allowed in production' }, { status: 403 })
  }

  return NextResponse.json({
    openaiKeySet: !!process.env.OPENAI_API_KEY,
    openaiModel: process.env.OPENAI_MODEL || null,
    nodeEnv: process.env.NODE_ENV || null,
  })
}
