import fs from "node:fs";
import path from "node:path";
import type { Font, FontRef } from "@canva/asset";
import type { PageId, PageMetadata } from "@canva/design";
import { createRichtextRange } from "@canva/design";
import { CanvaError } from "@canva/error";
import type { ErrorCode } from "@canva/error";
import type { CreateBookDeps } from "../../src/builder/create-book";
import type { PreparedPage } from "../../src/builder/create-page";
import { discoverFontCandidates } from "../../src/builder/font-application";
import type { PageCreationPolicy } from "../../src/builder/retry-policy";
import { PAGE_CREATION_POLICY } from "../../src/builder/retry-policy";
import { parseBookMarkdown } from "../../src/parser/markdown-book";
import type { BookSpec } from "../../src/types/book-spec";

/** 12페이지짜리 실제 원고. 속도 제한은 이 정도 분량에서 처음 드러났다. */
export const twelvePageBook = (): BookSpec =>
  parseBookMarkdown(
    fs.readFileSync(
      path.resolve(process.cwd(), "../test-input/prototype-book-v2.md"),
      "utf8",
    ),
  );

export const fivePageBook = (): BookSpec =>
  parseBookMarkdown(
    fs.readFileSync(
      path.resolve(process.cwd(), "../test-input/prototype-book.md"),
      "utf8",
    ),
  );

export const wantedSans: Font = {
  name: "Wanted Sans",
  ref: "wanted-sans-ref" as FontRef,
  weights: [
    { weight: "normal", styles: ["normal"] },
    { weight: "bold", styles: ["normal"] },
  ],
};

export const notoSansKr: Font = {
  name: "Noto Sans KR",
  ref: "noto-sans-kr-ref" as FontRef,
  weights: [
    { weight: "normal", styles: ["normal"] },
    { weight: "bold", styles: ["normal"] },
  ],
};

/** 실제 Canva 오류와 같은 모양(코드 + 메시지)으로 만든다. */
export const canvaError = (code: ErrorCode, message: string): Error =>
  new CanvaError({ code, message });

export const rateLimitError = (): Error =>
  canvaError(
    "rate_limited",
    "Encountered an error while adding page: Add page rate limit exceeded.",
  );

/** 한 번의 addPage() 호출이 어떻게 실패할지. */
export type ScriptedFailure = {
  error: unknown;
  /** 호출은 실패했지만 Canva에는 페이지가 남는 경우. */
  lands?: boolean;
};

export type WriteLog = {
  /** 원고 순서(0부터). 같은 페이지의 재시도는 같은 값을 가진다. */
  ordinal: number;
  title: string;
  /** 가짜 시계 기준 호출 시각(ms). */
  at: number;
  outcome: "created" | "failed";
};

export type FakeCanvaOptions = {
  /** 원고 순서별로 앞에서부터 소비되는 실패 목록. */
  failures?: Record<number, ScriptedFailure[]>;
  /** 디자인에 이미 있던 페이지 수. */
  baselinePages?: number;
  /**
   * true면 getDesignMetadata()를 쓸 수 없는 상황을 흉내 낸다.
   * (실패한 요청이 페이지를 남겼는지 확인할 수 없는 경우)
   */
  pageCountUnavailable?: boolean;
  policy?: Partial<PageCreationPolicy>;
  random?: () => number;
  listedFonts?: Font[];
  designFonts?: Font[];
  /** 특정 글꼴 fontRef로 들어온 호출을 실패시킨다(글꼴 사다리 검증용). */
  rejectFontRef?: string;
};

export type FakeCanva = {
  deps: Partial<CreateBookDeps>;
  writes: WriteLog[];
  /** 실제로 만들어진 페이지 제목(중복 생성 검증용). */
  createdTitles: string[];
  createdKeys: string[];
  maxConcurrentWrites: () => number;
  now: () => number;
  fontRefsUsed: () => (string | undefined)[];
};

