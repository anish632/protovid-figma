"use strict";
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));

// backend/app/guides/examples/examples.json
var examples_default = [
  {
    slug: "client-delivery",
    title: "Figma prototype to MP4 for client delivery",
    outcome: "Send a booking flow your client can play without opening Figma.",
    project: "Cedar appointment booking",
    frames: [
      {
        name: "01 \u2014 Choose a visit",
        title: "Choose a visit",
        body: "Design consultation \xB7 30 minutes \xB7 Tuesday 10:00",
        button: "Review booking"
      },
      {
        name: "02 \u2014 Review your booking",
        title: "Review your booking",
        body: "Design consultation \xB7 Tuesday 10:00 \xB7 Online",
        button: "Confirm booking"
      },
      {
        name: "03 \u2014 Booking confirmed",
        title: "Booking confirmed",
        body: "Your design consultation is booked.",
        button: "Back to overview"
      }
    ],
    usage: "Ask the client to check the service, time, and confirmation wording.",
    honesty: "The clip communicates the proposed booking experience; it does not make a real booking."
  },
  {
    slug: "saas-walkthrough",
    title: "Make a SaaS product walkthrough from Figma",
    outcome: "Show how a teammate turns an unassigned task into planned work.",
    project: "Orbit task planner",
    frames: [
      {
        name: "01 \u2014 Find unassigned work",
        title: "Find unassigned work",
        body: "Landing page review \xB7 Unassigned \xB7 Due Friday",
        button: "Assign task"
      },
      {
        name: "02 \u2014 Assign the next step",
        title: "Assign the next step",
        body: "Landing page review \xB7 Assign to Alex \xB7 Due Friday",
        button: "Save assignment"
      },
      {
        name: "03 \u2014 Ready for this week",
        title: "Ready for this week",
        body: "Landing page review \xB7 Alex \xB7 Planned",
        button: "View board"
      }
    ],
    usage: "Place the clip next to a description of the workflow, with a still-image fallback.",
    honesty: "Orbit is a fictional interface. This is a design walkthrough, not a functioning SaaS application."
  },
  {
    slug: "portfolio-case-study",
    title: "Add a Figma prototype video to your portfolio case study",
    outcome: "Show the interaction behind a design decision.",
    project: "Library search concept",
    frames: [
      {
        name: "01 \u2014 Narrow the search",
        title: "Narrow the search",
        body: "Search: design systems \xB7 Filter: Available now",
        button: "Apply filter"
      },
      {
        name: "02 \u2014 Inspect the result",
        title: "Inspect the result",
        body: "Design Systems Handbook \xB7 Available \xB7 Digital edition",
        button: "Save title"
      },
      {
        name: "03 \u2014 Save for later",
        title: "Save for later",
        body: "Saved reading list \xB7 Design Systems Handbook",
        button: "View reading list"
      }
    ],
    usage: "Pair the clip with your problem statement, role, design rationale, and actual evidence.",
    honesty: "This fictional concept illustrates a design decision. It does not demonstrate measured usability improvement."
  }
];

// src/planConfig.ts
var PRO_PLAN = {
  name: "Studio",
  price: "$5/mo",
  priceDisplay: "$5/mo",
  priceCents: 500,
  exports: "unlimited",
  resolution: "HD & 4K",
  watermark: false,
  features: ["Unlimited exports", "HD & 4K resolution", "No watermark", "Unlimited reviewers", "30-day review rooms"]
};
var LARGE_FLOW_PASS = {
  // Keep the legacy export name for compatibility with saved checkout state.
  // The customer-facing offer is intentionally job-based, not frame-based.
  name: "Project Pass",
  price: "$4 once",
  priceDisplay: "$4 once",
  priceCents: 400,
  accessDays: 7,
  frameThreshold: 1,
  features: ["7 days of unlimited exports", "HD & 4K resolution", "No watermark", "No subscription"]
};
var PRO_PRICE_MONTHLY_DISPLAY = PRO_PLAN.priceDisplay;
var PRO_PRICE_MONTHLY_CENTS = PRO_PLAN.priceCents;
var LARGE_FLOW_PASS_DISPLAY = LARGE_FLOW_PASS.priceDisplay;
var LARGE_FLOW_PASS_CENTS = LARGE_FLOW_PASS.priceCents;
var LARGE_FLOW_PASS_ACCESS_DAYS = LARGE_FLOW_PASS.accessDays;
var LARGE_FLOW_FRAME_THRESHOLD = LARGE_FLOW_PASS.frameThreshold;
var FREE_RESOLUTION = "720p";
var PRO_UPGRADE_COPY = {
  upsellHeadline: "Make this client-ready",
  upsellBody: "Remove the watermark, unlock HD/4K, and ship the version you would put in front of a client.",
  upsellCta: `Start Studio`,
  upsellSubtext: `Just ${PRO_PLAN.priceDisplay}. Manage billing securely in Stripe.`,
  limitHeadline: "You\u2019ve hit the free limit",
  limitBody: "Keep exporting now with Studio, or wait for your next free cycle if you only need the watermarked proof.",
  limitCta: `Start Studio`,
  limitSubtext: `Just ${PRO_PLAN.priceDisplay}. No watermark, no extra setup.`,
  emailHelper: "Enter your email to attach Studio to this creator account and continue immediately.",
  stripeHelper: "Secure checkout powered by Stripe. Pay by card with or without Link.",
  trialHelper: "No trial. You can cancel anytime from Stripe.",
  socialProof: "Built for designers turning prototype walkthroughs into product decisions",
  largeFlowHeadline: "Finish this project without a subscription",
  largeFlowBody: "Use HD/4K, remove the watermark, and iterate freely for one project deadline.",
  largeFlowPassCta: "Buy Project Pass",
  largeFlowPassSubtext: `${LARGE_FLOW_PASS.priceDisplay}. Unlimited exports for ${LARGE_FLOW_PASS.accessDays} days.`,
  valueProps: {
    unlimitedExports: "Unlimited prototype exports",
    hdQuality: "HD & 4K resolution options",
    noWatermark: "Clean, professional videos",
    clientReady: "Perfect for stakeholder decisions",
    unlimitedReviewers: "Invite clients and stakeholders without paid seats",
    reviewRooms: "Keep paid review rooms active for 30 days"
  }
};

// backend/lib/billingNotice.ts
function isInBillingGrace(state, now = /* @__PURE__ */ new Date()) {
  return Boolean(state && ["payment_failed", "authentication_required"].includes(state.kind) && state.graceEndsAt && Date.parse(state.graceEndsAt) > now.getTime());
}
function getBillingNotice(status, state, now = /* @__PURE__ */ new Date()) {
  if (status === "canceled" || status === "unpaid" || status === "incomplete_expired") {
    return {
      title: "Your paid subscription has ended",
      message: "You\u2019re now on Free. Review any outstanding invoice in billing. Paying an old invoice does not automatically restart a canceled subscription.",
      actionLabel: "Review billing"
    };
  }
  if (status !== "past_due" && status !== "incomplete")
    return null;
  const authentication = (state == null ? void 0 : state.kind) === "authentication_required";
  const action = authentication ? "Complete your bank\u2019s verification to finish your renewal." : "Review your payment method and unpaid invoice to finish your renewal.";
  const access = isInBillingGrace(state, now) ? `Paid features stay available until ${new Date(state.graceEndsAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC", timeZoneName: "short" })}.` : "Paid features are paused. You can still use Free.";
  return {
    title: authentication ? "Bank verification needed" : "Your renewal needs attention",
    message: `${action} ${access}`,
    actionLabel: authentication ? "Verify payment" : "Fix payment"
  };
}

// src/entitlement.ts
var ENTITLEMENT_VERIFICATION_ERROR = "Couldn't verify export allowance. Please try again.";
function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}
function normalizeEntitlementResponse(input) {
  if (!input || typeof input !== "object")
    return null;
  const value = input;
  if (typeof value.userId !== "string" || typeof value.billingPeriodKey !== "string" || typeof value.subscriptionStatus !== "string" || typeof value.isPaid !== "boolean" || !isFiniteNumber(value.freeExportsLimit) || !isFiniteNumber(value.freeExportsUsed) || !isFiniteNumber(value.freeExportsRemaining) || typeof value.watermarkRequired !== "boolean" || typeof value.canExport !== "boolean" || typeof value.upgradeRequired !== "boolean") {
    return null;
  }
  return {
    billingNotice: value.billingNotice && typeof value.billingNotice.title === "string" && typeof value.billingNotice.message === "string" && typeof value.billingNotice.actionLabel === "string" ? value.billingNotice : getBillingNotice(value.subscriptionStatus),
    userId: value.userId,
    billingPeriodKey: value.billingPeriodKey,
    subscriptionStatus: value.subscriptionStatus,
    isPaid: value.isPaid,
    freeTierExperimentId: typeof value.freeTierExperimentId === "string" ? value.freeTierExperimentId : void 0,
    freeExportsLimit: value.freeExportsLimit,
    freeExportsUsed: value.freeExportsUsed,
    freeExportsRemaining: value.freeExportsRemaining,
    watermarkRequired: value.watermarkRequired,
    canExport: value.canExport,
    upgradeRequired: value.upgradeRequired,
    billingAccessKind: value.billingAccessKind === "subscription" || value.billingAccessKind === "one_time_access" ? value.billingAccessKind : value.isPaid ? "subscription" : "none",
    currentPeriodEnd: typeof value.currentPeriodEnd === "string" ? value.currentPeriodEnd : null
  };
}

