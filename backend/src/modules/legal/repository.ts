import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  LegalRepository,
  LicencePermit,
  LegalMatter,
  ExternalCounsel,
  ComplianceObligation,
  CreateLicenceInput,
  RenewLicenceInput,
  CreateLegalMatterInput,
  CreateExternalCounselInput,
  CreateComplianceObligationInput,
  FileObligationInput,
  LicenceStatus,
  MatterStatus,
} from './types.js';

export type { LegalRepository };

export function createSupabaseLegalRepository(
  getUserScopedClient: (accessToken: string) => SupabaseClient
): LegalRepository {
  return {
    // 1. Licences & Permits
    async listLicences(accessToken: string, projectId?: string): Promise<LicencePermit[]> {
      const client = getUserScopedClient(accessToken);
      let query = client.from('licences_permits').select('*').order('expiry_date', { ascending: true });
      if (projectId) {
        query = query.eq('project_id', projectId);
      }
      const { data, error } = await query;
      if (error) throw new Error(`Failed to list licences: ${error.message}`);
      return (data || []) as LicencePermit[];
    },

    async createLicence(accessToken: string, input: CreateLicenceInput & { status: LicenceStatus }): Promise<LicencePermit> {
      const client = getUserScopedClient(accessToken);
      const { data, error } = await client
        .from('licences_permits')
        .insert({
          project_id: input.project_id || null,
          licence_name: input.licence_name,
          licence_number: input.licence_number,
          category: input.category,
          issuing_authority: input.issuing_authority,
          issue_date: input.issue_date,
          expiry_date: input.expiry_date,
          renewal_lead_days: input.renewal_lead_days ?? 30,
          status: input.status,
          responsible_officer: input.responsible_officer,
          renewal_cost: input.renewal_cost ?? 0,
          document_url: input.document_url || null,
          notes: input.notes || null,
        })
        .select()
        .single();

      if (error) throw new Error(`Failed to create licence: ${error.message}`);
      return data as LicencePermit;
    },

    async renewLicence(accessToken: string, id: string, input: RenewLicenceInput): Promise<LicencePermit | null> {
      const client = getUserScopedClient(accessToken);
      const updates: any = {
        expiry_date: input.new_expiry_date,
        status: 'active',
        updated_at: new Date().toISOString(),
      };
      if (input.renewal_cost !== undefined) {
        updates.renewal_cost = input.renewal_cost;
      }
      if (input.notes) {
        updates.notes = input.notes;
      }

      const { data, error } = await client
        .from('licences_permits')
        .update(updates)
        .eq('id', id)
        .select()
        .maybeSingle();

      if (error) throw new Error(`Failed to renew licence: ${error.message}`);
      return data as LicencePermit | null;
    },

    // 2. Legal Matters
    async listMatters(accessToken: string, canViewPrivileged: boolean, projectId?: string): Promise<LegalMatter[]> {
      const client = getUserScopedClient(accessToken);
      let query = client.from('legal_matters').select('*').order('created_at', { ascending: false });
      if (projectId) {
        query = query.eq('project_id', projectId);
      }
      if (!canViewPrivileged) {
        query = query.neq('access_class', 'privileged_confidential');
      }
      const { data, error } = await query;
      if (error) throw new Error(`Failed to list legal matters: ${error.message}`);
      return (data || []) as LegalMatter[];
    },

    async createMatter(accessToken: string, input: CreateLegalMatterInput): Promise<LegalMatter> {
      const client = getUserScopedClient(accessToken);
      const { data, error } = await client
        .from('legal_matters')
        .insert({
          project_id: input.project_id || null,
          matter_reference: input.matter_reference,
          title: input.title,
          matter_type: input.matter_type,
          court_or_tribunal: input.court_or_tribunal,
          claim_amount: input.claim_amount ?? 0,
          currency: input.currency || 'AED',
          opposing_party: input.opposing_party,
          risk_level: input.risk_level || 'medium',
          access_class: input.access_class || 'internal',
          internal_counsel: input.internal_counsel,
          status: input.status || 'open',
          summary: input.summary,
        })
        .select()
        .single();

      if (error) throw new Error(`Failed to create legal matter: ${error.message}`);
      return data as LegalMatter;
    },

    async updateMatterStatus(accessToken: string, id: string, status: MatterStatus): Promise<LegalMatter | null> {
      const client = getUserScopedClient(accessToken);
      const { data, error } = await client
        .from('legal_matters')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .maybeSingle();

      if (error) throw new Error(`Failed to update legal matter status: ${error.message}`);
      return data as LegalMatter | null;
    },

    // 3. External Counsel
    async listCounsel(accessToken: string): Promise<ExternalCounsel[]> {
      const client = getUserScopedClient(accessToken);
      const { data, error } = await client.from('external_counsel').select('*').order('firm_name', { ascending: true });
      if (error) throw new Error(`Failed to list external counsel: ${error.message}`);
      return (data || []) as ExternalCounsel[];
    },

    async createCounsel(accessToken: string, input: CreateExternalCounselInput): Promise<ExternalCounsel> {
      const client = getUserScopedClient(accessToken);
      const { data, error } = await client
        .from('external_counsel')
        .insert({
          firm_name: input.firm_name,
          lead_attorney: input.lead_attorney,
          email: input.email || null,
          phone: input.phone || null,
          specialization: input.specialization,
          fee_arrangement: input.fee_arrangement,
          budget_amount: input.budget_amount ?? 0,
          billed_amount: input.billed_amount ?? 0,
          currency: input.currency || 'AED',
          status: 'active',
          notes: input.notes || null,
        })
        .select()
        .single();

      if (error) throw new Error(`Failed to register external counsel: ${error.message}`);
      return data as ExternalCounsel;
    },

    async updateCounselBilling(accessToken: string, id: string, billedAmount: number): Promise<ExternalCounsel | null> {
      const client = getUserScopedClient(accessToken);
      const { data, error } = await client
        .from('external_counsel')
        .update({ billed_amount: billedAmount, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .maybeSingle();

      if (error) throw new Error(`Failed to update counsel billing: ${error.message}`);
      return data as ExternalCounsel | null;
    },

    // 4. Compliance Obligations
    async listObligations(accessToken: string): Promise<ComplianceObligation[]> {
      const client = getUserScopedClient(accessToken);
      const { data, error } = await client.from('compliance_obligations').select('*').order('deadline_date', { ascending: true });
      if (error) throw new Error(`Failed to list compliance obligations: ${error.message}`);
      return (data || []) as ComplianceObligation[];
    },

    async createObligation(accessToken: string, input: CreateComplianceObligationInput): Promise<ComplianceObligation> {
      const client = getUserScopedClient(accessToken);
      const { data, error } = await client
        .from('compliance_obligations')
        .insert({
          obligation_name: input.obligation_name,
          regulatory_body: input.regulatory_body,
          frequency: input.frequency,
          deadline_date: input.deadline_date,
          compliance_owner: input.compliance_owner,
          status: 'pending',
          evidence_reference: input.evidence_reference || null,
          notes: input.notes || null,
        })
        .select()
        .single();

      if (error) throw new Error(`Failed to create compliance obligation: ${error.message}`);
      return data as ComplianceObligation;
    },

    async fileObligation(accessToken: string, id: string, input: FileObligationInput): Promise<ComplianceObligation | null> {
      const client = getUserScopedClient(accessToken);
      const { data, error } = await client
        .from('compliance_obligations')
        .update({
          evidence_reference: input.evidence_reference,
          filing_date: input.filing_date || new Date().toISOString().split('T')[0],
          status: 'filed',
          notes: input.notes || undefined,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .maybeSingle();

      if (error) throw new Error(`Failed to file compliance obligation: ${error.message}`);
      return data as ComplianceObligation | null;
    },
  };
}
