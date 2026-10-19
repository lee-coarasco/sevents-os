import type {
  CommunicationsRepository,
  Stakeholder,
  CommunicationLog,
  MeetingMinutes,
  ClientComplaint,
  CreateStakeholderInput,
  CreateCommunicationLogInput,
  CreateMeetingMinutesInput,
  CreateClientComplaintInput,
  CommunicationStatus,
} from '../modules/communications/types.js';

export class FakeCommunicationsRepository implements CommunicationsRepository {
  private sessions = new Map<string, { userId: string; tenantId: string }>();

  public stakeholders: Stakeholder[] = [];
  public communicationLogs: CommunicationLog[] = [];
  public meetingMinutes: MeetingMinutes[] = [];
  public clientComplaints: ClientComplaint[] = [];

  addSession(token: string, userId: string, tenantId: string) {
    this.sessions.set(token, { userId, tenantId });
  }

  private resolveTenant(token: string): string {
    const s = this.sessions.get(token);
    if (!s) throw new Error('Unauthorized token');
    return s.tenantId;
  }

  async listStakeholders(accessToken: string, projectId?: string): Promise<Stakeholder[]> {
    const tenantId = this.resolveTenant(accessToken);
    return this.stakeholders.filter(
      (s) => s.tenant_id === tenantId && (!projectId || s.project_id === projectId)
    );
  }

  async createStakeholder(accessToken: string, input: CreateStakeholderInput): Promise<Stakeholder> {
    const tenantId = this.resolveTenant(accessToken);
    const record: Stakeholder = {
      id: `sh-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      tenant_id: tenantId,
      project_id: input.project_id || null,
      name: input.name,
      organization: input.organization,
      stakeholder_type: input.stakeholder_type || 'client',
      role_title: input.role_title,
      email: input.email || null,
      phone: input.phone || null,
      engagement_level: input.engagement_level || 'medium',
      notes: input.notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.stakeholders.push(record);
    return record;
  }

  async deleteStakeholder(accessToken: string, id: string): Promise<boolean> {
    const tenantId = this.resolveTenant(accessToken);
    const idx = this.stakeholders.findIndex((s) => s.tenant_id === tenantId && s.id === id);
    if (idx === -1) return false;
    this.stakeholders.splice(idx, 1);
    return true;
  }

  async listCommunicationLogs(accessToken: string, projectId?: string): Promise<CommunicationLog[]> {
    const tenantId = this.resolveTenant(accessToken);
    return this.communicationLogs.filter(
      (c) => c.tenant_id === tenantId && (!projectId || c.project_id === projectId)
    );
  }

  async createCommunicationLog(accessToken: string, input: CreateCommunicationLogInput): Promise<CommunicationLog> {
    const tenantId = this.resolveTenant(accessToken);
    const record: CommunicationLog = {
      id: `comm-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      tenant_id: tenantId,
      project_id: input.project_id || null,
      reference_number: input.reference_number,
      channel: input.channel,
      direction: input.direction,
      sender_name: input.sender_name,
      recipient_name: input.recipient_name,
      subject: input.subject,
      summary: input.summary,
      requires_response: !!input.requires_response,
      response_due_date: input.response_due_date || null,
      status: input.status || 'draft',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.communicationLogs.push(record);
    return record;
  }

  async updateCommunicationLogStatus(
    accessToken: string,
    id: string,
    status: CommunicationStatus
  ): Promise<CommunicationLog | null> {
    const tenantId = this.resolveTenant(accessToken);
    const item = this.communicationLogs.find((c) => c.tenant_id === tenantId && c.id === id);
    if (!item) return null;
    item.status = status;
    item.updated_at = new Date().toISOString();
    return item;
  }

  async listMeetingMinutes(accessToken: string, projectId?: string): Promise<MeetingMinutes[]> {
    const tenantId = this.resolveTenant(accessToken);
    return this.meetingMinutes.filter(
      (m) => m.tenant_id === tenantId && (!projectId || m.project_id === projectId)
    );
  }

  async createMeetingMinutes(accessToken: string, input: CreateMeetingMinutesInput): Promise<MeetingMinutes> {
    const tenantId = this.resolveTenant(accessToken);
    const record: MeetingMinutes = {
      id: `mom-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      tenant_id: tenantId,
      project_id: input.project_id || null,
      meeting_title: input.meeting_title,
      meeting_type: input.meeting_type,
      meeting_date: input.meeting_date,
      location: input.location || null,
      attendees: input.attendees || [],
      summary: input.summary,
      action_items: input.action_items || [],
      status: input.status || 'draft',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.meetingMinutes.push(record);
    return record;
  }

  async updateActionItemStatus(
    accessToken: string,
    meetingId: string,
    actionId: string,
    status: 'pending' | 'in_progress' | 'completed'
  ): Promise<MeetingMinutes | null> {
    const tenantId = this.resolveTenant(accessToken);
    const meeting = this.meetingMinutes.find((m) => m.tenant_id === tenantId && m.id === meetingId);
    if (!meeting) return null;

    meeting.action_items = meeting.action_items.map((a) =>
      a.id === actionId ? { ...a, status } : a
    );
    meeting.updated_at = new Date().toISOString();
    return meeting;
  }

  async listComplaints(accessToken: string, projectId?: string): Promise<ClientComplaint[]> {
    const tenantId = this.resolveTenant(accessToken);
    return this.clientComplaints.filter(
      (c) => c.tenant_id === tenantId && (!projectId || c.project_id === projectId)
    );
  }

  async createComplaint(accessToken: string, input: CreateClientComplaintInput): Promise<ClientComplaint> {
    const tenantId = this.resolveTenant(accessToken);
    const record: ClientComplaint = {
      id: `cc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      tenant_id: tenantId,
      project_id: input.project_id || null,
      complaint_number: input.complaint_number || `CMP-${Math.floor(1000 + Math.random() * 9000)}`,
      client_name: input.client_name,
      contact_info: input.contact_info || null,
      severity: input.severity,
      category: input.category,
      description: input.description,
      resolution_plan: null,
      status: 'received',
      assigned_to: input.assigned_to || null,
      resolved_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.clientComplaints.push(record);
    return record;
  }

  async resolveComplaint(
    accessToken: string,
    id: string,
    resolutionPlan: string
  ): Promise<ClientComplaint | null> {
    const tenantId = this.resolveTenant(accessToken);
    const item = this.clientComplaints.find((c) => c.tenant_id === tenantId && c.id === id);
    if (!item) return null;
    item.resolution_plan = resolutionPlan;
    item.status = 'resolved';
    item.resolved_at = new Date().toISOString();
    item.updated_at = new Date().toISOString();
    return item;
  }
}
