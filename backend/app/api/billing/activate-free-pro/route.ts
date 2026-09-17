import { NextRequest, NextResponse } from 'next/server';
import { getSubscription, setSubscription } from '@/lib/storage';
import { recordEvent } from '@/lib/events';

// Secure activation tokens mapped to specific offers
// In production, these would be in a database with expiration times
const ACTIVATION_TOKENS: Record<string, {
  email: string;
  months: number;
  reason: string;
  expires: string;
}> = {
  'iva-feedback-thanks-3m-final': {
    email: 'iva@clarion.agency',
    months: 3,
    reason: 'feedback_appreciation',
    expires: '2026-07-09' // 30 days from offer date
  }
};

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token || !ACTIVATION_TOKENS[token]) {
    return NextResponse.json({ 
      error: 'Invalid or expired activation link' 
    }, { status: 400 });
  }

  const offer = ACTIVATION_TOKENS[token];
  
  // Check if token has expired
  if (new Date() > new Date(offer.expires)) {
    return NextResponse.json({ 
      error: 'This activation link has expired' 
    }, { status: 400 });
  }

  // Show activation page
  return new Response(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Activate Free ProtoVid Studio</title>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
          max-width: 600px; 
          margin: 40px auto; 
          padding: 20px; 
          line-height: 1.6; 
          background: #f9fafb;
        }
        .card { 
          background: white; 
          border-radius: 8px; 
          padding: 32px; 
          box-shadow: 0 1px 3px rgba(0,0,0,0.1); 
        }
        .btn { 
          background: #16a34a; 
          color: white; 
          border: none; 
          padding: 12px 24px; 
          border-radius: 6px; 
          font-size: 16px; 
          cursor: pointer; 
          width: 100%;
          margin: 16px 0;
        }
        .btn:hover { background: #15803d; }
        .btn:disabled { background: #9ca3af; cursor: not-allowed; }
        .success { color: #16a34a; font-weight: 600; }
        .error { color: #dc2626; font-weight: 600; }
        .details { background: #f3f4f6; padding: 16px; border-radius: 6px; margin: 16px 0; }
        .small { font-size: 14px; color: #6b7280; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>Activate Your Free ProtoVid Studio</h1>
        
        <p>Hi Iva! Thank you for your valuable feedback that helped improve ProtoVid for everyone.</p>
        
        <div class="details">
          <strong>Your Free Studio Offer:</strong><br>
          📧 Email: ${offer.email}<br>
          ⏱️ Duration: ${offer.months} months<br>
          📅 Expires: September 9, 2026<br>
          💰 Cost: Completely free<br>
        </div>
        
        <p><strong>What you'll get:</strong></p>
        <ul>
          <li>✨ Client-ready exports (no watermark)</li>
          <li>📺 HD (1080p) and 4K resolution options</li>
          <li>🚀 Unlimited prototype exports</li>
          <li>💼 Perfect for client presentations</li>
        </ul>
        
        <button class="btn" onclick="activatePro()">
          Activate 3 Months Free Studio Access
        </button>
        
        <div id="result"></div>
        
        <p class="small">
          <strong>How it works:</strong> Click the button above to activate Studio features for your email (${offer.email}).
          Open the ProtoVid plugin in Figma and you'll immediately see "Studio active" in the interface.
        </p>
        
        <p class="small">
          <strong>No strings attached:</strong> This is genuinely free with no automatic billing. 
          When it expires in 3 months, you'll simply revert to the free tier.
        </p>
      </div>

      <script>
        async function activatePro() {
          const btn = document.querySelector('.btn');
          const result = document.getElementById('result');
          
          btn.disabled = true;
          btn.textContent = 'Activating...';
          result.innerHTML = '';
          
          try {
            const response = await fetch('/api/billing/activate-free-pro?token=${token}', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' }
            });
            
            const data = await response.json();
            
            if (data.success) {
              result.innerHTML = \`
                <div class="success">
                  Success! Your Studio access is now active.
                  <div class="details">
                    <strong>Activated:</strong> ${offer.email}<br>
                    <strong>Expires:</strong> \${data.endDate}<br>
                    <strong>Status:</strong> Studio access active
                  </div>
                  <p>Open the ProtoVid plugin in Figma to start creating professional prototype videos!</p>
                </div>
              \`;
              btn.textContent = '✅ Activated Successfully';
              btn.style.background = '#16a34a';
            } else {
              throw new Error(data.error || 'Activation failed');
            }
          } catch (error) {
            result.innerHTML = \`
              <div class="error">
                ❌ \${error.message}
                <p class="small">Please contact support if this problem persists.</p>
              </div>
            \`;
            btn.disabled = false;
            btn.textContent = 'Try Again';
          }
        }
      </script>
    </body>
    </html>
  `, {
    headers: {
      'Content-Type': 'text/html',
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token || !ACTIVATION_TOKENS[token]) {
      return NextResponse.json({ 
        error: 'Invalid or expired activation link' 
      }, { status: 400 });
    }

    const offer = ACTIVATION_TOKENS[token];
    
    // Check if token has expired
    if (new Date() > new Date(offer.expires)) {
      return NextResponse.json({ 
        error: 'This activation link has expired' 
      }, { status: 400 });
    }

    // Check if already activated (optional - could allow re-activation)
    const subscription = await getSubscription(offer.email);
    if (subscription.tier === 'pro' && subscription.status === 'active') {
      // Allow re-activation to extend time
    }

    // Calculate end date (months from now)
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + offer.months);

    const previousTier = subscription.tier;
    const previousStatus = subscription.status;

    // Update subscription to Pro with specific end date
    await setSubscription(offer.email, {
      tier: 'pro',
      status: 'active',
      currentPeriodEnd: endDate.toISOString(),
      // Don't set Stripe IDs since this is a manual grant
      stripeSubscriptionId: undefined,
      stripeCustomerId: undefined,
    });

    // Record the activation event
    await recordEvent(offer.email, 'free_pro_activated_self_service', {
      source: 'activation_link',
      token: token,
      months_granted: offer.months,
      end_date: endDate.toISOString().slice(0, 10),
      previous_tier: previousTier,
      previous_status: previousStatus,
      reason: offer.reason
    });

    // Remove token after successful activation (one-time use)
    delete ACTIVATION_TOKENS[token];

    return NextResponse.json({
      success: true,
      message: `${offer.months} months free Studio access activated for ${offer.email}`,
      email: offer.email,
      endDate: endDate.toISOString().slice(0, 10),
      previousStatus: { tier: previousTier, status: previousStatus },
      newStatus: { tier: 'pro', status: 'active' },
    });

  } catch (error) {
    console.error('Self-service activation error:', error);
    return NextResponse.json({ 
      error: 'Failed to activate Studio access',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
