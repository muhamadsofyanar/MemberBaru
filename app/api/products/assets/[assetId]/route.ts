import {NextResponse} from "next/server";import {getSessionUser} from "@/lib/auth";import {db} from "@/lib/db";import {resolvePrivateStoragePath, readPrivateAssetBuffer} from "@/lib/file-store";

function extFor(mime: string): string {
  const map: Record<string, string> = {
    "application/pdf": "pdf",
    "application/zip": "zip",
    "application/x-zip-compressed": "zip",
    "application/octet-stream": "bin",
  };
  return map[mime] || "bin";
}

export async function GET(_req:Request,{params}:{params:Promise<{assetId:string}>}){
  const user = await getSessionUser();
  if(!user) return NextResponse.json({error:"Login diperlukan."},{status:401});
  const {assetId} = await params;
  const asset = await db.productAsset.findUnique({where:{id:assetId}});
  if(!asset) return NextResponse.json({error:"Asset tidak ditemukan."},{status:404});
  const okViaOwner = asset.productId ? !!(await db.orderItem.count({
    where: { productId: asset.productId, order: { userId: user.id, status: "PAID" } }
  })) : false;
  const okViaEntitlement = !!(await db.entitlement.count({
    where: { userId: user.id, kind: "ASSET", grantRefId: asset.id }
  }));
  const okViaGrant = !!(await db.orderGrant.count({
    where: { order: { userId: user.id, status: "PAID" as any }, kind: "ASSET", grantRefId: asset.id }
  }));
  const okViaAdmin = user.role === "ADMIN";
  if (!(okViaOwner || okViaEntitlement || okViaGrant || okViaAdmin)) {
    return NextResponse.json({ error: "Akses asset ditolak." }, { status: 403 });
  }
  if(user.role !== "ADMIN") {
    const licenses=await db.softwareLicense.findMany({where:{userId:user.id,productId:asset.productId}});
    if(licenses.length && !licenses.some(lic=>lic.status==="active" && (!lic.expiresAt || lic.expiresAt>new Date())))return NextResponse.json({error:"Lisensi tidak aktif atau kedaluwarsa."},{status:403});
  }
  if (!asset.storageKey) return NextResponse.json({error:"Asset belum tersimpan."},{status:404});
  const read = readPrivateAssetBuffer(asset.storageKey);
  if (!read.exists || !read.buffer) return NextResponse.json({error:"Berkas tidak ditemukan di storage."},{status:404});
  const name = asset.originalName || `asset-${asset.id}.${extFor(asset.mime)}`;
  return new Response(new Uint8Array(read.buffer), {
    headers: {
      "Content-Type": asset.mime || "application/octet-stream",
      "Content-Length": String(read.buffer.length),
      "Content-Disposition": `attachment; filename="${encodeURIComponent(name)}"`,
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Security-Policy": "sandbox",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
