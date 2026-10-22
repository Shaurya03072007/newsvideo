export type UserRole = 'reporter' | 'editor' | 'admin';

export interface User {
  id: string;
  username: string;
  displayName: string;
  displayNameTelugu: string;
  role: UserRole;
  district: string;
  bureau: string;
  active: boolean;
  createdAt: string;
}

export type ArticleStatus =
  | 'draft'
  | 'submitted'
  | 'processing'
  | 'processed'
  | 'flagged_hold'
  | 'approved'
  | 'published'
  | 'failed';

export type NewspaperCategory =
  | 'Local news'
  | 'District news'
  | 'State news'
  | 'National news'
  | 'Politics'
  | 'Education'
  | 'Agriculture'
  | 'Business'
  | 'Crime'
  | 'Public services'
  | 'Health'
  | 'Sports'
  | 'Culture and festivals'
  | 'Community events'
  | 'Announcements'
  | 'Editorials and opinion';

export interface CategoryConfig {
  id: NewspaperCategory;
  teluguLabel: string;
  colorHex: string;
  defaultPagePreference: number;
}

export interface GemmaClassificationOutput {
  section: NewspaperCategory;
  sectionTelugu: string;
  principalSubject: string;
  location: string;
  district: string;
  eventDate: string;
  entities: string[];
  localRelevanceScore: number; // 1-100
  priorityScore: number; // 1-100
  priorityExplanation: string;
  duplicateCandidateIds: string[];
  packageGroupTopic: string | null;
  missingInformation: string[];
  editorialConcerns: string[];
  riskLevel: 'low' | 'medium' | 'high';
  hasSeriousAllegations: boolean;
  hasUnverifiedClaims: boolean;
}

export interface GeminiStoryOutput {
  primaryHeadlineTelugu: string;
  compactHeadlineTelugu: string;
  standfirstTelugu: string;
  summaryTelugu: string;
  bodyParagraphsFullTelugu: string[];
  bodyParagraphsShortTelugu: string[];
  suggestedCaptions: {
    assetId: string;
    captionTelugu: string;
    isVerifiedFromMetadata: boolean;
  }[];
  preservedEntities: string[];
  preservedNumbersAndDates: string[];
  contradictionFlags: string[];
  missingFactsExplicitNote: string | null;
}

export interface ImageAsset {
  id: string;
  articleId: string;
  originalFilename: string;
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
  fileSizeBytes: number;
  width: number;
  height: number;
  storageKeyOriginal: string;
  storageKeyDerivative: string;
  publicUrl: string;
  captionTelugu: string;
  isPrimary: boolean;
  sha256Hash: string;
  createdAt: string;
}

export interface ArticleRevision {
  id: string;
  articleId: string;
  revisionNumber: number;
  sourceType: 'reporter_original' | 'reporter_edit' | 'ai_prepared' | 'editor_override';
  headlineOriginal: string | null;
  primaryHeadlineTelugu: string | null;
  compactHeadlineTelugu: string | null;
  standfirstTelugu: string | null;
  summaryTelugu: string | null;
  bodyTextOriginal: string;
  bodyParagraphsFullTelugu: string[];
  bodyParagraphsShortTelugu: string[];
  modelId: string | null;
  promptVersion: string | null;
  createdByUserId: string;
  createdAt: string;
}

export interface ArticleClassificationRecord {
  id: string;
  articleId: string;
  revisionNumber: number;
  modelId: string;
  promptVersion: string;
  section: NewspaperCategory;
  sectionTelugu: string;
  principalSubject: string;
  location: string;
  district: string;
  entities: string[];
  localRelevanceScore: number;
  priorityScore: number;
  priorityExplanation: string;
  duplicateCandidateIds: string[];
  packageGroupTopic: string | null;
  missingInformation: string[];
  editorialConcerns: string[];
  riskLevel: 'low' | 'medium' | 'high';
  rawJson: GemmaClassificationOutput;
  createdAt: string;
}

