import { executeHttpRequest } from '@sap-cloud-sdk/http-client';
import { randomUUID } from 'crypto';

const DESTINATION = { destinationName: 'RPT-2026-API' };

async function get(path) {
    const res = await executeHttpRequest(DESTINATION, {
        method: 'GET',
        url: path,
        headers: { 'Accept': 'application/json' }
    });
    return res.data;
}

async function post(path, body) {
    const res = await executeHttpRequest(DESTINATION, {
        method: 'POST',
        url: path,
        data: body,
        headers: { 'Content-Type': 'application/json' }
    });
    return res.data;
}

export default async function () {
    const { Vendors, Materials, HistoricalSummary } = this.entities;

    this.on('READ', Vendors, async (req) => {
        try {
            const data = await get('/api/v1/vendors');
            return data.vendors.map(v => ({
                vendor_id:      v.vendor_id,
                country:        v.country,
                otif_percent:   v.otif_percent,
                avg_delay_days: v.avg_delay_days,
                po_count:       0
            }));
        } catch (error) {
            req.error(502, `Backend API error: ${error.message}`);
        }
    });

    this.on('READ', Materials, async (req) => {
        try {
            const data = await get('/api/v1/materials');
            return data.materials.map(m => ({
                material_id:       m.material_id,
                material_group:    m.material_group,
                criticality_flag:  m.criticality_flag,
                alternative_count: m.alternative_suppliers?.length || 0
            }));
        } catch (error) {
            req.error(502, `Backend API error: ${error.message}`);
        }
    });

    this.on('READ', HistoricalSummary, async (req) => {
        try {
            const data = await get('/api/v1/historical/summary');
            return [{
                id:             '00000000-0000-0000-0000-000000000001',
                total_pos:      data.total_pos,
                green_count:    data.green_count,
                amber_count:    data.amber_count,
                red_count:      data.red_count,
                green_pct:      data.green_pct,
                amber_pct:      data.amber_pct,
                red_pct:        data.red_pct,
                avg_delay_days: data.avg_delay_days
            }];
        } catch (error) {
            req.error(502, `Backend API error: ${error.message}`);
        }
    });

    this.on('predictRisk', async (req) => {
        try {
            const payload = {
                vendor_id:              req.data.vendor_id,
                vendor_country:         req.data.vendor_country,
                vendor_otif_percent:    parseFloat(req.data.vendor_otif_percent),
                vendor_avg_past_delay:  parseFloat(req.data.vendor_avg_past_delay),
                material_id:            req.data.material_id,
                material_group:         req.data.material_group,
                criticality_flag:       req.data.criticality_flag,
                plant_id:               req.data.plant_id,
                order_quantity:         parseInt(req.data.order_quantity),
                net_price:              parseFloat(req.data.net_price),
                planned_lead_time_days: parseInt(req.data.planned_lead_time_days),
                order_month:            parseInt(req.data.order_month),
                incoterms:              req.data.incoterms
            };

            const result = await post('/api/v1/predict', payload);

            const capResponse = {
                risk: {
                    id:                   randomUUID(),
                    predicted_delay_days: result.risk_summary.predicted_delay_days,
                    risk_tier:            result.risk_summary.risk_tier,
                    action_level:         result.risk_summary.action_level,
                    recommendation:       result.risk_summary.recommendation,
                    is_critical:          result.risk_summary.is_critical,
                    avoided_loss_usd:     result.risk_summary.avoided_loss_usd
                },
                po_context: JSON.stringify(result.po_context)
            };

            if (result.mitigation && result.mitigation.status === 'PROPOSAL_READY') {
                capResponse.mitigation = {
                    proposal_id:            `MIT-${Date.now()}`,
                    status:                 result.mitigation.status,
                    recommended_vendor:     result.mitigation.recommended_alternative.vendor,
                    recommended_country:    result.mitigation.recommended_alternative.country,
                    recommended_lead_time:  result.mitigation.recommended_alternative.lead_time_days,
                    recommended_unit_price: result.mitigation.recommended_alternative.unit_price,
                    recommended_stock:      result.mitigation.recommended_alternative.stock_available,
                    can_fulfill:            result.mitigation.recommended_alternative.can_fulfill,
                    price_premium:          result.mitigation.financial_impact.price_premium,
                    avoided_loss:           result.mitigation.financial_impact.avoided_loss,
                    net_benefit:            result.mitigation.financial_impact.net_benefit
                };
            }

            return capResponse;
        } catch (error) {
            req.error(502, `Prediction failed: ${error.message}`);
        }
    });

    this.on('sendChatMessage', async (req) => {
        try {
            const payload = {
                message:    req.data.message,
                session_id: req.data.session_id || null,
                context:    req.data.context ? JSON.parse(req.data.context) : {}
            };

            const result = await post('/api/v1/chat', payload);

            return {
                reply:      result.reply,
                tool_trace: JSON.stringify(result.tool_trace || []),
                proposal:   result.proposal ? JSON.stringify(result.proposal) : null,
                session_id: result.session_id
            };
        } catch (error) {
            req.error(502, `Chat failed: ${error.message}`);
        }
    });
}
