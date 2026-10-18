import type {
  ContractsRepository,
  Contract,
  VariationOrder,
  ContractClaim,
  ContractSecurity,
  CreateContractInput,
  CreateVariationInput,
  ApproveVariationInput,
  CreateClaimInput,
  AssessClaimInput,
  CreateSecurityInput,
  SecurityStatus,
} from "./types.js";

export class ContractsService {
  constructor(private repo: ContractsRepository) {}

  // 1. Contracts
  async listContracts(accessToken: string, projectId?: string): Promise<Contract[]> {
    return this.repo.listContracts(accessToken, projectId);
  }

  async getContractById(accessToken: string, id: string): Promise<Contract | null> {
    return this.repo.getContractById(accessToken, id);
  }

  async createContract(accessToken: string, input: CreateContractInput): Promise<Contract> {
    const origVal = Number(input.original_value) || 0;
    return this.repo.createContract(accessToken, {
      ...input,
      original_value: origVal,
      revised_value: origVal,
      revised_completion_date: input.contractual_completion_date,
    });
  }

  // 2. Variations
  async listVariations(
    accessToken: string,
    projectId?: string,
    contractId?: string
  ): Promise<VariationOrder[]> {
    return this.repo.listVariations(accessToken, projectId, contractId);
  }

  async createVariation(accessToken: string, input: CreateVariationInput): Promise<VariationOrder> {
    return this.repo.createVariation(accessToken, input);
  }

  async approveVariation(
    accessToken: string,
    id: string,
    input: ApproveVariationInput
  ): Promise<VariationOrder> {
    const existing = await this.repo.getVariationById(accessToken, id);
    if (!existing) {
      throw new Error(`Variation order ${id} not found`);
    }

    const approvedCost = Number(input.approved_cost_amount) || 0;
    const approvedDays = Number(input.approved_time_days) || 0;

    const updated = await this.repo.updateVariation(accessToken, id, {
      status: "approved",
      approved_cost_amount: approvedCost,
      approved_time_days: approvedDays,
      approved_by: input.approved_by,
      approved_at: new Date().toISOString(),
    });

    if (!updated) {
      throw new Error(`Failed to approve variation ${id}`);
    }

    // Roll up to parent contract
    const contract = await this.repo.getContractById(accessToken, existing.contract_id);
    if (contract) {
      const newRevisedValue = Number(contract.revised_value) + approvedCost;
      let newRevisedDate = contract.revised_completion_date;

      if (approvedDays > 0) {
        const d = new Date(contract.revised_completion_date);
        d.setDate(d.getDate() + approvedDays);
        newRevisedDate = d.toISOString().split("T")[0]!;
      }

      await this.repo.updateContract(accessToken, contract.id, {
        revised_value: newRevisedValue,
        revised_completion_date: newRevisedDate,
      });
    }

    return updated;
  }

  // 3. Claims & EOT
  async listClaims(
    accessToken: string,
    projectId?: string,
    contractId?: string
  ): Promise<ContractClaim[]> {
    return this.repo.listClaims(accessToken, projectId, contractId);
  }

  async createClaim(accessToken: string, input: CreateClaimInput): Promise<ContractClaim> {
    // FIDIC 28-day notice rule: Notice of Claim must be given within 28 days of event
    const eventDate = new Date(input.event_date);
    const deadlineDateObj = new Date(eventDate);
    deadlineDateObj.setDate(deadlineDateObj.getDate() + 28);
    const noticeDeadline = deadlineDateObj.toISOString().split("T")[0]!;

    let assessmentNotes = input.assessment_notes || "";
    if (input.notice_date > noticeDeadline) {
      const warning = "[FIDIC Cl. 20.1 Notice Warning: Notice issued after 28-day time bar]";
      assessmentNotes = assessmentNotes ? `${assessmentNotes} ${warning}` : warning;
    }

    return this.repo.createClaim(accessToken, {
      ...input,
      notice_deadline_date: noticeDeadline,
      assessment_notes: assessmentNotes || undefined,
    });
  }

  async assessClaim(
    accessToken: string,
    id: string,
    input: AssessClaimInput
  ): Promise<ContractClaim> {
    const existing = await this.repo.getClaimById(accessToken, id);
    if (!existing) {
      throw new Error(`Contract claim ${id} not found`);
    }

    const updated = await this.repo.updateClaim(accessToken, id, {
      certified_days: Number(input.certified_days) || 0,
      certified_cost_amount: Number(input.certified_cost_amount) || 0,
      status: input.status,
      assessment_notes: input.assessment_notes || existing.assessment_notes,
    });

    if (!updated) {
      throw new Error(`Failed to update claim ${id}`);
    }

    // If claim granted an extension of time and is approved, update parent contract completion date
    if (input.status === "approved" && input.certified_days > 0) {
      const contract = await this.repo.getContractById(accessToken, existing.contract_id);
      if (contract) {
        const d = new Date(contract.revised_completion_date);
        d.setDate(d.getDate() + Number(input.certified_days));
        const newRevisedDate = d.toISOString().split("T")[0]!;

        await this.repo.updateContract(accessToken, contract.id, {
          revised_completion_date: newRevisedDate,
        });
      }
    }

    return updated;
  }

  // 4. Securities
  async listSecurities(
    accessToken: string,
    projectId?: string,
    contractId?: string
  ): Promise<ContractSecurity[]> {
    return this.repo.listSecurities(accessToken, projectId, contractId);
  }

  async createSecurity(accessToken: string, input: CreateSecurityInput): Promise<ContractSecurity> {
    return this.repo.createSecurity(accessToken, input);
  }

  async updateSecurityStatus(
    accessToken: string,
    id: string,
    status: SecurityStatus
  ): Promise<ContractSecurity> {
    const existing = await this.repo.getSecurityById(accessToken, id);
    if (!existing) {
      throw new Error(`Security record ${id} not found`);
    }

    const updated = await this.repo.updateSecurity(accessToken, id, { status });
    if (!updated) {
      throw new Error(`Failed to update security ${id}`);
    }
    return updated;
  }
}
