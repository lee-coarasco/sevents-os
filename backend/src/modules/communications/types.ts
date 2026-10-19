export type StakeholderType = 'client' | 'consultant' | 'subcontractor' | 'authority' | 'community' | 'utility';
export type EngagementLevel = 'low' | 'medium' | 'high';

export interface Stakeholder {
  id: string;
  tenant_id: string;
  project_id?: string | null;
  name: string;
  organization: string;
  stakeholder_type: StakeholderType;
  role_title: string;
  email?: string | null;
  phone?: string | null;
  engagement_level: EngagementLevel;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export type CommunicationChannel = 'letter' | 'email' | 'site_instruction' | 'transmittal' | 'notice' | 'circular';
export type CommunicationDirection = 'inbound' | 'outbound';
export type CommunicationStatus = 'draft' | 'sent' | 'received' | 'closed';

export interface CommunicationLog {
  id: string;
  tenant_id: string;
  project_id?: string | null;
  reference_number: string;
  channel: CommunicationChannel;
  direction: CommunicationDirection;
  sender_name: string;
  recipient_name: string;
  subject: string;
  summary: string;
  requires_response: boolean;
  response_due_date?: string | null;
  status: CommunicationStatus;
  created_at: string;
  updated_at: string;
}

export type MeetingType = 'site_coordination' | 'client_review' | 'technical_clarification' | 'progress_meeting';
export type MeetingStatus = 'draft' | 'published';

export interface ActionItem {
  id: string;
  task: string;
  assignee: string;
  due_date: string;
  status: 'pending' | 'in_progress' | 'completed';
}

export interface MeetingMinutes {
  id: string;
  tenant_id: string;
  project_id?: string | null;
  meeting_title: string;
  meeting_type: MeetingType;
  meeting_date: string;
  location?: string | null;
  attendees: string[];
  summary: string;
  action_items: ActionItem[];
  status: MeetingStatus;
  created_at: string;
  updated_at: string;
}

export type ComplaintSeverity = 'low' | 'medium' | 'high' | 'critical';
export type ComplaintCategory = 'quality' | 'schedule' | 'safety' | 'billing' | 'conduct' | 'other';
export type ComplaintStatus = 'received' | 'investigating' | 'resolved' | 'closed';

export interface ClientComplaint {
  id: string;
  tenant_id: string;
  project_id?: string | null;
  complaint_number: string;
  client_name: string;
  contact_info?: string | null;
  severity: ComplaintSeverity;
  category: ComplaintCategory;
  description: string;
  resolution_plan?: string | null;
  status: ComplaintStatus;
  assigned_to?: string | null;
  resolved_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateStakeholderInput {
  project_id?: string | null;
  name: string;
  organization: string;
  stakeholder_type?: StakeholderType;
  role_title: string;
  email?: string | null;
  phone?: string | null;
  engagement_level?: EngagementLevel;
  notes?: string | null;
}

export interface CreateCommunicationLogInput {
  project_id?: string | null;
  reference_number: string;
  channel: CommunicationChannel;
  direction: CommunicationDirection;
  sender_name: string;
  recipient_name: string;
  subject: string;
  summary: string;
  requires_response?: boolean;
  response_due_date?: string | null;
  status?: CommunicationStatus;
}

export interface CreateMeetingMinutesInput {
  project_id?: string | null;
  meeting_title: string;
  meeting_type: MeetingType;
  meeting_date: string;
  location?: string | null;
  attendees?: string[];
  summary: string;
  action_items?: ActionItem[];
  status?: MeetingStatus;
}

export interface CreateClientComplaintInput {
  project_id?: string | null;
  complaint_number?: string;
  client_name: string;
  contact_info?: string | null;
  severity: ComplaintSeverity;
  category: ComplaintCategory;
  description: string;
  assigned_to?: string | null;
}

export interface CommunicationsRepository {
  // Stakeholders
  listStakeholders(accessToken: string, projectId?: string): Promise<Stakeholder[]>;
  createStakeholder(accessToken: string, input: CreateStakeholderInput): Promise<Stakeholder>;
  deleteStakeholder(accessToken: string, id: string): Promise<boolean>;

  // Communication Logs
  listCommunicationLogs(accessToken: string, projectId?: string): Promise<CommunicationLog[]>;
  createCommunicationLog(accessToken: string, input: CreateCommunicationLogInput): Promise<CommunicationLog>;
  updateCommunicationLogStatus(accessToken: string, id: string, status: CommunicationStatus): Promise<CommunicationLog | null>;

  // Meeting Minutes
  listMeetingMinutes(accessToken: string, projectId?: string): Promise<MeetingMinutes[]>;
  createMeetingMinutes(accessToken: string, input: CreateMeetingMinutesInput): Promise<MeetingMinutes>;
  updateActionItemStatus(accessToken: string, meetingId: string, actionId: string, status: 'pending' | 'in_progress' | 'completed'): Promise<MeetingMinutes | null>;

  // Client Complaints
  listComplaints(accessToken: string, projectId?: string): Promise<ClientComplaint[]>;
  createComplaint(accessToken: string, input: CreateClientComplaintInput): Promise<ClientComplaint>;
  resolveComplaint(accessToken: string, id: string, resolutionPlan: string): Promise<ClientComplaint | null>;
}
