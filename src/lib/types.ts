export type RegionKey =
  | "hokkaido_tohoku"
  | "kanto"
  | "chubu"
  | "kinki"
  | "chugoku_shikoku"
  | "kyushu_okinawa";

export type SupportStatus = "available" | "consultation" | "not_offered" | "unknown";
export type EvidenceStatus = "A" | "B" | "C" | "D" | "U";
export type SourceType = "official_site" | "direct_inquiry" | "public_registry";
export type ExtraFee = "none" | "required" | "unknown";
export type CareStatus = "yes" | "conditional" | "no" | "unknown";
export type CareItemKey =
  | "explanation_before_procedure"
  | "informed_consent"
  | "stop_on_request"
  | "pain_management_consultation"
  | "female_doctor_available"
  | "female_staff_available"
  | "consultation_only";

export interface Prefecture {
  code: number;
  slug: string;
  name: string;
  region: RegionKey;
}

export interface Procedure {
  slug: string;
  name: string;
  category: string;
  description: string;
}

export interface AnesthesiaMethod {
  slug: string;
  name: string;
  description: string;
  isConsultationOnly: boolean;
  /** 「麻酔を使用しない」。痛みへの対応としては数えない */
  isNone?: boolean;
}

export interface Source {
  id: string;
  sourceType: SourceType;
  sourceUrl?: string;
  sourceTitle: string;
  evidenceExcerpt?: string;
  contactedDepartment?: string;
  /** 資料に書かれた作成日・掲載日（例：「2024年1月作成」「記載なし」） */
  documentDate?: string;
  notes?: string;
  checkedAt: string; // YYYY-MM-DD
}

export interface ProcedureSupport {
  procedureSlug: string;
  methodSlug: string;
  supportStatus: SupportStatus;
  conditions?: string;
  scheduleNote?: string;
  extraFee: ExtraFee;
  extraFeeNote?: string;
  notes?: string;
  evidenceStatus: EvidenceStatus;
  sourceId?: string;
  verifiedAt?: string;
}

export interface CareItem {
  key: CareItemKey;
  status: CareStatus;
  note?: string;
  evidenceStatus: EvidenceStatus;
  sourceId?: string;
  verifiedAt?: string;
}

export interface Facility {
  id: string;
  name: string;
  prefectureCode: number;
  city: string;
  address: string;
  phone?: string;
  websiteUrl?: string;
  latitude?: number;
  longitude?: number;
  facilityType: "clinic" | "hospital";
  departments: string[];
  nearestStations: string[];
  consultationHours?: string;
  isDemo: boolean;
  /** 管理者向けの審査メモ（公開画面では表示しない） */
  reviewNote?: string;
  /** 基本情報の確度（D：公的情報などで一般的な診療情報のみ確認） */
  basicInfoSourceId?: string;
  support: ProcedureSupport[];
  care: CareItem[];
  sources: Source[];
}

export interface SearchFilters {
  pref?: number;
  city?: string;
  procedure?: string;
  method?: string;
  q?: string;
  femaleDoctor?: boolean;
  consultOnly?: boolean;
  stopOnRequest?: boolean;
  /** "A" = 公式情報で確認済みのみ / "B" = 直接確認済みのみ */
  evidence?: ("A" | "B")[];
}

export type Tier = 1 | 2 | 3 | 4;

export interface SearchResult {
  facility: Facility;
  tier: Tier;
  /** 希望条件に該当した対応行（ティア判定の根拠） */
  matched: ProcedureSupport[];
  /** 最新の確認日（同ティア内の並び替えに使用） */
  latestVerifiedAt?: string;
}
