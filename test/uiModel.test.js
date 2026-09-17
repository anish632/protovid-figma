const test = require('node:test');
const assert = require('node:assert/strict');
const {
  EXPORT_PROGRESS_STAGES,
  createExportRequestGate,
  finishExportRequest,
  getExportProgressModel,
  getExperimentPrimaryPlan,
  getExportSummaryCopy,
  getRecommendedPathId,
  getPrimaryActionModel,
  getProgressStage,
  getRecoverableErrorModel,
  getRemainingExportsCopy,
  getResolutionOptions,
  getResolutionSelection,
  getRestoreResultModel,
  getShareExperimentVariant,
  getSuccessActions,
  mapCaptureProgressToOverall,
  mapEncoderProgressToOverall,
  mapPluginProgressToOverall,
  parseVoiceCommand,
  requestExport,
} = require('../dist/uiModel.js');

test('paid-offer experiment honors Project Pass only when it is available', () => {
  assert.equal(getExperimentPrimaryPlan('large_export', true), 'large_export');
  assert.equal(getExperimentPrimaryPlan('large_export', false), 'monthly');
  assert.equal(getExperimentPrimaryPlan('monthly', true), 'monthly');
});

test('reviewer invitation loop ships to every completed share', () => {
  assert.equal(getShareExperimentVariant('pv_user_123'), 'invite_panel');
  assert.equal(getShareExperimentVariant(null), 'invite_panel');
});

test('recommended path prefers the shortest reliable route', () => {
  assert.equal(getRecommendedPathId([
    { id: 'long', frameCount: 12, preflightStatus: 'long_path', truncated: false },
    { id: 'short', frameCount: 4, preflightStatus: 'ready', truncated: false },
    { id: 'loop', frameCount: 2, preflightStatus: 'ready', truncated: true },
  ]), 'short');
  assert.equal(getRecommendedPathId([
    { id: 'fallback', frameCount: 9, preflightStatus: 'split_recommended', truncated: false },
  ]), 'fallback');
  assert.equal(getRecommendedPathId([{ id: 'loop', frameCount: 2, preflightStatus: 'ready', truncated: true }]), null);
});

test('voice commands map spoken phrases to existing app actions', () => {
  assert.deepEqual(parseVoiceCommand('set resolution to 1080p'), {
    type: 'set-resolution',
    resolution: '1080p',
  });
  assert.deepEqual(parseVoiceCommand('export the video'), { type: 'export' });
  assert.deepEqual(parseVoiceCommand('download MP4'), { type: 'download' });
  assert.deepEqual(parseVoiceCommand('share it'), { type: 'share' });
  assert.deepEqual(parseVoiceCommand('select path second'), { type: 'select-path', index: 1 });
  assert.deepEqual(parseVoiceCommand('refresh flow'), { type: 'refresh' });
  assert.equal(parseVoiceCommand('something unrelated'), null);
});

test('Free resolution options identify Pro restrictions without disabling selection', () => {
  const options = getResolutionOptions('free');

  assert.deepEqual(options.map(({ value, availability, badge, isSelectable }) => ({
    value,
    availability,
    badge,
    isSelectable,
  })), [
    { value: '720p', availability: 'included', badge: null, isSelectable: true },
    { value: '1080p', availability: 'requires-pro', badge: 'Studio', isSelectable: true },
    { value: '4K', availability: 'requires-pro', badge: 'Studio', isSelectable: true },
  ]);
});

test('Pro includes every resolution', () => {
  const options = getResolutionOptions('pro');

  assert.equal(options.every(option => option.availability === 'included'), true);
  assert.equal(options.every(option => option.badge === null), true);
  assert.equal(getResolutionSelection('1080p', 'pro').canExport, true);
  assert.equal(getResolutionSelection('4K', 'pro').requiresUpgrade, false);
});

test('Free users can select a Pro resolution and receive an upgrade explanation', () => {
  const selection = getResolutionSelection('1080p', 'free');

  assert.deepEqual(selection, {
    resolution: '1080p',
    canExport: false,
    requiresUpgrade: true,
    message: '1080p is available with Project Pass or Studio for a clean, client-ready export.',
  });
});

