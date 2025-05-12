// user-data.js

document.addEventListener("DOMContentLoaded", () => {
    const charts = document.querySelectorAll(".blurred-chart");

    charts.forEach(chart => {
        chart.style.position = "relative";
        chart.style.display = "flex";
        chart.style.alignItems = "flex-end";
        chart.style.justifyContent = "space-between";
        chart.style.padding = "0 10px";

        for (let i = 0; i < 10; i++) {
            const bar = document.createElement("div");
            bar.className = "fake-bar";
            bar.style.height = `${Math.floor(Math.random() * 120) + 20}px`;
            chart.appendChild(bar);
        }
    });
});

