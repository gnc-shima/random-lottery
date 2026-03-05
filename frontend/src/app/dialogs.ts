/**
 * ダイアログ表示モジュール
 *
 * 役割:
 * - 情報表示モーダル（OKのみ）
 * - 確認モーダル（OK / キャンセル）
 *
 * 補足:
 * - `<dialog>` が使えない環境では alert/confirm にフォールバックする。
 */

/**
 * 生成した dialog 要素へ共通スタイルを適用する。
 */
function applyBaseDialogStyle(dialog: HTMLDialogElement): void {
  dialog.style.padding = "20px";
  dialog.style.border = "none";
  dialog.style.borderRadius = "12px";
  dialog.style.maxWidth = "560px";
  dialog.style.width = "calc(100% - 40px)";
}

/**
 * 指定IDのタイトル/本文要素へ表示テキストを反映する。
 */
function setDialogText(dialog: HTMLDialogElement, titleId: string, bodyId: string, title: string, body: string): void {
  const titleEl = dialog.querySelector(`#${titleId}`) as HTMLDivElement | null;
  const bodyEl = dialog.querySelector(`#${bodyId}`) as HTMLDivElement | null;
  if (titleEl) titleEl.textContent = String(title || "");
  if (bodyEl) bodyEl.textContent = String(body || "");
}

/**
 * メッセージ表示用モーダルを表示する。
 */
export function showMessageDialog(title: string, message: string): void {
  const text = String(message || "");
  let dialog = document.getElementById("appMessageDialog") as HTMLDialogElement | null;
  if (!dialog) {
    dialog = document.createElement("dialog");
    dialog.id = "appMessageDialog";
    applyBaseDialogStyle(dialog);

    const titleEl = document.createElement("div");
    titleEl.id = "appMessageTitle";
    titleEl.style.fontSize = "20px";
    titleEl.style.fontWeight = "700";
    titleEl.style.marginBottom = "14px";

    const bodyEl = document.createElement("div");
    bodyEl.id = "appMessageBody";
    bodyEl.style.whiteSpace = "pre-wrap";
    bodyEl.style.lineHeight = "1.6";
    bodyEl.style.marginBottom = "18px";

    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.justifyContent = "flex-end";

    const ok = document.createElement("button");
    ok.type = "button";
    ok.textContent = "OK";
    ok.className = "btn";
    ok.addEventListener("click", () => dialog?.close());
    actions.appendChild(ok);

    dialog.appendChild(titleEl);
    dialog.appendChild(bodyEl);
    dialog.appendChild(actions);
    document.body.appendChild(dialog);
  }

  setDialogText(dialog, "appMessageTitle", "appMessageBody", title, text);

  if (typeof dialog.showModal === "function") {
    if (dialog.open) dialog.close();
    dialog.showModal();
    return;
  }
  window.alert(text);
}

/**
 * OK/キャンセルの確認モーダルを表示し、結果を Promise<boolean> で返す。
 */
export function showConfirmDialog(title: string, message: string): Promise<boolean> {
  const text = String(message || "");
  let dialog = document.getElementById("appConfirmDialog") as HTMLDialogElement | null;
  if (!dialog) {
    dialog = document.createElement("dialog");
    dialog.id = "appConfirmDialog";
    applyBaseDialogStyle(dialog);

    const titleEl = document.createElement("div");
    titleEl.id = "appConfirmTitle";
    titleEl.style.fontSize = "20px";
    titleEl.style.fontWeight = "700";
    titleEl.style.marginBottom = "14px";

    const bodyEl = document.createElement("div");
    bodyEl.id = "appConfirmBody";
    bodyEl.style.whiteSpace = "pre-wrap";
    bodyEl.style.lineHeight = "1.6";
    bodyEl.style.marginBottom = "18px";

    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.justifyContent = "flex-end";
    actions.style.gap = "8px";

    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "キャンセル";
    cancel.className = "btn dialogCancelBtn";
    cancel.style.background = "linear-gradient(90deg, #eef3ff, #d9e6ff)";
    cancel.style.color = "#1f3769";
    cancel.style.border = "1px solid #9ab0d9";
    cancel.style.textShadow = "none";
    cancel.addEventListener("click", () => {
      dialog?.close("cancel");
    });

    const ok = document.createElement("button");
    ok.type = "button";
    ok.textContent = "OK";
    ok.className = "btn";
    ok.addEventListener("click", () => {
      dialog?.close("ok");
    });

    actions.appendChild(cancel);
    actions.appendChild(ok);
    dialog.appendChild(titleEl);
    dialog.appendChild(bodyEl);
    dialog.appendChild(actions);
    document.body.appendChild(dialog);
  }

  setDialogText(dialog, "appConfirmTitle", "appConfirmBody", title, text);

  if (typeof dialog.showModal !== "function") {
    return Promise.resolve(window.confirm(text));
  }

  if (dialog.open) dialog.close();
  dialog.showModal();
  return new Promise(resolve => {
    dialog?.addEventListener(
      "close",
      () => {
        resolve(dialog?.returnValue === "ok");
      },
      { once: true }
    );
  });
}
