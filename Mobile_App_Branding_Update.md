# Neura Pool - Mobile App Branding Update

## Overview
The technician mobile app has been updated with the new Neura Pool brand identity. All color tokens have been refreshed to use the primary brand colors.

---

## Color Changes

### Updated Color Tokens

#### Primary Colors
- **Deep Teal (#0D7C8F)** - Primary navigation, headers, text accents
- **Bright Cyan (#00D9FF)** - Call-to-action buttons (START, COMPLETE, SUBMIT)
- **Midnight Blue (#1A3A52)** - Secondary text, borders

#### Light Mode (Default)
```javascript
// Button Colors
buttonPrimary: '#00D9FF'              // Bright Cyan - Primary CTAs
buttonPrimaryText: '#ffffff'
buttonPrimaryShadow: 'rgba(0, 217, 255, 0.20)'

// Progress Indicators
progressBarBg: 'rgba(13, 124, 143, 0.15)'    // Deep Teal subtle
progressBarFill: '#0D7C8F'                    // Deep Teal primary
progressBarGradientEnd: '#00D9FF'             // Bright Cyan accent

// UI Elements
tint: '#0D7C8F'                              // Deep Teal
tabIconSelected: '#0D7C8F'
chipBg: 'rgba(13, 124, 143, 0.10)'
chipText: '#0D7C8F'
```

#### Dark Mode
```javascript
// Button Colors
buttonPrimary: '#00D9FF'              // Bright Cyan - Always visible
buttonPrimaryText: '#ffffff'

// Progress Indicators
progressBarBg: 'rgba(13, 124, 143, 0.20)'
progressBarFill: '#00D9FF'                    // Bright Cyan primary
progressBarGradientEnd: '#0D7C8F'             // Deep Teal secondary

// UI Elements
tint: '#00D9FF'
tabIconSelected: '#00D9FF'
chipBg: 'rgba(0, 217, 255, 0.15)'
chipText: '#00D9FF'
```

---

## Screen Mockups

### Screen 1: Login Screen
```
┌─────────────────────────────────┐
│       Neura Pool                │ ← Deep Teal (#0D7C8F) header
│         [Logo]                  │ ← Bright Cyan circle (water droplet)
├─────────────────────────────────┤
│                                 │
│  Email address                  │
│  [_________________________]     │ ← Light Gray input
│                                 │
│  Password                       │
│  [_________________________]     │ ← Light Gray input
│                                 │
│  [    SIGN IN    ]              │ ← Bright Cyan (#00D9FF) button
│                                 │
│  Don't have account? Create one │ ← Deep Teal link
│                                 │
└─────────────────────────────────┘
```

**Colors Applied:**
- Header: Deep Teal background
- Logo: Bright Cyan circle (representing water droplet)
- CTA Button: Bright Cyan with white text
- Links: Deep Teal

---

### Screen 2: Jobs Dashboard
```
┌─────────────────────────────────┐
│ Tuesday, Feb 21    ⌚ ⚙️         │ ← Dark text on light bg
├─────────────────────────────────┤
│                                 │
│ PROGRESS: 0 of 22               │ ← Deep Teal text
│ ████░░░░░░░░░░░░░░░░░░░░░░░░░░│ ← Deep Teal fill, Bright Cyan accent
│ 0%                              │
│                                 │
│ ┌───────────────────────────┐   │
│ │ House 5461                │   │ ← White card
│ │ Residencia Miller         │   │
│ │ Status: ⏳ Pending        │   │ ← Deep Teal accent
│ └───────────────────────────┘   │
│                                 │
│ ┌───────────────────────────┐   │
│ │ House 5492                │   │
│ │ Henderson Pool            │   │
│ │ Status: ⏳ Pending        │   │
│ └───────────────────────────┘   │
│                                 │
│ ┌───────────────────────────┐   │
│ │ House 720                 │   │
│ │ Beach House               │   │
│ │ Status: ⏳ Pending        │   │
│ └───────────────────────────┘   │
│                                 │
├─────────────────────────────────┤
│ [Jobs]  [Properties]  [Settings]│ ← Deep Teal active tab
└─────────────────────────────────┘
```

**Colors Applied:**
- Progress bar: Deep Teal background, accent cyan fill
- Headers: Deep Teal text
- Cards: White background
- Tab bar: Deep Teal selected indicator

---

### Screen 3: Service Form
```
┌─────────────────────────────────┐
│     Residencia Miller           │ ← Deep Teal header
│   1244 Blue Water Dr            │ ← White text on teal
│   Gate: 1234                    │
├─────────────────────────────────┤
│                                 │
│        [START SERVICE]          │ ← Large Bright Cyan button
│                                 │
│ CHEMICAL READINGS               │ ← Deep Teal section header
│ pH: [_________]                 │
│ Ideal: 7.2-7.6 pH              │ ← Muted gray helper text
│                                 │
│ Chlorine: [_________]           │
│ Ideal: 1-3 ppm                 │
│                                 │
│ ISSUE CATEGORY                  │ ← Deep Teal section header
│ ☐ No Issues                    │ ← Bright Cyan selected
│ ☐ Motor                        │
│ ☐ Filter                       │
│                                 │
│ PHOTOS                          │ ← Deep Teal section header
│ [Camera]  [Gallery]             │ ← Bright Cyan buttons
│                                 │
│           [MARK COMPLETE]       │ ← Large Bright Cyan CTA
│                                 │
└─────────────────────────────────┘
```

**Colors Applied:**
- Header: Deep Teal background
- CTAs (Start/Complete): Bright Cyan with white text
- Section headers: Deep Teal
- Input fields: Light Gray
- Selected elements: Bright Cyan highlights

---

### Screen 4: Settings/Profile
```
┌─────────────────────────────────┐
│ Settings                        │ ← Dark gray heading
├─────────────────────────────────┤
│                                 │
│ ┌───────────────────────────┐   │
│ │ John Technician           │   │ ← White card
│ │ john@neurapool.com        │   │
│ │ Role: Technician          │   │ ← Deep Teal text
│ └───────────────────────────┘   │
│                                 │
│ ┌───────────────────────────┐   │
│ │ Full Name         [Edit] →│   │ ← White card, Deep Teal link
│ └───────────────────────────┘   │
│                                 │
│ ┌───────────────────────────┐   │
│ │ Phone Number      [Edit] →│   │
│ └───────────────────────────┘   │
│                                 │
│ ┌───────────────────────────┐   │
│ │ Change Password    [Edit] →│   │
│ └───────────────────────────┘   │
│                                 │
│ ┌───────────────────────────┐   │
│ │ Logout                    │   │ ← Deep Teal text
│ └───────────────────────────┘   │
│                                 │
└─────────────────────────────────┘
```

**Colors Applied:**
- Profile card: Deep Teal accent text
- Links: Deep Teal
- Cards: White background
- Section headers: Dark gray

---

## Implementation Notes

### Files Updated
1. **constants/Colors.ts**
   - Updated all color tokens to use Neura Pool brand colors
   - Deep Teal as primary (#0D7C8F)
   - Bright Cyan as accent/CTA (#00D9FF)
   - Midnight Blue as secondary (#1A3A52)

2. **app.json**
   - App name: "Neura Pool"
   - Slug: "neura-pool"

### Key Changes
✅ **Button Colors:**
- All primary CTAs now use Bright Cyan (#00D9FF) for high visibility
- Creates strong visual hierarchy for "Start Service" and "Mark Complete" buttons

✅ **Progress Indicators:**
- Background: Deep Teal with low opacity
- Fill: Deep Teal primary, Bright Cyan gradient accent
- Better visual feedback for daily job progress

✅ **Navigation:**
- Tab icons use Deep Teal when selected
- Deep Teal header backgrounds
- Cyan link colors for secondary actions

✅ **Dark Mode Support:**
- All colors optimized for dark theme
- Bright Cyan maintains visibility in dark mode
- Deep Teal adjusts for contrast

---

## Visual Hierarchy

### Priority 1 (Highest - Action Required)
- **Color:** Bright Cyan (#00D9FF)
- **Elements:** START SERVICE, MARK COMPLETE, major CTAs
- **Why:** Bright cyan pops against all backgrounds, signals AI/tech

### Priority 2 (Secondary - Navigation)
- **Color:** Deep Teal (#0D7C8F)
- **Elements:** Headers, section titles, tab indicators
- **Why:** Professional, trustworthy, brand-forward

### Priority 3 (Tertiary - Supporting)
- **Color:** Midnight Blue (#1A3A52) or Gray
- **Elements:** Body text, muted labels, subtle elements
- **Why:** Readable but not commanding attention

---

## Testing Checklist

- [ ] Login screen displays correctly with new header colors
- [ ] Job cards render properly with updated border/shadow colors
- [ ] Progress bar animates smoothly with new gradient
- [ ] "Start Service" button is highly visible in Bright Cyan
- [ ] "Mark Complete" button stands out on service form
- [ ] Dark mode contrast passes WCAG AA standards
- [ ] Icon colors update correctly when tabs are selected
- [ ] All input fields have proper focus states with new colors
- [ ] Error states remain visible with updated palette

---

## Next Steps

1. **Update App Icons:**
   - Replace NeuraPool icon with Neura Pool logo
   - Splash screen should feature Neura Pool branding
   - App icon: Cyan water droplet on Deep Teal background

2. **Update Assets:**
   - Replace all app images/icons with Neura Pool assets
   - Ensure logo appears in app header

3. **QA & Testing:**
   - Test all screens on iOS and Android
   - Verify colors match brand guide
   - Check accessibility (color contrast ratios)

4. **Release:**
   - Bump version number
   - Update app store listing with new branding
   - Update description to mention "by Neuraliti"

