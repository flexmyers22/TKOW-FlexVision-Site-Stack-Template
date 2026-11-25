import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { ADMIN_ACCESS_COOKIE, hasAdminAccessCookie } from './lib/server/admin-access'
import { PROFILE_ACCESS_COOKIE, hasProfileAccessCookie } from './lib/server/session-gate'

const PRODUCT_PAYMENT = 'https://weparlay.us/brands/product-inventory'

export function proxy(request: NextRequest) {
  const open = hasProfileAccessCookie(request.cookies.get(PROFILE_ACCESS_COOKIE)?.value)
  const admin = hasAdminAccessCookie(request.cookies.get(ADMIN_ACCESS_COOKIE)?.value)
  const { pathname } = request.nextUrl
  if (pathname === '/product-payment') {
    return NextResponse.redirect(PRODUCT_PAYMENT)
  }
  const localWorkbench = pathname === '/admin' || pathname === '/edit-page-content.html' || pathname === '/product-workspace' || pathname.startsWith('/product-workspace/') || pathname === '/opencv-workbench' || pathname.startsWith('/opencv-workbench/') || pathname === '/digital-twin' || pathname.startsWith('/digital-twin/')
  if (localWorkbench && !admin) {
    return NextResponse.redirect(new URL('/admin/sign-in', request.url))
  }
  if (pathname === '/opencv-workbench' || pathname === '/opencv-workbench/') {
    return NextResponse.redirect(new URL('/opencv-workbench/index.html', request.url))
  }
  if (pathname === '/digital-twin' || pathname === '/digital-twin/') {
    return NextResponse.redirect(new URL('/admin#twin', request.url))
  }
  if (pathname === '/newsletter/unsubscribe') return NextResponse.next()
  if (!open && (pathname.startsWith('/ai-chat') || (pathname.startsWith('/newsletter') && !admin))) {
    return NextResponse.redirect(new URL('/profile', request.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/ai-chat/:path*', '/newsletter/:path*', '/product-payment', '/admin', '/edit-page-content.html', '/product-workspace', '/product-workspace/:path*', '/opencv-workbench', '/opencv-workbench/:path*', '/digital-twin', '/digital-twin/:path*'],
}
