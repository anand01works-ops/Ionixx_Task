import { loadConfig } from "../../src/config";
import { MarketSchedulerService } from "../../src/services/market-scheduler.service";

describe("MarketSchedulerService", () => {
  const scheduler = new MarketSchedulerService(loadConfig());

  test("before opening schedules today's opening", () => {
    expect(scheduler.nextExecution("2026-11-23T14:00:00Z")).toBe("2026-11-23T14:30:00.000Z");
  });

  test("during market hours executes immediately", () => {
    expect(scheduler.nextExecution("2026-11-23T15:30:00Z")).toBe("2026-11-23T15:30:00.000Z");
  });

  test("after closing schedules next trading day", () => {
    expect(scheduler.nextExecution("2026-11-24T21:01:00Z")).toBe("2026-11-25T14:30:00.000Z");
  });

  test("Friday after closing schedules Monday", () => {
    expect(scheduler.nextExecution("2026-11-27T21:01:00Z")).toBe("2026-11-30T14:30:00.000Z");
  });

  test.each([
    ["Saturday", "2026-11-28T15:00:00Z", "2026-11-30T14:30:00.000Z"],
    ["Sunday", "2026-11-29T15:00:00Z", "2026-11-30T14:30:00.000Z"],
  ])("%s schedules Monday", (_name, input, expected) => {
    expect(scheduler.nextExecution(input)).toBe(expected);
  });

  test("handles daylight saving offset transitions", () => {
    expect(scheduler.nextExecution("2026-03-06T13:00:00Z")).toBe("2026-03-06T14:30:00.000Z");
    expect(scheduler.nextExecution("2026-03-09T13:00:00Z")).toBe("2026-03-09T13:30:00.000Z");
    expect(scheduler.nextExecution("2026-11-02T13:30:00Z")).toBe("2026-11-02T14:30:00.000Z");
  });
});
