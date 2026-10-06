/** Error thrown when a primer sequence fails validation. */
export class PrimerValidationError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'PrimerValidationError';
    this.code = code;
  }
}

/** Minimum sequence length accepted for thermodynamic analysis. */
export const MIN_SEQUENCE_LENGTH = 4;
/** Maximum sequence length accepted (protects O(n²)–O(n³) structure scans). */
export const MAX_SEQUENCE_LENGTH = 500;

const VALID_PATTERN = /^[ACGT RYSWKMBDHVN]+$/i;

/**
 * Normalises (trims, upper-cases) and validates a primer sequence.
 *
 * @throws {PrimerValidationError} on empty input, invalid characters
 * (including `U` — this is a DNA library, use `T`), or out-of-range length.
 */
export function normalizeSequence(input: string): string {
  if (typeof input !== 'string') {
    throw new PrimerValidationError('INVALID_TYPE', 'Primer sequence must be a string.');
  }
  const seq = input.trim().toUpperCase().replace(/\s+/g, '');
  if (seq.length === 0) {
    throw new PrimerValidationError('EMPTY_SEQUENCE', 'Primer sequence is empty.');
  }
  if (seq.includes('U')) {
    throw new PrimerValidationError(
      'URACIL_DETECTED',
      'Uracil (U) is RNA. For DNA primers, replace U with T.',
    );
  }
  if (!VALID_PATTERN.test(seq)) {
    const bad = [...seq].find((c) => !VALID_PATTERN.test(c));
    throw new PrimerValidationError(
      'INVALID_CHARACTER',
      `Invalid nucleotide character: "${bad}". ` +
        'Allowed IUPAC codes: A C G T R Y S W K M B D H V N.',
    );
  }
  if (seq.length < MIN_SEQUENCE_LENGTH) {
    throw new PrimerValidationError(
      'SEQUENCE_TOO_SHORT',
      `Sequence too short (${seq.length} nt). Minimum is ${MIN_SEQUENCE_LENGTH} nt ` +
        'for thermodynamic analysis.',
    );
  }
  if (seq.length > MAX_SEQUENCE_LENGTH) {
    throw new PrimerValidationError(
      'SEQUENCE_TOO_LONG',
      `Sequence too long (${seq.length} nt). Maximum is ${MAX_SEQUENCE_LENGTH} nt.`,
    );
  }
  return seq;
}
