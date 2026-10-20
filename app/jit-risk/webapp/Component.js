sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/ui/model/json/JSONModel"
], function (UIComponent, JSONModel) {
    "use strict";

    return UIComponent.extend("jit.risk.Component", {
        metadata: {
            manifest: "json"
        },

        init: function () {
            UIComponent.prototype.init.apply(this, arguments);

            // UI state models — populated by controllers, not the CAP service
            this.setModel(new JSONModel(), "vendorModel");
            this.setModel(new JSONModel(), "materialModel");
            this.setModel(new JSONModel(), "dashboardModel");
            this.setModel(new JSONModel({
                resultVisible: false,
                mitigationVisible: false
            }), "predictionModel");
            this.setModel(new JSONModel({
                messages: [],
                currentState: "WELCOME",
                predictionData: {},
                vendors: [],
                materials: []
            }), "chatModel");
        }
    });
});
