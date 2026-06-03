# Design Spec: Professional Accountant Light Theme

Transform the application user interface from a dark, tech-focused style with gradients and glassmorphism to a professional, high-contrast, clean light theme tailored for accountants.

## Problem Statement

The current user interface of the VAT Validation app uses a dark theme with glassmorphic cards, glowing highlights, and blue-purple gradients. While visually modern, this "tech-savvy" aesthetic can feel alien, fatiguing, or unprofessional to traditional corporate accountants who are used to structured financial tools like Excel or enterprise audit software.

## Solution

We will migrate the styling system from dark-theme glassmorphism to a clean **Modern Enterprise Light Theme** (Corporate Navy & Slate).

### 1. Style Changes

We will refactor the CSS design tokens and component styles in `src/index.css`:

- **Theme Transition**: Dark theme slate background (`#0f172a`) shifts to soft light gray (`#f1f5f9`).
- **Surface Elevation**: Translucent glassmorphism containers (`rgba(255,255,255,0.05)`) shift to solid white cards (`#ffffff`) with thin gray borders (`#cbd5e1` or `#e2e8f0`) and subtle shadows.
- **Color System**:
  - Primary Accent: Deep Corporate Navy Blue (`#1e3a8a`)
  - Secondary Accent/Highlights: Slate Gray (`#475569`) or Indigo (`#4f46e5`)
  - Text Main: High-contrast Dark Slate (`#0f172a`)
  - Text Muted: Professional Slate Gray (`#475569`)
  - Status Indicators (Pass/Fail/Skip): Higher-contrast solid audit tones (`#15803d`, `#b91c1c`, `#b45309`) readable on white surfaces.
- **Typography & Details**: Flat solid colors instead of gradients, clean borders, and removal of pulsing animations.

### 2. Affected Files

- `src/index.css`: Rewrite theme tokens and update styles.

---

## Detailed Design

### Design Tokens (CSS Variables)

```css
:root {
  --bg-color: #f1f5f9;         /* Soft light-gray background */
  --panel-bg: #ffffff;         /* Solid white for panels/cards */
  --panel-border: #cbd5e1;     /* Professional slate-gray border */
  --text-main: #0f172a;        /* Deep slate for high-contrast reading */
  --text-muted: #475569;       /* Slate-gray for labels and secondary info */
  --accent: #1e3a8a;           /* Deep corporate Navy Blue */
  --accent-hover: #1d4ed8;     /* Vibrant blue hover state */
  --accent2: #4f46e5;          /* Indigo accent */
  --pass: #15803d;             /* Audit green */
  --fail: #b91c1c;             /* Audit red */
  --skip: #b45309;             /* Audit amber */
  --radius: 8px;               /* Cleaner, slightly sharper corners */
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
}
```

### Component Adjustments

#### 1. Layout & Panels
- **`body`**: Use `var(--bg-color)` and `var(--text-main)`.
- **`.invoice-card`**, **`.resume-panel`**, **`.download-section`**: Change background to `var(--panel-bg)` and border to `1px solid var(--panel-border)`. Add `box-shadow: var(--shadow-sm)`.
- **`.modal`**: Replace dark gradient background with `var(--panel-bg)`.
- **`.modal-overlay`**: Change background to `rgba(15, 23, 42, 0.4)`.

#### 2. Inputs & Forms
- **`.mock-input`**: Set background to `var(--panel-bg)`, border to `1px solid var(--panel-border)`, and text to `var(--text-main)`.

#### 3. Buttons & Actions
- **`.btn-primary`**, **`.step-button`**: Replace gradients with solid `var(--accent)`. Hover state switches to `var(--accent-hover)`. Remove pulsing keyframe animation.
- **`.btn-secondary`**: Solid white/light-gray background with a thin gray border.
- **`.app-header h1`**: Remove text gradient, color directly as solid `var(--accent)`.

#### 4. Live Console
- Keep the console's internal code logs window black/dark-slate for readability, but make the header and border match the light theme layout using `var(--panel-border)`.