test('remaining-export copy handles plural, singular, limit, invalid, and Pro states', () => {
  assert.equal(getRemainingExportsCopy(3), '3 free exports remaining this month');
  assert.equal(getRemainingExportsCopy(1), '1 free export remaining this month');
  assert.equal(getRemainingExportsCopy(0), 'No free exports remaining this month');
  assert.equal(getRemainingExportsCopy(-4), 'No free exports remaining this month');
  assert.equal(getRemainingExportsCopy(Number.NaN), 'No free exports remaining this month');
  assert.equal(getRemainingExportsCopy(0, 'pro'), 'Unlimited exports included');
});

test('primary action uses the requested Free and Pro copy', () => {
  assert.deepEqual(getPrimaryActionModel({
    plan: 'free',
    resolution: '720p',
    remainingExports: 3,
  }), {
    label: 'Export free proof',
    supportingText: '720p with ProtoVid watermark',
    intent: 'export',
    disabled: false,
  });

  assert.deepEqual(getPrimaryActionModel({
    plan: 'pro',
    resolution: '4K',
    remainingExports: 0,
  }), {
    label: 'Export client-ready video',
    supportingText: '4K without a watermark',
    intent: 'export',
    disabled: false,
  });
});

test('successful export keeps file download as the primary action', () => {
  assert.deepEqual(getSuccessActions(true).slice(0, 2), [
    { id: 'download', label: 'Download file', priority: 'primary', enabled: true },
    { id: 'share', label: 'Create approval link', priority: 'secondary', enabled: true },
  ]);
});

test('primary action turns a selected Pro resolution into an explicit upgrade action', () => {
  const action = getPrimaryActionModel({
    plan: 'free',
    resolution: '1080p',
    remainingExports: 2,
  });

  assert.deepEqual(action, {
    label: 'Export client-ready 1080p',
    supportingText: 'HD/4K video without a watermark. Choose seven-day access or monthly exports.',
    intent: 'upgrade',
    disabled: false,
  });
});

test('free-limit state remains actionable instead of ambiguously disabled', () => {
  const action = getPrimaryActionModel({
    plan: 'free',
    resolution: '720p',
    remainingExports: 0,
  });

  assert.equal(action.label, 'Export client-ready video');
  assert.equal(action.intent, 'upgrade');
  assert.equal(action.disabled, false);
  assert.match(action.supportingText, /all free exports/i);
});

test('loading, exporting, and missing-flow actions communicate the next state', () => {
  assert.deepEqual(getPrimaryActionModel({
    plan: 'free',
    resolution: '720p',
    remainingExports: null,
  }), {
    label: 'Checking allowance…',
    supportingText: 'This usually takes only a moment.',
    intent: 'wait',
    disabled: true,
  });

  assert.equal(getPrimaryActionModel({
    plan: 'pro',
    resolution: '1080p',
    remainingExports: 0,
    isExporting: true,
  }).label, 'Creating export…');

  const refresh = getPrimaryActionModel({
    plan: 'free',
    resolution: '720p',
    remainingExports: 2,
    flowReady: false,
  });
  assert.equal(refresh.intent, 'refresh');
  assert.equal(refresh.disabled, false);
});

test('export summary reflects plan, watermark, and optional estimates', () => {
  assert.equal(getExportSummaryCopy({
    plan: 'free',
    resolution: '720p',
  }), 'MP4 · 720p · Free proof · Watermark included');

  assert.equal(getExportSummaryCopy({
    plan: 'pro',
    resolution: '1080p',
    estimatedDuration: '12 sec',
    estimatedSize: '8 MB',
  }), 'MP4 · 1080p · Client-ready · No watermark · 12 sec · 8 MB');

  assert.equal(getExportSummaryCopy({
    plan: 'free',
    resolution: '4K',
  }), 'MP4 · 4K · Studio required · No watermark');

  assert.equal(getExportSummaryCopy({
    plan: 'pro',
    resolution: '1080p',
    format: 'webm',
  }), 'WEBM · 1080p · Client-ready · No watermark');

  assert.equal(getExportSummaryCopy({
    plan: 'free',
    resolution: '720p',
    format: 'gif',
  }), 'GIF · 720p · Free proof · Watermark included');
});

