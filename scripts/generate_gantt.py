import matplotlib.pyplot as plt
import matplotlib.patches as patches
import numpy as np

# Create professional Gantt chart for Mindroot
fig, ax = plt.subplots(figsize=(12, 6), dpi=200)

phases = [
    "6. Documentation & Report",
    "5. Deployment & System Testing",
    "4. WebRTC Video & Classroom Integration",
    "3. Full-Stack Development (React + Node + DB)",
    "2. System Design (ER, DFD, Architecture)",
    "1. Requirement Analysis & Feasibility"
]

durations = [10, 15, 20, 45, 18, 12]
start_hours = [110, 95, 75, 30, 12, 0]
colors = ["#0284C7", "#8B5CF6", "#EC4899", "#F59E0B", "#10B981", "#3B82F6"]

y_positions = np.arange(len(phases))

bars = ax.barh(y_positions, durations, left=start_hours, height=0.55, align='center', color=colors, edgecolor='none', zorder=3)

# Add text labels on bars
for bar, start, dur in zip(bars, start_hours, durations):
    ax.text(start + dur / 2, bar.get_y() + bar.get_height() / 2, f"{dur} Hrs ({start}-{start+dur})",
            va='center', ha='center', color='white', fontweight='bold', fontsize=10)

ax.set_yticks(y_positions)
ax.set_yticklabels(phases, fontsize=11, fontweight='bold', color='#1E293B')
ax.set_xlabel('Project Timeline (Hours)', fontsize=12, fontweight='bold', color='#1E293B')
ax.set_xlim(0, 125)
ax.set_xticks(np.arange(0, 130, 10))

ax.set_title('GANTT CHART – MINDROOT PEER SKILL EXCHANGE PLATFORM\nTotal Duration: 120 Hours (Academic Project Lifecycle)',
             fontsize=14, fontweight='bold', color='#0F172A', pad=15)

ax.grid(axis='x', linestyle='--', alpha=0.6, zorder=1)
ax.set_facecolor('#F8FAFC')
fig.patch.set_facecolor('#FFFFFF')

for spine in ax.spines.values():
    spine.set_edgecolor('#CBD5E1')

plt.tight_layout()
plt.savefig('diagrams/gantt_chart.png', dpi=200)
print('Gantt chart generated at diagrams/gantt_chart.png')
