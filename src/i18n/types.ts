export type MessageKey =
  // Labels
  | "label.context"
  | "label.usage"
  | "label.weekly"
  | "label.approxRam"
  | "label.promptCache"
  | "label.rules"
  | "label.hooks"
  | "label.estimatedCost"
  | "label.cost"
  | "label.tokens"
  | "label.sessionStarted"
  | "label.lastReply"
  | "label.addedDirs"
  | "label.outputStyle"
  // Status
  | "status.limitReached"
  | "status.limitShort"
  | "status.allTodosComplete"
  | "status.expired"
  | "status.ccrModelRouting"
  | "status.ccrModelHookMissing"
  // Format
  | "format.resets"
  | "format.resetsIn"
  | "format.at"
  | "format.in"
  | "format.cache"
  | "format.out"
  | "format.tok"
  | "format.tokPerSec"
  | "format.more"
  | "format.justNow"
  | "format.ago"
  // Init
  | "init.initializing"
  | "init.macosNote"
  | "error.prefix"
  | "error.unknown";

export type Messages = Record<MessageKey, string>;

export type Language = "en" | "zh";
