import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, agentsForServiceLevel, serviceLevel, staffNeeded } from "@/app/lib/capacity/model";
import { gradeQuiz } from "@/app/lib/training/types";
import { totalScore } from "@/app/lib/quality/types";

describe("Erlang C staffing", () => {
  it("matches the textbook case: 200 contacts an hour, 3-minute handling, 80% in 20 seconds needs 14 agents", () => {
    expect(agentsForServiceLevel(200, { ...DEFAULT_SETTINGS, ahtMinutes: 3, targetPercent: 80, targetSeconds: 20 })).toBe(14);
  });

  it("never claims a service level with fewer agents than the traffic", () => {
    expect(serviceLevel(9, 200, 180, 20)).toBe(0);
    expect(serviceLevel(5, 0, 180, 20)).toBe(1);
  });

  it("adds shrinkage on top of the agents needed", () => {
    const grid = [[200, 0]];
    const needed = staffNeeded(grid, { ...DEFAULT_SETTINGS, ahtMinutes: 3, targetPercent: 80, targetSeconds: 20, shrinkagePercent: 30 });
    expect(needed[0]).toEqual([Math.ceil(14 / 0.7), 0]);
  });
});

describe("quality and training scores", () => {
  it("weights QC criteria, with 1 as 0% and 5 as 100%", () => {
    expect(totalScore([{ weight: 1, score: 5 }, { weight: 1, score: 1 }])).toBe(50);
    expect(totalScore([{ weight: 3, score: 5 }, { weight: 1, score: 1 }])).toBe(75);
  });

  it("grades a quiz against the pass mark", () => {
    const questions = [
      { id: "q1", question: "?", options: ["a", "b"], answer: 0, explanation: "" },
      { id: "q2", question: "?", options: ["a", "b"], answer: 1, explanation: "" },
    ];
    expect(gradeQuiz(questions, { q1: 0, q2: 1 }, 80)).toMatchObject({ score: 100, passed: true });
    expect(gradeQuiz(questions, { q1: 0, q2: 0 }, 80)).toMatchObject({ score: 50, passed: false });
  });
});
