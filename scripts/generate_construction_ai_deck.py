import os
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

# Initialize 16:9 widescreen presentation
prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)
blank_layout = prs.slide_layouts[6]

# Executive Theme Palette
BG_DARK = RGBColor(15, 23, 42)        # #0F172A Deep Navy Slate
CARD_BG = RGBColor(30, 41, 59)        # #1E293B Card Background
CARD_BORDER = RGBColor(51, 65, 85)    # #334155 Subtle Slate Border
CARD_ALT_BG = RGBColor(24, 33, 47)    # #18212F Slightly darker card
AMBER = RGBColor(245, 158, 11)        # #F59E0B Construction Gold
CYAN = RGBColor(56, 189, 248)         # #38BDF8 Tech Cyan
EMERALD = RGBColor(16, 185, 129)      # #10B981 Success Green
ROSE = RGBColor(244, 63, 94)          # #F43F5E Warning Rose
TEXT_WHITE = RGBColor(255, 255, 255)  # #FFFFFF Primary text
TEXT_MUTED = RGBColor(148, 163, 184)  # #94A3B8 Secondary text
TEXT_LIGHT = RGBColor(203, 213, 225)  # #CBD5E1 Body text

def set_slide_background(slide):
    background = slide.background
    fill = background.fill
    fill.solid()
    fill.fore_color.rgb = BG_DARK

def add_header(slide, category: str, title: str, subtitle: str):
    set_slide_background(slide)
    
    # Category / Tag
    cat_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.4), Inches(11.7), Inches(0.35))
    tf_cat = cat_box.text_frame
    tf_cat.word_wrap = True
    tf_cat.margin_left = tf_cat.margin_right = tf_cat.margin_top = tf_cat.margin_bottom = 0
    p_cat = tf_cat.paragraphs[0]
    p_cat.text = category.upper()
    p_cat.font.size = Pt(10)
    p_cat.font.bold = True
    p_cat.font.color.rgb = AMBER
    p_cat.font.name = "Arial"
    
    # Title
    title_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.75), Inches(11.7), Inches(0.55))
    tf_t = title_box.text_frame
    tf_t.word_wrap = True
    tf_t.margin_left = tf_t.margin_right = tf_t.margin_top = tf_t.margin_bottom = 0
    p_t = tf_t.paragraphs[0]
    p_t.text = title
    p_t.font.size = Pt(22)
    p_t.font.bold = True
    p_t.font.color.rgb = TEXT_WHITE
    p_t.font.name = "Arial"
    
    # Subtitle
    sub_box = slide.shapes.add_textbox(Inches(0.8), Inches(1.35), Inches(11.7), Inches(0.4))
    tf_s = sub_box.text_frame
    tf_s.word_wrap = True
    tf_s.margin_left = tf_s.margin_right = tf_s.margin_top = tf_s.margin_bottom = 0
    p_s = tf_s.paragraphs[0]
    p_s.text = subtitle
    p_s.font.size = Pt(12)
    p_s.font.color.rgb = TEXT_MUTED
    p_s.font.name = "Arial"

def create_card(slide, left, top, width, height, bg_color=CARD_BG, border_color=CARD_BORDER):
    shape = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
    shape.fill.solid()
    shape.fill.fore_color.rgb = bg_color
    if border_color:
        shape.line.color.rgb = border_color
        shape.line.width = Pt(1)
    else:
        shape.line.fill.background()
    return shape

# ==============================================================================
# SLIDE 1: TITLE SLIDE
# ==============================================================================
slide1 = prs.slides.add_slide(blank_layout)
set_slide_background(slide1)

# Large decorative card
create_card(slide1, Inches(0.8), Inches(0.8), Inches(11.733), Inches(5.9), CARD_ALT_BG, CARD_BORDER)

# Top badge
badge = slide1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(1.3), Inches(1.4), Inches(3.2), Inches(0.4))
badge.fill.solid()
badge.fill.fore_color.rgb = RGBColor(39, 39, 42)
badge.line.color.rgb = AMBER
badge.line.width = Pt(1)
tf_b = badge.text_frame
p_b = tf_b.paragraphs[0]
p_b.text = "⚡ NEXT-GEN CONSTRUCTION OS"
p_b.font.size = Pt(10)
p_b.font.bold = True
p_b.font.color.rgb = AMBER
p_b.font.name = "Arial"
p_b.alignment = PP_ALIGN.CENTER

# Big Title
title_box = slide1.shapes.add_textbox(Inches(1.3), Inches(2.0), Inches(10.5), Inches(1.6))
tf = title_box.text_frame
tf.word_wrap = True
p1 = tf.paragraphs[0]
p1.text = "Sevents OS & Autonomous AI Agents"
p1.font.size = Pt(36)
p1.font.bold = True
p1.font.color.rgb = TEXT_WHITE
p1.font.name = "Arial"

