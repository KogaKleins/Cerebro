/**
 * STATS/DASHBOARD MODULE
 * Charts and statistics for coffee consumption
 */

import { State } from './state.js';
import { Utils } from './utils.js';

export const Stats = {
    charts: {},
    
    init() {
        this.updateDashboard();
    },
    
    updateDashboard() {
        this.updateSummaryCards();
        this.updateWeeklyChart();
        this.updateTopMakers();
        this.updateActivityTimeline();
    },
    
    // Summary statistics
    updateSummaryCards() {
        const coffeeData = State.getCoffeeData();
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        
        // Total coffees
        const totalMade = coffeeData.made.length;
        const totalBrought = coffeeData.brought.length;
        
        // This week
        const weekMade = coffeeData.made.filter(c => new Date(c.date) >= weekAgo).length;
        const weekBrought = coffeeData.brought.filter(c => new Date(c.date) >= weekAgo).length;
        
        // Last week for comparison
        const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        const lastWeekMade = coffeeData.made.filter(c => {
            const d = new Date(c.date);
            return d >= twoWeeksAgo && d < weekAgo;
        }).length;
        
        // Calculate average rating
        let totalRatings = 0;
        let ratingSum = 0;
        for (const rating of Object.values(coffeeData.ratings)) {
            if (rating.raters) {
                for (const r of rating.raters) {
                    ratingSum += r.stars;
                    totalRatings++;
                }
            }
        }
        const avgRating = totalRatings > 0 ? (ratingSum / totalRatings).toFixed(1) : '0.0';
        
        // Update UI
        this.updateElement('statsTotalCoffees', totalMade);
        this.updateElement('statsTotalBrought', totalBrought);
        this.updateElement('statsWeekCoffees', weekMade);
        this.updateElement('statsAvgRating', avgRating);
        
        // Update change indicators
        const weekChange = weekMade - lastWeekMade;
        const changeEl = document.getElementById('statsWeekChange');
        if (changeEl) {
            if (weekChange > 0) {
                changeEl.className = 'summary-change positive';
                changeEl.innerHTML = `<i class="fas fa-arrow-up"></i> +${weekChange} vs semana passada`;
            } else if (weekChange < 0) {
                changeEl.className = 'summary-change negative';
                changeEl.innerHTML = `<i class="fas fa-arrow-down"></i> ${weekChange} vs semana passada`;
            } else {
                changeEl.className = 'summary-change';
                changeEl.innerHTML = `<i class="fas fa-minus"></i> Igual à semana passada`;
            }
        }
    },
    
    updateElement(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    },
    
    // Weekly chart (simple bar chart without external library)
    updateWeeklyChart() {
        const container = document.getElementById('weeklyChartContainer');
        if (!container) return;
        
        const coffeeData = State.getCoffeeData();
        const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        const now = new Date();
        
        // Get last 7 days data
        const weekData = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            const dateStr = date.toDateString();
            
            const count = coffeeData.made.filter(c => 
                new Date(c.date).toDateString() === dateStr
            ).length;
            
            weekData.push({
                day: days[date.getDay()],
                date: date.getDate(),
                count: count
            });
        }
        
        const maxCount = Math.max(...weekData.map(d => d.count), 1);
        
        container.innerHTML = `
            <div class="simple-chart">
                ${weekData.map(d => `
                    <div class="chart-bar-container">
                        <div class="chart-bar" style="height: ${(d.count / maxCount) * 100}%">
                            <span class="chart-value">${d.count}</span>
                        </div>
                        <span class="chart-label">${d.day}</span>
                        <span class="chart-date">${d.date}</span>
                    </div>
                `).join('')}
            </div>
        `;
    },
    
    // Top coffee makers
    updateTopMakers() {
        const container = document.getElementById('topMakersContainer');
        if (!container) return;
        
        const coffeeData = State.getCoffeeData();
        
        // Count by person
        const counts = {};
        coffeeData.made.forEach(record => {
            counts[record.name] = (counts[record.name] || 0) + 1;
        });
        
        // Sort and get top 5
        const sorted = Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);
        
        if (sorted.length === 0) {
            container.innerHTML = '<p class="no-data">Nenhum dado ainda...</p>';
            return;
        }
        
        const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
        const maxCount = sorted[0][1];
        
        container.innerHTML = sorted.map((item, index) => `
            <div class="leaderboard-item">
                <span class="leaderboard-rank">${medals[index]}</span>
                <div class="leaderboard-info">
                    <span class="leaderboard-name">${Utils.escapeHtml(item[0])}</span>
                    <div class="leaderboard-bar">
                        <div class="leaderboard-bar-fill" style="width: ${(item[1] / maxCount) * 100}%"></div>
                    </div>
                </div>
                <span class="leaderboard-value">${item[1]}x</span>
            </div>
        `).join('');
    },
    
    // Activity timeline
    updateActivityTimeline() {
        const container = document.getElementById('statsActivityTimeline');
        if (!container) return;
        
        const coffeeData = State.getCoffeeData();
        const messages = State.getChatMessages();
        
        // Combine and sort all activities
        const activities = [];
        
        // Add coffee made
        coffeeData.made.slice(-10).forEach(c => {
            activities.push({
                type: 'made',
                text: `${c.name} fez café`,
                note: c.note,
                date: new Date(c.date)
            });
        });
        
        // Add coffee brought
        coffeeData.brought.slice(-5).forEach(c => {
            activities.push({
                type: 'brought',
                text: `${c.name} trouxe café`,
                note: c.note,
                date: new Date(c.date)
            });
        });
        
        // Sort by date (most recent first)
        activities.sort((a, b) => b.date - a.date);
        
        if (activities.length === 0) {
            container.innerHTML = '<p class="no-data">Nenhuma atividade recente...</p>';
            return;
        }
        
        container.innerHTML = activities.slice(0, 10).map(activity => `
            <div class="timeline-item">
                <div class="timeline-icon ${activity.type}">
                    <i class="fas fa-${activity.type === 'made' ? 'mug-hot' : 'shopping-bag'}"></i>
                </div>
                <div class="timeline-content">
                    <span class="timeline-text">${Utils.escapeHtml(activity.text)}</span>
                    ${activity.note ? `<small> - "${Utils.escapeHtml(activity.note)}"</small>` : ''}
                    <span class="timeline-time">${Utils.formatDateTime(activity.date)}</span>
                </div>
            </div>
        `).join('');
    },
    
    // Get coffee data for specific period
    getDataForPeriod(period = 'week') {
        const coffeeData = State.getCoffeeData();
        const now = new Date();
        let startDate;
        
        switch (period) {
            case 'today':
                startDate = new Date(now.setHours(0, 0, 0, 0));
                break;
            case 'week':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case 'month':
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                break;
            case 'all':
            default:
                startDate = new Date(0);
        }
        
        return {
            made: coffeeData.made.filter(c => new Date(c.date) >= startDate),
            brought: coffeeData.brought.filter(c => new Date(c.date) >= startDate)
        };
    }
};

