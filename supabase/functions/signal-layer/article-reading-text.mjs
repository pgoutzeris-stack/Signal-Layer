// Never let an old teaser translation hide a fuller recovered article.
export function articleReadingText(article) {
  const original = article.cleaned_content || article.content || article.excerpt || "";
  const translated = String(article.content_de || "").trim();
  const threshold = article.language === "de" ? 0.8 : 0.45;
  return translated && translated.length >= String(original).trim().length * threshold
    ? translated : original;
}