// src/smartAnimateMatcher.ts
function normalizeLayerName(name) {
  return name.toLowerCase().trim().replace(/\s+/g, " ").replace(/[-_]+/g, " ");
}
function roundToPixel(value) {
  return Math.round(value * 1e3) / 1e3;
}
function scaleBounds(bounds, scale) {
  return {
    x: roundToPixel(bounds.x * scale),
    y: roundToPixel(bounds.y * scale),
    width: roundToPixel(bounds.width * scale),
    height: roundToPixel(bounds.height * scale)
  };
}
function buildLayerKeys(segments) {
  const exact = segments.map((seg) => `${seg.type}:${seg.name}#${seg.index}`).join(">");
  const loose = segments.map((seg) => `${seg.type}:${seg.name}`).join(">");
  const leaf = segments.length > 0 ? `${segments[segments.length - 1].type}:${segments[segments.length - 1].name}` : "";
  const parentSegments = segments.slice(0, -1);
  const parentExact = parentSegments.map((seg) => `${seg.type}:${seg.name}#${seg.index}`).join(">");
  const parentLoose = parentSegments.map((seg) => `${seg.type}:${seg.name}`).join(">");
  return { exact, loose, leaf, parentExact, parentLoose, depth: segments.length };
}
function indexLayerSnapshots(layers) {
  const exact = /* @__PURE__ */ new Map();
  const loose = /* @__PURE__ */ new Map();
  const leaf = /* @__PURE__ */ new Map();
  const typeLeaf = /* @__PURE__ */ new Map();
  const parentLoose = /* @__PURE__ */ new Map();
  const parentExact = /* @__PURE__ */ new Map();
  for (const layer of layers) {
    if (!exact.has(layer.keyExact))
      exact.set(layer.keyExact, []);
    exact.get(layer.keyExact).push(layer);
    if (!loose.has(layer.keyLoose))
      loose.set(layer.keyLoose, []);
    loose.get(layer.keyLoose).push(layer);
    if (!leaf.has(layer.keyLeaf))
      leaf.set(layer.keyLeaf, []);
    leaf.get(layer.keyLeaf).push(layer);
    if (!typeLeaf.has(`${layer.type}:${layer.keyLeaf}`))
      typeLeaf.set(`${layer.type}:${layer.keyLeaf}`, []);
    typeLeaf.get(`${layer.type}:${layer.keyLeaf}`).push(layer);
    if (!parentLoose.has(layer.keyParentLoose))
      parentLoose.set(layer.keyParentLoose, []);
    parentLoose.get(layer.keyParentLoose).push(layer);
    if (!parentExact.has(layer.keyParentExact))
      parentExact.set(layer.keyParentExact, []);
    parentExact.get(layer.keyParentExact).push(layer);
  }
  return { exact, loose, leaf, typeLeaf, parentLoose, parentExact };
}
function takeUniqueMatch(index, key, strategy) {
  const list = index[strategy].get(key);
  if (!list || list.length !== 1)
    return null;
  return list[0];
}
function removeSnapshotFromIndex(index, snapshot) {
  for (const [map, key] of [
    [index.exact, snapshot.keyExact],
    [index.loose, snapshot.keyLoose],
    [index.leaf, snapshot.keyLeaf],
    [index.typeLeaf, `${snapshot.type}:${snapshot.keyLeaf}`],
    [index.parentLoose, snapshot.keyParentLoose],
    [index.parentExact, snapshot.keyParentExact]
  ]) {
    const list = map.get(key);
    if (!list)
      continue;
    const next = list.filter((item) => item.id !== snapshot.id);
    if (next.length > 0)
      map.set(key, next);
    else
      map.delete(key);
  }
}
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
function similarityScore(source, destination) {
  if (source.id === destination.id)
    return -Infinity;
  const sourceArea = Math.max(source.bounds.width * source.bounds.height, 1);
  const destArea = Math.max(destination.bounds.width * destination.bounds.height, 1);
  const sourceCx = source.bounds.x + source.bounds.width / 2;
  const sourceCy = source.bounds.y + source.bounds.height / 2;
  const destCx = destination.bounds.x + destination.bounds.width / 2;
  const destCy = destination.bounds.y + destination.bounds.height / 2;
  const diagonal = Math.max(
    Math.hypot(source.bounds.width, source.bounds.height),
    Math.hypot(destination.bounds.width, destination.bounds.height),
    1
  );
  const sameType = source.type === destination.type ? 1 : 0;
  const sameLeaf = source.keyLeaf === destination.keyLeaf ? 1 : 0;
  const sameLoose = source.keyLoose === destination.keyLoose ? 1 : 0;
  const sameExact = source.keyExact === destination.keyExact ? 1 : 0;
  const sameParentLoose = source.keyParentLoose && source.keyParentLoose === destination.keyParentLoose ? 1 : 0;
  const sameParentExact = source.keyParentExact && source.keyParentExact === destination.keyParentExact ? 1 : 0;
  const nameSimilarity = source.name === destination.name ? 1 : 0;
  const sizeDiff = Math.abs(sourceArea - destArea) / Math.max(sourceArea, destArea);
  const widthDiff = Math.abs(source.bounds.width - destination.bounds.width) / Math.max(Math.max(source.bounds.width, destination.bounds.width), 1);
  const heightDiff = Math.abs(source.bounds.height - destination.bounds.height) / Math.max(Math.max(source.bounds.height, destination.bounds.height), 1);
  const centerDiff = Math.hypot(sourceCx - destCx, sourceCy - destCy) / diagonal;
  const opacityDiff = Math.abs(source.opacity - destination.opacity);
  const rotationDiff = Math.abs(source.rotation - destination.rotation) / 180;
  const depthDiff = Math.abs(source.depth - destination.depth) / Math.max(Math.max(source.depth, destination.depth), 1);
  let score = 0;
  score += sameExact ? 120 : 0;
  score += sameLoose ? 90 : 0;
  score += sameParentExact ? 55 : 0;
  score += sameParentLoose ? 35 : 0;
  score += sameLeaf ? 45 : 0;
  score += sameType ? 25 : -35;
  score += nameSimilarity ? 10 : 0;
  score -= clamp(sizeDiff * 40, 0, 40);
  score -= clamp(widthDiff * 18, 0, 18);
  score -= clamp(heightDiff * 18, 0, 18);
  score -= clamp(centerDiff * 50, 0, 50);
  score -= clamp(opacityDiff * 12, 0, 12);
  score -= clamp(rotationDiff * 18, 0, 18);
  score -= clamp(depthDiff * 20, 0, 20);
  if (!sameType && !sameLeaf && !sameLoose && !sameExact) {
    score -= 25;
  }
  return score;
}
function collectCandidateDestinations(index, source) {
  const candidates = /* @__PURE__ */ new Map();
  const add = (list) => {
    if (!list)
      return;
    for (const candidate of list)
      candidates.set(candidate.id, candidate);
  };
  add(index.exact.get(source.keyExact));
  add(index.loose.get(source.keyLoose));
  add(index.leaf.get(source.keyLeaf));
  add(index.typeLeaf.get(`${source.type}:${source.keyLeaf}`));
  add(index.parentLoose.get(source.keyParentLoose));
  add(index.parentExact.get(source.keyParentExact));
  return Array.from(candidates.values()).filter((candidate) => candidate.id !== source.id);
}
function matchSmartAnimateLayers(sourceLayers, destinationLayers) {
  const destinationIndex = indexLayerSnapshots(destinationLayers);
  const matched = [];
  const sourceOnly = [];
  const orderedSource = [...sourceLayers].sort((a, b) => {
    const areaA = a.bounds.width * a.bounds.height;
    const areaB = b.bounds.width * b.bounds.height;
    return areaB - areaA;
  });
  for (const source of orderedSource) {
    const exact = takeUniqueMatch(destinationIndex, source.keyExact, "exact");
    const loose = exact ? null : takeUniqueMatch(destinationIndex, source.keyLoose, "loose");
    const leaf = exact || loose ? null : takeUniqueMatch(destinationIndex, source.keyLeaf, "leaf");
    const unique = exact || loose || leaf;
    if (unique) {
      matched.push({ source, destination: unique });
      removeSnapshotFromIndex(destinationIndex, unique);
      continue;
    }
    const candidates = collectCandidateDestinations(destinationIndex, source);
    if (candidates.length === 0) {
      sourceOnly.push(source);
      continue;
    }
    let bestDestination = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const candidate of candidates) {
      const score = similarityScore(source, candidate);
      if (score > bestScore) {
        bestScore = score;
        bestDestination = candidate;
      }
    }
    if (!bestDestination || bestScore < 10) {
      sourceOnly.push(source);
      continue;
    }
    matched.push({ source, destination: bestDestination });
    removeSnapshotFromIndex(destinationIndex, bestDestination);
  }
  const destinationOnly = Array.from(destinationIndex.exact.values()).flat();
  return { matched, sourceOnly, destinationOnly };
}

// src/uiModel.ts
function getRecommendedPathId(paths) {
  var _a;
  const reliable = paths.filter((path) => !path.truncated && path.preflightStatus === "ready").sort((a, b) => a.frameCount - b.frameCount || a.id.localeCompare(b.id));
  if (reliable[0])
    return reliable[0].id;
  const safeFallback = paths.filter((path) => !path.truncated).sort((a, b) => a.frameCount - b.frameCount || a.id.localeCompare(b.id));
  return ((_a = safeFallback[0]) == null ? void 0 : _a.id) || null;
}

// src/exportAnalytics.ts
function buildExportEventId(exportId, eventType, retryAttempt) {
  if (!exportId)
    return null;
  return `${exportId}:${eventType}:${retryAttempt != null ? retryAttempt : "once"}`;
}

// src/version.ts
var PLUGIN_VERSION = "1.3.24";

