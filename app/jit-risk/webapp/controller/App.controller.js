sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/mvc/XMLView"
], function (Controller, XMLView) {
    "use strict";

    return Controller.extend("jit.risk.controller.App", {

        _viewCache: {},

        onInit: function () {
            this._loadView("dashboard");
        },

        onTabSelect: function (oEvent) {
            const sKey = oEvent.getParameter("key");
            this._loadView(sKey);
        },

        _loadView: function (sKey) {
            const oIconTabBar = this.byId("idIconTabBar");
            const oSelectedTab = oIconTabBar.getItems().find(item => item.getKey() === sKey);
            if (!oSelectedTab) return;

            // Reuse cached view — avoids duplicate IDs on tab switch
            if (this._viewCache[sKey]) {
                oSelectedTab.removeAllContent();
                oSelectedTab.addContent(this._viewCache[sKey]);
                return;
            }

            const sViewName = sKey.charAt(0).toUpperCase() + sKey.slice(1);
            const oComponent = this.getOwnerComponent();

            // runAsOwner ensures the new view inherits component models
            oComponent.runAsOwner(() => {
                XMLView.create({
                    viewName: "jit.risk.view." + sViewName
                }).then((oView) => {
                    this._viewCache[sKey] = oView;
                    oSelectedTab.removeAllContent();
                    oSelectedTab.addContent(oView);
                }).catch(function (error) {
                    console.error("Failed to load view:", sViewName, error);
                });
            });
        }
    });
});
