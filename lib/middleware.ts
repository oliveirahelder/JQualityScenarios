import { NextRequest, NextResponse } from 'next/server'
import { extractTokenFromHeader, verifyToken } from '@/lib/auth'

type RouteContext = { params?: Record<string, string> }
type AuthedRequest = NextRequest & { user?: ReturnType<typeof verifyToken> }

export function withAuth(
  handler: (req: AuthedRequest, context: RouteContext) => Promise<NextResponse>
) {
  return async (req: AuthedRequest, context: RouteContext) => {
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
      req.user = payload

      return handler(req, context)
    } catch {
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      )
    }
  }
}

export function withRole(...roles: string[]) {
  return (handler: (req: AuthedRequest, context: RouteContext) => Promise<NextResponse>) => {
    return async (req: AuthedRequest, context: RouteContext) => {
      const user = req.user

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
