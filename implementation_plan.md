# Backend Admin Dashboard: Sidebar Redesign

This plan outlines the first phase of the dashboard UI redesign, focusing on updating the sidebar to match the modern, clean aesthetic of the new main dashboard view. 

## Proposed Changes

Currently, the sidebar uses a floating "glassmorphism" style with heavy shadows. We will update this to a cleaner, more grounded layout that aligns with the crisp, white/surface-styled cards in the main area.

### 1. Structural Layout
- **Flush Positioning**: Remove the outer margins (currently `0.875rem`) so the sidebar sits flush against the left, top, and bottom edges of the viewport.
- **Border Radius**: Apply rounded corners only to the top-right and bottom-right edges.
- **Width**: Increase the width slightly from `240px` to `260px` to give the navigation items more breathing room.

### 2. Color Theme & Styling
- **Background**: Replace the translucent `glass` background with a solid, clean surface color (`var(--surface)`) to match the new dashboard cards.
- **Borders & Shadows**: Use a subtle right border (`1px solid var(--border)`) and a very soft drop shadow (`0 4px 20px rgba(0,0,0,0.05)`) instead of the current heavy shadow.
- **Brand Header**: 
  - Simplify the top section. Keep the icon but use the new primary purple accent (`var(--accent)`).
  - Use a clean separator line beneath the brand header.

### 3. Navigation Items
- **Active State**: Use a solid, vibrant purple background (`var(--accent)`) with white text/icons for the currently selected route, adding a soft purple glow/shadow.
- **Inactive State**: Use a clean, muted text color with grey icons.
- **Hover Effects**: Add a soft, light-grey/purple background tint on hover for inactive items.
- **Typography**: Increase the font size slightly and use slightly heavier font weights for better legibility.

### 4. Logout Button
- Place the logout button neatly at the bottom with a clean, light red background (`rgba(239,68,68,0.1)`) and solid red text. 
- Remove any heavy borders, relying instead on the background tint and red icon for visual hierarchy.

## User Review Required

> [!IMPORTANT]  
> Please review the proposed visual changes for the sidebar. Are you happy with moving from a "floating glass" style to a "flush, clean solid" style? Are there any specific new menu items or additional links you want added during this redesign, or should we strictly keep the existing `Overview`, `Sales Employees`, and `Field Employees`?
