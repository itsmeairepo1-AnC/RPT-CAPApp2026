using { Currency } from '@sap/cds/common';

namespace jit.risk;

/**
 * Risk assessment summary for a single PO
 */
entity RiskSummary {
    key id                    : UUID;
        predicted_delay_days  : Decimal(10, 2);
        risk_tier             : String(10);  // Green, Amber, Red
        action_level          : String(20);  // NORMAL, ELEVATED, HIGH, CRITICAL
        recommendation        : String(500);
        is_critical           : Boolean;
        avoided_loss_usd      : Integer;
}

/**
 * Vendor performance statistics
 */
entity Vendor {
    key vendor_id        : String(20);
        country          : String(50);
        otif_percent     : Decimal(5, 2);
        avg_delay_days   : Decimal(10, 2);
        po_count         : Integer;
}

/**
 * Material with alternative suppliers
 */
entity Material {
    key material_id         : String(20);
        material_group      : String(100);
        criticality_flag    : String(3);  // Yes/No
        alternative_count   : Integer;
}

/**
 * Alternative supplier option
 */
entity AlternativeSupplier {
    key vendor           : String(20);
    key material_id      : String(20);
        country          : String(50);
        lead_time_days   : Integer;
        unit_price       : Decimal(10, 2);
        stock_available  : Integer;
        can_fulfill      : Boolean;
}

/**
 * Mitigation proposal
 */
entity MitigationProposal {
    key proposal_id              : String(50);
        status                   : String(20);
        recommended_vendor       : String(20);
        recommended_country      : String(50);
        recommended_lead_time    : Integer;
        recommended_unit_price   : Decimal(10, 2);
        recommended_stock        : Integer;
        can_fulfill              : Boolean;
        price_premium            : Decimal(10, 2);
        avoided_loss             : Integer;
        net_benefit              : Decimal(10, 2);
}

/**
 * Chat message for conversational assistant
 */
entity ChatMessage {
    key id          : UUID;
        message     : String(5000);
        session_id  : String(100);
        context     : String(5000);  // JSON context
        timestamp   : DateTime;
}

/**
 * Chat response from agent
 */
entity ChatResponse {
    key id          : UUID;
        reply       : String(5000);
        session_id  : String(100);
        tool_count  : Integer;
        has_proposal: Boolean;
        timestamp   : DateTime;
}

/**
 * Historical summary statistics
 */
entity HistoricalStats {
    key id              : UUID;
        total_pos       : Integer;
        green_count     : Integer;
        amber_count     : Integer;
        red_count       : Integer;
        green_pct       : Decimal(5, 2);
        amber_pct       : Decimal(5, 2);
        red_pct         : Decimal(5, 2);
        avg_delay_days  : Decimal(10, 2);
}

type RiskSummaryResult {
    id                    : UUID;
    predicted_delay_days  : Decimal(10, 2);
    risk_tier             : String(10);
    action_level          : String(20);
    recommendation        : String(500);
    is_critical           : Boolean;
    avoided_loss_usd      : Integer;
}

type MitigationResult {
    proposal_id              : String(50);
    status                   : String(20);
    recommended_vendor       : String(20);
    recommended_country      : String(50);
    recommended_lead_time    : Integer;
    recommended_unit_price   : Decimal(10, 2);
    recommended_stock        : Integer;
    can_fulfill              : Boolean;
    price_premium            : Decimal(10, 2);
    avoided_loss             : Integer;
    net_benefit              : Decimal(10, 2);
}

/**
 * Service exposing risk assessment and chat capabilities
 */
service JitRiskService {
    
    // Read-only entities
    entity Vendors as projection on Vendor;
    entity Materials as projection on Material;
    entity HistoricalSummary as projection on HistoricalStats;
    
    // Actions
    action predictRisk(
        vendor_id: String,
        vendor_country: String,
        vendor_otif_percent: Decimal,
        vendor_avg_past_delay: Decimal,
        material_id: String,
        material_group: String,
        criticality_flag: String,
        plant_id: String,
        order_quantity: Integer,
        net_price: Decimal,
        planned_lead_time_days: Integer,
        order_month: Integer,
        incoterms: String
    ) returns {
        risk: RiskSummaryResult;
        mitigation: MitigationResult;
        po_context: String;  // JSON
    };
    
    action sendChatMessage(
        message: String,
        session_id: String,
        context: String  // JSON
    ) returns {
        reply: String;
        tool_trace: String;  // JSON array
        proposal: String;    // JSON
        session_id: String;
    };
}
