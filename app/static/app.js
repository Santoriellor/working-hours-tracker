const currentYear = 2026;
const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const CONTRACT_PER_DAY = 6.4;

let activeMonth = new Date().getMonth() + 1; // 1-indexed
if (new Date().getFullYear() !== currentYear) activeMonth = 3; // Default to March if not 2026

document.addEventListener("DOMContentLoaded", () => {
    renderNav();
    loadMonth(activeMonth);
});

function renderNav() {
    const nav = document.getElementById("month-nav");
    nav.innerHTML = "";
    months.forEach((name, index) => {
        const btn = document.createElement("button");
        btn.textContent = name;
        btn.className = (index + 1 === activeMonth) ? "active" : "";
        btn.onclick = () => {
            activeMonth = index + 1;
            updateNav();
            loadMonth(activeMonth);
        };
        nav.appendChild(btn);
    });
    
    const yearlyBtn = document.createElement("button");
    yearlyBtn.textContent = "📊 Yearly";
    yearlyBtn.id = "yearly-btn";
    yearlyBtn.onclick = () => {
        activeMonth = 0;
        updateNav();
        loadYearlySummary();
    };
    nav.appendChild(yearlyBtn);
}

function updateNav() {
    const buttons = document.querySelectorAll("#month-nav button");
    buttons.forEach((btn, index) => {
        if (index < 12) {
            btn.className = (index + 1 === activeMonth) ? "active" : "";
        } else {
            btn.className = (activeMonth === 0) ? "active" : "";
        }
    });
}

async function loadMonth(month) {
    const response = await fetch(`/api/hours/${currentYear}/${month}`);
    const data = await response.json();
    renderMonth(month, data);
}

function getWeeks(year, month) {
    const weeks = [];
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    let current = new Date(firstDay);
    // rewind to Monday (0=Sun, 1=Mon, ..., 6=Sat)
    // (current.getDay() + 6) % 7 turns 0->6, 1->0, 2->1 ...
    current.setDate(current.getDate() - ((current.getDay() + 6) % 7));

    while (current <= lastDay) {
        const weekDays = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(current);
            d.setDate(current.getDate() + i);
            weekDays.push({
                date: d,
                dateStr: d.toISOString().split('T')[0],
                inMonth: d.getMonth() === month - 1,
                isWeekend: d.getDay() === 0 || d.getDay() === 6
            });
        }
        if (weekDays.some(d => d.inMonth)) weeks.push(weekDays);
        current.setDate(current.getDate() + 7);
    }
    return weeks;
}

function renderMonth(month, savedHours) {
    const content = document.getElementById("content");
    const weeks = getWeeks(currentYear, month);
    
    let html = `
        <table>
            <thead>
                <tr>
                    <th>Week</th>
                    <th>Dates</th>
                    <th>Mon</th><th>Tue</th><th>Wed</th><th>Thu</th><th>Fri</th>
                    <th class="weekend">Sat</th><th class="weekend">Sun</th>
                    <th>Total</th>
                    <th>Contract</th>
                    <th>+/-</th>
                </tr>
            </thead>
            <tbody>
    `;

    weeks.forEach((week, index) => {
        const startDate = week[0].date.toLocaleDateString(undefined, {month:'short', day:'numeric'});
        const endDate = week[6].date.toLocaleDateString(undefined, {month:'short', day:'numeric'});
        
        let weekWorked = 0;
        let weekContract = 0;

        html += `<tr>
            <td>${getWeekNumber(week[0].date)}</td>
            <td style="font-size: 0.8em">${startDate} - ${endDate}</td>
        `;

        week.forEach(day => {
            const hours = savedHours[day.dateStr] || 0;
            if (day.inMonth) {
                weekWorked += hours;
                if (!day.isWeekend) weekContract += CONTRACT_PER_DAY;
                
                const cssClass = day.isWeekend ? "weekend" : "";
                html += `<td class="${cssClass}">
                    <input type="number" step="0.5" min="0" max="24" 
                        value="${hours || ''}" 
                        data-date="${day.dateStr}"
                        onblur="saveHours(this)"
                        oninput="recalculateRow(this)">
                </td>`;
            } else {
                html += `<td class="other-month"></td>`;
            }
        });

        const balance = weekWorked - weekContract;
        const balanceClass = getBalanceClass(balance);

        html += `
            <td class="week-total">${weekWorked.toFixed(1)}</td>
            <td class="week-contract">${weekContract.toFixed(1)}</td>
            <td class="week-balance ${balanceClass}">${balance.toFixed(1)}</td>
        </tr>`;
    });

    html += `</tbody></table>`;
    content.innerHTML = html;
}

function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    var weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return weekNo;
}

function getBalanceClass(balance) {
    if (balance > 0) return "balance-positive";
    if (balance < 0) return "balance-negative";
    return "balance-zero";
}

async function saveHours(input) {
    const date = input.getAttribute("data-date");
    const hours = parseFloat(input.value) || 0;
    
    try {
        await fetch("/api/hours", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ date, hours })
        });
    } catch (e) {
        console.error("Failed to save", e);
    }
}

function recalculateRow(input) {
    const row = input.closest("tr");
    const inputs = row.querySelectorAll("input");
    let total = 0;
    inputs.forEach(i => total += (parseFloat(i.value) || 0));
    
    const contract = parseFloat(row.querySelector(".week-contract").textContent);
    const balance = total - contract;
    
    row.querySelector(".week-total").textContent = total.toFixed(1);
    const balanceCell = row.querySelector(".week-balance");
    balanceCell.textContent = balance.toFixed(1);
    balanceCell.className = "week-balance " + getBalanceClass(balance);
}

async function loadYearlySummary() {
    const response = await fetch(`/api/summary/${currentYear}`);
    const data = await response.json();
    
    const content = document.getElementById("content");
    let html = `
        <table class="summary-table">
            <thead>
                <tr>
                    <th>Month</th>
                    <th>Hours Worked</th>
                    <th>Contract Hours</th>
                    <th>Balance</th>
                </tr>
            </thead>
            <tbody>
    `;

    let grandWorked = 0;
    let grandContract = 0;

    data.forEach(m => {
        grandWorked += m.worked;
        grandContract += m.contract;
        html += `
            <tr>
                <td>${m.name}</td>
                <td>${m.worked.toFixed(1)}</td>
                <td>${m.contract.toFixed(1)}</td>
                <td class="${getBalanceClass(m.balance)}">${m.balance.toFixed(1)}</td>
            </tr>
        `;
    });

    const grandBalance = grandWorked - grandContract;
    html += `
            <tr class="total-row">
                <td>TOTAL</td>
                <td>${grandWorked.toFixed(1)}</td>
                <td>${grandContract.toFixed(1)}</td>
                <td class="${getBalanceClass(grandBalance)}">${grandBalance.toFixed(1)}</td>
            </tr>
        </tbody>
    </table>`;
    
    content.innerHTML = html;
}
