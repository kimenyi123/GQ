import { signPayload } from "./hmac";

export type MockRraRecord = {
  gqId?: string;
  tin?: string;
  amount?: number | null;
  status?: string;
  [key: string]: unknown;
};

export function mockRraPush(record: MockRraRecord) {
  const acceptedAt = new Date().toISOString();
  const sdcNumber = `SDC-${Math.floor(100000 + Math.random() * 900000)}`;
  const response = {
    accepted: true,
    acceptedAt,
    sdcNumber,
    rraRef: `RRA-${Date.now()}`,
    record,
  };
  const body = JSON.stringify(response);

  return {
    ...response,
    signature: signPayload(body, process.env.GQ_HMAC_SECRET ?? "dev"),
  };
}
