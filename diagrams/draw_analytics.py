import matplotlib.pyplot as plt
import matplotlib.patches as patches
import numpy as np
import sys

sys.stdout.reconfigure(encoding='utf-8')

# High-resolution 3840x1634 canvas (aspect ratio ~2.35:1)
fig = plt.figure(figsize=(19.2, 8.17), dpi=200)

# Colors
NAVY = "#0F172A"
SLATE = "#1E293B"
EMERALD = "#10B981"
DARK_EMERALD = "#065F46"
LIGHT_BG = "#F8FAFC"
WHITE = "#FFFFFF"
BLUE = "#2563EB"
AMBER = "#D97706"
BORDER = "#CBD5E1"

fig.patch.set_facecolor(WHITE)

# 4 Subplots in a 2x2 layout with ample padding
gs = fig.add_gridspec(2, 2, left=0.06, right=0.96, top=0.90, bottom=0.08, wspace=0.22, hspace=0.35)

# --- CHART 1: WEEKLY TOKEN CIRCULATION VOLUME (BAR & LINE) ---
ax1 = fig.add_subplot(gs[0, 0])
weeks = ['W1 (Sep)', 'W2 (Sep)', 'W3 (Oct)', 'W4 (Oct)', 'W5 (Oct)', 'W6 (Nov)']
tokens_circulated = [142, 285, 410, 590, 780, 960]
tokens_escrowed = [30, 65, 95, 130, 175, 210]

x = np.arange(len(weeks))
width = 0.35

rects1 = ax1.bar(x - width/2, tokens_circulated, width, label='Settled Tokens', color=DARK_EMERALD, edgecolor='none', zorder=3)
rects2 = ax1.bar(x + width/2, tokens_escrowed, width, label='In Escrow', color=EMERALD, edgecolor='none', zorder=3)

ax1.set_title('Skill Token Circulation & Escrow Velocity (Weekly)', fontsize=12, fontweight='bold', color=NAVY, pad=10)
ax1.set_xticks(x)
ax1.set_xticklabels(weeks, fontsize=10, fontweight='bold', color=SLATE)
ax1.set_ylabel('Token Count', fontsize=10.5, fontweight='bold', color=SLATE)
ax1.legend(loc='upper left', frameon=True, facecolor=WHITE, edgecolor=BORDER, fontsize=9.5)
ax1.grid(axis='y', linestyle='--', alpha=0.5, zorder=1)
ax1.set_facecolor(LIGHT_BG)
for spine in ax1.spines.values():
    spine.set_edgecolor(BORDER)

# Data labels on bars
for rect in rects1:
    h = rect.get_height()
    ax1.text(rect.get_x() + rect.get_width()/2., h + 15, f'{int(h)}', ha='center', va='bottom', fontsize=9, fontweight='bold', color=NAVY)

# --- CHART 2: SESSION COMPLETION & DISPUTE RESOLUTION RATE ---
ax2 = fig.add_subplot(gs[0, 1])
months = ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov']
completion_rate = [88.5, 91.2, 94.0, 96.5, 98.2, 99.4]
ghosting_rate = [9.5, 6.8, 4.2, 2.5, 1.2, 0.4]

ax2.plot(months, completion_rate, marker='o', linewidth=3, color=DARK_EMERALD, label='Session Completion Rate (%)', zorder=4)
ax2.plot(months, ghosting_rate, marker='s', linewidth=2.5, color="#EF4444", linestyle='--', label='No-Show / Ghosting Rate (%)', zorder=4)

ax2.set_title('Session Success vs. Ghosting Reduction Trend (%)', fontsize=12, fontweight='bold', color=NAVY, pad=10)
ax2.set_xticks(range(len(months)))
ax2.set_xticklabels(months, fontsize=10, fontweight='bold', color=SLATE)
ax2.set_ylabel('Percentage (%)', fontsize=10.5, fontweight='bold', color=SLATE)
ax2.set_ylim(0, 110)
ax2.legend(loc='center left', frameon=True, facecolor=WHITE, edgecolor=BORDER, fontsize=9.5)
ax2.grid(axis='y', linestyle='--', alpha=0.5, zorder=1)
ax2.set_facecolor(LIGHT_BG)
for spine in ax2.spines.values():
    spine.set_edgecolor(BORDER)

for i, txt in enumerate(completion_rate):
    ax2.annotate(f'{txt}%', (months[i], completion_rate[i] + 3), fontsize=9, fontweight='bold', color=DARK_EMERALD, ha='center')

# --- CHART 3: SKILL EXCHANGE CATEGORY DISTRIBUTION ---
ax3 = fig.add_subplot(gs[1, 0])
categories = ['Full-Stack Dev\n(React/Node)', 'Algorithms &\nLeetCode', 'AI & Machine\nLearning', 'Cloud, Docker\n& DevOps', 'UI/UX Design\n& Figma']
volumes = [340, 260, 195, 145, 120]
colors = [DARK_EMERALD, EMERALD, BLUE, AMBER, "#64748B"]

bars = ax3.barh(categories, volumes, color=colors, height=0.55, zorder=3)
ax3.set_title('Top Skill Exchange Taxonomies by Completed Hours', fontsize=12, fontweight='bold', color=NAVY, pad=10)
ax3.set_xlabel('Total Peer Learning Hours Conducted', fontsize=10.5, fontweight='bold', color=SLATE)
ax3.set_yticklabels(categories, fontsize=9.5, fontweight='bold', color=SLATE)
ax3.grid(axis='x', linestyle='--', alpha=0.5, zorder=1)
ax3.set_facecolor(LIGHT_BG)
ax3.invert_yaxis()
for spine in ax3.spines.values():
    spine.set_edgecolor(BORDER)

for bar in bars:
    w = bar.get_width()
    ax3.text(w + 8, bar.get_y() + bar.get_height()/2., f'{int(w)} hrs', ha='left', va='center', fontsize=9.5, fontweight='bold', color=NAVY)

# --- CHART 4: USER ROLE DISTRIBUTION & ENGAGEMENT ---
ax4 = fig.add_subplot(gs[1, 1])
roles = ['Dual-Role (Both)', 'Teachers Only', 'Students Only', 'Platform Admins']
counts = [58, 24, 16, 2]
donut_colors = [DARK_EMERALD, EMERALD, BLUE, NAVY]

wedges, texts, autotexts = ax4.pie(counts, labels=roles, colors=donut_colors, autopct='%1.0f%%',
                                   startangle=140, pctdistance=0.75,
                                   textprops=dict(color=NAVY, fontsize=9.5, fontweight='bold'),
                                   wedgeprops=dict(width=0.45, edgecolor=WHITE, linewidth=2.5))

for autotext in autotexts:
    autotext.set_color(WHITE)
    autotext.set_fontsize(10)
    autotext.set_weight('bold')

ax4.set_title('Active Peer Community Role Breakdown (Dual-Role Dominance)', fontsize=12, fontweight='bold', color=NAVY, pad=10)

# Super Title Banner
fig.text(0.5, 0.96, "MINDROOT PLATFORM METRICS & TIME-BANKING AUDIT DASHBOARD",
         fontsize=14, fontweight='bold', color=NAVY, ha='center', va='center')

plt.savefig("diagrams/analytics_graphs.png", dpi=200, bbox_inches="tight", pad_inches=0.08)
plt.close()
print("Saved diagrams/analytics_graphs.png")