export interface ValidationWarning {
  code: string;
  severity: 'info' | 'warning' | 'hold_error';
  message: string;
  field?: string;
}

export interface Article {
  id: string;
  reporterId: string;
  reporterName?: string;
  reporterNameTelugu?: string;
  idempotencyKey: string;
  currentRevision: number;
  originalHeadline: string | null;
  originalBodyTelugu: string;
  primaryHeadlineTelugu: string | null;
  compactHeadlineTelugu: string | null;
  standfirstTelugu: string | null;
  summaryTelugu: string | null;
  aiBodyParagraphsFull: string[];
  aiBodyParagraphsShort: string[];
  suggestedCategory: NewspaperCategory;
  assignedCategory: NewspaperCategory;
  assignedCategoryTelugu: string;
  location: string;
  district: string;
  eventDate: string;
  submissionTime: string;
  status: ArticleStatus;
  priorityScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  validationWarnings: ValidationWarning[];
  classificationModelId: string | null;
  storyModelId: string | null;
  promptVersion: string;
  primaryAssetId: string | null;
  assets?: ImageAsset[];
  classification?: ArticleClassificationRecord | null;
  revisions?: ArticleRevision[];
  createdAt: string;
  updatedAt: string;
}

export type JobType = 'editorial_processing' | 'edition_planning' | 'pdf_generation';
export type JobStatus = 'queued' | 'active' | 'completed' | 'failed' | 'retrying';

