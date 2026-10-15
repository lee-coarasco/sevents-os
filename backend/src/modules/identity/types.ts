export type AppUserStatus = "pending" | "active" | "deactivated";

export interface AppUser {
  id: string;
  email: string;
  display_name: string | null;
  status: AppUserStatus;
  invited_by: string | null;
  invited_at: string;
  activated_at: string | null;
  deactivated_at: string | null;
}

export type AuditEventType =
  | "invited"
  | "invite_accepted"
  | "deactivated"
  | "sign_in"
  | "sign_out"
  | "sign_in_failed"
  | "password_reset_requested"
  | "password_reset_completed"
  | "mfa_enrolled"
  | "mfa_verified"
  | "mfa_verification_failed";

export interface AuditLogEntry {
  id: string;
  user_id: string | null;
  event_type: AuditEventType;
  metadata: Record<string, unknown>;
  created_at: string;
}
