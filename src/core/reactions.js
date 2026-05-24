import { CommandError } from "./output.js";

const TOPIC_POST_REACTION_VALUES = Object.freeze([54, 62, 79, 80, 85, 88, 90, 104, 122, 140]);
const SUBJECT_COLLECT_REACTION_VALUES = Object.freeze([54]);

export const BANGUMI_REACTION_TARGETS = Object.freeze({
  subjectPost: Object.freeze({
    label: "subject discussion reply",
    allowedValues: TOPIC_POST_REACTION_VALUES,
    note: "Subject and group topic replies share the p1 topic-post reaction shape; values were probed on a group topic post.",
  }),
  groupPost: Object.freeze({
    label: "group topic reply",
    allowedValues: TOPIC_POST_REACTION_VALUES,
    note: "Values probed live on a group topic post.",
  }),
  episodeComment: Object.freeze({
    label: "episode comment",
    allowedValues: TOPIC_POST_REACTION_VALUES,
    note: "Accepted values are inferred from the same p1 reaction set as topic posts; re-check if Bangumi changes the behavior.",
  }),
  subjectCollect: Object.freeze({
    label: "subject collection comment",
    allowedValues: SUBJECT_COLLECT_REACTION_VALUES,
    note: "Value 54 is probed valid; 79 is probed invalid for this target.",
  }),
  timeline: Object.freeze({
    label: "timeline entry",
    allowedValues: TOPIC_POST_REACTION_VALUES,
    note: "Accepted values are inferred from the same p1 reaction set as topic posts; re-check if Bangumi changes the behavior.",
  }),
});

export function normalizeBangumiReactionValue(value, targetKey) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsed = Number.parseInt(String(value), 10);
  if (Number.isNaN(parsed)) {
    throw new CommandError(`Expected reaction value to be an integer, received: ${value}`);
  }
  if (parsed <= 0) {
    throw new CommandError(`Expected reaction value to be > 0, received: ${value}`);
  }

  const target = BANGUMI_REACTION_TARGETS[targetKey];
  if (!target) {
    return parsed;
  }

  const allowedValues = target.allowedValues;
  if (Array.isArray(allowedValues) && !allowedValues.includes(parsed)) {
    throw new CommandError([
      `Unsupported reaction value ${parsed} for ${target.label}.`,
      `Known supported values: ${allowedValues.join(", ")}.`,
      "Bangumi only accepts a subset of site emotes as reaction stickers.",
    ].join(" "));
  }

  return parsed;
}
