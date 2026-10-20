sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "jit/risk/model/api"
], function (Controller, MessageToast, API) {
    "use strict";

    return Controller.extend("jit.risk.controller.Dashboard", {
        onInit: function () {
            this._loadDashboardData();
        },

        _loadDashboardData: function () {
            const oDashboardModel = this.getOwnerComponent().getModel("dashboardModel");

            API.historicalSummary()
                .then(data => {
                    oDashboardModel.setData(data);
                })
                .catch(error => {
                    MessageToast.show("Failed to load dashboard data");
                    console.error(error);
                });
        }
    });
});