// src/code.ts
var currentSettings = {
  resolution: "720p",
  format: "mp4",
  showCursor: true
};
var BACKEND_URL = "https://protovid.dasgroupllc.com";
var SETUP_GUIDE_URL = `${BACKEND_URL}/guides/first-export`;
var CHECKOUT_SESSION_CONFIG_VERSION = 2;
var EXPORT_FORMATS = ["mp4", "webm", "gif"];
var LONG_PATH_FRAME_THRESHOLD = 25;
var RECOMMENDED_MAX_PATH_FRAMES = 50;
var MAX_ENUMERATED_PROTOTYPE_PATHS = 100;
var exportInProgress = false;
var checkoutInProgress = false;
var currentExportCharged = false;
var currentExportCommitted = false;
var daysSinceFirstExport = null;
var anonymousId = null;
var currentEntitlement = null;
var currentExportAttemptId = null;
var currentExportIsFirst = true;
var sessionAnalyticsTracked = false;
function createAnonymousId() {
  const random = Math.random().toString(36).slice(2, 10);
  return `pv_${Date.now().toString(36)}_${random}`;
}
async function loadAnonymousId() {
  if (anonymousId)
    return anonymousId;
  try {
    const stored = await figma.clientStorage.getAsync("anonymousId");
    if (typeof stored === "string" && stored.startsWith("pv_")) {
      anonymousId = stored;
      return stored;
    }
    anonymousId = createAnonymousId();
    await figma.clientStorage.setAsync("anonymousId", anonymousId);
    return anonymousId;
  } catch (_e) {
    anonymousId = anonymousId || createAnonymousId();
    return anonymousId;
  }
}
function createExportAttemptId() {
  return `exp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
function getOpaqueProjectId() {
  const figmaWithFileKey = figma;
  return figmaWithFileKey.fileKey || `page:${figma.currentPage.id}`;
}
function getExportPreferencesKey() {
  return `exportPreferences:${getOpaqueProjectId()}`;
}
async function loadSavedExportPreferences() {
  try {
    const value = await figma.clientStorage.getAsync(getExportPreferencesKey());
    if (!value || typeof value !== "object")
      return null;
    const preferences = value;
    if (!preferences.settings || !["720p", "1080p", "4K"].includes(preferences.settings.resolution) || !EXPORT_FORMATS.includes(preferences.settings.format) || typeof preferences.settings.showCursor !== "boolean" || typeof preferences.lastSuccessfulExportAt !== "string" || typeof preferences.lastSuccessfulExportId !== "string")
      return null;
    return {
      settings: {
        resolution: preferences.settings.resolution,
        format: preferences.settings.format,
        showCursor: preferences.settings.showCursor
      },
      selectedPathId: typeof preferences.selectedPathId === "string" ? preferences.selectedPathId : void 0,
      selectedPathFrameIds: Array.isArray(preferences.selectedPathFrameIds) ? preferences.selectedPathFrameIds.filter((id) => typeof id === "string") : void 0,
      lastSuccessfulExportAt: preferences.lastSuccessfulExportAt,
      lastSuccessfulExportId: preferences.lastSuccessfulExportId
    };
  } catch (_error) {
    return null;
  }
}
async function saveExportPreferences(exportId) {
  try {
    await figma.clientStorage.setAsync(getExportPreferencesKey(), {
      settings: {
        resolution: currentSettings.resolution,
        format: currentSettings.format,
        showCursor: currentSettings.showCursor
      },
      selectedPathId: currentSettings.selectedPathId,
      selectedPathFrameIds: currentSettings.selectedPathFrameIds,
      lastSuccessfulExportAt: (/* @__PURE__ */ new Date()).toISOString(),
      lastSuccessfulExportId: exportId
    });
  } catch (_error) {
  }
}
async function trackFirstOpenOnce() {
  try {
    const key = "hasTrackedFirstOpen";
    if (await figma.clientStorage.getAsync(key))
      return;
    await figma.clientStorage.setAsync(key, true);
    await trackEvent("first_open");
  } catch (_error) {
  }
}
async function trackFirstValueOnce(metadata) {
  try {
    const key = "hasTrackedFirstValue";
    if (await figma.clientStorage.getAsync(key))
      return;
    await figma.clientStorage.setAsync(key, true);
    await trackEvent("first_value_reached", metadata);
  } catch (_error) {
  }
}
async function trackOnboardingCompletedOnce(metadata) {
  try {
    const key = "hasTrackedOnboardingCompleted";
    if (await figma.clientStorage.getAsync(key))
      return;
    await figma.clientStorage.setAsync(key, true);
    await trackEvent("onboarding_completed", metadata);
  } catch (_error) {
  }
}
async function loadEmail() {
  try {
    return await figma.clientStorage.getAsync("userEmail") || null;
  } catch (_e) {
    return null;
  }
}
async function saveEmail(email) {
  try {
    await figma.clientStorage.setAsync("userEmail", email);
  } catch (e) {
    console.error("Failed to save email:", e);
  }
}
async function loadPendingCheckout() {
  try {
    const value = await figma.clientStorage.getAsync("pendingCheckout");
    if (!value || typeof value !== "object")
      return null;
    const checkout = value;
    if (!checkout.email || !checkout.url || !checkout.createdAt)
      return null;
    if (checkout.checkoutConfigVersion !== CHECKOUT_SESSION_CONFIG_VERSION) {
      await figma.clientStorage.deleteAsync("pendingCheckout");
      return null;
    }
    const ageMs = Date.now() - new Date(checkout.createdAt).getTime();
    if (!Number.isFinite(ageMs) || ageMs > 24 * 60 * 60 * 1e3) {
      await figma.clientStorage.deleteAsync("pendingCheckout");
      return null;
    }
    return checkout;
  } catch (_e) {
    return null;
  }
}
async function savePendingCheckout(checkout) {
  try {
    await figma.clientStorage.setAsync("pendingCheckout", checkout);
  } catch (e) {
    console.error("Failed to save pending checkout:", e);
  }
}
async function clearPendingCheckout() {
  try {
    await figma.clientStorage.deleteAsync("pendingCheckout");
  } catch (_e) {
  }
}
async function loadBillingManagementCapability() {
  try {
    const value = await figma.clientStorage.getAsync("billingManagementCapability");
    if (!value || typeof value !== "object")
      return null;
    const capability = value;
    const expiry = new Date(capability.expiresAt).getTime();
    if (!capability.token || !capability.expiresAt || !capability.email || !Number.isFinite(expiry) || expiry <= Date.now()) {
      await figma.clientStorage.deleteAsync("billingManagementCapability");
      return null;
    }
    return capability;
  } catch (_error) {
    return null;
  }
}
async function saveBillingManagementCapability(capability) {
  try {
    await figma.clientStorage.setAsync("billingManagementCapability", capability);
  } catch (error) {
    console.error("Could not save billing management capability:", error);
  }
}
async function clearBillingManagementCapability() {
  try {
    await figma.clientStorage.deleteAsync("billingManagementCapability");
  } catch (_error) {
  }
}
async function exchangeCheckoutSessionForManagementToken(sessionId, email) {
  const normalizedEmail = email == null ? void 0 : email.toLowerCase().trim();
  if (!sessionId || !normalizedEmail)
    return false;
  try {
    const response = await fetch(`${BACKEND_URL}/api/billing/management-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId })
    });
    if (!response.ok)
      return false;
    const data = await response.json();
    if (typeof data.managementToken !== "string" || typeof data.expiresAt !== "string")
      return false;
    await saveBillingManagementCapability({
      token: data.managementToken,
      expiresAt: data.expiresAt,
      email: normalizedEmail
    });
    return true;
  } catch (error) {
    if (isDevelopment())
      console.error("Could not exchange checkout session for management token:", error);
    return false;
  }
}
var analyticsQueue = Promise.resolve();
async function trackEvent(eventType, metadata) {
  const exportId = currentExportAttemptId;
  const explicitEventId = typeof (metadata == null ? void 0 : metadata.event_id) === "string" ? metadata.event_id : null;
  const retryAttempt = typeof (metadata == null ? void 0 : metadata.retry_attempt) === "number" ? metadata.retry_attempt : null;
  const eventId = explicitEventId || buildExportEventId(exportId, eventType, retryAttempt);
  const enrichedMetadata = __spreadValues(__spreadValues(__spreadProps(__spreadValues({}, metadata || {}), {
    project_id: getOpaqueProjectId()
  }), exportId ? { export_id: exportId } : {}), eventId ? { event_id: eventId } : {});
  analyticsQueue = analyticsQueue.then(async () => {
    try {
      const [anon, email] = await Promise.all([loadAnonymousId(), loadEmail()]);
      const safeMetadata = {};
      for (const [key, value] of Object.entries(__spreadProps(__spreadValues({}, enrichedMetadata), { anonymousId: anon }))) {
        if (value === null || ["string", "number", "boolean"].includes(typeof value)) {
          safeMetadata[key] = value;
        }
      }
      figma.ui.postMessage({
        type: "analytics-event",
        data: {
          email,
          eventType,
          pluginVersion: PLUGIN_VERSION,
          metadata: safeMetadata
        }
      });
    } catch (e) {
      console.error("Tracking error:", e);
    }
  });
  return analyticsQueue;
}
function getFrameCountBucket(frameCount) {
  if (frameCount <= 0)
    return "0";
  if (frameCount === 1)
    return "1";
  if (frameCount <= 3)
    return "2-3";
  if (frameCount <= 10)
    return "4-10";
  return "10+";
}
function isDevelopment() {
  return BACKEND_URL.includes("localhost") || PLUGIN_VERSION.includes("dev");
}
function getEntitlementRequestBody(email, userId) {
  return email ? { email, userId } : { userId };
}
function logEntitlement(entitlement) {
  if (!isDevelopment())
    return;
  console.log("[ProtoVid entitlement]", {
    appVersion: PLUGIN_VERSION,
    environment: "figma-plugin",
    userId: entitlement.userId,
    billingPeriodKey: entitlement.billingPeriodKey,
    subscriptionStatus: entitlement.subscriptionStatus,
    isPaid: entitlement.isPaid,
    freeTierExperimentId: entitlement.freeTierExperimentId,
    freeExportsLimit: entitlement.freeExportsLimit,
    freeExportsUsed: entitlement.freeExportsUsed,
    freeExportsRemaining: entitlement.freeExportsRemaining,
    watermarkRequired: entitlement.watermarkRequired,
    canExport: entitlement.canExport,
    upgradeRequired: entitlement.upgradeRequired,
    source: "backend"
  });
}
async function loadEntitlement(email) {
  const userId = await loadAnonymousId();
  const response = await fetch(`${BACKEND_URL}/api/exports/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(getEntitlementRequestBody(email, userId))
  });
  if (!response.ok) {
    throw new Error(ENTITLEMENT_VERIFICATION_ERROR);
  }
  const entitlement = normalizeEntitlementResponse(await response.json());
  if (!entitlement) {
    throw new Error(ENTITLEMENT_VERIFICATION_ERROR);
  }
  currentEntitlement = entitlement;
  logEntitlement(entitlement);
  return entitlement;
}
async function incrementServerExports(email) {
  const userId = await loadAnonymousId();
  const response = await fetch(`${BACKEND_URL}/api/exports/increment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(getEntitlementRequestBody(email, userId))
  });
  if (!response.ok) {
    throw new Error(ENTITLEMENT_VERIFICATION_ERROR);
  }
  const entitlement = normalizeEntitlementResponse(await response.json());
  if (!entitlement) {
    throw new Error(ENTITLEMENT_VERIFICATION_ERROR);
  }
  currentEntitlement = entitlement;
  logEntitlement(entitlement);
  return entitlement;
}
async function reserveFreeExport(_email) {
  currentExportCharged = true;
}
async function rollbackFreeExport() {
  if (!currentExportCharged || currentExportCommitted)
    return;
  currentExportCharged = false;
}
async function commitFreeExport(email) {
  if (currentExportCommitted)
    return;
  const entitlement = await incrementServerExports(email);
  currentExportCommitted = true;
  figma.ui.postMessage({
    type: "export-count-updated",
    data: { entitlement }
  });
}
figma.showUI(__html__, { width: 400, height: 720, themeColors: true });
loadAnonymousId();
function getUnconnectedTopLevelFrames() {
  return figma.currentPage.children.filter((node) => node.type === "FRAME").filter((frame) => !Array.isArray(frame.reactions) || frame.reactions.length === 0).sort((a, b) => a.x - b.x || a.y - b.y);
}
async function handleConnectExistingFrames() {
  const frames = getUnconnectedTopLevelFrames();
  if (frames.length < 2) {
    trackEvent("setup_autoconnect_skipped", { frameCount: frames.length });
    await handleScanPrototype();
    return;
  }
  for (let index = 0; index < frames.length - 1; index++) {
    await frames[index].setReactionsAsync([{
      trigger: { type: "ON_CLICK" },
      actions: [{
        type: "NODE",
        destinationId: frames[index + 1].id,
        navigation: "NAVIGATE",
        transition: { type: "DISSOLVE", duration: 0.3, easing: { type: "EASE_IN_AND_OUT" } },
        preserveScrollPosition: false
      }]
    }]);
  }
  figma.currentPage.selection = [frames[0]];
  figma.viewport.scrollAndZoomIntoView(frames);
  trackEvent("setup_frames_autoconnected", { frameCount: frames.length });
  await handleScanPrototype();
}
async function handleCreateExamplePrototype(slug, source = "example_picker") {
  const example = examples_default.find((item) => item.slug === slug) || examples_default[0];
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  const page = figma.createPage();
  page.name = `ProtoVid \u2014 ${example.project}`;
  await figma.setCurrentPageAsync(page);
  const frames = example.frames.map((screen, index) => {
    const frame = figma.createFrame();
    frame.name = screen.name;
    frame.resize(1280, 720);
    frame.x = index * 1400;
    frame.fills = [{ type: "SOLID", color: { r: 0.05, g: 0.09, b: 0.08 } }];
    const title = figma.createText();
    title.fontName = { family: "Inter", style: "Regular" };
    title.characters = screen.title;
    title.fontSize = 48;
    title.fills = [{ type: "SOLID", color: { r: 0.9, g: 0.96, b: 0.92 } }];
    frame.appendChild(title);
    title.x = 64;
    title.y = 168;
    const body = figma.createText();
    body.fontName = { family: "Inter", style: "Regular" };
    body.characters = screen.body;
    body.fontSize = 28;
    body.fills = [{ type: "SOLID", color: { r: 0.65, g: 0.8, b: 0.7 } }];
    frame.appendChild(body);
    body.x = 64;
    body.y = 252;
    const button = figma.createRectangle();
    button.name = screen.button;
    button.resize(360, 64);
    button.cornerRadius = 8;
    button.fills = [{ type: "SOLID", color: { r: 0.25, g: 0.8, b: 0.5 } }];
    frame.appendChild(button);
    button.x = 64;
    button.y = 520;
    const caption = figma.createText();
    caption.fontName = { family: "Inter", style: "Regular" };
    caption.characters = screen.button;
    caption.fontSize = 24;
    frame.appendChild(caption);
    caption.x = 84;
    caption.y = 536;
    return frame;
  });
  for (let index = 0; index < frames.length - 1; index++) {
    await frames[index].setReactionsAsync([{
      trigger: { type: "ON_CLICK" },
      actions: [{
        type: "NODE",
        destinationId: frames[index + 1].id,
        navigation: "NAVIGATE",
        transition: { type: "DISSOLVE", duration: 0.3, easing: { type: "EASE_IN_AND_OUT" } },
        preserveScrollPosition: false
      }]
    }]);
  }
  page.selection = [frames[0]];
  figma.viewport.scrollAndZoomIntoView(frames);
  trackEvent("setup_example_created", { source, example: example.slug, frameCount: frames.length });
  await handleScanPrototype();
}
figma.ui.onmessage = async (msg) => {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s;
  try {
    switch (msg.type) {
      case "init":
        await handleInit();
        break;
      case "scan-prototype":
        await handleScanPrototype();
        break;
      case "create-example-prototype":
        await handleCreateExamplePrototype((_a = msg.data) == null ? void 0 : _a.slug, (_b = msg.data) == null ? void 0 : _b.source);
        break;
      case "connect-existing-frames":
        await handleConnectExistingFrames();
        break;
      case "open-setup-guide":
        trackEvent("setup_guide_opened", { source: "empty_state" });
        figma.openExternal(SETUP_GUIDE_URL);
        break;
      case "export-video":
        await handleExportVideo(msg.data);
        break;
      case "validate-license":
        await handleValidateLicense(msg.data.licenseKey);
        break;
      case "cancel":
        figma.closePlugin();
        break;
      case "encoding-complete":
        await handleEncodingComplete(
          (_d = (_c = msg.data) == null ? void 0 : _c.isPremium) != null ? _d : false,
          ((_e = msg.data) == null ? void 0 : _e.usedSafeRetry) === true,
          msg.data || {}
        );
        break;
      case "encoding-failed":
        await rollbackFreeExport();
        exportInProgress = false;
        trackEvent("export_failed", {
          attempt_id: ((_f = msg.data) == null ? void 0 : _f.exportAttemptId) || currentExportAttemptId,
          reason: ((_g = msg.data) == null ? void 0 : _g.source) === "backend-transcode" ? "backend_transcode_failed" : ((_h = msg.data) == null ? void 0 : _h.source) === "browser-encode" ? "browser_encode_failed" : "unknown",
          source: ((_i = msg.data) == null ? void 0 : _i.source) || "unknown",
          frameCount: (_j = msg.data) == null ? void 0 : _j.frameCount,
          backend_error_type: ((_k = msg.data) == null ? void 0 : _k.backendErrorType) || null,
          input_size_mb: ((_l = msg.data) == null ? void 0 : _l.inputSizeMB) || null,
          backend_frame_count: ((_m = msg.data) == null ? void 0 : _m.backendFrameCount) || null,
          backend_resolution: ((_n = msg.data) == null ? void 0 : _n.backendResolution) || null,
          // Safe retry context
          first_error_source: ((_o = msg.data) == null ? void 0 : _o.firstErrorSource) || null,
          safe_retry_used: ((_p = msg.data) == null ? void 0 : _p.safeRetryUsed) || null
        });
        currentExportAttemptId = null;
        break;
      case "open-checkout":
        await handleOpenCheckout(msg.data.email, msg.data.plan, {
          pricingVariant: msg.data.pricingVariant,
          priceLabel: msg.data.priceLabel,
          amountCents: msg.data.amountCents,
          source: msg.data.source,
          offerExperimentId: msg.data.offerExperimentId,
          offerExperimentVariant: msg.data.offerExperimentVariant,
          primaryOffer: msg.data.primaryOffer,
          frameCount: msg.data.frameCount
        });
        break;
      case "resume-checkout":
        await handleResumeCheckout((_q = msg.data) == null ? void 0 : _q.url, (_r = msg.data) == null ? void 0 : _r.email, (_s = msg.data) == null ? void 0 : _s.plan);
        break;
      case "open-billing-portal":
        await handleOpenBillingPortal();
        break;
      case "open-community-listing":
        await handleOpenCommunityListing();
        break;
      case "save-email":
        await handleSaveEmail(msg.data.email, msg.data.source);
        break;
      case "track-event":
        await trackEvent(msg.data.eventType, msg.data.metadata);
        break;
      default:
        console.log("Unknown message type:", msg.type);
    }
  } catch (error) {
    if (msg.type === "export-video") {
      await rollbackFreeExport();
      exportInProgress = false;
      currentExportCharged = false;
      currentExportCommitted = false;
      currentExportAttemptId = null;
    }
    figma.ui.postMessage({
      type: "error",
      data: { message: error instanceof Error ? error.message : String(error) }
    });
  }
};
async function handleSaveEmail(email, source = "account") {
  var _a;
  const normalized = email.toLowerCase().trim();
  const previousEmail = (_a = await loadEmail()) == null ? void 0 : _a.toLowerCase().trim();
  const pendingCheckout = await loadPendingCheckout();
  const pendingCheckoutMatchesAccount = (pendingCheckout == null ? void 0 : pendingCheckout.email.toLowerCase().trim()) === normalized;
  if (previousEmail && previousEmail !== normalized) {
    await clearBillingManagementCapability();
  }
  if (pendingCheckout && !pendingCheckoutMatchesAccount) {
    await clearPendingCheckout();
  }
  await saveEmail(normalized);
  if (previousEmail !== normalized) {
    trackEvent("email_captured", { source });
  }
  if (!previousEmail && source !== "post_export_success") {
    await trackOnboardingCompletedOnce({ source: "email_captured" });
  }
  const entitlement = await loadEntitlement(normalized);
  if (entitlement.isPaid && pendingCheckoutMatchesAccount) {
    await exchangeCheckoutSessionForManagementToken(pendingCheckout == null ? void 0 : pendingCheckout.sessionId, normalized);
    await clearPendingCheckout();
  }
  figma.ui.postMessage({
    type: "email-saved",
    data: {
      email: normalized,
      entitlement,
      trialExpired: false,
      daysSinceFirstExport
    }
  });
}
async function handleInit() {
  var _a;
  await loadAnonymousId();
  if (!sessionAnalyticsTracked) {
    sessionAnalyticsTracked = true;
    await trackEvent("plugin_load");
    await trackEvent("plugin_opened");
    await trackEvent("session_opened");
    await trackFirstOpenOnce();
  }
  const savedExportPreferences = await loadSavedExportPreferences();
  const savedEmail = await loadEmail();
  const pendingCheckout = await loadPendingCheckout();
  const pendingCheckoutMatchesSavedAccount = Boolean(
    savedEmail && (pendingCheckout == null ? void 0 : pendingCheckout.email.toLowerCase().trim()) === savedEmail.toLowerCase().trim()
  );
  if (pendingCheckout && savedEmail && !pendingCheckoutMatchesSavedAccount) {
    await clearPendingCheckout();
  }
  const graph = await buildPrototypeGraph();
  const startFrameIds = await getPrototypePathStartFrameIds(graph);
  const unlabelledCatalog = await buildPrototypePathCatalog(graph, /* @__PURE__ */ new Map(), startFrameIds);
  const detectedFrameIds = getCatalogFrameIds(graph, unlabelledCatalog);
  const { frames: detectedFrames, frameNames } = await collectPrototypeFrameSummaries(detectedFrameIds);
  const pathCatalog = await buildPrototypePathCatalog(graph, frameNames, startFrameIds);
  const detectedFrameCount = detectedFrames.length;
  const hasPrototype = detectedFrameCount > 0;
  const hasTransitions = Array.from(graph.transitions.values()).some((destinations) => destinations.size > 0);
  const flow = analyzePrototypeFlow(detectedFrames, hasTransitions, pathCatalog);
  if (!savedEmail) {
    trackEvent("onboarding_started", {
      hasPrototype,
      frameCount: detectedFrameCount,
      pathCount: pathCatalog.paths.length
    });
  }
  if (hasPrototype) {
    trackEvent("prototype_detected", {
      frameCount: detectedFrameCount,
      pathCount: pathCatalog.paths.length,
      pathSelectionRequired: pathCatalog.pathSelectionRequired
    });
    trackEvent("prototype_frames_detected", {
      frame_count_bucket: getFrameCountBucket(detectedFrameCount)
    });
    trackEvent("first_action_completed", {
      action: "prototype_detected",
      frameCount: detectedFrameCount
    });
    trackEvent("export_setup_viewed", {
      frameCount: detectedFrameCount,
      pathCount: pathCatalog.paths.length,
      pathSelectionRequired: pathCatalog.pathSelectionRequired,
      freeLimit: (_a = currentEntitlement == null ? void 0 : currentEntitlement.freeExportsLimit) != null ? _a : null
    });
    trackEvent("export_settings_viewed", {
      frameCount: detectedFrameCount,
      source: "initial_detection"
    });
    if (detectedFrameCount >= 10) {
      trackEvent("power_user_detected", {
        frameCount: detectedFrameCount,
        complexity: "high"
      });
    } else if (detectedFrameCount >= 5) {
      trackEvent("moderate_user_detected", {
        frameCount: detectedFrameCount,
        complexity: "medium"
      });
    }
  }
  let entitlement = null;
  let entitlementError = false;
  try {
    entitlement = await loadEntitlement(savedEmail);
    if ((entitlement == null ? void 0 : entitlement.isPaid) && pendingCheckoutMatchesSavedAccount) {
      await exchangeCheckoutSessionForManagementToken(pendingCheckout == null ? void 0 : pendingCheckout.sessionId, savedEmail || void 0);
      await clearPendingCheckout();
    }
  } catch (error) {
    entitlementError = true;
    if (isDevelopment()) {
      console.error("Entitlement check failed:", error);
    }
  }
  figma.ui.postMessage({
    type: "init-complete",
    data: {
      hasPrototype,
      frameCount: detectedFrameCount,
      unconnectedFrameCount: hasPrototype ? 0 : getUnconnectedTopLevelFrames().length,
      paths: pathCatalog.paths,
      pathSelectionRequired: pathCatalog.pathSelectionRequired,
      defaultPathId: pathCatalog.defaultPathId,
      pathEnumerationTruncated: pathCatalog.pathEnumerationTruncated,
      flow,
      anonymousId: await loadAnonymousId(),
      savedEmail,
      savedExportPreferences,
      projectId: getOpaqueProjectId(),
      pendingCheckout: (entitlement == null ? void 0 : entitlement.isPaid) || savedEmail && !pendingCheckoutMatchesSavedAccount ? null : pendingCheckout,
      entitlement,
      entitlementError,
      trialExpired: false,
      daysSinceFirstExport
    }
  });
}
async function handleScanPrototype() {
  var _a;
  const graph = await buildPrototypeGraph();
  const startFrameIds = await getPrototypePathStartFrameIds(graph);
  const unlabelledCatalog = await buildPrototypePathCatalog(
    graph,
    /* @__PURE__ */ new Map(),
    startFrameIds
  );
  const { frames, frameNames } = await collectPrototypeFrameSummaries(
    getCatalogFrameIds(graph, unlabelledCatalog)
  );
  const pathCatalog = await buildPrototypePathCatalog(graph, frameNames, startFrameIds);
  const hasTransitions = Array.from(graph.transitions.values()).some((dests) => dests.size > 0);
  const flow = analyzePrototypeFlow(frames, hasTransitions, pathCatalog);
  if (frames.length > 0) {
    trackEvent("prototype_detected", {
      frameCount: frames.length,
      pathCount: pathCatalog.paths.length,
      pathSelectionRequired: pathCatalog.pathSelectionRequired,
      source: "manual_scan"
    });
    trackEvent("prototype_frames_detected", {
      frame_count_bucket: getFrameCountBucket(frames.length),
      source: "manual_scan"
    });
    trackEvent("export_setup_viewed", {
      frameCount: frames.length,
      pathCount: pathCatalog.paths.length,
      pathSelectionRequired: pathCatalog.pathSelectionRequired,
      source: "manual_scan",
      freeLimit: (_a = currentEntitlement == null ? void 0 : currentEntitlement.freeExportsLimit) != null ? _a : null
    });
    trackEvent("export_settings_viewed", {
      frameCount: frames.length,
      source: "manual_scan"
    });
    if (frames.length >= 10) {
      trackEvent("power_user_detected", {
        frameCount: frames.length,
        complexity: "high",
        source: "manual_scan"
      });
    } else if (frames.length >= 5) {
      trackEvent("moderate_user_detected", {
        frameCount: frames.length,
        complexity: "medium",
        source: "manual_scan"
      });
    }
  }
  figma.ui.postMessage({
    type: "scan-complete",
    data: {
      frames,
      flow,
      unconnectedFrameCount: frames.length > 0 ? 0 : getUnconnectedTopLevelFrames().length,
      paths: pathCatalog.paths,
      pathSelectionRequired: pathCatalog.pathSelectionRequired,
      defaultPathId: pathCatalog.defaultPathId,
      pathEnumerationTruncated: pathCatalog.pathEnumerationTruncated
    }
  });
}
async function handleExportVideo(settings) {
  var _a, _b, _c, _d;
  if (exportInProgress) {
    figma.ui.postMessage({
      type: "error",
      data: { message: "An export is already in progress. Please wait for it to finish." }
    });
    return;
  }
  exportInProgress = true;
  currentExportCharged = false;
  currentExportCommitted = false;
  currentSettings = settings;
  const exportAttemptId = createExportAttemptId();
  currentExportAttemptId = exportAttemptId;
  currentExportIsFirst = !await loadSavedExportPreferences();
  figma.ui.postMessage({
    type: "export-context",
    data: { exportId: exportAttemptId, firstExport: currentExportIsFirst }
  });
  const finishWithoutEncoding = () => {
    exportInProgress = false;
    currentExportCharged = false;
    currentExportCommitted = false;
    currentExportAttemptId = null;
  };
  figma.ui.postMessage({
    type: "progress",
    data: { stage: "analyzing", percent: 5 }
  });
  const pathResolution = await resolvePrototypePathForExport(settings);
  if (!("path" in pathResolution)) {
    const { catalog, errorMessage, requiresSelection } = pathResolution;
    trackEvent("export_blocked", {
      reason: requiresSelection ? "path_selection_required" : "prototype_path_unavailable",
      pathCount: catalog.paths.length,
      pathEnumerationTruncated: catalog.pathEnumerationTruncated
    });
    if (requiresSelection) {
      figma.ui.postMessage({
        type: "path-selection-required",
        data: {
          message: errorMessage,
          paths: catalog.paths,
          pathSelectionRequired: true,
          defaultPathId: catalog.defaultPathId,
          pathEnumerationTruncated: catalog.pathEnumerationTruncated
        }
      });
    }
    figma.ui.postMessage({ type: "error", data: { message: errorMessage } });
    finishWithoutEncoding();
    return;
  }
  const { graph, path: selectedPath, selectionSource } = pathResolution;
  const exportSettings = __spreadProps(__spreadValues({}, settings), {
    selectedPathId: selectedPath.id,
    selectedPathFrameIds: [...selectedPath.frameIds],
    // The actual export path, not the all-graph count shown before a branch is
    // chosen, is the number that should drive progress and analytics.
    frameCount: selectedPath.frameCount
  });
  currentSettings = exportSettings;
  trackEvent("prototype_path_selected", {
    attempt_id: exportAttemptId,
    export_id: exportAttemptId,
    pathFrameCount: selectedPath.frameCount,
    selectionSource,
    source: "export_validation",
    preflightStatus: selectedPath.preflight.status
  });
  const email = await loadEmail();
  trackEvent("export_started", {
    attempt_id: exportAttemptId,
    export_id: exportAttemptId,
    project_id: getOpaqueProjectId(),
    resolution: exportSettings.resolution,
    hasLicense: !!email,
    frameCount: selectedPath.frameCount,
    pathFrameCount: selectedPath.frameCount,
    selectionSource,
    first_export: currentExportIsFirst,
    freeLimit: (_a = currentEntitlement == null ? void 0 : currentEntitlement.freeExportsLimit) != null ? _a : null,
    free_tier_experiment_id: (_b = currentEntitlement == null ? void 0 : currentEntitlement.freeTierExperimentId) != null ? _b : null
  });
  trackEvent("export", {
    attempt_id: exportAttemptId,
    export_id: exportAttemptId,
    resolution: exportSettings.resolution,
    hasLicense: !!email,
    frameCount: selectedPath.frameCount,
    pathFrameCount: selectedPath.frameCount,
    selectionSource
  });
  let entitlement;
  try {
    entitlement = await loadEntitlement(email);
  } catch (error) {
    if (isDevelopment()) {
      console.error("Entitlement check failed:", error);
    }
    figma.ui.postMessage({
      type: "entitlement-error",
      data: { message: ENTITLEMENT_VERIFICATION_ERROR }
    });
    finishWithoutEncoding();
    return;
  }
  const isPremium = entitlement.isPaid;
  if (!isPremium) {
    if (!entitlement.canExport) {
      const reason = "free_limit";
      trackEvent("export_blocked", {
        reason,
        exportCount: entitlement.freeExportsUsed,
        freeLimit: entitlement.freeExportsLimit,
        free_tier_experiment_id: (_c = entitlement.freeTierExperimentId) != null ? _c : null,
        daysSinceFirstExport
      });
      trackEvent("paywall_viewed", {
        reason: "free_limit_hit",
        trigger: "free_limit_reached",
        exportCount: entitlement.freeExportsUsed,
        freeLimit: entitlement.freeExportsLimit,
        free_tier_experiment_id: (_d = entitlement.freeTierExperimentId) != null ? _d : null,
        daysSinceFirstExport
      });
      figma.ui.postMessage({
        type: "free-limit-reached",
        data: {
          entitlement,
          trialExpired: false,
          daysSinceFirstExport,
          message: "Free exports used this month. Upgrade to keep exporting videos today."
        }
      });
      finishWithoutEncoding();
      return;
    }
    if (exportSettings.resolution !== FREE_RESOLUTION) {
      trackEvent("export_blocked", {
        reason: "premium_resolution",
        resolution: exportSettings.resolution,
        pathFrameCount: selectedPath.frameCount
      });
      figma.ui.postMessage({
        type: "error",
        data: { message: "HD/4K export requires Studio or Project Pass. Please upgrade or select 720p." }
      });
      finishWithoutEncoding();
      return;
    }
  }
  figma.ui.postMessage({
    type: "progress",
    data: { stage: "capturing", percent: 20 }
  });
  let capturedFrames;
  try {
    capturedFrames = await capturePrototypeFrames(selectedPath.frameIds, exportSettings, graph);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to capture the selected prototype path. Please try again.";
    trackEvent("export_failed", {
      attempt_id: currentExportAttemptId,
      reason: "frame_capture_failed",
      pathFrameCount: selectedPath.frameCount
    });
    figma.ui.postMessage({ type: "error", data: { message } });
    finishWithoutEncoding();
    return;
  }
  if (capturedFrames.length === 0) {
    figma.ui.postMessage({
      type: "error",
      data: { message: "No frames could be captured. Check that your prototype frames have visible content." }
    });
    finishWithoutEncoding();
    return;
  }
  if (!isPremium && !currentExportCharged) {
    await reserveFreeExport(email);
  }
  figma.ui.postMessage({
    type: "encode-frames",
    data: {
      frames: capturedFrames,
      settings: exportSettings,
      isPremium,
      selectedPath,
      exportAttemptId,
      anonymousId: await loadAnonymousId()
    }
  });
}
async function handleValidateLicense(licenseKey) {
  const isValid = await validateLicense(licenseKey);
  trackEvent("license_validate", { isValid });
  const entitlement = isValid ? await loadEntitlement(licenseKey.toLowerCase().trim()).catch(() => currentEntitlement) : currentEntitlement;
  if ((entitlement == null ? void 0 : entitlement.isPaid) || isValid) {
    const savedEmail = await loadEmail();
    const pendingCheckout = await loadPendingCheckout();
    const pendingCheckoutMatchesSavedAccount = Boolean(
      savedEmail && (pendingCheckout == null ? void 0 : pendingCheckout.email.toLowerCase().trim()) === savedEmail.toLowerCase().trim()
    );
    if (pendingCheckout && !pendingCheckoutMatchesSavedAccount) {
      await clearPendingCheckout();
    } else if (pendingCheckoutMatchesSavedAccount) {
      await exchangeCheckoutSessionForManagementToken(pendingCheckout == null ? void 0 : pendingCheckout.sessionId, savedEmail || void 0);
      await clearPendingCheckout();
    }
  }
  figma.ui.postMessage({
    type: "license-validated",
    data: { isValid, licenseKey, entitlement }
  });
}
async function handleOpenCheckout(email, plan, pricingMetadata = {}) {
  var _a;
  if (checkoutInProgress)
    return;
  checkoutInProgress = true;
  try {
    const selectedPlan = plan === "large_export" ? "large_export" : "monthly";
    const normalizedEmail = email.toLowerCase().trim();
    const previousEmail = (_a = await loadEmail()) == null ? void 0 : _a.toLowerCase().trim();
    if (previousEmail && previousEmail !== normalizedEmail) {
      await clearBillingManagementCapability();
      await clearPendingCheckout();
    }
    trackEvent("checkout_start", __spreadValues({ plan: selectedPlan }, pricingMetadata));
    trackEvent("checkout_started", __spreadValues({ plan: selectedPlan }, pricingMetadata));
    await saveEmail(normalizedEmail);
    if (previousEmail !== normalizedEmail) {
      trackEvent("email_captured", { source: "checkout" });
      if (!previousEmail)
        await trackOnboardingCompletedOnce({ source: "checkout" });
    }
    const anonymousIdForCheckout = await loadAnonymousId();
    const response = await fetch(`${BACKEND_URL}/api/billing/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: normalizedEmail,
        plan: selectedPlan,
        anonymousId: anonymousIdForCheckout,
        offerExperimentId: pricingMetadata.offerExperimentId,
        offerExperimentVariant: pricingMetadata.offerExperimentVariant,
        primaryOffer: pricingMetadata.primaryOffer
      })
    });
    if (response.ok) {
      const data = await response.json();
      if (data.url) {
        const sessionId = typeof data.sessionId === "string" ? data.sessionId : void 0;
        await savePendingCheckout({
          email: normalizedEmail,
          url: data.url,
          plan: selectedPlan,
          sessionId,
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          checkoutConfigVersion: CHECKOUT_SESSION_CONFIG_VERSION
        });
        const checkoutMetadata = {
          plan: selectedPlan,
          pricingVariant: data.pricingVariant || pricingMetadata.pricingVariant,
          priceLabel: data.priceLabel || pricingMetadata.priceLabel,
          amountCents: data.amountCents || pricingMetadata.amountCents,
          stripe_checkout_session_id: sessionId || null,
          offerType: data.offerType || null,
          source: pricingMetadata.source || null,
          offer_experiment_id: pricingMetadata.offerExperimentId || null,
          offer_experiment_variant: pricingMetadata.offerExperimentVariant || null,
          primary_offer: pricingMetadata.primaryOffer || null,
          frameCount: pricingMetadata.frameCount || null
        };
        trackEvent("checkout_open_attempted", checkoutMetadata);
        try {
          figma.openExternal(data.url);
          trackEvent("checkout_opened", checkoutMetadata);
        } catch (error) {
          trackEvent("checkout_open_failed", __spreadProps(__spreadValues({}, checkoutMetadata), {
            reason: error instanceof Error ? error.message.slice(0, 120) : "open_external_failed"
          }));
          throw error;
        }
        figma.notify("Opening checkout... We'll detect your payment automatically.");
        figma.ui.postMessage({
          type: "checkout-opened",
          data: {
            email: normalizedEmail,
            url: data.url,
            plan: selectedPlan,
            sessionId
          }
        });
      } else {
        trackEvent("checkout_error", {
          plan: selectedPlan,
          reason: "missing_url"
        });
        figma.notify("Failed to create checkout session. Please try again.");
        figma.ui.postMessage({
          type: "error",
          data: { message: "Checkout could not be opened. Please try again." }
        });
      }
    } else {
      const error = await response.json();
      if (response.status === 409 && error.code === "active_entitlement") {
        const entitlement = await loadEntitlement(email.toLowerCase().trim()).catch(() => currentEntitlement);
        if (entitlement == null ? void 0 : entitlement.isPaid) {
          await clearPendingCheckout();
          figma.ui.postMessage({
            type: "license-validated",
            data: { isValid: true, licenseKey: email, entitlement }
          });
          figma.notify("Your existing Studio access has been restored.");
          return;
        }
      }
      trackEvent("checkout_error", {
        plan: selectedPlan,
        status: response.status,
        reason: response.status === 409 ? "active_entitlement" : "checkout_request_failed"
      });
      figma.notify(error.error || "Failed to open checkout. Please try again.");
      figma.ui.postMessage({
        type: "error",
        data: { message: error.error || "Failed to open checkout. Please try again." }
      });
    }
  } catch (error) {
    console.error("Checkout error:", error);
    trackEvent("checkout_error", {
      plan: plan || "monthly",
      reason: "network_error"
    });
    figma.notify("Network error. Please check your connection and try again.");
    figma.ui.postMessage({
      type: "error",
      data: { message: "Network error. Please check your connection and try again." }
    });
  } finally {
    checkoutInProgress = false;
  }
}
async function handleResumeCheckout(url, email, plan) {
  const pending = await loadPendingCheckout();
  const checkoutUrl = url || (pending == null ? void 0 : pending.url);
  if (!checkoutUrl) {
    figma.notify("No checkout session found. Start checkout again.");
    return;
  }
  trackEvent("checkout_recovered", {
    plan: plan || (pending == null ? void 0 : pending.plan) || "monthly",
    email: email || (pending == null ? void 0 : pending.email) || null,
    stripe_checkout_session_id: (pending == null ? void 0 : pending.sessionId) || null
  });
  figma.openExternal(checkoutUrl);
  trackEvent("checkout_opened", {
    plan: plan || (pending == null ? void 0 : pending.plan) || "monthly",
    source: "resume_checkout",
    stripe_checkout_session_id: (pending == null ? void 0 : pending.sessionId) || null
  });
  figma.notify("Reopening checkout. ProtoVid will keep checking payment status.");
}
async function handleOpenBillingPortal() {
  try {
    const email = await loadEmail();
    const capability = await loadBillingManagementCapability();
    if (email && (capability == null ? void 0 : capability.email.toLowerCase().trim()) === email.toLowerCase().trim()) {
      const response = await fetch(`${BACKEND_URL}/api/billing/portal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ managementToken: capability.token })
      });
      if (response.ok) {
        const data = await response.json();
        if (data.url) {
          figma.openExternal(data.url);
          return;
        }
      } else if (response.status === 403) {
        await clearBillingManagementCapability();
      }
    } else if (capability) {
      await clearBillingManagementCapability();
    }
    figma.openExternal(`${BACKEND_URL}/account`);
    figma.notify("Opening secure Stripe billing management.");
  } catch (error) {
    console.error("Portal error:", error);
    figma.notify("Network error. Please try again.");
  }
}
async function handleOpenCommunityListing() {
  trackEvent("review_prompt_clicked");
  trackEvent("viral_growth_action", {
    action: "community_listing_opened",
    source: "review_prompt"
  });
  figma.openExternal("https://www.figma.com/community/plugin/1606994616321079154");
}
async function validateLicense(licenseKey) {
  if (!licenseKey)
    return false;
  try {
    const response = await fetch(`${BACKEND_URL}/api/validate-license`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ licenseKey })
    });
    if (response.ok) {
      const data = await response.json();
      return data.valid === true && data.tier === "pro";
    }
    return false;
  } catch (error) {
    console.error("License validation error:", error);
    return false;
  }
}
async function handleEncodingComplete(isPremium, usedSafeRetry = false, output = {}) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l;
  try {
    if (!isPremium) {
      const email = await loadEmail();
      if (!currentExportCharged) {
        await reserveFreeExport(email);
      }
      await commitFreeExport(email);
    }
  } catch (error) {
    if (isDevelopment()) {
      console.error("Export allowance update failed:", error);
    }
    figma.ui.postMessage({
      type: "entitlement-error",
      data: { message: ENTITLEMENT_VERIFICATION_ERROR }
    });
  } finally {
    exportInProgress = false;
  }
  const exportId = output.exportId || output.exportAttemptId || currentExportAttemptId;
  const exportMetadata = {
    export_id: exportId,
    attempt_id: exportId,
    project_id: getOpaqueProjectId(),
    resolution: currentSettings.resolution,
    isPremium,
    frameCount: (_b = (_a = output.frameCount) != null ? _a : currentSettings.frameCount) != null ? _b : null,
    usedSafeRetry,
    output_width: (_c = output.outputWidth) != null ? _c : null,
    output_height: (_d = output.outputHeight) != null ? _d : null,
    delivery_profile: (_e = output.deliveryProfile) != null ? _e : null,
    payload_bytes: (_f = output.payloadBytes) != null ? _f : null,
    upload_duration_ms: (_g = output.uploadDurationMs) != null ? _g : null,
    transcode_duration_ms: (_h = output.transcodeDurationMs) != null ? _h : null,
    export_duration_ms: (_i = output.exportDurationMs) != null ? _i : null,
    first_export: currentExportIsFirst
  };
  await trackFirstValueOnce(exportMetadata);
  await trackOnboardingCompletedOnce({
    source: "first_export",
    frameCount: exportMetadata.frameCount,
    resolution: exportMetadata.resolution
  });
  trackEvent("export_ready", exportMetadata);
  trackEvent("export_completed", exportMetadata);
  trackEvent("export_success", exportMetadata);
  trackEvent("export_succeeded", exportMetadata);
  if (!isPremium && ((_j = currentEntitlement == null ? void 0 : currentEntitlement.freeExportsUsed) != null ? _j : 0) >= 1) {
    trackEvent("review_prompt_shown", __spreadValues({
      trigger: "success_or_later"
    }, exportMetadata));
  }
  if (!isPremium) {
    trackEvent("export_success_upsell_opportunity", __spreadProps(__spreadValues({}, exportMetadata), {
      resolution: currentSettings.resolution,
      frameCount: (_k = exportMetadata.frameCount) != null ? _k : 0,
      trigger: "post_export"
    }));
    const frameCount = (_l = exportMetadata.frameCount) != null ? _l : 0;
    if (frameCount >= 10) {
      trackEvent("power_user_post_export", {
        frameCount,
        message: "complex_prototype_hd_upsell"
      });
    } else if (frameCount >= 5) {
      trackEvent("moderate_user_post_export", {
        frameCount,
        message: "multi_frame_quality_upsell"
      });
    }
  }
  if (typeof exportId === "string" && exportId.length > 0) {
    await saveExportPreferences(exportId);
  }
  figma.ui.postMessage({
    type: "export-count-updated",
    data: { entitlement: currentEntitlement }
  });
  currentExportAttemptId = null;
}
function isExportableFrame(node) {
  return node.type === "FRAME" || node.type === "COMPONENT" || node.type === "COMPONENT_SET";
}
function extractNavigations(reaction) {
  const navs = [];
  const collect = (action) => {
    if (action && action.type === "NODE" && action.destinationId) {
      navs.push({ destinationId: action.destinationId, transition: action.transition || null });
    }
  };
  if (Array.isArray(reaction.actions)) {
    for (const action of reaction.actions)
      collect(action);
  }
  collect(reaction.action);
  return navs;
}
function normalizeTransition(transition) {
  if (!transition || typeof transition.type !== "string")
    return null;
  return {
    type: transition.type,
    direction: typeof transition.direction === "string" ? transition.direction : void 0,
    duration: typeof transition.duration === "number" ? transition.duration : 0.3,
    easing: transition.easing && typeof transition.easing.type === "string" ? transition.easing.type : "EASE_OUT"
  };
}
function getNodeBounds(node) {
  const bbox = node.absoluteBoundingBox;
  if (bbox && typeof bbox.x === "number" && typeof bbox.y === "number" && typeof bbox.width === "number" && typeof bbox.height === "number" && bbox.width > 0 && bbox.height > 0) {
    return { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height };
  }
  if (typeof node.x === "number" && typeof node.y === "number" && typeof node.width === "number" && typeof node.height === "number" && node.width > 0 && node.height > 0) {
    return {
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height
    };
  }
  return null;
}
function snapshotSmartAnimateLayers(node, ancestry = [], siblingIndex = 0, out = []) {
  if (!("visible" in node) || !node.visible)
    return out;
  const normalizedName = normalizeLayerName(node.name || node.type);
  const segment = { type: node.type, name: normalizedName, index: siblingIndex };
  const path = [...ancestry, segment];
  const children = "children" in node ? node.children : [];
  if (children && children.length > 0) {
    const siblingCounts = /* @__PURE__ */ new Map();
    for (const child of children) {
      const childName = normalizeLayerName(child.name || child.type);
      const childType = child.type;
      const siblingKey = `${childType}:${childName}`;
      const siblingIndex2 = siblingCounts.get(siblingKey) || 0;
      siblingCounts.set(siblingKey, siblingIndex2 + 1);
      snapshotSmartAnimateLayers(child, path, siblingIndex2, out);
    }
    return out;
  }
  const bounds = getNodeBounds(node);
  if (!bounds)
    return out;
  const keys = buildLayerKeys(path);
  out.push({
    id: node.id,
    name: node.name,
    type: node.type,
    keyExact: keys.exact,
    keyLoose: keys.loose,
    keyLeaf: keys.leaf,
    keyParentExact: keys.parentExact,
    keyParentLoose: keys.parentLoose,
    depth: keys.depth,
    bounds,
    opacity: typeof node.opacity === "number" ? node.opacity : 1,
    rotation: typeof node.rotation === "number" ? node.rotation : 0,
    visible: true
  });
  return out;
}
async function exportNodeImage(nodeId, scale) {
  const node = await figma.getNodeByIdAsync(nodeId);
  if (!node || !("exportAsync" in node))
    return null;
  try {
    return await node.exportAsync({
      format: "PNG",
      constraint: { type: "SCALE", value: scale }
    });
  } catch (_e) {
    return null;
  }
}
async function buildSmartAnimateMotion(sourceFrame, destinationFrame) {
  const source = matchSmartAnimateLayers(sourceFrame.layers, destinationFrame.layers);
  const motions = [];
  for (const pair of source.matched) {
    const [sourceImageData, destinationImageData] = await Promise.all([
      exportNodeImage(pair.source.id, sourceFrame.exportScale),
      exportNodeImage(pair.destination.id, destinationFrame.exportScale)
    ]);
    if (!sourceImageData || !destinationImageData)
      continue;
    motions.push({
      key: pair.source.keyLeaf || pair.source.keyExact,
      source: {
        id: pair.source.id,
        bounds: scaleBounds(pair.source.bounds, sourceFrame.exportScale),
        opacity: pair.source.opacity,
        rotation: pair.source.rotation,
        imageData: sourceImageData
      },
      destination: {
        id: pair.destination.id,
        bounds: scaleBounds(pair.destination.bounds, destinationFrame.exportScale),
        opacity: pair.destination.opacity,
        rotation: pair.destination.rotation,
        imageData: destinationImageData
      }
    });
  }
  for (const snapshot of source.sourceOnly) {
    const sourceImageData = await exportNodeImage(snapshot.id, sourceFrame.exportScale);
    if (!sourceImageData)
      continue;
    motions.push({
      key: snapshot.keyLeaf || snapshot.keyExact,
      source: {
        id: snapshot.id,
        bounds: scaleBounds(snapshot.bounds, sourceFrame.exportScale),
        opacity: snapshot.opacity,
        rotation: snapshot.rotation,
        imageData: sourceImageData
      },
      destination: {
        id: "",
        bounds: scaleBounds(snapshot.bounds, sourceFrame.exportScale),
        opacity: 0,
        rotation: snapshot.rotation
      }
    });
  }
  for (const snapshot of source.destinationOnly) {
    const destinationImageData = await exportNodeImage(snapshot.id, destinationFrame.exportScale);
    if (!destinationImageData)
      continue;
    motions.push({
      key: snapshot.keyLeaf || snapshot.keyExact,
      source: {
        id: "",
        bounds: scaleBounds(snapshot.bounds, destinationFrame.exportScale),
        opacity: 0,
        rotation: snapshot.rotation
      },
      destination: {
        id: snapshot.id,
        bounds: scaleBounds(snapshot.bounds, destinationFrame.exportScale),
        opacity: snapshot.opacity,
        rotation: snapshot.rotation,
        imageData: destinationImageData
      }
    });
  }
  return motions;
}
async function enrichSmartAnimateTransitions(frames) {
  for (let i = 1; i < frames.length; i++) {
    const transition = frames[i].transitionIn;
    if (!transition || transition.type !== "SMART_ANIMATE")
      continue;
    const motions = await buildSmartAnimateMotion(frames[i - 1], frames[i]);
    if (motions.length > 0) {
      transition.smartAnimateLayers = motions;
    }
  }
}
function uniqueFrameIds(ids) {
  const seen = /* @__PURE__ */ new Set();
  const unique = [];
  for (const id of ids) {
    if (!id || seen.has(id))
      continue;
    seen.add(id);
    unique.push(id);
  }
  return unique;
}
function frameSequencesMatch(left, right) {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}
function createPrototypePathId(frameIds) {
  return `path:${frameIds.map((id) => encodeURIComponent(id)).join(">")}`;
}
function getPrototypePathPreflight(frameCount) {
  const estimatedDuration = frameCount * 2;
  if (frameCount >= RECOMMENDED_MAX_PATH_FRAMES) {
    return {
      frameCount,
      estimatedDuration,
      maxRecommendedFrames: RECOMMENDED_MAX_PATH_FRAMES,
      recommendedQuality: "720p",
      status: "split_recommended",
      message: `This path has ${frameCount} frames. For a more reliable export, split it into shorter paths or use 720p.`
    };
  }
  if (frameCount >= LONG_PATH_FRAME_THRESHOLD) {
    return {
      frameCount,
      estimatedDuration,
      maxRecommendedFrames: RECOMMENDED_MAX_PATH_FRAMES,
      recommendedQuality: "720p",
      status: "long_path",
      message: `This path has ${frameCount} frames. 720p is recommended for the most reliable delivery.`
    };
  }
  return {
    frameCount,
    estimatedDuration,
    maxRecommendedFrames: RECOMMENDED_MAX_PATH_FRAMES,
    recommendedQuality: "selected",
    status: "ready",
    message: null
  };
}
function getPrototypePathLabel(startNodeName, endNodeName, frameCount, index) {
  const start = startNodeName || "Start";
  const end = endNodeName || "End";
  return `Path ${index + 1}: ${start} \u2192 ${end} \xB7 ${frameCount} ${frameCount === 1 ? "frame" : "frames"}`;
}
function enumeratePrototypePaths(graph, startFrameIds) {
  const paths = [];
  let pathLimitReached = false;
  const addPath = (path) => {
    if (paths.length >= MAX_ENUMERATED_PROTOTYPE_PATHS) {
      pathLimitReached = true;
      return false;
    }
    paths.push(path);
    return true;
  };
  const visit = (frameId, frameIds, ancestors) => {
    if (paths.length >= MAX_ENUMERATED_PROTOTYPE_PATHS) {
      pathLimitReached = true;
      return;
    }
    const destinations = Array.from(graph.edges.get(frameId) || []);
    if (destinations.length === 0) {
      addPath({ frameIds, truncated: false, truncationReason: null });
      return;
    }
    for (const destinationId of destinations) {
      if (ancestors.has(destinationId)) {
        addPath({
          frameIds: [...frameIds, destinationId],
          truncated: true,
          truncationReason: "cycle"
        });
        continue;
      }
      const nextAncestors = new Set(ancestors);
      nextAncestors.add(destinationId);
      visit(destinationId, [...frameIds, destinationId], nextAncestors);
    }
  };
  for (const startFrameId of uniqueFrameIds(startFrameIds)) {
    if (paths.length >= MAX_ENUMERATED_PROTOTYPE_PATHS) {
      pathLimitReached = true;
      break;
    }
    visit(startFrameId, [startFrameId], /* @__PURE__ */ new Set([startFrameId]));
  }
  return {
    paths,
    // A cycle is represented by a finite, valid path and does not mean the
    // catalog is incomplete. Only the branching-path safeguard does.
    pathEnumerationTruncated: pathLimitReached
  };
}
function getRootPrototypeFrameIds(graph) {
  const incoming = /* @__PURE__ */ new Set();
  for (const destinations of graph.edges.values()) {
    for (const destinationId of destinations)
      incoming.add(destinationId);
  }
  return Array.from(graph.allFrameIds).filter((frameId) => !incoming.has(frameId));
}
async function getConfiguredPrototypeStartFrameIds() {
  const starts = [];
  const flowStartingPoints = figma.currentPage.flowStartingPoints || [];
  for (const flow of flowStartingPoints) {
    const node = await figma.getNodeByIdAsync(flow.nodeId);
    if (node && isExportableFrame(node))
      starts.push(node.id);
  }
  return uniqueFrameIds(starts);
}
async function getPrototypePathStartFrameIds(graph) {
  const configuredStarts = await getConfiguredPrototypeStartFrameIds();
  const rootStarts = getRootPrototypeFrameIds(graph);
  const candidates = uniqueFrameIds([...configuredStarts, ...rootStarts]);
  if (candidates.length > 0)
    return candidates;
  return uniqueFrameIds([...graph.edges.keys(), ...graph.allFrameIds]);
}
function createPrototypePathDescriptor(enumeratedPath, index, frameNames) {
  const { frameIds } = enumeratedPath;
  const startNodeId = frameIds[0];
  const endNodeId = frameIds[frameIds.length - 1];
  const startNodeName = frameNames.get(startNodeId) || null;
  const endNodeName = frameNames.get(endNodeId) || null;
  const frameCount = frameIds.length;
  return {
    id: createPrototypePathId(frameIds),
    frameIds: [...frameIds],
    frameCount,
    startNodeId,
    endNodeId,
    startNodeName,
    endNodeName,
    label: getPrototypePathLabel(startNodeName, endNodeName, frameCount, index),
    estimatedDuration: frameCount * 2,
    preflight: getPrototypePathPreflight(frameCount),
    truncated: enumeratedPath.truncated,
    truncationReason: enumeratedPath.truncationReason
  };
}
async function buildPrototypePathCatalog(graph, frameNames = /* @__PURE__ */ new Map(), startFrameIds) {
  const starts = startFrameIds != null ? startFrameIds : await getPrototypePathStartFrameIds(graph);
  const enumeration = enumeratePrototypePaths(graph, starts);
  const paths = enumeration.paths.map(
    (path, index) => createPrototypePathDescriptor(path, index, frameNames)
  );
  return {
    paths,
    pathSelectionRequired: paths.length > 1,
    // Even when enumeration reaches the safety cap, every emitted candidate
    // has already been validated as a connected route. Pick the shortest
    // reliable candidate so large branching prototypes can reach first value
    // without forcing a manual route decision. Keep the truncation flag so the
    // UI can explain that alternatives may not all be listed.
    defaultPathId: getRecommendedPathId(paths.map((path) => ({
      id: path.id,
      frameCount: path.frameCount,
      preflightStatus: path.preflight.status,
      truncated: path.truncated
    }))),
    pathEnumerationTruncated: enumeration.pathEnumerationTruncated
  };
}
function getCatalogFrameIds(graph, catalog) {
  const frameIds = new Set(graph.allFrameIds);
  for (const path of catalog.paths) {
    for (const frameId of path.frameIds)
      frameIds.add(frameId);
  }
  return Array.from(frameIds);
}
async function collectPrototypeFrameSummaries(frameIds) {
  const frames = [];
  const frameNames = /* @__PURE__ */ new Map();
  for (const id of uniqueFrameIds(frameIds)) {
    const node = await figma.getNodeByIdAsync(id);
    if (!node || !isExportableFrame(node))
      continue;
    const frame = node;
    frames.push({
      id: frame.id,
      name: frame.name,
      width: frame.width,
      height: frame.height
    });
    frameNames.set(frame.id, frame.name);
  }
  return { frames, frameNames };
}
function hasValidAdjacentPrototypeFrames(frameIds, graph) {
  var _a;
  if (frameIds.length === 0)
    return false;
  for (let index = 1; index < frameIds.length; index++) {
    if (!((_a = graph.edges.get(frameIds[index - 1])) == null ? void 0 : _a.has(frameIds[index])))
      return false;
  }
  return true;
}
function getSelectedPathFrameIds(settings) {
  if (settings.selectedPathFrameIds === void 0)
    return void 0;
  if (!Array.isArray(settings.selectedPathFrameIds) || settings.selectedPathFrameIds.length === 0) {
    return null;
  }
  const frameIds = settings.selectedPathFrameIds;
  return frameIds.every((frameId) => typeof frameId === "string" && frameId.length > 0) ? [...frameIds] : null;
}
async function resolvePrototypePathForExport(settings) {
  const graph = await buildPrototypeGraph();
  const catalog = await buildPrototypePathCatalog(graph);
  if (catalog.paths.length === 0) {
    return {
      errorMessage: "No connected prototype path found. Set up prototype connections, then scan again.",
      catalog,
      requiresSelection: false
    };
  }
  const selectedPathId = typeof settings.selectedPathId === "string" ? settings.selectedPathId.trim() : "";
  if (settings.selectedPathId !== void 0 && !selectedPathId) {
    return {
      errorMessage: "The selected prototype path is invalid. Scan again and choose a path.",
      catalog,
      requiresSelection: true
    };
  }
  const selectedFrameIds = getSelectedPathFrameIds(settings);
  if (selectedFrameIds === null) {
    return {
      errorMessage: "The selected prototype path is invalid. Scan again and choose a path.",
      catalog,
      requiresSelection: true
    };
  }
  if (selectedPathId) {
    const path2 = catalog.paths.find((candidate) => candidate.id === selectedPathId);
    if (!path2 || !hasValidAdjacentPrototypeFrames(path2.frameIds, graph)) {
      return {
        errorMessage: "This prototype path changed since it was scanned. Scan again and choose a current path.",
        catalog,
        requiresSelection: true
      };
    }
    if (selectedFrameIds && !frameSequencesMatch(path2.frameIds, selectedFrameIds)) {
      return {
        errorMessage: "The selected prototype path no longer matches its frame order. Scan again and choose a path.",
        catalog,
        requiresSelection: true
      };
    }
    return { graph, catalog, path: path2, selectionSource: "selected_path_id" };
  }
  if (selectedFrameIds) {
    const path2 = catalog.paths.find((candidate) => frameSequencesMatch(candidate.frameIds, selectedFrameIds));
    if (!path2 || !hasValidAdjacentPrototypeFrames(path2.frameIds, graph)) {
      return {
        errorMessage: "The selected frame order is no longer a connected prototype path. Scan again and choose a path.",
        catalog,
        requiresSelection: true
      };
    }
    return { graph, catalog, path: path2, selectionSource: "selected_frame_ids" };
  }
  if (!catalog.defaultPathId) {
    return {
      errorMessage: catalog.pathEnumerationTruncated ? "This prototype has many possible paths. Scan again and choose the exact path to export." : "This prototype branches into multiple paths. Scan again and choose the path to export.",
      catalog,
      requiresSelection: true
    };
  }
  const path = catalog.paths.find((candidate) => candidate.id === catalog.defaultPathId);
  if (!path) {
    return {
      errorMessage: "No recommended prototype path is available. Scan again and choose a path.",
      catalog,
      requiresSelection: true
    };
  }
  if (!hasValidAdjacentPrototypeFrames(path.frameIds, graph)) {
    return {
      errorMessage: "The detected prototype path is no longer connected. Scan again and choose a path.",
      catalog,
      requiresSelection: true
    };
  }
  return {
    graph,
    catalog,
    path,
    selectionSource: catalog.pathSelectionRequired ? "automatic_recommended_path" : "automatic_single_path"
  };
}
async function buildPrototypeGraph() {
  const edges = /* @__PURE__ */ new Map();
  const allFrameIds = /* @__PURE__ */ new Set();
  const transitions = /* @__PURE__ */ new Map();
  async function walkNode(node, sourceFrameId) {
    if ("reactions" in node && node.reactions && node.reactions.length > 0) {
      for (const reaction of node.reactions) {
        for (const nav of extractNavigations(reaction)) {
          const destNode = await figma.getNodeByIdAsync(nav.destinationId);
          if (destNode && isExportableFrame(destNode)) {
            if (!edges.has(sourceFrameId))
              edges.set(sourceFrameId, /* @__PURE__ */ new Set());
            edges.get(sourceFrameId).add(nav.destinationId);
            allFrameIds.add(nav.destinationId);
            const meta = normalizeTransition(nav.transition);
            if (meta) {
              if (!transitions.has(sourceFrameId))
                transitions.set(sourceFrameId, /* @__PURE__ */ new Map());
              transitions.get(sourceFrameId).set(nav.destinationId, meta);
            }
          }
        }
      }
    }
    if ("children" in node) {
      for (const child of node.children) {
        await walkNode(child, sourceFrameId);
      }
    }
  }
  for (const topNode of figma.currentPage.children) {
    if (isExportableFrame(topNode)) {
      await walkNode(topNode, topNode.id);
    }
  }
  for (const sourceId of edges.keys()) {
    allFrameIds.add(sourceId);
  }
  return { edges, allFrameIds, transitions };
}
async function capturePrototypeFrames(frameIds, settings, graph) {
  var _a, _b, _c;
  if (!hasValidAdjacentPrototypeFrames(frameIds, graph)) {
    throw new Error("The selected frame order is not a connected prototype path. Scan again and choose a path.");
  }
  const frames = [];
  const resolutionMap = {
    "720p": { width: 1280, height: 720 },
    "1080p": { width: 1920, height: 1080 },
    "4K": { width: 3840, height: 2160 }
  };
  const targetRes = resolutionMap[settings.resolution];
  const totalFrames = Math.max(frameIds.length, 1);
  for (let index = 0; index < frameIds.length; index++) {
    const frameId = frameIds[index];
    const node = await figma.getNodeByIdAsync(frameId);
    if (!node || !isExportableFrame(node)) {
      throw new Error("One of the selected frames no longer exists. Scan again and choose a current path.");
    }
    const frame = node;
    try {
      const scale = Math.min(calculateScale(frame, targetRes), 4);
      const imageData = await frame.exportAsync({
        format: "PNG",
        constraint: { type: "SCALE", value: scale }
      });
      const layers = snapshotSmartAnimateLayers(frame);
      const previousFrameId = index > 0 ? frameIds[index - 1] : null;
      if (previousFrameId && !((_a = graph.edges.get(previousFrameId)) == null ? void 0 : _a.has(frame.id))) {
        throw new Error("The selected frame order is no longer connected. Scan again and choose a path.");
      }
      const transitionIn = previousFrameId ? (_c = (_b = graph.transitions.get(previousFrameId)) == null ? void 0 : _b.get(frame.id)) != null ? _c : null : null;
      frames.push({
        nodeId: frame.id,
        nodeName: frame.name,
        imageData,
        width: Math.round(frame.width * scale),
        height: Math.round(frame.height * scale),
        exportScale: scale,
        layers,
        transitionIn
      });
      figma.ui.postMessage({
        type: "progress",
        data: {
          stage: "capturing",
          percent: Math.min(60, 20 + frames.length * 40 / totalFrames)
        }
      });
    } catch (error) {
      console.error("Failed to export frame " + frame.name + ":", error);
      const detail = error instanceof Error && error.message ? ` ${error.message}` : "";
      throw new Error(`Could not capture "${frame.name}" from the selected path.${detail}`);
    }
  }
  figma.ui.postMessage({
    type: "progress",
    data: { stage: "rendering", percent: 25 }
  });
  await enrichSmartAnimateTransitions(frames);
  figma.ui.postMessage({
    type: "progress",
    data: { stage: "rendering", percent: 55 }
  });
  return frames;
}
function calculateScale(frame, targetRes) {
  const scaleX = targetRes.width / frame.width;
  const scaleY = targetRes.height / frame.height;
  return Math.min(scaleX, scaleY);
}
function analyzePrototypeFlow(frames, hasTransitions, pathCatalog) {
  const maxPathFrameCount = pathCatalog.paths.reduce(
    (max, path) => Math.max(max, path.frameCount),
    0
  );
  const dimensionSignatures = new Set(
    frames.filter((frame) => typeof frame.width === "number" && typeof frame.height === "number").map((frame) => `${Math.round(frame.width)}x${Math.round(frame.height)}`)
  );
  return {
    totalFrames: frames.length,
    estimatedDuration: frames.length * 2,
    hasTransitions,
    pathCount: pathCatalog.paths.length,
    pathSelectionRequired: pathCatalog.pathSelectionRequired,
    defaultPathId: pathCatalog.defaultPathId,
    maxPathFrameCount,
    pathEnumerationTruncated: pathCatalog.pathEnumerationTruncated,
    mixedDimensions: dimensionSignatures.size > 1
  };
}
