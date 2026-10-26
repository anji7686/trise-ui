import { apiClient } from "@trise/api-client";
import type { components } from "../../../packages/api-client/src/generated";

export type ProviderAdminInvitation =
  components["schemas"]["ProviderAdminInvitation"];
export type SubscriptionEvidenceReviewFeedback =
  components["schemas"]["SubscriptionEvidenceReviewFeedback"];
export type SubscriptionEvidenceFeedback =
  components["schemas"]["SubscriptionEvidenceFeedback"];
type InvitationCollection =
  components["schemas"]["ProviderAdminInvitationCollection"];
type InvitationResponse =
  components["schemas"]["ProviderAdminInvitationResponse"];

export type Link = { id: string; type: string };
export type Resource<T> = {
  id: string;
  type: string;
  attributes: T;
  relationships: Record<string, Link | Link[] | null | undefined>;
};
export type PageMetadata = {
  limit?: number;
  next?: string | null;
  previous?: string | null;
};
export type Collection<T> = { data: Resource<T>[]; page?: PageMetadata };
export type WorkIntakeMatch = {
  kind: "ASSET" | "PROJECT" | "WORK_INTAKE";
  id: string;
  label: string;
  confidence: "POSSIBLE";
  reason: string;
};
export type WorkIntakeAssignee = {
  id: string;
  name?: string | null;
  email?: string | null;
  membership_context?: string | null;
  roles?: string[];
};
export type RequirementCompletion = {
  complete: boolean;
  missing_fields: string[];
};
export type RequirementScope = {
  source?: string;
  revision_id?: string;
  revision_number?: number;
  profile_mode?: "SHARED" | "PER_UNIT";
  requirements?: Record<string, unknown>;
  units?: Array<Record<string, unknown>>;
};
export type WorkIntakeAttributes = {
  created_at?: string;
  reference_code: string;
  source: string;
  work_type: string;
  workflow_template_key: string;
  status: string;
  workflow_stage?: string;
  journey_stage_status?: "ACTIVE" | "COMPLETED";
  journey_status?: "ACTIVE" | "COMPLETED" | "CANCELLED";
  journey_status_label?: string;
  journey_abandoned_at?: string | null;
  journey_abandonment_reason?: string | null;
  workflow_route?: string | null;
  downstream_team?: string | null;
  allowed_workflow_routes?: string[];
  workflow_route_decided_by_user_id?: string | null;
  workflow_route_decided_at?: string | null;
  workflow_route_decision_reason?: string | null;
  title: string;
  description?: string | null;
  captured_requirements?: Record<string, unknown>;
  requirements?: Record<string, unknown> & { quantity?: string | number };
  requirement_scope?: RequirementScope;
  requirements_completion?: RequirementCompletion;
  requester_name?: string | null;
  requester_contact_reference?: string | null;
  site_summary?: string | null;
  referral_contact?: {
    name?: string | null;
    number?: string | null;
    email?: string | null;
    role?: string | null;
    details?: string | null;
    tracking_number?: string | null;
  };
  site_coordinates?: {
    latitude?: number | null;
    longitude?: number | null;
    accuracy_m?: number | null;
    source?: string | null;
    captured_at?: string | null;
  };
  photo_count?: number;
  document_count?: number;
  relationship_status: "UNRESOLVED" | "SUGGESTED" | "CONFIRMED" | "DISMISSED";
  match_suggestions: WorkIntakeMatch[];
  relationship_confirmed_at?: string | null;
  relationship_confirmed_by_user_id?: string | null;
  relationship_decision_reason?: string | null;
  assessment_task: {
    status: string;
    assigned_to_user_id?: string | null;
    assigned_to?: WorkIntakeAssignee | null;
    created_at?: string | null;
    current_state?: string | null;
    remaining_scope?: string | null;
    responsibility_boundary?: string | null;
    completed_by_user_id?: string | null;
    completed_at?: string | null;
  };
  created_by_user_id: string;
  created_by?: WorkIntakeAssignee | null;
  assigned_to_user_id?: string | null;
  assigned_to?: WorkIntakeAssignee | null;
  dismissed_match_ids: Array<{ kind: string; id: string; at: string }>;
  revision: number;
};
export type MarketingLeadUser = {
  id: string;
  name?: string | null;
  email?: string | null;
};
export type MarketingLeadAttributes = {
  reference_code: string;
  source: string;
  title: string;
  prospect_name: string;
  customer_relationship_name?: string | null;
  primary_contact_reference?: string | null;
  status: string;
  priority: string;
  workflow_stage?: string;
  journey_stage_status?: "ACTIVE" | "COMPLETED";
  journey_status?: "ACTIVE" | "COMPLETED" | "CANCELLED";
  journey_status_label?: string;
  journey_abandoned_at?: string | null;
  journey_abandonment_reason?: string | null;
  next_follow_up_at?: string | null;
  lost_reason?: string | null;
  requirements?: Record<string, unknown>;
  requirement_scope?: RequirementScope;
  requirements_completion?: RequirementCompletion;
  created_by?: MarketingLeadUser | null;
  assigned_marketing_executive?: MarketingLeadUser | null;
  marketing_manager?: MarketingLeadUser | null;
  revision: number;
};
export type SiteSurveyAttributes = {
  created_at?: string;
  survey_date?: string | null;
  status: "DRAFT" | "SCHEDULED" | "SUBMITTED" | "REVIEWED";
  building_details: Record<string, unknown>;
  proposed_elevator_count?: number | null;
  floor_count?: number | null;
  technical_measurements: Record<string, unknown>;
  access_conditions: Record<string, unknown>;
  requirements: Record<string, unknown>;
  requirement_scope?: RequirementScope;
  requirements_completion?: RequirementCompletion;
  survey_context: Record<string, unknown>;
  unit_details: Array<Record<string, unknown>>;
  revision: number;
};
export type RequirementRevisionAttributes = {
  revision_number: number;
  requirements: Record<string, unknown>;
  requirement_scope?: RequirementScope;
  requirements_completion?: RequirementCompletion;
  approved: boolean;
  approved_at?: string | null;
};
export type ProviderAttributes = {
  display_name: string;
  representation?: string;
};
export type PlatformProviderAttributes = ProviderAttributes & {
  status: string;
  operational_status?:
    "ACTIVE" | "PENDING" | "RESTRICTED" | "BLOCKED" | "CLOSED" | "UNKNOWN";
  revision?: number;
  lifecycle_revision?: number;
  provider_code?: string;
  representation_kind?: string;
  business_id?: string;
  business_name?: string;
  effective_from?: string;
  effective_to?: string;
  provider_admin_setup?: string;
  business_verification_status?: string;
  business_profile_revision?: number;
  audit_history?: Array<{
    action: string;
    actor_kind?: string;
    occurred_at: string;
    request_id?: string | null;
  }>;
};
export type PlatformProviderIdentityDomain = {
  id: string;
  type: string;
  attributes: {
    business_id: string;
    domain: string;
    status: string;
    revision: number;
    verified_at?: string | null;
    approved_at?: string | null;
    reason: string;
    verification_email?: string | null;
    verification_email_sent_at?: string | null;
    verification_expires_at?: string | null;
    email_verified_at?: string | null;
    verification_delivery_status?: string | null;
    verification_delivery_attempts?: number;
    verification_delivery_error?: string | null;
    verification_token?: string;
    pending_status?: string;
  };
};
export type ComplianceVersion = {
  id: string;
  version_number: number;
  values: Record<string, unknown>;
  approved_by_user_id?: string | null;
  source_change_request_id?: string | null;
  approved_at?: string | null;
  activities: Array<{
    id: string;
    code: string;
    restriction?: string | null;
    effective_from?: string | null;
    effective_until?: string | null;
  }>;
  territories: Array<{
    id: string;
    country_code: string;
    state_or_union_territory?: string | null;
    district_code?: string | null;
    locality_code?: string | null;
    scope_level: string;
    restriction?: string | null;
  }>;
  evidence_documents: Array<{
    document_id: string;
    document_version_id: string;
  }>;
};
export type PlatformComplianceRequest = Resource<{
  request_type: string;
  status: string;
  reason: string;
  proposed_values: Record<string, unknown>;
  base_version_number: number;
  revision: number;
  submitted_by_user_id?: string | null;
  reviewer_user_id?: string | null;
  reviewer_reason?: string | null;
  submitted_at?: string | null;
  decided_at?: string | null;
  applied_version_id?: string | null;
  evidence_documents: Array<{
    document_id: string;
    document_version_id: string;
    filename?: string | null;
    media_type?: string | null;
    size_bytes?: number | null;
    status?: string | null;
    scan_state?: string | null;
    scan_reason?: string | null;
    version_number?: number | null;
  }>;
  audit_history: Array<{
    id: string;
    action: string;
    actor_user_id?: string | null;
    occurred_at?: string | null;
    request_id?: string | null;
    correlation_id?: string | null;
    before: Record<string, unknown>;
    after: Record<string, unknown>;
  }>;
  record: {
    id: string;
    attributes: {
      subject_type: string;
      business_id?: string | null;
      provider_id?: string | null;
      requirement_code: string;
      status: string;
      revision: number;
      current_version_number?: number | null;
      current_version?: ComplianceVersion | null;
      versions: ComplianceVersion[];
    };
  };
}>;
export type PlatformCompliancePage = {
  data: PlatformComplianceRequest[];
  meta: { page: number; per_page: number; total: number; total_pages: number };
};
export type BusinessHistoryVersion = {
  id: string;
  requirement_code: string;
  version_number: number;
  values: Record<string, unknown>;
  approved_by_user_id?: string | null;
  approved_at?: string | null;
  source_change_request_id?: string | null;
  evidence_document_ids: string[];
};
export type BusinessAuditEvent = {
  id: string;
  action: string;
  actor_kind?: string | null;
  actor_user_id?: string | null;
  occurred_at?: string | null;
  resource_kind: string;
  resource_id: string;
  request_id?: string | null;
  correlation_id?: string | null;
  metadata?: Record<string, unknown>;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
};
export type BusinessHistoryPage<T> = {
  data: T[];
  meta: { page: number; per_page: number; total: number; total_pages: number };
};
export type ProviderOperatingTerritory = Resource<{
  provider_id: string;
  country_code: string;
  state_or_union_territory?: string | null;
  district_code?: string | null;
  locality_code?: string | null;
  scope_level: "COUNTRY" | "STATE" | "DISTRICT" | "LOCALITY";
  requested_status: string;
  effective_from: string;
  effective_until?: string | null;
  revision: number;
  reason: string;
  created_by_user_id: string;
}>;
export type ProviderLicenceAuthorization = Resource<{
  provider_id: string;
  business_id: string;
  compliance_record_id: string;
  requirement_code: string;
  approved_record_version_id: string;
  status: string;
  reason: string;
  reviewer_reason?: string | null;
  revision: number;
  submitted_by_user_id: string;
  reviewed_by_user_id?: string | null;
  reviewer_user_id?: string | null;
  assigned_at?: string | null;
  assignment_reason?: string | null;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  source_valid_until?: string | null;
  activities: Array<{ code: string; restriction?: string | null }>;
  territories: Array<{
    country_code: string;
    state_or_union_territory?: string | null;
    district_code?: string | null;
    locality_code?: string | null;
    scope_level: string;
    restriction?: string | null;
  }>;
}>;
export type PlatformLicenceAuthorization = {
  id: string;
  type: string;
  attributes: ProviderLicenceAuthorization["attributes"];
};
export type AvailableBusinessLicence = {
  id: string;
  type: string;
  attributes: {
    compliance_record_id: string;
    approved_record_version_id: string;
    requirement_code: string;
    issuing_authority?: string | null;
    licence_number_last4?: string | null;
    validity_type: string;
    expires_at?: string | null;
    activities: Array<{ code: string; restriction?: string | null }>;
    territories: Array<{
      country_code: string;
      state_or_union_territory?: string | null;
      district_code?: string | null;
      locality_code?: string | null;
      scope_level: string;
      restriction?: string | null;
    }>;
    existing_authorization_status: string;
  };
};
export type PlatformComplianceRequirement = Resource<{
  code: string;
  name: string;
  subject_type: "BUSINESS" | "PROVIDER" | "AGENT" | "ASSET";
  status: "DRAFT" | "ACTIVE" | "INACTIVE";
  applicability: string;
  validity_type: string;
  evidence_requirements: string[];
  jurisdiction: Record<string, unknown>;
  business_constitution_codes: string[];
  business_operation_codes: string[];
  activity_codes: string[];
  legal_holder_types: string[];
  legal_source: Record<string, unknown>;
  effective_from?: string | null;
  effective_to?: string | null;
  published_at?: string | null;
  published_by_user_id?: string | null;
  revision: number;
}>;
export type ProviderBusinessProfile = {
  provider_id: string;
  profile: {
    legal_name?: string | null;
    registration_number?: string | null;
    tax_identifier?: string | null;
    gstin?: string | null;
    pan_number?: string | null;
    address?: Record<string, string | null>;
    contact_point_ids?: string[];
  };
  revision: number;
  verification_status: string;
  submitted_at?: string | null;
  verified_at?: string | null;
  contacts?: Array<{ id: string; display_name: string; contact_kind: string }>;
};
export type ProviderVerificationReviewAttributes = {
  review_kind: string;
  status: string;
  reason?: string | null;
  business_profile_revision?: number | null;
  document_version_id?: string | null;
  submitted_at: string;
  reviewed_at?: string | null;
  revision: number;
  submitted_by_user_id?: string;
  reviewed_by_user_id?: string;
};
export type ProviderVerificationReview =
  Resource<ProviderVerificationReviewAttributes>;
export type ProviderDocumentAttributes = {
  filename: string;
  media_type: string;
  size_bytes: number;
  classification: string;
  status: string;
  scan_state: string;
  scan_reason?: string | null;
  scan_recorded_at?: string | null;
  revision: number;
  current_version_id?: string | null;
  current_version?: number | null;
  created_at?: string | null;
};
export type ProviderDocument = Resource<ProviderDocumentAttributes>;
export type DocumentTransfer = {
  url: string;
  method: string;
  headers: Record<string, string>;
  expires_in: number;
  expires_at: string;
};
export type ProviderAuditAttributes = {
  created_at?: string;
  provider_id?: string;
  action: string;
  occurred_at: string;
  trace_id?: string;
  resource_kind?: string | null;
  resource_id?: string | null;
  actor_kind?: string | null;
  actor_user_id?: string | null;
  actor_party_id?: string | null;
  actor_workforce_profile_id?: string | null;
  actor_name?: string | null;
  actor_email?: string | null;
  metadata?: Record<string, unknown>;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
};
export type ProviderWorkJourneyLink = {
  id: string;
  resource_kind: string;
  resource_id: string;
  stage: string;
  status: string;
  label?: string | null;
  linked_at: string;
  linked_by_user_id?: string | null;
  concluded_at?: string | null;
  concluded_by_user_id?: string | null;
  conclusion_reason?: string | null;
  metadata?: Record<string, unknown>;
};
export type ProviderWorkJourneyMilestone = {
  code: string;
  label: string;
  status: "ACTIVE" | "COMPLETED" | "NOT_STARTED";
  resource_count: number;
  completed_at?: string | null;
  completed_by_user_id?: string | null;
  conclusion_reason?: string | null;
};
export type ProviderWorkJourneyAttributes = {
  status: string;
  current_stage: string;
  revision: number;
  workflow_stage?: string;
  journey_stage?: string;
  journey_stage_status?: "ACTIVE" | "COMPLETED";
  journey_id?: string;
  journey_link_id?: string;
  abandoned_at?: string | null;
  abandoned_by_user_id?: string | null;
  abandonment_reason?: string | null;
  abandonment?: {
    payment_disposition?:
      "NO_REFUND_DUE" | "REFUND_REQUIRED" | "REFUND_ALREADY_COMPLETED";
    payment_count?: number;
  };
  context: {
    requester?: { name?: string | null; contact_reference?: string | null };
    referral?: {
      name?: string | null;
      number?: string | null;
      tracking_number?: string | null;
      email?: string | null;
      role?: string | null;
      details?: string | null;
    };
    site?: {
      summary?: string | null;
      service_location_id?: string | null;
      latitude?: number | null;
      longitude?: number | null;
      accuracy_m?: number | null;
      source?: string | null;
      captured_at?: string | null;
    };
    work?: {
      title?: string | null;
      description?: string | null;
      source?: string | null;
      work_type?: string | null;
    };
    requirements?: {
      captured?: Record<string, unknown>;
      latest?: Record<string, unknown>;
      latest_revision?: number | null;
      latest_site_survey_id?: string | null;
      source?: string;
    };
    evidence?: { photos?: number; documents?: number };
  };
  workflow_milestones?: ProviderWorkJourneyMilestone[];
  links: ProviderWorkJourneyLink[];
  events?: Array<Resource<ProviderAuditAttributes>>;
  created_at?: string | null;
  updated_at?: string | null;
};
export type ProviderWorkJourney = Resource<ProviderWorkJourneyAttributes>;
export type PlatformLogo = {
  id: string;
  provider_id: string;
  document_id: string;
  version_id: string;
  filename: string;
  media_type: string;
  status: string;
  scan_state: string;
  revision: number;
  transfer?: DocumentTransfer;
};
export type ProviderBusinessProfileResponse = { data: ProviderBusinessProfile };
export type ProviderOnboardingContactAttributes = {
  contact_id: string;
  display_name: string;
  contact_methods: Record<string, string>;
  designation: string;
  responsibility_type: string;
  status: string;
  effective_from: string;
  effective_to?: string | null;
  revision: number;
};
export type PlatformProviderMemberAttributes = {
  provider_id: string;
  user_id: string;
  name?: string;
  email: string;
  status: string;
  revision: number;
  role_context: string;
  effective_from?: string;
  effective_to?: string | null;
};
export type PlatformProviderUserRole = {
  id: string;
  name: string;
  role_type: "default" | "custom";
};
export type PlatformProviderUserOperation = {
  id: string;
  code: string;
  name: string;
};
export type PlatformProviderUserActivity = {
  action: string;
  actor_user_id?: string | null;
  provider_id?: string | null;
  occurred_at: string;
  outcome: string;
  resource_kind?: string | null;
  resource_id?: string | null;
};
export type PlatformProviderUserAccess = {
  membership_id: string;
  provider_id: string;
  provider_name: string;
  provider_code?: string | null;
  business_id?: string | null;
  business_name?: string | null;
  business_operation?: PlatformProviderUserOperation | null;
  roles: PlatformProviderUserRole[];
  membership_status: string;
  access_revision?: number;
  last_active_at?: string | null;
  created_at?: string | null;
};
export type PlatformProviderUserAttributes = {
  user_id: string;
  membership_id: string;
  name?: string | null;
  email?: string | null;
  mobile?: string | null;
  provider_id: string;
  provider_code?: string | null;
  provider_name: string;
  business_id?: string | null;
  business_name?: string | null;
  business_operation?: PlatformProviderUserOperation | null;
  business_operations: PlatformProviderUserOperation[];
  roles: PlatformProviderUserRole[];
  membership_status: string;
  access_mode: string;
  access_revision?: number;
  invitation_status?: string | null;
  invitation_id?: string | null;
  invitation_revision?: number | null;
  last_sign_in_at?: string | null;
  last_active_at?: string | null;
  created_at?: string | null;
  created_by?: string | null;
  provider_access?: PlatformProviderUserAccess[] | null;
  activity?: PlatformProviderUserActivity[] | null;
};
export type PlatformProviderUserSummary = {
  total_users: number;
  active: number;
  inactive: number;
  pending: number;
};
export type PlatformProviderUserFilters = {
  providers: Array<{ id: string; name: string; code?: string | null }>;
  roles: Array<{ id: string; name: string }>;
  business_operations: Array<{ id: string; name: string; code: string }>;
};
export type PlatformProviderUsersResponse =
  Collection<PlatformProviderUserAttributes> & {
    summary?: PlatformProviderUserSummary;
    filters?: PlatformProviderUserFilters;
  };
