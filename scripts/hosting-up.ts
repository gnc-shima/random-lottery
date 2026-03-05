/**
 * Hosting UP:
 * - Amplify App が無ければ作成、あれば更新（RELEASE）する
 * - branch が無ければ作成してからリリースする
 */

import { spawnSync } from "node:child_process";
import { loadRootConfig, requireValue, saveHostingAppId } from "./lib/config.js";

type AwsResult = ReturnType<typeof spawnSync>;
type AwsJson = Record<string, unknown>;
type AppSummary = { appId?: string; name?: string };
type JobSummary = { jobId?: string; status?: string };

const cfg = loadRootConfig();
const region = cfg?.aws?.region || "ap-northeast-1";
const appIdFromEnv = cfg?.hosting?.appId || "";
const appName = cfg?.hosting?.appName || "random-lottery";
const branchName = cfg?.hosting?.branch || "main";
const repository = cfg?.hosting?.repository || "";
const oauthToken = cfg?.hosting?.oauthToken || "";
const platform = cfg?.hosting?.platform || "WEB";
const ACTIVE_JOB_STATUSES = new Set(["CREATED", "PENDING", "PROVISIONING", "RUNNING", "CANCELLING"]);
const START_JOB_RETRY_LIMIT = 15;

/**
 * AWS CLI を実行する。`inherit=false` で出力を抑制できる。
 */
function runAws(args: string[], inherit = true): AwsResult {
  return spawnSync(
    "aws",
    // -- More -- で止まらないようページャー無効化。
    [...args, "--region", region, "--no-cli-pager"],
    {
      stdio: inherit ? "inherit" : "pipe",
      shell: process.platform === "win32",
      env: { ...process.env, AWS_PAGER: "" }
    }
  );
}

/**
 * AWS CLI(JSON出力) を実行し、パース結果を返す。
 */
function runAwsJson(args: string[]): AwsJson | null {
  const result = spawnSync(
    "aws",
    [...args, "--region", region, "--output", "json", "--no-cli-pager"],
    {
      stdio: "pipe",
      shell: process.platform === "win32",
      env: { ...process.env, AWS_PAGER: "" }
    }
  );
  if (result.status !== 0) return null;
  try {
    return JSON.parse(result.stdout.toString("utf8")) as AwsJson;
  } catch {
    return null;
  }
}

/**
 * appId を設定値または appName から解決する。
 */
function resolveAppId(): string | null {
  // appId が指定されていればそれを優先。未指定時のみ appName から探索する。
  if (appIdFromEnv) return appIdFromEnv;

  const list = runAwsJson(["amplify", "list-apps"]);
  const apps = (list?.apps as AppSummary[] | undefined) || [];
  const app = apps.find(a => a.name === appName);
  return app?.appId || null;
}

/**
 * Amplify App を新規作成し、作成された appId を返す。
 */
function createApp(): string {
  requireValue(repository, "hosting.repository");

  const args = [
    "amplify",
    "create-app",
    "--name",
    appName,
    "--platform",
    platform,
    "--repository",
    repository
  ];

  if (oauthToken) {
    // OAuthトークンは新規作成時のみ必要。既存appId更新では不要。
    args.push("--oauth-token", oauthToken);
  }

  const create = runAwsJson(args);
  const createdAppId = (create?.app as { appId?: string } | undefined)?.appId;
  if (!createdAppId) {
    console.error("Failed to create Amplify app.");
    process.exit(1);
  }
  return createdAppId;
}

/**
 * 指定ブランチの存在確認を行う。
 */
function branchExists(appId: string): boolean {
  const result = runAws(
    ["amplify", "get-branch", "--app-id", appId, "--branch-name", branchName],
    false
  );
  return result.status === 0;
}

/**
 * 指定ブランチが未作成なら作成する。
 */
function ensureBranch(appId: string): void {
  // デプロイ先ブランチがない場合だけ作る（冪等実行のため）。
  if (branchExists(appId)) return;

  const created = runAws([
    "amplify",
    "create-branch",
    "--app-id",
    appId,
    "--branch-name",
    branchName
  ]);
  if (created.status !== 0) process.exit(created.status ?? 1);
}

/**
 * 対象ブランチのジョブ概要一覧を取得する。
 */
