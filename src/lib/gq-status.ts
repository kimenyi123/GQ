export function hasVsdcStamp(input: {
  vsdcSignature?: string | null;
  vsdcInternalData?: string | null;
}) {
  return Boolean(input.vsdcSignature?.trim() && input.vsdcInternalData?.trim());
}

/** Citizen-facing status: never DONE without a real VSDC stamp. */
export function effectiveCitizenStatus(
  dbStatus: string,
  vsdcSignature?: string | null,
  vsdcInternalData?: string | null,
) {
  if (dbStatus === "REFUNDED" || dbStatus === "FAILED") return dbStatus;
  if (hasVsdcStamp({ vsdcSignature, vsdcInternalData }) && dbStatus === "DONE") return "DONE";
  if (!hasVsdcStamp({ vsdcSignature, vsdcInternalData })) return "GENERATING";
  return dbStatus;
}

export const CITIZEN_TIMELINE = [
  { id: "RECEIVED", title: "Saba byakiriwe", hint: "GQ integrity seal applied" },
  { id: "GENERATING", title: "Birimo gutegurwa", hint: "Seller / Ishyiga VSDC processing" },
  { id: "DONE", title: "Fagitire yoherejwe", hint: "RRA VSDC stamp received" },
] as const;

export function citizenTimelineState(
  vsdcSignature?: string | null,
  vsdcInternalData?: string | null,
) {
  const stamped = hasVsdcStamp({ vsdcSignature, vsdcInternalData });
  return CITIZEN_TIMELINE.map((step) => {
    if (step.id === "RECEIVED") {
      return { ...step, done: true, current: false };
    }
    if (step.id === "GENERATING") {
      return { ...step, done: stamped, current: !stamped };
    }
    return { ...step, done: stamped, current: stamped };
  });
}
