// Next.js API Route - Lemon Squeezy License Validation
// Deploy to Vercel at /api/validate-license

import type { NextApiRequest, NextApiResponse } from 'next';

interface LicenseValidationRequest {
  licenseKey: string;
}

interface LicenseValidationResponse {
  valid: boolean;
  status?: string;
  customerName?: string;
  expiresAt?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<LicenseValidationResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ valid: false });
  }

  try {
    const { licenseKey }: LicenseValidationRequest = req.body;

    if (!licenseKey) {
      return res.status(400).json({ valid: false });
    }

    // Development mode - accept test keys
    if (licenseKey.startsWith('DEV_') || licenseKey.startsWith('PREMIUM_')) {
      return res.status(200).json({
        valid: true,
        status: 'active',
        customerName: 'Development User',
        expiresAt: '2099-12-31'
      });
    }

    // Production: Validate with Lemon Squeezy API
    const lemonSqueezyApiKey = process.env.LEMON_SQUEEZY_API_KEY;
    
    if (!lemonSqueezyApiKey) {
      console.error('LEMON_SQUEEZY_API_KEY not configured');
      return res.status(500).json({ valid: false });
    }

    // Call Lemon Squeezy License API
    // https://docs.lemonsqueezy.com/api/license-keys
    const response = await fetch(
      `https://api.lemonsqueezy.com/v1/licenses/validate`,
      {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${lemonSqueezyApiKey}`
        },
        body: JSON.stringify({
          license_key: licenseKey
        })
      }
    );

    if (!response.ok) {
      return res.status(200).json({ valid: false });
    }

    const data = await response.json();

    // Check license status
    const isValid = 
      data.valid === true &&
      data.license_key?.status === 'active';

    if (isValid) {
      return res.status(200).json({
        valid: true,
        status: data.license_key.status,
        customerName: data.meta?.customer_name,
        expiresAt: data.license_key.expires_at
      });
    } else {
      return res.status(200).json({
        valid: false,
        status: data.license_key?.status
      });
    }

  } catch (error) {
    console.error('License validation error:', error);
    return res.status(500).json({ valid: false });
  }
}

// Environment variables needed:
// LEMON_SQUEEZY_API_KEY=your_api_key_here