function listBranchJobSummaries(appId: string): JobSummary[] {
  const list = runAwsJson([
    "amplify",
    "list-jobs",
    "--app-id",
    appId,
    "--branch-name",
    branchName,
    "--max-results",
    "10"
  ]);
  const summaries = (list?.jobSummaries as JobSummary[] | undefined) || [];
  return summaries;
}

/**
 * 指定 jobId のジョブ概要を取得する。
 */
function getJobSummary(appId: string, jobId: string): JobSummary | null {
  const job = runAwsJson([
    "amplify",
    "get-job",
    "--app-id",
    appId,
    "--branch-name",
    branchName,
    "--job-id",
    jobId
  ]);
  return ((job?.job as { summary?: JobSummary } | undefined)?.summary as JobSummary | undefined) || null;
}

/**
 * 指定ブランチで稼働中のジョブ一覧を返す。
 */
function getActiveJobs(appId: string): JobSummary[] {
  const summaries = listBranchJobSummaries(appId);
  return summaries.filter(summary => ACTIVE_JOB_STATUSES.has(String(summary.status || "")));
}

/**
 * 指定ミリ秒だけ待機する。
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 既存のアクティブジョブが終わるまで待機する。
 */
async function waitForActiveJobIfAny(appId: string): Promise<void> {
  const spinner = ["|", "/", "-", "\\"];
  let tick = 0;
  while (true) {
    const activeJobs = getActiveJobs(appId);
    if (activeJobs.length === 0) {
      if (tick > 0) process.stdout.write("\n");
      return;
    }

    const latestJobId = String(activeJobs[0]?.jobId || "-");
    const summary = getJobSummary(appId, latestJobId);
    const status = summary?.status || activeJobs[0]?.status || "UNKNOWN";
    const icon = spinner[tick % spinner.length];
    tick += 1;
    process.stdout.write(
      `\rWaiting ${icon} active Hosting job: ${status} (job: ${latestJobId}, active=${activeJobs.length})`
    );
    await sleep(4000);
  }
}

/**
 * start-job 失敗が「同ブランチの実行中ジョブ衝突」かどうか判定する。
 */
function isStartJobBusyError(result: AwsResult): boolean {
  const stderr = result.stderr?.toString("utf8") || "";
  const stdout = result.stdout?.toString("utf8") || "";
  const text = `${stdout}\n${stderr}`;
  return /LimitExceededException/i.test(text) && /pending or running jobs/i.test(text);
}

/**
 * Hosting の RELEASE ジョブを起動する。
 * 実行中ジョブとの衝突時は待機してリトライする。
 */
async function startReleaseJobWithRetry(appId: string): Promise<void> {
  for (let attempt = 1; attempt <= START_JOB_RETRY_LIMIT; attempt++) {
    const startJob = runAws(
      [
        "amplify",
        "start-job",
        "--app-id",
        appId,
        "--branch-name",
        branchName,
        "--job-type",
        "RELEASE"
      ],
      false
    );

    if (startJob.status === 0) return;

    if (!isStartJobBusyError(startJob)) {
      const stdout = startJob.stdout?.toString("utf8")?.trim();
      const stderr = startJob.stderr?.toString("utf8")?.trim();
      if (stdout) console.error(stdout);
      if (stderr) console.error(stderr);
      process.exit(startJob.status ?? 1);
    }

    console.log(
      `StartJob conflict: branch has pending/running jobs. Retry ${attempt}/${START_JOB_RETRY_LIMIT} after waiting.`
    );
    await waitForActiveJobIfAny(appId);
    await sleep(2000);
  }

  console.error(`Failed to start Hosting job after ${START_JOB_RETRY_LIMIT} retries.`);
  process.exit(1);
}

/**
 * Hosting デプロイジョブを起動する。
 */
async function main(): Promise<void> {
  const appId = resolveAppId() || createApp();
  saveHostingAppId(appId);
  ensureBranch(appId);
  await waitForActiveJobIfAny(appId);
  await startReleaseJobWithRetry(appId);

  console.log(`Hosting UP completed: appId=${appId}, branch=${branchName}, region=${region}`);
  console.log("Updated config.json: hosting.appId");
}

main().catch((err: unknown) => {
  console.error((err as Error)?.message || err);
  process.exit(1);
});