p2 = tf.add_paragraph()
p2.text = "The Unified Operating System for Real-Time Construction Management"
p2.font.size = Pt(18)
p2.font.color.rgb = CYAN
p2.font.name = "Arial"
p2.space_before = Pt(8)

# Pitch description
desc_box = slide1.shapes.add_textbox(Inches(1.3), Inches(3.8), Inches(10.5), Inches(1.2))
tf_d = desc_box.text_frame
tf_d.word_wrap = True
pd = tf_d.paragraphs[0]
pd.text = (
    "Connecting enterprise ERP workflows (BIM, Inventory, BOQs, RFIs) with autonomous, "
    "Human-in-the-Loop AI copilots to eliminate communication delays, avoid material stockouts, "
    "and protect project gross margins."
)
pd.font.size = Pt(14)
pd.font.color.rgb = TEXT_LIGHT
pd.font.name = "Arial"

# 3 Highlights at bottom
stats = [
    ("Unified Source of Truth", "BIM + Stores + BOQ + RFIs in one single platform"),
    ("Autonomous Execution", "Multi-step reasoning with live database tool calling"),
    ("100% Human Oversight", "Strict Human-in-the-Loop (HITL) approval gates")
]
for i, (head, sub) in enumerate(stats):
    c_left = Inches(1.3 + i * 3.6)
    card = create_card(slide1, c_left, Inches(5.1), Inches(3.4), Inches(1.1), CARD_BG, AMBER if i == 0 else CARD_BORDER)
    tb = slide1.shapes.add_textbox(c_left + Inches(0.15), Inches(5.2), Inches(3.1), Inches(0.9))
    tf_c = tb.text_frame
    tf_c.word_wrap = True
    p = tf_c.paragraphs[0]
    p.text = head
    p.font.size = Pt(12)
    p.font.bold = True
    p.font.color.rgb = AMBER if i == 0 else TEXT_WHITE
    p.font.name = "Arial"
    p_sub = tf_c.add_paragraph()
    p_sub.text = sub
    p_sub.font.size = Pt(10)
    p_sub.font.color.rgb = TEXT_MUTED
    p_sub.font.name = "Arial"

# ==============================================================================
# SLIDE 2: THE PROBLEM WITHOUT SINGLE ERP
# ==============================================================================
slide2 = prs.slides.add_slide(blank_layout)
add_header(
    slide2,
    "The Industry Problem #1: Software Fragmentation",
    "Why Construction Projects Bleed Margins Without a Single Unified ERP",
    "Disconnected spreadsheets, WhatsApp coordination, and siloed software cost contractors 15–20% of project margin."
)

p2_cards = [
    ("Spreadsheet Chaos", "Critical BOQs, rate analyses, and stock registers live in 40+ disconnected Excel sheets. One broken formula leads to six-figure bidding errors.", ROSE),
    ("Site vs. Head Office Disconnect", "Site diaries written on paper or WhatsApp. Head office commercial managers only discover project delays 3 to 4 weeks after they happen on site.", ROSE),
    ("Inventory Blindspots", "Stores run out of essential rebar or cement mid-pour because procurement and site stores don't share a real-time stock balance ledger.", ROSE),
    ("Unrecovered Variation Claims", "Contractors lose legitimate Extension of Time (EOT) and cost claims because daily site disruption events aren't backed by contractual evidence.", ROSE)
]

