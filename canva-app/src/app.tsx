import { useFeatureSupport } from "@canva/app-hooks";
import {
  Alert,
  Button,
  Column,
  Columns,
  FileInput,
  ProgressBar,
  Rows,
  Select,
  Text,
  TextInput,
  Title,
} from "@canva/app-ui-kit";
import { addPage, openDesign, selection } from "@canva/design";
import { useCallback, useEffect, useState } from "react";
import * as styles from "styles/components.css";
import { createBook, BookGenerationFailedError } from "./builder/create-book";
import type { CreateBookResult } from "./builder/create-book";
import { findMissingPageIds } from "./builder/design-pages";
import type { ImagePlaceholderInfo } from "./builder/placeholder-ratio";
import {
  changeImagePlaceholderRatio,
  listImagePlaceholders,
} from "./builder/placeholder-ratio";
import type { FontAttemptFailure } from "./builder/font-application";
import { FontApplicationFailedError } from "./builder/font-application";
import type {
  FailureReport,
  GenerationPhase,
  PreviousRun,
  RerunDecision,
} from "./builder/generation-state";
import {
  bookFingerprint,
  buildFailureReport,
  decideRerun,
  describeCreatedPageCheck,
  describeCompletion,
  describeProgress,
  isGenerateDisabled,
} from "./builder/generation-state";
import { parseRatio } from "./parser/image-directive";
import { parseBookMarkdown } from "./parser/markdown-book";
import { coalaTheme } from "./theme/coala-theme";
import { BOOK_FONT_FAMILY } from "./theme/font-resolver";
import type { BookSpec } from "./types/book-spec";

type Status =
  | { tone: "positive" | "critical" | "warn"; message: string }
  | undefined;

type ProgressState = {
  message: string;
  completed: number;
  /**
   * 실제로 만들어질 Canva 페이지 수.
   *
   * 원고 한 페이지가 분량 때문에 여러 장이 될 수 있어, 배치가 끝나기 전에는
   * 알 수 없다. 첫 진행 이벤트가 확정된 값을 실어 온다.
   */
  total?: number;
};

function FailedCalls({ attempts }: { attempts: FontAttemptFailure[] }) {
  if (attempts.length === 0) {
    return null;
  }
  return (
    <Rows spacing="0.5u">
      <Text size="small" variant="bold">
        실패한 Canva API/SDK 호출
      </Text>
      {attempts.map((attempt) => (
        <Text
          key={`${attempt.familyName}-${attempt.fontRef ?? "no-ref"}-${attempt.call}`}
          size="small"
          tone="secondary"
        >
          {attempt.call} · {attempt.familyName} (
          {attempt.fontRef ?? "fontRef 없음"}) → {attempt.errorMessage}
        </Text>
      ))}
    </Rows>
  );
}

function FontReport({ result }: { result: CreateBookResult }) {
  const { font } = result;
  const { discovery } = font;
  return (
    <Alert
      tone={font.usedWantedSans ? "positive" : "warn"}
      title={
        font.usedWantedSans
          ? `${BOOK_FONT_FAMILY} 적용 성공`
          : `${BOOK_FONT_FAMILY} 적용 실패 · 대체 글꼴 사용`
      }
    >
      <Rows spacing="0.5u">
        <Text size="small">
          실제 적용된 글꼴: {font.applied.familyName}
          {font.applied.fontRef ? ` (fontRef ${font.applied.fontRef})` : ""}
        </Text>
        <Text size="small">
          굵기: 본문 {font.applied.regularWeight} · 강조{" "}
          {font.applied.boldWeight}
        </Text>
        {!font.usedWantedSans && (
          <Text size="small" variant="bold">
            대체된 글꼴: {font.applied.familyName}
          </Text>
        )}
        {font.fallbackReason && (
          <Text size="small" tone="secondary">
            대체 사유: {font.fallbackReason}
          </Text>
        )}
        <Text size="small" tone="tertiary">
          조회 결과: findFonts() {discovery.listedFontCount}개 (Canva 글꼴의
          일부만 반환) · 목록에 {BOOK_FONT_FAMILY}{" "}
          {discovery.wantedSansInList ? "있음" : "없음"} · 현재 디자인 사용
          글꼴에 {discovery.wantedSansInDesign ? "있음" : "없음"}
        </Text>
        {discovery.findFontsError && (
          <Text size="small" tone="secondary">
            findFonts() 오류: {discovery.findFontsError}
          </Text>
        )}
        {discovery.designScanError && (
          <Text size="small" tone="secondary">
            디자인 글꼴 조회 오류: {discovery.designScanError}
          </Text>
        )}
        <FailedCalls attempts={font.attempts} />
      </Rows>
    </Alert>
  );
}