test('progress maps boundaries and out-of-range values across four named stages', () => {
  assert.deepEqual(EXPORT_PROGRESS_STAGES.map(stage => stage.label), [
    'Preparing frames',
    'Rendering transitions',
    'Encoding file',
    'Finalizing download',
  ]);
  assert.equal(getProgressStage(-10).id, 'preparing');
  assert.equal(getProgressStage(24).id, 'preparing');
  assert.equal(getProgressStage(25).id, 'rendering');
  assert.equal(getProgressStage(59).id, 'rendering');
  assert.equal(getProgressStage(60).id, 'encoding');
  assert.equal(getProgressStage(89).id, 'encoding');
  assert.equal(getProgressStage(90).id, 'finalizing');
  assert.equal(getProgressStage(150).id, 'finalizing');
});

test('progress model exposes current, completed, and upcoming steps', () => {
  const model = getExportProgressModel(64.4);

  assert.equal(model.percent, 64);
  assert.equal(model.currentStage.id, 'encoding');
  assert.deepEqual(model.steps.map(step => step.status), [
    'complete',
    'complete',
    'current',
    'upcoming',
  ]);
});

test('encoder progress maps into the final export range without moving backwards', () => {
  assert.equal(mapEncoderProgressToOverall(0, 60), 60);
  assert.equal(mapEncoderProgressToOverall(50, 60), 78);
  assert.equal(mapEncoderProgressToOverall(100, 60), 96);
  assert.equal(mapEncoderProgressToOverall(20, 82), 82);
});

test('capture progress advances through the early export range without jumping ahead', () => {
  assert.equal(mapCaptureProgressToOverall(0, 0), 0);
  assert.equal(mapCaptureProgressToOverall(10, 0), 4);
  assert.equal(mapCaptureProgressToOverall(20, 0), 8);
  assert.equal(mapCaptureProgressToOverall(40, 8), 16);
  assert.equal(mapCaptureProgressToOverall(60, 16), 24);
  assert.equal(mapCaptureProgressToOverall(100, 24), 24);
});

test('real plugin progress stays monotonic while matching the active work stage', () => {
  let overall = mapPluginProgressToOverall('analyzing', 5, 0);
  assert.equal(overall, 2);
  overall = mapPluginProgressToOverall('capturing', 20, overall);
  assert.equal(overall, 8);
  overall = mapPluginProgressToOverall('capturing', 60, overall);
  assert.equal(overall, 24);
  overall = mapPluginProgressToOverall('rendering', 25, overall);
  assert.equal(overall, 25);
  overall = mapPluginProgressToOverall('rendering', 55, overall);
  assert.equal(overall, 55);
  overall = mapEncoderProgressToOverall(0, overall);
  assert.equal(overall, 60);
});

test('export request gate prevents duplicate and overlapping requests', () => {
  const idle = createExportRequestGate();
  const first = requestExport(idle, 'attempt-1');
  const duplicate = requestExport(first.gate, 'attempt-1');
  const overlapping = requestExport(first.gate, 'attempt-2');

  assert.equal(first.accepted, true);
  assert.equal(duplicate.accepted, false);
  assert.equal(duplicate.reason, 'duplicate');
  assert.equal(overlapping.accepted, false);
  assert.equal(overlapping.reason, 'in-progress');
  assert.strictEqual(duplicate.gate, first.gate);
});

test('export request gate releases only the active attempt', () => {
  const active = requestExport(createExportRequestGate(), 'attempt-1').gate;

  assert.strictEqual(finishExportRequest(active, 'stale-attempt'), active);
  const idle = finishExportRequest(active, 'attempt-1');
  assert.equal(idle.activeRequestId, null);
  assert.equal(requestExport(idle, 'attempt-2').accepted, true);
  assert.equal(requestExport(idle, '   ').reason, 'invalid-request');
});

