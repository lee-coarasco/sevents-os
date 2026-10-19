import type { SupabaseClient } from '@supabase/supabase-js';
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

export type { CommunicationsRepository };

export function createSupabaseCommunicationsRepository(
  getUserScopedClient: (accessToken: string) => SupabaseClient
): CommunicationsRepository {
  return {
    // 1. Stakeholders
    async listStakeholders(accessToken: string, projectId?: string): Promise<Stakeholder[]> {
      const client = getUserScopedClient(accessToken);
      let query = client.from('stakeholders').select('*').order('name', { ascending: true });
      if (projectId) {
        query = query.eq('project_id', projectId);
      }
      const { data, error } = await query;
      if (error) throw new Error(`Failed to list stakeholders: ${error.message}`);
      return (data || []) as Stakeholder[];
    },

    async createStakeholder(accessToken: string, input: CreateStakeholderInput): Promise<Stakeholder> {
      const client = getUserScopedClient(accessToken);
      const { data, error } = await client
        .from('stakeholders')
        .insert({
          project_id: input.project_id || null,
          name: input.name,
          organization: input.organization,
          stakeholder_type: input.stakeholder_type || 'client',
          role_title: input.role_title,
          email: input.email || null,
          phone: input.phone || null,
          engagement_level: input.engagement_level || 'medium',
          notes: input.notes || null,
        })
        .select()
        .single();
      if (error) throw new Error(`Failed to create stakeholder: ${error.message}`);
      return data as Stakeholder;
    },

    async deleteStakeholder(accessToken: string, id: string): Promise<boolean> {
      const client = getUserScopedClient(accessToken);
      const { error } = await client.from('stakeholders').delete().eq('id', id);
      if (error) throw new Error(`Failed to delete stakeholder: ${error.message}`);
      return true;
    },

    // 2. Communication Logs
    async listCommunicationLogs(accessToken: string, projectId?: string): Promise<CommunicationLog[]> {
      const client = getUserScopedClient(accessToken);
      let query = client.from('communication_logs').select('*').order('created_at', { ascending: false });
      if (projectId) {
        query = query.eq('project_id', projectId);
      }
      const { data, error } = await query;
      if (error) throw new Error(`Failed to list communication logs: ${error.message}`);
      return (data || []) as CommunicationLog[];
    },

    async createCommunicationLog(accessToken: string, input: CreateCommunicationLogInput): Promise<CommunicationLog> {
      const client = getUserScopedClient(accessToken);
      const { data, error } = await client
        .from('communication_logs')
        .insert({
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
        })
        .select()
        .single();
      if (error) throw new Error(`Failed to create communication log: ${error.message}`);
      return data as CommunicationLog;
    },

    async updateCommunicationLogStatus(accessToken: string, id: string, status: CommunicationStatus): Promise<CommunicationLog | null> {
      const client = getUserScopedClient(accessToken);
      const { data, error } = await client
        .from('communication_logs')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .maybeSingle();
      if (error) throw new Error(`Failed to update communication log status: ${error.message}`);
      return data as CommunicationLog | null;
    },

    // 3. Meeting Minutes
    async listMeetingMinutes(accessToken: string, projectId?: string): Promise<MeetingMinutes[]> {
      const client = getUserScopedClient(accessToken);
      let query = client.from('meeting_minutes').select('*').order('meeting_date', { ascending: false });
      if (projectId) {
        query = query.eq('project_id', projectId);
      }
      const { data, error } = await query;
      if (error) throw new Error(`Failed to list meeting minutes: ${error.message}`);
      return (data || []) as MeetingMinutes[];
    },

    async createMeetingMinutes(accessToken: string, input: CreateMeetingMinutesInput): Promise<MeetingMinutes> {
      const client = getUserScopedClient(accessToken);
      const { data, error } = await client
        .from('meeting_minutes')
        .insert({
          project_id: input.project_id || null,
          meeting_title: input.meeting_title,
          meeting_type: input.meeting_type,
          meeting_date: input.meeting_date,
          location: input.location || null,
          attendees: input.attendees || [],
          summary: input.summary,
          action_items: input.action_items || [],
          status: input.status || 'draft',
        })
        .select()
        .single();
      if (error) throw new Error(`Failed to create meeting minutes: ${error.message}`);
      return data as MeetingMinutes;
    },

    async updateActionItemStatus(
      accessToken: string,
      meetingId: string,
      actionId: string,
      status: 'pending' | 'in_progress' | 'completed'
    ): Promise<MeetingMinutes | null> {
      const client = getUserScopedClient(accessToken);
      const { data: meeting, error: fetchErr } = await client
        .from('meeting_minutes')
        .select('*')
        .eq('id', meetingId)
        .maybeSingle();

      if (fetchErr || !meeting) return null;

      const actionItems = (meeting.action_items || []).map((action: any) =>
        action.id === actionId ? { ...action, status } : action
      );

      const { data, error } = await client
        .from('meeting_minutes')
        .update({ action_items: actionItems, updated_at: new Date().toISOString() })
        .eq('id', meetingId)
        .select()
        .maybeSingle();

      if (error) throw new Error(`Failed to update action item status: ${error.message}`);
      return data as MeetingMinutes | null;
    },

    // 4. Client Complaints
    async listComplaints(accessToken: string, projectId?: string): Promise<ClientComplaint[]> {
      const client = getUserScopedClient(accessToken);
      let query = client.from('client_complaints').select('*').order('created_at', { ascending: false });
      if (projectId) {
        query = query.eq('project_id', projectId);
      }
      const { data, error } = await query;
      if (error) throw new Error(`Failed to list complaints: ${error.message}`);
      return (data || []) as ClientComplaint[];
    },

    async createComplaint(accessToken: string, input: CreateClientComplaintInput): Promise<ClientComplaint> {
      const client = getUserScopedClient(accessToken);
      const { data, error } = await client
        .from('client_complaints')
        .insert({
          project_id: input.project_id || null,
          complaint_number: input.complaint_number,
          client_name: input.client_name,
          contact_info: input.contact_info || null,
          severity: input.severity,
          category: input.category,
          description: input.description,
          assigned_to: input.assigned_to || null,
          status: 'received',
        })
        .select()
        .single();
      if (error) throw new Error(`Failed to create client complaint: ${error.message}`);
      return data as ClientComplaint;
    },

    async resolveComplaint(accessToken: string, id: string, resolutionPlan: string): Promise<ClientComplaint | null> {
      const client = getUserScopedClient(accessToken);
      const { data, error } = await client
        .from('client_complaints')
        .update({
          resolution_plan: resolutionPlan,
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .maybeSingle();

      if (error) throw new Error(`Failed to resolve complaint: ${error.message}`);
      return data as ClientComplaint | null;
    },
  };
}