/**
 * 비워 둔 이미지 자리 목록.
 *
 * 각 자리는 Canva에서 이미지를 끌어다 놓으면 채워진다. 목록을 모두 채우고
 * 자리 안의 안내 글을 지우면 이미지 작업이 끝난다.
 */
function PendingImagesReport({ result }: { result: CreateBookResult }) {
  const { pendingImages } = result;
  if (pendingImages.length === 0) {
    return null;
  }
  return (
    <Alert
      tone="info"
      title={`이미지 자리 ${pendingImages.length}곳을 비워 두었습니다`}
    >
      <Rows spacing="0.5u">
        <Text size="small">
          각 자리(회색 상자)에 이미지를 끌어다 놓으면 그 크기대로 채워집니다.
          넣은 뒤 상자 안의 안내 글을 지워 주세요.
        </Text>
        {pendingImages.map((image, index) => (
          <Text
            key={`${image.designPage}-${image.src}-${index}`}
            size="small"
            tone="secondary"
          >
            {image.pageNumber ? `${image.pageNumber}쪽` : image.pageTitle} ·{" "}
            {image.src} · {image.width}×{image.height}px ({image.ratioLabel}
            {image.ratioDeclared ? "" : ", 비율 미지정 → 기본값"}
            {image.scaledToFit ? ", 지면에 맞춰 축소" : ""})
            {image.role === "result" ? " · 실행 결과" : ""} — {image.alt}
          </Text>
        ))}
      </Rows>
    </Alert>
  );
}

/**
 * 비워 둔 순서도 자리 목록.
 *
 * 앱은 순서도를 그리지 않는다. 스킬이 지정한 Canva 요소는 공개 Apps SDK로 넣을
 * 수 없고, 비슷한 도형으로 대체하는 것은 금지되어 있다. 사용자가 이 목록대로
 * Canva에서 직접 만든다.
 */
function PendingFlowchartsReport({ result }: { result: CreateBookResult }) {
  const { pendingFlowcharts } = result;
  if (pendingFlowcharts.length === 0) {
    return null;
  }
  return (
    <Alert
      tone="warn"
      title={`순서도 ${pendingFlowcharts.length}곳은 직접 만들어야 합니다`}
    >
      <Rows spacing="1u">
        <Text size="small">
          앱은 순서도를 그리지 않고 자리(회색 상자)만 비워 두었습니다. Canva의
          요소 → 도형 → 순서도 도형에서 아래에 적힌 요소를 찾아 자리 위에
          만들고, 끝나면 회색 상자와 그 안의 안내 글을 지워 주세요.
        </Text>
        <Text size="small" tone="secondary">
          순서도 안의 글꼴은 {coalaTheme.flowchart.fontFamily}, 연결선은 Canva
          기본 선 또는 커넥터에 회색 #737373입니다. 순서도가 자리보다 크면 아래
          글을 직접 옮겨 주세요.
        </Text>
        {pendingFlowcharts.map((flowchart, index) => (
          <Rows key={`${flowchart.designPage}-${index}`} spacing="0.5u">
            <Text size="small" variant="bold">
              {flowchart.pageNumber
                ? `${flowchart.pageNumber}쪽`
                : flowchart.pageTitle}{" "}
              · {flowchart.title}
              {flowchart.structureLabel ? ` · ${flowchart.structureLabel}` : ""}
            </Text>
            {flowchart.structureHint && (
              <Text size="small" tone="secondary">
                {flowchart.structureHint}
              </Text>
            )}
            {flowchart.nodes.map((node) => (
              <Text key={node.number} size="small" tone="secondary">
                {node.number}. [{node.roleLabel}] {node.text} —{" "}
                {node.elementName} ({node.elementId})
              </Text>
            ))}
            <Text size="small" tone="secondary">
              연결:{" "}
              {flowchart.connections
                .map(({ from, to, label }) =>
                  label ? `${from} —${label}→ ${to}` : `${from} → ${to}`,
                )
                .join(" · ")}
            </Text>
            <Text size="small" tone="tertiary">
              비워 둔 자리 {flowchart.width}×{flowchart.height}px
              {flowchart.heightDeclared ? "" : " (도형 수로 추정)"}
            </Text>
          </Rows>
        ))}
      </Rows>
    </Alert>
  );
}