export type PlatformTeamMember = {
  id: string;
  type: string;
  attributes: {
    user_id: string;
    display_name?: string;
    email?: string;
    status: string;
    platform_role_code?: string;
    platform_role_name?: string;
    revision: number;
    effective_from?: string;
    effective_to?: string | null;
    effective_permissions?: string[];
  };
};
export type PlatformRoleDefinition = {
  id: string;
  type: string;
  attributes: {
    code: string;
    name: string;
    description?: string;
    status?: string;
    protected: boolean;
    assignable?: boolean;
    eligibility_reason?: string | null;
    capabilities: string[];
  };
};
export type PlatformTeamInvitation = {
  id: string;
  type: string;
  attributes: {
    target_email: string;
    platform_role_code: string;
    platform_role_name: string;
    status: string;
    expires_at: string;
    revision: number;
    created_at: string;
  };
};
export type PlatformTeamAudit = {
  action: string;
  actor_user_id?: string;
  created_at: string;
  metadata?: Record<string, unknown>;
};
export type PlatformProviderAdminInvitationAttributes = {
  provider_id: string;
  provider_name: string;
  status: string;
  expires_at: string;
  expired: boolean;
  revision: number;
  created_at: string;
  accepted_at?: string | null;
  revoked_at?: string | null;
  accepted_membership_id?: string | null;
  delivery_status: string;
  delivery_attempts: number;
  last_sent_at?: string | null;
  last_delivery_error?: string | null;
  target_user_id?: string;
};
export type ProviderOfficeLocationAttributes = {
  name: string;
  location_kind: string;
  address: Record<string, string>;
  latitude?: number | null;
  longitude?: number | null;
  status: string;
  revision: number;
};
export type PlatformProviderManagerAssignment = {
  assignment_id: string;
  user_id: string;
  provider_id: string;
  status: string;
  revision: number;
  effective_from: string;
  effective_to?: string | null;
};
export type IndiaPincodeLookup = {
  data: {
    pincode: string;
    found: boolean;
    ambiguous: boolean;
    state?: string | null;
    district?: string | null;
    post_offices: Array<{
      name: string;
      state: string;
      district: string;
      office_type?: string | null;
      delivery_status?: string | null;
    }>;
  };
  dataset: {
    retrieved_at: string;
    source_published_on?: string | null;
    source_filename?: string | null;
    sha256?: string | null;
  };
};
export type IndiaGeographyEntry = Resource<{
  kind: "COUNTRY" | "STATE_UT" | "DISTRICT" | "CITY";
  code: string;
  name: string;
  normalized_name: string;
  parent_code?: string | null;
  state_code?: string | null;
  district_code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  active: boolean;
}>;
export type IndiaGeographyLookup = {
  data: IndiaGeographyEntry[];
  dataset: {
    kind: string;
    import_id: string;
    retrieved_at: string;
    source_filename?: string | null;
    sha256?: string | null;
  };
};
export type ReferenceDataImport = Resource<{
  dataset_kind: "INDIA_GEOGRAPHY" | "INDIA_PINCODES";
  status: "STAGED" | "ACTIVE" | "FAILED";
  source_url?: string | null;
  source_filename?: string | null;
  source_published_on?: string | null;
  retrieved_at?: string | null;
  activated_at?: string | null;
  supersedes_id?: string | null;
  sha256?: string | null;
  license_reference?: string | null;
  counts: Record<string, unknown>;
  review_id?: string | null;
  review_status?: string | null;
  review_submitted_by_user_id?: string | null;
}>;
export type ConfigurationAudit = {
  data?: Array<Resource<{
    source: "AUDIT" | "EVENT";
    label: string;
    resource_kind: string;
    resource_id: string;
    actor_user_id?: string | null;
    occurred_at?: string | null;
    metadata?: Record<string, unknown>;
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
    payload?: Record<string, unknown>;
  }>>;
  page?: PageMetadata;
  audit: Array<{
    id: string;
    action: string;
    resource_kind: string;
    resource_id: string;
    actor_user_id?: string | null;
    occurred_at?: string | null;
    metadata?: Record<string, unknown>;
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  }>;
  events: Array<{
    id: string;
    event_type: string;
    aggregate_type: string;
    aggregate_id: string;
    occurred_at?: string | null;
    payload?: Record<string, unknown>;
  }>;
};
export type ConfigurationImpact = {
  data: {
    id: string;
    type: "configuration-impacts";
    attributes: {
      kind: string;
      total_dependents: number;
      active_dependents: number;
      provider_adoptions: number;
      can_archive: boolean;
      warnings: string[];
    };
  };
};
export type ConfigurationReview = Resource<{
  configuration_type: string;
  configuration_id: string;
  provider_id?: string | null;
  business_operation_type_id?: string | null;
  candidate_version: number;
  candidate_revision: number;
  candidate_digest: string;
  status: string;
  submitted_by_user_id: string;
  reviewer_user_id?: string | null;
  submitted_at: string;
  reviewed_at?: string | null;
  reason?: string | null;
}>;
export type ConfigurationReviewPage = {
  data: ConfigurationReview[];
  page?: PageMetadata;
};
export type PlatformOverview = {
  data: { provider_counts: Record<string, number>; total_providers: number };
};
export type PlatformPlanVersion = {
  version_number: number;
  status: string;
  revision: number;
  price_amount: string;
  currency_code: string;
  billing_interval: string;
  tax_treatment: string;
  tax_pricing_mode?: "EXCLUSIVE" | "INCLUSIVE";
  tax_classification_id?: string | null;
  tax_classification?: { id: string; code: string; description: string } | null;
  industry_keys: string[];
  business_operation_type_ids: string[];
  limits: Array<{
    metric_key: string;
    value: number | null;
    unlimited: boolean;
  }>;
  included_features: string[];
  feature_catalogue?: Array<{ code: string; label: string; description: string; depends_on: string[] }>;
  available_features?: Array<{ code: string; label: string; description: string; depends_on: string[] }>;
  published_at?: string | null;
  retired_at?: string | null;
};
export type ElevatorBusinessConfiguration = {
  scope: string;
  service_models: string[];
  equipment_types: string[];
  services: string[];
  checklists: string[];
  industries: string[];
  standards: string[];
};
export type RequirementCatalogueOption = {
  code: string;
  label: string;
  metadata?: Record<string, unknown>;
};
export type RequirementCatalogueGroup = {
  code: string;
  label: string;
  value_type: "OPTION" | "MULTI_OPTION";
  options: RequirementCatalogueOption[];
};
export type RequirementCatalogue = {
  operation_code: string;
  version: number;
  groups: RequirementCatalogueGroup[];
  completion?: {
    required_fields: string[];
    required_multi_fields: string[];
    drafts_may_be_partial: boolean;
    required_before: string[];
  };
};
export type BusinessOperation = {
  id: string;
  type: "business-operation-types";
  attributes: {
    code: string;
    name: string;
    description?: string | null;
    industry_key?: string | null;
    icon_key?: string | null;
    is_active?: boolean;
    is_selectable?: boolean;
    display_order?: number;
    revision?: number;
    lifecycle_status?: string;
    published_at?: string | null;
    configuration?: ElevatorBusinessConfiguration | null;
    availability?: {
      enabled: boolean;
      scope: "PLATFORM_WIDE";
      restore_available: boolean;
      snapshot_id?: string | null;
      disabled_at?: string | null;
    };
    draft?: {
      id: string;
      revision: number;
      status: string;
      payload: {
        code: string;
        name: string;
        description?: string | null;
        industry_key?: string | null;
        icon_key?: string | null;
        display_order?: number;
        is_active?: boolean;
        is_selectable?: boolean;
        configuration?: ElevatorBusinessConfiguration | null;
      };
      review_id?: string | null;
      review_status?: string | null;
      review_submitted_by_user_id?: string | null;
    } | null;
  };
};
export type BusinessOperationReview = Resource<{
  configuration_type: string;
  configuration_id: string;
  candidate_version: number;
  candidate_revision: number;
  candidate_digest: string;
  status: string;
  reason?: string | null;
  submitted_by_user_id: string;
  reviewer_user_id?: string | null;
  submitted_at?: string | null;
  reviewed_at?: string | null;
}>;
export type ProviderConfigurationOverrideAttributes = {
  provider_id: string;
  provider_name: string;
  provider_revision: number;
  active?: {
    revision: number;
    configuration: Record<string, unknown>;
    published_at?: string;
  } | null;
  draft?: {
    revision: number;
    configuration: Record<string, unknown>;
    saved_at?: string;
  } | null;
  configuration?: Record<string, unknown> | null;
  review_id?: string | null;
  review_status?: string | null;
};
export type ProviderConfigurationOverrideResponse = {
  data: Resource<ProviderConfigurationOverrideAttributes>;
};
export type ProviderSetupAttributes = {
  provider_id: string;
  provider_name: string;
  provider_revision: number;
  setup: {
    state: string;
    revision?: number;
    profile_code?: string;
    profile_label?: string;
    groups?: string[];
    readiness?: { ready: boolean; status: string; score: number; blockers: Array<{ code: string; label: string }> };
    review_id?: string | null;
    review_status?: string | null;
    profiles?: Array<{ code: string; label: string; groups: string[] }>;
    tasks?: Array<{ code: string; kind: string; label: string; required: boolean; status: string; provider_count?: number | null; platform_count?: number | null }>;
  };
};
export type ProviderSetupResponse = { data: Resource<ProviderSetupAttributes>; result?: ProviderSetupAttributes['setup'] };
export type ProviderOperation = Resource<{
  status: string;
  is_primary: boolean;
  revision: number;
  business_operation: {
    id: string;
    code: string;
    name: string;
    description?: string | null;
    icon_key?: string | null;
  };
}>;
export type PlatformProviderTaxRegistration = {
  id: string;
  type: string;
  attributes: {
    gstin?: string | null;
    registration_category: string;
    state_or_union_territory: string;
    effective_from: string;
    effective_to?: string | null;
    verification_status: string;
    is_default: boolean;
    revision: number;
  };
};
export type PlatformProviderLegalEntity = {
  id: string;
  type: string;
  attributes: {
    legal_name: string;
    entity_type: string;
    registered_address: Record<string, string>;
    billing_address: Record<string, string>;
    pan_number?: string | null;
    status: string;
    revision: number;
    registrations: PlatformProviderTaxRegistration[];
  };
};
export type PlatformProviderTaxProfile = {
  provider_id: string;
  legal_entities: PlatformProviderLegalEntity[];
};
export type ProviderOperationsResponse = {
  data: ProviderOperation[];
  revision: number;
};
export type PlatformMaintenance = Resource<{
  status: "SCHEDULED" | "ACTIVE" | "ENDED";
  mode: "FULL_PLATFORM" | "NEW_ACTIVITY_INTAKE" | "PLATFORM_ADMINISTRATION";
  label: string;
  blocked_scopes: string[];
  reason: string;
  starts_at?: string | null;
  scheduled_end_at?: string | null;
  ended_at?: string | null;
  activated_by_user_id: string;
  deactivated_by_user_id?: string | null;
  revision: number;
  pre_maintenance_snapshot: Record<string, unknown>;
  notification_summary: Record<string, unknown>;
}>;
export type PublicPlatformMaintenance = {
  maintenance_id: string;
  status: "ACTIVE";
  mode: "FULL_PLATFORM" | "NEW_ACTIVITY_INTAKE" | "PLATFORM_ADMINISTRATION";
  label: string;
  reason: string;
  starts_at?: string | null;
  scheduled_end_at?: string | null;
  message: string;
  retry_guidance: string;
};
export type PlatformAvailabilityOperation = {
  code: string;
  name: string;
  scope: string;
  status: "AVAILABLE" | "MAINTENANCE";
  available: boolean;
  message: string;
};
export type PlatformAvailability = {
  status: "AVAILABLE" | "MAINTENANCE";
  maintenance_active: boolean;
  maintenance: PublicPlatformMaintenance | null;
  checked_at: string;
  timezone: string;
  operations: PlatformAvailabilityOperation[];
};
export type BusinessLegalProfile = {
  id: string;
  status: string;
  legal_name: string;
  business_constitution_code: string;
  incorporation_or_commencement_date?: string | null;
  registered_address_location_id?: string | null;
  country_code: string;
  revision: number;
  current_approved_version_id?: string | null;
};
export type BusinessTaxRegistration = {
  id: string;
  type: string;
  attributes: {
    business_id: string;
    canonical_registration_id?: string;
    gstin?: string | null;
    registration_category: string;
    state_or_union_territory: string;
    effective_from: string;
    effective_to?: string | null;
    verification_status: string;
    relationship_status?: string | null;
    is_default: boolean;
    revision: number;
    ownership_request_status?: string | null;
    ownership_request_id?: string | null;
    ownership_request_revision?: number | null;
  };
};
export type BusinessComplianceSummary = {
  records: Array<{
    id: string;
    requirement_code: string;
    status: string;
    revision: number;
    current_version_number?: number | null;
  }>;
  change_requests: Array<{
    id: string;
    requirement_code: string;
    request_type: string;
    status: string;
    reason: string;
    proposed_values: Record<string, unknown>;
    base_version_number?: number | null;
    revision: number;
    submitted_by_user_id?: string | null;
    reviewer_user_id?: string | null;
    applied_version_id?: string | null;
    submitted_at?: string | null;
    decided_at?: string | null;
    evidence_document_ids: string[];
  }>;
  version_history: Array<{
    id: string;
    requirement_code: string;
    version_number: number;
    values: Record<string, unknown>;
    approved_by_user_id?: string | null;
    approved_at?: string | null;
    source_change_request_id?: string | null;
    evidence_document_ids: string[];
  }>;
  audit: Array<{
    id: string;
    action: string;
    actor_user_id?: string | null;
    occurred_at?: string | null;
    resource_kind: string;
    resource_id: string;
    request_id?: string | null;
  }>;
};
export type BusinessDocument = {
  id: string;
  type: string;
  attributes: {
    filename: string;
    media_type: string;
    size_bytes: number;
    classification: string;
    status: string;
    scan_state: string;
    scan_reason?: string | null;
    current_version_id?: string | null;
    current_version?: number | null;
    revision: number;
    business_id: string;
  };
};
export type BusinessSummary = {
  name: string;
  provider_count: number;
  status: "ACTIVE" | "ON_HOLD" | "SUSPENDED" | "BLOCKED" | "CLOSED";
  operational_status?:
    | "ACTIVE"
    | "PENDING_PROVIDER_ACTIVATION"
    | "PROVIDER_ACCESS_RESTRICTED"
    | "ON_HOLD"
    | "SUSPENDED"
    | "BLOCKED"
    | "CLOSED";
  operational_status_reason?: string | null;
  business_status?: "ACTIVE" | "ON_HOLD" | "SUSPENDED" | "BLOCKED" | "CLOSED";
  restriction_type?:
    | "TEMPORARY_MAINTENANCE"
    | "POLICY_REVIEW"
    | "SECURITY"
    | "COMPLIANCE"
    | "ADMINISTRATIVE"
    | null;
  restriction_ends_at?: string | null;
  revision: number;
  legal_profile?: BusinessLegalProfile | null;
  tax_registrations?: BusinessTaxRegistration[];
  compliance?: BusinessComplianceSummary;
};
export type PlatformBusinessDetails = Resource<BusinessSummary>;
export type PlatformPlan = {
  code: string;
  name: string;
  status: string;
  revision: number;
  onboarding_default?: boolean;
  latest_version?: Resource<PlatformPlanVersion>;
  versions?: Resource<PlatformPlanVersion>[];
  audit_history?: Array<{
    action: string;
    occurred_at: string;
    actor_user_id?: string | null;
  }>;
};
export type SubscriptionProviderSummary = {
  id: string;
  display_name: string;
  provider_code?: string | null;
  business_name?: string | null;
  status: string;
};
export type SubscriptionValidity = {
  state: string;
  starts_at: string;
  ends_at: string;
  total_seconds: number;
  remaining_seconds: number;
  remaining_days: number;
  remaining_weeks: number;
  next_reminder?: { kind: string; due_at: string } | null;
  reminders: Array<{ kind: string; due_at: string; state: string }>;
};
export type PlatformSubscription = {
  provider_id: string;
  provider: SubscriptionProviderSummary;
  plan_version_id: string;
  plan?: {
    id: string;
    code?: string | null;
    name?: string | null;
    version?: number | null;
  };
  request_id?: string | null;
  assignment_source?: string;
  status: string;
  approval_state: string;
  payment_state: string;
  effective_from: string;
  effective_to?: string | null;
  revision: number;
  commercial_snapshot: {
    price_amount?: string;
    currency_code?: string;
    billing_interval?: string;
    limits?: Array<{
      metric_key: string;
      value: number | null;
      unlimited: boolean;
    }>;
  };
  validity?: SubscriptionValidity;
  usage?: PlatformUsage;
};
export type SubscriptionBillingProfile = {
  provider_subscription_id: string;
  legal_name: string;
  billing_address: Record<string, unknown>;
  country_code: string;
  state_or_union_territory?: string | null;
  registration_status: string;
  gstin?: string | null;
  gst_registration_id?: string | null;
  recipient_email?: string | null;
  recipient_phone?: string | null;
  place_of_supply_facts: Record<string, unknown>;
  revision: number;
};
export type SubscriptionRecipientTaxRegistration = {
  id: string;
  type: string;
  attributes: {
    gstin?: string | null;
    registration_category: string;
    state_or_union_territory: string;
    effective_from: string;
    effective_to?: string | null;
    verification_status: string;
  };
};
export type PlatformSubscriptionEvidence = {
  evidence_kind: string;
  external_reference?: string;
  review_state: string;
  stated_amount?: string;
  currency_code?: string;
  document_id?: string;
  document_version_id?: string;
  note?: string;
  created_at?: string;
  reviews?: SubscriptionEvidenceReviewFeedback[];
};
export type PlatformSubscriptionRequest = {
  provider_id: string;
  provider: SubscriptionProviderSummary;
  plan_version_id: string;
  status: string;
  requested_effective_from: string;
  note?: string;
  requested_by_user_id: string;
  revision: number;
  evidence?: Array<Resource<PlatformSubscriptionEvidence>>;
  decisions?: Array<{ decision: string; reason?: string; decided_at: string }>;
};
export type PlatformUsage = {
  provider_id: string;
  subscription_id?: string;
  observed_at: string;
  calculation_policy_version: string;
  metrics: Record<
    string,
    {
      value: number;
      components: Record<string, number>;
      limit?: { value: number | null; unlimited: boolean };
      remaining?: number;
      exceeded: boolean;
    }
  >;
};
export type PlatformSubscriptionChange = {
  provider_id: string;
  provider: SubscriptionProviderSummary;
  subscription_id: string;
  from_plan_version_id: string;
  to_plan_version_id?: string | null;
  change_kind: string;
  status: string;
  requested_effective_at: string;
  effective_at?: string | null;
  reason?: string | null;
  revision: number;
  evidence?: Array<Resource<PlatformSubscriptionEvidence>>;
};
export type PlatformSubscriptionAddon = {
  code: string;
  name: string;
  status: string;
  revision: number;
  versions: Array<{
    id: string;
    version_number: number;
    status: string;
    price_amount: string;
    currency_code: string;
    metric_key: string;
    quantity_per_unit: number;
    revision: number;
  }>;
};
export type PlatformTaxRate = {
  jurisdiction_code: string;
  tax_code: string;
  rate_percent: string;
  status: string;
  effective_from: string;
  effective_to?: string | null;
  revision: number;
};
export type PlatformTaxDashboard = {
  draft_rules: number;
  published_rules: number;
  scheduled_rules: number;
  pending_reviews: number;
  approved_rules: number;
  effective_rules: number;
  unverified_sources: number;
  superseded_rules: number;
  catalogue_revision: number;
};
export type PlatformTaxImportBatch = Resource<{
  batch_reference: string;
  status: string;
  row_count: number;
  created_count: number;
  errors: Array<Record<string, unknown>>;
  created_at?: string;
}>;
export type PlatformTaxRateTemplate = Resource<{
  template_code: string;
  name: string;
  category: string;
  total_rate_percent: string;
  components: Array<{ code: string; rate_percent: string }>;
  reference_status: string;
  description: string;
  revision: number;
}>;
export type PlatformTaxComponent = {
  id: string;
  code: string;
  name: string;
  status: string;
};
export type PlatformTaxJurisdiction = {
  id: string;
  country_code: string;
  jurisdiction_code: string;
  name: string;
  state_or_union_territory?: string | null;
};
export type PlatformTaxClassification = Resource<{
  classification_code: string;
  classification_type: string;
  description?: string | null;
  status: string;
}>;
export type PlatformTaxLegalSource = Resource<{
  authority: string;
  notification_number: string;
  notification_date?: string | null;
  effective_date?: string | null;
  source_url?: string | null;
  verification_status: string;
  metadata?: Record<string, unknown>;
  linked_rule_count?: number;
}>;
export type PlatformTaxProfile = {
  id: string;
  attributes: {
    legal_name: string;
    registered_address: Record<string, string>;
    billing_address: Record<string, string>;
    status: string;
    revision: number;
    registrations: PlatformProviderTaxRegistration[];
  };
};
export type PlatformSaasTaxConfiguration = Resource<{
  product_code: string;
  classification: { id: string; code: string };
  legal_source_id: string;
  effective_from: string;
  effective_to?: string | null;
  status: string;
  description: string;
  change_reason?: string | null;
  revision: number;
}>;
export type PlatformBillingSetup = {
  issuer_profile_status: "not_started" | "draft" | "complete";
  gst_registration_status: "not_started" | "draft" | "complete";
  saas_configuration_status: string;
  active_registration_count: number;
  default_registration_id?: string | null;
  readiness: "not_ready" | "partial" | "ready";
  blockers: string[];
  profile: PlatformTaxProfile | null;
  configurations: PlatformSaasTaxConfiguration[];
};
export type PlatformTaxRule = Resource<{
  rule_code: string;
  description?: string | null;
  template_code?: string | null;
  version_number: number;
  status: string;
  tax_treatment: string;
  classification?: { id: string; code: string; type: string } | null;
  jurisdiction?: PlatformTaxJurisdiction | null;
  legal_source?: PlatformTaxLegalSource["attributes"] | null;
  supply_type?: string | null;
  place_of_supply_code?: string | null;
  priority: number;
  total_rate_percent: string;
  effective_from: string;
  effective_to?: string | null;
  change_reason?: string | null;
  conditions?: Record<string, unknown>;
  revision: number;
  components: Array<{ code: string; name: string; rate_percent: string }>;
  published_at?: string | null;
  audit_history?: Array<{
    action: string;
    occurred_at: string;
    actor_user_id?: string | null;
  }>;
}>;
export type PlatformSubscriptionInvoice = {
  provider_id: string;
  provider: SubscriptionProviderSummary;
  provider_subscription_id: string;
  invoice_number: string;
  status: string;
  collection_state: string;
  currency_code: string;
  subtotal_amount: string;
  tax_amount: string;
  total_amount: string;
  issued_at: string;
  due_at: string;
  grace_ends_at: string;
  paid_at?: string | null;
  revision: number;
  recipient_contact?: {
    recipient_email?: string | null;
    recipient_phone?: string | null;
  } | null;
  lines?: Array<Record<string, unknown>>;
  tax?: Record<string, unknown>;
  evidence?: Array<Resource<PlatformSubscriptionEvidence>>;
};
export type SubscriptionHistoryKind = "requests" | "changes" | "invoices";
export type ProviderSubscriptionSelfService = {
  history_page?: Record<SubscriptionHistoryKind, PageMetadata> | null;
  provider_id: string;
  subscription?: {
    id: string;
    plan_version_id: string;
    status: string;
    approval_state: string;
    payment_state: string;
    assignment_source?: string;
    effective_from: string;
    effective_to?: string | null;
    revision: number;
    commercial_snapshot: Record<string, unknown>;
    validity?: SubscriptionValidity;
  } | null;
  usage: PlatformUsage;
  requests: Array<{
    id: string;
    plan_version_id: string;
    status: string;
    requested_effective_from: string;
    revision: number;
    evidence_statuses: string[];
    evidence?: SubscriptionEvidenceFeedback[];
  }>;
  changes: Array<{
    id: string;
    subscription_id: string;
    change_kind: string;
    status: string;
    to_plan_version_id?: string | null;
    requested_effective_at: string;
    revision: number;
    evidence_statuses: string[];
    evidence?: SubscriptionEvidenceFeedback[];
  }>;
  invoices: Array<{
    id: string;
    invoice_number: string;
    status: string;
    collection_state: string;
    currency_code: string;
    subtotal_amount: string;
    tax_amount: string;
    total_amount: string;
    due_at: string;
    grace_ends_at: string;
    evidence_statuses: string[];
    evidence?: SubscriptionEvidenceFeedback[];
  }>;
};
export type ProviderLifecycleTransition = Resource<{
  action: string;
  from_status: string;
  to_status: string;
  reason_code: string;
  reason?: string | null;
  effective_at: string;
  lifecycle_revision: number;
  actor_user_id: string;
  created_at: string;
}>;
export type ProviderLifecycleTransitionResponse = {
  data: ProviderLifecycleTransition;
  provider: Resource<PlatformProviderAttributes>;
};
export type ProviderLifecycleApproval = Resource<{
  provider_id: string;
  action: string;
  status: string;
  reason_code: string;
  reason: string;
  expected_revision: number;
  requested_by_user_id: string;
  reviewed_by_user_id?: string | null;
  submitted_at: string;
  reviewed_at?: string | null;
  review_reason?: string | null;
}>;
export type AllowedTransition = {
  key?: string;
  transition?: string;
  label?: string;
  reason?: string;
};
export type RequestAttributes = {
  summary: string;
  description?: string;
  status: string;
  revision: number;
  created_at: string;
  request_type_id?: string;
  allowed_transitions?: AllowedTransition[];
};
export type BookingAttributes = {
  summary: string;
  status: string;
  revision: number;
  requested_window: { starts_at: string; ends_at: string; time_zone: string };
  allowed_transitions?: AllowedTransition[];
};
export type CapacityPoolAttributes = {
  name: string;
  capacity_units: number;
  status: string;
  revision?: number;
};
export type JobAttributes = {
  summary?: string;
  status: string;
  revision: number;
  scheduled_at?: string;
  scheduled_window?: {
    starts_at: string;
    ends_at: string;
    time_zone: string;
  } | null;
  allowed_transitions?: AllowedTransition[];
};
export type AgentAttributes = {
  display_name?: string;
  status?: string;
  revision?: number;
};
export type JobActionAttributes = {
  visit_id: string;
  effective_at: string;
  expected_revision: number;
  report_ids?: string[];
  proof_ids?: string[];
};
export type AssignmentAttributes = {
  status: string;
  revision?: number;
  scheduled_start_at?: string;
  scheduled_end_at?: string;
  job_summary?: string;
  job_status?: string;
  distance_m?: number;
  location_available?: boolean;
  job_location_accuracy_m?: number | null;
  search_accuracy_m?: number | null;
};
export type VisitAttributes = {
  status: string;
  arrived_at?: string;
  started_at?: string;
  ended_at?: string;
};
export type WorkNoteAttributes = {
  text: string;
  visibility: string;
  recorded_at: string;
};
export type ContactRoutingAttributes = {
  purpose: string;
  outcome: string;
  reason?: string;
  candidates?: Array<Record<string, unknown>>;
  selected_contact?: Record<string, unknown> | null;
  selection_does_not_confirm_appointment: boolean;
  service_location_id?: string;
  policy_code?: string;
};
export type PartUsageAttributes = {
  description: string;
  quantity: string;
  unit: string;
  usage_kind: string;
  source: "PROVIDER" | "CUSTOMER" | "EXTERNAL" | string;
  part_definition_id?: string | null;
  recorded_at: string;
};
export type PartDefinitionAttributes = {
  code: string;
  name: string;
  description?: string | null;
  serial_lot_policy: string;
  status: string;
  scope: "provider" | "platform" | string;
};
export type GenericAttributes = Record<string, unknown>;
export type ChecklistAttributes = {
  status: string;
  template_code?: string;
  template_name?: string;
  revision?: number;
  answers?: Array<{ key?: string; item_key?: string; value: unknown; required?: boolean }>;
  items?: Array<Record<string, unknown>>;
};
export type ServiceReportAttributes = {
  status: string;
  summary: string;
  work_performed: string;
  submitted_at?: string | null;
};
export type ServiceProofAttributes = {
  proof_kind: string;
  status: string;
  captured_at: string;
  document_version_id?: string;
};
export type WorkSessionInterval = {
  id: string;
  status: string;
  started_at: string;
  ended_at?: string | null;
  duration_seconds: number;
};
export type WorkSessionAttributes = {
  status: string;
  started_at?: string;
  ended_at?: string | null;
  revision?: number;
  intervals?: WorkSessionInterval[];
};
export type NotificationAttributes = {
  category: string;
  title: string;
  body: string;
  read_at?: string | null;
  created_at?: string | null;
};
export type ServiceStageSummary = {
  id: string;
  code: string;
  title: string;
  status: string;
  mandatory: boolean;
  revision: number;
  asset_id?: string | null;
  planned_start_at?: string | null;
  planned_end_at?: string | null;
  actual_start_at?: string | null;
  actual_end_at?: string | null;
};
export type ServiceCaseAttributes = {
  title: string;
  status: string;
  revision: number;
  customer?: {
    id: string;
    display_name: string;
    relationship_status?: string | null;
  } | null;
  workflow_stage?: string;
  journey_stage_status?: "ACTIVE" | "COMPLETED";
  journey_status?: "ACTIVE" | "COMPLETED" | "CANCELLED";
  journey_status_label?: string;
  journey_abandoned_at?: string | null;
  journey_abandonment_reason?: string | null;
  project_classification_key?: string | null;
  customer_relationship_id?: string | null;
  service_location_id?: string | null;
  service_location_name?: string | null;
  service_location_source?: "PROJECT" | "ASSET" | null;
  asset_ids?: string[];
  project_assets?: Array<{
    id: string;
    display_name?: string | null;
    role: string;
    status: string;
  }>;
  stage_count?: number;
  completed_stage_count?: number;
  progress_percent?: number;
  payment_schedule_total?: string;
  approved_commercial_delta?: string;
  adjusted_project_total?: string | null;
  project_currency_code?: string | null;
  approved_schedule_delta_days?: number;
  approved_change_order_count?: number;
  active_blocker_count?: number;
  critical_blocker_count?: number;
  project_close_ready?: boolean;
  project_close_blockers?: string[];
  next_payment_schedule?: {
    id: string;
    milestone_code: string;
    description: string;
    due_amount: string;
    collected_amount: string;
    outstanding_amount: string;
    due_on?: string | null;
  } | null;
  payment_stage_policy?: {
    purpose?: string;
    enabled?: boolean;
    mode?: string;
    frozen?: boolean;
    source?: string;
    stages?: Array<{
      code: string;
      description: string;
      percentage: string;
      sequence: number;
      trigger_kind: string;
      customer_acceptance_required?: boolean;
    }>;
  };
  unit_progress?: Array<{
    asset_id: string;
    stage_count: number;
    completed_stage_count: number;
    progress_percent: number;
  }>;
  handover_events?: Array<{
    id: string;
    event_kind: string;
    asset_id?: string | null;
    service_case_revision?: number;
    occurred_at?: string | null;
  }>;
  stages?: ServiceStageSummary[];
};
export type ProviderOperationsDashboard = Resource<{
  generated_at: string;
  dashboard_date?: string;
  time_zone?: string;
  counts: {
    leads: number;
    open_requests: number;
    todays_appointments: number;
    leads_by_status: Record<string, number>;
    installation_projects: number;
    installation_projects_by_status: Record<string, number>;
    jobs: number;
    active_jobs: number;
    open_installation_jobs: number;
    customers: number;
    shipments: number;
    amc_renewals_due: number;
    escalations: number;
    shipments_by_status: Record<string, number>;
    open_payment_schedules: number;
    outstanding_amount: string;
    unread_notifications: number;
  };
  event_catalog: Array<{
    event_type: string;
    label: string;
    category: string;
    emitted: boolean;
  }>;
  recent_events: Array<{
    id: string;
    event_type: string;
    aggregate_type: string;
    aggregate_id: string;
    occurred_at?: string | null;
    attempts: number;
    available_at?: string | null;
  }>;
  recent_notifications: Array<{
    id: string;
    category: string;
    title: string;
    body: string;
    read_at?: string | null;
    created_at?: string | null;
  }>;
  recent_audit: Array<{
    id: string;
    action: string;
    resource_kind?: string | null;
    resource_id?: string | null;
    occurred_at?: string | null;
    actor_user_id?: string | null;
  }>;
  appointment_rows: Array<{
    id: string;
    summary: string;
    customer_name?: string | null;
    site_name?: string | null;
    service_type?: string | null;
    technician_name?: string | null;
    status: string;
    requested_start_at?: string | null;
    requested_end_at?: string | null;
  }>;
  payment_stage_rows: Array<{
    id: string;
    service_case_id: string;
    project_title?: string | null;
    milestone_code: string;
    description: string;
    amount: string;
    currency_code: string;
    status: string;
    sequence: number;
    percentage?: string | null;
    due_on?: string | null;
  }>;
  amc_renewal_rows: Array<{
    id: string;
    contract_number: string;
    customer_name: string;
    property_name: string;
    status: string;
    ends_at?: string | null;
    days_left?: number | null;
    plan_code?: string | null;
  }>;
  technician_availability: {
    available: number;
    on_site: number;
    on_leave: number;
    unavailable: number;
    total: number;
  };
  escalation_rows: Array<{
    id: string;
    level: number;
    status: string;
    triggered_at?: string | null;
    reason?: string | null;
  }>;
  urgent_complaint_rows: Array<{
    id: string;
    source: string;
    level: number | null;
    severity: string;
    status: string;
    request_id: string;
    summary: string;
    customer_name: string;
    site_name: string;
    triggered_at?: string | null;
    reason?: string | null;
  }>;
}>;
export type MaterialRequirementAttributes = {
  material_code: string;
  description: string;
  required_quantity: string;
  unit_code: string;
  status: string;
  dispatched_quantity: string;
  accepted_quantity: string;
  rejected_quantity: string;
  remaining_quantity: string;
  revision: number;
  source_kind?: "PROJECT_ADDED" | "QUOTATION_SNAPSHOT" | string;
  source_quotation_id?: string | null;
  source_quotation_number?: string | null;
  source_quotation_revision?: number | null;
  source_line_number?: number | null;
  category?: string | null;
  customer_visibility?: string | null;
  notes?: string | null;
};
export type MaterialScopeTemplateLine = {
  description: string;
  category: string;
  quantity: string;
  unit_code: string;
  customer_visibility: "INCLUDED" | "EXCLUDED";
  default_unit_price: string;
  warranty_months?: number | string | null;
  specifications?: Array<{ name: string; value: string }>;
  notes?: string | null;
};
export type QuotationTermsTemplateAttributes = {
  name: string;
  description?: string | null;
  status: "ACTIVE" | "ARCHIVED" | string;
  scope: "PLATFORM_MASTER" | "PROVIDER" | string;
  revision: number;
  terms: Record<string, unknown>;
  created_at?: string | null;
  updated_at?: string | null;
};
export type MaterialScopeTemplateAttributes = {
  name: string;
  description?: string | null;
  status: "ACTIVE" | "ARCHIVED" | string;
  scope: "PLATFORM_MASTER" | "PROVIDER" | string;
  currency: string;
  revision: number;
  lines: MaterialScopeTemplateLine[];
  created_at?: string | null;
  updated_at?: string | null;
};
export type QuotationTaxRuleAttributes = {
  rule_code: string;
  description?: string | null;
  version_number: number;
  status: string;
  tax_treatment: string;
  supply_type?: string | null;
  place_of_supply_code?: string | null;
  priority: number;
  total_rate_percent: string;
  effective_from: string;
  effective_to?: string | null;
  classification?: { code: string; type: string; description?: string | null } | null;
  jurisdiction?: { code: string; name: string; state_or_union_territory?: string | null } | null;
  components: Array<{ code: string; name: string; rate_percent: string }>;
};
export type QuotationTaxRule = Resource<QuotationTaxRuleAttributes>;
export type ShipmentLine = {
  id: string;
  material_requirement_id: string;
  material_code: string;
  description?: string;
  dispatched_quantity: string;
  accepted_quantity: string;
  rejected_quantity: string;
  rejection_reason?: string | null;
};
export type ShipmentAttributes = {
  shipment_number: string;
  status: string;
  dispatched_at?: string | null;
  delivered_at?: string | null;
  delivery_notes?: string | null;
  revision: number;
  lines: ShipmentLine[];
};
export type PaymentScheduleAttributes = {
  milestone_code: string;
  description: string;
  due_amount: string;
  currency_code: string;
  due_on?: string | null;
  status: string;
  collected_amount: string;
  outstanding_amount: string;
  revision: number;
  sequence?: number;
  percentage?: string | null;
  trigger_kind?: string;
  material_release_condition?: string | null;
  customer_acceptance_required?: boolean;
  payment_basis_amount?: string | null;
  payment_basis_currency_code?: string | null;
};
export type PaymentAttributes = {
  payment_reference: string;
  method: string;
  status: string;
  amount: string;
  currency_code: string;
  instrument_reference?: string | null;
  received_at: string;
  settled_at?: string | null;
  revision: number;
  payment_schedule_id: string;
  allocations?: Array<{
    payment_schedule_id: string;
    amount: string;
    allocation_kind: string;
    note?: string | null;
  }>;
};
export type StageReleaseAttributes = {
  service_case_id: string;
  payment_schedule_id: string;
  accepted_quotation_revision: number;
  settlement_evidence: {
    payment_ids: string[];
    settled_amount: string;
    currency_code: string;
  };
  release_rule_version: string;
  release_basis?: "SETTLED_PAYMENT" | "APPROVED_CREDIT";
  approved_credit_amount?: string | null;
  credit_due_on?: string | null;
  credit_reference?: string | null;
  decision: string;
  reason: string;
  reviewed_by_user_id?: string | null;
  revision: number;
  decided_at?: string | null;
};
export type ServiceCaseBlockerAttributes = {
  service_case_id: string;
  service_stage_id?: string | null;
  asset_id?: string | null;
  payment_schedule_id?: string | null;
  checklist_execution_id?: string | null;
  assigned_to_user_id?: string | null;
  category: string;
  severity: string;
  status: string;
  blocking: boolean;
  title: string;
  description: string;
  stakeholder_type: string;
  stakeholder_name?: string | null;
  stakeholder_reference?: string | null;
  due_on?: string | null;
  expected_resolution_on?: string | null;
  impact_days: number;
  resolution_note?: string | null;
  resolved_at?: string | null;
  last_notification_requested_at?: string | null;
  notification_request_count: number;
  revision: number;
};
export type QualityFindingAttributes = {
  finding_number: string;
  status: string;
  severity: string;
  title: string;
  description: string;
  corrective_action: string;
  evidence_ids: string[];
  reported_by_user_id: string;
  assigned_to_user_id?: string | null;
  asset_id?: string | null;
  service_job_id?: string | null;
  service_stage_id?: string | null;
  detected_at: string;
  rectified_at?: string | null;
  reinspection_at?: string | null;
  resolved_at?: string | null;
  resolution_notes?: string | null;
  revision: number;
};
export type ProviderWorkFollowUpAttributes = {
  created_at?: string | null;
  journey_id: string;
  target_resource_kind?: string | null;
  target_resource_id?: string | null;
  previous_follow_up_id?: string | null;
  next_follow_up_id?: string | null;
  stage: string;
  subject: string;
  purpose: string;
  scheduled_at: string;
  reminder_at: string;
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED";
  display_status: "SCHEDULED" | "DUE" | "COMPLETED" | "CANCELLED";
  assigned_to_user_id?: string | null;
  assigned_to?: {
    id: string;
    name?: string | null;
    email?: string | null;
  } | null;
  contact_name?: string | null;
  contact_reference?: string | null;
  notes?: string | null;
  response?: string | null;
  outcome?: string | null;
  completed_at?: string | null;
  completed_by_user_id?: string | null;
  cancelled_at?: string | null;
  cancelled_by_user_id?: string | null;
  created_by_user_id: string;
  created_by?: {
    id: string;
    name?: string | null;
    email?: string | null;
  } | null;
  revision: number;
  timezone_name?: string;
};

