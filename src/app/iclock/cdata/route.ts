import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  console.log("=== BIOMETRIC MACHINE GET REQUEST ===")
  console.log("URL:", request.url)
  // Standard ADMS initialization response
  return new NextResponse("OK", { status: 200, headers: { 'Content-Type': 'text/plain' } })
}

export async function POST(request: Request) {
  console.log("=== BIOMETRIC MACHINE POST PUSH ===")
  console.log("URL:", request.url)
  const body = await request.text()
  console.log("PAYLOAD:", body)
  
  // Standard ADMS success response
  return new NextResponse("OK", { status: 200, headers: { 'Content-Type': 'text/plain' } })
}