/** 자주 쓰는 비율. 가로로 긴 것부터. */
const RATIO_PRESETS = ["16:9", "3:2", "4:3", "1:1", "3:4", "9:16"] as const;

/** 목록에 보여 줄 자리 이름. 안내 글의 파일 줄이 있으면 그것을 쓴다. */
function placeholderName(placeholder: ImagePlaceholderInfo): string {
  const lines = placeholder.labelText?.split("\n") ?? [];
  const named = lines.find((line) => line.includes(" · ")) ?? lines[0];
  return `${placeholder.index + 1}번째 · ${
    named ?? `${placeholder.width}×${placeholder.height}px`
  }`;
}

/**
 * 이미지 자리의 가로세로 비율 바꾸기.
 *
 * Canva 편집기에서는 이미지 자리(끌어다 놓기 대상 도형)의 비율을 바꿀 수 없어
 * 앱이 대신 바꾼다. 선택 API는 도형 선택을 알려 주지 않으므로, 자리 가운데의
 * 안내 글(richtext)이 선택되면 그 글로 자리를 찾는다. 회색 빈 부분을 눌렀을
 * 때를 위해 현재 페이지의 자리 목록에서 고를 수도 있다.
 */
function ImagePlaceholderRatioPanel() {
  const [placeholders, setPlaceholders] = useState<ImagePlaceholderInfo[]>([]);
  const [target, setTarget] = useState<number>();
  const [pickedByClick, setPickedByClick] = useState(false);
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    tone: "info" | "critical" | "warn";
    text: string;
  }>();

  /** 현재 페이지의 자리를 다시 읽는다. 안내 글이 주어지면 그 자리를 고른다. */
  const refresh = useCallback(async (selectedLabel?: string) => {
    const list = await listImagePlaceholders({ openDesign });
    if (!list.ok) {
      setPlaceholders([]);
      setTarget(undefined);
      setMessage({ tone: "critical", text: list.reason });
      return;
    }
    setPlaceholders(list.placeholders);
    const clicked =
      selectedLabel === undefined
        ? undefined
        : list.placeholders.find(
            (item) => item.labelText?.trim() === selectedLabel.trim(),
          );
    setPickedByClick(clicked !== undefined);
    setTarget((previous) =>
      clicked
        ? clicked.index
        : previous !== undefined && previous < list.placeholders.length
          ? previous
          : list.placeholders[0]?.index,
    );
  }, []);

  useEffect(() => {
    void refresh();
    // 자리 가운데의 안내 글이 선택되면 어느 자리인지 알 수 있다.
    const dispose = selection.registerOnChange({
      scope: "richtext",
      onChange: (event) => {
        if (event.count !== 1) {
          return;
        }
        void (async () => {
          const draft = await event.read();
          await refresh(draft.contents[0]?.readPlaintext());
        })();
      },
    });
    return () => dispose?.();
  }, [refresh]);

  const apply = async (ratioLabel: string) => {
    if (target === undefined) {
      setMessage({
        tone: "critical",
        text: "바꿀 이미지 자리를 먼저 골라 주세요.",
      });
      return;
    }
    let ratio: number;
    try {
      ratio = parseRatio(ratioLabel.trim());
    } catch (error) {
      setMessage({
        tone: "critical",
        text: error instanceof Error ? error.message : String(error),
      });
      return;
    }
    setBusy(true);
    const outcome = await changeImagePlaceholderRatio(
      { ratio, ratioLabel: ratioLabel.trim(), index: target },
      { openDesign },
    );
    setBusy(false);
    if (!outcome.changed) {
      setMessage({ tone: "critical", text: outcome.reason });
      return;
    }
    setMessage(
      outcome.overflows
        ? {
            tone: "warn",
            text: `${ratioLabel}로 바꿨습니다(${outcome.width}×${outcome.previousHeight} → ${outcome.width}×${outcome.height}px). 아래 내용이 본문 영역을 넘었습니다. 넘친 내용은 다음 페이지로 직접 옮겨 주세요.`,
          }
        : {
            tone: "info",
            text: `${ratioLabel}로 바꿨습니다(${outcome.width}×${outcome.previousHeight} → ${outcome.width}×${outcome.height}px). 아래 요소 ${outcome.movedBelow}개를 함께 옮겼습니다.`,
          },
    );
    await refresh();
  };

  return (
    <Rows spacing="1u">
      <Text size="small" variant="bold">
        이미지 자리 비율 바꾸기
      </Text>
      <Text size="small" tone="secondary">
        자리 가운데의 안내 글을 클릭하면 그 자리가 선택됩니다. 회색 빈 부분을
        클릭한 경우에는 Canva가 앱에 알려 주지 않으므로 아래 목록에서 골라
        주세요. 이미지를 넣기 전에만 바꿀 수 있습니다.
      </Text>
      {placeholders.length === 0 ? (
        <Text size="small" tone="tertiary">
          현재 페이지에 비어 있는 이미지 자리가 없습니다.
        </Text>
      ) : (
        <Select
          stretch
          value={target}
          options={placeholders.map((item) => ({
            value: item.index,
            label: placeholderName(item),
          }))}
          onChange={(value) => {
            setTarget(value);
            setPickedByClick(false);
          }}
        />
      )}
      {pickedByClick && (
        <Text size="small" tone="secondary">
          클릭한 자리를 골랐습니다.
        </Text>
      )}
      <Button variant="tertiary" onClick={() => void refresh()}>
        현재 페이지의 자리 다시 읽기
      </Button>
      <Columns spacing="1u">
        {RATIO_PRESETS.slice(0, 3).map((preset) => (
          <Column key={preset}>
            <Button
              variant="secondary"
              stretch
              disabled={busy || target === undefined}
              onClick={() => void apply(preset)}
            >
              {preset}
            </Button>
          </Column>
        ))}
      </Columns>
      <Columns spacing="1u">
        {RATIO_PRESETS.slice(3).map((preset) => (
          <Column key={preset}>
            <Button
              variant="secondary"
              stretch
              disabled={busy || target === undefined}
              onClick={() => void apply(preset)}
            >
              {preset}
            </Button>
          </Column>
        ))}
      </Columns>
      <Columns spacing="1u" alignY="end">
        <Column>
          <TextInput
            value={custom}
            placeholder="직접 입력 (예: 5:4 또는 1.5)"
            onChange={(value) => setCustom(value)}
          />
        </Column>
        <Column width="content">
          <Button
            variant="secondary"
            disabled={busy || target === undefined || custom.trim() === ""}
            onClick={() => void apply(custom)}
          >
            적용
          </Button>
        </Column>
      </Columns>
      {message && (
        <Text
          size="small"
          tone={message.tone === "info" ? "secondary" : "critical"}
        >
          {message.text}
        </Text>
      )}
    </Rows>
  );
}

