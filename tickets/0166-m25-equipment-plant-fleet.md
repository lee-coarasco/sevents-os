---
id: 166
title: "M25: Equipment, Plant & Fleet Operations"
status: done
roles: [architect, backend-engineer, ui-designer, test-engineer]
priority: 1
created: 2026-10-18
updated: 2026-10-18
---

## Context
Per PRD Phase 5 (Procurement, Stores and Site Operations) and BRD M25 (Equipment, Plant & Fleet, source catalogue rows for Plant & Equipment Operator and Logistics Coordinator):
Heavy plant, construction machinery, and fleet vehicles represent critical operational assets and major cost drivers on construction projects (tower cranes, excavators, dumpers, transit mixers, generators, boom loaders, passenger buses).
Effective plant governance operates through four core operational pillars:
1. **Asset Register & Master Equipment Records**: Comprehensive asset cataloguing tracking asset code, serial/chassis number, asset category (`heavy_plant`, `earthmoving`, `lifting_rigging`, `power_generation`, `fleet_vehicle`, `small_tools`), ownership type (`owned`, `leased`, `hired`), operational status (`available`, `mobilized_on_site`, `under_maintenance`, `breakdown`, `decommissioned`), meter reading (hours/odometer), and daily charge-out hire rates.
2. **Site Mobilization & Allocation**: Project equipment requests, deployment/mobilization orders, on-site grid placement, transfer logs between projects/yards, and demobilization off-hire tracking.
3. **Daily Equipment Logs & Utilization**: Tracking daily operational hours, idle hours, breakdown downtime, operator assignment (`role.plant_equipment_operator`), fuel consumption (litres/gallons added), and work activity performed.
4. **Preventive Maintenance, Inspections & Statutory Certifications**: Maintenance service schedules (based on calendar intervals or running meter hours), service records, and mandatory statutory third-party safety calibration certificates (e.g., DAC/EIAC crane safe load indicator calibration, boom certification, roadworthiness registrations) with expiry alerting.

## Scope & Implementation Plan

### 1. Database Schema (`supabase/migrations/20261018000010_m25_equipment_plant_fleet.sql`)
- Tables:
  - `equipment_assets`:
    - `id`, `tenant_id`, `asset_code`, `name`, `category` (`heavy_plant`, `earthmoving`, `lifting_rigging`, `power_generation`, `fleet_vehicle`, `small_tools`), `make`, `model`, `year_of_manufacture`, `serial_or_vin`, `ownership_type` (`owned`, `leased`, `hired`), `hire_vendor_name`, `daily_rate`, `status` (`available`, `mobilized_on_site`, `under_maintenance`, `breakdown`, `decommissioned`), `current_meter_hours` (numeric default 0), `current_project_id`, `created_at`, `updated_at`.
  - `equipment_allocations`:
    - `id`, `tenant_id`, `equipment_id`, `project_id`, `allocation_number`, `mobilization_date`, `expected_demobilization_date`, `actual_demobilization_date`, `grid_location`, `status` (`requested`, `approved`, `mobilized`, `demobilized`), `requested_by`, `approved_by`, `notes`, `created_at`, `updated_at`.
  - `equipment_daily_logs`:
    - `id`, `tenant_id`, `equipment_id`, `project_id`, `log_date`, `operating_hours`, `idle_hours`, `breakdown_hours`, `start_meter_reading`, `end_meter_reading`, `fuel_added_litres`, `operator_name`, `work_description`, `supervisor_signoff`, `created_at`, `updated_at`.
  - `equipment_maintenance_records`:
    - `id`, `tenant_id`, `equipment_id`, `maintenance_type` (`preventive_service`, `breakdown_repair`, `safety_inspection`, `statutory_certification`), `maintenance_date`, `meter_hours_at_service`, `cost`, `performed_by`, `description`, `next_due_date`, `next_due_meter_hours`, `status` (`scheduled`, `completed`, `cancelled`), `created_at`, `updated_at`.
  - `equipment_statutory_certificates`:
    - `id`, `tenant_id`, `equipment_id`, `certificate_type` (`safe_working_load_3rd_party`, `lifting_tackle_inspection`, `registration_mulkiya`, `insurance_policy`, `emission_test`), `certificate_number`, `issuing_authority`, `issue_date`, `expiry_date`, `attachment_url`, `status` (`valid`, `expired`, `pending_renewal`), `created_at`, `updated_at`.
- Multi-tenant RLS isolation on all tables enforcing `tenant_id = public.current_tenant_id()`.
- Seed permissions in `public.permissions` using `(id, description)`:
  - `equipment.asset.manage`
  - `equipment.allocation.manage`
  - `equipment.allocation.approve`
  - `equipment.log.manage`
  - `equipment.maintenance.manage`
  - `equipment.certificate.manage`
- Assign permissions to `role.platform_administrator`, `role.plant_equipment_operator`, `role.logistics_coordinator`, `role.project_engineer_lead`, and `role.site_civil_engineer` in `public.role_permissions`.

### 2. Backend API (`backend/src/modules/equipment/`)
- Domain types, Supabase repository, and in-memory test fake.
- Service logic covering:
  - Asset cataloguing and fleet inventory CRUD.
  - Project mobilization / allocation lifecycle with authorization and demobilization.
  - Daily equipment utilization logs updating running meter hours automatically.
  - Preventive and corrective maintenance scheduling and cost tracking.
  - Statutory compliance certificates with active vs expired evaluation.
- Fastify routes mounted with permission guards.
- Route test suite (`equipment.routes.test.ts`) covering all endpoints and multi-tenant RLS isolation.

### 3. Frontend Screen (`frontend/src/pages/EquipmentPage.tsx`)
- Project-aware equipment management screen with 4 tabs:
  1. **Fleet & Plant Register**: Card/table view of all heavy equipment, status badges, meter hours, daily rates, and "+ Register Equipment" modal.
  2. **Mobilization & Allocations**: Active deployments by project/grid, pending requests, and "+ Mobilize Asset" modal / demobilize action.
  3. **Daily Equipment Logs**: Utilization records (run hours, idle hours, breakdown hours, fuel added) and "+ Log Shift Operations" modal.
  4. **Maintenance & Statutory Certs**: Service records, third-party certification register with validity badges (Valid vs Expired), and "+ Record Maintenance / Cert" modal.
- Wired route `/equipment` in `frontend/src/App.tsx` and sidebar navigation item in `frontend/src/components/AppLayout.tsx`.
- Test suite `EquipmentPage.test.tsx` verifying default render, tab switching, and actions.
