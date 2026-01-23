import { NextRequest, NextResponse } from 'next/server'
import { extractTokenFromHeader, verifyToken } from '@/lib/auth'

export function withAuth(handler: (req: NextRequest, context: any) => Promise<NextResponse>) {
  return async (req: NextRequest, context: any) => {
    try {
      const token = extractTokenFromHeader(req.headers.get('authorization'))

      if (!token) {
        return NextResponse.json(
          { error: 'Missing authorization token' },
          { status: 401 }
        )
      }

      const payload = verifyToken(token)

      if (!payload) {
        return NextResponse.json(
          { error: 'Invalid or expired token' },
          { status: 401 }
        )
      }

      // Attach user info to request for use in handler
      ;(req as any).user = payload

      return handler(req, context)
    } catch (error) {
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      )
    }
  }
}

export function withRole(...roles: string[]) {
  return (handler: (req: NextRequest, context: any) => Promise<NextResponse>) => {
    return async (req: NextRequest, context: any) => {
      const user = (req as any).user

      if (!user || !roles.includes(user.role)) {
        return NextResponse.json(
          { error: 'Insufficient permissions' },
          { status: 403 }
        )
      }

      return handler(req, context)
    }
  }
}