/** 실패 보고. 원고 문제와 Canva 생성 실패를 구분해서 보여 준다. */
function FailureAlert({ report }: { report: FailureReport }) {
  return (
    <Alert
      tone="critical"
      title={
        report.kind === "manuscript"
          ? `원고 오류 · ${report.title}`
          : `Canva 생성 오류 · ${report.title}`
      }
    >
      <Rows spacing="0.5u">
        {report.progressNote && (
          <Text size="small" variant="bold">
            {report.progressNote}
          </Text>
        )}
        {report.lines.map((line) => (
          <Text key={line.label} size="small" tone="secondary">
            {line.label}: {line.value}
          </Text>
        ))}
      </Rows>
    </Alert>
  );
}

export function App() {
  const isSupported = useFeatureSupport();
  const canAddPage = isSupported(addPage);
  const [bookSpec, setBookSpec] = useState<BookSpec>();
  const [fileName, setFileName] = useState<string>();
  const [phase, setPhase] = useState<GenerationPhase>("idle");
  const [status, setStatus] = useState<Status>();
  const [progress, setProgress] = useState<ProgressState>();
  const [result, setResult] = useState<CreateBookResult>();
  const [failureReport, setFailureReport] = useState<FailureReport>();
  const [failedAttempts, setFailedAttempts] = useState<FontAttemptFailure[]>(
    [],
  );
  /**
   * 직전 실행 기록. Canva Apps SDK에는 앱이 만든 페이지를 지우는 API가 없어
   * 되돌릴 수 없으므로, 어디까지 만들었는지 기억해 두고 이어서 생성한다.
   */
  const [previousRun, setPreviousRun] = useState<PreviousRun>();
  const [rerunDecision, setRerunDecision] = useState<RerunDecision>();
  /** 이전에 만든 페이지가 아직 남아 있는지 확인한 결과. */
  const [createdPageNote, setCreatedPageNote] = useState<string>();

  const readMarkdown = async (files: File[]) => {
    const file = files[0];
    if (!file) {
      return;
    }
    setPhase("reading");
    setStatus(undefined);
    setResult(undefined);
    setFailureReport(undefined);
    setFailedAttempts([]);
    setBookSpec(undefined);
    setProgress(undefined);
    setRerunDecision(undefined);
    setFileName(file.name);
    try {
      const source = await file.text();
      const parsed = parseBookMarkdown(source);
      setBookSpec(parsed);
      // 원고 업로드 단계에서는 구조만 검사한다. 글꼴은 여기서 확인하지 않는다.
      // findFonts()가 Canva 글꼴의 일부만 돌려주기 때문에, 사전 조회 결과로
      // 생성을 막으면 실제로는 쓸 수 있는 글꼴을 막는 오탐이 된다.
      setStatus({
        tone: "positive",
        // 원고 페이지 수다. 분량이 많은 페이지는 생성할 때 여러 장으로 나뉘므로
        // 실제 Canva 페이지 수는 이보다 많을 수 있다.
        message: `원고를 확인했습니다. 원고 ${parsed.pages.length}개 페이지를 생성합니다. 분량이 많은 페이지는 여러 장으로 나뉩니다.`,
      });
      setPhase("idle");
    } catch (error) {
      setFailureReport(buildFailureReport(error));
      setPhase("failed");
    }
  };

  const runGeneration = async (alreadyCreatedIndexes: number[]) => {
    if (!bookSpec) {
      return;
    }
    const fingerprint = bookFingerprint(bookSpec);
    setPhase("generating");
    setStatus(undefined);
    setResult(undefined);
    setFailureReport(undefined);
    setFailedAttempts([]);
    setRerunDecision(undefined);
    setCreatedPageNote(undefined);
    setProgress({
      // 페이지 수는 배치가 끝나야 확정된다. 여기서 원고 페이지 수를 보여 주면
      // 분량 분할이 일어난 원고에서 틀린 숫자가 된다.
      message:
        alreadyCreatedIndexes.length > 0
          ? `이미 생성된 ${alreadyCreatedIndexes.length}페이지를 건너뛰고 남은 페이지를 이어서 만듭니다.`
          : "원고를 지면에 배치하고 생성을 시작합니다.",
      completed: alreadyCreatedIndexes.length,
    });

    try {
      const created = await createBook(
        bookSpec,
        {},
        {
          alreadyCreatedIndexes,
          onProgress: (event) => {
            setProgress({
              message: describeProgress(event),
              completed: event.completed,
              total: event.total,
            });
          },
        },
      );
      setResult(created);
      setPreviousRun((previous) => ({
        fingerprint,
        totalPages: created.pageCount,
        createdIndexes: [
          ...alreadyCreatedIndexes,
          ...created.createdPages.map((page) => page.index),
        ],
        createdPageIds: [
          ...(previous?.fingerprint === fingerprint
            ? previous.createdPageIds
            : []),
          ...created.createdPages.flatMap((page) =>
            page.pageId ? [page.pageId] : [],
          ),
        ],
      }));
      setStatus({ tone: "positive", message: describeCompletion(created) });
      setProgress(undefined);
      setPhase("done");
    } catch (error) {
      if (error instanceof BookGenerationFailedError) {
        // 이미 만들어진 페이지를 기억해 둬야 다시 눌렀을 때 중복되지 않는다.
        setPreviousRun((previous) => ({
          fingerprint,
          totalPages: error.totalPages,
          createdIndexes: [
            ...alreadyCreatedIndexes,
            ...error.createdPages.map((page) => page.index),
          ],
          createdPageIds: [
            ...(previous?.fingerprint === fingerprint
              ? previous.createdPageIds
              : []),
            ...error.createdPages.flatMap((page) =>
              page.pageId ? [page.pageId] : [],
            ),
          ],
        }));
      }
      if (error instanceof FontApplicationFailedError) {
        setFailedAttempts(error.attempts);
        setStatus({
          tone: "critical",
          message:
            "글꼴 후보를 모두 실제로 적용해 봤지만 Canva 페이지 생성에 실패했습니다.",
        });
      } else {
        setFailureReport(buildFailureReport(error));
      }
      setProgress(undefined);
      setPhase("failed");
    }
  };

  const handleGenerateClick = async () => {
    if (!bookSpec) {
      return;
    }
    const decision = decideRerun(previousRun, bookFingerprint(bookSpec));
    if (decision.kind === "start-fresh") {
      await runGeneration([]);
      return;
    }
    // 같은 원고를 다시 만들면 페이지가 중복된다. Canva Apps SDK에는 앱이
    // 추가한 페이지를 지우는 API가 없어 되돌릴 수도 없다. 앱이 임의로 정하지
    // 않고, 남아 있는 페이지를 확인한 뒤 사용자에게 고르게 한다.
    const check = await findMissingPageIds(previousRun?.createdPageIds ?? []);
    setCreatedPageNote(describeCreatedPageCheck(check));
    setRerunDecision(decision);
    setPhase("awaiting-confirmation");
  };

  const cancelRerun = () => {
    setRerunDecision(undefined);
    setCreatedPageNote(undefined);
    setPhase("idle");
  };

  const generateDisabled = isGenerateDisabled({
    canAddPage,
    hasBookSpec: Boolean(bookSpec),
    phase,
  });

  return (
    <div className={styles.scrollContainer}>
      <Rows spacing="3u">
        <Title size="medium">Coala Book Builder</Title>
        <Text>
          표준 Markdown 원고를 불러와 페이지 구조를 검사한 뒤 편집 가능한 Canva
          교재 페이지를 생성합니다. 본문 글꼴은 {BOOK_FONT_FAMILY}입니다.
        </Text>
        {!canAddPage && (
          <Alert tone="warn">
            현재 디자인 유형에서는 새 페이지 추가를 지원하지 않습니다.
          </Alert>
        )}
        <FileInput
          accept={[".md", "text/markdown", "text/plain"]}
          disabled={phase === "generating" || phase === "reading"}
          onDropAcceptedFiles={(files) => void readMarkdown(files)}
          onDropRejectedFiles={() =>
            setStatus({
              tone: "critical",
              message: ".md 형식의 원고 파일을 선택해 주세요.",
            })
          }
        />
        {fileName && <Text>선택한 원고: {fileName}</Text>}
        {bookSpec && (
          <Text>
            {bookSpec.title} · 원고 {bookSpec.pages.length}페이지 ·{" "}
            {bookSpec.pages.map((page) => page.type).join(", ")}
          </Text>
        )}
        {progress && (
          <Alert tone="info" title="Canva 페이지 생성 중">
            <Rows spacing="0.5u">
              <Text size="small">{progress.message}</Text>
              <ProgressBar
                value={
                  progress.total && progress.total > 0
                    ? Math.round((progress.completed / progress.total) * 100)
                    : 0
                }
                ariaLabel={
                  progress.total
                    ? `전체 ${progress.total}페이지 중 ${progress.completed}페이지 생성됨`
                    : "페이지 수를 확정하는 중"
                }
              />
              <Text size="small" tone="tertiary">
                페이지는 한 번에 하나씩 순서대로 추가됩니다. 생성이 끝날 때까지
                기다려 주세요.
              </Text>
            </Rows>
          </Alert>
        )}
        {rerunDecision && rerunDecision.kind !== "start-fresh" && (
          <Alert tone="warn" title="이미 생성된 페이지가 있습니다">
            <Rows spacing="1u">
              <Text size="small">{rerunDecision.message}</Text>
              {createdPageNote && (
                <Text size="small" tone="secondary">
                  {createdPageNote}
                </Text>
              )}
              {rerunDecision.kind === "confirm-resume" && previousRun && (
                <Button
                  variant="primary"
                  stretch
                  onClick={() => void runGeneration(previousRun.createdIndexes)}
                >
                  {`남은 ${rerunDecision.remainingCount}페이지만 이어서 생성`}
                </Button>
              )}
              <Button
                variant="secondary"
                stretch
                onClick={() => void runGeneration([])}
              >
                처음부터 다시 생성 (페이지가 중복됩니다)
              </Button>
              <Button variant="tertiary" stretch onClick={cancelRerun}>
                취소
              </Button>
            </Rows>
          </Alert>
        )}
        {status && <Alert tone={status.tone}>{status.message}</Alert>}
        {failureReport && <FailureAlert report={failureReport} />}
        {failedAttempts.length > 0 && (
          <Alert tone="critical" title="글꼴 적용 시도 기록">
            <FailedCalls attempts={failedAttempts} />
          </Alert>
        )}
        {result && <FontReport result={result} />}
        {result && <PendingImagesReport result={result} />}
        {result && <PendingFlowchartsReport result={result} />}
        {result?.blankFirstPage?.reused === false &&
          result.blankFirstPage.kind === "failed" && (
            <Alert
              tone="warn"
              title="맨 앞의 빈 페이지를 첫 장으로 쓰지 못했습니다"
            >
              <Text size="small">
                {result.blankFirstPage.reason} 첫 장은 새 페이지로 추가했습니다.
                맨 앞의 빈 페이지는 Canva에서 직접 지워 주세요.
              </Text>
            </Alert>
          )}
        <Button
          variant="primary"
          stretch
          disabled={generateDisabled}
          loading={phase === "generating"}
          onClick={() => void handleGenerateClick()}
        >
          교재 페이지 생성
        </Button>
        <ImagePlaceholderRatioPanel />
      </Rows>
    </div>
  );
}
