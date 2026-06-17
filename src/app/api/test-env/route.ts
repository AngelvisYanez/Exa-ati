import { NextResponse } from 'next/server';
import { config } from '@/lib/sri-api/config';

export async function GET() {
  return NextResponse.json({
    proxy: process.env.SRI_PROXY_HOST,
    reception: config.sri.wsdl.reception,
    authorization: config.sri.wsdl.authorization,
    rawReception: process.env.SRI_RECEPTION_WSDL,
    rawAuthorization: process.env.SRI_AUTHORIZATION_WSDL,
  });
}
