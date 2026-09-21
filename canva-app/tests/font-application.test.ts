import type { Font, FontRef } from "@canva/asset";
import {
  applyFirstWorkingFont,
  discoverFontCandidates,
  FontApplicationFailedError,
  NonFontFailure,
} from "../src/builder/font-application";
import { buildFontCandidates } from "../src/theme/font-resolver";

const font = (name: string, ref: string): Font => ({
  name,
  ref: ref as FontRef,
  weights: [
    { weight: "normal", styles: ["normal"] },
    { weight: "bold", styles: ["normal"] },
  ],
});

const wantedSans = font("Wanted Sans", "wanted-sans-ref");
const notoSansKr = font("Noto Sans KR", "noto-sans-kr-ref");
const nanum = font("나눔고딕", "nanum-ref");

describe("applying the first font that actually works", () => {
  it("uses Wanted Sans and never touches a fallback when the real call succeeds", async () => {
    const { candidates, report } = buildFontCandidates({
      listedFonts: [wantedSans, notoSansKr],
    });
    const attempt = jest.fn().mockResolvedValue("page");

    const { outcome } = await applyFirstWorkingFont({
      candidates,
      discovery: report,
      attempt,
    });

    expect(attempt).toHaveBeenCalledTimes(1);
    expect(outcome.applied).toMatchObject({
      familyName: "Wanted Sans",
      fontRef: wantedSans.ref,
    });
    expect(outcome.usedWantedSans).toBe(true);
    expect(outcome.fallbackReason).toBeUndefined();
    expect(outcome.attempts).toEqual([]);
  });

  it("still tries to apply Wanted Sans when findFonts did not list it", async () => {
    // findFonts()는 Canva 글꼴의 일부만 돌려준다. 목록에 없다는 이유만으로
    // 차단하면 안 되고, 디자인에서 찾은 ref로 실제 적용을 시도해야 한다.
    const { candidates, report } = buildFontCandidates({
      listedFonts: [notoSansKr],
      designFonts: [wantedSans],
    });
    const attempt = jest.fn().mockResolvedValue(undefined);

    const { outcome } = await applyFirstWorkingFont({
      candidates,
      discovery: report,
      attempt,
    });

    expect(attempt.mock.calls[0]?.[0]).toMatchObject({
      familyName: "Wanted Sans",
      fontRef: wantedSans.ref,
      source: "design-scan",
    });
    expect(outcome.usedWantedSans).toBe(true);
  });

  it("falls back to Noto Sans KR only after the real Wanted Sans call fails", async () => {
    const { candidates, report } = buildFontCandidates({
      listedFonts: [wantedSans, notoSansKr, nanum],
    });
    const attempt = jest
      .fn()
      .mockRejectedValueOnce(new Error("Font is not available in this design"))
      .mockResolvedValue(undefined);

    const { outcome } = await applyFirstWorkingFont({
      candidates,
      discovery: report,
      attempt,
    });

    expect(attempt).toHaveBeenCalledTimes(2);
    expect(outcome.applied.familyName).toBe("Noto Sans KR");
    expect(outcome.usedWantedSans).toBe(false);
    expect(outcome.attempts).toHaveLength(1);
    expect(outcome.attempts[0]).toMatchObject({
      familyName: "Wanted Sans",
      fontRef: wantedSans.ref,
      call: "@canva/design addPage()",
      errorMessage: "Font is not available in this design",
    });
    expect(outcome.fallbackReason).toContain("Font is not available");
  });

  it("falls through to another korean font when Noto Sans KR also fails", async () => {
    const { candidates, report } = buildFontCandidates({
      listedFonts: [wantedSans, notoSansKr, nanum],
    });
    const attempt = jest
      .fn()
      .mockRejectedValueOnce(new Error("wanted failed"))
      .mockRejectedValueOnce(new Error("noto failed"))
      .mockResolvedValue(undefined);

    const { outcome } = await applyFirstWorkingFont({
      candidates,
      discovery: report,
      attempt,
    });

    expect(outcome.applied.familyName).toBe("나눔고딕");
    expect(outcome.attempts.map(({ familyName }) => familyName)).toEqual([
      "Wanted Sans",
      "Noto Sans KR",
    ]);
  });

  it("explains that Wanted Sans could not even be attempted when no ref was found", async () => {
    const { candidates, report } = buildFontCandidates({
      listedFonts: [notoSansKr],
    });

    const { outcome } = await applyFirstWorkingFont({
      candidates,
      discovery: report,
      attempt: jest.fn().mockResolvedValue(undefined),
    });

    expect(outcome.applied.familyName).toBe("Noto Sans KR");
    expect(outcome.fallbackReason).toContain("fontRef를 얻지 못해");
    expect(outcome.fallbackReason).toContain("일부만 돌려줍니다");
  });

  it("generates with no font ref rather than blocking when nothing is available", async () => {
    const { candidates, report } = buildFontCandidates({ listedFonts: [] });

    const { outcome } = await applyFirstWorkingFont({
      candidates,
      discovery: report,
      attempt: jest.fn().mockResolvedValue(undefined),
    });

    expect(outcome.applied.fontRef).toBeUndefined();
    expect(outcome.applied.source).toBe("canva-default");
  });

  it("does not swap fonts for a failure that has nothing to do with fonts", async () => {
    const { candidates, report } = buildFontCandidates({
      listedFonts: [wantedSans, notoSansKr],
    });
    const tooDense = new Error("페이지 내용이 템플릿 용량을 초과합니다.");
    const attempt = jest.fn().mockRejectedValue(new NonFontFailure(tooDense));

    await expect(
      applyFirstWorkingFont({ candidates, discovery: report, attempt }),
    ).rejects.toBe(tooDense);
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it("reports every failed call when no candidate works", async () => {
    const { candidates, report } = buildFontCandidates({
      listedFonts: [wantedSans, notoSansKr],
    });

    const error = await applyFirstWorkingFont({
      candidates,
      discovery: report,
      attempt: jest.fn().mockRejectedValue(new Error("addPage rejected")),
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(FontApplicationFailedError);
    const failure = error as FontApplicationFailedError;
    expect(failure.attempts.map(({ familyName }) => familyName)).toEqual([
      "Wanted Sans",
      "Noto Sans KR",
      "Canva 디자인 기본 글꼴",
    ]);
    expect(failure.message).toContain("addPage rejected");
  });
});

describe("candidate discovery", () => {
  it("survives a findFonts failure and records it", async () => {
    const { candidates, report } = await discoverFontCandidates({
      findFonts: jest.fn().mockRejectedValue(new Error("findFonts exploded")),
      scanDesignFonts: jest.fn().mockResolvedValue({ fonts: [wantedSans] }),
    });

    expect(report.findFontsError).toBe("findFonts exploded");
    expect(candidates[0]).toMatchObject({
      familyName: "Wanted Sans",
      source: "design-scan",
    });
  });

  it("survives a design scan failure and records it", async () => {
    const { candidates, report } = await discoverFontCandidates({
      findFonts: jest.fn().mockResolvedValue({ fonts: [wantedSans] }),
      scanDesignFonts: jest
        .fn()
        .mockResolvedValue({ fonts: [], error: "not supported here" }),
    });

    expect(report.designScanError).toBe("not supported here");
    expect(candidates[0]?.familyName).toBe("Wanted Sans");
  });
});
