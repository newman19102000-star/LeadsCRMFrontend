// WhatsApp click-to-chat helpers. Numbers without a country code are treated as Indian (+91).

export function toWhatsAppNumber(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  if (digits.length >= 11 && digits.length <= 15) return digits; // already international
  return null;
}

// Opens an empty chat: the WhatsApp app on phones, WhatsApp Desktop or Web on computers.
export function whatsAppChatUrl(raw) {
  const n = toWhatsAppNumber(raw);
  return n ? `https://wa.me/${n}` : null;
}