export interface AIProcessingJob {
  id: string;
  jobType: JobType;
  targetId: string;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  modelAId: string;
  modelBId: string;
  promptVersion: string;
  cacheHit: boolean;
  progressPercent: number;
  stepDescription: string;
  logs: string[];
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

// ============================================================================
// DESIGNER + EDITOR MASTER LAYOUT PLAN & FEEDBACK LOOP TYPES
// ============================================================================

export type PlanElementType =
  | 'skyline_strip'
  | 'ear_panel'
  | 'masthead'
  | 'edition_strip'
  | 'running_header'
  | 'article_container'
  | 'section_kicker'
  | 'headline'
  | 'standfirst'
  | 'body_text'
  | 'photograph'
  | 'caption'
  | 'callout_box'
  | 'shaped_medallion'
  | 'continuation_link'
  | 'divider'
  | 'footer';

export type GeometricShapeType =
  | 'rectangle'
  | 'circle'
  | 'semi_circle_arch'
  | 'quarter_circle_wedge'
  | 'tomb_arch'
  | 'rhombus_diamond'
  | 'pentagon_shield'
  | 'hexagon_gem'
  | 'star_burst';

export type ShapeTextWrapMode =
  | 'none'
  | 'wrap_left'
  | 'wrap_right'
  | 'wrap_both'
  | 'inside_shape';

export interface GeometricShapeSpec {
  shape_type: GeometricShapeType;
  label_telugu: string;
  label_english: string;
  text_wrap_mode: ShapeTextWrapMode;
  clip_path_css: string;
  shape_outside_css: string;
  shape_margin_mm: number;
  area_efficiency_factor: number; // e.g., pi/4 (~0.785) for circle, 0.50 for rhombus_diamond
  svg_border_path?: string;
  badge_title_telugu?: string;
  badge_value_telugu?: string;
}

export type AllowedCorrectionAction =
  | 'increase_height'
  | 'increase_width'
  | 'select_compact_headline'
  | 'select_short_body'
  | 'reduce_font_size_to_minimum'
  | 'reposition_element'
  | 'adjust_image_crop'
  | 'paginate_continuation'
  | 'reflow_columns'
  | 'expand_to_fill_slack';

export interface PlanElementGeometry {
  x: number; // mm from top-left page origin
  y: number; // mm from top-left page origin
  width: number; // mm
  height: number; // mm
}

export interface PlanElementTypography {
  font_family: 'Noto Sans Telugu' | 'Noto Serif Telugu' | 'JetBrains Mono';
  font_size_pt: number;
  font_weight: 400 | 500 | 600 | 700 | 800;
  line_height: number;
  alignment: 'left' | 'center' | 'right' | 'justify';
  color_hex?: string;
}

export interface PlanElementTextFlow {
  columns: number;
  column_gap_mm: number;
  column_rule_color_hex?: string;
  wrap_around_element_ids?: string[];
  continuation_note_telugu?: string | null;
}

export interface PlanElementImageFit {
  fitting_mode: 'cover' | 'contain';
  focal_point_x: number; // 0.0 to 1.0
  focal_point_y: number; // 0.0 to 1.0
  aspect_ratio_label?: string;
  associated_caption_element_id?: string;
}

export interface PlanElementStyle {
  background_color_hex?: string;
  border_color_hex?: string;
  border_width_mm?: number;
  border_top_width_mm?: number;
  border_bottom_width_mm?: number;
  border_left_width_mm?: number;
  border_right_width_mm?: number;
  padding_mm?: number;
  is_container?: boolean;
  geometric_shape?: GeometricShapeSpec;
}

export interface PlanElementConstraints {
  minimum_width_mm: number;
  maximum_width_mm?: number;
  minimum_height_mm?: number;
  maximum_height_mm?: number;
  minimum_font_size_pt: number;
  allow_repositioning: boolean;
  allow_height_expansion: boolean;
  allow_overlap_with_element_ids?: string[];
  required: boolean;
  permitted_actions: AllowedCorrectionAction[];
}

export interface PlanElement {
  element_id: string;
  type: PlanElementType;
  article_id: string | null;
  asset_id: string | null;
  parent_container_id?: string | null;
  region_id?: string | null;
  grid_span?: {
    start_col: number;
    col_span: number;
  };
  content_ref: string | null; // e.g., "art-krishna-delta.headline.primary" or "art-krishna-delta.body.full"
  text_override_telugu?: string | null;
  reading_order: number;
  z_index: number;
  geometry: PlanElementGeometry;
  typography?: PlanElementTypography;
  text_flow?: PlanElementTextFlow;
  image_fit?: PlanElementImageFit;
  style?: PlanElementStyle;
  constraints: PlanElementConstraints;
}

export interface MasterLayoutPagePlan {
  page_number: number;
  width: number; // mm
  height: number; // mm
  margin_mm: number;
  margin_top_mm?: number;
  margin_bottom_mm?: number;
  margin_left_mm?: number;
  margin_right_mm?: number;
  bleed_mm?: number;
  gutter_mm?: number;
  column_width_mm?: number;
  page_theme_note: string;
  visual_hierarchy_summary: string;
  reference_columns: number;
  elements: PlanElement[];
}

export interface MasterLayoutPlan {
  edition_id: string;
  plan_version: number;
  designer_model_id: string;
  design_rationale: string;
  coordinate_system: {
    unit: 'mm';
    origin: 'top_left';
  };
  revised_element_ids?: string[];
  preserved_element_ids?: string[];
  pages: MasterLayoutPagePlan[];
  created_at: string;
}

export type DiagnosticIssueType =
  | 'text_overflow'
  | 'element_overlap'
  | 'out_of_bounds'
  | 'font_below_minimum'
  | 'missing_asset'
  | 'caption_detached'
  | 'invalid_image_crop'
  | 'duplicate_article'
  | 'suboptimal_utilization'
  | 'column_imbalance'
  | 'hierarchy_weakness';

export interface EditorDiagnosticIssue {
  element_id: string;
  page_number: number;
  article_id: string | null;
  region_id?: string | null;
  type: DiagnosticIssueType;
  severity: 'error' | 'warning';
  failure_class?: 'hard_failure' | 'soft_advisory';
  required_width_mm: number;
  allocated_width_mm: number;
  required_height_mm: number;
  allocated_height_mm: number;
  overlapping_element_id?: string;
  allowed_actions: AllowedCorrectionAction[];
  message: string;
}

export interface PageQualityMetrics {
  page_number: number;
  live_area_mm2: number;
  content_occupied_area_mm2: number;
  container_allocated_area_mm2: number;
  content_occupied_ratio: number; // Actual rendered text/image/header area / live_area
  container_allocated_ratio: number; // Module container footprint / live_area
  whitespace_ratio: number;
  column_balance_score: number; // 0..100
  hierarchy_contrast_score: number; // 0..100
  target_utilization_min: number;
  target_utilization_max: number;
  utilization_status:
    | 'within_target'
    | 'intentional_sparse'
    | 'under_utilized_advisory'
    | 'over_dense_advisory';
}

export interface EditorDiagnosticsReport {
  edition_id: string;
  plan_version: number;
  status: 'valid' | 'layout_errors';
  hard_failure_count?: number;
  soft_advisory_count?: number;
  measured_at: string;
  total_elements_rendered: number;
  element_measurements: Record<
    string,
    {
      allocated_width_mm: number;
      allocated_height_mm: number;
      measured_width_mm: number;
      measured_height_mm: number;
      overflow_mm: number;
    }
  >;
  page_metrics?: Record<number, PageQualityMetrics>;
  issues: EditorDiagnosticIssue[];
}

export interface PlanIterationRecord {
  plan_version: number;
  master_plan: MasterLayoutPlan;
  editor_diagnostics: EditorDiagnosticsReport;
  created_at: string;
}

// Legacy compatibility module view for quick summary cards
export interface LayoutModule {
  moduleId: string;
  articleId: string;
  pageNumber: number;
  gridColumnStart: number;
  gridColumnSpan: number;
  rowOrder: number;
  verticalPositionMm: number;
  measuredHeightMm: number;
  moduleWidthMm: number;
  isLeadStory: boolean;
  isSideBrief: boolean;
  sectionCategory: NewspaperCategory;
  sectionLabelTelugu: string;
  sectionColorHex: string;
  locationDatelineTelugu: string;
  headlineVariant: 'primary' | 'compact';
  headlineTextTelugu: string;
  standfirstTextTelugu: string | null;
  bodyVariant: 'full' | 'short' | 'continued_part1' | 'continued_part2';
  bodyParagraphsTelugu: string[];
  continuationNoteTelugu: string | null;
  photographAssetId: string | null;
  photographUrl: string | null;
  photographCaptionTelugu: string | null;
  photographAspectRatio: string | null;
  headlineFontSizePt: number;
  bodyFontSizePt: number;
  lineHeightRatio: number;
  overflowStatus: 'fit' | 'balanced_short' | 'paginated_continuation';
  geometricShape?: GeometricShapeSpec;
}

export interface PageLayoutManifest {
  pageNumber: number;
  pageTitleTelugu: string;
  sectionFocusTelugu: string;
  totalColumns: number;
  sideBriefColumnIndex: number | null;
  pageWidthMm: number;
  pageHeightMm: number;
  marginMm: number;
  gutterMm: number;
  usableHeightMm: number;
  usedHeightByColumnMm: number[];
  columnFillRatio: number;
  modules: LayoutModule[];
  sideBriefs: LayoutModule[];
  backtrackAttempts: number;
  layoutWarnings: string[];
}

export interface PreflightCheckItem {
  id: string;
  label: string;
  passed: boolean;
  severity: 'critical' | 'warning' | 'info';
  details: string;
}

export interface PreflightReport {
  overallPassed: boolean;
  timestamp: string;
  profile: 'standard_rgb_print' | 'press_cmyk_bleed';
  pdfSizeBytes: number;
  pageCount: number;
  checks: PreflightCheckItem[];
}

export interface PdfInspectorDefect {
  defect_id: string;
  page_number: number;
  element_id: string | null;
  defect_type:
    | 'headline_clipping'
    | 'body_overflow'
    | 'module_overlap'
    | 'whitespace_imbalance'
    | 'weak_visual_hierarchy'
    | 'geometric_shape_collision';
  severity: 'critical' | 'major' | 'minor';
  description: string;
  directive_for_3_5_flash_lite: string;
}

export interface Gemini31PdfInspectionReport {
  inspector_model_id: 'gemini-3.1-flash-lite';
  round_number: number;
  plan_version_inspected: number;
  pdf_size_bytes: number;
  pdf_sha256: string;
  verdict: 'READY_FOR_USER' | 'NEEDS_ARCHITECTURAL_REWRITE';
  approved_to_slide: boolean;
  quality_score: number; // 0..100
  inspector_summary: string;
  defects: PdfInspectorDefect[];
  architectural_directives_for_3_5_flash_lite: string[];
  inspected_at: string;
}

export interface Gemini35ArchitectureRewriteRecord {
  architect_model_id: 'gemini-3.5-flash-lite';
  round_number: number;
  from_plan_version: number;
  to_plan_version: number;
  agent_reasoning: string;
  architectural_changes_applied: string[];
  rewritten_element_ids: string[];
  created_at: string;
}

export interface AgenticPdfLoopRound {
  round_number: number;
  pdf_size_bytes: number;
  plan_version: number;
  inspection_3_1: Gemini31PdfInspectionReport;
  rewrite_3_5: Gemini35ArchitectureRewriteRecord | null;
}

export interface AgenticPdfLoopReport {
  edition_id: string;
  final_verdict: 'READY_FOR_USER' | 'NEEDS_ARCHITECTURAL_REWRITE';
  ready_for_user: boolean;
  total_agent_rounds: number;
  inspector_model_id: 'gemini-3.1-flash-lite';
  architect_model_id: 'gemini-3.5-flash-lite';
  final_quality_score: number;
  final_plan_version: number;
  rounds: AgenticPdfLoopRound[];
  completed_at: string;
}

export interface NewspaperEdition {
  id: string;
  editionNumber: number;
  editionDate: string;
  editionTitleTelugu: string;
  mastheadTitleTelugu: string;
  mastheadSubtitleTelugu: string;
  targetPageCount: number;
  actualPageCount: number;
  pageWidthMm: number;
  pageHeightMm: number;
  columnsPerPage: number;
  gutterMm: number;
  status: 'draft' | 'planning' | 'compositing' | 'generating_pdf' | 'published' | 'failed';
  activeJobId: string | null;
  articleIds: string[];
  pages: PageLayoutManifest[];
  masterPlan?: MasterLayoutPlan | null;
  editorDiagnostics?: EditorDiagnosticsReport | null;
  planHistory?: PlanIterationRecord[];
  agenticPdfReport?: AgenticPdfLoopReport | null;
  pdfArtifactId: string | null;
  pdfPublicUrl: string | null;
  preflightReport: PreflightReport | null;
  layoutDiagnostics: {
    totalEligibleArticles: number;
    placedArticles: number;
    carriedForwardArticles: number;
    heldFlaggedArticlesSkipped: number;
    duplicateClustersDetected: number;
    totalBacktrackReflows: number;
    designerIterations?: number;
    finalPlanVersion?: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface PublicationSettings {
  newspaperNameTelugu: string;
  newspaperTaglineTelugu: string;
  editionCityTelugu: string;
  registrationNumber: string;
  modelAClassifierId: string;
  modelBStoryId: string;
  designerModelId: string;
  maxDesignerEditorIterations: number;
  promptVersion: string;
  defaultPageCount: number;
  pageWidthMm: number;
  pageHeightMm: number;
  columnsPerPage: number;
  gutterMm: number;
  marginMm: number;
  marginTopMm?: number;
  marginBottomMm?: number;
  marginLeftMm?: number;
  marginRightMm?: number;
  bleedMm?: number;
  targetUtilizationMin?: number;
  targetUtilizationMax?: number;
  minBodyFontSizePt: number;
  minHeadlineFontSizePt: number;
  maxImageSizeBytes: number;
  minImageWidthPx: number;
  minImageHeightPx: number;
  autoHoldHighRiskStories: boolean;
  autoHoldSeriousAllegations: boolean;
  autoHoldContradictions: boolean;
  pressPreflightProfile: 'standard_rgb_print' | 'press_cmyk_bleed';
  categories: CategoryConfig[];
}
