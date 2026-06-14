/**
 * WebSocket client for real-time poll updates.
 *
 * Flow:
 *  1. Connect to ws://host/ws?time=<timeSlot>
 *  2. Server sends { type: "poll_update", timeSlot } on any vote/unvote/sold-out
 *  3. Client calls htmx.ajax GET /poll/cards?time=<slot> → swaps #poll-grid innerHTML
 */

/* global htmx */

var _ws = null;
var _wsReconnectTimer = null;
var _wsTimeSlot = null;
var _wsConnected = false;

function initWebSocket(timeSlot) {
  _wsTimeSlot = timeSlot;
  _createStatusIndicator();
  connectWebSocket();
}

function connectWebSocket() {
  if (_ws && (_ws.readyState === WebSocket.CONNECTING || _ws.readyState === WebSocket.OPEN)) {
    return;
  }

  if (_wsReconnectTimer) {
    clearTimeout(_wsReconnectTimer);
    _wsReconnectTimer = null;
  }

  var protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  var url = protocol + "//" + window.location.host + "/ws?time=" + encodeURIComponent(_wsTimeSlot);

  console.log("[WS] Connecting to", url);
  _setStatus(false, "Đang kết nối...");

  _ws = new WebSocket(url);

  _ws.onopen = function () {
    console.log("[WS] Connected ✓ timeSlot=" + _wsTimeSlot);
    _wsConnected = true;
    _setStatus(true, "⚡ Live");
  };

  _ws.onmessage = function (event) {
    try {
      var data = JSON.parse(event.data);
      console.log("[WS] Message received:", data);

      if (data.type === "poll_update" && data.timeSlot === _wsTimeSlot) {
        console.log("[WS] Refreshing poll cards...");
        _refreshPollCards();
      }
    } catch (e) {
      console.warn("[WS] Bad message:", event.data);
    }
  };

  _ws.onclose = function (evt) {
    console.log("[WS] Closed (code=" + evt.code + "). Reconnecting in 3s...");
    _wsConnected = false;
    _setStatus(false, "⏳ Kết nối lại...");
    _wsReconnectTimer = setTimeout(connectWebSocket, 3000);
  };

  _ws.onerror = function (err) {
    console.error("[WS] Error:", err);
    _setStatus(false, "❌ Lỗi kết nối");
    // onclose fires automatically after onerror
  };
}

function _refreshPollCards() {
  if (typeof htmx === "undefined") {
    console.warn("[WS] htmx not loaded – falling back to location.reload()");
    window.location.reload();
    return;
  }

  htmx.ajax("GET", "/poll/cards?time=" + encodeURIComponent(_wsTimeSlot), {
    target: "#poll-grid",
    swap: "innerHTML",
    headers: {
      "X-Requested-With": "XMLHttpRequest",
    },
  });
}

function _createStatusIndicator() {
  if (document.getElementById("ws-status")) return;
  var el = document.createElement("div");
  el.id = "ws-status";
  el.className = "ws-status";
  document.body.appendChild(el);
}

function _setStatus(connected, text) {
  var el = document.getElementById("ws-status");
  if (!el) return;
  el.className = "ws-status " + (connected ? "ws-connected" : "ws-disconnected");
  el.textContent = text;
}
