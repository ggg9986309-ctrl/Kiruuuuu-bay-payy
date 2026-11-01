
"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const status = document.getElementById("server-status");

  async function checkServer() {
    if (!status) return;

    status.textContent = "Connecting to KIRUU PAY server...";

    try {
      const response = await fetch("/api/health", {
        method: "GET",
        headers: {
          "Accept": "application/json"
        }
      });

      if (!response.ok) {
        throw new Error("Server unavailable");
      }

      const result = await response.json();

      if (result.app === "KIRUU PAY" &&
          result.server === "online") {
        status.textContent = "Server connected";
      } else {
        status.textContent = "Server status unavailable";
      }
    } catch (error) {
      status.textContent =
        "Backend not connected. Open the hosted app after deployment.";
    }
  }

  checkServer();
});
