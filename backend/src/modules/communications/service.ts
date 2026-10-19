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
} from './types.js';

export class CommunicationsService {
  constructor(private repo: CommunicationsRepository) {}

  // Stakeholders
  async listStakeholders(accessToken: string, projectId?: string): Promise<Stakeholder[]> {
    return this.repo.listStakeholders(accessToken, projectId);
  }

  async createStakeholder(accessToken: string, input: CreateStakeholderInput): Promise<Stakeholder> {
    if (!input.name || !input.organization || !input.role_title) {
      throw new Error('Name, organization, and role title are required');
    }
    return this.repo.createStakeholder(accessToken, input);
  }

  async deleteStakeholder(accessToken: string, id: string): Promise<boolean> {
    return this.repo.deleteStakeholder(accessToken, id);
  }

  // Communication Logs
  async listCommunicationLogs(accessToken: string, projectId?: string): Promise<CommunicationLog[]> {
    return this.repo.listCommunicationLogs(accessToken, projectId);
  }

  async createCommunicationLog(accessToken: string, input: CreateCommunicationLogInput): Promise<CommunicationLog> {
    if (!input.reference_number || !input.subject || !input.sender_name || !input.recipient_name) {
      throw new Error('Reference number, subject, sender, and recipient are required');
    }
    return this.repo.createCommunicationLog(accessToken, input);
  }

  async updateCommunicationLogStatus(
    accessToken: string,
    id: string,
    status: CommunicationStatus
  ): Promise<CommunicationLog> {
    const updated = await this.repo.updateCommunicationLogStatus(accessToken, id, status);
    if (!updated) {
      throw new Error('Communication log not found or unauthorized');
    }
    return updated;
  }

  // Meeting Minutes
  async listMeetingMinutes(accessToken: string, projectId?: string): Promise<MeetingMinutes[]> {
    return this.repo.listMeetingMinutes(accessToken, projectId);
  }

  async createMeetingMinutes(accessToken: string, input: CreateMeetingMinutesInput): Promise<MeetingMinutes> {
    if (!input.meeting_title || !input.meeting_date || !input.summary) {
      throw new Error('Meeting title, date, and summary are required');
    }

    const actionItems = (input.action_items || []).map((action, idx) => ({
      ...action,
      id: action.id || `act-${Date.now()}-${idx + 1}-${Math.random().toString(36).substring(2, 6)}`,
      status: action.status || 'pending',
    }));

    return this.repo.createMeetingMinutes(accessToken, {
      ...input,
      action_items: actionItems,
    });
  }

  async updateActionItemStatus(
    accessToken: string,
    meetingId: string,
    actionId: string,
    status: 'pending' | 'in_progress' | 'completed'
  ): Promise<MeetingMinutes> {
    const updated = await this.repo.updateActionItemStatus(accessToken, meetingId, actionId, status);
    if (!updated) {
      throw new Error('Meeting minutes or action item not found');
    }
    return updated;
  }

  // Client Complaints
  async listComplaints(accessToken: string, projectId?: string): Promise<ClientComplaint[]> {
    return this.repo.listComplaints(accessToken, projectId);
  }

  async createComplaint(accessToken: string, input: CreateClientComplaintInput): Promise<ClientComplaint> {
    if (!input.client_name || !input.description) {
      throw new Error('Client name and complaint description are required');
    }

    const complaintNumber =
      input.complaint_number || `CMP-${Date.now().toString().slice(-6)}`;

    return this.repo.createComplaint(accessToken, {
      ...input,
      complaint_number: complaintNumber,
    });
  }

  async resolveComplaint(
    accessToken: string,
    id: string,
    resolutionPlan: string
  ): Promise<ClientComplaint> {
    if (!resolutionPlan || resolutionPlan.trim().length === 0) {
      throw new Error('Resolution plan is required to resolve a complaint');
    }
    const resolved = await this.repo.resolveComplaint(accessToken, id, resolutionPlan);
    if (!resolved) {
      throw new Error('Complaint not found or unauthorized');
    }
    return resolved;
  }
}
