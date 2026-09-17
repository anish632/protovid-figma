// Share context describes acquisition origin, never the visitor's identity.
export function referralMetadata(source: string, share: {
  id: string;
  experimentVariant?: string | null;
} | null) {
  return {
    source,
    action: 'figma_install_clicked',
    attribution_version: 'anonymous_outbound_v2',
    ...(share ? {
      share_id: share.id,
      ...(share.experimentVariant ? { experiment_variant: share.experimentVariant } : {}),
    } : {}),
  };
}
