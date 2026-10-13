import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/platform/admin";
import { getDb } from "@/lib/cf/bindings";
import { PlatformRepository } from "@/lib/db/repositories/platform";
import { idSchema } from "@/lib/validation/actions";
import { getReceipt, receiptResponse } from "@/lib/finance/receipts";

export const dynamic = "force-dynamic";

/** Open a receipt that came by email (Dev Center finance only). The file key comes from the stored row. */
export async function GET(req: Request) {
  await requirePlatformAdmin();
  const id = idSchema.safeParse(new URL(req.url).searchParams.get("id"));
  if (!id.success) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const row = await new PlatformRepository(await getDb()).findReceiptInbox(id.data);
  if (!row?.fileKey) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return receiptResponse(await getReceipt(row.fileKey), row.fileName ?? "receipt");
}