/**
 * Canva 대역.
 *
 * - addPage()를 흉내 내고 호출 순서·시각·동시 실행 수를 기록한다.
 * - 대기는 가짜 시계로만 흐른다. 테스트가 실제로 기다리지 않는다.
 * - 실패한 호출이 페이지를 남기는 경우까지 재현한다.
 */
export function createFakeCanva(options: FakeCanvaOptions = {}): FakeCanva {
  const formats: { fontRef?: string }[] = [];
  jest.mocked(createRichtextRange).mockImplementation(
    () =>
      ({
        appendText: jest.fn(),
        formatParagraph: jest.fn(
          (_bounds: unknown, formatting: { fontRef?: string }) => {
            formats.push({ fontRef: formatting.fontRef });
          },
        ),
      }) as never,
  );

  const failures: Record<number, ScriptedFailure[]> = Object.fromEntries(
    Object.entries(options.failures ?? {}).map(([key, value]) => [
      key,
      [...value],
    ]),
  );

  let clock = 0;
  let inFlight = 0;
  let maxInFlight = 0;
  let createdCount = 0;
  const writes: WriteLog[] = [];
  const createdTitles: string[] = [];
  const createdKeys: string[] = [];
  const order: string[] = [];
  const usedFontRefs: (string | undefined)[] = [];

  const ordinalOf = (title: string): number => {
    const existing = order.indexOf(title);
    if (existing !== -1) {
      return existing;
    }
    order.push(title);
    return order.length - 1;
  };

  const writePage = async (
    page: PreparedPage,
  ): Promise<PageMetadata | undefined> => {
    const ordinal = ordinalOf(page.key ?? page.title);
    const fontRef = formats.splice(0)[0]?.fontRef;
    usedFontRefs.push(fontRef);
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    try {
      // 실제 SDK처럼 한 틱 뒤에 결과가 온다. 순차 호출 여부를 제대로 본다.
      await Promise.resolve();

      if (
        options.rejectFontRef !== undefined &&
        fontRef === options.rejectFontRef
      ) {
        writes.push({ ordinal, title: page.title, at: clock, outcome: "failed" });
        throw new Error("Canva could not apply the requested font.");
      }

      const scripted = failures[ordinal]?.shift();
      if (scripted) {
        if (scripted.lands) {
          createdCount += 1;
          createdTitles.push(page.title);
          createdKeys.push(page.key);
        }
        writes.push({ ordinal, title: page.title, at: clock, outcome: "failed" });
        throw scripted.error;
      }

      createdCount += 1;
      createdTitles.push(page.title);
      createdKeys.push(page.key);
      writes.push({ ordinal, title: page.title, at: clock, outcome: "created" });
      return {
        type: "absolute",
        id: `page-${createdCount}` as PageId,
        title: page.title,
        dimensions: { width: 1587, height: 2245 },
      };
    } finally {
      inFlight -= 1;
    }
  };

  const baseline = options.baselinePages ?? 0;

  return {
    writes,
    createdTitles,
    /** 만들어진 물리 페이지의 키. 제목은 `(계속)`으로 겹칠 수 있어 키로 센다. */
    createdKeys,
    maxConcurrentWrites: () => maxInFlight,
    now: () => clock,
    fontRefsUsed: () => usedFontRefs,
    deps: {
      writePage,
      sleep: async (milliseconds: number) => {
        clock += milliseconds;
      },
      random: options.random ?? (() => 0),
      policy: { ...PAGE_CREATION_POLICY, ...options.policy },
      getDesignPageCount: async () =>
        options.pageCountUnavailable ? undefined : baseline + createdCount,
      discoverFontCandidates: () =>
        discoverFontCandidates({
          findFonts: jest
            .fn()
            .mockResolvedValue({ fonts: options.listedFonts ?? [wantedSans] }),
          scanDesignFonts: jest
            .fn()
            .mockResolvedValue({ fonts: options.designFonts ?? [] }),
        }),
    },
  };
}
