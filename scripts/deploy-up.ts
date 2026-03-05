/**
 * Deploy UP:
 * - Lambda / Hosting を順番に実行
 * - Hosting ジョブ完了まで待機し、結果を表示
 */

import { spawnSync } from "node:child_process";
import { loadRootConfig, requireValue } from "./lib/config.js";

type AppSummary = { appId?: string; name?: string };
type JobSummary = { jobId?: string; status?: string };

const cfg = loadRootConfig();
const region = cfg?.aws?.region || "ap-northeast-1";
const branchName = cfg?.hosting?.branch || "main";
const appIdFromConfig = cfg?.hosting?.appId || "";
const appName = cfg?.hosting?.appName || "";

/**
 * TypeScript スクリプトを実行し、失敗時は即終了する。
 */
function runTsScript(scriptPath: string, label: string): void {
  console.log(`\n${label}`);
  const result = spawnSync("npx", ["--yes", "tsx", scriptPath], {
    stdio: "inherit",
    shell: process.platform === "win32"
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

/**
 * AWS CLI をJSONモードで実行し、パース結果を返す。
 */
function runAwsJson(args: string[]): Record<string, unknown> | null {
  const result = spawnSync(
    "aws",
    [...args, "--region", region, "--output", "json", "--no-cli-pager"],
    {
      stdio: "pipe",
      shell: process.platform === "win32",
      env: { ...process.env, AWS_PAGER: "" }
    }
  );

  if (result.status !== 0) {
    const stderr = result.stderr?.toString("utf8")?.trim();
    if (stderr) console.error(stderr);
    return null;
  }

  try {
    return JSON.parse(result.stdout.toString("utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * 監視対象の Amplify appId を設定値または appName から解決する。
 */
function resolveAppId(): string | null {
  // deploy-up は hosting-up 実行後にジョブ監視するため、appId を再解決する。
  if (appIdFromConfig) return appIdFromConfig;
  const requiredAppName = requireValue(appName, "hosting.appName");

  const list = runAwsJson(["amplify", "list-apps"]);
  const apps = (list?.apps as AppSummary[] | undefined) || [];
  const app = apps.find(item => item.name === requiredAppName);
  return app?.appId || null;
}

/**
 * 対象ブランチの最新ジョブ概要を取得する。
 */
function getLatestJobSummary(appId: string): JobSummary | null {
  const data = runAwsJson([
    "amplify",
    "list-jobs",
    "--app-id",
    appId,
    "--branch-name",
    branchName,
    "--max-results",
    "1"
  ]);
  const summaries = (data?.jobSummaries as JobSummary[] | undefined) || [];
  return summaries[0] || null;
}

/**
 * list-jobs から指定 jobId の概要を取得する。
 */
function getJobSummaryFromList(appId: string, jobId: string): JobSummary | null {
  // list-jobs の方が取得が軽く安定するため、まずこちらで監視する。
  const data = runAwsJson([
    "amplify",
    "list-jobs",
    "--app-id",
    appId,
    "--branch-name",
    branchName,
    "--max-results",
    "10"
  ]);
  const list = (data?.jobSummaries as JobSummary[] | undefined) || [];
  const exact = list.find(item => String(item.jobId) === String(jobId));
  return exact || null;
}

/**
 * get-job から指定 jobId の概要を取得する。
 */
function getJobSummary(appId: string, jobId: string): JobSummary | null {
  const data = runAwsJson([
    "amplify",
    "get-job",
    "--app-id",
    appId,
    "--branch-name",
    branchName,
    "--job-id",
    jobId
  ]);
  return ((data?.job as { summary?: JobSummary } | undefined)?.summary as JobSummary | undefined) || null;
}

/**
 * 指定ミリ秒だけ待機する。
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Hosting ジョブの完了まで監視し、最終ステータスを返す。
 */
async function waitForHostingJob(appId: string, jobId: string): Promise<string> {
  const spinner = ["|", "/", "-", "\\"];
  let tick = 0;
  const startAt = Date.now();
  const maxWaitMs = 30 * 60 * 1000;

  while (true) {
    // list-jobs で取得できないケースだけ get-job にフォールバックする。
    const summary = getJobSummaryFromList(appId, jobId) || getJobSummary(appId, jobId);
    const status = summary?.status || "UNKNOWN";
    const icon = spinner[tick % spinner.length];
    tick += 1;

    const elapsedSec = Math.floor((Date.now() - startAt) / 1000);
    process.stdout.write(`\rLoading ${icon} Hosting deploy status: ${status} (job: ${jobId}, ${elapsedSec}s)`);

    if (["SUCCEED", "FAILED", "CANCELLED"].includes(status)) {
      process.stdout.write("\n");
      return status;
    }

    if (Date.now() - startAt > maxWaitMs) {
      process.stdout.write("\n");
      throw new Error(`Hosting deploy wait timed out after ${Math.floor(maxWaitMs / 60000)} minutes (job: ${jobId})`);
    }

    await sleep(4000);
  }
}

/**
 * Lambda->Hosting の順でデプロイし、Hosting 成否まで確認する。
 */
async function main(): Promise<void> {
  console.log("Deploy start");

  // 実行順序を固定: API側(Lambda) -> フロント配信(Hosting)。
  runTsScript("scripts/lambda-up.ts", "[1/2] Lambda deploy");
  runTsScript("scripts/hosting-up.ts", "[2/2] Hosting deploy start");

  const appId = resolveAppId();
  if (!appId) {
    console.log("Hosting job status check skipped: appId を解決できませんでした。");
    console.log("Deploy finished");
    return;
  }

  const latest = getLatestJobSummary(appId);
  const jobId = latest?.jobId;

  if (!jobId) {
    console.log("Hosting job status check skipped: jobId を取得できませんでした。");
    console.log("Deploy finished");
    return;
  }

  console.log(`Hosting job detected: ${jobId}`);
  const finalStatus = await waitForHostingJob(appId, jobId);

  if (finalStatus !== "SUCCEED") {
    console.error(`Deploy failed: Hosting job status = ${finalStatus}`);
    process.exit(1);
  }

  console.log("Deploy completed successfully");
}

main().catch((err: unknown) => {
  console.error((err as Error)?.message || err);
  process.exit(1);
});