// Add chart styles dynamically
const style = document.createElement('style');
style.textContent = `
    .simple-chart {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        height: 200px;
        padding: 20px 10px 40px;
        gap: 10px;
    }
    
    .chart-bar-container {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        height: 100%;
        position: relative;
    }
    
    .chart-bar {
        width: 100%;
        max-width: 40px;
        background: linear-gradient(180deg, var(--primary-coffee) 0%, var(--primary-coffee-dark) 100%);
        border-radius: var(--radius-sm) var(--radius-sm) 0 0;
        min-height: 4px;
        display: flex;
        align-items: flex-start;
        justify-content: center;
        transition: height 0.5s ease;
        margin-top: auto;
    }
    
    .chart-value {
        color: white;
        font-size: 0.75rem;
        font-weight: 600;
        padding: 4px;
        text-shadow: 0 1px 2px rgba(0,0,0,0.3);
    }
    
    .chart-label {
        position: absolute;
        bottom: 15px;
        font-size: 0.75rem;
        color: var(--text-secondary);
        font-weight: 500;
    }
    
    .chart-date {
        position: absolute;
        bottom: 0;
        font-size: 0.7rem;
        color: var(--text-secondary);
    }
    
    .leaderboard-bar {
        height: 6px;
        background: var(--glass-bg);
        border-radius: var(--radius-full);
        margin-top: 5px;
        overflow: hidden;
    }
    
    .leaderboard-bar-fill {
        height: 100%;
        background: linear-gradient(90deg, var(--primary-coffee), var(--primary-coffee-light));
        border-radius: var(--radius-full);
        transition: width 0.5s ease;
    }
    
    .no-data {
        text-align: center;
        color: var(--text-secondary);
        padding: 20px;
        font-style: italic;
    }
`;
document.head.appendChild(style);
