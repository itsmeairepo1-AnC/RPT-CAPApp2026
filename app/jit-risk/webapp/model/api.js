sap.ui.define([], function () {
    "use strict";

    const CAP_BASE = "/odata/v4/jit-risk";

    // Map OData v4 response (value array) to the shapes controllers expect
    function oDataList(url) {
        return fetch(url, { headers: { "Accept": "application/json" } })
            .then(r => r.json())
            .then(d => d.value || []);
    }

    return {
        vendors: function () {
            return oDataList(`${CAP_BASE}/Vendors`)
                .then(function (vendors) {
                    // map OData field names to what controllers expect
                    return {
                        vendors: vendors.map(function (v) {
                            return {
                                vendor_id: v.vendor_id,
                                country: v.country,
                                otif_percent: v.otif_percent,
                                avg_delay_days: v.avg_delay_days
                            };
                        })
                    };
                });
        },

        materials: function () {
            return oDataList(`${CAP_BASE}/Materials`)
                .then(function (materials) {
                    return {
                        materials: materials.map(function (m) {
                            return {
                                material_id: m.material_id,
                                material_group: m.material_group,
                                criticality_flag: m.criticality_flag
                            };
                        })
                    };
                });
        },

        historicalSummary: function () {
            return oDataList(`${CAP_BASE}/HistoricalSummary`)
                .then(function (rows) {
                    // HistoricalSummary has a single row; flatten to the top-level shape
                    // dashboardModel expects: total_pos, green_count, amber_count, red_count,
                    // green_pct, amber_pct, red_pct, avg_delay_days, vendor_stats[]
                    // vendor_stats come from Vendors endpoint separately
                    return rows[0] || {};
                })
                .then(function (summary) {
                    // Fetch vendor stats to attach
                    return oDataList(`${CAP_BASE}/Vendors`).then(function (vendors) {
                        return {
                            total_pos: summary.total_pos,
                            green_count: summary.green_count,
                            amber_count: summary.amber_count,
                            red_count: summary.red_count,
                            green_pct: summary.green_pct,
                            amber_pct: summary.amber_pct,
                            red_pct: summary.red_pct,
                            avg_delay_days: summary.avg_delay_days,
                            vendor_stats: vendors.map(function (v) {
                                return {
                                    vendor_id: v.vendor_id,
                                    country: v.country,
                                    otif_percent: v.otif_percent,
                                    avg_delay_days: v.avg_delay_days,
                                    po_count: v.po_count || 0
                                };
                            })
                        };
                    });
                });
        },

        predict: function (payload) {
            // CAP exposes predictRisk as an unbound OData action
            return fetch(`${CAP_BASE}/predictRisk`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            })
            .then(function (r) { return r.json(); })
            .then(function (d) {
                // CAP action returns { risk: {...}, mitigation: {...}, po_context: "..." }
                // Map back to the shape controllers expect from Python API:
                // { risk_summary: {...}, mitigation: {...}, po_context: {...} }
                var risk = d.risk || {};
                var mit  = d.mitigation;
                return {
                    risk_summary: {
                        predicted_delay_days: risk.predicted_delay_days,
                        risk_tier:            risk.risk_tier,
                        action_level:         risk.action_level,
                        recommendation:       risk.recommendation,
                        is_critical:          risk.is_critical,
                        avoided_loss_usd:     risk.avoided_loss_usd
                    },
                    mitigation: mit ? {
                        status: mit.status,
                        recommended_alternative: {
                            vendor:          mit.recommended_vendor,
                            country:         mit.recommended_country,
                            lead_time_days:  mit.recommended_lead_time,
                            unit_price:      mit.recommended_unit_price,
                            stock_available: mit.recommended_stock,
                            can_fulfill:     mit.can_fulfill
                        },
                        financial_impact: {
                            price_premium: mit.price_premium,
                            avoided_loss:  mit.avoided_loss,
                            net_benefit:   mit.net_benefit
                        }
                    } : null,
                    po_context: {}
                };
            });
        },

        chat: function (message, history, sessionId) {
            return fetch(`${CAP_BASE}/sendChatMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: message,
                    session_id: sessionId || null,
                    context: JSON.stringify({ history: history || [] })
                })
            }).then(function (r) { return r.json(); });
        }
    };
});