test('recoverable errors explain safety and a concrete recovery action', () => {
  assert.deepEqual(getRecoverableErrorModel('offline'), {
    code: 'offline',
    title: 'You appear to be offline',
    message: 'Reconnect and try again.',
    reassurance: 'Your selected flow and settings are still available.',
    primaryAction: 'Try again',
    secondaryAction: null,
  });

  const invalidFlow = getRecoverableErrorModel({ code: 'broken-interaction-path' });
  assert.equal(invalidFlow.code, 'invalid-flow');
  assert.equal(invalidFlow.primaryAction, 'Review flow');
  assert.match(invalidFlow.reassurance, /still available/i);
  assert.equal(getRecoverableErrorModel('This prototype path changed since it was scanned. Scan again and choose a current path.').code, 'invalid-flow');
  assert.equal(getRecoverableErrorModel('Could not capture a frame with visible content.').code, 'unsupported-content');
  assert.equal(getRecoverableErrorModel('This prototype is too large for MP4 fallback.').code, 'flow-too-large');
});

test('unknown diagnostics are mapped to safe copy without exposing backend details', () => {
  const secretDiagnostic = 'ffmpeg exploded at /private/server/path with token=secret';
  const model = getRecoverableErrorModel(new Error(secretDiagnostic));

  assert.equal(model.code, 'export-failed');
  assert.equal(model.title, 'Export could not be completed');
  assert.equal(model.primaryAction, 'Try again');
  assert.equal(JSON.stringify(model).includes(secretDiagnostic), false);
  assert.equal(model.secondaryAction, 'Review flow');
});

test('success-state actions make file download primary while keeping review sharing available', () => {
  assert.deepEqual(getSuccessActions(true), [
    { id: 'download', label: 'Download file', priority: 'primary', enabled: true },
    { id: 'share', label: 'Create approval link', priority: 'secondary', enabled: true },
    { id: 'another', label: 'Export another', priority: 'secondary', enabled: true },
    { id: 'copy', label: 'Copy export details', priority: 'secondary', enabled: true },
  ]);
  assert.equal(getSuccessActions(false)[0].enabled, false);
  assert.equal(getSuccessActions(false)[1].enabled, false);
  assert.equal(getSuccessActions(false)[2].enabled, true);
});

test('restore-purchase states distinguish loading, success, not-found, and retryable failure', () => {
  assert.deepEqual(getRestoreResultModel('checking'), {
    status: 'loading',
    message: 'Checking for an active purchase…',
    canRetry: false,
  });
  assert.equal(getRestoreResultModel('restored').status, 'success');
  assert.equal(getRestoreResultModel('restored').message, 'Paid access restored for this email.');
  assert.equal(getRestoreResultModel('not-found').canRetry, true);
  assert.match(getRestoreResultModel('not-found').message, /Project Pass or Studio/i);
  assert.equal(getRestoreResultModel('failed').canRetry, true);
  assert.match(getRestoreResultModel('failed').message, /check your connection/i);
});

test('checkout confirm and paid-access notices distinguish Project Pass from Studio', () => {
  const {
    getCheckoutConfirmCopy,
    getPaidAccessActivatedNotice,
  } = require('../dist/uiModel.js');

  assert.equal(getCheckoutConfirmCopy('large_export').heading, 'Confirming Project Pass');
  assert.match(getCheckoutConfirmCopy('large_export').body, /seven days/i);
  assert.equal(getCheckoutConfirmCopy('monthly').heading, 'Confirming Studio');
  assert.match(getPaidAccessActivatedNotice('large_export'), /Project Pass is active/i);
  assert.match(getPaidAccessActivatedNotice('monthly'), /Studio is active/i);
});

 test('checkout email validation rejects incomplete addresses and accepts trimmed aliases', () => {
  const { isValidAccountEmail } = require('../dist/uiModel.js');
  assert.equal(isValidAccountEmail('designer@'), false);
  assert.equal(isValidAccountEmail('designer@example'), false);
  assert.equal(isValidAccountEmail('a b@example.com'), false);
  assert.equal(isValidAccountEmail(' Designer+client@example.com '), true);
});
