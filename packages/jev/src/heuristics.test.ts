import { describe, expect, it } from "vitest";
import { forbiddenHits } from "./heuristics.ts";

const CLAIMS = ["cam kết kết quả", "làm giàu nhanh", "đảm bảo thu nhập"];
describe("forbiddenHits", () => {
  it("flags an affirmative forbidden claim", () => {
    expect(forbiddenHits("Khóa học cam kết kết quả sau 30 ngày", CLAIMS)).toEqual(["cam kết kết quả"]);
    expect(forbiddenHits("Bí quyết làm giàu nhanh cho CEO", CLAIMS)).toEqual(["làm giàu nhanh"]);
  });
  it("allows the DNA-approved negated wording", () => {
    expect(forbiddenHits("ZONO không cam kết kết quả, chỉ cam kết hỗ trợ hết mình", CLAIMS)).toEqual([]);
    expect(forbiddenHits("Chúng tôi tuyệt đối không hứa làm giàu nhanh", CLAIMS)).toEqual(["làm giàu nhanh"]);
    expect(forbiddenHits("Không có khóa nào làm giàu nhanh. Không làm giàu nhanh.", CLAIMS)).toEqual(["làm giàu nhanh"]);
  });
});
