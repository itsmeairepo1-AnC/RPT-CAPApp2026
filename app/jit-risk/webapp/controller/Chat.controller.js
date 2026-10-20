sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/m/Button",
    "jit/risk/model/api"
], function (Controller, MessageToast, Button, API) {
    "use strict";

    return Controller.extend("jit.risk.controller.Chat", {

        onInit: function () {
            const oChatModel = this.getOwnerComponent().getModel("chatModel");
            oChatModel.setData({
                messages:  [],
                history:   [],    // rolling conversation history sent to LLM (last 20 entries)
                sessionId: null,
                typing:    false
            });

            this._showWelcome();
        },

        _showWelcome: function () {
            this._addBotMessage(
                "Welcome to the <strong>JIT Risk Assistant</strong>!<br/><br/>" +
                "I can help you assess purchase order delay risk. Just describe what you need " +
                "in plain language — for example:<br/><br/>" +
                "<em>\"What's the risk for VENDOR_C ordering 2000 units of MAT-1002?\"</em><br/>" +
                "<em>\"Show me the dashboard summary\"</em><br/>" +
                "<em>\"List all vendors\"</em>",
                [
                    { text: "Predict PO Risk", action: "predict"    },
                    { text: "List Vendors",    action: "vendors"    },
                    { text: "Browse Materials",action: "materials"  }
                ]
            );
        },

        // ── Outbound: user sends a message ────────────────────────────────

        onSendMessage: function () {
            const oInput   = this.byId("chatInput");
            const sMessage = oInput.getValue().trim();
            if (!sMessage) { return; }
            oInput.setValue("");
            this._addUserMessage(sMessage);
            this._sendToLLM(sMessage);
        },

        onQuickAction: function (sAction) {
            const aLabels = {
                predict:   "I want to predict PO risk",
                dashboard: "Show me the dashboard summary",
                vendors:   "List all vendors",
                materials: "Browse all materials"
            };
            const sMessage = aLabels[sAction] || sAction;
            this._addUserMessage(sMessage);
            this._sendToLLM(sMessage);
        },

        // ── LLM call ──────────────────────────────────────────────────────

        _sendToLLM: function (sMessage) {
            const oChatModel = this.getOwnerComponent().getModel("chatModel");
            const aHistory   = oChatModel.getProperty("/history")   || [];
            const sSessionId = oChatModel.getProperty("/sessionId");

            this._setTyping(true);

            API.chat(sMessage, aHistory, sSessionId)
                .then((oResult) => {
                    this._setTyping(false);

                    const sReply      = oResult.reply      || "Sorry, I didn't get a response.";
                    const sNewSession = oResult.session_id || sSessionId;

                    // Keep rolling window of last 20 history entries (10 turns)
                    const aUpdated = [
                        ...aHistory,
                        { role: "user",      content: sMessage },
                        { role: "assistant", content: sReply   }
                    ].slice(-20);

                    oChatModel.setProperty("/history",   aUpdated);
                    oChatModel.setProperty("/sessionId", sNewSession);

                    this._addBotMessage(sReply);
                })
                .catch((oError) => {
                    this._setTyping(false);
                    console.error("Chat error:", oError);
                    this._addBotMessage("Sorry, something went wrong. Please try again.");
                });
        },

        // ── Message helpers ───────────────────────────────────────────────

        _addUserMessage: function (sText) {
            this._addMessage(sText, "user");
        },

        _addBotMessage: function (sText, aButtons) {
            this._addMessage(sText, "bot", aButtons);
        },

        _addMessage: function (sText, sSender, aButtons) {
            const oChatModel = this.getOwnerComponent().getModel("chatModel");
            const aMessages  = oChatModel.getProperty("/messages") || [];
            const sTimestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

            aMessages.push({ text: sText, sender: sSender, timestamp: sTimestamp });
            oChatModel.setProperty("/messages", aMessages);

            if (aButtons && aButtons.length > 0) {
                setTimeout(() => this._renderButtons(aMessages.length - 1, aButtons), 60);
            }

            this._scrollToBottom();
        },

        // ── Dynamic button injection ──────────────────────────────────────

        _renderButtons: function (iIndex, aButtons) {
            const oChatList = this.byId("chatFeed");
            if (!oChatList) { return; }

            const aItems = oChatList.getItems();
            if (!aItems[iIndex]) { return; }

            const aContainers = aItems[iIndex]
                .findAggregatedObjects(true)
                .filter(o => o.isA("sap.m.HBox") && o.hasStyleClass("chatButtonContainer"));

            if (!aContainers.length) { return; }
            const oContainer = aContainers[0];
            oContainer.destroyItems();

            aButtons.forEach((oBtn) => {
                oContainer.addItem(
                    new Button({
                        text:  oBtn.text,
                        type:  "Emphasized",
                        press: () => this.onQuickAction(oBtn.action)
                    }).addStyleClass("chatActionButton")
                );
            });
        },

        // ── Typing indicator ─────────────────────────────────────────────

        _setTyping: function (bTyping) {
            if (bTyping) {
                this._addBotMessage("typing...");
            } else {
                const oChatModel = this.getOwnerComponent().getModel("chatModel");
                const aMessages  = oChatModel.getProperty("/messages") || [];
                const oLast      = aMessages[aMessages.length - 1];
                if (oLast && oLast.text === "typing..." && oLast.sender === "bot") {
                    aMessages.splice(aMessages.length - 1, 1);
                    oChatModel.setProperty("/messages", aMessages);
                }
            }
        },

        // ── Scroll ────────────────────────────────────────────────────────

        _scrollToBottom: function () {
            const oScroller = this.byId("chatScrollContainer");
            if (!oScroller) { return; }
            setTimeout(() => {
                const oDom = oScroller.getDomRef();
                if (oDom) { oDom.scrollTop = oDom.scrollHeight; }
            }, 100);
        }
    });
});