for i, (title, desc, color) in enumerate(p2_cards):
    left = Inches(0.8 + (i % 2) * 5.95)
    top = Inches(1.85 + (i // 2) * 2.5)
    create_card(slide2, left, top, Inches(5.75), Inches(2.25), CARD_BG, color)
    
    tb = slide2.shapes.add_textbox(left + Inches(0.25), top + Inches(0.2), Inches(5.25), Inches(1.8))
    tf = tb.text_frame
    tf.word_wrap = True
    
    p = tf.paragraphs[0]
    p.text = f"❌  {title}"
    p.font.size = Pt(15)
    p.font.bold = True
    p.font.color.rgb = color
    p.font.name = "Arial"
    
    p2 = tf.add_paragraph()
    p2.text = desc
    p2.font.size = Pt(12)
    p2.font.color.rgb = TEXT_LIGHT
    p2.font.name = "Arial"
    p2.space_before = Pt(8)

# ==============================================================================
# SLIDE 3: THE PROBLEM WITHOUT AI AGENTS
# ==============================================================================
slide3 = prs.slides.add_slide(blank_layout)
add_header(
    slide3,
    "The Industry Problem #2: The Limits of Traditional Software",
    "Traditional ERPs Are Passive Databases — They Don't Solve the Human Bottleneck",
    "Even with software, site engineers spend 35% of their working hours manually typing data instead of supervising quality."
)

p3_points = [
    ("Passive Data Entry", "Traditional ERPs wait for overworked site engineers to navigate 15 dropdowns and manually log tickets. When people get busy, data entry stops and the ERP becomes outdated.", "Passive & Outdated"),
    ("Slow RFI Resolution Latency", "Engineers take 5–10 days to draft, reference drawing clauses, and send simple RFIs, holding up critical path concrete pours and MEP installations.", "5-10 Days Delay"),
    ("Reactive Rather than Predictive", "Standard systems tell you that you blew the budget last month. They cannot simulate the downstream impact of a 5-day delay on subcontractor handoffs.", "Rear-view Mirror"),
    ("Manual Drawing Cross-Referencing", "Checking whether a revised structural revision clashes with MEP services requires hours of manual cross-referencing across separate PDF drawing sets.", "High Human Error")
]

for i, (title, desc, tag) in enumerate(p3_points):
    left = Inches(0.8 + i * 2.95)
    top = Inches(1.85)
    card = create_card(slide3, left, top, Inches(2.8), Inches(4.9), CARD_BG, CARD_BORDER)
    
    tb = slide3.shapes.add_textbox(left + Inches(0.2), top + Inches(0.25), Inches(2.4), Inches(4.4))
    tf = tb.text_frame
    tf.word_wrap = True
    
    # Tag
    p_tag = tf.paragraphs[0]
    p_tag.text = tag.upper()
    p_tag.font.size = Pt(9)
    p_tag.font.bold = True
    p_tag.font.color.rgb = AMBER
    p_tag.font.name = "Arial"
    
    # Heading
    p_h = tf.add_paragraph()
    p_h.text = title
    p_h.font.size = Pt(14)
    p_h.font.bold = True
    p_h.font.color.rgb = TEXT_WHITE
    p_h.font.name = "Arial"
    p_h.space_before = Pt(6)
    
    # Body
    p_b = tf.add_paragraph()
    p_b.text = desc
    p_b.font.size = Pt(11)
    p_b.font.color.rgb = TEXT_LIGHT
    p_b.font.name = "Arial"
    p_b.space_before = Pt(8)

# ==============================================================================
# SLIDE 4: OUR SOLUTION (SEVENTS OS)
# ==============================================================================
slide4 = prs.slides.add_slide(blank_layout)
add_header(
    slide4,
    "The Unified Solution: Sevents OS",
    "Complete Construction ERP Integrated with Autonomous Agentic AI",
    "One centralized system of record for site operations, supercharged with intelligent copilots that take real action."
)

sol_cards = [
    ("Core Enterprise ERP Layer", [
        "BIM & 3D IFC Viewer integrated directly in browser",
        "Project-specific site stores & laydown yard ledgers",
        "Goods Received Notes (GRN) & Material Issue Slips (MIN)",
        "Master BOQ catalogue with rate & variation tracking",
        "Submittals, RFIs, and Inspection Gate Pass workflows"
    ], CYAN),
    ("Autonomous Agentic AI Layer", [
        "Specialized departmental copilots (Site, Commercial, Stores)",
        "Live Tool Calling: queries real inventory and drawing data",
        "Automated RFI drafting with clause referencing in 15 seconds",
        "Delay overhead and critical path risk quantification",
        "Natural language assistant for drawings, BOQs, and specs"
    ], AMBER),
    ("Human-In-The-Loop Governance", [
        "Read actions execute instantly with zero latency",
        "State mutation actions pause at prominent HITL checkpoints",
        "Engineers approve, reject, or modify agent payloads",
        "Immutable audit trail logging user, prompt, model, & cost",
        "Guaranteed zero unverified hallucinations or rogue orders"
    ], EMERALD)
]

for i, (title, items, color) in enumerate(sol_cards):
    left = Inches(0.8 + i * 3.95)
    top = Inches(1.85)
    create_card(slide4, left, top, Inches(3.8), Inches(4.9), CARD_BG, color)
    
    tb = slide4.shapes.add_textbox(left + Inches(0.25), top + Inches(0.25), Inches(3.3), Inches(4.4))
    tf = tb.text_frame
    tf.word_wrap = True
    
    p = tf.paragraphs[0]
    p.text = title
    p.font.size = Pt(15)
    p.font.bold = True
    p.font.color.rgb = color
    p.font.name = "Arial"
    
    for item in items:
        p_item = tf.add_paragraph()
        p_item.text = f"•  {item}"
        p_item.font.size = Pt(11)
        p_item.font.color.rgb = TEXT_LIGHT
        p_item.font.name = "Arial"
        p_item.space_before = Pt(8)

# ==============================================================================
# SLIDE 5: LLM VS ASSISTANT VS AGENTIC AI
# ==============================================================================
slide5 = prs.slides.add_slide(blank_layout)
add_header(
    slide5,
    "Technology Architecture: Demystifying AI",
    "LLM vs. AI Assistant vs. Agentic AI — What Powers Sevents OS?",
    "Why generic chatbots fail on construction sites, and how Agentic AI takes verified real-world actions."
)

table_shape = slide5.shapes.add_table(5, 4, Inches(0.8), Inches(1.85), Inches(11.733), Inches(4.8))
table = table_shape.table

# Set Column Widths
table.columns[0].width = Inches(2.3)
table.columns[1].width = Inches(3.1)
table.columns[2].width = Inches(3.1)
table.columns[3].width = Inches(3.233)

headers = ["Dimension", "1. Standard LLM\n(e.g. ChatGPT)", "2. AI Assistant\n(Standard RAG Chatbot)", "3. Sevents Agentic AI\n(Tool-Calling Engine)"]
for col_idx, text in enumerate(headers):
    cell = table.cell(0, col_idx)
    cell.fill.solid()
    cell.fill.fore_color.rgb = CARD_BG
    p = cell.text_frame.paragraphs[0]
    p.text = text
    p.font.size = Pt(11)
    p.font.bold = True
    p.font.color.rgb = AMBER if col_idx == 3 else TEXT_WHITE
    p.font.name = "Arial"
    p.alignment = PP_ALIGN.CENTER

data = [
    ("Primary Function", "Predicts next word from public internet training.", "Answers questions from static uploaded PDF documents.", "Reasons through complex tasks, breaks into steps, executes tools."),
    ("System Interaction", "Zero access to software or databases. Pure text.", "Read-only document search. Cannot trigger actions.", "Executes live SQL queries, checks stock, and drafts formal records."),
    ("Context Awareness", "Generic knowledge, no idea about your project.", "Knows text in uploaded PDF, but unaware of live site inventory.", "Real-time project state (Live store balances, BOQ rates, BIM IFCs)."),
    ("Action Governance", "None (prone to hallucination without validation).", "Passive advice (user must still do all work manually).", "Human-in-the-Loop (HITL) gate: Actions pause for 1-click human sign-off.")
]

for row_idx, row in enumerate(data):
    for col_idx, val in enumerate(row):
        cell = table.cell(row_idx + 1, col_idx)
        cell.fill.solid()
        cell.fill.fore_color.rgb = CARD_ALT_BG if col_idx != 3 else RGBColor(30, 48, 70)
        p = cell.text_frame.paragraphs[0]
        p.text = val
        p.font.size = Pt(10.5)
        p.font.bold = (col_idx == 0 or col_idx == 3)
        p.font.color.rgb = AMBER if (col_idx == 3 and row_idx == 3) else (CYAN if col_idx == 3 else (TEXT_WHITE if col_idx == 0 else TEXT_LIGHT))
        p.font.name = "Arial"

# ==============================================================================
# SLIDE 6: A DAY IN THE LIFE
# ==============================================================================
slide6 = prs.slides.add_slide(blank_layout)
add_header(
    slide6,
    "Practical Operational Impact",
    "A Day in the Life: How Sevents OS Transforms Daily Site Operations",
    "From administrative firefighting to instant automated resolution in three daily scenarios."
)

scenarios = [
    ("Scenario 1: Level 12 Beam Rebar Clash",
     "BEFORE: Site engineer spends 4 hours hunting drawing revisions, drafts RFI in Word, emails back and forth with consultant. Turnaround: 4 days.",
     "SEVENTS OS: Engineer types 'Draft RFI for Level 12 beam clash with MEP duct.' Copilot checks IFC specs, drafts formal RFI with proposed solution, and pauses for 1-click approval. Completed in 20 seconds.",
     "4 Days ➔ 20 Seconds"),
    ("Scenario 2: Impending Rebar Stockout",
     "BEFORE: Site runs out of 16mm rebar on a Friday during concrete pour. Work stops for 48 hours. Crane & labor sit idle. Direct loss: $12,000.",
     "SEVENTS OS: Agent analyzes 7-day lookahead schedule against live stock balance. Alerts: '16mm rebar will drop below 25-ton threshold in 48 hours.' Prepares draft purchase requisition for review.",
     "Zero Unplanned Downtime"),
    ("Scenario 3: Subcontractor Variation Claim",
     "BEFORE: Subcontractor submits a $45,000 extra work claim. QS spends 3 days searching through paper site logs and emails to verify work front readiness.",
     "SEVENTS OS: Commercial Copilot cross-references site weather logs, material gate passes, and BOQ item rates to substantiate contractual entitlement in 30 seconds.",
     "100% Margin Protection")
]

for i, (title, before, after, stat) in enumerate(scenarios):
    left = Inches(0.8 + i * 3.95)
    top = Inches(1.85)
    create_card(slide6, left, top, Inches(3.8), Inches(4.9), CARD_BG, CARD_BORDER)
    
    tb = slide6.shapes.add_textbox(left + Inches(0.2), top + Inches(0.2), Inches(3.4), Inches(4.5))
    tf = tb.text_frame
    tf.word_wrap = True
    
    # Title
    p_t = tf.paragraphs[0]
    p_t.text = title
    p_t.font.size = Pt(14)
    p_t.font.bold = True
    p_t.font.color.rgb = AMBER
    p_t.font.name = "Arial"
    
    # Stat badge
    p_stat = tf.add_paragraph()
    p_stat.text = f"⚡ {stat}"
    p_stat.font.size = Pt(11)
    p_stat.font.bold = True
    p_stat.font.color.rgb = EMERALD
    p_stat.font.name = "Arial"
    p_stat.space_before = Pt(4)
    
    # Before
    p_b = tf.add_paragraph()
    p_b.text = before
    p_b.font.size = Pt(10)
    p_b.font.color.rgb = ROSE
    p_b.font.name = "Arial"
    p_b.space_before = Pt(8)
    
    # After
    p_a = tf.add_paragraph()
    p_a.text = after
    p_a.font.size = Pt(10.5)
    p_a.font.color.rgb = TEXT_LIGHT
    p_a.font.name = "Arial"
    p_a.space_before = Pt(10)

# ==============================================================================
# SLIDE 7: DEPARTMENT-BY-DEPARTMENT TRANSFORMATION
# ==============================================================================
slide7 = prs.slides.add_slide(blank_layout)
add_header(
    slide7,
    "Organizational Value",
    "What Changes in Each Department After Implementing Sevents OS?",
    "Every stakeholder group gains purpose-built tools and autonomous support."
)

depts = [
    ("Site & Civil Engineering", [
        "Instant RFI drafting & drawing cross-checks",
        "Mobile-ready daily site inspection logging",
        "Clash detection between MEP & Structural",
        "Result: 70% reduction in admin paperwork"
    ], CYAN),
    ("Commercial & QS / Billing", [
        "Tender vs. Actual BOQ quantity reconciliation",
        "Automated delay & overhead impact cost models",
        "Substantiated variation claim defense",
        "Result: Zero unbilled scope changes"
    ], AMBER),
    ("Procurement & Site Stores", [
        "Live stock balance ledger across yards & bins",
        "Automated Goods Received Notes (GRN) matching",
        "Predictive reorder alerts tied to schedule",
        "Result: Elimination of ghost stockouts"
    ], EMERALD),
    ("Quality & HSE (Safety)", [
        "Instant incident logging with severity scoring",
        "PPE compliance tracking & inspection gates",
        "Automatic regulatory compliance reporting",
        "Result: Full audit-readiness & lower risk"
    ], ROSE),
    ("Executive & Project Directors", [
        "Single cross-project executive dashboard",
        "Predictive schedule lookahead alerts",
        "Real-time cash flow & budget tracking",
        "Result: Total portfolio visibility & control"
    ], RGBColor(168, 85, 247))
]

for i, (title, items, color) in enumerate(depts):
    left = Inches(0.8 + i * 2.38)
    top = Inches(1.85)
    create_card(slide7, left, top, Inches(2.25), Inches(4.9), CARD_BG, color)
    
    tb = slide7.shapes.add_textbox(left + Inches(0.15), top + Inches(0.2), Inches(1.95), Inches(4.5))
    tf = tb.text_frame
    tf.word_wrap = True
    
    p = tf.paragraphs[0]
    p.text = title
    p.font.size = Pt(12)
    p.font.bold = True
    p.font.color.rgb = color
    p.font.name = "Arial"
    
    for item in items:
        p_item = tf.add_paragraph()
        p_item.text = f"• {item}"
        p_item.font.size = Pt(9.5)
        p_item.font.color.rgb = TEXT_LIGHT if not item.startswith("Result:") else AMBER
        p_item.font.bold = item.startswith("Result:")
        p_item.font.name = "Arial"
        p_item.space_before = Pt(6)

# ==============================================================================
# SLIDE 8: HUMAN-IN-THE-LOOP SAFETY & GOVERNANCE
# ==============================================================================
slide8 = prs.slides.add_slide(blank_layout)
add_header(
    slide8,
    "Safety & Governance Architecture",
    "Human-in-the-Loop (HITL) Guardrails: Total Executive Control",
    "Autonomous agents handle analysis and preparation; authorized humans retain 100% sign-off authority."
)

# Left Card: Safe Read Tools
card_l = create_card(slide8, Inches(0.8), Inches(1.85), Inches(5.7), Inches(4.9), CARD_BG, CYAN)
tb_l = slide8.shapes.add_textbox(Inches(1.05), Inches(2.05), Inches(5.2), Inches(4.4))
tf_l = tb_l.text_frame
tf_l.word_wrap = True

p_l1 = tf_l.paragraphs[0]
p_l1.text = "🟢  Safe Read Tools (Zero Risk — Fully Autonomous)"
p_l1.font.size = Pt(15)
p_l1.font.bold = True
p_l1.font.color.rgb = CYAN

reads = [
    "Checking real-time warehouse inventory and stock levels",
    "Querying technical specifications, contract clauses, and BOQs",
    "Calculating critical path delay overhead costs ($/day)",
    "Searching drawing revisions and CAD/BIM metadata",
    "Synthesizing progress summaries and executive briefs"
]
for r in reads:
    p = tf_l.add_paragraph()
    p.text = f"✔  {r}"
    p.font.size = Pt(11)
    p.font.color.rgb = TEXT_LIGHT
    p.space_before = Pt(8)

p_l_note = tf_l.add_paragraph()
p_l_note.text = "Executed autonomously with sub-second response times."
p_l_note.font.size = Pt(10)
p_l_note.font.color.rgb = TEXT_MUTED
p_l_note.space_before = Pt(14)

# Right Card: Mutation Tools with HITL Gate
card_r = create_card(slide8, Inches(6.8), Inches(1.85), Inches(5.7), Inches(4.9), CARD_BG, AMBER)
tb_r = slide8.shapes.add_textbox(Inches(7.05), Inches(2.05), Inches(5.2), Inches(4.4))
tf_r = tb_r.text_frame
tf_r.word_wrap = True

p_r1 = tf_r.paragraphs[0]
p_r1.text = "🟡  State Mutation Tools (Strict HITL Checkpoint)"
p_r1.font.size = Pt(15)
p_r1.font.bold = True
p_r1.font.color.rgb = AMBER

mutations = [
    "Drafting and issuing formal RFIs to client/consultant",
    "Creating Purchase Orders or Goods Received Notes (GRN)",
    "Dispersing inventory via Material Issue Slips (MIN)",
    "Updating project milestones or baseline schedule dates",
    "Authorizing submittals or inspection approvals"
]
for m in mutations:
    p = tf_r.add_paragraph()
    p.text = f"🔒  {m}"
    p.font.size = Pt(11)
    p.font.color.rgb = TEXT_LIGHT
    p.space_before = Pt(8)

p_r_note = tf_r.add_paragraph()
p_r_note.text = "Agent pauses execution and renders a prominent approval banner. Requires authorized human click with full audit trail."
p_r_note.font.size = Pt(10.5)
p_r_note.font.bold = True
p_r_note.font.color.rgb = AMBER
p_r_note.space_before = Pt(14)

# ==============================================================================
# SLIDE 9: STAGES OF IMPLEMENTATION
# ==============================================================================
slide9 = prs.slides.add_slide(blank_layout)
add_header(
    slide9,
    "Implementation Methodology",
    "A Phased, Low-Risk Implementation Roadmap: Value from Week 3",
    "We don't ask clients to wait 12 months for ROI. Phased rollout ensures rapid adoption and team confidence."
)

phases = [
    ("Stage 1: Foundation OS", "Weeks 1 – 3", [
        "Deploy Sevents OS Tenant & Roles",
        "Setup Store Locations & Site Yards",
        "Ingest Master BOQ Catalogue",
        "Establish Baseline Project Schedules",
        "Deliverable: Single ERP System Active"
    ], CYAN),
    ("Stage 2: Knowledge RAG", "Weeks 4 – 6", [
        "Ingest Contract Specifications & Drawings",
        "Convert IFC BIM models for web viewing",
        "Setup Vector Search Knowledge Assistant",
        "Team query training on project specs",
        "Deliverable: Instant Document Search"
    ], AMBER),
    ("Stage 3: Department Agents", "Weeks 7 – 10", [
        "Activate Site Engineer Copilot",
        "Activate Inventory & Store Copilot",
        "Connect Custom ERP Webhooks & MCPs",
        "Rollout HITL Approval Gate Workflows",
        "Deliverable: Automated Daily Tasks"
    ], EMERALD),
    ("Stage 4: Autonomous Scale", "Month 3+", [
        "Automated lookahead schedule alerts",
        "Cross-project multi-agent collaboration",
        "Predictive cash flow & variation forecasting",
        "Enterprise-wide supply chain optimization",
        "Deliverable: Full Autonomous Ecosystem"
    ], RGBColor(168, 85, 247))
]

for i, (title, time, items, color) in enumerate(phases):
    left = Inches(0.8 + i * 2.95)
    top = Inches(1.85)
    create_card(slide9, left, top, Inches(2.8), Inches(4.9), CARD_BG, color)
    
    tb = slide9.shapes.add_textbox(left + Inches(0.2), top + Inches(0.2), Inches(2.4), Inches(4.5))
    tf = tb.text_frame
    tf.word_wrap = True
    
    p = tf.paragraphs[0]
    p.text = title
    p.font.size = Pt(13)
    p.font.bold = True
    p.font.color.rgb = color
    p.font.name = "Arial"
    
    p_t = tf.add_paragraph()
    p_t.text = time
    p_t.font.size = Pt(10)
    p_t.font.bold = True
    p_t.font.color.rgb = TEXT_MUTED
    p_t.space_before = Pt(2)
    
    for item in items:
        p_item = tf.add_paragraph()
        p_item.text = f"• {item}"
        p_item.font.size = Pt(10)
        p_item.font.color.rgb = AMBER if item.startswith("Deliverable:") else TEXT_LIGHT
        p_item.font.bold = item.startswith("Deliverable:")
        p_item.space_before = Pt(6)

# ==============================================================================
# SLIDE 10: CLIENT PREREQUISITES
# ==============================================================================
slide10 = prs.slides.add_slide(blank_layout)
add_header(
    slide10,
    "Client Onboarding Readiness",
    "Prerequisites from Client: What We Need to Launch",
    "Standard project documentation required during the initial 7-day ingestion sprint."
)

col_data = [
    ("Technical & Engineering Data", [
        ("Current Master BOQ (Bill of Quantities)", "Excel (.xlsx) format with item codes, descriptions, units of measure, and tender rates."),
        ("Architectural & Structural Drawing Sets", "PDF drawing packages for current active construction packages."),
        ("BIM / IFC 3D Model Files", "IFC format 3D models for automated web-based clash detection and visual walkthroughs."),
        ("Baseline Construction Schedule", "Primavera P6 (.xer) or MS Project (.mpp) with critical path milestones.")
    ], CYAN),
    ("Commercial & Operational Templates", [
        ("Standard RFI & Variation Formats", "Current corporate RFI, Site Memo, and Change Order templates and letterheads."),
        ("Sample Supplier Invoices & Delivery Notes", "Historical sample tickets to calibrate OCR and automated Goods Received Note (GRN) matching."),
        ("Material & Equipment Catalogues", "List of frequent site stores consumables, rebar sizes, concrete mixes, and PPE types."),
        ("Delegation of Authority (DOA) Matrix", "Rules specifying who can approve Purchase Orders, variations, and milestone sign-offs.")
    ], AMBER)
]

for col_idx, (col_title, items, color) in enumerate(col_data):
    left = Inches(0.8 + col_idx * 5.95)
    top = Inches(1.85)
    create_card(slide10, left, top, Inches(5.75), Inches(4.9), CARD_BG, color)
    
    tb = slide10.shapes.add_textbox(left + Inches(0.25), top + Inches(0.2), Inches(5.25), Inches(4.5))
    tf = tb.text_frame
    tf.word_wrap = True
    
    p = tf.paragraphs[0]
    p.text = col_title
    p.font.size = Pt(15)
    p.font.bold = True
    p.font.color.rgb = color
    p.font.name = "Arial"
    
    for head, desc in items:
        p_h = tf.add_paragraph()
        p_h.text = f"📄  {head}"
        p_h.font.size = Pt(11)
        p_h.font.bold = True
        p_h.font.color.rgb = TEXT_WHITE
        p_h.space_before = Pt(8)
        
        p_d = tf.add_paragraph()
        p_d.text = desc
        p_d.font.size = Pt(9.5)
        p_d.font.color.rgb = TEXT_LIGHT
        p_d.space_before = Pt(2)

# ==============================================================================
# SLIDE 11: PROJECTED BUSINESS ROI
# ==============================================================================
slide11 = prs.slides.add_slide(blank_layout)
add_header(
    slide11,
    "Financial & Operational Returns",
    "Quantified Return on Investment (ROI) for Contractors & Developers",
    "Proven metrics delivered through unified ERP workflows and autonomous agentic assistance."
)

metrics = [
    ("15%", "Material Waste Reduction", "Achieved through real-time store balances, automated reorder thresholds, and eliminating phantom site orders.", EMERALD),
    ("60%", "Faster RFI Turnaround", "Technical queries drafted, referenced, and reviewed in minutes instead of 5-10 day communication lulls.", CYAN),
    ("100%", "Variation Claim Recovery", "Every site disruption is logged with contractual clauses, weather logs, and timeline impact proof.", AMBER),
    ("3.5 hrs", "Saved per Engineer Daily", "Engineers eliminate tedious data entry, spending their time directly on site quality and safety oversight.", RGBColor(168, 85, 247))
]

for i, (stat, title, desc, color) in enumerate(metrics):
    left = Inches(0.8 + (i % 2) * 5.95)
    top = Inches(1.85 + (i // 2) * 2.5)
    create_card(slide11, left, top, Inches(5.75), Inches(2.25), CARD_BG, color)
    
    tb = slide11.shapes.add_textbox(left + Inches(0.25), top + Inches(0.2), Inches(5.25), Inches(1.85))
    tf = tb.text_frame
    tf.word_wrap = True
    
    p = tf.paragraphs[0]
    p.text = stat
    p.font.size = Pt(32)
    p.font.bold = True
    p.font.color.rgb = color
    p.font.name = "Arial"
    
    p_t = tf.add_paragraph()
    p_t.text = title
    p_t.font.size = Pt(13)
    p_t.font.bold = True
    p_t.font.color.rgb = TEXT_WHITE
    p_t.space_before = Pt(2)
    
    p_d = tf.add_paragraph()
    p_d.text = desc
    p_d.font.size = Pt(10)
    p_d.font.color.rgb = TEXT_LIGHT
    p_d.space_before = Pt(4)

# ==============================================================================
# SLIDE 12: PILOT PLAN & NEXT STEPS
# ==============================================================================
slide12 = prs.slides.add_slide(blank_layout)
add_header(
    slide12,
    "Next Steps",
    "Launch Plan: 30-Day Guided Pilot Program",
    "Experience immediate project visibility on one live project before enterprise-wide scaling."
)

card_main = create_card(slide12, Inches(0.8), Inches(1.85), Inches(11.733), Inches(4.9), CARD_ALT_BG, AMBER)

steps = [
    ("Step 1: Select Pilot Project", "Identify 1 representative active project (e.g., commercial tower, infrastructure package).", "Day 1 – 3"),
    ("Step 2: Data Ingestion Sprint", "Upload BOQ, architectural drawing sets, and store location catalog into Sevents OS.", "Day 4 – 10"),
    ("Step 3: Site Team Activation", "Conduct 2-hour onboarding session with site engineers, storekeeper, and commercial manager.", "Day 11 – 15"),
    ("Step 4: Live Co-Pilot Operation", "Run daily RFIs, store checks, and lookahead schedule updates with AI copilot assistance.", "Day 16 – 28"),
    ("Step 5: Executive Review", "Quantify hours saved, variation recovery, and user adoption metrics to plan full rollout.", "Day 29 – 30")
]

for i, (title, desc, days) in enumerate(steps):
    y = Inches(2.1 + i * 0.9)
    # Circle step badge
    badge = slide12.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(1.1), y, Inches(1.4), Inches(0.65))
    badge.fill.solid()
    badge.fill.fore_color.rgb = CARD_BG
    badge.line.color.rgb = AMBER
    tf_b = badge.text_frame
    p_b = tf_b.paragraphs[0]
    p_b.text = days
    p_b.font.size = Pt(10)
    p_b.font.bold = True
    p_b.font.color.rgb = AMBER
    p_b.alignment = PP_ALIGN.CENTER
    
    tb = slide12.shapes.add_textbox(Inches(2.7), y, Inches(9.5), Inches(0.7))
    tf = tb.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = title
    p.font.size = Pt(13)
    p.font.bold = True
    p.font.color.rgb = TEXT_WHITE
    p_d = tf.add_paragraph()
    p_d.text = desc
    p_d.font.size = Pt(10.5)
    p_d.font.color.rgb = TEXT_LIGHT
    p_d.space_before = Pt(2)

# Save presentation
output_dir = "docs"
os.makedirs(output_dir, exist_ok=True)
output_path = os.path.join(output_dir, "Sevents_OS_Autonomous_Construction_Platform.pptx")
prs.save(output_path)
print(f"Presentation successfully created and saved to: {output_path}")
