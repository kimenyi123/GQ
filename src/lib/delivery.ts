import { prisma } from "./prisma";

function maskPhone(phone: string) {
  const lastFour = phone.slice(-4);
  return `***${lastFour}`;
}

export function mockSms(phone: string, message: string) {
  console.log(`[MOCK SMS] to=${maskPhone(phone)} message=${message}`);
}

export function mockEmail(email: string, subject: string, message: string) {
  console.log(`[MOCK EMAIL] to=${email} subject=${subject} message=${message}`);
}

export async function markDelivered(gqId: string, via: string) {
  return prisma.globalQr.update({
    where: { gqId },
    data: {
      deliveredVia: via,
      deliveredTs: new Date(),
    },
  });
}
