export const CANDIDATE_STATUS = {
  unverified: { label: "未確認", className: "bg-white text-ink-muted border-line border-dashed" },
  awaiting_official: { label: "公式サイト確認待ち", className: "bg-warn-bg text-warn border-warn" },
  official_verified: { label: "公式情報確認済み", className: "bg-ev-a-bg text-ev-a border-ev-a" },
  direct_verified: { label: "直接問い合わせ確認済み", className: "bg-ev-b-bg text-ev-b border-ev-b" },
  publishable: { label: "掲載可能", className: "bg-primary text-white border-primary" },
  excluded: { label: "掲載対象外", className: "bg-ev-d-bg text-ev-d border-ev-d" },
} as const;
export type CandidateStatusKey = keyof typeof CANDIDATE_STATUS;

export const MATCH_KIND: Record<string, string> = {
  navii_id: "ナビイIDが一致",
  phone: "電話番号が一致",
  address_name: "住所と名称が一致",
  location_name: "位置（100m以内）と名称が一致",
  name_only: "名称のみ一致（要確認）",
};

export const VERIFICATION_METHOD: Record<string, string> = {
  official_site: "公式サイト",
  phone: "電話",
  form: "問い合わせフォーム",
  email: "メール",
  visit: "訪問",
};
