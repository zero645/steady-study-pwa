"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const planner = require("./planner-v3.js");

const START = "2026-09-19";

test("完整知识地图来自四科官方范围拆分", () => {
  assert.ok(planner.CURRICULUM.length >= 200);
  assert.deepEqual(
    new Set(planner.CURRICULUM.map((point) => point.subject)),
    new Set(["高等数学", "英语", "计算机基础", "大学语文"])
  );
});

test("保底模式只安排一项英语任务", () => {
  const state = planner.createInitialState(START);
  const day = planner.ensureDay(state, START, "minimum");
  assert.equal(day.tasks.length, 1);
  assert.equal(day.tasks[0].subject, "英语");
  assert.equal(day.tasks[0].duration, 15);
});

test("正常模式安排英语和一个主知识点", () => {
  const state = planner.createInitialState(START);
  const day = planner.generateDailyPlan(state, START, "standard");
  assert.equal(day.tasks.length, 2);
  assert.equal(day.tasks[0].knowledgeId, "E1-01");
  assert.equal(day.tasks[1].knowledgeId, "M1-01");
  assert.equal(day.tasks.reduce((sum, task) => sum + task.duration, 0), 50);
});

test("五分钟急救只保留两道题", () => {
  const state = planner.createInitialState(START);
  const day = planner.generateDailyPlan(state, START, "rescue");
  assert.equal(day.tasks.length, 1);
  assert.equal(day.tasks[0].duration, 5);
  assert.equal(day.tasks[0].quizLimit, 2);
});

test("任务开始后不能切换模式，避免重建正在进行的队列", () => {
  const state = planner.createInitialState(START);
  const day = planner.ensureDay(state, START, "standard");
  planner.startTask(state, START, day.tasks[0].id);
  assert.equal(planner.setDayMode(state, START, "full"), false);
  assert.equal(state.days[START].mode, "standard");
});

test("小测分数决定 1、3、7 天复习", () => {
  const cases = [
    { correct: 1, interval: 1 },
    { correct: 3, interval: 3 },
    { correct: 5, interval: 7 }
  ];
  cases.forEach(({ correct, interval }, index) => {
    const state = planner.createInitialState(START);
    const key = planner.addDays(START, index);
    const day = planner.ensureDay(state, key, "minimum");
    const result = planner.recordQuizResult(state, key, day.tasks[0].id, { correct, total: 5 });
    assert.equal(result.interval, interval);
    assert.equal(state.progress[day.tasks[0].knowledgeId].nextReview, planner.addDays(key, interval));
  });
});

test("同一知识点连续两次通过后延长到 14 天", () => {
  const state = planner.createInitialState(START);
  const first = planner.ensureDay(state, START, "minimum");
  planner.recordQuizResult(state, START, first.tasks[0].id, { correct: 5, total: 5 });

  const reviewKey = planner.addDays(START, 7);
  const review = planner.ensureDay(state, reviewKey, "minimum");
  assert.equal(review.tasks[0].knowledgeId, "E1-01");
  const result = planner.recordQuizResult(state, reviewKey, review.tasks[0].id, { correct: 5, total: 5 });
  assert.equal(result.interval, 14);
  assert.equal(state.progress["E1-01"].passes, 2);
});

test("未完成任务不会累积到第二天", () => {
  const state = planner.createInitialState(START);
  const first = planner.ensureDay(state, START, "standard");
  const secondKey = planner.addDays(START, 1);
  const second = planner.ensureDay(state, secondKey, "standard");
  assert.equal(first.tasks.length, 2);
  assert.equal(second.tasks.length, 2);
  assert.notEqual(first.tasks[0].id, second.tasks[0].id);
});

test("到期知识点可以加入今天且不会重复", () => {
  const state = planner.createInitialState(START);
  state.progress["M1-01"] = {
    attempts: 1,
    passes: 0,
    bestScore: 20,
    lastScore: 20,
    nextReview: START,
    lastStudied: planner.addDays(START, -1)
  };
  planner.ensureDay(state, START, "minimum");
  assert.equal(planner.queueReviewToday(state, START, "M1-01"), true);
  assert.equal(planner.queueReviewToday(state, START, "M1-01"), false);
});

test("旧版记录迁移到新版但不制造历史任务债务", () => {
  const migrated = planner.migrateStore({
    version: 2,
    progress: {
      "math-functions": { introduced: true, mastery: 70, nextReview: "2026-09-20" }
    },
    days: {
      "2026-09-18": [{ title: "旧任务", completed: false }]
    }
  }, START);
  assert.equal(migrated.version, 3);
  assert.equal(migrated.progress["M1-01"].attempts, 1);
  assert.deepEqual(migrated.days, {});
});

test("首周十二个知识点具有内置小测", () => {
  const covered = ["E1-01", "E1-03", "E2-01", "E2-02", "E1-05", "E2-03", "M1-01", "C1-01", "M1-02", "Y2-01", "C1-04", "M1-03"];
  covered.forEach((code) => assert.equal(planner.questionsFor(code, 5).length, 5, code));
});
