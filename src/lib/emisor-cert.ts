/**
 * Resolves the certificate password for an emisor row.
 * Canonical field: password_certificado (encrypted).
 * Fallback: certificado_password_encrypted (legacy).
 * Never prefer certificado_password (plaintext legacy).
 */
export type EmisorCertPasswordRow = {
  password_certificado?: string | null;
  certificado_password_encrypted?: string | null;
  certificado_password?: string | null;
};

export function pickEncryptedCertPassword(
  row: EmisorCertPasswordRow
): string | null {
  return (
    row.password_certificado ||
    row.certificado_password_encrypted ||
    null
  );
}
