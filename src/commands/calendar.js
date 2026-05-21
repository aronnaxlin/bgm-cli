import { BangumiClient } from "../core/client.js";
import { getConfig } from "../core/config.js";
import { printResult } from "../core/output.js";
import { resolveWeekdaySubcommand, todayWeekdayId } from "../utils/calendar.js";

export async function runCalendarCommand(command, args, context) {
  const client = new BangumiClient(getConfig());
  const data = await client.getCalendar();

  const subcommand = (command && !String(command).startsWith("--"))
    ? command
    : null;

  if (subcommand === "all") {
    printResult({ resource: "calendar", data }, context);
    return;
  }

  const weekdayId = subcommand
    ? resolveWeekdaySubcommand(subcommand)
    : null;

  if (weekdayId !== null) {
    const filtered = data.filter((d) => d.weekday.id === weekdayId);
    printResult({ resource: "calendar", data: filtered }, context);
    return;
  }

  const todayId = todayWeekdayId();
  const filtered = data.filter((d) => d.weekday.id === todayId);
  printResult({ resource: "calendar", data: filtered }, context);
}
