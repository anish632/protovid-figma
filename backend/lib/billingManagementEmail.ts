const DEFAULT_SUPPORT_EMAIL = 'support@protovid.app';

export interface BillingManagementEmailConfig {
  apiKey: string;
  from: string;
  appUrl: string;
  supportEmail: string;
}

export function getBillingManagementEmailConfig(
  env: NodeJS.ProcessEnv = process.env
): BillingManagementEmailConfig | null {
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.BILLING_MANAGEMENT_EMAIL_FROM?.trim();
  const appUrl = env.NEXT_PUBLIC_APP_URL?.trim();

  if (!apiKey || !from || !appUrl) {
    return null;
  }

  return {
    apiKey,
    from,
    appUrl: appUrl.replace(/\/$/, ''),
    supportEmail: env.BILLING_SUPPORT_EMAIL?.trim() || DEFAULT_SUPPORT_EMAIL,
  };
}

export async function sendBillingManagementLink({
  email,
  managementToken,
  config = getBillingManagementEmailConfig(),
}: {
  email: string;
  managementToken: string;
  config?: BillingManagementEmailConfig | null;
}): Promise<void> {
  if (!config) {
    throw new Error('Secure billing email links are not configured');
  }

  const managementUrl = `${config.appUrl}/account/manage?token=${encodeURIComponent(managementToken)}`;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: config.from,
      to: [email],
      subject: 'Manage your ProtoVid subscription',
      html: [
        '<p>Use this secure link to manage your ProtoVid subscription in Stripe.</p>',
        `<p><a href="${managementUrl}">Manage subscription</a></p>`,
        '<p>This link expires in 15 minutes. If you did not request it, you can ignore this email.</p>',
        `<p>Need help? <a href="mailto:${config.supportEmail}">${config.supportEmail}</a></p>`,
      ].join(''),
    }),
  });

  if (!response.ok) {
    throw new Error('Could not send secure billing email link');
  }
}

export function getBillingSupportEmail(env: NodeJS.ProcessEnv = process.env): string {
  return env.BILLING_SUPPORT_EMAIL?.trim() || DEFAULT_SUPPORT_EMAIL;
}
