sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "jit/risk/model/api"
], function (Controller, MessageToast, MessageBox, API) {
    "use strict";

    const MONTH_NAMES = ["January","February","March","April","May","June",
                         "July","August","September","October","November","December"];

    return Controller.extend("jit.risk.controller.Predict", {
        onInit: function () {
            const oPredictionModel = this.getOwnerComponent().getModel("predictionModel");

            // Set default values
            oPredictionModel.setData({
                vendor_id: "VENDOR_C",
                material_id: "MAT-1002",
                order_quantity: 2200,
                order_month: 11,
                plant_id: "PLANT_1000",
                incoterms: "FOB",
                resultVisible: false,
                mitigationVisible: false,
                orderMonthState: "None",
                orderMonthStateText: ""
            });

            // Load vendors and materials
            this._loadVendors();
            this._loadMaterials();
        },

        _loadVendors: function () {
            const oVendorModel = this.getOwnerComponent().getModel("vendorModel");
            
            API.vendors()
                .then(data => {
                    oVendorModel.setData(data);
                })
                .catch(error => {
                    MessageToast.show("Failed to load vendors");
                    console.error(error);
                });
        },

        _loadMaterials: function () {
            const oMaterialModel = this.getOwnerComponent().getModel("materialModel");
            
            API.materials()
                .then(data => {
                    oMaterialModel.setData(data);
                })
                .catch(error => {
                    MessageToast.show("Failed to load materials");
                    console.error(error);
                });
        },

        onVendorChange: function (oEvent) {
            const oSelectedItem = oEvent.getParameter("selectedItem");
            if (!oSelectedItem) return;
            const sVendorId = oSelectedItem.getKey();
            const oVendorModel = this.getOwnerComponent().getModel("vendorModel");
            const oPredictionModel = this.getOwnerComponent().getModel("predictionModel");
            
            // Find vendor details
            const aVendors = oVendorModel.getProperty("/vendors") || [];
            const oVendor = aVendors.find(v => v.vendor_id === sVendorId);
            
            if (oVendor) {
                oPredictionModel.setProperty("/vendor_country", oVendor.country);
                oPredictionModel.setProperty("/vendor_otif_percent", oVendor.otif_percent);
                oPredictionModel.setProperty("/vendor_avg_past_delay", oVendor.avg_delay_days);
            }
        },

        onMaterialChange: function (oEvent) {
            const oSelectedItem = oEvent.getParameter("selectedItem");
            if (!oSelectedItem) return;
            const sMaterialId = oSelectedItem.getKey();
            const oMaterialModel = this.getOwnerComponent().getModel("materialModel");
            const oPredictionModel = this.getOwnerComponent().getModel("predictionModel");
            
            // Find material details
            const aMaterials = oMaterialModel.getProperty("/materials") || [];
            const oMaterial = aMaterials.find(m => m.material_id === sMaterialId);
            
            if (oMaterial) {
                oPredictionModel.setProperty("/material_group", oMaterial.material_group);
                oPredictionModel.setProperty("/criticality_flag", oMaterial.criticality_flag);
            }
        },

        onOrderMonthChange: function (oEvent) {
            const oSelectedItem = oEvent.getParameter("selectedItem");
            if (!oSelectedItem) { return; }
            this._validateOrderMonth(parseInt(oSelectedItem.getKey()));
        },

        _validateOrderMonth: function (iMonth) {
            const oPredictionModel = this.getOwnerComponent().getModel("predictionModel");
            const iCurrentMonth = new Date().getMonth() + 1;

            if (iMonth < iCurrentMonth) {
                oPredictionModel.setProperty("/orderMonthState", "Error");
                oPredictionModel.setProperty("/orderMonthStateText",
                    MONTH_NAMES[iMonth - 1] + " is in the past. Order cannot be processed.");
                return false;
            }
            oPredictionModel.setProperty("/orderMonthState", "None");
            oPredictionModel.setProperty("/orderMonthStateText", "");
            return true;
        },

        onRunPrediction: function () {
            const oPredictionModel = this.getOwnerComponent().getModel("predictionModel");
            const oData = oPredictionModel.getData();

            // Block past months
            if (!this._validateOrderMonth(parseInt(oData.order_month))) {
                MessageBox.error(
                    "Order cannot be processed.\n\n" +
                    MONTH_NAMES[parseInt(oData.order_month) - 1] +
                    " is in the past. Please select the current month or a future month.",
                    { title: "Invalid Order Month" }
                );
                return;
            }

            const oPayload = {
                vendor_id: oData.vendor_id,
                vendor_country: oData.vendor_country || "Vietnam",
                vendor_otif_percent: parseFloat(oData.vendor_otif_percent || 82.0),
                vendor_avg_past_delay: parseFloat(oData.vendor_avg_past_delay || 3.0),
                material_id: oData.material_id,
                material_group: oData.material_group || "Control Chip",
                criticality_flag: oData.criticality_flag || "Yes",
                plant_id: oData.plant_id,
                order_quantity: parseInt(oData.order_quantity),
                net_price: parseFloat(oData.net_price || 195.5),
                planned_lead_time_days: parseInt(oData.planned_lead_time_days || 9),
                order_month: parseInt(oData.order_month),
                incoterms: oData.incoterms
            };

            MessageToast.show("Running prediction...");

            API.predict(oPayload)
                .then(result => {
                    // Update prediction result
                    oPredictionModel.setProperty("/predicted_delay_days", result.risk_summary.predicted_delay_days);
                    oPredictionModel.setProperty("/risk_tier", result.risk_summary.risk_tier);
                    oPredictionModel.setProperty("/action_level", result.risk_summary.action_level);
                    oPredictionModel.setProperty("/recommendation", result.risk_summary.recommendation);
                    oPredictionModel.setProperty("/resultVisible", true);

                    // Update mitigation if present
                    if (result.mitigation && result.mitigation.status === "PROPOSAL_READY") {
                        oPredictionModel.setProperty("/mitigation", {
                            recommended_vendor: result.mitigation.recommended_alternative.vendor,
                            recommended_country: result.mitigation.recommended_alternative.country,
                            recommended_lead_time: result.mitigation.recommended_alternative.lead_time_days,
                            recommended_unit_price: result.mitigation.recommended_alternative.unit_price,
                            recommended_stock: result.mitigation.recommended_alternative.stock_available,
                            can_fulfill: result.mitigation.recommended_alternative.can_fulfill,
                            price_premium: result.mitigation.financial_impact.price_premium,
                            net_benefit: result.mitigation.financial_impact.net_benefit
                        });
                        oPredictionModel.setProperty("/mitigationVisible", true);
                    } else {
                        oPredictionModel.setProperty("/mitigationVisible", false);
                    }

                    MessageToast.show("Prediction complete");
                })
                .catch(error => {
                    MessageToast.show("Prediction failed");
                    console.error(error);
                });
        },

        onApproveMitigation: function () {
            MessageToast.show("Mitigation approved (workflow integration required)");
        },

        onRejectMitigation: function () {
            MessageToast.show("Mitigation rejected");
        }
    });
});
