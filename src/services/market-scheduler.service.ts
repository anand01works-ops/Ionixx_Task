import { DateTime } from "luxon";
import { AppConfig } from "../config";

export class MarketSchedulerService {
  constructor(private readonly config: AppConfig) {}

  nextExecution(referenceDate: Date | string = new Date()): string {
    let current: DateTime;
    if (typeof referenceDate === "string") {
      const parsed = DateTime.fromISO(referenceDate, { setZone: true });
      if (!parsed.isValid) throw new Error("Invalid reference date.");
      current = parsed.setZone(this.config.marketTimezone);
    } else {
      const parsed = DateTime.fromJSDate(referenceDate);
      if (!parsed.isValid) throw new Error("Invalid reference date.");
      current = parsed.setZone(this.config.marketTimezone);
    }

    let opening = current.set({ hour: 9, minute: 30, second: 0, millisecond: 0 });
    const closing = current.set({ hour: 16, minute: 0, second: 0, millisecond: 0 });

    if (current.weekday >= 6) {
      opening = this.nextWeekdayOpening(opening);
    } else if (current < opening) {
      return opening.toUTC().toISO()!;
    } else if (current >= closing) {
      opening = opening.plus({ days: 1 });
      while (opening.weekday >= 6) opening = opening.plus({ days: 1 });
    }

    if (current.weekday === opening.weekday && current >= opening && current < closing) {
      return current.toUTC().toISO()!;
    }
    return opening.toUTC().toISO()!;
  }

  private nextWeekdayOpening(opening: DateTime): DateTime {
    let next = opening;
    do {
      next = next.plus({ days: 1 });
    } while (next.weekday >= 6);
    return next;
  }
}
