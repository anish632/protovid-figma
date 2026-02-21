import { NextRequest, NextResponse } from 'next/server';

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 });
}

export async function POST(request: NextRequest) {
  try {
    const { licenseKey } = await request.json();

    if (!licenseKey) {
      return NextResponse.json({ valid: false }, { status: 400 });
    }

    // Development mode - accept test keys
    if (licenseKey.startsWith('DEV_') || licenseKey.startsWith('PREMIUM_')) {
      return NextResponse.json({
        valid: true,
        status: 'active',
        customerName: 'Development User',
        expiresAt: '2099-12-31',
      });
    }

    // Production: Validate with Lemon Squeezy API
    const apiKey = process.env.LEMON_SQUEEZY_API_KEY;
    if (!apiKey) {
      console.error('LEMON_SQUEEZY_API_KEY not configured');
      return NextResponse.json({ valid: false }, { status: 500 });
    }

    const response = await fetch('https://api.lemonsqueezy.com/v1/licenses/validate', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ license_key: licenseKey }),
    });

    if (!response.ok) {
      return NextResponse.json({ valid: false });
    }

    const data = await response.json();
    const isValid = data.valid === true && data.license_key?.status === 'active';

    return NextResponse.json({
      valid: isValid,
      status: data.license_key?.status,
      customerName: data.meta?.customer_name,
      expiresAt: data.license_key?.expires_at,
    });
  } catch (error) {
    console.error('License validation error:', error);
    return NextResponse.json({ valid: false }, { status: 500 });
  }
}
