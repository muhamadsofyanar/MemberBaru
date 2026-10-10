type Message = { to: string; name: string; invoice: string; status: "PAID" | "REJECTED" };

export async function sendOrderNotification(message: Message) {
  const text = message.status === "PAID"
    ? `Halo ${message.name}, pembayaran ${message.invoice} telah disetujui. Membership Anda sekarang aktif.`
    : `Halo ${message.name}, pembayaran ${message.invoice} belum dapat disetujui. Silakan cek dashboard atau hubungi admin.`;

  if (process.env.STARSENDER_API_URL && process.env.STARSENDER_API_KEY && message.to) {
    await fetch(process.env.STARSENDER_API_URL, {
      method: "POST",
      signal: AbortSignal.timeout(10000),
      headers: { "Content-Type": "application/json", Authorization: process.env.STARSENDER_API_KEY },
      body: JSON.stringify({ to: message.to, message: text, device_id: process.env.STARSENDER_DEVICE_ID }),
    }).then(response => { if (!response.ok) console.error("Order notification delivery failed"); }).catch(() => { console.error("Order notification connection failed"); });
  }
}
