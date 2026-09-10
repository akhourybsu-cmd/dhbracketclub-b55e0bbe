export const MIN_PICK_SCORE = 1;
export const MAX_PICK_SCORE = 10;

export interface DraftGradingPick {
  pickKey: string;
  pickId: string;
  pickText: string;
}

export interface DraftGradingParticipant {
  participantKey: string;
  userId: string;
  picks: DraftGradingPick[];
}

export interface ValidatedPickRating {
  pick_id: string;
  pick_text: string;
  score: number;
  explanation: string;
}

export interface ValidatedDraftGrade {
  user_id: string;
  total_score: number;
  summary: string;
  pick_ratings: ValidatedPickRating[];
}

export interface ValidatedPickRegrade {
  new_score: number;
  new_explanation: string;
  resolution_note: string;
}

export class DraftGradingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DraftGradingValidationError";
  }
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new DraftGradingValidationError(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function nonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new DraftGradingValidationError(`${label} must be a non-empty string.`);
  }
  return value.trim();
}

function normalizedScore(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new DraftGradingValidationError(`${label} must be a finite number.`);
  }
  if (value < MIN_PICK_SCORE || value > MAX_PICK_SCORE) {
    throw new DraftGradingValidationError(
      `${label} must be between ${MIN_PICK_SCORE.toFixed(1)} and ${MAX_PICK_SCORE.toFixed(1)}.`,
    );
  }
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

/**
 * Treat model output as untrusted input. A grade is accepted only when every
 * expected participant and every expected pick appears exactly once with a
 * valid score and explanation. Totals are always derived locally.
 */
export function validateDraftGradingResults(
  rawResults: unknown,
  roster: DraftGradingParticipant[],
): ValidatedDraftGrade[] {
  if (!Array.isArray(rawResults)) {
    throw new DraftGradingValidationError("results must be an array.");
  }
  if (rawResults.length !== roster.length) {
    throw new DraftGradingValidationError(
      `Expected ${roster.length} participant results, received ${rawResults.length}.`,
    );
  }

  const expectedParticipants = new Map(roster.map((entry) => [entry.participantKey, entry]));
  const receivedParticipants = new Map<string, Record<string, unknown>>();

  rawResults.forEach((value, index) => {
    const candidate = record(value, `results[${index}]`);
    const participantKey = nonEmptyString(
      candidate.participant_key,
      `results[${index}].participant_key`,
    );
    if (!expectedParticipants.has(participantKey)) {
      throw new DraftGradingValidationError(`Unknown participant_key "${participantKey}".`);
    }
    if (receivedParticipants.has(participantKey)) {
      throw new DraftGradingValidationError(`Duplicate participant_key "${participantKey}".`);
    }
    receivedParticipants.set(participantKey, candidate);
  });

  return roster.map((participant) => {
    const candidate = receivedParticipants.get(participant.participantKey);
    if (!candidate) {
      throw new DraftGradingValidationError(
        `Missing result for participant_key "${participant.participantKey}".`,
      );
    }

    const summary = nonEmptyString(
      candidate.summary,
      `${participant.participantKey}.summary`,
    );
    if (!Array.isArray(candidate.pick_ratings)) {
      throw new DraftGradingValidationError(
        `${participant.participantKey}.pick_ratings must be an array.`,
      );
    }
    if (candidate.pick_ratings.length !== participant.picks.length) {
      throw new DraftGradingValidationError(
        `${participant.participantKey} expected ${participant.picks.length} pick ratings, received ${candidate.pick_ratings.length}.`,
      );
    }

    const expectedPicks = new Map(participant.picks.map((pick) => [pick.pickKey, pick]));
    const receivedPicks = new Map<string, Record<string, unknown>>();
    candidate.pick_ratings.forEach((value, index) => {
      const rating = record(value, `${participant.participantKey}.pick_ratings[${index}]`);
      const pickKey = nonEmptyString(
        rating.pick_key,
        `${participant.participantKey}.pick_ratings[${index}].pick_key`,
      );
      if (!expectedPicks.has(pickKey)) {
        throw new DraftGradingValidationError(
          `Unknown pick_key "${pickKey}" for ${participant.participantKey}.`,
        );
      }
      if (receivedPicks.has(pickKey)) {
        throw new DraftGradingValidationError(`Duplicate pick_key "${pickKey}".`);
      }
      receivedPicks.set(pickKey, rating);
    });

    const pickRatings = participant.picks.map((pick) => {
      const rating = receivedPicks.get(pick.pickKey);
      if (!rating) {
        throw new DraftGradingValidationError(`Missing rating for pick_key "${pick.pickKey}".`);
      }
      return {
        pick_id: pick.pickId,
        pick_text: pick.pickText,
        score: normalizedScore(rating.score, `${pick.pickKey}.score`),
        explanation: nonEmptyString(rating.explanation, `${pick.pickKey}.explanation`),
      };
    });

    return {
      user_id: participant.userId,
      total_score: Math.round(
        (pickRatings.reduce((sum, rating) => sum + rating.score, 0) + Number.EPSILON) * 10,
      ) / 10,
      summary,
      pick_ratings: pickRatings,
    };
  });
}

export function validatePickRegrade(raw: unknown): ValidatedPickRegrade {
  const candidate = record(raw, "regrade");
  return {
    new_score: normalizedScore(candidate.new_score, "new_score"),
    new_explanation: nonEmptyString(candidate.new_explanation, "new_explanation"),
    resolution_note: nonEmptyString(candidate.resolution_note, "resolution_note"),
  };
}

export function rankValidatedDraftGrades(
  grades: ValidatedDraftGrade[],
  lastPickTime: Map<string, string>,
): ValidatedDraftGrade[] {
  const metrics = (grade: ValidatedDraftGrade) => {
    const scores = grade.pick_ratings.map((pick) => pick.score);
    return {
      max: Math.max(...scores),
      elite: scores.filter((score) => score >= 8).length,
      min: Math.min(...scores),
      avg: scores.reduce((sum, score) => sum + score, 0) / scores.length,
    };
  };

  return [...grades].sort((a, b) => {
    if (b.total_score !== a.total_score) return b.total_score - a.total_score;
    const aMetrics = metrics(a);
    const bMetrics = metrics(b);
    if (bMetrics.max !== aMetrics.max) return bMetrics.max - aMetrics.max;
    if (bMetrics.elite !== aMetrics.elite) return bMetrics.elite - aMetrics.elite;
    if (bMetrics.min !== aMetrics.min) return bMetrics.min - aMetrics.min;
    if (bMetrics.avg !== aMetrics.avg) return bMetrics.avg - aMetrics.avg;
    const aTime = lastPickTime.get(a.user_id) || "";
    const bTime = lastPickTime.get(b.user_id) || "";
    return aTime < bTime ? -1 : aTime > bTime ? 1 : 0;
  });
}
