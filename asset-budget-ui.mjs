const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
export function confirmAssetBudget(result, host) {
  return new Promise(resolve => {
    const dialog = document.createElement("dialog");
    dialog.className = "as-budget-dialog";
    dialog.style.cssText = "width:min(440px,calc(100vw - 40px));box-sizing:border-box;border:1px solid #dce6f5;border-radius:18px;padding:24px;color:#17314e;background:#fff;box-shadow:0 24px 80px #17314e40;font:14px 'Circular Std',system-ui;";
    dialog.innerHTML = `<style>.as-budget-dialog::backdrop{background:#172b4866;backdrop-filter:blur(4px)}.as-budget-dialog h3{margin:0 0 16px;font-size:19px}.as-budget-dialog p{line-height:1.5}.as-budget-dialog footer{display:flex;justify-content:flex-end;gap:8px;margin-top:22px}.as-budget-dialog button{border:1px solid #dce6f5;border-radius:10px;padding:10px 14px;background:#f4f7fb;cursor:pointer;font:inherit}.as-budget-dialog button[data-continue]{background:#206efb;color:#fff;border-color:#206efb}</style>
      <h3><i class="fa-solid fa-wallet" style="color:#206efb;margin-right:8px"></i>${result.blocked ? "Generierung derzeit nicht möglich" : "Guthaben vor dem Start prüfen"}</h3>
      ${(result.checks || []).map(c => `<p><strong>${escapeHtml(c.label)}${c.optional ? " · optionale Bilder" : ""}</strong><br>${escapeHtml(c.message)}${c.estimated_usd > 0 ? `<br><small>Geschätzter Bedarf mit Reserve: ${Number(c.estimated_usd).toFixed(2)} US$</small>` : ""}</p>`).join("")}
      <footer><button data-cancel>${result.blocked ? "Schließen" : "Abbrechen"}</button>${result.blocked ? "" : '<button data-continue>Trotzdem generieren</button>'}</footer>`;
    const finish = value => { observer.disconnect(); dialog.remove(); resolve(value); };
    const observer = new MutationObserver(() => { if (!host.isConnected) finish(false); });
    observer.observe(document.body, { childList: true, subtree: true });
    dialog.querySelector("[data-cancel]").onclick = () => finish(false);
    const proceed = dialog.querySelector("[data-continue]");
    if (proceed) proceed.onclick = () => finish(true);
    dialog.addEventListener("cancel", event => { event.preventDefault(); finish(false); });
    host.append(dialog);
    dialog.showModal();
    dialog.querySelector("[data-cancel]").focus();
  });
}