export const PLATFORM_PAGE_SIZE = 15;
export type PlatformPageParams = {
  after?: string | null;
  before?: string | null;
  providerId?: string;
  q?: string;
  status?: string;
};
const platformPageQuery = (params: PlatformPageParams = {}) => {
  const query = new URLSearchParams({
    "page[limit]": String(PLATFORM_PAGE_SIZE),
  });
  if (params.after) query.set("page[after]", params.after);
  if (params.before) query.set("page[before]", params.before);
  if (params.providerId) query.set("providerId", params.providerId);
  return query.toString();
};

const query = (path: string, providerId: string) =>
  apiClient.request(path, {}, { providerId });
export const operationsData = {
  providerOperationsDashboard: (providerId: string, date?: string) =>
    apiClient
      .request<{ data: ProviderOperationsDashboard }>(
        `/providers/operations/dashboard${date ? `?date=${encodeURIComponent(date)}` : ""}`,
        {},
        { providerId },
      )
      .then((response) => response.data),
  providerBilling: (providerId: string) =>
    apiClient
      .request<{ data: Resource<GenericAttributes> }>(
        "/providers/billing",
        {},
        { providerId },
      )
      .then((response) => response.data),
  providerReports: (providerId: string) =>
    query("/providers/reports", providerId) as Promise<{
      data: Array<Resource<GenericAttributes>>;
      schedules: Array<Resource<GenericAttributes>>;
      exports: Array<Resource<GenericAttributes>>;
    }>,
  createProviderReport: (
    providerId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient
      .request<{ data: Resource<GenericAttributes> }>(
        "/providers/reports",
        {
          method: "POST",
          headers: { "Idempotency-Key": key },
          body: JSON.stringify(body),
        },
        { providerId },
      )
      .then((response) => response.data),
  updateProviderReport: (
    providerId: string,
    id: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient
      .request<{ data: Resource<GenericAttributes> }>(
        `/providers/reports/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: { "Idempotency-Key": key },
          body: JSON.stringify(body),
        },
        { providerId },
      )
      .then((response) => response.data),
  previewProviderReport: (providerId: string, id: string) =>
    apiClient.request<{
      data: Array<Record<string, unknown>>;
      meta: { bounded: boolean; row_count: number; limit: number };
    }>(
      `/providers/reports/${encodeURIComponent(id)}/preview`,
      {},
      { providerId },
    ),
  exportProviderReport: (
    providerId: string,
    id: string,
    format: string,
    filters: Record<string, unknown> = {},
    key: string,
  ) =>
    apiClient
      .request<{ data: Resource<GenericAttributes> }>(
        `/providers/reports/${encodeURIComponent(id)}/exports`,
        {
          method: "POST",
          headers: { "Idempotency-Key": key },
          body: JSON.stringify({ format, filters }),
        },
        { providerId },
      )
      .then((response) => response.data),
  providerReportExports: (providerId: string) =>
    query("/providers/report-exports", providerId) as Promise<{
      data: Array<Resource<GenericAttributes>>;
    }>,
  downloadProviderReportExport: async (
    providerId: string,
    id: string,
  ): Promise<{ blob?: Blob; url?: string }> => {
    const blob = await apiClient.requestBlob(
      `/providers/report-exports/${encodeURIComponent(id)}/download`,
      {},
      { providerId },
    );
    if (!blob.type.includes("application/json")) return { blob };
    const payload = await blob
      .text()
      .then((value) => JSON.parse(value) as { download?: { url?: string } });
    if (!payload.download?.url)
      throw new Error(
        "The authorized download link was not returned by the server.",
      );
    const url = new URL(payload.download.url);
    if (
      url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "::1"].includes(url.hostname)
      )
    ) {
      throw new Error(
        "The report download link must use HTTPS (or local development storage).",
      );
    }
    return { url: payload.download.url };
  },
  createProviderReportSchedule: (
    providerId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient
      .request<{ data: Resource<GenericAttributes> }>(
        "/providers/report-schedules",
        {
          method: "POST",
          headers: { "Idempotency-Key": key },
          body: JSON.stringify(body),
        },
        { providerId },
      )
      .then((response) => response.data),
  updateProviderReportSchedule: (
    providerId: string,
    id: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient
      .request<{ data: Resource<GenericAttributes> }>(
        `/providers/report-schedules/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: { "Idempotency-Key": key },
          body: JSON.stringify(body),
        },
        { providerId },
      )
      .then((response) => response.data),
  runProviderReportSchedule: (providerId: string, id: string, key: string) =>
    apiClient
      .request<{ data: Resource<GenericAttributes> }>(
        `/providers/report-schedules/${encodeURIComponent(id)}/run`,
        {
          method: "POST",
          headers: { "Idempotency-Key": key },
          body: JSON.stringify({}),
        },
        { providerId },
      )
      .then((response) => response.data),
  notifications: (providerId: string) =>
    query(
      "/notifications?page[limit]=25&sort=-created_at,id",
      providerId,
    ) as Promise<Collection<NotificationAttributes>>,
  markNotificationRead: (
    providerId: string,
    notificationId: string,
    key: string,
  ) =>
    apiClient.request<Resource<NotificationAttributes>>(
      `/notifications/${encodeURIComponent(notificationId)}/read`,
      { method: "POST", headers: { "Idempotency-Key": key } },
      { providerId },
    ),
  platformNotifications: () =>
    apiClient.request<Collection<NotificationAttributes>>(
      "/platform/notifications?page[limit]=25&sort=-created_at,id",
    ),
  markPlatformNotificationRead: (notificationId: string, key: string) =>
    apiClient.request<Resource<NotificationAttributes>>(
      `/platform/notifications/${encodeURIComponent(notificationId)}/read`,
      { method: "POST", headers: { "Idempotency-Key": key } },
    ),
  genericCollection: (providerId: string, path: string) =>
    query(path, providerId) as Promise<Collection<GenericAttributes>>,
  genericDetail: (providerId: string, path: string) =>
    query(path, providerId) as Promise<Resource<GenericAttributes>>,
  serviceCases: async (
    providerId: string,
    params: {
      after?: string | null;
      before?: string | null;
      limit?: number;
      query?: string;
      status?: string;
    } = {},
  ): Promise<Collection<ServiceCaseAttributes>> => {
    const page = new URLSearchParams({
      "page[limit]": String(params.limit || 10),
      sort: "-created_at,id",
    });
    if (params.after) page.set("page[after]", params.after);
    if (params.before) page.set("page[before]", params.before);
    if (params.query) page.set("filter[q]", params.query);
    if (params.status) page.set("filter[status]", params.status);
    const payload = (await query(
      `/service-cases?${page}`,
      providerId,
    )) as Collection<ServiceCaseAttributes> & {
      data: Array<
        | Resource<ServiceCaseAttributes>
        | { data: Resource<ServiceCaseAttributes> }
      >;
    };
    const data = payload.data.map((item): Resource<ServiceCaseAttributes> =>
      "data" in item
        ? (item.data as Resource<ServiceCaseAttributes>)
        : (item as Resource<ServiceCaseAttributes>),
    );
    return { ...payload, data };
  },
  serviceCase: (providerId: string, caseId: string) =>
    apiClient
      .request<{ data: Resource<ServiceCaseAttributes> }>(
        `/service-cases/${encodeURIComponent(caseId)}`,
        {},
        { providerId },
      )
      .then((response) => response.data),
  providerWorkIntakes: async (
    providerId: string,
    params: {
      after?: string | null;
      before?: string | null;
      limit?: number;
      q?: string;
      status?: string;
      source?: string;
      work_type?: string;
      relationship_status?: string;
    } = {},
  ): Promise<Collection<WorkIntakeAttributes>> => {
    const page = new URLSearchParams({
      "page[limit]": String(params.limit || 10),
      sort: "-created_at,id",
    });
    if (params.after) page.set("page[after]", params.after);
    if (params.before) page.set("page[before]", params.before);
    for (const key of [
      "q",
      "status",
      "source",
      "work_type",
      "relationship_status",
    ] as const)
      if (params[key]) page.set(`filter[${key}]`, params[key]!);
    return query(`/provider-work-intakes?${page}`, providerId) as Promise<
      Collection<WorkIntakeAttributes>
    >;
  },
  providerWorkIntakeMatches: (
    providerId: string,
    params: {
      title?: string;
      site_summary?: string;
      asset_query?: string;
      service_location_id?: string;
      asset_id?: string;
    },
  ): Promise<{
    data: WorkIntakeMatch[];
    meta: { provider_scoped: boolean; automatic_linking: boolean };
  }> => {
    const queryParams = new URLSearchParams(
      Object.entries(params).filter((entry): entry is [string, string] =>
        Boolean(entry[1]),
      ),
    );
    return query(
      `/provider-work-intakes/matches?${queryParams}`,
      providerId,
    ) as Promise<{
      data: WorkIntakeMatch[];
      meta: { provider_scoped: boolean; automatic_linking: boolean };
    }>;
  },
  providerWorkIntakeAudit: (providerId: string, intakeId: string) =>
    apiClient.request<Collection<ProviderAuditAttributes>>(
      `/audit-events?page[limit]=100&sort=-created_at,id&filter[source_id]=${encodeURIComponent(intakeId)}&filter[resource_kind]=ProviderWorkIntake`,
      {},
      { providerId },
    ),
  providerWorkIntakeJourney: (providerId: string, intakeId: string) =>
    apiClient
      .request<{ data: ProviderWorkJourney }>(
        `/provider-work-intakes/${encodeURIComponent(intakeId)}/journey`,
        {},
        { providerId },
      )
      .then((response) => response.data),
  providerWorkJourneyForResource: (
    providerId: string,
    resourceKind: string,
    resourceId: string,
  ) =>
    apiClient
      .request<{ data: ProviderWorkJourney | null }>(
        `/provider-work-journeys/for-resource?resource_kind=${encodeURIComponent(resourceKind)}&resource_id=${encodeURIComponent(resourceId)}`,
        {},
        { providerId },
      )
      .then((response) => response.data),
  ensureProviderWorkJourneyForResource: (
    providerId: string,
    resourceKind: string,
    resourceId: string,
    key: string,
  ) =>
    apiClient
      .request<{ data: ProviderWorkJourney }>(
        "/provider-work-journeys/ensure-resource",
        {
          method: "POST",
          headers: { "Idempotency-Key": key },
          body: JSON.stringify({
            resource_kind: resourceKind,
            resource_id: resourceId,
          }),
        },
        { providerId },
      )
      .then((response) => response.data),
  journeyActivities: (providerId: string, journeyId: string) =>
    query(
      `/provider-work-journeys/${encodeURIComponent(journeyId)}/activities`,
      providerId,
    ) as Promise<{ data: Resource<GenericAttributes>[] }>,
  createJourneyActivity: (
    providerId: string,
    journeyId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<GenericAttributes>>(
      `/provider-work-journeys/${encodeURIComponent(journeyId)}/activities`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  providerWorkFollowUps: (
    providerId: string,
    params: {
      journeyId?: string;
      status?: string;
      assignedToUserId?: string;
      stage?: string;
      from?: string;
      to?: string;
    } = {},
  ) => {
    const queryParams = new URLSearchParams({
      "page[limit]": "100",
      sort: "scheduled_at,id",
    });
    if (params.journeyId)
      queryParams.set("filter[journey_id]", params.journeyId);
    if (params.status) queryParams.set("filter[status]", params.status);
    if (params.assignedToUserId)
      queryParams.set("filter[assigned_to_user_id]", params.assignedToUserId);
    if (params.stage) queryParams.set("filter[stage]", params.stage);
    if (params.from) queryParams.set("filter[from]", params.from);
    if (params.to) queryParams.set("filter[to]", params.to);
    return apiClient.request<Collection<ProviderWorkFollowUpAttributes>>(
      `/provider-work-follow-ups?${queryParams}`,
      {},
      { providerId },
    );
  },
  providerWorkFollowUp: (providerId: string, id: string) =>
    apiClient.request<Resource<ProviderWorkFollowUpAttributes>>(
      `/provider-work-follow-ups/${encodeURIComponent(id)}`,
      {},
      { providerId },
    ),
  createProviderWorkFollowUp: (
    providerId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient
      .request<{ data: Resource<ProviderWorkFollowUpAttributes> }>(
        "/provider-work-follow-ups",
        {
          method: "POST",
          headers: { "Idempotency-Key": key },
          body: JSON.stringify(body),
        },
        { providerId },
      )
      .then((response) => response.data),
  updateProviderWorkFollowUp: (
    providerId: string,
    id: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient
      .request<{ data: Resource<ProviderWorkFollowUpAttributes> }>(
        `/provider-work-follow-ups/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: { "Idempotency-Key": key },
          body: JSON.stringify(body),
        },
        { providerId },
      )
      .then((response) => response.data),
  completeProviderWorkFollowUp: (
    providerId: string,
    id: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient
      .request<{ data: Resource<ProviderWorkFollowUpAttributes> }>(
        `/provider-work-follow-ups/${encodeURIComponent(id)}/complete`,
        {
          method: "POST",
          headers: { "Idempotency-Key": key },
          body: JSON.stringify(body),
        },
        { providerId },
      )
      .then((response) => response.data),
  cancelProviderWorkFollowUp: (
    providerId: string,
    id: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient
      .request<{ data: Resource<ProviderWorkFollowUpAttributes> }>(
        `/provider-work-follow-ups/${encodeURIComponent(id)}/cancel`,
        {
          method: "POST",
          headers: { "Idempotency-Key": key },
          body: JSON.stringify(body),
        },
        { providerId },
      )
      .then((response) => response.data),
  abandonProviderWorkIntake: (
    providerId: string,
    intakeId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient
      .request<{ data: ProviderWorkJourney }>(
        `/provider-work-intakes/${encodeURIComponent(intakeId)}/abandon`,
        {
          method: "POST",
          headers: { "Idempotency-Key": key },
          body: JSON.stringify(body),
        },
        { providerId },
      )
      .then((response) => response.data),
  abandonProviderWorkJourney: (
    providerId: string,
    journeyId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient
      .request<{ data: ProviderWorkJourney }>(
        `/provider-work-journeys/${encodeURIComponent(journeyId)}/abandon`,
        {
          method: "POST",
          headers: { "Idempotency-Key": key },
          body: JSON.stringify(body),
        },
        { providerId },
      )
      .then((response) => response.data),
  createProviderWorkIntake: (
    providerId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<WorkIntakeAttributes>>(
      "/provider-work-intakes",
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  updateProviderWorkIntake: (
    providerId: string,
    id: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<WorkIntakeAttributes>>(
      `/provider-work-intakes/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  decideProviderWorkIntakeRelationship: (
    providerId: string,
    id: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<WorkIntakeAttributes>>(
      `/provider-work-intakes/${encodeURIComponent(id)}/relationship-decisions`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  advanceProviderWorkIntake: (
    providerId: string,
    id: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<WorkIntakeAttributes>>(
      `/provider-work-intakes/${encodeURIComponent(id)}/advance`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  updateProviderWorkIntakeAssessment: (
    providerId: string,
    id: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<WorkIntakeAttributes>>(
      `/provider-work-intakes/${encodeURIComponent(id)}/assessment`,
      {
        method: "PATCH",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  assignProviderWorkIntake: (
    providerId: string,
    id: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<WorkIntakeAttributes>>(
      `/provider-work-intakes/${encodeURIComponent(id)}/assignment`,
      {
        method: "PATCH",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  takeOverProviderWorkIntake: (
    providerId: string,
    id: string,
    expectedRevision: number,
    key: string,
  ) =>
    apiClient.request<Resource<WorkIntakeAttributes>>(
      `/provider-work-intakes/${encodeURIComponent(id)}/take-over`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify({ expected_revision: expectedRevision }),
      },
      { providerId },
    ),
  decideProviderWorkIntakeRoute: (
    providerId: string,
    id: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<WorkIntakeAttributes>>(
      `/provider-work-intakes/${encodeURIComponent(id)}/route-decisions`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  updateServiceCase: (
    providerId: string,
    caseId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient
      .request<{ data: Resource<ServiceCaseAttributes> }>(
        `/service-cases/${encodeURIComponent(caseId)}`,
        {
          method: "PATCH",
          headers: { "Idempotency-Key": key },
          body: JSON.stringify(body),
        },
        { providerId },
      )
      .then((response) => response.data),
  serviceCaseJourney: (providerId: string, caseId: string) =>
    apiClient
      .request<{ data: ProviderWorkJourney | null }>(
        `/service-cases/${encodeURIComponent(caseId)}/journey`,
        {},
        { providerId },
      )
      .then((response) => response.data),
  transitionServiceCase: (
    providerId: string,
    caseId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient
      .request<{ data: Resource<ServiceCaseAttributes> }>(
        `/service-cases/${encodeURIComponent(caseId)}/transitions`,
        {
          method: "POST",
          headers: { "Idempotency-Key": key },
          body: JSON.stringify(body),
        },
        { providerId },
      )
      .then((response) => response.data),
  closeServiceCase: (
    providerId: string,
    caseId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient
      .request<{ data: Resource<ServiceCaseAttributes> }>(
        `/service-cases/${encodeURIComponent(caseId)}/close`,
        {
          method: "POST",
          headers: { "Idempotency-Key": key },
          body: JSON.stringify(body),
        },
        { providerId },
      )
      .then((response) => response.data),
  serviceStages: async (
    providerId: string,
    caseId: string,
  ): Promise<Collection<GenericAttributes>> => {
    const payload = (await query(
      `/service-cases/${encodeURIComponent(caseId)}/stages?page[limit]=100`,
      providerId,
    )) as Collection<GenericAttributes> & {
      data: Array<
        Resource<GenericAttributes> | { data: Resource<GenericAttributes> }
      >;
    };
    const data = payload.data.map((item): Resource<GenericAttributes> =>
      "data" in item
        ? (item.data as Resource<GenericAttributes>)
        : (item as Resource<GenericAttributes>),
    );
    return { ...payload, data };
  },
  qualityFindings: async (
    providerId: string,
    caseId: string,
  ): Promise<Collection<QualityFindingAttributes>> => {
    const payload = (await query(
      `/service-cases/${encodeURIComponent(caseId)}/quality-findings?page[limit]=100`,
      providerId,
    )) as Collection<QualityFindingAttributes> & {
      data: Array<
        | Resource<QualityFindingAttributes>
        | { data: Resource<QualityFindingAttributes> }
      >;
    };
    const data = payload.data.map((item): Resource<QualityFindingAttributes> =>
      "data" in item
        ? (item.data as Resource<QualityFindingAttributes>)
        : (item as Resource<QualityFindingAttributes>),
    );
    return { ...payload, data };
  },
  createQualityFinding: (
    providerId: string,
    caseId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<QualityFindingAttributes>>(
      `/service-cases/${encodeURIComponent(caseId)}/quality-findings`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  transitionQualityFinding: (
    providerId: string,
    findingId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<QualityFindingAttributes>>(
      `/quality-findings/${encodeURIComponent(findingId)}/transitions`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  createServiceStage: (
    providerId: string,
    caseId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<GenericAttributes>>(
      `/service-cases/${encodeURIComponent(caseId)}/stages`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  transitionServiceStage: (
    providerId: string,
    stageId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<GenericAttributes>>(
      `/service-stages/${encodeURIComponent(stageId)}/transitions`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  materialRequirements: async (
    providerId: string,
    caseId: string,
  ): Promise<Collection<MaterialRequirementAttributes>> => {
    const payload = (await query(
      `/service-cases/${encodeURIComponent(caseId)}/material-requirements?page[limit]=100`,
      providerId,
    )) as Collection<MaterialRequirementAttributes> & {
      data: Array<
        | Resource<MaterialRequirementAttributes>
        | { data: Resource<MaterialRequirementAttributes> }
      >;
    };
    const data = payload.data.map(
      (item): Resource<MaterialRequirementAttributes> =>
        "data" in item
          ? (item.data as Resource<MaterialRequirementAttributes>)
          : (item as Resource<MaterialRequirementAttributes>),
    );
    return { ...payload, data };
  },
  createMaterialRequirement: (
    providerId: string,
    caseId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<MaterialRequirementAttributes>>(
      `/service-cases/${encodeURIComponent(caseId)}/material-requirements`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  shipments: async (
    providerId: string,
    caseId: string,
  ): Promise<Collection<ShipmentAttributes>> => {
    const payload = (await query(
      `/service-cases/${encodeURIComponent(caseId)}/shipments?page[limit]=100`,
      providerId,
    )) as Collection<ShipmentAttributes> & {
      data: Array<
        Resource<ShipmentAttributes> | { data: Resource<ShipmentAttributes> }
      >;
    };
    const data = payload.data.map((item): Resource<ShipmentAttributes> =>
      "data" in item
        ? (item.data as Resource<ShipmentAttributes>)
        : (item as Resource<ShipmentAttributes>),
    );
    return { ...payload, data };
  },
  createShipment: (
    providerId: string,
    caseId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<ShipmentAttributes>>(
      `/service-cases/${encodeURIComponent(caseId)}/shipments`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  recordShipmentDelivery: (
    providerId: string,
    shipmentId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<ShipmentAttributes>>(
      `/shipments/${encodeURIComponent(shipmentId)}/delivery`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  paymentSchedules: async (
    providerId: string,
    caseId: string,
  ): Promise<Collection<PaymentScheduleAttributes>> => {
    const payload = (await query(
      `/service-cases/${encodeURIComponent(caseId)}/payment-schedules?page[limit]=100`,
      providerId,
    )) as Collection<PaymentScheduleAttributes> & {
      data: Array<
        | Resource<PaymentScheduleAttributes>
        | { data: Resource<PaymentScheduleAttributes> }
      >;
    };
    const data = payload.data.map(
      (item): Resource<PaymentScheduleAttributes> =>
        "data" in item
          ? (item.data as Resource<PaymentScheduleAttributes>)
          : (item as Resource<PaymentScheduleAttributes>),
    );
    return { ...payload, data };
  },
  payments: async (
    providerId: string,
    caseId: string,
  ): Promise<Collection<PaymentAttributes>> => {
    const payload = (await query(
      `/service-cases/${encodeURIComponent(caseId)}/payments?page[limit]=100`,
      providerId,
    )) as Collection<PaymentAttributes> & {
      data: Array<
        Resource<PaymentAttributes> | { data: Resource<PaymentAttributes> }
      >;
    };
    const data = payload.data.map((item): Resource<PaymentAttributes> =>
      "data" in item
        ? (item.data as Resource<PaymentAttributes>)
        : (item as Resource<PaymentAttributes>),
    );
    return { ...payload, data };
  },
  blockers: async (
    providerId: string,
    caseId: string,
  ): Promise<Collection<ServiceCaseBlockerAttributes>> => {
    const payload = (await query(
      `/service-cases/${encodeURIComponent(caseId)}/blockers?page[limit]=100`,
      providerId,
    )) as Collection<ServiceCaseBlockerAttributes>;
    return payload;
  },
  createBlocker: (
    providerId: string,
    caseId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<ServiceCaseBlockerAttributes>>(
      `/service-cases/${encodeURIComponent(caseId)}/blockers`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  transitionBlocker: (
    providerId: string,
    blockerId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<ServiceCaseBlockerAttributes>>(
      `/service-case-blockers/${encodeURIComponent(blockerId)}/transitions`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  notifyBlocker: (
    providerId: string,
    blockerId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<ServiceCaseBlockerAttributes>>(
      `/service-case-blockers/${encodeURIComponent(blockerId)}/notify`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  createPaymentSchedule: (
    providerId: string,
    caseId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<PaymentScheduleAttributes>>(
      `/service-cases/${encodeURIComponent(caseId)}/payment-schedules`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  configurePaymentSchedules: (
    providerId: string,
    caseId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<{ data: Array<Resource<PaymentScheduleAttributes>> }>(
      `/service-cases/${encodeURIComponent(caseId)}/payment-schedules`,
      {
        method: "PUT",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  stageReleases: async (
    providerId: string,
    caseId: string,
  ): Promise<Collection<StageReleaseAttributes>> => {
    const payload = (await query(
      `/service-cases/${encodeURIComponent(caseId)}/stage-releases?page[limit]=100`,
      providerId,
    )) as Collection<StageReleaseAttributes>;
    return payload;
  },
  createStageRelease: (
    providerId: string,
    caseId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<StageReleaseAttributes>>(
      `/service-cases/${encodeURIComponent(caseId)}/stage-releases`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  createPayment: (
    providerId: string,
    caseId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<PaymentAttributes>>(
      `/service-cases/${encodeURIComponent(caseId)}/payments`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  transitionPayment: (
    providerId: string,
    paymentId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<PaymentAttributes>>(
      `/payments/${encodeURIComponent(paymentId)}/transitions`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  serviceCaseJobs: async (
    providerId: string,
    caseId: string,
  ): Promise<Collection<GenericAttributes>> => {
    const payload = (await query(
      `/service-cases/${encodeURIComponent(caseId)}/jobs?page[limit]=100`,
      providerId,
    )) as Collection<GenericAttributes> & {
      data: Array<
        Resource<GenericAttributes> | { data: Resource<GenericAttributes> }
      >;
    };
    const data = payload.data.map((item): Resource<GenericAttributes> =>
      "data" in item
        ? (item.data as Resource<GenericAttributes>)
        : (item as Resource<GenericAttributes>),
    );
    return { ...payload, data };
  },
  requestHandover: (
    providerId: string,
    caseId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient
      .request<{ data: Resource<GenericAttributes> }>(
        `/service-cases/${encodeURIComponent(caseId)}/handover`,
        {
          method: "POST",
          headers: { "Idempotency-Key": key },
          body: JSON.stringify(body),
        },
        { providerId },
      )
      .then((payload) => payload.data),
  acceptHandover: (
    providerId: string,
    caseId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient
      .request<{ data: Resource<GenericAttributes> }>(
        `/service-cases/${encodeURIComponent(caseId)}/handover/accept`,
        {
          method: "POST",
          headers: { "Idempotency-Key": key },
          body: JSON.stringify(body),
        },
        { providerId },
      )
      .then((payload) => payload.data),
  coverageSources: (providerId: string, caseId: string) =>
    query(
      `/service-cases/${encodeURIComponent(caseId)}/coverage-sources`,
      providerId,
    ) as Promise<Collection<GenericAttributes>>,
  commenceCoverage: (
    providerId: string,
    caseId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient
      .request<{ data: Resource<GenericAttributes> }>(
        `/service-cases/${encodeURIComponent(caseId)}/coverage-commencement`,
        {
          method: "POST",
          headers: { "Idempotency-Key": key },
          body: JSON.stringify(body),
        },
        { providerId },
      )
      .then((payload) => payload.data),
  serviceTypes: (providerId: string) =>
    query("/service-types?page[limit]=100", providerId) as Promise<
      Collection<GenericAttributes>
    >,
  partDefinitions: (providerId: string) =>
    query("/part-definitions?page[limit]=100", providerId) as Promise<
      Collection<PartDefinitionAttributes>
    >,
  createServiceCaseJob: (
    providerId: string,
    caseId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<GenericAttributes>>(
      `/service-cases/${encodeURIComponent(caseId)}/jobs/create`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  changeOrders: async (
    providerId: string,
    caseId: string,
  ): Promise<Collection<GenericAttributes>> => {
    const payload = (await query(
      `/service-cases/${encodeURIComponent(caseId)}/change-orders?page[limit]=100`,
      providerId,
    )) as Collection<GenericAttributes> & {
      data: Array<
        Resource<GenericAttributes> | { data: Resource<GenericAttributes> }
      >;
    };
    const data = payload.data.map((item): Resource<GenericAttributes> =>
      "data" in item
        ? (item.data as Resource<GenericAttributes>)
        : (item as Resource<GenericAttributes>),
    );
    return { ...payload, data };
  },
  createChangeOrder: (
    providerId: string,
    caseId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<GenericAttributes>>(
      `/service-cases/${encodeURIComponent(caseId)}/change-orders`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  transitionChangeOrder: (
    providerId: string,
    id: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<GenericAttributes>>(
      `/change-orders/${encodeURIComponent(id)}/transitions`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  platformComplianceRequests: (
    status?: string,
    businessId?: string,
    params: {
      q?: string;
      page?: number;
      perPage?: number;
      providerId?: string;
      history?: boolean;
    } = {},
  ) => {
    const query = new URLSearchParams();
    if (status) query.set("status", status);
    if (businessId) query.set("business_id", businessId);
    if (params.providerId) query.set("provider_id", params.providerId);
    if (params.q) query.set("q", params.q);
    if (params.page) query.set("page", String(params.page));
    if (params.perPage) query.set("per_page", String(params.perPage));
    if (params.history) query.set("history", "true");
    return apiClient.request<PlatformCompliancePage>(
      `/platform/compliance${query.toString() ? `?${query}` : ""}`,
    );
  },
  createPlatformCompliance: (body: Record<string, unknown>, key: string) =>
    apiClient.request<{ data: PlatformComplianceRequest }>(
      "/platform/compliance",
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  updatePlatformCompliance: (
    requestId: string,
    body: {
      expected_revision: number;
      proposed_values: Record<string, unknown>;
      reason: string;
    },
    key: string,
  ) =>
    apiClient.request<{ data: PlatformComplianceRequest }>(
      `/platform/compliance/${encodeURIComponent(requestId)}`,
      {
        method: "PATCH",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  submitPlatformCompliance: (requestId: string, expectedRevision: number) =>
    apiClient.request<{ data: PlatformComplianceRequest }>(
      `/platform/compliance/${encodeURIComponent(requestId)}/submit`,
      {
        method: "POST",
        body: JSON.stringify({ expected_revision: expectedRevision }),
      },
    ),
  platformComplianceRequirements: (status?: string) =>
    apiClient.request<{ data: PlatformComplianceRequirement[] }>(
      `/platform/compliance/requirements${status ? `?status=${encodeURIComponent(status)}` : ""}`,
    ),
  createPlatformComplianceRequirement: (
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<{ data: PlatformComplianceRequirement }>(
      "/platform/compliance/requirements",
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  publishPlatformComplianceRequirement: (
    id: string,
    body: { expected_revision: number; reason: string },
    key: string,
  ) =>
    apiClient.request<{ data: PlatformComplianceRequirement }>(
      `/platform/compliance/requirements/${encodeURIComponent(id)}/publish`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  providerComplianceRequirements: (providerId: string) =>
    apiClient.request<{ data: PlatformComplianceRequirement[] }>(
      "/providers/compliance/requirements",
      {},
      { providerId },
    ),
  agentComplianceRequirements: (providerId: string, agentId: string) =>
    apiClient.request<{ data: PlatformComplianceRequirement[] }>(
      `/providers/agents/${encodeURIComponent(agentId)}/compliance/requirements`,
      {},
      { providerId },
    ),
  agentComplianceRequests: (providerId: string, agentId: string) =>
    apiClient.request<{ data: PlatformComplianceRequest[] }>(
      `/providers/agents/${encodeURIComponent(agentId)}/compliance`,
      {},
      { providerId },
    ),
  createAgentCompliance: (
    providerId: string,
    agentId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<{ data: PlatformComplianceRequest }>(
      `/providers/agents/${encodeURIComponent(agentId)}/compliance`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  submitAgentCompliance: (
    providerId: string,
    agentId: string,
    requestId: string,
    expectedRevision: number,
  ) =>
    apiClient.request<{ data: PlatformComplianceRequest }>(
      `/providers/agents/${encodeURIComponent(agentId)}/compliance/${encodeURIComponent(requestId)}/submit`,
      {
        method: "POST",
        body: JSON.stringify({ expected_revision: expectedRevision }),
      },
      { providerId },
    ),
  createAgentComplianceChange: (
    providerId: string,
    agentId: string,
    recordId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<{ data: PlatformComplianceRequest }>(
      `/providers/agents/${encodeURIComponent(agentId)}/compliance/records/${encodeURIComponent(recordId)}/changes`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  createAgentComplianceRenewal: (
    providerId: string,
    agentId: string,
    recordId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<{ data: PlatformComplianceRequest }>(
      `/providers/agents/${encodeURIComponent(agentId)}/compliance/records/${encodeURIComponent(recordId)}/renewal`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  updateAgentCompliance: (
    providerId: string,
    agentId: string,
    requestId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<{ data: PlatformComplianceRequest }>(
      `/providers/agents/${encodeURIComponent(agentId)}/compliance/${encodeURIComponent(requestId)}`,
      {
        method: "PATCH",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  providerComplianceEligibility: (providerId: string) =>
    apiClient.request<{
      data: {
        outcome: string;
        blockers: Array<Record<string, string>>;
        satisfying_records: Array<Record<string, unknown>>;
        undetermined_requirements: string[];
      };
    }>("/providers/compliance/eligibility", {}, { providerId }),
  providerComplianceRequests: (providerId: string) =>
    apiClient.request<{ data: PlatformComplianceRequest[] }>(
      "/providers/compliance",
      {},
      { providerId },
    ),
  providerComplianceReviewQueue: (providerId: string, status?: string) =>
    apiClient.request<{ data: PlatformComplianceRequest[] }>(
      `/providers/compliance/review-queue${status ? `?status=${encodeURIComponent(status)}` : ""}`,
      {},
      { providerId },
    ),
  providerComplianceReviewDecision: (
    providerId: string,
    requestId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<{ data: PlatformComplianceRequest }>(
      `/providers/compliance/review-queue/${encodeURIComponent(requestId)}/decision`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  providerOperatingTerritories: (providerId: string) =>
    apiClient.request<{ data: ProviderOperatingTerritory[] }>(
      "/providers/operating-territories",
      {},
      { providerId },
    ),
  createProviderOperatingTerritory: (
    providerId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<{ data: ProviderOperatingTerritory }>(
      "/providers/operating-territories",
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  platformProviderOperatingTerritories: (providerId: string) =>
    apiClient.request<{ data: ProviderOperatingTerritory[] }>(
      `/platform/providers/${encodeURIComponent(providerId)}/operating-territories`,
    ),
  providerLicenceAuthorizations: (providerId: string) =>
    apiClient.request<{ data: ProviderLicenceAuthorization[] }>(
      "/providers/licence-authorizations",
      {},
      { providerId },
    ),
  createProviderLicenceAuthorization: (
    providerId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<{ data: ProviderLicenceAuthorization }>(
      "/providers/licence-authorizations",
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  providerAvailableBusinessLicences: (
    providerId: string,
    params: { q?: string; page?: number; perPage?: number } = {},
  ) => {
    const query = new URLSearchParams();
    if (params.q) query.set("q", params.q);
    if (params.page) query.set("page", String(params.page));
    if (params.perPage) query.set("per_page", String(params.perPage));
    return apiClient.request<{
      data: AvailableBusinessLicence[];
      meta: {
        page: number;
        per_page: number;
        total: number;
        total_pages: number;
      };
    }>(
      `/providers/available-business-licences${query.toString() ? `?${query}` : ""}`,
      {},
      { providerId },
    );
  },
  platformProviderLicenceAuthorizations: (providerId?: string) =>
    apiClient.request<{ data: ProviderLicenceAuthorization[] }>(
      providerId
        ? `/platform/providers/${encodeURIComponent(providerId)}/licence-authorizations`
        : "/platform/licence-authorizations",
    ),
  decidePlatformLicenceAuthorization: (
    authorizationId: string,
    body: {
      decision: "APPROVE" | "REJECT" | "REQUEST_CORRECTIONS";
      reason: string;
      expected_revision: number;
    },
    key: string,
  ) =>
    apiClient.request<{ data: PlatformLicenceAuthorization }>(
      `/platform/licence-authorizations/${encodeURIComponent(authorizationId)}/decision`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  assignPlatformLicenceAuthorization: (
    authorizationId: string,
    body: {
      reviewer_user_id: string;
      reason: string;
      expected_revision: number;
    },
    key: string,
  ) =>
    apiClient.request<{ data: PlatformLicenceAuthorization }>(
      `/platform/licence-authorizations/${encodeURIComponent(authorizationId)}/assign`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  createProviderCompliance: (
    providerId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<{ data: PlatformComplianceRequest }>(
      `/providers/compliance`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  createProviderComplianceChange: (
    providerId: string,
    recordId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<{ data: PlatformComplianceRequest }>(
      `/providers/compliance/records/${encodeURIComponent(recordId)}/changes`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  createProviderComplianceRenewal: (
    providerId: string,
    recordId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<{ data: PlatformComplianceRequest }>(
      `/providers/compliance/records/${encodeURIComponent(recordId)}/renewal`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  updateProviderCompliance: (
    providerId: string,
    requestId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<{ data: PlatformComplianceRequest }>(
      `/providers/compliance/${encodeURIComponent(requestId)}`,
      {
        method: "PATCH",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  submitProviderCompliance: (
    providerId: string,
    requestId: string,
    expectedRevision: number,
  ) =>
    apiClient.request<{ data: PlatformComplianceRequest }>(
      `/providers/compliance/${encodeURIComponent(requestId)}/submit`,
      {
        method: "POST",
        body: JSON.stringify({ expected_revision: expectedRevision }),
      },
      { providerId },
    ),
  decidePlatformComplianceRequest: (
    requestId: string,
    body: {
      decision: "APPROVE" | "REJECT" | "REQUEST_CORRECTIONS";
      reason: string;
      expected_revision: number;
    },
    key: string,
  ) =>
    apiClient.request<{ data: PlatformComplianceRequest }>(
      `/platform/compliance/${encodeURIComponent(requestId)}/decision`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  assignPlatformComplianceRequest: (
    requestId: string,
    body: {
      reviewer_user_id: string;
      expected_revision: number;
      reason: string;
    },
    key: string,
  ) =>
    apiClient.request<{ data: PlatformComplianceRequest }>(
      `/platform/compliance/${encodeURIComponent(requestId)}/assign`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  platformProviderManagerAssignments: (
    providerId: string,
    params: { after?: string | null; status?: string; userId?: string } = {},
  ) => {
    const query = new URLSearchParams({
      "page[limit]": String(PLATFORM_PAGE_SIZE),
    });
    if (params.after) query.set("page[after]", params.after);
    if (params.status) query.set("status", params.status);
    if (params.userId) query.set("userId", params.userId);
    return apiClient.request<Collection<PlatformProviderManagerAssignment>>(
      `/platform/providers/${encodeURIComponent(providerId)}/manager-assignments?${query}`,
    );
  },
  platformProviderAdminInvitations: (
    providerId: string,
    after?: string | null,
  ) =>
    apiClient.request<InvitationCollection>(
      `/platform/providers/${encodeURIComponent(providerId)}/admin-invitations?${platformPageQuery({ after })}`,
    ),
  createPlatformProviderAdminInvitationByEmail: (
    providerId: string,
    body: {
      user_id?: string;
      full_name: string;
      email: string;
      mobile: string;
      expires_at: string;
      reason: string;
    },
    key: string,
  ) =>
    apiClient.request<Resource<PlatformProviderAdminInvitationAttributes>>(
      `/platform/providers/${encodeURIComponent(providerId)}/admin-invitations`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  resendPlatformProviderAdminInvitation: (
    providerId: string,
    invitationId: string,
    key: string,
  ) =>
    apiClient.request<Resource<PlatformProviderAdminInvitationAttributes>>(
      `/platform/providers/${encodeURIComponent(providerId)}/admin-invitations/${encodeURIComponent(invitationId)}/resend`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify({}),
      },
    ),
  platformProviderAdminMembers: (providerId: string, after?: string | null) =>
    apiClient.request<Collection<PlatformProviderMemberAttributes>>(
      `/platform/providers/${encodeURIComponent(providerId)}/admin-members?${platformPageQuery({ after })}`,
    ),
  platformProviderUsers: (
    params: {
      q?: string;
      providerId?: string;
      businessId?: string;
      roleId?: string;
      status?: string;
      businessOperationId?: string;
      lastActiveFrom?: string;
      lastActiveTo?: string;
      after?: string | null;
      before?: string | null;
    } = {},
  ) => {
    const query = new URLSearchParams({
      "page[limit]": String(PLATFORM_PAGE_SIZE),
    });
    if (params.after) query.set("page[after]", params.after);
    if (params.before) query.set("page[before]", params.before);
    if (params.q) query.set("q", params.q);
    if (params.providerId) query.set("providerId", params.providerId);
    if (params.businessId) query.set("filter[business_id]", params.businessId);
    if (params.roleId) query.set("filter[role_id]", params.roleId);
    if (params.status) query.set("filter[status]", params.status);
    if (params.businessOperationId)
      query.set(
        "filter[business_operation_type_id]",
        params.businessOperationId,
      );
    if (params.lastActiveFrom)
      query.set("filter[last_active_from]", params.lastActiveFrom);
    if (params.lastActiveTo)
      query.set("filter[last_active_to]", params.lastActiveTo);
    return apiClient.request<PlatformProviderUsersResponse>(
      `/platform/provider-users?${query}`,
    );
  },
  platformTeam: (
    params: {
      after?: string | null;
      before?: string | null;
      sort?: string;
    } = {},
  ) => {
    const query = new URLSearchParams({
      "page[limit]": String(PLATFORM_PAGE_SIZE),
      sort: params.sort || "-created_at,id",
    });
    if (params.after) query.set("page[after]", params.after);
    if (params.before) query.set("page[before]", params.before);
    return apiClient.request<{
      data: PlatformTeamMember[];
      page: { next?: string | null; previous?: string | null };
    }>(`/platform/team?${query}`);
  },
  platformTeamMember: (id: string) =>
    apiClient.request<{ data: PlatformTeamMember; audit: PlatformTeamAudit[] }>(
      `/platform/team/${encodeURIComponent(id)}`,
    ),
  platformTeamRoles: () =>
    apiClient.request<{ data: PlatformRoleDefinition[] }>(
      "/platform/team/roles",
    ),
  platformTeamInvitations: (
    params: { after?: string | null; before?: string | null } = {},
  ) => {
    const query = new URLSearchParams({
      "page[limit]": String(PLATFORM_PAGE_SIZE),
      sort: "-created_at,id",
    });
    if (params.after) query.set("page[after]", params.after);
    if (params.before) query.set("page[before]", params.before);
    return apiClient.request<{
      data: PlatformTeamInvitation[];
      page: { next?: string | null; previous?: string | null };
    }>(`/platform/team/invitations?${query}`);
  },
  createPlatformTeamInvitation: (
    body: {
      email: string;
      platform_role_code: string;
      expires_at: string;
      reason: string;
    },
    key: string,
  ) =>
    apiClient.request<{
      data: PlatformTeamInvitation;
      delivery: { token?: string };
    }>("/platform/team/invitations", {
      method: "POST",
      headers: { "Idempotency-Key": key },
      body: JSON.stringify(body),
    }),
  resendPlatformTeamInvitation: (
    id: string,
    expected_revision: number,
    key: string,
  ) =>
    apiClient.request<{
      data: PlatformTeamInvitation;
      delivery: { token?: string };
    }>(`/platform/team/invitations/${encodeURIComponent(id)}/resend`, {
      method: "POST",
      headers: { "Idempotency-Key": key },
      body: JSON.stringify({ expected_revision }),
    }),
  cancelPlatformTeamInvitation: (
    id: string,
    body: { expected_revision: number; reason: string },
    key: string,
  ) =>
    apiClient.request<{ data: PlatformTeamInvitation }>(
      `/platform/team/invitations/${encodeURIComponent(id)}/cancel`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  changePlatformTeamAccess: (
    id: string,
    action: "suspend" | "restore" | "revoke",
    body: { expected_revision: number; reason: string },
    key: string,
  ) =>
    apiClient.request<{ data: PlatformTeamMember }>(
      `/platform/team/${encodeURIComponent(id)}/${action}`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  replacePlatformTeamRole: (
    id: string,
    body: {
      platform_role_code: string;
      expected_revision: number;
      reason: string;
    },
    key: string,
  ) =>
    apiClient.request<{ data: PlatformTeamMember }>(
      `/platform/team/${encodeURIComponent(id)}/role`,
      {
        method: "PUT",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  platformProviderUser: (membershipId: string) =>
    apiClient.request<{ data: Resource<PlatformProviderUserAttributes> }>(
      `/platform/provider-users/${encodeURIComponent(membershipId)}`,
    ),
  platformProviderTaxProfile: (providerId: string) =>
    apiClient.request<{ data: PlatformProviderTaxProfile }>(
      `/platform/providers/${encodeURIComponent(providerId)}/tax-profile`,
    ),
  createPlatformProviderLegalEntity: (
    providerId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<{ data: PlatformProviderLegalEntity }>(
      `/platform/providers/${encodeURIComponent(providerId)}/tax-profile/legal-entities`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  createPlatformProviderTaxRegistration: (
    providerId: string,
    legalEntityId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<{ data: PlatformProviderTaxRegistration }>(
      `/platform/providers/${encodeURIComponent(providerId)}/tax-profile/legal-entities/${encodeURIComponent(legalEntityId)}/registrations`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  updatePlatformProviderTaxRegistration: (
    providerId: string,
    legalEntityId: string,
    registrationId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<{ data: PlatformProviderTaxRegistration }>(
      `/platform/providers/${encodeURIComponent(providerId)}/tax-profile/legal-entities/${encodeURIComponent(legalEntityId)}/registrations/${encodeURIComponent(registrationId)}`,
      {
        method: "PATCH",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  setDefaultPlatformProviderTaxRegistration: (
    providerId: string,
    legalEntityId: string,
    registrationId: string,
    key: string,
  ) =>
    apiClient.request<{ data: PlatformProviderTaxRegistration }>(
      `/platform/providers/${encodeURIComponent(providerId)}/tax-profile/legal-entities/${encodeURIComponent(legalEntityId)}/registrations/${encodeURIComponent(registrationId)}/default`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify({}),
      },
    ),
  deactivatePlatformProviderTaxRegistration: (
    providerId: string,
    legalEntityId: string,
    registrationId: string,
    expectedRevision: number,
    key: string,
  ) =>
    apiClient.request<{ data: PlatformProviderTaxRegistration }>(
      `/platform/providers/${encodeURIComponent(providerId)}/tax-profile/legal-entities/${encodeURIComponent(legalEntityId)}/registrations/${encodeURIComponent(registrationId)}/deactivate`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify({ expected_revision: expectedRevision }),
      },
    ),
  platformTaxDashboard: () =>
    apiClient.request<{ data: PlatformTaxDashboard }>("/platform/taxes"),
  platformTaxProfile: () =>
    apiClient.request<{ data: PlatformTaxProfile | null }>(
      "/platform/taxes/platform-profile",
    ),
  platformBillingSetup: () =>
    apiClient.request<{ data: PlatformBillingSetup }>(
      "/platform/taxes/billing-setup",
    ),
  updatePlatformTaxProfile: (body: Record<string, unknown>, key: string) =>
    apiClient.request<{ data: PlatformTaxProfile }>(
      "/platform/taxes/platform-profile",
      {
        method: "PUT",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  createPlatformTaxRegistration: (
    profileId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<{ data: PlatformProviderTaxRegistration }>(
      `/platform/taxes/platform-profile/${encodeURIComponent(profileId)}/registrations`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  verifyPlatformTaxRegistration: (
    profileId: string,
    registrationId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<{ data: PlatformProviderTaxRegistration }>(
      `/platform/taxes/platform-profile/${encodeURIComponent(profileId)}/registrations/${encodeURIComponent(registrationId)}/verify`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  setDefaultPlatformTaxRegistration: (
    profileId: string,
    registrationId: string,
    key: string,
  ) =>
    apiClient.request<{ data: PlatformProviderTaxRegistration }>(
      `/platform/taxes/platform-profile/${encodeURIComponent(profileId)}/registrations/${encodeURIComponent(registrationId)}/default`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify({}),
      },
    ),
  platformSaasTaxConfigurations: () =>
    apiClient.request<{ data: PlatformSaasTaxConfiguration[] }>(
      "/platform/taxes/saas-configurations",
    ),
  createPlatformSaasTaxConfiguration: (
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<{ data: PlatformSaasTaxConfiguration }>(
      "/platform/taxes/saas-configurations",
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  submitPlatformSaasTaxConfiguration: (id: string, key: string) =>
    apiClient.request<{ data: PlatformSaasTaxConfiguration }>(
      `/platform/taxes/saas-configurations/${encodeURIComponent(id)}/submit-review`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify({}),
      },
    ),
  approvePlatformSaasTaxConfiguration: (id: string, key: string) =>
    apiClient.request<{ data: PlatformSaasTaxConfiguration }>(
      `/platform/taxes/saas-configurations/${encodeURIComponent(id)}/approve`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify({}),
      },
    ),
  publishPlatformSaasTaxConfiguration: (id: string, key: string) =>
    apiClient.request<{ data: PlatformSaasTaxConfiguration }>(
      `/platform/taxes/saas-configurations/${encodeURIComponent(id)}/publish`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify({}),
      },
    ),
  platformTaxComponents: () =>
    apiClient.request<{ data: PlatformTaxComponent[] }>(
      "/platform/taxes/components",
    ),
  platformTaxTemplates: () =>
    apiClient.request<{ data: PlatformTaxRateTemplate[] }>(
      "/platform/taxes/templates",
    ),
  platformTaxJurisdictions: () =>
    apiClient.request<{ data: PlatformTaxJurisdiction[] }>(
      "/platform/taxes/jurisdictions",
    ),
  platformTaxClassifications: (after?: string | null) =>
    apiClient.request<Collection<PlatformTaxClassification["attributes"]>>(
      `/platform/taxes/classifications?page[limit]=${PLATFORM_PAGE_SIZE}&sort=classification_code,id${after ? `&page[after]=${encodeURIComponent(after)}` : ""}`,
    ),
  platformTaxLegalSources: (after?: string | null) =>
    apiClient.request<Collection<PlatformTaxLegalSource["attributes"]>>(
      `/platform/taxes/legal-sources?page[limit]=${PLATFORM_PAGE_SIZE}&sort=-created_at,id${after ? `&page[after]=${encodeURIComponent(after)}` : ""}`,
    ),
  createPlatformTaxLegalSource: (body: Record<string, unknown>, key: string) =>
    apiClient.request<{ data: PlatformTaxLegalSource }>(
      "/platform/taxes/legal-sources",
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  updatePlatformTaxLegalSource: (
    id: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<{ data: PlatformTaxLegalSource }>(
      `/platform/taxes/legal-sources/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  verifyPlatformTaxLegalSource: (
    id: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<{ data: PlatformTaxLegalSource }>(
      `/platform/taxes/legal-sources/${encodeURIComponent(id)}/verify`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  platformTaxRules: (
    params: { status?: string; q?: string; after?: string | null } = {},
  ) => {
    const query = new URLSearchParams({
      "page[limit]": String(PLATFORM_PAGE_SIZE),
      sort: "-created_at,id",
    });
    if (params.status) query.set("filter[status]", params.status);
    if (params.q) query.set("q", params.q);
    if (params.after) query.set("page[after]", params.after);
    return apiClient.request<Collection<PlatformTaxRule["attributes"]>>(
      `/platform/taxes/rules?${query}`,
    );
  },
  platformTaxRule: (id: string) =>
    apiClient.request<{ data: PlatformTaxRule }>(
      `/platform/taxes/rules/${encodeURIComponent(id)}`,
    ),
  createPlatformTaxRuleFromTemplate: (
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<{ data: PlatformTaxRule }>(
      "/platform/taxes/rules/from-template",
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  platformTaxImports: (after?: string | null) =>
    apiClient.request<Collection<PlatformTaxImportBatch["attributes"]>>(
      `/platform/taxes/imports?page[limit]=${PLATFORM_PAGE_SIZE}&sort=-created_at,id${after ? `&page[after]=${encodeURIComponent(after)}` : ""}`,
    ),
  importPlatformTaxTemplates: (
    body: { batch_reference: string; rows: Array<Record<string, unknown>> },
    key: string,
  ) =>
    apiClient.request<{
      data: Resource<{
        batch_reference: string;
        status: string;
        row_count: number;
        created_count: number;
        errors: Array<Record<string, unknown>>;
      }>;
    }>("/platform/taxes/imports", {
      method: "POST",
      headers: { "Idempotency-Key": key },
      body: JSON.stringify(body),
    }),
  createPlatformTaxRule: (body: Record<string, unknown>, key: string) =>
    apiClient.request<{ data: PlatformTaxRule }>("/platform/taxes/rules", {
      method: "POST",
      headers: { "Idempotency-Key": key },
      body: JSON.stringify(body),
    }),
  updatePlatformTaxRule: (
    id: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<{ data: PlatformTaxRule }>(
      `/platform/taxes/rules/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  validatePlatformTaxRule: (id: string) =>
    apiClient.request<{
      data: {
        ready: boolean;
        blockers: Array<{ field: string; message: string }>;
      };
    }>(`/platform/taxes/rules/${encodeURIComponent(id)}/validate`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
  submitPlatformTaxRule: (id: string, expected_revision: number, key: string) =>
    apiClient.request<{ data: PlatformTaxRule }>(
      `/platform/taxes/rules/${encodeURIComponent(id)}/submit-review`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify({ expected_revision }),
      },
    ),
  rejectPlatformTaxRule: (
    id: string,
    expected_revision: number,
    reason: string,
    key: string,
  ) =>
    apiClient.request<{ data: PlatformTaxRule }>(
      `/platform/taxes/rules/${encodeURIComponent(id)}/reject`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify({ expected_revision, reason }),
      },
    ),
  discardPlatformTaxRule: (
    id: string,
    expected_revision: number,
    reason: string,
    key: string,
  ) =>
    apiClient.request<{ data: PlatformTaxRule }>(
      `/platform/taxes/rules/${encodeURIComponent(id)}/discard`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify({ expected_revision, reason }),
      },
    ),
  approvePlatformTaxRule: (
    id: string,
    expected_revision: number,
    key: string,
  ) =>
    apiClient.request<{ data: PlatformTaxRule }>(
      `/platform/taxes/rules/${encodeURIComponent(id)}/approve`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify({ expected_revision }),
      },
    ),
  publishPlatformTaxRule: (
    id: string,
    expected_revision: number,
    key: string,
  ) =>
    apiClient.request<{ data: PlatformTaxRule }>(
      `/platform/taxes/rules/${encodeURIComponent(id)}/publish`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify({ expected_revision }),
      },
    ),
  previewPlatformTaxRule: (id: string, body: Record<string, unknown>) =>
    apiClient.request<{ data: Record<string, unknown> }>(
      `/platform/taxes/rules/${encodeURIComponent(id)}/preview`,
      { method: "POST", body: JSON.stringify(body) },
    ),
  createPlatformProviderUserAccess: (
    membershipId: string,
    body: {
      provider_id: string;
      role_ids: string[];
      expires_at: string;
      reason: string;
    },
    key: string,
  ) =>
    apiClient.request<{ data: Resource<PlatformProviderUserAttributes> }>(
      `/platform/provider-users/${encodeURIComponent(membershipId)}/provider-access`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  replacePlatformProviderUserRoles: (
    membershipId: string,
    body: { role_ids: string[]; expected_revision: number; reason: string },
    key: string,
  ) =>
    apiClient.request<{ data: Resource<PlatformProviderUserAttributes> }>(
      `/platform/provider-users/${encodeURIComponent(membershipId)}/roles`,
      {
        method: "PUT",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  transitionPlatformProviderUserMembership: (
    membershipId: string,
    action: "suspend" | "restore" | "revoke",
    body: { expected_revision: number; reason: string },
    key: string,
  ) =>
    apiClient.request<{ data: Resource<PlatformProviderUserAttributes> }>(
      `/platform/provider-users/${encodeURIComponent(membershipId)}/membership/${action}`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  resendPlatformProviderUserInvitation: (
    membershipId: string,
    invitationId: string,
    reason: string,
    key: string,
  ) =>
    apiClient.request<{ data: Resource<PlatformProviderUserAttributes> }>(
      `/platform/provider-users/${encodeURIComponent(membershipId)}/invitations/${encodeURIComponent(invitationId)}/resend`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify({ reason }),
      },
    ),
  cancelPlatformProviderUserInvitation: (
    membershipId: string,
    invitationId: string,
    body: { expected_revision: number; reason: string },
    key: string,
  ) =>
    apiClient.request<{ data: Resource<PlatformProviderUserAttributes> }>(
      `/platform/provider-users/${encodeURIComponent(membershipId)}/invitations/${encodeURIComponent(invitationId)}/cancel`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  transitionPlatformProviderAdminMember: (
    providerId: string,
    membershipId: string,
    action: "suspend" | "restore" | "revoke",
    body: { expected_revision: number; reason: string },
    key: string,
  ) =>
    apiClient.request<Resource<PlatformProviderMemberAttributes>>(
      `/platform/providers/${encodeURIComponent(providerId)}/admin-members/${encodeURIComponent(membershipId)}/${action}`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  createPlatformProviderAdminInvitation: (
    providerId: string,
    body: components["schemas"]["ProviderAdminInvitationCreate"],
    key: string,
  ) =>
    apiClient.request<InvitationResponse>(
      `/platform/providers/${encodeURIComponent(providerId)}/admin-invitations`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  revokePlatformProviderAdminInvitation: (
    providerId: string,
    invitationId: string,
    body: components["schemas"]["ProviderAdminInvitationRevoke"],
    key: string,
  ) =>
    apiClient.request<InvitationResponse>(
      `/platform/providers/${encodeURIComponent(providerId)}/admin-invitations/${encodeURIComponent(invitationId)}/revoke`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  myProviderAdminInvitations: (after?: string | null) =>
    apiClient.request<InvitationCollection>(
      `/me/provider-admin-invitations?${platformPageQuery({ after })}`,
    ),
  acceptProviderAdminInvitation: (
    invitationId: string,
    body: components["schemas"]["ProviderAdminInvitationAccept"],
    key: string,
  ) =>
    apiClient.request<InvitationResponse>(
      `/me/provider-admin-invitations/${encodeURIComponent(invitationId)}/accept`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  endPlatformOnboardingLocation: (
    providerId: string,
    locationId: string,
    body: components["schemas"]["ProviderOfficeEnd"],
    key: string,
  ) =>
    apiClient.request<Resource<ProviderOfficeLocationAttributes>>(
      `/platform/providers/${encodeURIComponent(providerId)}/onboarding/locations/${encodeURIComponent(locationId)}/end`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  indiaPincode: (pincode: string) =>
    apiClient.request<IndiaPincodeLookup>(
      `/reference-data/india/pincodes/${encodeURIComponent(pincode)}`,
    ),
  indiaLocations: (
    params: {
      q?: string;
      kind?: IndiaGeographyEntry["attributes"]["kind"];
      parentCode?: string;
      stateCode?: string;
      limit?: number;
    } = {},
  ) => {
    const query = new URLSearchParams();
    if (params.q?.trim()) query.set("q", params.q.trim());
    if (params.kind) query.set("kind", params.kind);
    if (params.parentCode) query.set("parent_code", params.parentCode);
    if (params.stateCode) query.set("state_code", params.stateCode);
    if (params.limit) query.set("limit", String(params.limit));
    return apiClient.request<IndiaGeographyLookup>(
      `/reference-data/india/locations?${query.toString()}`,
    );
  },
  referenceDataImports: () =>
    apiClient.request<{ data: ReferenceDataImport[] }>(
      "/reference-data/admin/imports",
    ),
  submitReferenceDataImportReview: (
    id: string,
    body: { reason?: string },
    key: string,
  ) =>
    apiClient.request(
      `/reference-data/admin/imports/${encodeURIComponent(id)}/reviews`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  approveReferenceDataImportReview: (
    id: string,
    reviewId: string,
    key: string,
  ) =>
    apiClient.request(
      `/reference-data/admin/imports/${encodeURIComponent(id)}/reviews/${encodeURIComponent(reviewId)}/approve`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify({}),
      },
    ),
  revokeReferenceDataImportReview: (
    id: string,
    reviewId: string,
    reason: string,
    key: string,
  ) =>
    apiClient.request(
      `/reference-data/admin/imports/${encodeURIComponent(id)}/reviews/${encodeURIComponent(reviewId)}/revoke`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify({ reason }),
      },
    ),
  restoreReferenceDataImport: (id: string, reviewId: string, key: string) =>
    apiClient.request<ReferenceDataImport>(
      `/reference-data/admin/imports/${encodeURIComponent(id)}/restore`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify({ review_id: reviewId }),
      },
    ),
  providers: () =>
    apiClient.request<Collection<ProviderAttributes>>("/providers"),
  platformOverview: () =>
    apiClient.request<PlatformOverview>("/platform/overview"),
  platformBusinesses: (
    params: {
      q?: string;
      status?: string;
      after?: string;
      before?: string;
    } = {},
  ) => {
    const query = new URLSearchParams({
      "page[limit]": String(PLATFORM_PAGE_SIZE),
    });
    if (params.q) query.set("q", params.q);
    if (params.status) query.set("status", params.status);
    if (params.after) query.set("page[after]", params.after);
    if (params.before) query.set("page[before]", params.before);
    return apiClient.request<Collection<BusinessSummary>>(
      `/platform/businesses?${query}`,
    );
  },
  platformBusiness: (id: string) =>
    apiClient.request<{ data: PlatformBusinessDetails }>(
      `/platform/businesses/${encodeURIComponent(id)}`,
    ),
  transitionPlatformBusiness: (
    id: string,
    action: "restrict" | "reactivate",
    body: {
      expected_revision: number;
      reason: string;
      restriction_type?: string;
      restriction_ends_at?: string;
    },
    key: string,
  ) =>
    apiClient.request<{ data: Resource<BusinessSummary> }>(
      `/platform/businesses/${encodeURIComponent(id)}/${action}`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  createPlatformBusinessLegalProfile: (
    id: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request(
      `/platform/businesses/${encodeURIComponent(id)}/legal-profile`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  createPlatformBusinessTaxRegistration: (
    id: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request(
      `/platform/businesses/${encodeURIComponent(id)}/tax-registrations`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  requestPlatformBusinessTaxRegistrationChange: (
    id: string,
    registrationId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request(
      `/platform/businesses/${encodeURIComponent(id)}/tax-registrations/${encodeURIComponent(registrationId)}/changes`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  verifyPlatformBusinessTaxRegistration: (
    id: string,
    registrationId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request(
      `/platform/businesses/${encodeURIComponent(id)}/tax-registrations/${encodeURIComponent(registrationId)}/verify`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  platformBusinessDocuments: (id: string) =>
    apiClient.request<{ data: BusinessDocument[] }>(
      `/platform/businesses/${encodeURIComponent(id)}/documents`,
    ),
  platformBusinessComplianceHistory: (
    id: string,
    kind: "versions" | "audit",
    page = 1,
    perPage = 10,
  ) =>
    apiClient.request<
      BusinessHistoryPage<BusinessHistoryVersion | BusinessAuditEvent>
    >(
      `/platform/businesses/${encodeURIComponent(id)}/compliance-history?kind=${kind}&page=${page}&per_page=${perPage}`,
    ),
  createPlatformBusinessDocument: (
    id: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<{
      document: BusinessDocument;
      version: { id: string };
      transfer: DocumentTransfer;
    }>(`/platform/businesses/${encodeURIComponent(id)}/documents`, {
      method: "POST",
      headers: { "Idempotency-Key": key },
      body: JSON.stringify(body),
    }),
  createPlatformBusinessDocumentVersion: (
    id: string,
    documentId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<{
      document: BusinessDocument;
      version: { id: string };
      transfer: DocumentTransfer;
    }>(
      `/platform/businesses/${encodeURIComponent(id)}/documents/${encodeURIComponent(documentId)}/versions`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  finalizePlatformBusinessDocument: (
    id: string,
    documentId: string,
    body: { version_id: string; checksum: string; size_bytes: number },
    key: string,
  ) =>
    apiClient.request<BusinessDocument>(
      `/platform/businesses/${encodeURIComponent(id)}/documents/${encodeURIComponent(documentId)}/upload-finalization`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  archivePlatformBusinessDocument: (
    id: string,
    documentId: string,
    body: { expected_revision: number; reason: string },
    key: string,
  ) =>
    apiClient.request<void>(
      `/platform/businesses/${encodeURIComponent(id)}/documents/${encodeURIComponent(documentId)}`,
      {
        method: "DELETE",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  authorizePlatformBusinessDocumentDownload: (
    id: string,
    documentId: string,
    versionId: string,
    key: string,
    disposition: "inline" | "attachment" = "attachment",
  ) =>
    apiClient.request<DocumentTransfer>(
      `/platform/businesses/${encodeURIComponent(id)}/documents/${encodeURIComponent(documentId)}/download`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify({ version_id: versionId, disposition }),
      },
    ),
  platformPlans: (
    params: {
      q?: string;
      status?: string;
      industry?: string;
      businessOperationId?: string;
      after?: string;
      before?: string;
    } = {},
  ) => {
    const query = new URLSearchParams({
      "page[limit]": String(PLATFORM_PAGE_SIZE),
    });
    if (params.after) query.set("page[after]", params.after);
    if (params.before) query.set("page[before]", params.before);
    if (params.q) query.set("q", params.q);
    if (params.status) query.set("filter[status]", params.status);
    if (params.industry) query.set("filter[industry]", params.industry);
    if (params.businessOperationId)
      query.set(
        "filter[business_operation_type_id]",
        params.businessOperationId,
      );
    return apiClient.request<Collection<PlatformPlan>>(
      `/platform/plans?${query}`,
    );
  },
  platformSubscriptionTaxPreview: (body: Record<string, unknown>) =>
    apiClient.request<{ data: Record<string, unknown> }>(
      "/platform/subscription-billing/tax-preview",
      { method: "POST", body: JSON.stringify(body) },
    ),
  platformSubscriptionTaxMode: () =>
    apiClient.request<{
      data: { mode: "LEGACY" | "SHADOW" | "CENTRAL"; source: string };
    }>("/platform/subscription-billing/tax-mode"),
  platformPlan: (id: string) =>
    apiClient.request<Resource<PlatformPlan>>(
      `/platform/plans/${encodeURIComponent(id)}`,
    ),
  createPlatformPlan: (body: Record<string, unknown>, key: string) =>
    apiClient.request<Resource<PlatformPlan>>("/platform/plans", {
      method: "POST",
      headers: { "Idempotency-Key": key },
      body: JSON.stringify(body),
    }),
  createPlatformPlanDraft: (
    planId: string,
    sourceVersionId: string | undefined,
    key: string,
  ) =>
    apiClient.request<{ data: Resource<PlatformPlanVersion> }>(
      `/platform/plans/${encodeURIComponent(planId)}/versions`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(
          sourceVersionId ? { source_version_id: sourceVersionId } : {},
        ),
      },
    ),
  updatePlatformPlanDraft: (
    planId: string,
    versionId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request(`/platform/plans/${planId}/versions/${versionId}`, {
      method: "PATCH",
      headers: { "Idempotency-Key": key },
      body: JSON.stringify(body),
    }),
  validatePlatformPlanVersion: (planId: string, versionId: string) =>
    apiClient.request<{
      data: {
        ready: boolean;
        blockers: Array<{ field: string; code: string; message: string }>;
      };
    }>(`/platform/plans/${planId}/versions/${versionId}/validation`),
  publishPlatformPlanVersion: (
    planId: string,
    versionId: string,
    expected_revision: number,
    key: string,
  ) =>
    apiClient.request(
      `/platform/plans/${planId}/versions/${versionId}/publish`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify({ expected_revision }),
      },
    ),
  retirePlatformPlanVersion: (
    planId: string,
    versionId: string,
    expected_revision: number,
    key: string,
  ) =>
    apiClient.request(
      `/platform/plans/${planId}/versions/${versionId}/retire`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify({ expected_revision }),
      },
    ),
  platformSubscriptions: (params: PlatformPageParams = {}) => {
    const query = new URLSearchParams(platformPageQuery(params));
    if (params.q) query.set("q", params.q);
    if (params.status) query.set("status", params.status);
    return apiClient.request<Collection<PlatformSubscription>>(
      `/platform/subscriptions?${query}`,
    );
  },
  platformSubscription: (subscriptionId: string) =>
    apiClient.request<{ data: Resource<PlatformSubscription> }>(
      `/platform/subscriptions/${encodeURIComponent(subscriptionId)}`,
    ),
  platformSubscriptionBillingProfile: (subscriptionId: string) =>
    apiClient.request<{ data: Resource<SubscriptionBillingProfile> | null }>(
      `/platform/subscriptions/${encodeURIComponent(subscriptionId)}/billing-profile`,
    ),
  platformSubscriptionRecipientTaxRegistrations: (subscriptionId: string) =>
    apiClient.request<{
      data: SubscriptionRecipientTaxRegistration[];
      business: { id: string; name: string };
      provider: { id: string; name: string };
    }>(
      `/platform/subscriptions/${encodeURIComponent(subscriptionId)}/recipient-tax-registrations`,
    ),
  updatePlatformSubscriptionBillingProfile: (
    subscriptionId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<{ data: Resource<SubscriptionBillingProfile> }>(
      `/platform/subscriptions/${encodeURIComponent(subscriptionId)}/billing-profile`,
      {
        method: "PUT",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  platformSubscriptionRequests: (params: PlatformPageParams = {}) =>
    apiClient.request<Collection<PlatformSubscriptionRequest>>(
      `/platform/subscription-requests?${platformPageQuery(params)}`,
    ),
  platformSubscriptionRequest: (requestId: string) =>
    apiClient.request<{ data: Resource<PlatformSubscriptionRequest> }>(
      `/platform/subscription-requests/${encodeURIComponent(requestId)}`,
    ),
  createPlatformSubscriptionRequest: (
    providerId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<{ data: Resource<PlatformSubscriptionRequest> }>(
      `/platform/providers/${encodeURIComponent(providerId)}/subscription-requests`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  decidePlatformSubscriptionRequest: (
    requestId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<{ data: Resource<PlatformSubscriptionRequest> }>(
      `/platform/subscription-requests/${encodeURIComponent(requestId)}/decision`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  submitPlatformSubscriptionEvidence: (
    requestId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request(
      `/platform/subscription-requests/${encodeURIComponent(requestId)}/evidence`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  reviewPlatformSubscriptionEvidence: (
    requestId: string,
    evidenceId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request(
      `/platform/subscription-requests/${encodeURIComponent(requestId)}/evidence/${encodeURIComponent(evidenceId)}/review`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  activatePlatformSubscription: (requestId: string, key: string) =>
    apiClient.request(
      `/platform/subscription-requests/${encodeURIComponent(requestId)}/activate`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify({}),
      },
    ),
  platformSubscriptionUsage: (providerId: string) =>
    apiClient.request<{ data: PlatformUsage }>(
      `/platform/providers/${encodeURIComponent(providerId)}/subscription-usage`,
    ),
  platformSubscriptionChanges: (params: PlatformPageParams = {}) =>
    apiClient.request<Collection<PlatformSubscriptionChange>>(
      `/platform/subscription-changes?${platformPageQuery(params)}`,
    ),
  platformSubscriptionChange: (changeId: string) =>
    apiClient.request<{ data: Resource<PlatformSubscriptionChange> }>(
      `/platform/subscription-changes/${encodeURIComponent(changeId)}`,
    ),
  createPlatformSubscriptionChange: (
    subscriptionId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<{ data: Resource<PlatformSubscriptionChange> }>(
      `/platform/subscriptions/${encodeURIComponent(subscriptionId)}/changes`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  decidePlatformSubscriptionChange: (
    changeId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request(
      `/platform/subscription-changes/${encodeURIComponent(changeId)}/decision`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  submitPlatformSubscriptionChangeEvidence: (
    changeId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request(
      `/platform/subscription-changes/${encodeURIComponent(changeId)}/evidence`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  reviewPlatformSubscriptionChangeEvidence: (
    changeId: string,
    evidenceId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request(
      `/platform/subscription-changes/${encodeURIComponent(changeId)}/evidence/${encodeURIComponent(evidenceId)}/review`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  applyPlatformSubscriptionChange: (changeId: string, key: string) =>
    apiClient.request(
      `/platform/subscription-changes/${encodeURIComponent(changeId)}/apply`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify({}),
      },
    ),
  platformSubscriptionAddons: () =>
    apiClient.request<Collection<PlatformSubscriptionAddon>>(
      "/platform/subscription-addons",
    ),
  createPlatformSubscriptionAddon: (
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<{
      data: Resource<PlatformSubscriptionAddon>;
      version_id: string;
    }>("/platform/subscription-addons", {
      method: "POST",
      headers: { "Idempotency-Key": key },
      body: JSON.stringify(body),
    }),
  publishPlatformSubscriptionAddon: (
    addonId: string,
    versionId: string,
    key: string,
  ) =>
    apiClient.request(
      `/platform/subscription-addons/${encodeURIComponent(addonId)}/versions/${encodeURIComponent(versionId)}/publish`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify({}),
      },
    ),
  platformSubscriptionTaxRates: () =>
    apiClient.request<Collection<PlatformTaxRate>>(
      "/platform/subscription-tax-rates",
    ),
  createPlatformSubscriptionTaxRate: (
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request("/platform/subscription-tax-rates", {
      method: "POST",
      headers: { "Idempotency-Key": key },
      body: JSON.stringify(body),
    }),
  platformSubscriptionInvoices: (params: PlatformPageParams = {}) => {
    const query = new URLSearchParams(platformPageQuery(params));
    if (params.providerId) {
      query.delete("providerId");
      query.set("provider_id", params.providerId);
    }
    return apiClient.request<Collection<PlatformSubscriptionInvoice>>(
      `/platform/subscription-invoices?${query}`,
    );
  },
  platformSubscriptionInvoice: (invoiceId: string) =>
    apiClient.request<{ data: Resource<PlatformSubscriptionInvoice> }>(
      `/platform/subscription-invoices/${encodeURIComponent(invoiceId)}`,
    ),
  platformSubscriptionInvoicePdf: (invoiceId: string, download = false) =>
    apiClient.requestBlob(
      `/platform/subscription-invoices/${encodeURIComponent(invoiceId)}/pdf${download ? "/download" : ""}`,
    ),
  platformSubscriptionInvoiceEmailHistory: (invoiceId: string) =>
    apiClient.request<{ data: Array<Resource<Record<string, unknown>>> }>(
      `/platform/subscription-invoices/${encodeURIComponent(invoiceId)}/email-history`,
    ),
  sendPlatformSubscriptionInvoiceEmail: (
    invoiceId: string,
    resend = false,
    key: string,
  ) =>
    apiClient.request(
      `/platform/subscription-invoices/${encodeURIComponent(invoiceId)}/${resend ? "resend-email" : "send-email"}`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify({}),
      },
    ),
  createPlatformSubscriptionInvoice: (
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request("/platform/subscription-invoices", {
      method: "POST",
      headers: { "Idempotency-Key": key },
      body: JSON.stringify(body),
    }),
  updatePlatformSubscriptionInvoice: (
    invoiceId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request(
      `/platform/subscription-invoices/${encodeURIComponent(invoiceId)}`,
      {
        method: "PUT",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  publishPlatformSubscriptionInvoice: (invoiceId: string, key: string) =>
    apiClient.request(
      `/platform/subscription-invoices/${encodeURIComponent(invoiceId)}/publish`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify({}),
      },
    ),
  submitPlatformSubscriptionInvoiceEvidence: (
    invoiceId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request(
      `/platform/subscription-invoices/${encodeURIComponent(invoiceId)}/evidence`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  reviewPlatformSubscriptionInvoiceEvidence: (
    invoiceId: string,
    evidenceId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request(
      `/platform/subscription-invoices/${encodeURIComponent(invoiceId)}/evidence/${encodeURIComponent(evidenceId)}/review`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  markPlatformSubscriptionInvoicePaid: (invoiceId: string, key: string) =>
    apiClient.request(
      `/platform/subscription-invoices/${encodeURIComponent(invoiceId)}/mark-paid`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify({}),
      },
    ),
  providerSubscriptionPlans: (providerId: string) =>
    query("/providers/subscription-plans", providerId) as Promise<
      Collection<{
        plan_id: string;
        code: string;
        name: string;
        version_number: number;
        price_amount: string;
        currency_code: string;
        billing_interval: string;
        tax_treatment: string;
        industry_keys: string[];
        limits: Array<Record<string, unknown>>;
        included_features?: string[];
        feature_catalogue?: Array<{ code: string; label: string; description: string; depends_on: string[] }>;
      }>
    >,
  providerSubscription: (
    providerId: string,
    after: Partial<Record<SubscriptionHistoryKind, string>> = {},
  ) => {
    const params = new URLSearchParams();
    for (const kind of ["requests", "changes", "invoices"] as const) {
      params.set(`history[${kind}][limit]`, "25");
      if (after[kind]) params.set(`history[${kind}][after]`, after[kind]!);
    }
    return query(`/providers/subscription?${params}`, providerId) as Promise<{
      data: ProviderSubscriptionSelfService;
    }>;
  },
  createProviderSubscriptionRequest: (
    providerId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request(
      "/providers/subscription-requests",
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  createProviderSubscriptionChange: (
    providerId: string,
    subscriptionId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request(
      `/providers/subscriptions/${encodeURIComponent(subscriptionId)}/changes`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  platformProviders: (
    params: {
      q?: string;
      status?: string;
      businessId?: string;
      after?: string | null;
      before?: string | null;
      limit?: number;
    } = {},
  ) => {
    const query = new URLSearchParams({
      "page[limit]": String(params.limit || PLATFORM_PAGE_SIZE),
      sort: "-created_at,id",
    });
    if (params.q?.trim()) query.set("q", params.q.trim());
    if (params.status) query.set("filter[status]", params.status);
    if (params.businessId) query.set("filter[business_id]", params.businessId);
    if (params.after) query.set("page[after]", params.after);
    if (params.before) query.set("page[before]", params.before);
    return apiClient.request<Collection<PlatformProviderAttributes>>(
      `/platform/providers?${query.toString()}`,
    );
  },
  platformProvider: (id: string) =>
    apiClient.request<Resource<PlatformProviderAttributes>>(
      `/platform/providers/${encodeURIComponent(id)}`,
    ),
  platformBusinessIdentityDomains: (businessId: string) =>
    apiClient.request<{ data: PlatformProviderIdentityDomain[] }>(
      `/platform/businesses/${encodeURIComponent(businessId)}/identity-domains`,
    ),
  createPlatformBusinessIdentityDomain: (
    businessId: string,
    body: { domain: string; verification_email: string; reason: string },
    key: string,
  ) =>
    apiClient.request<{ data: PlatformProviderIdentityDomain }>(
      `/platform/businesses/${encodeURIComponent(businessId)}/identity-domains`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  verifyPlatformBusinessIdentityDomain: (
    businessId: string,
    domainId: string,
    body: { verification_token: string; reason: string },
    key: string,
  ) =>
    apiClient.request<{ data: PlatformProviderIdentityDomain }>(
      `/platform/businesses/${encodeURIComponent(businessId)}/identity-domains/${encodeURIComponent(domainId)}/verify`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  resendPlatformBusinessIdentityDomain: (
    businessId: string,
    domainId: string,
    body: { expected_revision: number; reason: string },
    key: string,
  ) =>
    apiClient.request<{ data: PlatformProviderIdentityDomain }>(
      `/platform/businesses/${encodeURIComponent(businessId)}/identity-domains/${encodeURIComponent(domainId)}/resend`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  transitionPlatformBusinessIdentityDomain: (
    businessId: string,
    domainId: string,
    action: "approve" | "suspend",
    body: { expected_revision: number; reason: string },
    key: string,
  ) =>
    apiClient.request<{ data: PlatformProviderIdentityDomain }>(
      `/platform/businesses/${encodeURIComponent(businessId)}/identity-domains/${encodeURIComponent(domainId)}/${action}`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  deletePlatformBusinessIdentityDomain: (
    businessId: string,
    domainId: string,
    body: { expected_revision: number; reason: string },
    key: string,
  ) =>
    apiClient.request<{
      data: {
        id: string;
        type: string;
        attributes: {
          domain: string;
          previous_status: string;
          revision: number;
          reason: string;
        };
      };
    }>(
      `/platform/businesses/${encodeURIComponent(businessId)}/identity-domains/${encodeURIComponent(domainId)}`,
      {
        method: "DELETE",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  businessOperations: () =>
    apiClient.request<{ data: BusinessOperation[] }>("/business-operations"),
  platformBusinessOperations: (
    params: { q?: string; active?: boolean } = {},
  ) => {
    const query = new URLSearchParams();
    if (params.q?.trim()) query.set("q", params.q.trim());
    if (params.active !== undefined) query.set("active", String(params.active));
    const suffix = query.toString();
    return apiClient.request<{ data: BusinessOperation[] }>(
      `/platform/business-operations${suffix ? `?${suffix}` : ""}`,
    );
  },
  createPlatformBusinessOperation: (
    body: {
      code: string;
      name: string;
      description?: string;
      industry_key: string;
      icon_key: string;
      display_order: number;
      is_active: boolean;
      is_selectable: boolean;
      configuration?: ElevatorBusinessConfiguration;
    },
    key: string,
  ) =>
    apiClient.request<BusinessOperation>("/platform/business-operations", {
      method: "POST",
      headers: { "Idempotency-Key": key },
      body: JSON.stringify(body),
    }),
  updatePlatformBusinessOperation: (
    id: string,
    body: {
      expected_revision: number;
      name?: string;
      description?: string;
      industry_key?: string;
      icon_key?: string;
      display_order?: number;
      is_active?: boolean;
      is_selectable?: boolean;
      configuration?: ElevatorBusinessConfiguration;
    },
    key: string,
  ) =>
    apiClient.request<BusinessOperation>(
      `/platform/business-operations/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  setPlatformBusinessOperationAvailability: (
    id: string,
    body: { enabled: boolean; expected_revision: number; reason?: string },
    key: string,
  ) =>
    apiClient.request<BusinessOperation>(
      `/platform/business-operations/${encodeURIComponent(id)}/availability`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  platformMaintenance: () =>
    apiClient.request<{
      data: PlatformMaintenance | null;
      latest?: PlatformMaintenance | null;
    }>("/platform/maintenance"),
  publicPlatformMaintenanceStatus: () =>
    apiClient.request<{ data: PublicPlatformMaintenance | null }>(
      "/platform/maintenance/status",
    ),
  platformAvailability: async () => {
    try {
      return await apiClient.request<{ data: PlatformAvailability }>(
        "/platform/availability",
      );
    } catch (apiError) {
      const manifestUrl = (
        import.meta.env.VITE_PLATFORM_AVAILABILITY_S3_URL as string | undefined
      )?.trim();
      if (!manifestUrl) throw apiError;
      const separator = manifestUrl.includes("?") ? "&" : "?";
      const response = await fetch(
        `${manifestUrl}${separator}t=${Date.now()}`,
        { headers: { Accept: "application/json" }, cache: "no-store" },
      );
      if (!response.ok) throw apiError;
      return (await response.json()) as { data: PlatformAvailability };
    }
  },
  activatePlatformMaintenance: (
    body: {
      mode: PlatformMaintenance["attributes"]["mode"];
      reason: string;
      scheduled_start_at: string;
      scheduled_end_at: string;
    },
    key: string,
  ) =>
    apiClient.request<{ data: PlatformMaintenance }>(
      "/platform/maintenance/activate",
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  deactivatePlatformMaintenance: (
    body: { expected_revision: number; reason: string },
    key: string,
  ) =>
    apiClient.request<{ data: PlatformMaintenance }>(
      "/platform/maintenance/deactivate",
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  updatePlatformMaintenanceWindow: (
    body: {
      expected_revision: number;
      scheduled_start_at: string;
      scheduled_end_at: string;
      reason: string;
    },
    key: string,
  ) =>
    apiClient.request<{ data: PlatformMaintenance }>(
      "/platform/maintenance/window",
      {
        method: "PATCH",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  submitPlatformBusinessOperationReview: (
    id: string,
    body: { expected_revision: number; reason: string },
    key: string,
  ) =>
    apiClient.request<BusinessOperationReview>(
      `/platform/business-operations/${encodeURIComponent(id)}/reviews`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  approvePlatformBusinessOperationReview: (
    id: string,
    reviewId: string,
    key: string,
  ) =>
    apiClient.request<BusinessOperationReview>(
      `/platform/business-operations/${encodeURIComponent(id)}/reviews/${encodeURIComponent(reviewId)}/approve`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify({}),
      },
    ),
  revokePlatformBusinessOperationReview: (
    id: string,
    reviewId: string,
    reason: string,
    key: string,
  ) =>
    apiClient.request<BusinessOperationReview>(
      `/platform/business-operations/${encodeURIComponent(id)}/reviews/${encodeURIComponent(reviewId)}/revoke`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify({ reason }),
      },
    ),
  publishPlatformBusinessOperation: (
    id: string,
    body: { expected_revision: number; review_id: string },
    key: string,
  ) =>
    apiClient.request<BusinessOperation>(
      `/platform/business-operations/${encodeURIComponent(id)}/publish`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  platformProviderOperations: (id: string) =>
    apiClient.request<ProviderOperationsResponse>(
      `/platform/providers/${encodeURIComponent(id)}/operations`,
    ),
  platformProviderConfigurationOverride: (id: string) =>
    apiClient.request<ProviderConfigurationOverrideResponse>(
      `/platform/providers/${encodeURIComponent(id)}/configuration-overrides`,
    ),
  platformProviderSetup: (id: string) =>
    apiClient.request<ProviderSetupResponse>(
      `/platform/providers/${encodeURIComponent(id)}/setup`,
    ),
  dryRunPlatformProviderSetup: (id: string, body: Record<string, unknown>, key: string) =>
    apiClient.request<ProviderSetupResponse>(
      `/platform/providers/${encodeURIComponent(id)}/setup/dry-run`,
      { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(body) },
    ),
  applyPlatformProviderSetup: (id: string, body: Record<string, unknown>, key: string) =>
    apiClient.request<ProviderSetupResponse>(
      `/platform/providers/${encodeURIComponent(id)}/setup/apply`,
      { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(body) },
    ),
  submitPlatformProviderSetupReview: (id: string, body: Record<string, unknown>, key: string) =>
    apiClient.request<{ data: Resource<ConfigurationReview['attributes']> }>(
      `/platform/providers/${encodeURIComponent(id)}/setup/reviews`,
      { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(body) },
    ),
  approvePlatformProviderSetupReview: (id: string, reviewId: string, key: string) =>
    apiClient.request<{ data: Resource<ConfigurationReview['attributes']> }>(
      `/platform/providers/${encodeURIComponent(id)}/setup/reviews/${encodeURIComponent(reviewId)}/approve`,
      { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify({}) },
    ),
  rejectPlatformProviderSetupReview: (id: string, reviewId: string, body: Record<string, unknown>, key: string) =>
    apiClient.request<{ data: Resource<ConfigurationReview['attributes']> }>(
      `/platform/providers/${encodeURIComponent(id)}/setup/reviews/${encodeURIComponent(reviewId)}/reject`,
      { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(body) },
    ),
  activatePlatformProviderSetup: (id: string, body: Record<string, unknown>, key: string) =>
    apiClient.request<ProviderSetupResponse>(
      `/platform/providers/${encodeURIComponent(id)}/setup/activate`,
      { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(body) },
    ),
  updatePlatformProviderConfigurationOverride: (
    id: string,
    body: { expected_revision: number; configuration: Record<string, unknown> },
    key: string,
  ) =>
    apiClient.request<ProviderConfigurationOverrideResponse>(
      `/platform/providers/${encodeURIComponent(id)}/configuration-overrides`,
      {
        method: "PATCH",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  submitPlatformProviderConfigurationOverrideReview: (
    id: string,
    body: { expected_revision: number; reason: string },
    key: string,
  ) =>
    apiClient.request<Resource<ConfigurationReview["attributes"]>>(
      `/platform/providers/${encodeURIComponent(id)}/configuration-overrides/reviews`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  approvePlatformProviderConfigurationOverrideReview: (
    id: string,
    reviewId: string,
    key: string,
  ) =>
    apiClient.request<Resource<ConfigurationReview["attributes"]>>(
      `/platform/providers/${encodeURIComponent(id)}/configuration-overrides/reviews/${encodeURIComponent(reviewId)}/approve`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify({}),
      },
    ),
  revokePlatformProviderConfigurationOverrideReview: (
    id: string,
    reviewId: string,
    reason: string,
    key: string,
  ) =>
    apiClient.request<Resource<ConfigurationReview["attributes"]>>(
      `/platform/providers/${encodeURIComponent(id)}/configuration-overrides/reviews/${encodeURIComponent(reviewId)}/revoke`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify({ reason }),
      },
    ),
  publishPlatformProviderConfigurationOverride: (
    id: string,
    body: { expected_revision: number; review_id: string },
    key: string,
  ) =>
    apiClient.request<ProviderConfigurationOverrideResponse>(
      `/platform/providers/${encodeURIComponent(id)}/configuration-overrides/publish`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  replacePlatformProviderOperations: (
    id: string,
    body: {
      expected_revision: number;
      operations: Array<{
        business_operation_type_id: string;
        is_primary: boolean;
      }>;
    },
    key: string,
  ) =>
    apiClient.request<ProviderOperationsResponse>(
      `/platform/providers/${encodeURIComponent(id)}/operations`,
      {
        method: "PUT",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  providerOperations: (providerId: string) =>
    apiClient.request<ProviderOperationsResponse>(
      "/providers/operations",
      {},
      { providerId },
    ),
  replaceProviderOperations: (
    providerId: string,
    body: {
      expected_revision: number;
      operations: Array<{
        business_operation_type_id: string;
        is_primary: boolean;
      }>;
    },
    key: string,
  ) =>
    apiClient.request<ProviderOperationsResponse>(
      "/providers/operations",
      {
        method: "PUT",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  platformBusinessProfile: (id: string) =>
    apiClient.request<ProviderBusinessProfileResponse>(
      `/platform/providers/${encodeURIComponent(id)}/business-profile`,
    ),
  updatePlatformBusinessProfile: (
    id: string,
    body: {
      business_profile: ProviderBusinessProfile["profile"];
      expected_revision: number;
    },
    key: string,
  ) =>
    apiClient.request<ProviderBusinessProfileResponse>(
      `/platform/providers/${encodeURIComponent(id)}/business-profile`,
      {
        method: "PATCH",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  submitPlatformBusinessProfile: (
    id: string,
    expectedRevision: number,
    key: string,
  ) =>
    apiClient.request<{ data: ProviderVerificationReview }>(
      `/platform/providers/${encodeURIComponent(id)}/business-profile/submit`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify({ expected_revision: expectedRevision }),
      },
    ),
  platformVerificationReviews: (id: string) =>
    apiClient.request<Collection<ProviderVerificationReviewAttributes>>(
      `/platform/providers/${encodeURIComponent(id)}/business-profile/reviews`,
    ),
  platformDocuments: (id: string) =>
    apiClient.request<Collection<ProviderDocumentAttributes>>(
      `/platform/providers/${encodeURIComponent(id)}/documents`,
    ),
  authorizePlatformDocumentDownload: (
    providerId: string,
    documentId: string,
    versionId: string,
    key: string,
    disposition: "inline" | "attachment" = "attachment",
  ) =>
    apiClient.request<DocumentTransfer>(
      `/platform/providers/${encodeURIComponent(providerId)}/documents/${encodeURIComponent(documentId)}/download`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify({ version_id: versionId, disposition }),
      },
    ),
  authorizeProviderDocumentDownload: (
    providerId: string,
    documentId: string,
    versionId: string,
    key: string,
    disposition: "inline" | "attachment" = "attachment",
  ) =>
    apiClient.request<DocumentTransfer>(
      `/documents/${encodeURIComponent(documentId)}/download`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify({ version_id: versionId, disposition }),
      },
      { providerId },
    ),
  platformLogo: (id: string) =>
    apiClient.request<{ data: PlatformLogo | null }>(
      `/platform/providers/${encodeURIComponent(id)}/logo`,
    ),
  activatePlatformLogo: (
    id: string,
    body: { document_id: string; version_id: string },
    key: string,
  ) =>
    apiClient.request<{ data: PlatformLogo }>(
      `/platform/providers/${encodeURIComponent(id)}/logo`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  removePlatformLogo: (id: string, key: string) =>
    apiClient.request<void>(
      `/platform/providers/${encodeURIComponent(id)}/logo`,
      { method: "DELETE", headers: { "Idempotency-Key": key } },
    ),
  createPlatformDocument: (
    providerId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<{
      document: ProviderDocument;
      version: { id: string };
      transfer: DocumentTransfer;
    }>(`/platform/providers/${encodeURIComponent(providerId)}/documents`, {
      method: "POST",
      headers: { "Idempotency-Key": key },
      body: JSON.stringify(body),
    }),
  finalizePlatformDocument: (
    providerId: string,
    documentId: string,
    body: { version_id: string; checksum: string; size_bytes: number },
    key: string,
  ) =>
    apiClient.request<ProviderDocument>(
      `/platform/providers/${encodeURIComponent(providerId)}/documents/${encodeURIComponent(documentId)}/upload-finalization`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  createProviderDocument: (
    providerId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<{
      document: ProviderDocument;
      version: { id: string };
      transfer: DocumentTransfer;
    }>(
      "/documents",
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  finalizeProviderDocument: (
    providerId: string,
    documentId: string,
    body: { version_id: string; checksum: string; size_bytes: number },
    key: string,
  ) =>
    apiClient.request<ProviderDocument>(
      `/documents/${encodeURIComponent(documentId)}/upload-finalization`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  createMarketingLeadDocument: (
    providerId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<{
      document: ProviderDocument;
      version: { id: string };
      transfer: DocumentTransfer;
    }>(
      "/documents",
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  platformOnboardingContacts: (id: string, after?: string) =>
    apiClient.request<Collection<ProviderOnboardingContactAttributes>>(
      `/platform/providers/${encodeURIComponent(id)}/onboarding/contacts?page[limit]=${PLATFORM_PAGE_SIZE}&sort=-created_at,id${after ? `&page[after]=${encodeURIComponent(after)}` : ""}`,
    ),
  createPlatformProviderManagerAssignment: (
    body: {
      user_id: string;
      provider_id: string;
      effective_from: string;
      effective_to: string;
    },
    key: string,
  ) =>
    apiClient.request<Resource<PlatformProviderManagerAssignment>>(
      "/platform/provider-manager-assignments",
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  endPlatformProviderManagerAssignment: (
    id: string,
    body: { expected_revision: number; reason: string },
    key: string,
  ) =>
    apiClient.request<Resource<PlatformProviderManagerAssignment>>(
      `/platform/provider-manager-assignments/${encodeURIComponent(id)}/end`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  createPlatformOnboardingContact: (
    id: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<ProviderOnboardingContactAttributes>>(
      `/platform/providers/${encodeURIComponent(id)}/onboarding/contacts`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  updatePlatformOnboardingContact: (
    id: string,
    contactId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<ProviderOnboardingContactAttributes>>(
      `/platform/providers/${encodeURIComponent(id)}/onboarding/contacts/${encodeURIComponent(contactId)}`,
      {
        method: "PATCH",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  endPlatformOnboardingContact: (
    id: string,
    contactId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<ProviderOnboardingContactAttributes>>(
      `/platform/providers/${encodeURIComponent(id)}/onboarding/contacts/${encodeURIComponent(contactId)}/end`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  platformOnboardingLocations: (id: string, after?: string) =>
    apiClient.request<Collection<ProviderOfficeLocationAttributes>>(
      `/platform/providers/${encodeURIComponent(id)}/onboarding/locations?page[limit]=${PLATFORM_PAGE_SIZE}&sort=-created_at,id${after ? `&page[after]=${encodeURIComponent(after)}` : ""}`,
    ),
  createPlatformOnboardingLocation: (
    id: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<ProviderOfficeLocationAttributes>>(
      `/platform/providers/${encodeURIComponent(id)}/onboarding/locations`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  updatePlatformOnboardingLocation: (
    id: string,
    locationId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<ProviderOfficeLocationAttributes>>(
      `/platform/providers/${encodeURIComponent(id)}/onboarding/locations/${encodeURIComponent(locationId)}`,
      {
        method: "PATCH",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  decideProviderVerificationReview: (
    providerId: string,
    reviewId: string,
    body: { decision: string; reason?: string; expected_revision: number },
    key: string,
  ) =>
    apiClient.request<ProviderVerificationReview>(
      `/platform/providers/${encodeURIComponent(providerId)}/verification-reviews/${encodeURIComponent(reviewId)}/decision`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  createPlatformProvider: (
    body: {
      name: string;
      representation_kind: string;
      provider_code?: string;
      business_id?: string;
      business_name?: string;
      business_operation_type_id: string;
    },
    key: string,
  ) =>
    apiClient.request<Resource<PlatformProviderAttributes>>(
      "/platform/providers",
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  createPlatformProviderOnboardingSession: (
    body: {
      business_id?: string;
      business_name?: string;
      current_step?: string;
      draft?: Record<string, unknown>;
    },
    key: string,
  ) =>
    apiClient.request<
      Resource<{
        status: string;
        current_step: string;
        business_id?: string;
        provider_id?: string;
        draft: Record<string, unknown>;
        validation: Record<string, unknown>;
        revision: number;
      }>
    >("/platform/provider-onboarding", {
      method: "POST",
      headers: { "Idempotency-Key": key },
      body: JSON.stringify(body),
    }),
  updatePlatformProviderOnboardingSession: (
    sessionId: string,
    body: {
      expected_revision: number;
      current_step?: string;
      status?: string;
      provider_id?: string;
      draft?: Record<string, unknown>;
    },
    key: string,
  ) =>
    apiClient.request<
      Resource<{
        status: string;
        current_step: string;
        business_id?: string;
        provider_id?: string;
        draft: Record<string, unknown>;
        validation: Record<string, unknown>;
        revision: number;
      }>
    >(`/platform/provider-onboarding/${encodeURIComponent(sessionId)}`, {
      method: "PATCH",
      headers: { "Idempotency-Key": key },
      body: JSON.stringify(body),
    }),
  updatePlatformProvider: (
    id: string,
    body: {
      name?: string;
      representation_kind?: string;
      provider_code?: string | null;
      expected_revision: number;
    },
    key: string,
  ) =>
    apiClient.request<Resource<PlatformProviderAttributes>>(
      `/platform/providers/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  transitionPlatformProviderLifecycle: (
    id: string,
    action: string,
    body: { expected_revision: number; reason_code: string; reason?: string },
    key: string,
  ) =>
    apiClient.request<ProviderLifecycleTransitionResponse>(
      `/platform/providers/${encodeURIComponent(id)}/lifecycle/${encodeURIComponent(action)}`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  platformProviderLifecycleRequests: (id: string) =>
    apiClient.request<{ data: ProviderLifecycleApproval[] }>(
      `/platform/providers/${encodeURIComponent(id)}/lifecycle-requests`,
    ),
  createPlatformProviderLifecycleRequest: (
    id: string,
    body: {
      action: string;
      expected_revision: number;
      reason_code: string;
      reason: string;
    },
    key: string,
  ) =>
    apiClient.request<{ data: ProviderLifecycleApproval }>(
      `/platform/providers/${encodeURIComponent(id)}/lifecycle-requests`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
    ),
  approvePlatformProviderLifecycleRequest: (
    id: string,
    requestId: string,
    reviewReason: string,
    key: string,
  ) =>
    apiClient.request<{
      data: ProviderLifecycleApproval;
      provider: Resource<PlatformProviderAttributes>;
    }>(
      `/platform/providers/${encodeURIComponent(id)}/lifecycle-requests/${encodeURIComponent(requestId)}/approve`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify({ review_reason: reviewReason }),
      },
    ),
  rejectPlatformProviderLifecycleRequest: (
    id: string,
    requestId: string,
    reviewReason: string,
    key: string,
  ) =>
    apiClient.request<{ data: ProviderLifecycleApproval }>(
      `/platform/providers/${encodeURIComponent(id)}/lifecycle-requests/${encodeURIComponent(requestId)}/reject`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify({ review_reason: reviewReason }),
      },
    ),
  providerBusinessProfile: (providerId: string) =>
    query(
      "/providers/business-profile",
      providerId,
    ) as Promise<ProviderBusinessProfileResponse>,
  updateProviderBusinessProfile: (
    providerId: string,
    body: {
      business_profile: ProviderBusinessProfile["profile"];
      expected_revision: number;
    },
    key: string,
  ) =>
    apiClient.request<ProviderBusinessProfileResponse>(
      "/providers/business-profile",
      {
        method: "PATCH",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  submitProviderBusinessProfile: (
    providerId: string,
    expectedRevision: number,
    key: string,
  ) =>
    apiClient.request<{ data: ProviderVerificationReview }>(
      "/providers/business-profile/submit",
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify({ expected_revision: expectedRevision }),
      },
      { providerId },
    ),
  providerBusinessProfileReviews: (providerId: string) =>
    query(
      "/providers/business-profile/reviews?page[limit]=25&sort=-created_at,id",
      providerId,
    ) as Promise<Collection<ProviderVerificationReviewAttributes>>,
  providerOnboardingContacts: (providerId: string, after?: string) =>
    query(
      `/providers/onboarding/contacts?page[limit]=15&sort=-created_at,id${after ? `&page[after]=${encodeURIComponent(after)}` : ""}`,
      providerId,
    ) as Promise<Collection<ProviderOnboardingContactAttributes>>,
  createProviderOnboardingContact: (
    providerId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<ProviderOnboardingContactAttributes>>(
      "/providers/onboarding/contacts",
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  updateProviderOnboardingContact: (
    providerId: string,
    contactId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<ProviderOnboardingContactAttributes>>(
      `/providers/onboarding/contacts/${encodeURIComponent(contactId)}`,
      {
        method: "PATCH",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  endProviderOnboardingContact: (
    providerId: string,
    contactId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<ProviderOnboardingContactAttributes>>(
      `/providers/onboarding/contacts/${encodeURIComponent(contactId)}/end`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  providerOnboardingLocations: (providerId: string, after?: string) =>
    query(
      `/providers/onboarding/locations?page[limit]=15&sort=-created_at,id${after ? `&page[after]=${encodeURIComponent(after)}` : ""}`,
      providerId,
    ) as Promise<Collection<ProviderOfficeLocationAttributes>>,
  createProviderOnboardingLocation: (
    providerId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<ProviderOfficeLocationAttributes>>(
      "/providers/onboarding/locations",
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  updateProviderOnboardingLocation: (
    providerId: string,
    locationId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<ProviderOfficeLocationAttributes>>(
      `/providers/onboarding/locations/${encodeURIComponent(locationId)}`,
      {
        method: "PATCH",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  endProviderOnboardingLocation: (
    providerId: string,
    locationId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<ProviderOfficeLocationAttributes>>(
      `/providers/onboarding/locations/${encodeURIComponent(locationId)}/end`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  providerDocuments: (providerId: string, sourceId?: string) =>
    query(
      `/documents?page[limit]=25&sort=-created_at,id${sourceId ? `&filter[source_id]=${encodeURIComponent(sourceId)}` : ""}`,
      providerId,
    ) as Promise<Collection<ProviderDocumentAttributes>>,
  marketingLeadDocuments: (providerId: string, leadId: string) =>
    query(
      `/documents?page[limit]=25&sort=-created_at,id&filter[lead_id]=${encodeURIComponent(leadId)}`,
      providerId,
    ) as Promise<Collection<ProviderDocumentAttributes>>,
  journeyActivityDocuments: (providerId: string, activityId: string) =>
    query(
      `/documents?page[limit]=25&sort=-created_at,id&filter[source_id]=${encodeURIComponent(activityId)}`,
      providerId,
    ) as Promise<Collection<ProviderDocumentAttributes>>,
  journeyResourceDocuments: (providerId: string, resourceId: string) =>
    query(
      `/documents?page[limit]=25&sort=-created_at,id&filter[source_id]=${encodeURIComponent(resourceId)}`,
      providerId,
    ) as Promise<Collection<ProviderDocumentAttributes>>,
  shipmentDocuments: (providerId: string, shipmentId: string) =>
    query(
      `/documents?page[limit]=25&sort=-created_at,id&filter[source_id]=${encodeURIComponent(shipmentId)}`,
      providerId,
    ) as Promise<Collection<ProviderDocumentAttributes>>,
  providerLogo: (providerId: string) =>
    query("/providers/logo", providerId) as Promise<{
      data: PlatformLogo | null;
    }>,
  activateProviderLogo: (
    providerId: string,
    body: { document_id: string; version_id: string },
    key: string,
  ) =>
    apiClient.request<{ data: PlatformLogo }>(
      "/providers/logo",
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  removeProviderLogo: (providerId: string, key: string) =>
    apiClient.request<void>(
      "/providers/logo",
      { method: "DELETE", headers: { "Idempotency-Key": key } },
      { providerId },
    ),
  submitProviderDocumentReview: (
    providerId: string,
    documentId: string,
    versionId: string,
    key: string,
  ) =>
    apiClient.request<{ data: ProviderVerificationReview }>(
      `/documents/${encodeURIComponent(documentId)}/versions/${encodeURIComponent(versionId)}/reviews`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify({}),
      },
      { providerId },
    ),
  customersForOnboarding: (providerId: string) =>
    query("/customers?page[limit]=100", providerId) as Promise<
      Collection<GenericAttributes>
    >,
  createCustomer: (
    providerId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<GenericAttributes>>(
      "/customers",
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  updateCustomer: (
    providerId: string,
    id: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<GenericAttributes>>(
      `/customers/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  deleteCustomer: (providerId: string, id: string, key: string) =>
    apiClient.request<Resource<GenericAttributes>>(
      `/customers/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
        headers: { "Idempotency-Key": key },
      },
      { providerId },
    ),
  customerRelationships: async (providerId: string) => {
    const data: Resource<GenericAttributes>[] = [];
    let after: string | null = null;
    let pageCount = 0;

    do {
      const page = (await query(
        `/customer-relationships?page[limit]=100${after ? `&page[after]=${encodeURIComponent(after)}` : ""}`,
        providerId,
      )) as Collection<GenericAttributes>;
      data.push(...page.data);

      const next = page.page?.next;
      if (!next || page.data.length === 0 || pageCount >= 20) {
        after = null;
      } else {
        after = next;
      }
      pageCount += 1;
    } while (after);

    return { data };
  },
  locations: (
    providerId: string,
    customerRelationshipId?: string,
    params: {
      query?: string;
      after?: string;
      before?: string;
      limit?: number;
    } = {},
  ) => {
    const page = new URLSearchParams({
      "page[limit]": String(params.limit || 10),
    });
    if (customerRelationshipId)
      page.set("filter[customer_relationship_id]", customerRelationshipId);
    if (params.query?.trim()) page.set("filter[q]", params.query.trim());
    if (params.after) page.set("page[after]", params.after);
    if (params.before) page.set("page[before]", params.before);
    return query(`/locations?${page}`, providerId) as Promise<
      Collection<GenericAttributes>
    >;
  },
  createLocation: (
    providerId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<GenericAttributes>>(
      "/locations",
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  updateLocation: (
    providerId: string,
    id: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<GenericAttributes>>(
      `/locations/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  contacts: (providerId: string) =>
    query("/contacts?page[limit]=100", providerId) as Promise<
      Collection<GenericAttributes>
    >,
  createContact: (
    providerId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<GenericAttributes>>(
      "/contacts",
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  createResponsibility: (
    providerId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<GenericAttributes>>(
      "/responsibilities",
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  createRepresentation: (
    providerId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<GenericAttributes>>(
      "/property-representations",
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  createManagementEngagement: (
    providerId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<GenericAttributes>>(
      "/property-management-engagements",
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  createResourceMembership: (
    providerId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<GenericAttributes>>(
      "/resource-memberships",
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  assetFamilies: (providerId: string) =>
    query("/asset-families?page[limit]=100", providerId) as Promise<
      Collection<GenericAttributes>
    >,
  assetTypes: (providerId: string) =>
    query("/asset-types?page[limit]=100", providerId) as Promise<
      Collection<GenericAttributes>
    >,
  assetDefinitions: (providerId: string) =>
    query("/asset-definitions?page[limit]=100", providerId) as Promise<
      Collection<GenericAttributes>
    >,
  attributeDefinitions: (providerId: string) =>
    query("/attribute-definitions?page[limit]=100", providerId) as Promise<
      Collection<GenericAttributes>
    >,
  elevatorRequirementCatalogue: (providerId: string) =>
    apiClient
      .request<{ data: RequirementCatalogue }>(
        "/providers/business-operations/ELEVATOR_SERVICES/requirement-catalogue",
        {},
        { providerId },
      )
      .then((response) => response.data),
  createAsset: (
    providerId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<GenericAttributes>>(
      "/assets",
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  updateAsset: (
    providerId: string,
    id: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<GenericAttributes>>(
      `/assets/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  assets: (
    providerId: string,
    params: {
      query?: string;
      after?: string;
      before?: string;
      limit?: number;
      customerRelationshipId?: string;
      locationId?: string;
    } = {},
  ) => {
    const page = new URLSearchParams({
      "page[limit]": String(params.limit || 10),
      sort: "-created_at,id",
    });
    if (params.query?.trim()) page.set("filter[q]", params.query.trim());
    if (params.customerRelationshipId)
      page.set(
        "filter[customer_relationship_id]",
        params.customerRelationshipId,
      );
    if (params.locationId) page.set("filter[location_id]", params.locationId);
    if (params.after) page.set("page[after]", params.after);
    if (params.before) page.set("page[before]", params.before);
    return query(`/assets?${page}`, providerId) as Promise<
      Collection<GenericAttributes>
    >;
  },
  assetComplianceRequirements: (providerId: string, assetId: string) =>
    apiClient.request<{ data: PlatformComplianceRequirement[] }>(
      `/providers/assets/${encodeURIComponent(assetId)}/compliance/requirements`,
      {},
      { providerId },
    ),
  assetComplianceRequests: (providerId: string, assetId: string) =>
    apiClient.request<{ data: PlatformComplianceRequest[] }>(
      `/providers/assets/${encodeURIComponent(assetId)}/compliance`,
      {},
      { providerId },
    ),
  createAssetCompliance: (
    providerId: string,
    assetId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<{ data: PlatformComplianceRequest }>(
      `/providers/assets/${encodeURIComponent(assetId)}/compliance`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  createAssetComplianceRenewal: (
    providerId: string,
    assetId: string,
    recordId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<{ data: PlatformComplianceRequest }>(
      `/providers/assets/${encodeURIComponent(assetId)}/compliance/records/${encodeURIComponent(recordId)}/renewal`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  updateAssetCompliance: (
    providerId: string,
    assetId: string,
    requestId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<{ data: PlatformComplianceRequest }>(
      `/providers/assets/${encodeURIComponent(assetId)}/compliance/${encodeURIComponent(requestId)}`,
      {
        method: "PATCH",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  submitAssetCompliance: (
    providerId: string,
    assetId: string,
    requestId: string,
    expectedRevision: number,
  ) =>
    apiClient.request<{ data: PlatformComplianceRequest }>(
      `/providers/assets/${encodeURIComponent(assetId)}/compliance/${encodeURIComponent(requestId)}/submit`,
      {
        method: "POST",
        body: JSON.stringify({ expected_revision: expectedRevision }),
      },
      { providerId },
    ),
  requests: (
    providerId: string,
    params: {
      after?: string | null;
      before?: string | null;
      limit?: number;
      query?: string;
      status?: string;
    } = {},
  ) => {
    const page = new URLSearchParams({
      "page[limit]": String(params.limit || 10),
      sort: "-created_at,id",
    });
    if (params.after) page.set("page[after]", params.after);
    if (params.before) page.set("page[before]", params.before);
    if (params.query) page.set("filter[q]", params.query);
    if (params.status) page.set("filter[status]", params.status);
    return query(`/service-requests?${page}`, providerId) as Promise<
      Collection<RequestAttributes>
    >;
  },
  marketingLeads: (
    providerId: string,
    params: {
      after?: string | null;
      before?: string | null;
      limit?: number;
      query?: string;
      status?: string;
      source?: string;
      priority?: string;
    } = {},
  ) => {
    const page = new URLSearchParams({
      "page[limit]": String(params.limit || 10),
      sort: "-created_at,id",
    });
    if (params.after) page.set("page[after]", params.after);
    if (params.before) page.set("page[before]", params.before);
    if (params.query) page.set("filter[q]", params.query);
    if (params.status) page.set("filter[status]", params.status);
    if (params.source) page.set("filter[source]", params.source);
    if (params.priority) page.set("filter[priority]", params.priority);
    return query(`/marketing-leads?${page}`, providerId) as Promise<
      Collection<MarketingLeadAttributes>
    >;
  },
  marketingLead: (providerId: string, leadId: string) =>
    query(
      `/marketing-leads/${encodeURIComponent(leadId)}`,
      providerId,
    ) as Promise<Resource<MarketingLeadAttributes>>,
  marketingLeadJourney: (providerId: string, leadId: string) =>
    apiClient
      .request<{
        data: ProviderWorkJourney | null;
        meta?: { linked?: boolean };
      }>(
        `/marketing-leads/${encodeURIComponent(leadId)}/journey`,
        {},
        { providerId },
      )
      .then((response) => response.data),
  ensureMarketingLeadJourney: (
    providerId: string,
    leadId: string,
    key: string,
  ) =>
    apiClient
      .request<{ data: ProviderWorkJourney }>(
        `/marketing-leads/${encodeURIComponent(leadId)}/journey`,
        {
          method: "POST",
          headers: { "Idempotency-Key": key },
          body: JSON.stringify({}),
        },
        { providerId },
      )
      .then((response) => response.data),
  createMarketingLead: (
    providerId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<MarketingLeadAttributes>>(
      "/marketing-leads",
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  updateMarketingLead: (
    providerId: string,
    leadId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<MarketingLeadAttributes>>(
      `/marketing-leads/${encodeURIComponent(leadId)}`,
      {
        method: "PATCH",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  createLeadActivity: (
    providerId: string,
    leadId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<GenericAttributes>>(
      `/marketing-leads/${encodeURIComponent(leadId)}/activities`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  leadActivities: (providerId: string, leadId: string) =>
    query(
      `/marketing-leads/${encodeURIComponent(leadId)}/activities`,
      providerId,
    ) as Promise<{ data: Resource<GenericAttributes>[] }>,
  createSiteSurvey: (
    providerId: string,
    leadId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<SiteSurveyAttributes>>(
      `/marketing-leads/${encodeURIComponent(leadId)}/site-surveys`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  siteSurveys: (providerId: string, leadId: string) =>
    query(
      `/marketing-leads/${encodeURIComponent(leadId)}/site-surveys`,
      providerId,
    ) as Promise<{ data: Resource<SiteSurveyAttributes>[] }>,
  updateSiteSurveyDraft: (
    providerId: string,
    leadId: string,
    surveyId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<SiteSurveyAttributes>>(
      `/marketing-leads/${encodeURIComponent(leadId)}/site-surveys/${encodeURIComponent(surveyId)}`,
      {
        method: "PATCH",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  createRequirementRevision: (
    providerId: string,
    leadId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<RequirementRevisionAttributes>>(
      `/marketing-leads/${encodeURIComponent(leadId)}/requirements`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  requirementRevisions: (providerId: string, leadId: string) =>
    query(
      `/marketing-leads/${encodeURIComponent(leadId)}/requirements`,
      providerId,
    ) as Promise<{
      data: Resource<RequirementRevisionAttributes>[];
      meta?: { latest_revision_number?: number | null };
    }>,
  request: (providerId: string, id: string) =>
    query(`/service-requests/${encodeURIComponent(id)}`, providerId) as Promise<
      Resource<RequestAttributes>
    >,
  createRequest: (
    providerId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<RequestAttributes>>(
      "/service-requests",
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  updateRequest: (
    providerId: string,
    id: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<RequestAttributes>>(
      `/service-requests/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  transitionRequest: (
    providerId: string,
    id: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<RequestAttributes>>(
      `/service-requests/${encodeURIComponent(id)}/transitions`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  contactRouting: async (providerId: string, requestId: string) => {
    const result = (await query(
      "/contact-routing/resolutions?page[limit]=25&filter[source_type]=ServiceRequest",
      providerId,
    )) as Collection<ContactRoutingAttributes>;
    return {
      ...result,
      data: result.data.filter(
        (item) =>
          String(
            (
              item.attributes as ContactRoutingAttributes & {
                source_id?: string;
              }
            ).source_id || "",
          ) === requestId,
      ),
    };
  },
  resolveContact: (
    providerId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<ContactRoutingAttributes>>(
      "/contact-routing/resolutions",
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  bookings: (
    providerId: string,
    params: {
      after?: string | null;
      before?: string | null;
      limit?: number;
      query?: string;
      status?: string;
      startsAtGte?: string;
      startsAtLt?: string;
    } = {},
  ) => {
    const page = new URLSearchParams({
      "page[limit]": String(params.limit || 10),
      sort: "-created_at,id",
    });
    if (params.after) page.set("page[after]", params.after);
    if (params.before) page.set("page[before]", params.before);
    if (params.query) page.set("filter[q]", params.query);
    if (params.status) page.set("filter[status]", params.status);
    if (params.startsAtGte)
      page.set("filter[starts_at_gte]", params.startsAtGte);
    if (params.startsAtLt) page.set("filter[starts_at_lt]", params.startsAtLt);
    return query(`/service-bookings?${page}`, providerId) as Promise<
      Collection<BookingAttributes>
    >;
  },
  booking: (providerId: string, id: string) =>
    query(`/service-bookings/${encodeURIComponent(id)}`, providerId) as Promise<
      Resource<BookingAttributes>
    >,
  updateBooking: (
    providerId: string,
    id: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<BookingAttributes>>(
      `/service-bookings/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  capacityPools: (providerId: string) =>
    query(
      "/capacity-pools?page[limit]=100&sort=-created_at,id",
      providerId,
    ) as Promise<Collection<CapacityPoolAttributes>>,
  createAppointment: (
    providerId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<BookingAttributes>>(
      "/appointments",
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  confirmAppointment: (
    providerId: string,
    bookingId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<BookingAttributes>>(
      `/appointments/${encodeURIComponent(bookingId)}/confirm`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  rescheduleAppointment: (
    providerId: string,
    bookingId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<BookingAttributes>>(
      `/appointments/${encodeURIComponent(bookingId)}/reschedule`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  cancelAppointment: (
    providerId: string,
    bookingId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<BookingAttributes>>(
      `/appointments/${encodeURIComponent(bookingId)}/cancel`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  jobs: (
    providerId: string,
    params: {
      after?: string | null;
      before?: string | null;
      limit?: number;
      query?: string;
      status?: string;
    } = {},
  ) => {
    const page = new URLSearchParams({
      "page[limit]": String(params.limit || 10),
      sort: "-created_at,id",
    });
    if (params.after) page.set("page[after]", params.after);
    if (params.before) page.set("page[before]", params.before);
    if (params.query?.trim()) page.set("filter[q]", params.query.trim());
    if (params.status) page.set("filter[status]", params.status);
    return query(`/service-jobs?${page}`, providerId) as Promise<
      Collection<JobAttributes>
    >;
  },
  job: (providerId: string, id: string) =>
    query(`/service-jobs/${encodeURIComponent(id)}`, providerId) as Promise<
      Resource<JobAttributes>
    >,
  agents: (providerId: string) =>
    query("/agents?page[limit]=100&sort=-created_at,id", providerId) as Promise<
      Collection<AgentAttributes>
    >,
  createJob: (providerId: string, body: Record<string, unknown>, key: string) =>
    apiClient.request<Resource<JobAttributes>>(
      "/service-jobs",
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  assign: (
    providerId: string,
    jobId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<unknown>>(
      `/service-jobs/${encodeURIComponent(jobId)}/assignments`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  assignments: (
    providerId: string,
    params: { after?: string | null; before?: string | null; limit?: number; statuses?: string[] } = {},
  ) => {
    const page = new URLSearchParams({
      "page[limit]": String(params.limit || 15),
      sort: "-created_at,id",
    });
    for (const status of params.statuses || ["PROPOSED", "ASSIGNED", "ACCEPTED", "EN_ROUTE", "ARRIVED", "WORKING"]) {
      page.append("filter[status][]", status);
    }
    if (params.after) page.set("page[after]", params.after);
    if (params.before) page.set("page[before]", params.before);
    return query(`/assignments?${page}`, providerId) as Promise<Collection<AssignmentAttributes>>;
  },
  nearbyAssignments: (
    providerId: string,
    params: { latitude: number; longitude: number; accuracy_m?: number | null; radius_m?: number; limit?: number; statuses?: string[] },
  ) => {
    const page = new URLSearchParams({
      latitude: String(params.latitude),
      longitude: String(params.longitude),
      "page[limit]": String(params.limit || 15),
      ...(params.accuracy_m == null ? {} : { accuracy_m: String(params.accuracy_m) }),
      ...(params.radius_m == null ? {} : { radius_m: String(params.radius_m) }),
    });
    for (const status of params.statuses || ["PROPOSED", "ASSIGNED", "ACCEPTED", "EN_ROUTE", "ARRIVED", "WORKING"]) {
      page.append("filter[status][]", status);
    }
    return query(`/assignments/nearby?${page}`, providerId) as Promise<Collection<AssignmentAttributes>>;
  },
  acceptAssignment: (
    providerId: string,
    assignmentId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<AssignmentAttributes>>(
      `/assignments/${encodeURIComponent(assignmentId)}/accept`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  declineAssignment: (
    providerId: string,
    assignmentId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<AssignmentAttributes>>(
      `/assignments/${encodeURIComponent(assignmentId)}/decline`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  visits: (providerId: string, jobId: string) =>
    query(
      `/service-jobs/${encodeURIComponent(jobId)}/visits?page[limit]=25&sort=-created_at,id`,
      providerId,
    ) as Promise<Collection<VisitAttributes>>,
  createVisit: (
    providerId: string,
    jobId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<VisitAttributes>>(
      `/service-jobs/${encodeURIComponent(jobId)}/visits`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  checkIn: (
    providerId: string,
    jobId: string,
    body: JobActionAttributes,
    key: string,
  ) =>
    apiClient.request<Resource<JobAttributes>>(
      `/service-jobs/${encodeURIComponent(jobId)}/check-in`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  start: (
    providerId: string,
    jobId: string,
    body: JobActionAttributes,
    key: string,
  ) =>
    apiClient.request<Resource<JobAttributes>>(
      `/service-jobs/${encodeURIComponent(jobId)}/start`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  complete: (
    providerId: string,
    jobId: string,
    body: JobActionAttributes,
    key: string,
  ) =>
    apiClient.request<Resource<JobAttributes>>(
      `/service-jobs/${encodeURIComponent(jobId)}/complete`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  transitionJob: (
    providerId: string,
    jobId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<JobAttributes>>(
      `/service-jobs/${encodeURIComponent(jobId)}/transitions`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  notes: (providerId: string, jobId: string) =>
    query(
      `/service-jobs/${encodeURIComponent(jobId)}/notes?page[limit]=25&sort=-created_at,id`,
      providerId,
    ) as Promise<Collection<WorkNoteAttributes>>,
  createNote: (
    providerId: string,
    jobId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<WorkNoteAttributes>>(
      `/service-jobs/${encodeURIComponent(jobId)}/notes`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  parts: (providerId: string, jobId: string) =>
    query(
      `/service-jobs/${encodeURIComponent(jobId)}/parts-used?page[limit]=25&sort=-created_at,id`,
      providerId,
    ) as Promise<Collection<PartUsageAttributes>>,
  recordPart: (
    providerId: string,
    jobId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<PartUsageAttributes>>(
      `/service-jobs/${encodeURIComponent(jobId)}/parts-used`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  customers: (
    providerId: string,
    params: {
      query?: string;
      phone?: string;
      email?: string;
      after?: string;
      before?: string;
      limit?: number;
    } = {},
  ) => {
    const page = new URLSearchParams({
      "page[limit]": String(params.limit || 10),
      sort: "-created_at,id",
    });
    if (params.query?.trim()) page.set("filter[q]", params.query.trim());
    if (params.phone?.trim()) page.set("filter[phone]", params.phone.trim());
    if (params.email?.trim()) page.set("filter[email]", params.email.trim());
    if (params.after) page.set("page[after]", params.after);
    if (params.before) page.set("page[before]", params.before);
    return query(`/customers?${page}`, providerId) as Promise<
      Collection<GenericAttributes>
    >;
  },
  teams: (providerId: string) =>
    query("/teams?page[limit]=25&sort=-created_at,id", providerId) as Promise<
      Collection<GenericAttributes>
    >,
  agentsDirectory: (
    providerId: string,
    params: {
      query?: string;
      status?: string;
      after?: string | null;
      before?: string | null;
      limit?: number;
    } = {},
  ) => {
    const page = new URLSearchParams({
      "page[limit]": String(params.limit || 10),
      sort: "-created_at,id",
    });
    if (params.query) page.set("filter[q]", params.query);
    if (params.status) page.set("filter[status]", params.status);
    if (params.after) page.set("page[after]", params.after);
    if (params.before) page.set("page[before]", params.before);
    return query(`/agents?${page}`, providerId) as Promise<
      Collection<GenericAttributes>
    >;
  },
  createAgent: (
    providerId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<GenericAttributes>>(
      "/agents",
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  updateAgent: (
    providerId: string,
    id: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<GenericAttributes>>(
      `/agents/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  createTeam: (
    providerId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<GenericAttributes>>(
      "/teams",
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  skills: (providerId: string) =>
    query("/skills?page[limit]=25&sort=-created_at,id", providerId) as Promise<
      Collection<GenericAttributes>
    >,
  certificationTypes: (providerId: string) =>
    query(
      "/certification-types?page[limit]=100&sort=-created_at,id",
      providerId,
    ) as Promise<Collection<GenericAttributes>>,
  agentSkills: (providerId: string, agentId: string) =>
    query(
      `/agents/${encodeURIComponent(agentId)}/skills?page[limit]=100&sort=-created_at,id`,
      providerId,
    ) as Promise<Collection<GenericAttributes>>,
  createAgentSkill: (
    providerId: string,
    agentId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<GenericAttributes>>(
      `/agents/${encodeURIComponent(agentId)}/skills`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  verifyAgentSkill: (
    providerId: string,
    agentId: string,
    attainmentId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<GenericAttributes>>(
      `/agents/${encodeURIComponent(agentId)}/skills/${encodeURIComponent(attainmentId)}/verification`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  agentCertifications: (providerId: string, agentId: string) =>
    query(
      `/agents/${encodeURIComponent(agentId)}/certifications?page[limit]=100&sort=-created_at,id`,
      providerId,
    ) as Promise<Collection<GenericAttributes>>,
  createAgentCertification: (
    providerId: string,
    agentId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<GenericAttributes>>(
      `/agents/${encodeURIComponent(agentId)}/certifications`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  verifyAgentCertification: (
    providerId: string,
    agentId: string,
    certificationId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<GenericAttributes>>(
      `/agents/${encodeURIComponent(agentId)}/certifications/${encodeURIComponent(certificationId)}/verification`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  territories: (providerId: string) =>
    query(
      "/service-territories?page[limit]=25&sort=-created_at,id",
      providerId,
    ) as Promise<Collection<GenericAttributes>>,
  leaveRequests: (providerId: string) =>
    query(
      "/leave-requests?page[limit]=25&sort=-created_at,id",
      providerId,
    ) as Promise<Collection<GenericAttributes>>,
  workforceMe: (providerId: string) =>
    apiClient
      .request<{ data: Resource<GenericAttributes> }>(
        "/workforce/me",
        {},
        { providerId },
      )
      .then((response) => response.data),
  attendance: (providerId: string) =>
    query(
      "/attendance?page[limit]=15&sort=-created_at,id",
      providerId,
    ) as Promise<Collection<GenericAttributes>>,
  attendanceToday: (providerId: string) =>
    apiClient.request<{
      data: Resource<GenericAttributes> | null;
      meta: Record<string, unknown>;
    }>("/attendance/today", {}, { providerId }),
  checkInAttendance: (
    providerId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<GenericAttributes>>(
      "/attendance/check-in",
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  checkOutAttendance: (
    providerId: string,
    attendanceId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<GenericAttributes>>(
      `/attendance/${encodeURIComponent(attendanceId)}/check-out`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  createLeaveRequest: (
    providerId: string,
    agentId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<GenericAttributes>>(
      `/agents/${encodeURIComponent(agentId)}/leave-requests`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  transitionLeaveRequest: (
    providerId: string,
    leaveRequestId: string,
    action: "approve" | "reject" | "cancel",
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<GenericAttributes>>(
      `/leave-requests/${encodeURIComponent(leaveRequestId)}/${action}`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  createAvailability: (
    providerId: string,
    agentId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<GenericAttributes>>(
      `/agents/${encodeURIComponent(agentId)}/availability`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  quotations: (
    providerId: string,
    params: {
      after?: string | null;
      before?: string | null;
      limit?: number;
      query?: string;
      status?: string;
      customerRelationshipId?: string;
      leadId?: string;
    } = {},
  ) => {
    const page = new URLSearchParams({
      "page[limit]": String(params.limit || 10),
      sort: "-created_at,id",
    });
    if (params.after) page.set("page[after]", params.after);
    if (params.before) page.set("page[before]", params.before);
    if (params.query) page.set("filter[q]", params.query);
    if (params.status) page.set("filter[status]", params.status);
    if (params.customerRelationshipId)
      page.set(
        "filter[customer_relationship_id]",
        params.customerRelationshipId,
      );
    if (params.leadId) page.set("filter[lead_id]", params.leadId);
    return query(`/quotations?${page}`, providerId) as Promise<
      Collection<GenericAttributes>
    >;
  },
  quotationTaxRules: (providerId: string) =>
    query("/quotation-tax-rules", providerId) as Promise<
      Collection<QuotationTaxRuleAttributes>
    >,
  quotation: (providerId: string, id: string) =>
    query(`/quotations/${encodeURIComponent(id)}`, providerId) as Promise<
      Resource<GenericAttributes>
    >,
  quotationAudit: (providerId: string, id: string) =>
    query(`/quotations/${encodeURIComponent(id)}/audit`, providerId) as Promise<
      Collection<GenericAttributes>
    >,
  quotationJourney: (providerId: string, id: string) =>
    apiClient
      .request<{ data: ProviderWorkJourney | null }>(
        `/quotations/${encodeURIComponent(id)}/journey`,
        {},
        { providerId },
      )
      .then((response) => response.data),
  ensureQuotationJourney: (providerId: string, id: string, key: string) =>
    apiClient
      .request<{ data: ProviderWorkJourney }>(
        `/quotations/${encodeURIComponent(id)}/journey`,
        {
          method: "POST",
          headers: { "Idempotency-Key": key },
          body: JSON.stringify({}),
        },
        { providerId },
      )
      .then((response) => response.data),
  reviewProviderQuotation: (
    providerId: string,
    id: string,
    body: {
      decision: "APPROVED" | "REJECTED";
      expected_revision: number;
      reason?: string;
    },
    key: string,
  ) =>
    apiClient.request<Resource<GenericAttributes>>(
      `/quotations/${encodeURIComponent(id)}/provider-reviews`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  providerQuotationReviews: (providerId: string, id: string) =>
    query(
      `/quotations/${encodeURIComponent(id)}/provider-reviews`,
      providerId,
    ) as Promise<Collection<GenericAttributes>>,
  maintenanceContracts: (
    providerId: string,
    params: {
      query?: string;
      status?: string;
      expiresAfter?: string;
      expiresBefore?: string;
      limit?: number;
      after?: string;
      before?: string;
    } = {},
  ) => {
    const page = new URLSearchParams({
      "page[limit]": String(params.limit || 10),
      sort: "-created_at,id",
    });
    if (params.after) page.set("page[after]", params.after);
    if (params.before) page.set("page[before]", params.before);
    if (params.query?.trim()) page.set("filter[q]", params.query.trim());
    if (params.status) page.set("filter[status]", params.status);
    if (params.expiresAfter)
      page.set("filter[expires_after]", params.expiresAfter);
    if (params.expiresBefore)
      page.set("filter[expires_before]", params.expiresBefore);
    return query(`/maintenance-contracts?${page}`, providerId) as Promise<
      Collection<GenericAttributes> & {
        summary?: {
          active_contracts: number;
          preventive_visits_due: number;
          renewals_due_this_month: number;
          covered_assets: number;
        };
      }
    >;
  },
  maintenanceContract: (providerId: string, id: string) =>
    query(
      `/maintenance-contracts/${encodeURIComponent(id)}`,
      providerId,
    ) as Promise<Resource<GenericAttributes>>,
  providerCustomerInvoices: (providerId: string, status?: string, contractId?: string) =>
    apiClient.request<Collection<GenericAttributes> & { summary?: { total: number; outstanding_amount: string; overdue: number; paid: number } }>(
      `/provider-customer-invoices${status || contractId ? `?${status ? `filter[status]=${encodeURIComponent(status)}` : ''}${status && contractId ? '&' : ''}${contractId ? `filter[contract_id]=${encodeURIComponent(contractId)}` : ''}` : ''}`,
      {},
      { providerId },
    ),
  providerCustomerInvoice: (providerId: string, id: string) =>
    apiClient.request<Resource<GenericAttributes>>(
      `/provider-customer-invoices/${encodeURIComponent(id)}`,
      {},
      { providerId },
    ),
  createProviderCustomerInvoice: (providerId: string, body: Record<string, unknown>, key: string) =>
    apiClient.request<Resource<GenericAttributes>>(
      '/provider-customer-invoices',
      { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(body) },
      { providerId },
    ),
  issueProviderCustomerInvoice: (providerId: string, id: string, body: Record<string, unknown>, key: string) =>
    apiClient.request<Resource<GenericAttributes>>(
      `/provider-customer-invoices/${encodeURIComponent(id)}/issue`,
      { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(body) },
      { providerId },
    ),
  providerCustomerInvoicePayments: (providerId: string, id: string) =>
    apiClient.request<{ data: Resource<GenericAttributes>[] }>(
      `/provider-customer-invoices/${encodeURIComponent(id)}/payments`,
      {},
      { providerId },
    ),
  createProviderCustomerInvoicePayment: (providerId: string, id: string, body: Record<string, unknown>, key: string) =>
    apiClient.request<{ data: Resource<GenericAttributes> }>(
      `/provider-customer-invoices/${encodeURIComponent(id)}/payments`,
      { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(body) },
      { providerId },
    ),
  transitionProviderCustomerInvoicePayment: (providerId: string, invoiceId: string, paymentId: string, body: Record<string, unknown>, key: string) =>
    apiClient.request<{ data: Resource<GenericAttributes>; invoice: Resource<GenericAttributes> }>(
      `/provider-customer-invoices/${encodeURIComponent(invoiceId)}/payments/${encodeURIComponent(paymentId)}/transitions`,
      { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(body) },
      { providerId },
    ),
  providerAmcPlans: (providerId: string, status?: string) =>
    apiClient.request<Collection<GenericAttributes> & { summary?: { total: number; published: number; drafts: number; pending_review: number } }>(
      `/provider-service-plans${status ? `?filter[status]=${encodeURIComponent(status)}` : ''}`,
      {},
      { providerId },
    ),
  providerAmcPlan: (providerId: string, id: string) =>
    apiClient.request<Resource<GenericAttributes>>(
      `/provider-service-plans/${encodeURIComponent(id)}`,
      {},
      { providerId },
    ),
  createProviderAmcPlan: (providerId: string, body: Record<string, unknown>, key: string) =>
    apiClient.request<Resource<GenericAttributes>>(
      '/provider-service-plans',
      { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(body) },
      { providerId },
    ),
  updateProviderAmcPlan: (providerId: string, id: string, body: Record<string, unknown>, key: string) =>
    apiClient.request<Resource<GenericAttributes>>(
      `/provider-service-plans/${encodeURIComponent(id)}`,
      { method: 'PATCH', headers: { 'Idempotency-Key': key }, body: JSON.stringify(body) },
      { providerId },
    ),
  createProviderAmcPlanVersion: (providerId: string, id: string, body: Record<string, unknown>, key: string) =>
    apiClient.request<Resource<GenericAttributes>>(
      `/provider-service-plans/${encodeURIComponent(id)}/versions`,
      { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(body) },
      { providerId },
    ),
  submitProviderAmcPlan: (providerId: string, id: string, body: Record<string, unknown>, key: string) =>
    apiClient.request<Resource<GenericAttributes>>(
      `/provider-service-plans/${encodeURIComponent(id)}/submit-review`,
      { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(body) },
      { providerId },
    ),
  reviewProviderAmcPlan: (providerId: string, id: string, body: Record<string, unknown>, key: string) =>
    apiClient.request<Resource<GenericAttributes>>(
      `/provider-service-plans/${encodeURIComponent(id)}/review`,
      { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(body) },
      { providerId },
    ),
  publishProviderAmcPlan: (providerId: string, id: string, body: Record<string, unknown>, key: string) =>
    apiClient.request<Resource<GenericAttributes>>(
      `/provider-service-plans/${encodeURIComponent(id)}/publish`,
      { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(body) },
      { providerId },
    ),
  activateProviderAmcPlan: (providerId: string, id: string, body: Record<string, unknown>, key: string) =>
    apiClient.request<Resource<GenericAttributes>>(
      `/provider-service-plans/${encodeURIComponent(id)}/activate`,
      { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(body) },
      { providerId },
    ),
  suspendProviderAmcPlan: (providerId: string, id: string, body: Record<string, unknown>, key: string) =>
    apiClient.request<Resource<GenericAttributes>>(
      `/provider-service-plans/${encodeURIComponent(id)}/suspend`,
      { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(body) },
      { providerId },
    ),
  createQuotation: (
    providerId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<GenericAttributes>>(
      "/quotations",
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  materialScopeTemplates: (providerId: string) =>
    apiClient.request<Collection<MaterialScopeTemplateAttributes>>(
      "/provider-material-scope-templates",
      {},
      { providerId },
    ),
  createMaterialScopeTemplate: (
    providerId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<MaterialScopeTemplateAttributes>>(
      "/provider-material-scope-templates",
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  updateMaterialScopeTemplate: (
    providerId: string,
    id: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<MaterialScopeTemplateAttributes>>(
      `/provider-material-scope-templates/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  quotationTermsTemplates: (providerId: string) =>
    apiClient.request<Collection<QuotationTermsTemplateAttributes>>(
      "/provider-quotation-terms-templates",
      {},
      { providerId },
    ),
  createQuotationTermsTemplate: (
    providerId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<QuotationTermsTemplateAttributes>>(
      "/provider-quotation-terms-templates",
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  updateQuotationTermsTemplate: (
    providerId: string,
    id: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<QuotationTermsTemplateAttributes>>(
      `/provider-quotation-terms-templates/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  deleteQuotationTermsTemplate: (
    providerId: string,
    id: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<QuotationTermsTemplateAttributes>>(
      `/provider-quotation-terms-templates/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  updateQuotation: (
    providerId: string,
    id: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<GenericAttributes>>(
      `/quotations/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  createQuotationRevision: (
    providerId: string,
    id: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<GenericAttributes>>(
      `/quotations/${encodeURIComponent(id)}/revisions`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  transitionQuotation: (
    providerId: string,
    id: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<GenericAttributes>>(
      `/quotations/${encodeURIComponent(id)}/transitions`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  convertQuotation: (
    providerId: string,
    id: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<GenericAttributes>>(
      `/quotations/${encodeURIComponent(id)}/convert`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  transitionMaintenanceContract: (
    providerId: string,
    id: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<GenericAttributes>>(
      `/maintenance-contracts/${encodeURIComponent(id)}/transitions`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  renewMaintenanceContract: (
    providerId: string,
    id: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<GenericAttributes>>(
      `/maintenance-contracts/${encodeURIComponent(id)}/renew`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  amendMaintenanceContract: (
    providerId: string,
    id: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<GenericAttributes>>(
      `/maintenance-contracts/${encodeURIComponent(id)}/amendments`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  maintenanceContractIterations: (providerId: string, id: string) =>
    query(
      `/maintenance-contracts/${encodeURIComponent(id)}/iterations?page[limit]=100&sort=-due_at,id`,
      providerId,
    ) as Promise<Collection<GenericAttributes>>,
  maintenanceContractAssetScopes: (providerId: string, id: string) =>
    query(
      `/maintenance-contracts/${encodeURIComponent(id)}/asset-scopes?page[limit]=100`,
      providerId,
    ) as Promise<Collection<GenericAttributes>>,
  maintenanceContractCoverageRules: (providerId: string, id: string) =>
    query(
      `/maintenance-contracts/${encodeURIComponent(id)}/coverage-rules?page[limit]=100`,
      providerId,
    ) as Promise<Collection<GenericAttributes>>,
  maintenanceContractVersions: (providerId: string, id: string) =>
    query(
      `/maintenance-contracts/${encodeURIComponent(id)}/versions?page[limit]=100&sort=-created_at,id`,
      providerId,
    ) as Promise<Collection<GenericAttributes>>,
  maintenanceContractAmendments: (providerId: string, id: string) =>
    query(
      `/maintenance-contracts/${encodeURIComponent(id)}/amendments?page[limit]=100&sort=-created_at,id`,
      providerId,
    ) as Promise<Collection<GenericAttributes>>,
  maintenanceContractServicePlan: (providerId: string, id: string) =>
    query(
      `/maintenance-contracts/${encodeURIComponent(id)}/service-plan`,
      providerId,
    ) as Promise<Resource<GenericAttributes>>,
  createMaintenanceIteration: (
    providerId: string,
    id: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<GenericAttributes>>(
      `/maintenance-contracts/${encodeURIComponent(id)}/iterations`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  transitionMaintenanceIteration: (
    providerId: string,
    contractId: string,
    iterationId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<GenericAttributes>>(
      `/maintenance-contracts/${encodeURIComponent(contractId)}/iterations/${encodeURIComponent(iterationId)}/transitions`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  createMaintenanceIterationJob: (
    providerId: string,
    contractId: string,
    iterationId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<GenericAttributes>>(
      `/maintenance-contracts/${encodeURIComponent(contractId)}/iterations/${encodeURIComponent(iterationId)}/jobs`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  quotationPdf: (providerId: string, id: string) =>
    apiClient.requestBlob(
      `/quotations/${encodeURIComponent(id)}/pdf`,
      {},
      { providerId },
    ),
  quotationDeliveryRecipients: (providerId: string, id: string) =>
    query(
      `/quotations/${encodeURIComponent(id)}/delivery-recipients`,
      providerId,
    ) as Promise<{
      data: Array<{ id: string; display_name: string; email?: string | null; phone?: string | null }>;
    }>,
  quotationDeliveries: (providerId: string, id: string) =>
    query(
      `/quotations/${encodeURIComponent(id)}/deliveries?page[limit]=50&sort=-created_at,id`,
      providerId,
    ) as Promise<Collection<GenericAttributes>>,
  createQuotationDelivery: (
    providerId: string,
    id: string,
    body: { contact_point_id?: string; recipient_email?: string; expected_revision: number },
    key: string,
  ) =>
    apiClient.request<Resource<GenericAttributes>>(
      `/quotations/${encodeURIComponent(id)}/deliveries`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  createQuotationNegotiation: (
    providerId: string,
    id: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<GenericAttributes>>(
      `/quotations/${encodeURIComponent(id)}/negotiations`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  configuration: (
    providerId: string,
    type: string,
    status?: string,
    page: { after?: string; before?: string } = {},
  ) => {
    const queryParams = new URLSearchParams({ "page[limit]": String(PLATFORM_PAGE_SIZE), sort: "-created_at,id" });
    if (page.after) queryParams.set("page[after]", page.after);
    if (page.before) queryParams.set("page[before]", page.before);
    if (status) queryParams.set("filter[status]", status);
    return query(
      `/configuration/${encodeURIComponent(type)}?${queryParams.toString()}`,
      providerId,
    ) as Promise<Collection<GenericAttributes>>;
  },
  providerConfigurationSetup: (providerId: string) =>
    apiClient.request<ProviderSetupResponse>(
      "/configuration/setup",
      undefined,
      { providerId },
    ),
  dryRunProviderConfigurationSetup: (providerId: string, body: Record<string, unknown>, key: string) =>
    apiClient.request<ProviderSetupResponse>(
      "/configuration/setup/dry-run",
      { method: "POST", headers: { "Idempotency-Key": key }, body: JSON.stringify(body) },
      { providerId },
    ),
  applyProviderConfigurationSetup: (providerId: string, body: Record<string, unknown>, key: string) =>
    apiClient.request<ProviderSetupResponse>(
      "/configuration/setup/apply",
      { method: "POST", headers: { "Idempotency-Key": key }, body: JSON.stringify(body) },
      { providerId },
    ),
  configurationDetail: (providerId: string, type: string, id: string) =>
    query(
      `/configuration/${encodeURIComponent(type)}/${encodeURIComponent(id)}`,
      providerId,
    ) as Promise<Resource<GenericAttributes>>,
  createConfiguration: (
    providerId: string,
    type: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<GenericAttributes>>(
      `/configuration/${encodeURIComponent(type)}`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  updateConfiguration: (
    providerId: string,
    type: string,
    id: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<GenericAttributes>>(
      `/configuration/${encodeURIComponent(type)}/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  submitConfigurationReview: (
    providerId: string,
    type: string,
    id: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<GenericAttributes>>(
      `/configuration/${encodeURIComponent(type)}/${encodeURIComponent(id)}/reviews`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  configurationReviews: (providerId: string, type: string, id: string) =>
    query(
      `/configuration/${encodeURIComponent(type)}/${encodeURIComponent(id)}/reviews`,
      providerId,
    ) as Promise<Collection<GenericAttributes>>,
  configurationAudit: (providerId: string, type: string, id: string) =>
    apiClient.request<ConfigurationAudit>(
      `/configuration/${encodeURIComponent(type)}/${encodeURIComponent(id)}/audit`,
      {},
      { providerId },
    ),
  configurationImpact: (providerId: string, type: string, id: string) =>
    apiClient.request<ConfigurationImpact>(
      `/configuration/${encodeURIComponent(type)}/${encodeURIComponent(id)}/impact`,
      {},
      { providerId },
    ),
  configurationReviewInbox: (
    status = "PENDING",
    page: { after?: string; before?: string } = {},
  ) => {
    const query = new URLSearchParams({ status: status, "page[limit]": String(PLATFORM_PAGE_SIZE), sort: "-submitted_at,id" });
    if (page.after) query.set("page[after]", page.after);
    if (page.before) query.set("page[before]", page.before);
    return apiClient.request<ConfigurationReviewPage>(`/configuration/reviews?${query.toString()}`);
  },
  configurationAuditInbox: (params: {
    after?: string;
    before?: string;
    q?: string;
    source?: "ALL" | "AUDIT" | "EVENT";
    action?: string;
    resourceKind?: string;
    resourceId?: string;
    actorUserId?: string;
    occurredFrom?: string;
    occurredTo?: string;
  } = {}) => {
    const query = new URLSearchParams({ "page[limit]": String(PLATFORM_PAGE_SIZE), sort: "-occurred_at,id" });
    if (params.after) query.set("page[after]", params.after);
    if (params.before) query.set("page[before]", params.before);
    if (params.q?.trim()) query.set("filter[q]", params.q.trim());
    if (params.source && params.source !== "ALL") query.set("filter[source]", params.source);
    if (params.action && params.action !== "ALL") query.set("filter[action]", params.action);
    if (params.resourceKind && params.resourceKind !== "ALL") query.set("filter[resource_kind]", params.resourceKind);
    if (params.resourceId?.trim()) query.set("filter[resource_id]", params.resourceId.trim());
    if (params.actorUserId?.trim()) query.set("filter[actor_user_id]", params.actorUserId.trim());
    if (params.occurredFrom) query.set("filter[occurred_at][gte]", params.occurredFrom);
    if (params.occurredTo) query.set("filter[occurred_at][lte]", params.occurredTo);
    return apiClient.request<ConfigurationAudit>(`/configuration/audit?${query.toString()}`);
  },
  approveConfigurationReview: (
    providerId: string,
    type: string,
    id: string,
    reviewId: string,
    key: string,
  ) =>
    apiClient.request<Resource<GenericAttributes>>(
      `/configuration/${encodeURIComponent(type)}/${encodeURIComponent(id)}/reviews/${encodeURIComponent(reviewId)}/approve`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify({}),
      },
      { providerId },
    ),
  revokeConfigurationReview: (
    providerId: string,
    type: string,
    id: string,
    reviewId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<GenericAttributes>>(
      `/configuration/${encodeURIComponent(type)}/${encodeURIComponent(id)}/reviews/${encodeURIComponent(reviewId)}/revoke`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  activateConfiguration: (
    providerId: string,
    type: string,
    id: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<GenericAttributes>>(
      `/configuration/${encodeURIComponent(type)}/${encodeURIComponent(id)}/activate`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  archiveConfiguration: (
    providerId: string,
    type: string,
    id: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<GenericAttributes>>(
      `/configuration/${encodeURIComponent(type)}/${encodeURIComponent(id)}/archive`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  restoreConfiguration: (
    providerId: string,
    type: string,
    id: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<GenericAttributes>>(
      `/configuration/${encodeURIComponent(type)}/${encodeURIComponent(id)}/restore`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  timeline: (providerId: string) =>
    query(
      "/timeline?page[limit]=25&sort=-created_at,id",
      providerId,
    ) as Promise<Collection<GenericAttributes>>,
  timelineEntry: (providerId: string, id: string) =>
    query(`/timeline/${encodeURIComponent(id)}`, providerId) as Promise<
      Resource<GenericAttributes>
    >,
  checklists: (providerId: string, jobId: string) =>
    query(
      `/service-jobs/${encodeURIComponent(jobId)}/checklists?page[limit]=25&sort=-created_at,id`,
      providerId,
    ) as Promise<Collection<ChecklistAttributes>>,
  createChecklist: (
    providerId: string,
    jobId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<ChecklistAttributes>>(
      `/service-jobs/${encodeURIComponent(jobId)}/checklists`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  updateChecklist: (
    providerId: string,
    jobId: string,
    checklistId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<ChecklistAttributes>>(
      `/service-jobs/${encodeURIComponent(jobId)}/checklists/${encodeURIComponent(checklistId)}`,
      {
        method: "PATCH",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  completeChecklist: (
    providerId: string,
    jobId: string,
    checklistId: string,
    key: string,
  ) =>
    apiClient.request<Resource<ChecklistAttributes>>(
      `/service-jobs/${encodeURIComponent(jobId)}/checklists/${encodeURIComponent(checklistId)}/complete`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify({}),
      },
      { providerId },
    ),
  checklistTemplates: (providerId: string) =>
    query(
      "/configuration/checklist-templates?page[limit]=100&sort=-created_at,id",
      providerId,
    ) as Promise<Collection<GenericAttributes>>,
  reports: (providerId: string, jobId: string) =>
    query(
      `/service-jobs/${encodeURIComponent(jobId)}/reports?page[limit]=25&sort=-created_at,id`,
      providerId,
    ) as Promise<Collection<ServiceReportAttributes>>,
  createReport: (
    providerId: string,
    jobId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<ServiceReportAttributes>>(
      `/service-jobs/${encodeURIComponent(jobId)}/reports`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  submitReport: (
    providerId: string,
    jobId: string,
    reportId: string,
    key: string,
  ) =>
    apiClient.request<Resource<ServiceReportAttributes>>(
      `/service-jobs/${encodeURIComponent(jobId)}/reports/${encodeURIComponent(reportId)}/submit`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify({}),
      },
      { providerId },
    ),
  proofs: (providerId: string, jobId: string) =>
    query(
      `/service-jobs/${encodeURIComponent(jobId)}/proofs?page[limit]=25&sort=-created_at,id`,
      providerId,
    ) as Promise<Collection<ServiceProofAttributes>>,
  workSessions: (providerId: string, agentId: string) =>
    query(
      `/agents/${encodeURIComponent(agentId)}/work-sessions?page[limit]=25&sort=-created_at,id`,
      providerId,
    ) as Promise<Collection<WorkSessionAttributes>>,
  startWorkSession: (
    providerId: string,
    agentId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<WorkSessionAttributes>>(
      `/agents/${encodeURIComponent(agentId)}/work-sessions`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  endWorkSession: (
    providerId: string,
    agentId: string,
    sessionId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<WorkSessionAttributes>>(
      `/agents/${encodeURIComponent(agentId)}/work-sessions/${encodeURIComponent(sessionId)}/end`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  pauseWorkSession: (
    providerId: string,
    agentId: string,
    sessionId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<WorkSessionAttributes>>(
      `/agents/${encodeURIComponent(agentId)}/work-sessions/${encodeURIComponent(sessionId)}/pause`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
  resumeWorkSession: (
    providerId: string,
    agentId: string,
    sessionId: string,
    body: Record<string, unknown>,
    key: string,
  ) =>
    apiClient.request<Resource<WorkSessionAttributes>>(
      `/agents/${encodeURIComponent(agentId)}/work-sessions/${encodeURIComponent(sessionId)}/resume`,
      {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      },
      { providerId },
    ),
};
