export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function formatCPF(value: string): string {
  const digits = onlyDigits(value).slice(0, 11);
  const part1 = digits.slice(0, 3);
  const part2 = digits.slice(3, 6);
  const part3 = digits.slice(6, 9);
  const part4 = digits.slice(9, 11);
  let out = part1;
  if (part2) out += `.${part2}`;
  if (part3) out += `.${part3}`;
  if (part4) out += `-${part4}`;
  return out;
}

function cpfCheckDigit(digits: string, weights: number[]): number {
  const total = digits.split("").reduce((sum, d, i) => sum + Number(d) * weights[i], 0);
  const remainder = total % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

export function isValidCPF(value: string): boolean {
  const digits = onlyDigits(value);
  if (digits.length !== 11) return false;
  if (digits === digits[0].repeat(11)) return false;
  const d1 = cpfCheckDigit(digits.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  if (d1 !== Number(digits[9])) return false;
  const d2 = cpfCheckDigit(digits.slice(0, 10), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  if (d2 !== Number(digits[10])) return false;
  return true;
}

export function formatPhone(value: string): string {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 10) {
    // Fixo: (00) 0000-0000
    const ddd = digits.slice(0, 2);
    const part1 = digits.slice(2, 6);
    const part2 = digits.slice(6, 10);
    let out = ddd ? `(${ddd}` : "";
    if (digits.length > 2) out += ") ";
    out += part1;
    if (part2) out += `-${part2}`;
    return out;
  }
  // Celular: (00) 00000-0000
  const ddd = digits.slice(0, 2);
  const part1 = digits.slice(2, 7);
  const part2 = digits.slice(7, 11);
  let out = `(${ddd}) `;
  out += part1;
  if (part2) out += `-${part2}`;
  return out;
}
