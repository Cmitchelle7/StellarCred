import { NextRequest, NextResponse } from 'next/server';
import { buildInputs } from '@/lib/witness-input';

// Timeout wrapper to prevent hanging on RPC calls
async function fetchWithTimeout(url: string, timeoutMs = 5000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

// Resolve current date from Stellar ledger close time
async function resolveCurrentDate(): Promise<string> {
  const rpcUrl = process.env.SOROBAN_RPC_URL;
  
  if (!rpcUrl) {
    throw new Error('SOROBAN_RPC_URL is not configured');
  }
  
  const response = await fetchWithTimeout(rpcUrl, 5000);
  
  if (!response.ok) {
    throw new Error(`RPC error: ${response.status}`);
  }
  
  const data = await response.json();
  const ledgerCloseTime = data.result?.closedAt || data.result?.closeTime;
  
  if (!ledgerCloseTime) {
    throw new Error('No ledger close time in RPC response');
  }
  
  // Convert to YYYY-MM-DD format
  return new Date(ledgerCloseTime).toISOString().split('T')[0];
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { credentials } = body;
    
    // Resolve date ONCE per request
    const currentDate = await resolveCurrentDate();
    
    // Pass date to buildInputs for all credentials
    const inputs = await Promise.all(
      credentials.map((cred: any) => buildInputs(cred, currentDate))
    );
    
    // ... rest of witness generation logic
    
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Ledger time fetch timeout' },
        { status: 504 }
      );
    }
    
    console.error('Witness generation failed:', error);
    return NextResponse.json(
      { error: 'Unable to resolve Stellar ledger time' },
      { status: 502 }
    );
  }
}