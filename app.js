
"use strict";

document.addEventListener("DOMContentLoaded", () => {
  console.log("KIRUU PAY initialized");

  const healthStatus = document.getElementById("server-status");

  async function checkServer() {
    if (!healthStatus) return;

    try {
      const response = await fetch("/api/health");
      if (!response.ok) throw new Error("Server unavailable");

      const data = await response.json();

      healthStatus.textContent =
        data.server === "online"
          ? "Server connected"
          : "Server unavailable";
    } catch {
      healthStatus.textContent = "Server not connected";
    }
  }

  checkServer();
});
