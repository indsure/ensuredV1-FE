/**
 * When does a room-rent limit count as a "Room Rent Capping Penalty"?
 *
 * NO NETWORK, NO DB, NO GEMINI.
 *
 * A report showed "Room Rent Capping Penalty" with the body "No numeric cap on
 * room rent. Standard private AC rooms are fully covered without proportional
 * deductions", directly above a "No Room Rent Cap" benefit. The row fired on
 * limit_type !== "none", and the model had named the room category as a limit.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { roomRentCapCutsClaims } from "../../../shared/policy";

test("a room category paid in full is not a penalty (the reported contradiction)", () => {
  assert.equal(roomRentCapCutsClaims({ limit_type: "room_category", limit_value: "Single private AC room", penalty_type: "none" }), false);
  assert.equal(roomRentCapCutsClaims({ limit_type: "category" as any, penalty_type: "none" }), false);
});

test("a room category with an unclear penalty and no numeric cap is not called a penalty", () => {
  assert.equal(roomRentCapCutsClaims({ limit_type: "room_category", penalty_type: "unclear", limit_amount_per_day: null }), false);
  assert.equal(roomRentCapCutsClaims({ limit_type: "unclear", penalty_type: null }), false);
});

test("no limit is never a penalty", () => {
  assert.equal(roomRentCapCutsClaims({ limit_type: "none", penalty_type: "proportional" }), false);
  assert.equal(roomRentCapCutsClaims(null), false);
  assert.equal(roomRentCapCutsClaims(undefined), false);
});

test("a stated proportional deduction always counts", () => {
  assert.equal(roomRentCapCutsClaims({ limit_type: "room_category", penalty_type: "proportional" }), true);
  assert.equal(roomRentCapCutsClaims({ limit_type: "percentage_of_si", penalty_type: "proportional" }), true);
});

test("a numeric cap with an unclear penalty still counts", () => {
  assert.equal(roomRentCapCutsClaims({ limit_type: "percentage_of_si", penalty_type: "unclear" }), true);
  assert.equal(roomRentCapCutsClaims({ limit_type: "absolute" as any, penalty_type: null }), true);
  assert.equal(roomRentCapCutsClaims({ limit_type: "unclear", penalty_type: "unclear", limit_amount_per_day: 5000 }), true);
});

test("a numeric cap the wording says carries no deduction is not a penalty", () => {
  assert.equal(roomRentCapCutsClaims({ limit_type: "specific_amount", limit_amount_per_day: 5000, penalty_type: "none" }), false);
});
